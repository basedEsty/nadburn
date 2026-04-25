import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";

// Backend proxy for Uniswap's Trading API. Two reasons we proxy instead of
// calling from the browser:
//   1. The API key is a paid credential — it MUST stay server-side. If we
//      shipped it in the bundle anyone viewing source could exfiltrate it.
//   2. CORS — the Trading API does not advertise our origin, so a direct
//      browser fetch would be blocked anyway.
//
// We send `x-permit2-disabled: true` on every upstream call so users get a
// plain "approve token, then swap" UX (same as our existing V2 flow) instead
// of having to sign EIP-712 Permit2 messages.

const TRADING_API_BASE =
  process.env.UNISWAP_TRADING_API_BASE ||
  "https://trade-api.gateway.uniswap.org/v1";

// Allowlist of upstream endpoints. Anything not in this set is rejected so
// the proxy can never be repurposed to hit arbitrary URLs we haven't
// reviewed for safety.
const ALLOWED_ENDPOINTS = new Set(["check_approval", "quote", "swap"]);

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 32 * 1024;

const router: IRouter = Router();

router.post("/uniswap/:endpoint", async (req: Request, res: Response) => {
  const raw = req.params["endpoint"];
  const endpoint = typeof raw === "string" ? raw : "";
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    res.status(404).json({ error: "Unknown Uniswap endpoint" });
    return;
  }

  const apiKey = process.env.UNISWAP_TRADING_API_KEY;
  if (!apiKey) {
    // Distinct error code so the frontend can render a friendly
    // "configure your API key" banner instead of a generic failure.
    res.status(503).json({
      error:
        "Uniswap Trading API key is not configured on the server. Set the UNISWAP_TRADING_API_KEY environment variable. You can request one at https://hub.uniswap.org or use the playground key from https://api-docs.uniswap.org for development.",
      code: "MISSING_UNISWAP_API_KEY",
    });
    return;
  }

  // Stringify defensively: Express has already parsed the JSON body. We
  // re-stringify to forward and to enforce the size cap.
  const bodyText = JSON.stringify(req.body ?? {});
  if (bodyText.length > MAX_BODY_BYTES) {
    res.status(413).json({ error: "Request body too large" });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${TRADING_API_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-key": apiKey,
        "x-permit2-disabled": "true",
      },
      body: bodyText,
      signal: controller.signal,
    });

    // Pass through status + body verbatim. Trading API returns helpful
    // error messages we want the frontend to surface (e.g. "no route",
    // "insufficient liquidity", "invalid token address").
    const text = await upstream.text();
    res
      .status(upstream.status)
      .type("application/json")
      .send(text || "{}");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err, endpoint }, "Uniswap proxy upstream error");
    res.status(502).json({
      error: "Upstream Uniswap Trading API request failed",
      detail: message.slice(0, 200),
    });
  } finally {
    clearTimeout(timer);
  }
});

export default router;
