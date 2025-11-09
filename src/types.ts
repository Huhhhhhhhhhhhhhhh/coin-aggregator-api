export type Token = {
  token_address: string;
  token_name?: string;
  token_ticker?: string;
  price_sol?: number | null;
  price_usd?: number | null;
  market_cap_sol?: number | null;
  volume_sol?: number | null;
  liquidity_sol?: number | null;
  transaction_count?: number | null;
  price_1h_change?: number | null;
  price_24h_change?: number | null;
  price_7d_change?: number | null;
  protocol?: string | null;
  sourceHints?: string[]; // e.g., ["DexScreener","GeckoTerminal","Jupiter"]
};

export type SortKey =
  | "volume"
  | "price_change"
  | "market_cap"
  | "price"
  | "liquidity"
  | "txs";
