import axios from "axios";
import { withExpBackoff } from "../utils/backoff";
import type { Token } from "../types";

const BASE = "https://api.dexscreener.com/latest/dex";

function toToken(d: any): Token {
  // DexScreener returns multiple pairs per token; pick best by liquidityUSD
  const p = d?.pairs?.[0] ?? d;

  const address =
    (p && p.baseToken && p.baseToken.address) ||
    p?.address ||
    "";

  // Safe tx count (if h24 missing, result is null; if present, sum buys+sells)
  const h24 = p?.txns?.h24;
  const txCount =
    h24 != null
      ? Number(h24.buys ?? 0) + Number(h24.sells ?? 0)
      : null;

  return {
    token_address: address,
    token_name: p?.baseToken?.name,
    token_ticker: p?.baseToken?.symbol,
    price_usd: p?.priceUsd != null ? Number(p.priceUsd) : null,
    market_cap_sol: null, // not provided by DS
    volume_sol: null,
    liquidity_sol: null,
    transaction_count: txCount,
    price_1h_change: p?.priceChange?.h1 != null ? Number(p.priceChange.h1) : null,
    price_24h_change: p?.priceChange?.h24 != null ? Number(p.priceChange.h24) : null,
    price_7d_change: null,
    protocol: p?.dexId ?? null,
    sourceHints: ["DexScreener"]
  };
}


export async function dsSearch(query: string): Promise<Token[]> {
  const url = `${BASE}/search?q=${encodeURIComponent(query)}`;
  const res = await withExpBackoff(
    () => axios.get(url, { timeout: 8000 }),
    (e) => [429, 500, 502, 503, 504].includes(e?.response?.status)
  );
  const data = res.data?.pairs ?? [];
  // coalesce by baseToken.address, pick highest liquidity pair
  const byAddr = new Map<string, any>();
  for (const p of data) {
    const addr = p?.baseToken?.address;
    if (!addr) continue;
    const best = byAddr.get(addr);
    if (!best || Number(p?.liquidity?.usd ?? 0) > Number(best?.liquidity?.usd ?? 0)) {
      byAddr.set(addr, p);
    }
  }
  return [...byAddr.values()].map(toToken);
}

export async function dsToken(address: string): Promise<Token | null> {
  const url = `${BASE}/tokens/${address}`;
  const res = await withExpBackoff(
    () => axios.get(url, { timeout: 8000 }),
    (e) => [429, 500, 502, 503, 504].includes(e?.response?.status)
  );
  const pairs = res.data?.pairs ?? [];
  if (!pairs.length) return null;
  // pick best pair
  const best = pairs.sort((a: any,b: any) => Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0))[0];
  return toToken({ pairs: [best] });
}
