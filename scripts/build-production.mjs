import { spawnSync } from "node:child_process";

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("pnpm", ["--filter", "@workspace/api-server", "run", "build"]);
run("pnpm", ["--filter", "@workspace/esports-score", "run", "export:web"], {
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  PUBLIC_WEB_ORIGIN: process.env.PUBLIC_WEB_ORIGIN ?? process.env.PUBLIC_BASE_URL ?? "http://localhost:5000",
});
