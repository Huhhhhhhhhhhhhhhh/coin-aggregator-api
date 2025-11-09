// src/cache/redis.ts
import { config } from "../config";
import { logger } from "../logger";

let useMemory = !process.env.REDIS_URL;
type Entry = { v: any; exp: number };
const mem = new Map<string, Entry>();

let Redis: any;
let redis: any;

try {
  if (!useMemory) {
    Redis = (await import("ioredis")).default;
    redis = new Redis(config.redisUrl, { lazyConnect: true });
  }
} catch (e) {
  useMemory = true;
  logger.warn("Redis client not available, using in-memory cache");
}

export async function ensureRedis() {
  if (useMemory) {
    logger.info("Cache mode: in-memory (no Redis URL)");
    return;
  }
  if ((redis as any).status !== "ready") {
    await redis.connect();
    logger.info("Redis connected");
  }
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  if (useMemory) {
    const e = mem.get(key);
    if (!e) return null;
    if (Date.now() > e.exp) {
      mem.delete(key);
      return null;
    }
    return e.v as T;
  }
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function cacheSet(key: string, value: any, ttlSec: number) {
  if (useMemory) {
    mem.set(key, { v: value, exp: Date.now() + ttlSec * 1000 });
    return;
  }
  await redis.set(key, JSON.stringify(value), "EX", ttlSec);
}
