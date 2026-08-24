import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const output = ".test-dist/adapter.test.mjs";
const routeOutput = ".test-dist/esports-route.test.mjs";
await rm(".test-dist", { recursive: true, force: true });
await Promise.all([
  build({
  entryPoints: ["src/providers/esports/vlr/adapter.test.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: output,
  sourcemap: "inline",
  }),
  build({
    entryPoints: ["src/routes/esports.test.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: routeOutput,
    sourcemap: "inline",
    external: ["express"],
    plugins: [{
      name: "mock-esports-provider",
      setup(build) {
        build.onResolve({ filter: /^\.\.\/providers\/esports$/ }, () => ({ path: "mock-esports-provider", namespace: "mock" }));
        build.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
          contents: `
            export function getConfiguredProvider() {
              return globalThis.__testProviderSelection ?? { provider: null, name: null, configured: false };
            }
            export function getConfiguredStatsProvider() { return null; }
          `,
          loader: "js",
        }));
      },
    }],
  }),
]);

const child = spawn(process.execPath, ["--test", output, routeOutput], { stdio: "inherit" });
const exitCode = await new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
await rm(".test-dist", { recursive: true, force: true });
process.exit(exitCode);