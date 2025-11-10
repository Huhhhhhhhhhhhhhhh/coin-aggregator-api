// This is our standardized token data structure
export interface IToken {
  token_address: string;
  token_name: string;
  token_ticker: string;
  price_usd: number;
  price_sol: number;
  market_cap_sol: number;
  volume_sol: number; // 24h volume
  liquidity_sol: number;
  transaction_count: number; // 24h txns
  price_1hr_change: number;
  price_24hr_change: number;
  protocol: string;
  source: 'gecko' | 'dexscreener'; // To track where it came from
  last_updated_ms: number;
}