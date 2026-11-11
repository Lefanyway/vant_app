import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.NODE_ENV = "production";
process.env.PORT ??= "5000";
process.env.WEB_DIST ??= path.join(root, "artifacts", "esports-score", "dist");

const child = spawn(process.execPath, ["--enable-source-maps", path.join(root, "artifacts", "api-server", "dist", "index.mjs")], {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});

child.on("exit", (code) => process.exit(code ?? 1));
