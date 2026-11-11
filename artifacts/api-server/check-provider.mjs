import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && !process.env[key]) process.env[key] = value;
  }
}

const token = process.env.PANDASCORE_API_TOKEN;
const games = [
  ["valorant", "valorant"],
  ["cs2", "csgo"],
  ["lol", "lol"],
];

if (!token) {
  console.log(JSON.stringify({ pandascore: { configured: false }, games: [] }));
  process.exit(0);
}

const report = [];
for (const [game, slug] of games) {
  const endpoints = ["matches/upcoming", "teams", "leagues"];
  const checks = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`https://api.pandascore.co/${slug}/${endpoint}?per_page=1`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      checks.push({ endpoint, status: response.status, ok: response.ok });
    } catch {
      checks.push({ endpoint, status: 0, ok: false, error: "timeout-or-network" });
    }
  }
  report.push({ game, checks });
}

console.log(JSON.stringify({ pandascore: { configured: true }, games: report }));
const failed = report.some((game) => game.checks.some((check) => !check.ok));
process.exit(failed ? 1 : 0);
