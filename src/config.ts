export const config = {
  port: Number(process.env.PORT ?? 8080),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  cacheTtlSec: Number(process.env.CACHE_TTL_SECONDS ?? 30),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
  spikePct: Number(process.env.WS_VOLUME_SPIKE_PCT ?? 30),
  priceDeltaPct: Number(process.env.WS_PRICE_DELTA_PCT ?? 1),
  rpm: {
    dexscreener: Number(process.env.DEXSCREENER_RPM ?? 280),
    gecko: Number(process.env.GECKO_RPM ?? 120),
    jupiter: Number(process.env.JUPITER_RPM ?? 200)
  }
} as const;

export type Timeframe = "1h" | "24h" | "7d";
export const validTimeframes: Timeframe[] = ["1h", "24h", "7d"];
