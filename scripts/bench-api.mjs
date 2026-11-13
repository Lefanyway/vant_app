// Times the API's main routes: first call (cold) and repeat (warm, from memory or Redis).
// Usage: node scripts/bench-api.mjs [http://localhost:5000]
const base = (process.argv[2] ?? "http://localhost:5000").replace(/\/$/, "");
const tz = encodeURIComponent("America/Sao_Paulo");
const days = ["2026-11-10", "2026-10-15", "2026-06-01", "2025-12-10", "2025-03-20", "2024-05-20", "2022-08-01"];

async function time(path) {
  const start = performance.now();
  const response = await fetch(base + path);
  const body = await response.json().catch(() => null);
  return { ms: Math.round(performance.now() - start), status: response.status, body };
}

const rows = [];
async function measure(label, path) {
  const cold = await time(path);
  const warm = await time(path);
  rows.push({ rota: label, status: cold.status, "1ª (ms)": cold.ms, "2ª (ms)": warm.ms, itens: Array.isArray(cold.body) ? cold.body.length : "" });
  return cold.body;
}

let sample;
for (const day of days) {
  const matches = await measure(`partidas ${day}`, `/api/matches?date=${day}&timezone=${tz}&game=valorant`);
  sample ??= Array.isArray(matches) ? matches.find((match) => match.status === "finished") : undefined;
}
if (sample) {
  await measure("detalhes da partida", `/api/matches/${encodeURIComponent(sample.id)}/details`);
  await measure("estatísticas da equipe", `/api/teams/${encodeURIComponent(sample.homeTeam.id)}/stats`);
}
await measure("competições", "/api/competitions?game=valorant");
console.table(rows);
const cold = rows.map((row) => row["1ª (ms)"]).sort((a, b) => a - b);
console.log(`1ª chamada: mediana ${cold[Math.floor(cold.length / 2)]} ms, pior ${cold.at(-1)} ms`);
console.log("cache:", JSON.stringify((await time("/api/healthz/cache")).body));
