import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const output = ".test-dist/adapter.test.mjs";
const routeOutput = ".test-dist/esports-route.test.mjs";
const logoOutput = ".test-dist/logo-image.test.mjs";
// Self-contained unit tests: bundled as they are, one output each.
const plainTests = ["pandascore/news", "cache", "search-rank", "redis-cache"];
const plainOutputs = plainTests.map((name) => `.test-dist/${name.replace("/", "-")}.test.mjs`);
await rm(".test-dist", { recursive: true, force: true });
await Promise.all([
  ...plainTests.map((name, index) => build({
    entryPoints: [`src/providers/esports/${name}.test.ts`],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: plainOutputs[index],
    sourcemap: "inline",
  })),
  build({
  entryPoints: ["src/providers/esports/vlr/adapter.test.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: output,
  sourcemap: "inline",
  }),
  build({
    entryPoints: ["src/providers/esports/logo-image.test.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: logoOutput,
    sourcemap: "inline",
    external: ["pngjs"],
  }),
  build({
    entryPoints: ["src/routes/esports.test.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: routeOutput,
    sourcemap: "inline",
    external: ["express", "pngjs"],
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

const child = spawn(process.execPath, ["--test", output, routeOutput, logoOutput, ...plainOutputs], { stdio: "inherit" });
const exitCode = await new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
await rm(".test-dist", { recursive: true, force: true });
process.exit(exitCode);