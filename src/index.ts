import 'dotenv/config'; // Make sure this is at the very top
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cron from 'node-cron';
import { fetchAndAggregateData } from './services/aggregator.service';
import {
  getFullTokenListCache,
  setFullTokenListCache,
  getTokenCache,
  setTokenCache,
} from './services/cache.service';
import { IToken } from './types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for the demo
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

// --- WebSocket Service ---
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

/**
 * Broadcasts a list of token updates to all connected clients.
 * @param updates - An array of IToken objects that have changed.
 */
const broadcastTokenUpdates = (updates: IToken[]) => {
  if (updates.length > 0) {
    console.log(`Broadcasting ${updates.length} token updates...`);
    io.emit('tokenUpdate', updates); // Emit 'tokenUpdate' event
  }
};

// --- Polling Service (Data Fetcher Job) ---
// Runs every 30 seconds. (Note: 300 req/min for DexScreener is 5/sec)
cron.schedule('*/30 * * * * *', async () => {
  console.log('Running 30-second polling job...');
  try {
    const freshTokens = await fetchAndAggregateData();
    const updates: IToken[] = [];

    // Diffing logic
    for (const token of freshTokens) {
      const oldToken = await getTokenCache(token.token_address);

      // Check for price changes or new tokens
      if (!oldToken || oldToken.price_sol !== token.price_sol) {
        updates.push(token);
      }

      // Update the individual token hash in Redis
      await setTokenCache(token);
    }

    // Broadcast only the tokens that changed
    broadcastTokenUpdates(updates);

    // Finally, update the full list cache for new API requests
    await setFullTokenListCache(freshTokens);
    console.log('Polling job finished. Full list cache updated.');
  } catch (error) {
    // --- FIX 1 IS HERE ---
    if (error instanceof Error) {
      console.error('Error during polling job:', error.message);
    } else {
      console.error('An unknown error occurred in polling job:', error);
    }
    // --- END OF FIX 1 ---
  }
});

// --- API Service (REST Endpoints) ---
app.get('/', (req, res) => {
  res.send('Coin Aggregator Service is running. Connect via WebSocket or GET /v1/tokens');
});

/**
 * GET /v1/tokens
 * The main endpoint for fetching the token list.
 * Supports filtering, sorting, and cursor-based pagination.
 */
app.get('/v1/tokens', async (req, res) => {
  try {
    let tokens = await getFullTokenListCache();

    // Cache-aside: If cache is empty, fetch data now
    if (!tokens) {
      console.log('Cache miss for /v1/tokens. Fetching data on demand...');
      tokens = await fetchAndAggregateData();
      await setFullTokenListCache(tokens);
      // Also populate individual hashes
      for (const token of tokens) {
        await setTokenCache(token);
      }
    }

    // --- 1. Filtering ---
    // Example: ?timePeriod=24h (In a real app, you'd use this)
    // For now, we'll just use all tokens
    let filteredTokens = tokens;

    // --- 2. Sorting ---
    const { sortBy = 'volume_sol' } = req.query as { sortBy: keyof IToken };
    const validSortKeys: (keyof IToken)[] = [
      'volume_sol', 'price_1hr_change', 'price_24hr_change', 'market_cap_sol'
    ];
    
    const sortKey = validSortKeys.includes(sortBy) ? sortBy : 'volume_sol';

    let sortedTokens = [...filteredTokens].sort((a, b) => {
      // Default to descending order for volume/mc
      return (b[sortKey] as number) - (a[sortKey] as number);
    });

    // --- 3. Pagination ---
    const { limit = 20, cursor } = req.query;
    const limitNum = parseInt(limit as string, 10);
    
    let startIndex = 0;
    if (cursor) {
      // Find the index of the token specified by the cursor
      const cursorIndex = sortedTokens.findIndex(
        (t) => t.token_address === cursor
      );
      if (cursorIndex > -1) {
        startIndex = cursorIndex + 1; // Start *after* the cursor
      }
    }

    const page = sortedTokens.slice(startIndex, startIndex + limitNum);
    
    // Determine the next cursor
    const nextCursor =
      (page.length === limitNum && (startIndex + limitNum < sortedTokens.length))
        ? page[page.length - 1]?.token_address
        : null;

    res.json({
      data: page,
      nextCursor,
    });
  } catch (error) {
    // --- FIX 2 IS HERE ---
    if (error instanceof Error) {
      console.error('Error in /v1/tokens:', error.message);
    } else {
      console.error('An unknown error occurred in /v1/tokens:', error);
    }
    // --- END OF FIX 2 ---
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start the server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});