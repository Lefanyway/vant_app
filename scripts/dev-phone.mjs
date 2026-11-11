import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { networkInterfaces } from "node:os";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { savePhoneQr } from "./phone-qr.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "artifacts", "api-server");
const appDir = path.join(root, "artifacts", "esports-score");
const addresses = Object.entries(networkInterfaces()).flatMap(([name, entries]) => (entries ?? []).filter((entry) => entry.family === "IPv4" && !entry.internal).map((entry) => ({ name, ip: entry.address })));
const ip = process.env.VANT_LAN_IP || addresses.find((entry) => /wi-?fi|wireless|wlan/i.test(entry.name))?.ip || addresses.find((entry) => /^(192\.168\.|10\.)/.test(entry.ip))?.ip;
if (!ip) throw new Error("Conecte o computador ao Wi-Fi ou configure VANT_LAN_IP.");
const apiPort = Number(process.env.VANT_API_PORT || 5000);
if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) throw new Error("VANT_API_PORT invalida.");
const apiUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || `http://${ip}:${apiPort}`).replace(/\/$/, "");
if (["localhost", "127.0.0.1", "[::1]"].includes(new URL(apiUrl).hostname)) throw new Error("EXPO_PUBLIC_API_BASE_URL aponta para localhost. Remova essa variavel ou use o IP do Wi-Fi do computador.");
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
process.on("uncaughtException", (error) => { console.error(error.message); stop(1); });
process.on("unhandledRejection", (error) => { console.error(error instanceof Error ? error.message : "Falha ao iniciar VANT."); stop(1); });
function start(args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: "inherit" });
  children.add(child);
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => { children.delete(child); if (!stopping) stop(code ?? 1); });
  return child;
}
async function healthy(url) {
  try { const response = await fetch(`${url}/api/healthz`, { signal: AbortSignal.timeout(2500) }); return response.ok && (await response.json()).status === "ok"; }
  catch { return false; }
}
async function available(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "0.0.0.0", () => server.close(() => resolve(true)));
  });
}

console.log(`\nVANT | checkout: ${root}\nIP do computador: ${ip}\nAPI usada pelo celular: ${apiUrl}`);
console.log(`Teste no Safari do celular: ${apiUrl}/api/healthz`);
if (process.argv.includes("--check")) {
  const status = await healthy(apiUrl);
  console.log(status ? "API acessivel neste computador." : "API indisponivel no endereco configurado.");
  console.log("No celular, o mesmo endereco deve mostrar status ok. Use o mesmo Wi-Fi.");
  process.exit(status ? 0 : 1);
}

if (!await healthy(apiUrl)) {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) throw new Error("A API configurada nao respondeu. Verifique o endereco antes de abrir o Expo.");
  if (!await available(apiPort)) throw new Error(`Porta ${apiPort} ocupada por um servico que nao respondeu como API VANT. Nao foi encerrado.`);
  const apiEnv = { ...process.env, PORT: String(apiPort), NODE_ENV: "development" };
  // Keep private provider credentials out of the Expo process.
  if (existsSync(path.join(apiDir, ".env"))) {
    // The backend's load-env module reads this file; never print its contents.
    console.log("A API carregara sua configuracao privada de artifacts/api-server/.env.");
  } else if (!apiEnv.PANDASCORE_API_TOKEN) {
    console.warn("Configure PANDASCORE_API_TOKEN em artifacts/api-server/.env para carregar partidas.");
  }
  console.log("Compilando API...");
  const build = spawn(process.execPath, ["build.mjs"], { cwd: apiDir, env: apiEnv, stdio: "inherit" });
  const code = await new Promise((resolve, reject) => { build.on("error", reject); build.on("exit", resolve); });
  if (code !== 0) throw new Error("A compilacao da API falhou.");
  start(["--enable-source-maps", "dist/index.mjs"], apiDir, apiEnv);
  let ready = false;
  for (let attempt = 0; attempt < 20 && !stopping; attempt++) {
    if (await healthy(apiUrl)) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) { stop(1); throw new Error("A API nao iniciou. Verifique os erros acima."); }
} else console.log("API existente reutilizada; nenhum processo foi encerrado.");

let expoPort = Number(process.env.VANT_EXPO_PORT || 8081);
while (expoPort < 8090 && !await available(expoPort)) expoPort++;
if (!Number.isInteger(expoPort) || expoPort < 1 || expoPort >= 8090) throw new Error("Nenhuma porta Expo disponivel. Feche instancias antigas e tente novamente.");
const expoEnv = { ...process.env, EXPO_PUBLIC_API_BASE_URL: apiUrl, REACT_NATIVE_PACKAGER_HOSTNAME: ip };
// Expo Go needs online account verification even when the bundle uses LAN.
delete expoEnv.EXPO_OFFLINE;
for (const name of ["PANDASCORE_API_TOKEN", "DATABASE_URL", "PORT", "EXPO_PACKAGER_PROXY_URL", "EXPO_PUBLIC_DOMAIN", "EXPO_PUBLIC_REPL_ID"]) delete expoEnv[name];
const requireApp = createRequire(path.join(appDir, "package.json"));
const expoCli = requireApp.resolve("expo/bin/cli");
console.log(`\nExpo Go: exp://${ip}:${expoPort}\nEscaneie o QR NOVO. Mantenha este terminal aberto. Ctrl+C encerra apenas os processos iniciados aqui.\n`);
try { console.log(`QR salvo em: ${savePhoneQr(`exp://${ip}:${expoPort}`)}`); } catch { console.warn("QR em arquivo indisponivel; use o QR do terminal."); }
start([expoCli, "start", "--go", "--lan", "--port", String(expoPort), ...(process.argv.includes("--clear") ? ["--clear"] : [])], appDir, expoEnv);
