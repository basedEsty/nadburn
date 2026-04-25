import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";

// Map of chainId -> Blockscout-style API base. Restricting this server-side
// avoids SSRF — clients can only pick from this fixed set of explorers.
const EXPLORER_BASE: Record<number, string> = {
  1: "https://eth.blockscout.com",
  10143: "https://testnet.monadexplorer.com",
};

// Monad mainnet (chain 143) doesn't have a CORS-friendly public Blockscout-
// compatible API yet — the official explorer is behind Cloudflare. We use
// Blockvision's hosted Monad indexer for that chain. Free tier is plenty
// for typical wallet auto-detect usage. Set BLOCKVISION_API_KEY on the
// server to enable; without it, chain 143 returns empty and the UI nudges
// the user to paste tokens manually.
const BLOCKVISION_BASE = "https://api.blockvision.org";

type BlockvisionToken = {
  contractAddress?: string;
  symbol?: string;
  name?: string;
  decimal?: number | string;
  decimals?: number | string;
  balance?: string;
  value?: string;
};
type BlockvisionResponse = {
  code?: number;
  message?: string;
  result?: { data?: BlockvisionToken[] } | BlockvisionToken[];
};

// Cap how often a single client can hammer the proxy.
const CACHE_MS = 15_000;
// Bound memory growth: evict when the cache exceeds this many entries.
const MAX_CACHE_SIZE = 1_000;
// Reject upstream responses larger than this to prevent memory exhaustion.
const MAX_RESPONSE_BYTES = 1_048_576; // 1 MiB

type CacheEntry = { at: number; payload: unknown };
const cache = new Map<string, CacheEntry>();

/**
 * Read a fetch Response body with a hard byte cap, then parse as JSON.
 * Aborts and throws if the body exceeds maxBytes, even when Content-Length
 * is absent, incorrect, or reflects a compressed size.
 */
