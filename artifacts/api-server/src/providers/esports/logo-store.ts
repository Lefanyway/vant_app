import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareLogo } from "./logo-image";

export type Logo = { body: Buffer; contentType: string };
type LogoResult = Logo | { status: number };

const ALLOWED_HOSTS = ["images.pandascore.co", "cdn.pandascore.co", "cdn-api.pandascore.co"];
const MEMORY_LIMIT = 512;
const MAX_BYTES = 2 * 1024 * 1024;

// Reads the body in chunks and gives up past MAX_BYTES, so a huge or endless response never fills memory.
async function readLimited(response: Response): Promise<Buffer | null> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks);
    total += value.byteLength;
    if (total > MAX_BYTES) { await reader.cancel().catch(() => undefined); return null; }
    chunks.push(value);
  }
}

// Prepared logos survive API restarts here, so a new session does not download and redraw every logo again.
// Bump the folder name when prepareLogo changes its output.
const diskDir = process.env.LOGO_CACHE_DIR || path.join(tmpdir(), "vant-logos-v3");

const memory = new Map<string, Logo>();
const pending = new Map<string, Promise<LogoResult>>();

export function parseLogoUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && ALLOWED_HOSTS.includes(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

// Fetches logos ahead of time (a few at once) so the first person to open a list does not wait for them.
// Takes the app's proxied paths ("/api/esports/assets/logo?url=...").
export async function warmLogos(paths: (string | undefined)[], concurrency = 4) {
  const urls = [...new Set(paths.flatMap(value => {
    const raw = value?.startsWith("/api/esports/assets/logo?") ? new URLSearchParams(value.split("?")[1]).get("url") : null;
    const url = raw ? parseLogoUrl(raw) : null;
    return url && !memory.has(url.href) ? [url] : [];
  }))];
  for (let index = 0; index < urls.length; index += concurrency) await Promise.allSettled(urls.slice(index, index + concurrency).map(getLogo));
  return urls.length;
}

export async function getLogo(url: URL): Promise<LogoResult> {
  const hit = memory.get(url.href);
  if (hit) return hit;
  let request = pending.get(url.href);
  if (!request) {
    request = load(url).finally(() => pending.delete(url.href));
    pending.set(url.href, request);
  }
  const result = await request;
  if ("body" in result) {
    if (memory.size >= MEMORY_LIMIT) memory.delete(memory.keys().next().value!);
    memory.set(url.href, result);
  }
  return result;
}

async function load(url: URL): Promise<LogoResult> {
  const file = path.join(diskDir, createHash("sha1").update(url.href).digest("hex"));
  const stored = await readFile(file).catch(() => null);
  const split = stored?.indexOf(10) ?? -1;
  if (stored && split > 0) return { contentType: stored.subarray(0, split).toString(), body: stored.subarray(split + 1) };

  const response = await fetch(url, { signal: AbortSignal.timeout(8_000), redirect: "error" });
  if (!response.ok) return { status: 404 };
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) return { status: 415 };
  if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) return { status: 413 };
  const body = await readLimited(response);
  if (body === null) return { status: 413 };
  if (!body.length) return { status: 404 };

  const logo = prepareLogo(body, contentType);
  mkdir(diskDir, { recursive: true })
    .then(() => writeFile(file, Buffer.concat([Buffer.from(`${logo.contentType}\n`), logo.body])))
    .catch(() => undefined);
  return logo;
}
