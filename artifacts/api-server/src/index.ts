import "./load-env";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import app from "./app";
import { logger } from "./lib/logger";
import { supabaseServices } from "./providers/esports/supabase/read";
import { redisCache } from "./lib/redis";
import { startModelTraining } from "./lib/ml";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const certificate = process.env.TLS_CERT_PATH;
const privateKey = process.env.TLS_KEY_PATH;
const server = certificate && privateKey
  ? https.createServer({ cert: fs.readFileSync(certificate), key: fs.readFileSync(privateKey) }, app)
  : http.createServer(app);

server.listen(port, () => {
  logger.info({ port, https: Boolean(certificate && privateKey), publicBaseUrl: process.env.PUBLIC_BASE_URL ?? null }, "Server listening");
  const { store, sync } = supabaseServices();
  if (sync) { sync.start(); startModelTraining(); }
  logger.info({ store: Boolean(store), sync: Boolean(sync) }, "Supabase store");
  const redis = redisCache();
  if (redis) redis.ping().then((ok) => logger.info({ ok }, "Redis cache")).catch((err) => logger.warn({ err: err instanceof Error ? err.message : String(err) }, "Redis cache unreachable; using the origin"));
  else logger.info("Redis cache off (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN not set)");
});
server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
