import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: [process.env.VANT_QA_NODE_MODULES || process.cwd()] }));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const output = path.join(root, 'docs/mobile-design');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.VANT_QA_BROWSER ? { executablePath: process.env.VANT_QA_BROWSER } : {}) });
const report = [];
try {
  for (const width of [360, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:8083', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.getByText('PARTIDAS', { exact: true }).waitFor();
    await page.locator('[data-testid^="match-"]').first().waitFor({ timeout: 25_000 }).catch(() => undefined);
    await page.getByRole('tab', { name: 'Buscar', exact: true }).waitFor();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(output, `partidas-${width}.png`) });
    const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const logos = await page.locator('img').evaluateAll(images => images.map(image => ({ alt: image.alt, complete: image.complete, width: image.naturalWidth, src: image.src })));
    // Exercise the actual native-components web preview. No fixture data is
    // injected into the app or production API by this script.
    await page.getByText('COMPETIÇÕES', { exact: true }).click();
    await page.getByText('Fixadas', { exact: true }).waitFor();
    await page.getByRole('button', { name: /Circuito VCT,/ }).click().catch(() => undefined);
    await page.screenshot({ path: path.join(output, `competicoes-${width}.png`) });
    await page.getByRole('tab', { name: 'Buscar', exact: true }).click();
    await page.getByText('Explore o Valorant').waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, `busca-${width}.png`) });
    await page.getByRole('tab', { name: 'Favoritos', exact: true }).click();
    await page.getByText('Suas equipes favoritas', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, `favoritos-${width}.png`) });
    if (errors.length || overflowing) throw new Error(`Layout ${width}: ${JSON.stringify({ errors, overflowing })}`);
    report.push({ width, errors, overflowing, logos });
    await context.close();
  }
  await writeFile(path.join(output, 'smoke-report.json'), JSON.stringify(report, null, 2));
  console.log('Verificados: 360, 390 e 430 px; partidas, competições, busca e favoritos.');
} finally { await browser.close(); }
