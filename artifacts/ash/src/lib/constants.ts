export const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

// Recovery fee: charged once per recovery batch, in native units.
//
// FEE_RECIPIENT is read from the environment in production so the operator
// can rotate the address without redeploying the frontend. We fall back to a
// stable default for local dev so the app still works out of the box.
const FEE_RECIPIENT_ENV = import.meta.env.VITE_FEE_RECIPIENT as
  | `0x${string}`
  | undefined;
const FEE_RECIPIENT_DEFAULT =
  "0xcfC3aE41DbdDD1D6e3b74Cb67d67FD74CbEAa07B" as const;
export const FEE_RECIPIENT: `0x${string}` =
  FEE_RECIPIENT_ENV && /^0x[a-fA-F0-9]{40}$/.test(FEE_RECIPIENT_ENV)
    ? FEE_RECIPIENT_ENV
    : FEE_RECIPIENT_DEFAULT;

// Per-chain recovery fee, in native wei. Chains not listed here charge no
// fee. Mainnet defaults to 0 so the operator can opt in by setting
// VITE_MAINNET_RECOVERY_FEE_WEI in their deployment env.
const MAINNET_FEE_ENV = import.meta.env.VITE_MAINNET_RECOVERY_FEE_WEI as
  | string
  | undefined;
let mainnetFee = 0n;
if (MAINNET_FEE_ENV) {
  try {
    mainnetFee = BigInt(MAINNET_FEE_ENV);
  } catch {
    mainnetFee = 0n;
  }
}
export const RECOVERY_FEE_WEI: Record<number, bigint> = {
  10143: 250000000000000000n, // 0.25 MON on Monad testnet
  143: 0n, // Monad mainnet — recovery disabled, fee unused
  1: mainnetFee, // Ethereum mainnet — env-driven, defaults to 0
};

// Block explorers used to build clickable tx links in the burn-progress UI.
export const EXPLORER_TX: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  143: "https://monadexplorer.com/tx/",
  10143: "https://testnet.monadexplorer.com/tx/",
};

// Slippage tolerance applied to the swap (i.e. minOut = quote * (1 - slippage)).
// Tighter on mainnet because real liquidity is deeper and MEV bots will
// happily fill any extra room we leave them.
export const SLIPPAGE_BPS: Record<number, bigint> = {
  1: 200n, // 2% on Ethereum mainnet
  143: 200n, // 2% on Monad mainnet (unused — no DEX wired)
  10143: 500n, // 5% on Monad testnet (thin liquidity)
};
export const DEFAULT_SLIPPAGE_BPS = 300n; // 3% fallback for any other chain

// Hard cap on swap deadline. Wallets that sit unsigned past this are rejected
// on-chain instead of going through at a stale price.
export const SWAP_DEADLINE_SECONDS = 600; // 10 minutes

export const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
] as const;

export type CuratedToken = { address: `0x${string}`; symbol: string; name: string; decimals?: number };

export const CURATED_TOKENS: Record<number, CuratedToken[]> = {
  // Monad
  10143: [
    { address: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D", symbol: "WMON", name: "Wrapped MON", decimals: 18 },
    { address: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea", symbol: "USDC", name: "USD Coin", decimals: 6 },
  ],
  // Ethereum Mainnet
  1: [
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", name: "Tether USD", decimals: 6 },
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", name: "Dai Stablecoin", decimals: 18 },
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
    { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", name: "Wrapped BTC", decimals: 8 },
    { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK", name: "ChainLink Token", decimals: 18 },
    { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", symbol: "UNI", name: "Uniswap", decimals: 18 },
    { address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", symbol: "AAVE", name: "Aave Token", decimals: 18 },
    { address: "0x4Fabb145d64652a948d72533023f6E7A623C7C53", symbol: "BUSD", name: "Binance USD", decimals: 18 },
    { address: "0xc944E90C64B2c07662A292be6244BDf05Cda44a7", symbol: "GRT", name: "The Graph", decimals: 18 },
    { address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", symbol: "PEPE", name: "Pepe", decimals: 18 },
    { address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", symbol: "SHIB", name: "Shiba Inu", decimals: 18 },
    { address: "0x4d224452801ACEd8B2F0aebE155379bb5D594381", symbol: "APE", name: "ApeCoin", decimals: 18 },
    { address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", symbol: "stETH", name: "Lido Staked ETH", decimals: 18 },
  ],
};

// Public token list URL — Uniswap default list (covers Ethereum mainnet + many L2s)
export const TOKEN_LIST_URLS: string[] = [
  "https://tokens.uniswap.org",
  "https://tokens.coingecko.com/uniswap/all.json",
];

// Uniswap V2-compatible router ABI (subset we need)
export const V2_ROUTER_ABI = [
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    name: "getAmountsOut",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForETHSupportingFeeOnTransferTokens",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// DEX routers for swap-then-recover-native flow.
// `wrappedNative` is the wrapped form of the chain's gas token (used as the swap path target).
// Set router to null on chains where no router is configured — recovery mode will be disabled.
export type DexConfig = {
  router: `0x${string}` | null;
  wrappedNative: `0x${string}`;
  label: string;
};

export const DEX_ROUTERS: Record<number, DexConfig> = {
  // Monad testnet
  10143: {
    router: "0x5f16e51e3Dcb255480F090157DD01bA962a53E54",
    wrappedNative: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D", // WMON
    label: "Monad",
  },
  // Ethereum — Uniswap V2 router
  1: {
    router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    label: "Uniswap V2",
  },
  // Monad mainnet (chain 143) is handled via the Trading API, not on-chain
  // V2 calls — see RECOVERY_MODE / V4_ADDRESSES below.
};

// How recovery executes per chain.
//
//   "v2"          — direct on-chain calls to a Uniswap V2-style router.
//                   Used for Ethereum mainnet and Monad testnet.
//   "trading-api" — Uniswap Trading API via our backend proxy. Used for
//                   chains that are V4-only (Monad mainnet) or where we
//                   want Uniswap to do best-route routing for us.
export type RecoveryMode = "v2" | "trading-api";
export const RECOVERY_MODE: Record<number, RecoveryMode> = {
  1: "v2",
  10143: "v2",
  143: "trading-api",
};

// V4 contract addresses, verified against
//   https://docs.uniswap.org/contracts/v4/deployments
// We only need the wrapped-native here today (the Trading API hides the
// router/quoter details behind its own response), but we keep the rest
// pinned for future direct-V4 integrations and for explorer links.
export const V4_ADDRESSES: Record<
  number,
  {
    universalRouter: `0x${string}`;
    v4Quoter: `0x${string}`;
    poolManager: `0x${string}`;
    permit2: `0x${string}`;
    wrappedNative: `0x${string}`;
  }
> = {
  143: {
    universalRouter: "0x0d97dc33264bfc1c226207428a79b26757fb9dc3",
    v4Quoter: "0xa222dd357a9076d1091ed6aa2e16c9742dd26891",
    poolManager: "0x188d586ddcf52439676ca21a244753fa19f9ea8e",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    wrappedNative: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A", // WMON
  },
};
