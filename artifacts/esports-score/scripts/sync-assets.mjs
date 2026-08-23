import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const catalog = JSON.parse(await readFile(join(root, "data/asset-catalog.json"), "utf8"));
const outputRoot = join(root, "assets/generated");
const manifest = { games: {}, teams: {}, competitions: {} };
const registry = [];
const summary = { resolved: 0, missing: 0, error: 0, sources: new Set(), missingEntities: [] };

function slug(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchWithRetry(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { headers: { "User-Agent": "VANT-esports-score asset sync/1.0" } });
    if (response.status !== 429 || attempt === 3) return response;
    await wait(1000 * (attempt + 1));
  }
  throw new Error("Request retry exhausted");
}

async function resolve(entity, type) {
  const search = encodeURIComponent(`${entity.name} esports logo`);
  const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${search}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url|mime&iiurlwidth=256&format=json&origin=*`;
  try {
    const response = await fetchWithRetry(endpoint);
    if (!response.ok) throw new Error(`Wikimedia responded ${response.status}`);
    const data = await response.json();
    const page = Object.values(data.query?.pages ?? {})[0];
    const info = page?.imageinfo?.[0];
    if (!info?.thumburl || !String(info.mime).startsWith("image/")) {
      summary.missing += 1; summary.missingEntities.push(`${type}: ${entity.name}`); return;
    }
    const image = await fetchWithRetry(info.thumburl);
    if (!image.ok) throw new Error(`Image responded ${image.status}`);
    const bytes = Buffer.from(await image.arrayBuffer());
    if (bytes.length < 64) throw new Error("Image payload is too small");
    const extension = String(info.mime).includes("png") ? ".png" : ".jpg";
    const relative = `assets/generated/${type}s/${slug(entity.id)}${extension}`;
    const target = join(root, relative);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, bytes);
    manifest[`${type}s`][entity.id] = { logo: relative, source: "Wikimedia Commons", status: "resolved" };
    registry.push(`  ${JSON.stringify(`${type}:${slug(entity.name)}`)}: require(${JSON.stringify(`../${relative}`)}),`);
    summary.resolved += 1; summary.sources.add("Wikimedia Commons");
  } catch (error) {
    summary.error += 1; summary.missingEntities.push(`${type}: ${entity.name}`);
    manifest[`${type}s`][entity.id] = { source: "Wikimedia Commons", status: "error" };
    console.warn(`Asset sync failed: ${type} ${entity.name} — ${error.message}`);
  }
}

for (const type of ["games", "teams", "competitions"]) {
  for (const entity of catalog[type]) await resolve(entity, type.slice(0, -1));
}
await writeFile(join(root, "lib/esports-assets.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(join(root, "lib/generatedAssetRegistry.ts"), `const generatedAssetRegistry: Record<string, number> = {\n${registry.join("\n")}\n};\n\nexport default generatedAssetRegistry;\n`);
console.log(JSON.stringify({ ...summary, sources: [...summary.sources] }, null, 2));