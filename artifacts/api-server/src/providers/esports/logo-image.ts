import { PNG } from "pngjs";

const MAX_EDGE = 256;

function luminance(red: number, green: number, blue: number) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function saturation(red: number, green: number, blue: number) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return max === 0 ? 0 : (max - min) / max;
}

function plateFor(meanLum: number, meanSat: number, darkRatio: number, lightRatio: number): "light" | "dark" | "none" {
  if (meanLum < 52 && lightRatio < 0.2) return "light";
  if (meanLum > 205 && meanSat < 0.18 && darkRatio < 0.08) return "dark";
  return "none";
}

function fillRounded(png: PNG, red: number, green: number, blue: number) {
  const radius = Math.round(Math.min(png.width, png.height) * 0.16);
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const dx = x < radius ? radius - x : x >= png.width - radius ? x - (png.width - radius - 1) : 0;
      const dy = y < radius ? radius - y : y >= png.height - radius ? y - (png.height - radius - 1) : 0;
      if (dx * dx + dy * dy > radius * radius) continue;
      const index = (png.width * y + x) << 2;
      png.data[index] = red;
      png.data[index + 1] = green;
      png.data[index + 2] = blue;
      png.data[index + 3] = 255;
    }
  }
}

function samplePixel(source: PNG, x: number, y: number) {
  const clampedX = Math.max(0, Math.min(source.width - 1, x));
  const clampedY = Math.max(0, Math.min(source.height - 1, y));
  const index = (source.width * clampedY + clampedX) << 2;
  return [source.data[index], source.data[index + 1], source.data[index + 2], source.data[index + 3]];
}

function composite(source: PNG, originX: number, originY: number, sourceWidth: number, sourceHeight: number, target: PNG, destX: number, destY: number, destWidth: number, destHeight: number) {
  const maxX = originX + sourceWidth - 1;
  const maxY = originY + sourceHeight - 1;
  for (let y = 0; y < destHeight; y++) {
    const targetY = destY + y;
    if (targetY < 0 || targetY >= target.height) continue;
    const sampleY = originY + (y + 0.5) * sourceHeight / destHeight - 0.5;
    const y0 = Math.max(originY, Math.min(maxY, Math.floor(sampleY)));
    const y1 = Math.max(originY, Math.min(maxY, y0 + 1));
    const yMix = Math.min(1, Math.max(0, sampleY - Math.floor(sampleY)));
    for (let x = 0; x < destWidth; x++) {
      const targetX = destX + x;
      if (targetX < 0 || targetX >= target.width) continue;
      const sampleX = originX + (x + 0.5) * sourceWidth / destWidth - 0.5;
      const x0 = Math.max(originX, Math.min(maxX, Math.floor(sampleX)));
      const x1 = Math.max(originX, Math.min(maxX, x0 + 1));
      const xMix = Math.min(1, Math.max(0, sampleX - Math.floor(sampleX)));
      const topLeft = samplePixel(source, x0, y0);
      const topRight = samplePixel(source, x1, y0);
      const bottomLeft = samplePixel(source, x0, y1);
      const bottomRight = samplePixel(source, x1, y1);
      const mix = (channel: number) => {
        const top = topLeft[channel] * (1 - xMix) + topRight[channel] * xMix;
        const bottom = bottomLeft[channel] * (1 - xMix) + bottomRight[channel] * xMix;
        return top * (1 - yMix) + bottom * yMix;
      };
      const alpha = mix(3) / 255;
      if (alpha <= 0) continue;
      const index = (target.width * targetY + targetX) << 2;
      const destinationAlpha = target.data[index + 3] / 255;
      const outAlpha = alpha + destinationAlpha * (1 - alpha);
      for (let channel = 0; channel < 3; channel++) {
        const sourceChannel = mix(channel);
        const destinationChannel = target.data[index + channel];
        target.data[index + channel] = Math.round((sourceChannel * alpha + destinationChannel * destinationAlpha * (1 - alpha)) / outAlpha);
      }
      target.data[index + 3] = Math.round(outAlpha * 255);
    }
  }
}

const MAX_SOURCE_EDGE = 4000;

// Width and height sit in the IHDR chunk at a fixed offset, so oversized images are refused before decoding.
export function pngSize(input: Buffer): { width: number; height: number } | null {
  if (input.length < 24 || input.readUInt32BE(0) !== 0x89504e47 || input.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: input.readUInt32BE(16), height: input.readUInt32BE(20) };
}

