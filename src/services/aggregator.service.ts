import { IToken } from '../types';
import { fetchGeckoTerminalData, fetchDexScreenerData } from './fetcher.service';

/**
 * Normalizes data from GeckoTerminal (now from /pools endpoint)
 */
const normalizeGeckoToken = (pool: any): IToken | null => {
  try {
    const attr = pool.attributes;
    // --- FIX: We are now parsing a 'pool', which has a 'base_token' ---
    if (!attr || !pool.id || !attr.base_token_price_usd) return null;

    const baseToken = pool.relationships.base_token.data;
    const priceUsd = parseFloat(attr.base_token_price_usd);
    const SOL_PRICE_USD = 150.0; // Assuming 150 for demo
    const priceSol = priceUsd / SOL_PRICE_USD;

    return {
      token_address: baseToken.id, // Address is in relationships
      token_name: attr.name.split('/')[0].trim(), // Pool name is "TOKEN/SOL"
      token_ticker: attr.name.split('/')[0].trim(), // Ticker from name
      price_usd: priceUsd,
      price_sol: priceSol,
      market_cap_sol: (parseFloat(attr.market_cap_usd) || 0) / SOL_PRICE_USD,
      volume_sol: (parseFloat(attr.volume_usd.h24) || 0) / SOL_PRICE_USD,
      liquidity_sol: (parseFloat(attr.reserve_in_usd) || 0) / SOL_PRICE_USD,
      transaction_count: parseInt(attr.transactions.h24.buys) + parseInt(attr.transactions.h24.sells),
      price_1hr_change: parseFloat(attr.price_change_percentage.h1 || '0'),
      price_24hr_change: parseFloat(attr.price_change_percentage.h24 || '0'),
      protocol: pool.relationships?.dex?.data?.id || 'Unknown',
      source: 'gecko',
      last_updated_ms: Date.now(),
    };
  } catch (e) {
    if (e instanceof Error) {
      console.warn('Failed to normalize Gecko pool', e.message);
    } else {
      console.warn('Failed to normalize Gecko pool: An unknown error occurred');
    }
    return null;
  }
};

/**
 * Normalizes data from DexScreener into our IToken structure
 */
const normalizeDexScreenerToken = (pair: any): IToken | null => {
  try {
    if (!pair.baseToken || !pair.baseToken.address) return null;

    const priceSol = parseFloat(pair.priceNative);
    const priceUsd = parseFloat(pair.priceUsd);

    // --- FIX: Add defensive checks for potentially missing data ---
    const liquidityUsd = parseFloat(pair.liquidity?.usd || '0');
    const volumeH24 = parseFloat(pair.volume?.h24 || '0');
    const marketCap = parseFloat(pair.marketCap || '0');
    // --- END OF FIX ---

    return {
      token_address: pair.baseToken.address,
      token_name: pair.baseToken.name,
      token_ticker: pair.baseToken.symbol,
      price_usd: priceUsd,
      price_sol: priceSol,
      market_cap_sol: marketCap / priceUsd * priceSol,
      volume_sol: volumeH24 / priceUsd * priceSol,
      liquidity_sol: liquidityUsd / priceUsd * priceSol,
      transaction_count: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
      price_1hr_change: parseFloat(pair.priceChange?.h1 || '0'),
      price_24hr_change: parseFloat(pair.priceChange?.h24 || '0'),
      protocol: pair.dexId,
      source: 'dexscreener',
      last_updated_ms: pair.pairCreatedAt, 
    };
  } catch (e) {
    if (e instanceof Error) {
      console.warn('Failed to normalize DexScreener pair:', e.message);
    } else {
      console.warn('Failed to normalize DexScreener pair: An unknown error occurred');
    }
    return null;
  }
};

/**
 * Fetches from all sources, normalizes, and merges the data.
 * @returns A promise that resolves to an array of unique, merged IToken objects.
 */
export const fetchAndAggregateData = async (): Promise<IToken[]> => {
  console.log('Starting data aggregation...');
  
  const [geckoResult, dexScreenerResult] = await Promise.allSettled([
    fetchGeckoTerminalData(),
    fetchDexScreenerData(),
  ]);

  const tokenMap = new Map<string, IToken>();

  // Process GeckoTerminal data
  if (geckoResult.status === 'fulfilled' && geckoResult.value) {
    for (const pool of geckoResult.value) {
      const normalized = normalizeGeckoToken(pool);
      if (normalized) {
        tokenMap.set(normalized.token_address, normalized);
      }
    }
  }

  // Process DexScreener data
  if (dexScreenerResult.status === 'fulfilled' && dexScreenerResult.value) {
    for (const pair of dexScreenerResult.value) {
      const normalized = normalizeDexScreenerToken(pair);
      if (normalized) {
        const existing = tokenMap.get(normalized.token_address);
        if (existing) {
          if (normalized.volume_sol > existing.volume_sol) {
            tokenMap.set(normalized.token_address, normalized);
          }
        } else {
          tokenMap.set(normalized.token_address, normalized);
        }
      }
    }
  }
  
  console.log(`Aggregation complete. Found ${tokenMap.size} unique tokens.`);

  // Return the merged list
  return Array.from(tokenMap.values());
};