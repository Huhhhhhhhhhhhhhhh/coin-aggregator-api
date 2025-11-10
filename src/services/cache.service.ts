import Redis from 'ioredis';
import { IToken } from '../types';

// Ensure REDIS_URL is set in .env
if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is not set!');
}

const redis = new Redis(process.env.REDIS_URL, {
  // Add TLS settings if connecting to Upstash or similar
  tls: {
    rejectUnauthorized: false
  },
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Connected to Redis successfully.');
});


const FULL_LIST_CACHE_KEY = 'tokens:all';
const INDIVIDUAL_TOKEN_PREFIX = 'token:';
const CACHE_TTL_SECONDS = 30; // Configurable TTL

/**
 * Gets the full list of tokens from the cache.
 */
export const getFullTokenListCache = async (): Promise<IToken[] | null> => {
  try {
    const cached = await redis.get(FULL_LIST_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    // --- FIX 1 IS HERE ---
    if (error instanceof Error) {
      console.error('Error getting full token list cache:', error.message);
    } else {
      console.error('Error getting full token list cache: An unknown error occurred');
    }
    // --- END OF FIX 1 ---
    return null;
  }
};

/**
 * Sets the full list of tokens in the cache.
 */
export const setFullTokenListCache = async (tokens: IToken[]) => {
  try {
    await redis.set(
      FULL_LIST_CACHE_KEY,
      JSON.stringify(tokens),
      'EX',
      CACHE_TTL_SECONDS
    );
  } catch (error) {
    // --- FIX 2 IS HERE ---
    if (error instanceof Error) {
      console.error('Error setting full token list cache:', error.message);
    } else {
      console.error('Error setting full token list cache: An unknown error occurred');
    }
    // --- END OF FIX 2 ---
  }
};

/**
 * Gets a single token from its hash cache.
 */
export const getTokenCache = async (address: string): Promise<IToken | null> => {
  try {
    const token = await redis.hgetall(`${INDIVIDUAL_TOKEN_PREFIX}${address}`);
    if (Object.keys(token).length === 0) {
      return null;
    }
    // Convert Redis hash (all strings) back to IToken types
    return {
      ...token,
      price_usd: parseFloat(token.price_usd),
      price_sol: parseFloat(token.price_sol),
      market_cap_sol: parseFloat(token.market_cap_sol),
      volume_sol: parseFloat(token.volume_sol),
      liquidity_sol: parseFloat(token.liquidity_sol),
      transaction_count: parseInt(token.transaction_count),
      price_1hr_change: parseFloat(token.price_1hr_change),
      price_24hr_change: parseFloat(token.price_24hr_change),
      last_updated_ms: parseInt(token.last_updated_ms),
    } as IToken;
  } catch (error) {
    // --- FIX 3 IS HERE ---
    if (error instanceof Error) {
      console.error('Error getting individual token cache:', error.message);
    } else {
      console.error('Error getting individual token cache: An unknown error occurred');
    }
    // --- END OF FIX 3 ---
    return null;
  }
};

/**
 * Sets a single token in its hash cache.
 * We convert all values to strings for `hset`.
 */
export const setTokenCache = async (token: IToken) => {
  try {
    const tokenAddress = token.token_address;
    const tokenKey = `${INDIVIDUAL_TOKEN_PREFIX}${tokenAddress}`;
    
    // Convert all values to strings for storage in a Redis hash
    const tokenHash = Object.entries(token).reduce((acc, [key, value]) => {
      acc[key] = String(value);
      return acc;
    }, {} as Record<string, string>);

    await redis.hset(tokenKey, tokenHash);
  } catch (error) {
    // --- FIX 4 IS HERE ---
    if (error instanceof Error) {
      console.error('Error setting individual token cache:', error.message);
    } else {
      console.error('Error setting individual token cache: An unknown error occurred');
    }
    // --- END OF FIX 4 ---
  }
};