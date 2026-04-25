export type BurnHistoryItem = {
  id: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  mode: "burn" | "recover" | string;
  txHash: string;
  recoveredNative: string | null;
  createdAt: string;
};

export type SavedTokenItem = {
  id: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string | null;
  decimals: number;
  createdAt: string;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listBurnHistory: () =>
    request<{ items: BurnHistoryItem[] }>("/api/burn-history").then((r) => r.items),
  recordBurn: (input: Omit<BurnHistoryItem, "id" | "createdAt">) =>
    request<BurnHistoryItem>("/api/burn-history", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listSavedTokens: () =>
    request<{ items: SavedTokenItem[] }>("/api/saved-tokens").then((r) => r.items),
  saveToken: (input: {
    chainId: number;
    tokenAddress: string;
    tokenSymbol: string;
    tokenName?: string | null;
    decimals: number;
  }) =>
    request<SavedTokenItem>("/api/saved-tokens", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteSavedToken: (id: string) =>
    request<{ success: true }>(`/api/saved-tokens/${id}`, { method: "DELETE" }),
};
