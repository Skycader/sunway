// Строит карту яркости Млечного Пути из плотности звёзд каталога HYG (Hipparcos, до ~10m).
// Запуск: node tools/build-milkyway.js путь/к/hygdata_v41.csv
// Карта в галактических координатах: по горизонтали долгота l (0..360°), по вертикали широта b (−40..+40°),
// 8 бит серого, PNG в base64 → js/milkyway-data.js. Звёзды 7–10m полны по всему небу и хорошо рисуют диск и Большую Трещину.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 720, H = 160, B_MAX = 40;         // 0,5° на пиксель
const SIGMA = 1.7;                          // размытие, градусов: звёзд на пиксель мало, без него шум
const DEG = Math.PI / 180;

const csv = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const parse = l => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const head = parse(csv[0]), iRa = head.indexOf('ra'), iDec = head.indexOf('dec'), iMag = head.indexOf('mag'), iId = head.indexOf('id');

// экваториальные (J2000) → галактические
const M = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.4448296300, 0.7469822445], [-0.8676661490, -0.1980763734, 0.4559837762]];
const grid = new Float64Array(W * H);
let used = 0;
for (let i = 1; i < csv.length; i++) {
  if (!csv[i]) continue;
  const r = parse(csv[i]);
  if (r[iId] === '0') continue;
  const mag = +r[iMag];
  if (!(mag >= 6.5 && mag <= 10.5)) continue;
  const ra = +r[iRa] * 15 * DEG, dec = +r[iDec] * DEG;
  const e = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  const gx = M[0][0] * e[0] + M[0][1] * e[1] + M[0][2] * e[2], gy = M[1][0] * e[0] + M[1][1] * e[1] + M[1][2] * e[2], gz = M[2][0] * e[0] + M[2][1] * e[1] + M[2][2] * e[2];
  let l = Math.atan2(gy, gx) / DEG; if (l < 0) l += 360;
  const b = Math.asin(Math.max(-1, Math.min(1, gz))) / DEG;
  if (Math.abs(b) >= B_MAX) continue;
  const x = Math.min(W - 1, Math.floor(l / 360 * W)), y = Math.min(H - 1, Math.floor((b + B_MAX) / (2 * B_MAX) * H));
  grid[y * W + x] += 10 ** (-0.4 * (mag - 9));    // вклад звезды пропорционален её потоку, слабые не тонут
  used++;
}

// размытие по Гауссу, по горизонтали с периодичностью по l
function blur(src, sigmaPx) {
  const rad = Math.ceil(sigmaPx * 3), k = []; let sum = 0;
  for (let i = -rad; i <= rad; i++) { const v = Math.exp(-(i * i) / (2 * sigmaPx * sigmaPx)); k.push(v); sum += v; }
  const tmp = new Float64Array(W * H), out = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let a = 0; for (let i = -rad; i <= rad; i++) a += src[y * W + ((x + i + W) % W)] * k[i + rad]; tmp[y * W + x] = a / sum; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let a = 0, w = 0; for (let i = -rad; i <= rad; i++) { const yy = y + i; if (yy < 0 || yy >= H) continue; a += tmp[yy * W + x] * k[i + rad]; w += k[i + rad]; } out[y * W + x] = a / w; }
  return out;
}
const sm = blur(grid, SIGMA / (2 * B_MAX / H));
// нормировка по 99,7-му процентилю и мягкая кривая: сильнее подчёркиваем перепад «диск — фон»
const sorted = Float64Array.from(sm).sort(), top = sorted[Math.floor(sorted.length * 0.997)];
const px = Buffer.alloc(W * H);
for (let i = 0; i < W * H; i++) px[i] = Math.round(255 * Math.pow(Math.min(1, sm[i] / top), 0.8));

// минимальный PNG-кодировщик (8-бит серый)
function crc32(buf) { let c, crc = ~0; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 0;
const raw = Buffer.alloc((W + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W + 1)] = 0; px.copy(raw, y * (W + 1) + 1, y * W, (y + 1) * W); }
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);

const out = `// Сгенерировано tools/build-milkyway.js из плотности звёзд каталога HYG v4.1 (CC BY-SA 4.0).
// PNG ${W}×${H}: по x галактическая долгота l 0..360°, по y широта b от −${B_MAX}° (низ строки 0 — верх картинки = −${B_MAX}°) до +${B_MAX}°.
const MW_B_MAX = ${B_MAX};
const MW_PNG = "data:image/png;base64,${png.toString('base64')}";
`;
const root = path.join(__dirname, '..');
fs.writeFileSync(path.join(root, 'js', 'milkyway-data.js'), out);
fs.writeFileSync(path.join(process.argv[3] || root, 'milkyway-preview.png'), png);
console.log(used, 'stars,', (png.length / 1024).toFixed(1), 'KB png');
