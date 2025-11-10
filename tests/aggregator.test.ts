// Mock the fetcher service
// This line tells Jest to replace the real fetcher.service with our mock
jest.mock('../src/services/fetcher.service', () => ({
  fetchGeckoTerminalData: jest.fn(),
  fetchDexScreenerData: jest.fn(),
}));

import { fetchAndAggregateData } from '../src/services/aggregator.service';
import { fetchGeckoTerminalData, fetchDexScreenerData } from '../src/services/fetcher.service';

// Cast the mocked functions so TypeScript knows they are mocks
const mockedGeckoFetch = fetchGeckoTerminalData as jest.Mock;
const mockedDexScreenerFetch = fetchDexScreenerData as jest.Mock;

// --- MOCK DATA ---
// We define our mock API responses here
const geckoMockPool = {
  id: 'pool_123',
  attributes: {
    address: 'addr1_gecko',
    name: 'GeckoCoin / SOL',
    base_token_price_usd: '100',
    market_cap_usd: '1000000',
    volume_usd: { h24: '1000' },
    transactions: { h24: { buys: 10, sells: 5 } },
    price_change_percentage: { h1: '1', h24: '2' },
    reserve_in_usd: '5000',
  },
  relationships: {
    base_token: { data: { id: 'addr1_gecko' } },
    dex: { data: { id: 'raydium_gecko' } },
  },
};

const dexMockPair = {
  baseToken: { address: 'addr2_dex', name: 'DexCoin', symbol: 'DC' },
  priceNative: '1.5',
  priceUsd: '150',
  marketCap: '150000',
  volume: { h24: '2000' },
  liquidity: { usd: '6000' },
  txns: { h24: { buys: 20, sells: 10 } },
  priceChange: { h1: '3', h24: '4' },
  dexId: 'raydium_dex',
  pairCreatedAt: 12345,
};

// --- END OF MOCK DATA ---


