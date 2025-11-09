import axios from "axios";
import { withExpBackoff } from "../utils/backoff";
import type { Token } from "../types";

// Jupiter Price API (returns USD)
export async function jupiterPrices(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const url = `https://price.jup.ag/v4/price?ids=${encodeURIComponent(ids.join(","))}`;
  const res = await withExpBackoff(
    () => axios.get(url, { timeout: 7000 }),
    (e) => [429, 500, 502, 503, 504].includes(e?.response?.status)
  );
  const d = res.data?.data ?? {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries<any>(d)) {
    if (v?.price) out[k] = Number(v.price);
  }
  return out;
}

export function asJupiterToken(addr: string, priceUsd: number): Token {
  return {
    token_address: addr,
    price_usd: priceUsd,
    sourceHints: ["Jupiter"]
  };
}