export function normalizePng(input: Buffer): Buffer | null {
  const size = pngSize(input);
  if (!size || !size.width || !size.height || size.width > MAX_SOURCE_EDGE || size.height > MAX_SOURCE_EDGE) return null;
  let source: PNG;
  try { source = PNG.sync.read(input); } catch { return null; }
  if (!source.width || !source.height || source.width > 4000 || source.height > 4000) return null;
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  let lumSum = 0;
  let satSum = 0;
  let dark = 0;
  let light = 0;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const index = (source.width * y + x) << 2;
      if (source.data[index + 3] < 24) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const lum = luminance(source.data[index], source.data[index + 1], source.data[index + 2]);
      count += 1;
      lumSum += lum;
      satSum += saturation(source.data[index], source.data[index + 1], source.data[index + 2]);
      if (lum < 48) dark += 1;
      if (lum > 205) light += 1;
    }
  }
  if (count < 8 || maxX < minX) return null;
  const plate = plateFor(lumSum / count, satSum / count, dark / count, light / count);
  const sourceWidth = maxX - minX + 1;
  const sourceHeight = maxY - minY + 1;
  const fillsFrame = sourceWidth > source.width * 0.9 && sourceHeight > source.height * 0.9;
  if (plate === "none" && fillsFrame) return null;
  const longest = Math.max(sourceWidth, sourceHeight);
  const scale = Math.min(1, MAX_EDGE / longest);
  const contentWidth = Math.max(1, Math.round(sourceWidth * scale));
  const contentHeight = Math.max(1, Math.round(sourceHeight * scale));
  const padding = plate === "none" ? Math.round(Math.min(contentWidth, contentHeight) * 0.04) : Math.round(Math.min(contentWidth, contentHeight) * 0.12);
  const target = new PNG({ width: contentWidth + padding * 2, height: contentHeight + padding * 2 });
  if (plate === "light") fillRounded(target, 101, 113, 125);
  if (plate === "dark") fillRounded(target, 101, 113, 125);
  composite(source, minX, minY, sourceWidth, sourceHeight, target, padding, padding, contentWidth, contentHeight);
  return PNG.sync.write(target);
}

function svgColors(svg: string) {
  return [...svg.matchAll(/(?:fill|stroke)=["']([^"']+)["']/gi)]
    .map((match) => match[1].trim().toLowerCase())
    .filter((color) => color !== "none" && color !== "transparent");
}

function isDarkPaint(color: string) {
  return color === "currentcolor" || color === "black" || color === "#000" || color === "#000000" || color === "#111" || color === "#111111" || color === "#0d0d0d";
}

// A logo is shapes and colors only: scripts, event handlers, embedded HTML and outside references are removed.
// The route also sends a sandboxing Content-Security-Policy, so anything missed here still cannot run.
export function sanitizeSvg(source: string) {
  return source
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<!ENTITY[^>]*>/gi, "")
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video|handler|listener)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video|handler|listener)\b[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, "none")
    .replace(/javascript:/gi, "");
}

export function normalizeSvg(source: string) {
  let svg = sanitizeSvg(source.trim());
  if (!/<svg[\s>]/i.test(svg)) return svg;
  if (!/viewBox=/i.test(svg)) {
    const width = /width=["']([\d.]+)/i.exec(svg);
    const height = /height=["']([\d.]+)/i.exec(svg);
    if (width && height) svg = svg.replace(/<svg/i, `<svg viewBox="0 0 ${width[1]} ${height[1]}"`);
  }
  const painted = svgColors(svg);
  const darkOnly = painted.length > 0 && painted.every(isDarkPaint);
  if (darkOnly && !/data-vant-plate/.test(svg)) {
    svg = svg.replace(/<svg([^>]*)>/i, (opening) => `${opening}<rect data-vant-plate="light" width="100%" height="100%" fill="#65717D"/>`);
  }
  return svg;
}

export function prepareLogo(body: Buffer, contentType: string) {
  const head = body.subarray(0, 240).toString("utf8").trim().toLowerCase();
  if (contentType.includes("svg") || head.startsWith("<svg") || head.startsWith("<?xml")) {
    return { body: Buffer.from(normalizeSvg(body.toString("utf8"))), contentType: "image/svg+xml" };
  }
  if (contentType.includes("png") || (body[0] === 0x89 && body[1] === 0x50)) {
    try {
      const normalized = normalizePng(body);
      if (normalized) return { body: normalized, contentType: "image/png" };
    } catch {
      return { body, contentType: contentType.startsWith("image/") ? contentType : "image/png" };
    }
  }
  return { body, contentType: contentType.startsWith("image/") ? contentType : "application/octet-stream" };
}