describe('Aggregation Service', () => {

  beforeEach(() => {
    // Reset mocks before each test to ensure they are clean
    mockedGeckoFetch.mockClear();
    mockedDexScreenerFetch.mockClear();
  });

  // Test 1: Happy path, merging two different tokens
  test('should fetch and merge data from two sources', async () => {
    mockedGeckoFetch.mockResolvedValue([geckoMockPool]);
    mockedDexScreenerFetch.mockResolvedValue([dexMockPair]);

    const result = await fetchAndAggregateData();

    expect(result).toHaveLength(2); // Should have 2 tokens
    expect(result[0].token_address).toBe('addr1_gecko');
    expect(result[1].token_address).toBe('addr2_dex');
    expect(mockedGeckoFetch).toHaveBeenCalledTimes(1);
    expect(mockedDexScreenerFetch).toHaveBeenCalledTimes(1);
  });

  // Test 2: De-duplication logic (higher volume wins)
  test('should de-duplicate tokens, preferring higher volume (DexScreener)', async () => {
    // Both tokens have the same address 'addr_common'
    // DexScreener volume (2000) is > Gecko (1000), so DexScreener should win.
    const geckoLowVolume = { ...geckoMockPool, relationships: { ...geckoMockPool.relationships, base_token: { data: { id: 'addr_common' } } } };
    const dexHighVolume = { ...dexMockPair, baseToken: { ...dexMockPair.baseToken, address: 'addr_common' } };
    
    mockedGeckoFetch.mockResolvedValue([geckoLowVolume]);
    mockedDexScreenerFetch.mockResolvedValue([dexHighVolume]);

    // --- FIX IS HERE: Corrected the calculation ---
    // The normalizer calculates (volumeH24 / priceUsd * priceSol)
    // (2000 / 150) * 1.5 = 20
    const dexVolumeInSol = 20; 
    // --- END OF FIX ---
    
    const result = await fetchAndAggregateData();

    expect(result).toHaveLength(1); // Should only have one token
    expect(result[0].token_address).toBe('addr_common');
    expect(result[0].source).toBe('dexscreener'); // DexScreener won
    expect(result[0].volume_sol).toBeCloseTo(dexVolumeInSol);
  });
  
  // Test 3: De-duplication logic (higher volume wins)
  test('should de-duplicate tokens, preferring higher volume (GeckoTerminal)', async () => {
    // Gecko volume (10000) is > DexScreener (2000)
    const geckoHighVolume = {
       ...geckoMockPool,
       attributes: {...geckoMockPool.attributes, volume_usd: { h24: '10000' }},
       relationships: { ...geckoMockPool.relationships, base_token: { data: { id: 'addr_common' } } } 
    };
    const dexLowVolume = { ...dexMockPair, baseToken: { ...dexMockPair.baseToken, address: 'addr_common' } };

    mockedGeckoFetch.mockResolvedValue([geckoHighVolume]);
    mockedDexScreenerFetch.mockResolvedValue([dexLowVolume]);

    const result = await fetchAndAggregateData();
    const SOL_PRICE_USD = 150.0;
    const geckoVolumeInSol = 10000 / SOL_PRICE_USD; // Mock volume / mock SOL price

    expect(result).toHaveLength(1);
    expect(result[0].token_address).toBe('addr_common');
    expect(result[0].source).toBe('gecko'); // Gecko won
    expect(result[0].volume_sol).toBeCloseTo(geckoVolumeInSol);
  });

  // Test 4: One source fails, the other succeeds
  test('should return data from one source if the other fails', async () => {
    mockedGeckoFetch.mockResolvedValue([geckoMockPool]);
    mockedDexScreenerFetch.mockRejectedValue(new Error('API Down')); // DexScreener fails

    const result = await fetchAndAggregateData();

    expect(result).toHaveLength(1); // Should still return the Gecko token
    expect(result[0].source).toBe('gecko');
  });
  
  // Test 5: Both sources fail
  test('should return an empty array if both sources fail', async () => {
    mockedGeckoFetch.mockRejectedValue(new Error('API Down'));
    mockedDexScreenerFetch.mockRejectedValue(new Error('API Down'));

    const result = await fetchAndAggregateData();

    expect(result).toHaveLength(0); // Should be an empty array
  });

  // Test 6: Both sources return empty arrays
  test('should return an empty array if both sources return no tokens', async () => {
    mockedGeckoFetch.mockResolvedValue([]);
    mockedDexScreenerFetch.mockResolvedValue([]);

    const result = await fetchAndAggregateData();

    expect(result).toHaveLength(0);
  });

  // Test 7: Gecko normalization fails
  test('should filter out Gecko tokens that fail normalization', async () => {
    const badGeckoToken = { id: 'bad-token' }; // Missing 'attributes'
    mockedGeckoFetch.mockResolvedValue([badGeckoToken, geckoMockPool]); // One good, one bad
    mockedDexScreenerFetch.mockResolvedValue([]);

    const result = await fetchAndAggregateData();

    expect(result).toHaveLength(1); // Should only include the good token
    expect(result[0].source).toBe('gecko');
  });

  // Test 8: DexScreener normalization fails
  test('should filter out DexScreener tokens that fail normalization', async () => {
    const badDexToken = { bad: 'data' }; // Missing 'baseToken'
    mockedGeckoFetch.mockResolvedValue([]);
    mockedDexScreenerFetch.mockResolvedValue([badDexToken, dexMockPair]); // One good, one bad

    const result = await fetchAndAggregateData();

    expect(result).toHaveLength(1); // Should only include the good token
    expect(result[0].source).toBe('dexscreener');
  });
  
  // Test 9: DexScreener normalizer handles missing optional data
  test('should normalize DexScreener token with missing optional data', async () => {
    const dexMinimalPair = {
      baseToken: { address: 'addr_minimal', name: 'MinCoin', symbol: 'MIN' },
      priceNative: '1.0',
      priceUsd: '150',
      // 'volume', 'liquidity', 'txns', 'priceChange' are missing
    };
    mockedGeckoFetch.mockResolvedValue([]);
    mockedDexScreenerFetch.mockResolvedValue([dexMinimalPair]);

    const result = await fetchAndAggregateData();

    expect(result).toHaveLength(1);
    expect(result[0].token_address).toBe('addr_minimal');
    expect(result[0].volume_sol).toBe(0); // Should default to 0
    expect(result[0].liquidity_sol).toBe(0); // Should default to 0
    expect(result[0].price_1hr_change).toBe(0); // Should default to 0
  });

  // Test 10: Gecko normalizer handles missing optional data
  test('should normalize Gecko token with missing optional data', async () => {
    const geckoMinimalPool = {
      id: 'pool_min',
      attributes: {
        address: 'addr_minimal',
        name: 'MinCoin / SOL',
        base_token_price_usd: '100',
        // 'transactions', 'market_cap_usd', 'volume_usd', 'price_change_percentage' are missing
      },
      relationships: {
        base_token: { data: { id: 'addr_minimal' } },
        dex: { data: { id: 'raydium' } },
      },
    };
    mockedGeckoFetch.mockResolvedValue([geckoMinimalPool]);
    mockedDexScreenerFetch.mockResolvedValue([]);
    
    const result = await fetchAndAggregateData();
    
    expect(result).toHaveLength(1);
    expect(result[0].token_address).toBe('addr_minimal');
    expect(result[0].volume_sol).toBe(0); // Should default to 0
    expect(result[0].market_cap_sol).toBe(0); // Should default to 0
    expect(result[0].price_1hr_change).toBe(0); // Should default to 0
  });
  
  // Test 11: Integration of all normalizers and merge logic
  test('should correctly aggregate, normalize, and de-duplicate a complex list', async () => {
    // 1. Gecko token
    const geckoToken1 = geckoMockPool; // addr1_gecko
    // 2. Dex token
    const dexToken1 = dexMockPair; // addr2_dex
    // 3. A token that will be de-duplicated (Dex wins)
    const geckoToken2 = { ...geckoMockPool, attributes: {...geckoMockPool.attributes, volume_usd: { h24: '100' }}, relationships: { ...geckoMockPool.relationships, base_token: { data: { id: 'addr_common' } } } };
    const dexToken2 = { ...dexMockPair, volume: { h24: '5000' }, baseToken: { ...dexMockPair.baseToken, address: 'addr_common' } };
    // 4. A bad token
    const badGeckoToken = { id: 'bad' };

    mockedGeckoFetch.mockResolvedValue([geckoToken1, geckoToken2, badGeckoToken]);
    mockedDexScreenerFetch.mockResolvedValue([dexToken1, dexToken2]);
    
    const result = await fetchAndAggregateData();

    expect(result).toHaveLength(3); // geckoToken1, dexToken1, and the merged dexToken2
    expect(result.map(t => t.token_address).sort()).toEqual(['addr1_gecko', 'addr2_dex', 'addr_common']);
    // Find the common token and check its source
    const commonToken = result.find(t => t.token_address === 'addr_common');
    expect(commonToken?.source).toBe('dexscreener'); // Dex wins
  });
});