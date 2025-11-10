# Real-Time Coin Aggregator Service

A backend service that aggregates real-time coin data from multiple DEX sources, provides efficient caching with Redis, and pushes live updates via WebSockets.

**Live Demo URL:** `https://coin-aggregator-api.onrender.com`
**Demo Video:** `https://youtu.be/ZfKEyphJUBA`

---

## 🏛️ Architecture & Design Decisions

This service is built as a **decoupled service-oriented monolith**. The core components (API, Poller, WebSocket) run in the same Node.js application but operate independently. This design is easy to develop, test, and deploy on a free tier while being scalable for the future.

### 1. Data Flow
The data flows in a simple, one-way loop:

1.  **Poll:** A `node-cron` job runs every 30 seconds, triggering the `AggregationService`.
2.  **Fetch:** The `FetcherService` (using `axios-retry` for rate limits) hits the GeckoTerminal and DexScreener APIs in parallel.
3.  **Aggregate:** The `AggregationService` normalizes all data into a standard `IToken` format and merges duplicates using a `Map` (de-duplicating by `token_address` and prioritizing the source with higher volume).
4.  **Diff & Cache:**
    * The *full, merged list* is saved as a single JSON string (`tokens:all`) in Redis. This is for the main API.
    * Each *individual token* is checked against its corresponding *hash* (`token:{address}`) in Redis.
5.  **Broadcast:** If a token's price has changed (a "diff" is found), it's added to an `updates` array.
6.  **Push:** After checking all tokens, the `WebSocketService` (using `Socket.io`) `emits` the `tokenUpdate` event with the `updates` array to all connected clients.

### 2. Caching Strategy (Redis)

I used two different cache types for maximum performance:

* **Full List (String): `tokens:all` (TTL: 30s)**
    * **Purpose:** To serve the `GET /v1/tokens` endpoint almost instantly.
    * **Why:** The API's job is to deliver the *full* list, sorted and paginated. Querying and sorting thousands of individual keys from Redis on every API call would be slow. By storing the entire pre-sorted list as one string, the API call is just one `GET` operation, which is extremely fast.

* **Individual Tokens (Hash): `token:{address}` (No TTL)**
    * **Purpose:** To perform efficient diffing for the real-time updates.
    * **Why:** To know if a token's price has changed, we must compare the *new* price to the *old* price. This hash store acts as our "last known value" for every token. The poller can do a single `HGETALL` for a token, compare its price, and then `HSET` the new data, all in constant time.

### 3. Real-time Updates (Poll & Broadcast)

Instead of a more complex stream or queue, I chose a "poll-and-broadcast" model.

* **Why:** It's simple, reliable, and meets the project requirements. It's resilient to API failures (thanks to `axios-retry`) and ensures all clients are synchronized with the same data set that the main API serves. The 30-second poll interval is more than sufficient for "real-time" price discovery and stays well within the free API rate limits.

### 4. API & Pagination

* **Cursor-based Pagination:** I implemented cursor-based pagination (`limit`/`cursor`) instead of traditional offset/page pagination.
* **Why:** In a real-time list where data is constantly being added and resorted, offset pagination is unreliable. A user on "Page 2" could see duplicate data or miss data as the list changes. A cursor (e.g., "get me 20 tokens *after* this token address") is a stable anchor in the dataset, ensuring the user gets the correct next set of data.

---

## 🚀 Getting Started

### Prerequisites

* Node.js v18+
* A free Redis database (e.g., from [Upstash](https://upstash.com/))

### 1. Clone & Install

```bash
git clone [https://github.com/Huhhhhhhhhhhhhhhh/coin-aggregator-api.git](https://github.com/Huhhhhhhhhhhhhhhh/coin-aggregator-api.git)
cd coin-aggregator-api
npm install