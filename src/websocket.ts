import type { Server } from "socket.io";
import { sortTokens } from "./filters";
import { aggregate } from "./aggregator";
import { validTimeframes, Timeframe } from "./config";
import { diffToken } from "./utils/diff";

type ClientFilter = {
  q?: string;
  sort: "volume"|"price_change"|"market_cap"|"price"|"liquidity"|"txs";
  timeframe: Timeframe;
  limit: number;
};

const defaultFilter: ClientFilter = {
  sort: "volume",
  timeframe: "24h",
  limit: 30
};

const lastSnapshot = new Map<string, any>(); // key: address -> token

export function initWS(io: Server) {
  io.on("connection", async (socket) => {
    let prefs: ClientFilter = { ...defaultFilter };

    socket.on("subscribe", async (payload: Partial<ClientFilter>) => {
      prefs = { ...prefs, ...payload };
      const list = await aggregate({ search: prefs.q });
      const sorted = sortTokens(list, prefs.sort, prefs.timeframe).slice(0, prefs.limit);
      socket.emit("tokens:init", sorted);
      // store snapshot per client? we keep global and compute change per address
      for (const t of sorted) lastSnapshot.set(t.token_address, t);
    });

    socket.on("disconnect", () => {});
  });
}

export async function broadcastDiff(io: Server, latest: any[]) {
  // fire per-token diffs + spikes
  for (const t of latest) {
    const prev = lastSnapshot.get(t.token_address);
    if (!prev) {
      io.emit("token:update", { token: t, diff: "new" });
      lastSnapshot.set(t.token_address, t);
      continue;
    }
    const d = diffToken(prev, t);
    if (Object.keys(d).length) {
      io.emit("token:update", { token: t, diff: d });
      lastSnapshot.set(t.token_address, t);
    }
  }
}
