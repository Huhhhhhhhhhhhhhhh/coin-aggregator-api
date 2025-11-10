import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
// import https from 'https'; // We don't need this anymore

// Create a central API client
const apiClient = axios.create({
  timeout: 5000, // 5 second timeout
});

// Configure retry logic
axiosRetry(apiClient, {
  retries: 3,
  retryDelay: (retryCount) => {
    console.log(`Retry attempt ${retryCount} for a failed request...`);
    return retryCount * 1000; // 1s, 2s, 3s
  },
  retryCondition: (error: AxiosError) => {
    const status = error.response?.status;
    if (status) {
      return status === 429 || status >= 500; // Only retry on rate limit or server error
    }
    return axiosRetry.isNetworkError(error);
  },
  onRetry: (retryCount, error) => {
    console.warn(`Retrying request: ${error.config?.url}, attempt: ${retryCount}`);
  },
});

/**
 * Fetches data from GeckoTerminal's Solana token list
 */
export const fetchGeckoTerminalData = async () => {
  try {
    // --- THIS IS THE FINAL FIX ---
    // The correct endpoint is /new_pools, not /pools
    const url = 'https://api.geckoterminal.com/api/v2/networks/solana/new_pools';
    // --- END OF FIX ---
    
    const { data } = await apiClient.get(url, {
      params: {
        page: 1,
        include: 'base_token,dex' // Get token and dex info
      }
    });
    // The pools are in data.data
    return data.data || [];
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to fetch from GeckoTerminal:', error.message);
    } else {
      console.error('Failed to fetch from GeckoTerminal: An unknown error occurred');
    }
    return []; // Return empty on failure
  }
};

/**
 * Fetches data from DexScreener (top SOL pairs)
 */
export const fetchDexScreenerData = async () => {
  try {
    const url = 'https://api.dexscreener.com/latest/dex/search?q=solana';
    const { data } = await apiClient.get(url, {
      params: {
        // We can add params here if needed
      }
    });
    return data.pairs || [];
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to fetch from DexScreener:', error.message);
    } else {
      console.error('Failed to fetch from DexScreener: An unknown error occurred');
    }
    return []; // Return empty on failure
  }
};

/**
 * Fetches prices from Jupiter
 */
export const fetchJupiterPrices = async (tokenAddresses: string[]) => {
   if (tokenAddresses.length === 0) return {};
  try {
    const ids = tokenAddresses.join(',');
    const url = `https://price.jup.ag/v4/price?ids=${ids}`;
    const { data } = await apiClient.get(url);
    
    // data.data format: { "address": { "price": 0.123, ... } }
    return data.data || {};
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to fetch from Jupiter:', error.message);
    } else {
      console.error('Failed to fetch from Jupiter: An unknown error occurred');
    }
    return {}; // Return empty on failure
  }
}