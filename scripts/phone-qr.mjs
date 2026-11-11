import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function savePhoneQr(url) {
  const scriptRequire = createRequire(path.join(root, "scripts", "package.json"));
  const QRCode = scriptRequire("qrcode-terminal/vendor/QRCode");
  const level = scriptRequire("qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel");
  const qr = new QRCode(-1, level.M);
  qr.addData(url);
  qr.make();
  const size = qr.getModuleCount();
  let cells = "";
  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
    if (qr.isDark(row, column)) cells += `<rect x="${column + 4}" y="${row + 4}" width="1" height="1"/>`;
  }
  const folder = path.join(root, ".expo");
  mkdirSync(folder, { recursive: true });
  const output = path.join(folder, "phone-qr.svg");
  writeFileSync(output, `<svg xmlns="http://www.w3.org/2000/svg" width="444" height="444" viewBox="0 0 ${size + 8} ${size + 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><g fill="black">${cells}</g></svg>`);
  return output;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.argv[2];
  if (!url || new URL(url).protocol !== "exp:") throw new Error("Informe o endereco exp:// exibido pelo Expo.");
  console.log(savePhoneQr(url));
}
