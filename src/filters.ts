import type { SortKey } from "./types";
import type { Timeframe } from "./config";

export function pickChangeField(tf: Timeframe) {
  return tf === "1h" ? "price_1h_change" : tf === "24h" ? "price_24h_change" : "price_7d_change";
}

export function sortTokens(tokens: any[], sort: SortKey, timeframe: Timeframe) {
  const key = sort;
  const changeKey = pickChangeField(timeframe);
  const score = (t: any) => {
    switch (key) {
      case "price": return t.price_usd ?? -Infinity;
      case "market_cap": return t.market_cap_sol ?? -Infinity;
      case "volume": return t.volume_sol ?? -Infinity;
      case "liquidity": return t.liquidity_sol ?? -Infinity;
      case "txs": return t.transaction_count ?? -Infinity;
      case "price_change": return t[changeKey] ?? -Infinity;
    }
  };
  return tokens.slice().sort((a,b) => (score(b) as number) - (score(a) as number));
}