async function readJsonWithLimit(r: Awaited<ReturnType<typeof fetch>>, maxBytes: number): Promise<unknown> {
  const reader = r.body?.getReader();
  if (!reader) throw new Error("No response body");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw new Error(`Response body exceeds ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(combined));
}

/**
 * Evict expired entries from the cache. If the cache is still at or above
 * MAX_CACHE_SIZE after removing stale entries, delete the oldest ones until
 * the size is within the limit.
 */
function evictCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.at >= CACHE_MS) {
      cache.delete(key);
    }
  }
  // If we are still over the limit, delete from the front (oldest inserted).
  while (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey === undefined) break;
    cache.delete(firstKey);
  }
}

const router: IRouter = Router();

// GET /api/explorer/tokens?chainId=1&address=0x...
router.get("/explorer/tokens", async (req: Request, res: Response) => {
  const chainId = Number(req.query.chainId);
  const address = String(req.query.address ?? "");
  // Monad mainnet (143) is handled by the Blockvision branch below.
  if (
    !Number.isInteger(chainId) ||
    (!EXPLORER_BASE[chainId] && chainId !== 143)
  ) {
    res.status(400).json({ error: "Unsupported chainId" });
    return;
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  const cacheKey = `${chainId}:${address.toLowerCase()}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.at < CACHE_MS) {
    res.json(cached.payload);
    return;
  }

  // ─── Monad mainnet via Blockvision ──────────────────────────────────
  if (chainId === 143) {
    const apiKey = process.env.BLOCKVISION_API_KEY;
    if (!apiKey) {
      // Mirror the "missing key" UX of the Trading API proxy: return a
      // distinct code so the frontend can render a friendly banner with
      // setup instructions instead of silently showing an empty list.
      const payload = {
        source: "missing-key",
        code: "MISSING_BLOCKVISION_API_KEY",
        count: 0,
        tokens: [] as unknown[],
      };
      evictCache();
      cache.set(cacheKey, { at: now, payload });
      res.json(payload);
      return;
    }
    try {
      const url = `${BLOCKVISION_BASE}/v2/monad/account/tokens?address=${address}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const r = await fetch(url, {
        headers: { accept: "application/json", "x-api-key": apiKey },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!r.ok) {
        logger.warn(
          { status: r.status, url },
          "Blockvision Monad tokens upstream non-2xx",
        );
        // Don't cache upstream errors (esp. 429 rate limits) — caching
        // would block legit retries for the next 15s. Just return the
        // empty payload and let the next request try again.
        res.json({
          source: "blockvision-error",
          status: r.status,
          count: 0,
          tokens: [] as unknown[],
        });
        return;
      }
      const raw = (await readJsonWithLimit(
        r,
        MAX_RESPONSE_BYTES,
      )) as BlockvisionResponse;
      // Blockvision occasionally wraps the array in `{ result: { data } }`
      // and other times returns it directly under `result`. Handle both.
      const items: BlockvisionToken[] = Array.isArray(raw?.result)
        ? raw.result
        : Array.isArray(raw?.result?.data)
        ? raw.result.data
        : [];
      const tokens = items
        .map((it) => {
          const addr =
            typeof it.contractAddress === "string"
              ? it.contractAddress.toLowerCase()
              : null;
          if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
          const dec =
            typeof it.decimal !== "undefined" ? it.decimal : it.decimals;
          // Skip the chain's native MON entry — auto-detect is for ERC-20s
          // only; native balance is read separately via wagmi.
          if (addr === "0x0000000000000000000000000000000000000000") return null;
          return {
            address: addr,
            symbol: typeof it.symbol === "string" ? it.symbol : null,
            name: typeof it.name === "string" ? it.name : null,
            decimals: dec ? Number(dec) : 18,
            value: typeof it.balance === "string" ? it.balance : "0",
          };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);

      const payload = { source: "blockvision", count: tokens.length, tokens };
      evictCache();
      cache.set(cacheKey, { at: now, payload });
      res.json(payload);
      return;
    } catch (err) {
      logger.warn({ err }, "Blockvision fetch failed");
      // Don't cache transient fetch failures (timeouts, DNS, parse errors) —
      // a retry should actually re-attempt, not return the stale empty.
      res.json({
        source: "blockvision-error",
        count: 0,
        tokens: [] as unknown[],
      });
      return;
    }
  }

  const base = EXPLORER_BASE[chainId];
  // Try a couple of known Blockscout endpoint shapes — different deployments
  // expose tokens via different paths and the response shapes also vary.
  // Both candidates include type=ERC-20 to avoid downloading large NFT/multi-token dumps.
  const candidates = [
    `${base}/api/v2/addresses/${address}/token-balances?type=ERC-20`,
    `${base}/api/v2/addresses/${address}/tokens?type=ERC-20`,
  ];

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const r = await fetch(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!r.ok) continue;

      // Reject obviously oversized responses early via the Content-Length hint,
      // then enforce the hard byte cap during streaming to cover absent or
      // inaccurate headers (e.g. when transport compression is in use).
      const contentLength = r.headers.get("content-length");
      if (contentLength !== null && Number(contentLength) > MAX_RESPONSE_BYTES) {
        logger.warn({ url, contentLength }, "explorer response too large, skipping");
        continue;
      }

      const raw: unknown = await readJsonWithLimit(r, MAX_RESPONSE_BYTES);

      // Normalize both response shapes:
      //   /token-balances -> [{ token: {...}, value: "..." }, ...]
      //   /tokens         -> { items: [{ token: {...}, value: "..." }, ...], next_page_params }
      const items: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as any)?.items)
        ? (raw as any).items
        : [];

      const tokens = items
        .map((it) => {
          const tok = it?.token;
          // Blockscout uses `address_hash` on most chains; some shards return
          // `address`. Accept either.
          const addr: unknown = tok?.address_hash ?? tok?.address;
          if (typeof addr !== "string") return null;
          if (tok?.type !== "ERC-20") return null;
          if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
          return {
            address: addr.toLowerCase(),
            symbol: tok.symbol ?? null,
            name: tok.name ?? null,
            decimals: tok.decimals ? Number(tok.decimals) : 18,
            value: typeof it.value === "string" ? it.value : "0",
          };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);

      const payload = { source: url, count: tokens.length, tokens };
      evictCache();
      cache.set(cacheKey, { at: now, payload });
      res.json(payload);
      return;
    } catch (err) {
      logger.warn({ err, url }, "explorer fetch failed");
      continue;
    }
  }

  // Nothing worked — return empty so the client can fall back gracefully.
  const payload = { source: null, count: 0, tokens: [] as unknown[] };
  evictCache();
  cache.set(cacheKey, { at: now, payload });
  res.json(payload);
});

export default router;
