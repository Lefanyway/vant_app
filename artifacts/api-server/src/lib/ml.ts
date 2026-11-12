import { spawn } from "node:child_process";
import path from "node:path";
import { logger } from "./logger";

const EVERY_MS = 6 * 60 * 60_000;
const repoRoot = path.resolve(__dirname, "..", "..", "..");

// New matches need fresh win probabilities: retrain ml/train.py on a timer while the API runs.
// Set VANT_ML_TRAIN=off to skip it, or VANT_PYTHON to pick the interpreter.
export function startModelTraining(delayMs = 5 * 60_000) {
  if (process.env.VANT_ML_TRAIN === "off") return;
  const run = () => {
    const child = spawn(process.env.VANT_PYTHON || "python", [path.join(repoRoot, "ml", "train.py")], { cwd: repoRoot, stdio: ["ignore", "ignore", "pipe"] });
    let errors = "";
    child.stderr.on("data", (chunk) => { errors = (errors + chunk).slice(-500); });
    child.on("error", (err) => logger.warn({ err: err.message }, "Model training could not start"));
    child.on("exit", (code) => code === 0 ? logger.info("Model retrained and predictions saved") : logger.warn({ code, errors }, "Model training failed"));
  };
  // The first run waits for the startup sync, so it trains on today's results.
  setTimeout(run, delayMs).unref();
  setInterval(run, EVERY_MS).unref();
}
