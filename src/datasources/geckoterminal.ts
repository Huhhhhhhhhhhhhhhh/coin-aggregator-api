import axios from "axios";
import { withExpBackoff } from "../utils/backoff";
import type { Token } from "../types";

const BASE = "https://api.geckoterminal.com/api/v2/networks/solana/tokens";

export async function geckoList(page: number = 1): Promise<Token[]> {
  const url = `${BASE}?page=${page}`;
  const res = await withExpBackoff(
    () => axios.get(url, { timeout: 8000 }),
    (e) => [429, 500, 502, 503, 504].includes(e?.response?.status)
  );
  const arr = res.data?.data ?? [];
  return arr.map((t: any) => ({
    token_address: t?.attributes?.address ?? "",
    token_name: t?.attributes?.name ?? undefined,
    token_ticker: t?.attributes?.symbol ?? undefined,
    price_usd: t?.attributes?.price_usd ? Number(t.attributes.price_usd) : null,
    // GT gives 1h/24h % sometimes under attributes; fallback null if missing
    price_1h_change: t?.attributes?.price_change_percentage_1h ?? null,
    price_24h_change: t?.attributes?.price_change_percentage_24h ?? null,
    price_7d_change: t?.attributes?.price_change_percentage_7d ?? null,
    protocol: "GeckoTerminal",
    sourceHints: ["GeckoTerminal"]
  }));
}
