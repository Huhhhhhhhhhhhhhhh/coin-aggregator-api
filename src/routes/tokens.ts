import { Router } from "express";
import { z } from "zod";
import { aggregate } from "../aggregator";
import { validTimeframes, Timeframe } from "../config";
import { sortTokens } from "../filters";
import { encodeCursor, decodeCursor } from "../utils/pagination";

const qSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().min(1).max(10).optional(),
  limit: z.coerce.number().min(1).max(100).default(30),
  cursor: z.string().optional(),
  sort: z.enum(["volume","price_change","market_cap","price","liquidity","txs"]).default("volume"),
  timeframe: z.enum(["1h","24h","7d"]).default("24h")
});

export const tokensRouter = Router();

tokensRouter.get("/", async (req, res, next) => {
  try {
    const p = qSchema.parse(req.query);
    const tf: Timeframe = p.timeframe;
    const tokens = await aggregate({ search: p.q, page: p.page });

    const sorted = sortTokens(tokens, p.sort, tf);

    // cursor handling
    const start = decodeCursor(p.cursor);
    let startIdx = 0;
    if (start) {
      const idx = sorted.findIndex(t =>
        encodeCursor((t as any)[p.sort] ?? 0, t.token_address) === p.cursor);
      startIdx = idx >= 0 ? idx + 1 : 0;
    }

    const pageItems = sorted.slice(startIdx, startIdx + p.limit);
    const last = pageItems[pageItems.length - 1];
    const nextCursor = last ? encodeCursor((last as any)[p.sort] ?? 0, last.token_address) : null;

    res.json({
      data: pageItems,
      nextCursor,
      pageSize: p.limit
    });
  } catch (e) {
    next(e);
  }
});
