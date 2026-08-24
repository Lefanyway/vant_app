import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const output = ".test-dist/adapter.test.mjs";
await rm(".test-dist", { recursive: true, force: true });
await build({
  entryPoints: ["src/providers/esports/vlr/adapter.test.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: output,
  sourcemap: "inline",
});

const child = spawn(process.execPath, ["--test", output], { stdio: "inherit" });
const exitCode = await new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
await rm(".test-dist", { recursive: true, force: true });
process.exit(exitCode);