// Frontend client for Uniswap's Trading API, talking to our backend proxy at
// /api/uniswap/*. The proxy keeps the API key server-side and always sets
// `x-permit2-disabled: true`, so the swap flow here is plain
// approve-then-swap with no Permit2 signatures required.

export type TradingApiError = {
  error: string;
  code?: string;
  detail?: string;
};

// Hex-or-decimal-string addresses & values from the Trading API. We keep
// them as strings everywhere and only convert to bigint right before sending
// the transaction.
export type TxRequest = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  from?: `0x${string}`;
  chainId?: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
};

export type QuoteRequest = {
  tokenIn: string;
  tokenOut: string;
  amount: string; // raw token units, decimal string
  type: "EXACT_INPUT" | "EXACT_OUTPUT";
  tokenInChainId: number;
  tokenOutChainId: number;
  swapper: string;
  slippageTolerance?: number; // percent, e.g. 0.5 for 0.5%
  routingPreference?: "CLASSIC" | "BEST_PRICE" | "FASTEST" | string;
  protocols?: string[];
};

// The Trading API returns an opaque `quote` object that we pass back into
// /swap unchanged. The response shape varies by routing version, so we don't
// over-type its internals — `unknown` keeps the typecheck honest.
export type QuoteResponse = {
  quote: Record<string, unknown> & {
    output?: { amount?: string };
    quote?: string;
    amount?: string;
    amountOut?: string;
    amountOutDecimals?: string;
    quoteGasAdjusted?: string;
  };
  requestId?: string;
  routing?: string;
  permitData?: unknown;
};

export type CheckApprovalRequest = {
  walletAddress: string;
  token: string;
  amount: string;
  chainId: number;
  includeGasInfo?: boolean;
};

export type CheckApprovalResponse = {
  approval: TxRequest | null;
  cancel: TxRequest | null;
  gasFee?: string;
};

export type SwapRequest = {
  quote: QuoteResponse["quote"];
  permitData?: unknown;
  simulateTransaction?: boolean;
};

export type SwapResponse = {
  swap: TxRequest;
  gasFee?: string;
  requestId?: string;
};

const PROXY_BASE = "/api/uniswap";

async function postProxy<TIn extends object, TOut>(
  endpoint: string,
  body: TIn,
): Promise<TOut> {
  const r = await fetch(`${PROXY_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  // Read as text so we can show the upstream's helpful error messages even
  // when the response isn't valid JSON.
  const text = await r.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!r.ok) {
    const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<
      string,
      unknown
    >;
    const err: TradingApiError = {
      error:
        (typeof obj["error"] === "string" ? (obj["error"] as string) : "") ||
        text.slice(0, 200) ||
        `HTTP ${r.status}`,
      code: typeof obj["code"] === "string" ? (obj["code"] as string) : undefined,
      detail:
        typeof obj["detail"] === "string"
          ? (obj["detail"] as string)
          : undefined,
    };
    throw err;
  }

  return parsed as TOut;
}

export const uniswapTrading = {
  quote: (req: QuoteRequest) => postProxy<QuoteRequest, QuoteResponse>("quote", req),
  checkApproval: (req: CheckApprovalRequest) =>
    postProxy<CheckApprovalRequest, CheckApprovalResponse>("check_approval", req),
  swap: (req: SwapRequest) => postProxy<SwapRequest, SwapResponse>("swap", req),
};

// The Trading API returns the quoted output amount in a few different
// shapes depending on routing version. This helper picks the first
// non-empty value, normalizes it to a bigint of base units, and returns 0n
// on any parse failure so callers can treat "no quote" uniformly.
export function extractQuoteOut(q: QuoteResponse | null | undefined): bigint {
  if (!q?.quote) return 0n;
  const candidates = [
    q.quote.output?.amount,
    q.quote.quote,
    q.quote.amount,
    q.quote.amountOut,
    q.quote.quoteGasAdjusted,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) {
      try {
        return BigInt(c);
      } catch {
        // fall through to next candidate
      }
    }
  }
  return 0n;
}

// Native-token sentinel used by Uniswap's Trading API when you want to
// receive (or pay) the chain's native gas token instead of the wrapped ERC20.
export const NATIVE_TOKEN_SENTINEL =
  "0x0000000000000000000000000000000000000000";
