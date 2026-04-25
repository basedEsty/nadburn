import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

const app: Express = express();

app.set("trust proxy", 1);

const allowedOrigins = new Set<string>();
for (const env of [
  process.env.REPLIT_DEV_DOMAIN,
  process.env.REPLIT_DOMAINS,
  process.env.PUBLIC_APP_DOMAIN,
]) {
  if (!env) continue;
  for (const host of env.split(",").map((h) => h.trim()).filter(Boolean)) {
    allowedOrigins.add(`https://${host}`);
  }
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Security headers (HSTS, no-sniff, frame controls, etc.).
// We don't enforce a CSP here because the API is consumed cross-origin by the
// frontend artifact and the OIDC provider redirects back to us.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  cors({
    credentials: true,
    origin(origin, cb) {
      // Same-origin requests (no Origin header) and known frontend origins.
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      // Replit personal dev-preview domains — each subdomain is scoped to a
      // single Repl and cannot be registered by other tenants.
      if (/^https:\/\/[a-z0-9-]+\.(?:spock|kirk|janeway|picard|riker)\.replit\.dev$/.test(origin)) {
        return cb(null, true);
      }
      // NOTE: *.replit.app is intentionally NOT trusted here. All *.replit.app
      // origins share the same registrable domain, so SameSite cookies are sent
      // cross-tenant. Only the specific origins declared in the environment
      // variables above are allowed.
      cb(new Error("Origin not allowed by CORS"));
    },
  }),
);

app.use(cookieParser());
// Cap request body size to mitigate denial-of-service via huge payloads.
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true, limit: "32kb" }));

// Lightweight CSRF mitigation: require a same-site/known Origin header on
// state-changing requests. Combined with SameSite=Strict session cookies this
// blocks cross-site form posts and cross-tenant *.replit.app requests.
app.use((req: Request, res: Response, next: NextFunction) => {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }
  // Allow OIDC mobile flows that don't carry a browser Origin.
  if (req.path.startsWith("/api/mobile-auth/")) return next();
  const origin = req.get("origin");
  if (!origin) {
    res.status(403).json({ error: "Missing Origin header" });
    return;
  }
  if (allowedOrigins.has(origin)) return next();
  if (/^https:\/\/[a-z0-9-]+\.(?:spock|kirk|janeway|picard|riker)\.replit\.dev$/.test(origin)) {
    return next();
  }
  // NOTE: *.replit.app is intentionally NOT trusted here for the same reason
  // as the CORS configuration above — cross-tenant same-site cookie leakage.
  res.status(403).json({ error: "Origin not allowed" });
});

// Rate limit all write endpoints per IP to slow abuse / brute force.
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, slow down." },
});
app.use((req, res, next) => {
  const m = req.method.toUpperCase();
  if (m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE") {
    return writeLimiter(req, res, next);
  }
  next();
});

// Stricter limit for the login endpoint to deter abuse of the OIDC redirect.
app.use(
  "/api/login",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);

// Rate limit the public explorer proxy to prevent DoS via expensive upstream fetches.
app.use(
  "/api/explorer",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests, slow down." },
  }),
);

app.use(authMiddleware);

app.use("/api", router);

// JSON-only error handler (avoids leaking stack traces in HTML).
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal error";
  if (message === "Origin not allowed by CORS") {
    res.status(403).json({ error: message });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal error" });
});

export default app;
