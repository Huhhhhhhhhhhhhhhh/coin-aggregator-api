# Real-time Meme Coin Aggregation Service

Aggregates live data from **DexScreener**, **GeckoTerminal**, and **Jupiter** with Redis caching, rate-limited fetching, cursor pagination, and WebSocket updates (like axiom.trade Discover).

## Quick start

```bash
git clone <your-repo>
cd memecoins-rt-agg
cp .env.example .env
docker compose up --build
