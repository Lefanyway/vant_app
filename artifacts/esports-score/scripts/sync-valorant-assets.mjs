import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const sharp = require(require.resolve('sharp', { paths: [process.env.VANT_ASSET_NODE_MODULES || root] }));
const handbook = 'https://valorantesports.com/en-US/season/115571062868511862/handbook';
const slug = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const aliases = {
  'kru-visa': ['kru', 'kru-esports'], 'leviatan-esports': ['leviatan'], 'kiwoom-drx': ['drx'],
  'g2-esports': ['g2'], 'navi': ['natus-vincere'], 'gen-g': ['geng', 'gen-g-esports'],
  'team-vitality': ['vitality'], 'tyloo-gaming': ['tyloo'], 'jd-gaming': ['jdg'],
  'vct-cn': ['vct-china'], 'edward-gaming': ['edg'], 'nongshim-redforce': ['nongshim-red-force'],
};
const manifest = JSON.parse(await readFile(path.join(root, 'lib/esports-assets.json'), 'utf8'));
const registry = new Map();
// Retain other games for secondary pages; the primary UI is Valorant only.
registry.set('game:lol', '../assets/generated/games/lol-on-dark.png');
registry.set('game:valorant', '../assets/generated/games/valorant.png');
for (const type of ['team', 'competition']) {
  for (const [key, entry] of Object.entries(manifest[`${type}s`])) {
    if (entry.status === 'resolved' && entry.logo) registry.set(`${type}:${key}`, `../${entry.logo}`);
  }
}
const report = { official: [], provider: [], failed: [], missing: [] };
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}
async function download(type, key, name, url, source, official, ids = []) {
  try {
    const bytes = Buffer.from(await (await get(url)).arrayBuffer());
    let image = sharp(bytes).ensureAlpha();
    const raw = await image.raw().toBuffer({ resolveWithObject: true });
    let weight = 0, luminance = 0;
    for (let i = 0; i < raw.data.length; i += 4) {
      const alpha = raw.data[i + 3] / 255;
      weight += alpha;
      luminance += (raw.data[i] * .2126 + raw.data[i + 1] * .7152 + raw.data[i + 2] * .0722) * alpha;
    }
    // Transparent padding only: never distort or recolor an official mark.
    const output = await image.trim().resize(192, 192, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    const relative = `assets/generated/${type}s/${key}.png`;
    await mkdir(path.join(root, `assets/generated/${type}s`), { recursive: true });
    await writeFile(path.join(root, relative), output);
    const sourceUrl = new URL(url).searchParams.get('url') || url;
    const entry = { logo: relative, source, sourceUrl, official, status: 'resolved', background: weight && luminance / weight < 80 ? 'light' : 'none', ids, name };
    manifest[`${type}s`][key] = entry;
    registry.set(`${type}:${key}`, `../${relative}`);
    for (const alias of aliases[key] || []) { manifest[`${type}s`][alias] = entry; registry.set(`${type}:${alias}`, `../${relative}`); }
    (official ? report.official : report.provider).push({ type, name, source });
  } catch (error) { report.failed.push({ type, name, reason: error.message }); }
}
const html = await (await get(handbook)).text();
const entries = (html.match(/<img\b[^>]*>/g) || []).map(tag => ({ name: tag.match(/alt="([^"]*)"/)?.[1]?.trim(), src: tag.match(/\ssrc="([^"]*)"/)?.[1]?.replaceAll('&amp;', '&') })).filter(row => row.name && row.src?.includes('f=http'));
for (const entry of entries) {
  const imageUrl = new URL(entry.src); imageUrl.searchParams.set('resize', '256:');
  const type = entry.name.startsWith('VCT ') ? 'competition' : 'team';
  await download(type, slug(entry.name), entry.name, imageUrl.toString(), handbook, true);
}
// Competition logos provided by the configured feed retain their distinct provenance.
const competitions = await (await get('http://localhost:5000/api/competitions?game=valorant')).json();
for (const competition of competitions) {
  const key = slug(competition.name);
  if (manifest.competitions[key]?.status === 'resolved') { manifest.competitions[key].ids = [competition.id]; continue; }
  if (!competition.logoUrl) { report.missing.push({ type: 'competition', name: competition.name }); continue; }
  const imageUrl = new URL(competition.logoUrl, 'http://localhost:5000').toString();
  await download('competition', key, competition.name, imageUrl, 'PandaScore', false, [competition.id]);
}
await writeFile(path.join(root, 'lib/esports-assets.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(root, 'lib/generatedAssetRegistry.ts'), `const generatedAssetRegistry: Record<string, number> = {\n${[...registry].map(([key, value]) => `  ${JSON.stringify(key)}: require(${JSON.stringify(value)}),`).join('\n')}\n};\nexport default generatedAssetRegistry;\n`);
await writeFile(path.join(root, 'data/valorant-asset-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ official: report.official.length, provider: report.provider.length, failed: report.failed.length, missing: report.missing.length }));
