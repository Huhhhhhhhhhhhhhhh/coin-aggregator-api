import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import { tokensRouter } from "./routes/tokens";
import { ensureRedis } from "./cache/redis";
import { initWS } from "./websocket";
import { startScheduler } from "./scheduler";
import { config } from "./config";
import { logger } from "./logger";

async function main() {
  await ensureRedis();

  const app = express();
  app.use(express.json());

  // health
  app.get("/health", (_, res) => res.json({ ok: true }));

  // REST
  app.use("/tokens", tokensRouter);

  // errors
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    const code = err?.status ?? 500;
    res.status(code).json({ error: err.message ?? "Internal" });
  });

  const server = http.createServer(app);
  const io = new IOServer(server, { cors: { origin: "*" } });
  initWS(io);
  startScheduler(io);

  server.listen(config.port, () => {
    logger.info(`API listening on :${config.port}`);
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
