import { aggregate } from "../src/aggregator";
import nock from "nock";

describe("merge & dedupe", () => {
  beforeEach(() => nock.cleanAll());

  it("dedupes by address and prefers DexScreener fields", async () => {
    // DexScreener search
    nock("https://api.dexscreener.com")
      .get(/\/latest\/dex\/search/)
      .reply(200, {
        pairs: [{
          baseToken: { address: "A1", name: "Pipe CTO", symbol: "PIPE" },
          priceUsd: "0.001",
          priceChange: { h1: "10", h24: "30" },
          txns: { h24: { buys: 100, sells: 80 } },
          dexId: "raydium"
        }]
      });

    // Gecko page
    nock("https://api.geckoterminal.com")
      .get(/\/api\/v2\/networks\/solana\/tokens/)
      .reply(200, {
        data: [{
          attributes: { address: "A1", name: "Pipe CTO", symbol: "PIPE", price_usd: "0.0009" }
        }]
      });

    const list = await aggregate({ search: "pipe" });
    expect(list.length).toBe(1);
    expect(list[0].token_address).toBe("A1");
    // DexScreener price wins
    expect(list[0].price_usd).toBe(0.001);
    expect(list[0].transaction_count).toBe(180);
    expect(list[0].sourceHints?.sort()).toEqual(["DexScreener","GeckoTerminal"].sort());
  });
});
