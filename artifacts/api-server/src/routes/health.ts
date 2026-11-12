import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { redisCache } from "../lib/redis";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Whether the shared Redis cache is on, and how often it answered since the API started.
router.get("/healthz/cache", (_req, res) => {
  const redis = redisCache();
  if (!redis) return res.json({ redis: false });
  const { hits, misses, errors } = redis.stats;
  return res.json({ redis: true, hits, misses, errors, hitRate: hits + misses ? Math.round((hits / (hits + misses)) * 100) / 100 : null });
});

export default router;
