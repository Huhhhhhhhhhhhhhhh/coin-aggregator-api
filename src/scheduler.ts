import cron from "node-cron";
import type { Server } from "socket.io";
import { sortTokens } from "./filters";
import { aggregate } from "./aggregator";
import { config } from "./config";

export function startScheduler(io: Server) {
  // every POLL_INTERVAL_MS via cron-like loop
  const tick = async () => {
    try {
      const list = await aggregate({}); // default listing (from Gecko page 1)
      // pick top 50 by volume/24h change heuristic
      const subset = sortTokens(list, "volume", "24h").slice(0, 60);
      io.emit("tokens:diff", subset); // broadcast incremental list (frontend merges)
    } catch (e) {
      // swallow error to keep loop going
    } finally {
      setTimeout(tick, config.pollIntervalMs);
    }
  };
  tick();

  // cron for heavier refresh every minute could go here
  cron.schedule("*/1 * * * *", async () => {
    // placeholder for hourly/7d windows recalcs, if needed
  });
}
