// Mock the fetcher service
jest.mock('../src/services/fetcher.service', () => ({
  fetchGeckoTerminalData: jest.fn(),
  fetchDexScreenerData: jest.fn(),
}));

import { fetchAndAggregateData } from '../src/services/aggregator.service';
import { fetchGeckoTerminalData, fetchDexScreenerData } from '../src/services/fetcher.service';

// Cast the mocked functions to Jest's mock types
const mockedGeckoFetch = fetchGeckoTerminalData as jest.Mock;
const mockedDexScreenerFetch = fetchDexScreenerData as jest.Mock;

// Import mock data (you would create these files)
// import { geckoMock } from './mocks/gecko.mock';
// import { dexScreenerMock } from './mocks/dexscreener.mock';

describe('Aggregation Service', () => {

  beforeEach(() => {
    // Reset mocks before each test
    mockedGeckoFetch.mockClear();
    mockedDexScreenerFetch.mockClear();
  });

  // 1. Happy path test
  test('should fetch and merge data from two sources', async () => {
    // Simple mock data
    const geckoMock = [{ id: 'gecko-token-1', attributes: { address: 'addr1', name: 'GeckoCoin', symbol: 'GC', price_usd: '100', volume_usd: { h24: '1000' }, transactions: {h24: {buys: 10, sells: 5}}, price_change_percentage: { h1: '1', h24: '2'}, reserve_in_usd: '5000' } }];
    const dexMock = [{ baseToken: { address: 'addr2', name: 'DexCoin', symbol: 'DC' }, priceNative: '1.5', priceUsd: '150', marketCap: '150000', volume: { h24: '2000' }, liquidity: { usd: '6000'}, txns: { h24: { buys: 20, sells: 10 }}, priceChange: { h1: '3', h24: '4' }, dexId: 'raydium', pairCreatedAt: 12345 }];

    mockedGeckoFetch.mockResolvedValue(geckoMock);
    mockedDexScreenerFetch.mockResolvedValue(dexMock);

    const result = await fetchAndAggregateData();

    expect(result).toHaveLength(2);
    expect(result[0].token_ticker).toBe('GC');
    expect(result[1].token_ticker).toBe('DC');
    expect(mockedGeckoFetch).toHaveBeenCalledTimes(1);
    expect(mockedDexScreenerFetch).toHaveBeenCalledTimes(1);
  });

  // 2. De-duplication test
  test('should de-duplicate tokens based on address', async () => {
    // Both sources return a token with 'addr1'
    const geckoMock = [{ id: 'gecko-token-1', attributes: { address: 'addr1', name: 'GeckoCoin', symbol: 'GC', price_usd: '100', volume_usd: { h24: '1000' }, transactions: {h24: {buys: 10, sells: 5}}, price_change_percentage: { h1: '1', h24: '2'}, reserve_in_usd: '5000' } }];
    const dexMock = [{ baseToken: { address: 'addr1', name: 'DexCoin', symbol: 'DC' }, priceNative: '1.5', priceUsd: '150', marketCap: '150000', volume: { h24: '5000' }, /* ... other fields */ txns: {h24: {buys: 1, sells: 1}}, priceChange: {h1: '1', h24: '1'}, liquidity: {usd: '1000'} }];

    mockedGeckoFetch.mockResolvedValue(geckoMock);
    mockedDexScreenerFetch.mockResolvedValue(dexMock);

    const result = await fetchAndAggregateData();

    // Should only have one token
    expect(result).toHaveLength(1);
    
    // It should be the DexScreener one, because its volume (5000) is > Gecko's (1000)
    expect(result[0].token_ticker).toBe('DC');
    expect(result[0].source).toBe('dexscreener');
  });

  // 3. Error handling test
  test('should return data from one source if the other fails', async () => {
    const geckoMock = [{ id: 'gecko-token-1', attributes: { address: 'addr1', name: 'GeckoCoin', symbol: 'GC', price_usd: '100', volume_usd: { h24: '1000' }, transactions: {h24: {buys: 10, sells: 5}}, price_change_percentage: { h1: '1', h24: '2'}, reserve_in_usd: '5000' } }];

    mockedGeckoFetch.mockResolvedValue(geckoMock);
    mockedDexScreenerFetch.mockRejectedValue(new Error('API Down'));

    const result = await fetchAndAggregateData();

    // Should still return the Gecko token
    expect(result).toHaveLength(1);
    expect(result[0].token_ticker).toBe('GC');
    expect(mockedGeckoFetch).toHaveBeenCalledTimes(1);
    expect(mockedDexScreenerFetch).toHaveBeenCalledTimes(1);
  });

  // 4. Normalization null test
  test('should filter out tokens that fail normalization', async () => {
    // This token is missing the 'attributes' field and will fail
    const geckoMock = [{ id: 'bad-token' }];

    mockedGeckoFetch.mockResolvedValue(geckoMock);
    mockedDexScreenerFetch.mockResolvedValue([]);

    const result = await fetchAndAggregateData();

    // Should return an empty array
    expect(result).toHaveLength(0);
  });
});