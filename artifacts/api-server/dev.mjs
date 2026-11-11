import { spawn } from "node:child_process";

process.env.NODE_ENV ??= "development";
process.env.PORT ??= "5000";

const child = spawn("pnpm", ["exec", "tsx", "watch", "src/index.ts"], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 1));
