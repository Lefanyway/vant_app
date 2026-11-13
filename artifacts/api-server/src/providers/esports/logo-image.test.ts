import assert from "node:assert/strict";
import test from "node:test";
import { PNG } from "pngjs";
import { normalizePng, normalizeSvg, pngSize, sanitizeSvg } from "./logo-image.ts";

function image(width: number, height: number, paint: (x: number, y: number, data: Buffer, index: number) => void) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) paint(x, y, png.data, (width * y + x) << 2);
  }
  return PNG.sync.write(png);
}

function opaqueColors(buffer: Buffer) {
  const png = PNG.sync.read(buffer);
  const colors: Array<[number, number, number]> = [];
  for (let index = 0; index < png.data.length; index += 4) {
    if (png.data[index + 3] > 200) colors.push([png.data[index], png.data[index + 1], png.data[index + 2]]);
  }
  return colors;
}

test("puts a dark monochrome mark on the standard neutral plate and trims empty padding", () => {
  const input = image(32, 32, (x, y, data, index) => {
    const mark = x >= 22 && x < 28 && y >= 22 && y < 28;
    data[index] = mark ? 8 : 0;
    data[index + 1] = mark ? 8 : 0;
    data[index + 2] = mark ? 8 : 0;
    data[index + 3] = mark ? 255 : 0;
  });
  const output = normalizePng(input);
  assert.ok(output);
  const colors = opaqueColors(output);
  assert.ok(colors.some(([red, green, blue]) => red === 101 && green === 113 && blue === 125));
  assert.ok(colors.some(([red, green, blue]) => red < 30 && green < 30 && blue < 30));
  const png = PNG.sync.read(output);
  assert.ok(png.width < 32 && png.height < 32);
});

test("does not recolor a bright logo or replace it with a plate", () => {
  const input = image(16, 16, (_x, _y, data, index) => {
    data[index] = 0;
    data[index + 1] = 230;
    data[index + 2] = 40;
    data[index + 3] = 255;
  });
  assert.equal(normalizePng(input), null);
});

test("gives a near-white monochrome mark the same neutral plate", () => {
  const input = image(12, 12, (_x, _y, data, index) => {
    data[index] = 250;
    data[index + 1] = 250;
    data[index + 2] = 250;
    data[index + 3] = 255;
  });
  const output = normalizePng(input);
  assert.ok(output);
  const colors = opaqueColors(output);
  assert.ok(colors.some(([red, green, blue]) => red === 101 && green === 113 && blue === 125));
});

test("adds a viewBox and a light plate only to a black SVG", () => {
  const dark = normalizeSvg(`<svg width="40" height="20"><path fill="#000" d="M0 0h10v10H0z"/></svg>`);
  assert.match(dark, /viewBox="0 0 40 20"/);
  assert.match(dark, /data-vant-plate="light"/);
  assert.match(dark, /fill="#000"/);
  const colored = normalizeSvg(`<svg viewBox="0 0 10 10"><path fill="#ff4655" d="M0 0h10v10H0z"/></svg>`);
  assert.equal(colored.includes("data-vant-plate"), false);
});

test("strips everything from an SVG logo that could run or load something", () => {
  const hostile = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><foreignObject><div>x</div></foreignObject><image href="https://evil.test/x.png"/><a xlink:href="javascript:alert(3)"><rect fill="url(https://evil.test/p)" width="4" height="4"/></a><style>@import url(https://evil.test/s.css);</style><use href="#shape"/></svg>`;
  const clean = sanitizeSvg(hostile);
  for (const banned of ["onload", "<script", "foreignObject", "evil.test", "javascript:", "@import"]) assert.equal(clean.includes(banned), false, banned);
  assert.match(clean, /<use href="#shape"\/>/);
  assert.match(normalizeSvg(hostile), /^<svg/);
});

test("reads PNG dimensions from the header without decoding", () => {
  const png = image(3, 2, (_x, _y, data, index) => { data[index + 3] = 255; });
  assert.deepEqual(pngSize(png), { width: 3, height: 2 });
  const huge = Buffer.from(png);
  huge.writeUInt32BE(50_000, 16);
  assert.equal(normalizePng(huge), null);
  assert.equal(pngSize(Buffer.from("not a png")), null);
});
