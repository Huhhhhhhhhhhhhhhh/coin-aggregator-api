import type { Token } from "./types";
import { dsSearch, dsToken } from "./datasources/dexscreener";
import { geckoList } from "./datasources/geckoterminal";
import { jupiterPrices } from "./datasources/jupiter";
import { cacheGet, cacheSet } from "./cache/redis";
import { config } from "./config";
import { logger } from "./logger";

type Query = {
  search?: string;
  page?: number;
  addresses?: string[];
};

// merge strategy: address is primary key; prefer fields in this precedence:
// DexScreener -> Gecko -> Jupiter (price only)
function mergeToken(a: Token, b: Token): Token {
  const choose = <T>(x?: T | null, y?: T | null) => (x ?? y ?? null) as any;
  return {
    token_address: a.token_address,
    token_name: choose(a.token_name, b.token_name),
    token_ticker: choose(a.token_ticker, b.token_ticker),
    price_usd: choose(a.price_usd, b.price_usd),
    price_sol: choose(a.price_sol, b.price_sol),
    market_cap_sol: choose(a.market_cap_sol, b.market_cap_sol),
    volume_sol: choose(a.volume_sol, b.volume_sol),
    liquidity_sol: choose(a.liquidity_sol, b.liquidity_sol),
    transaction_count: choose(a.transaction_count, b.transaction_count),
    price_1h_change: choose(a.price_1h_change, b.price_1h_change),
    price_24h_change: choose(a.price_24h_change, b.price_24h_change),
    price_7d_change: choose(a.price_7d_change, b.price_7d_change),
    protocol: choose(a.protocol, b.protocol),
    sourceHints: Array.from(new Set([...(a.sourceHints ?? []), ...(b.sourceHints ?? [])]))
  };
}

export async function aggregate(query: Query): Promise<Token[]> {
  const cacheKey = `agg:${JSON.stringify(query)}`;
  const cached = await cacheGet<Token[]>(cacheKey);
  if (cached) return cached;

  let fromDS: Token[] = [];
  let fromGT: Token[] = [];
  if (query.search) {
    fromDS = await dsSearch(query.search);
  } else if (query.addresses?.length) {
    fromDS = (await Promise.all(query.addresses.map(a => dsToken(a)))).filter(Boolean) as Token[];
  } else {
    fromGT = await geckoList(query.page ?? 1);
  }

  // union by address
  const byAddr = new Map<string, Token>();
  const add = (t: Token) => {
    if (!t?.token_address) return;
    const prev = byAddr.get(t.token_address);
    byAddr.set(t.token_address, prev ? mergeToken(prev, t) : t);
  };
  fromDS.forEach(add);
  fromGT.forEach(add);

  // enrich prices from Jupiter for any missing USD price
  const wantJup = Array.from(byAddr.values())
    .filter(t => t.price_usd == null)
    .map(t => t.token_address);
  if (wantJup.length) {
    try {
      const prices = await jupiterPrices(wantJup);
      for (const addr of Object.keys(prices)) {
        const cur = byAddr.get(addr);
        if (cur) {
          cur.price_usd = prices[addr];
          cur.sourceHints = Array.from(new Set([...(cur.sourceHints ?? []), "Jupiter"]));
          byAddr.set(addr, cur);
        }
      }
    } catch (e) {
      logger.warn({ e }, "Jupiter enrich failed");
    }
  }

  const result = Array.from(byAddr.values());
  await cacheSet(cacheKey, result, config.cacheTtlSec);
  return result;
}
