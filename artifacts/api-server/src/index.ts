import "./load-env";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import app from "./app";
import { logger } from "./lib/logger";
import { supabaseServices } from "./providers/esports/supabase/read";

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
  if (sync) sync.start();
  logger.info({ store: Boolean(store), sync: Boolean(sync) }, "Supabase store");
});
server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
