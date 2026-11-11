import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { ProviderError } from './providers/esports/errors';

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(value => value.trim()).filter(Boolean);
app.use(cors(allowedOrigins?.length ? { origin: allowedOrigins } : undefined));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found', code: 'NOT_FOUND', retryable: false }));

const webDist = process.env.WEB_DIST ? path.resolve(process.env.WEB_DIST) : "";
if (webDist && fs.existsSync(path.join(webDist, "index.html"))) {
  app.use(express.static(webDist, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => {
    if ((req.method !== "GET" && req.method !== "HEAD") || req.path.startsWith("/api") || path.extname(req.path)) return next();
    res.sendFile(path.join(webDist, "index.html"), (error) => { if (error) next(error); });
  });
}

const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent) return _next(error);
  if (error instanceof ProviderError) {
    if (error.code === 'PROVIDER_RATE_LIMITED') res.set('Retry-After', '30');
    res.status(error.status).json({ error: error.message, code: error.code, retryable: error.retryable });
    return;
  }
  const clientError = error?.status === 400;
  // Do not log raw upstream errors: URLs or bodies can contain credentials.
  logger.warn({ category: clientError ? 'invalid-request' : 'request-failed' }, 'Request could not be completed');
  res.status(clientError ? 400 : 500).json({ error: clientError ? 'Invalid request body' : 'Request could not be completed', code: clientError ? 'INVALID_REQUEST' : 'INTERNAL_ERROR', retryable: !clientError });
};
app.use(errors);

export default app;
