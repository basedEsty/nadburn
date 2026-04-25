# Threat Model

## Project Overview

Ash is a pnpm workspace monorepo for a crypto wallet cleanup application. The production deployment consists of a React/Vite frontend in `artifacts/ash`, an Express 5 API server in `artifacts/api-server`, shared API/auth libraries in `lib/*`, and a PostgreSQL database accessed through Drizzle.

Users connect a wallet in the browser, optionally authenticate through Replit OIDC, and can save token metadata or burn-history records to the server. The API also proxies selected blockchain explorer requests. The `artifacts/mockup-sandbox` package is a development-only mockup environment and is out of scope unless production reachability is demonstrated.

Assumptions for this threat model:
- Production runs with `NODE_ENV=production`.
- Replit provides TLS termination for deployed traffic.
- Mockup sandbox is never deployed to production.

## Assets

- **User sessions and auth state** — session IDs (`sid`), OIDC access/refresh tokens, and authenticated user identity. Compromise enables account impersonation and access to user-scoped server data.
- **User-scoped application data** — saved tokens and burn-history records stored in Postgres. These are lower-sensitivity than financial credentials, but they still reveal wallet activity and user preferences.
- **Application secrets and infrastructure credentials** — `DATABASE_URL`, OIDC client configuration, and any deployment-time environment variables. Exposure could allow database or identity-provider abuse.
- **Integrity of wallet actions and UI guidance** — the frontend never controls private keys, but it does decide which contracts, routers, addresses, and amounts are presented to the user for signature. Wrong or attacker-influenced values could redirect funds or cause destructive transactions.
- **Backend network egress** — the explorer proxy can make outbound HTTP requests. It must not be turned into a generic SSRF primitive.

## Trust Boundaries

- **Browser / API boundary** — all frontend requests into `/api/*` cross from untrusted client code into trusted server logic. Authentication, authorization, and input validation must be enforced server-side. On shared-hosted domains like `*.replit.app`, sibling origins can still be same-site for cookie purposes, so origin trust must be tighter than an eTLD+1-wide wildcard.
- **API / PostgreSQL boundary** — the API has database access. Any query scoping mistake or missing database-side isolation could expose one user's records to another.
- **API / OIDC provider boundary** — login, callback, token refresh, and logout depend on a trusted external identity provider. Redirect URIs, callback handling, and session creation must not be attacker-controlled.
- **API / external explorer boundary** — `/api/explorer/tokens` fetches third-party explorer data. User input must not control arbitrary destinations, request headers, or unbounded response handling.
- **Frontend / wallet boundary** — the application can request transactions but cannot sign them. The UI must not derive transaction targets or values from attacker-controlled input without validation.
- **Production / dev-only boundary** — `artifacts/mockup-sandbox` and similar preview-only utilities should be ignored unless evidence shows they are reachable in production.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/ash/src/main.tsx`
- **Highest-risk server areas:** `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/middlewares/authMiddleware.ts`, `artifacts/api-server/src/lib/auth.ts`, `artifacts/api-server/src/lib/userDb.ts`
- **User-scoped data surfaces:** `artifacts/api-server/src/routes/burnHistory.ts`, `artifacts/api-server/src/routes/savedTokens.ts`, `lib/db/src/schema/*`
- **External fetch surface:** `artifacts/api-server/src/routes/explorer.ts`, frontend token discovery in `artifacts/ash/src/pages/BurnerApp.tsx`
- **Public vs authenticated surfaces:** `/api/healthz`, `/api/login`, `/api/callback`, `/api/explorer/tokens` are public; `/api/burn-history` and `/api/saved-tokens` require auth; mobile auth routes are public but security-sensitive
- **Usually ignore as dev-only:** `artifacts/mockup-sandbox/**`

## Threat Categories

### Spoofing

Authentication is based on Replit OIDC and a server-stored session ID that can also be used as a bearer token for mobile flows. The system must only create sessions after a valid OIDC code exchange, must bind callback processing to server-generated state/PKCE material, and must treat session IDs as secrets whether they travel via cookie or `Authorization` header.

### Tampering

The browser is untrusted. API endpoints that persist burn history or saved tokens must validate request bodies and must not trust client-supplied ownership fields. Login/logout and other state-changing routes must reject cross-site requests that do not originate from explicitly owned production origins; broad wildcard trust for sibling hosted apps is not sufficient. Frontend-generated transaction parameters must come from validated constants, chain data, or wallet state rather than attacker-controlled HTML or query-string input.

### Information Disclosure

User-scoped saved-token and burn-history records must be isolated per authenticated user. That isolation must be enforceable from versioned application and database configuration, not only from undocumented out-of-band database setup. Session IDs, OIDC tokens, and infrastructure secrets must never appear in client bundles or logs. Error handling should stay JSON-only and avoid leaking stack traces, query details, or upstream response bodies.

### Denial of Service

Public routes can be abused for request flooding, repeated login initiation, or repeated explorer fetches. The API must keep request bodies bounded, rate-limit sensitive write/auth endpoints, and keep outbound explorer calls time-limited and destination-restricted so unauthenticated users cannot turn the service into an expensive proxy.

### Elevation of Privilege

All routes that access user data must require a valid authenticated session and must enforce per-user authorization server-side and, where relied upon, in the database. Trust in proxy headers, callback origins, redirect targets, and any server-side fetch destinations must not allow an attacker to escalate from an unauthenticated request to another user's session or data.