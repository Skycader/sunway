// Собирает js/stars-data.js из каталога HYG (https://github.com/astronexus/HYG-Database, лицензия CC BY-SA 4.0).
// Запуск: node tools/build-stars.js путь/к/hygdata_v41.csv
// На выходе 6 байт на звезду (RA uint16, Dec int16, mag uint8, B−V int8) в base64 плюс таблица имён.
const fs = require('fs');
const path = require('path');

const MAG_LIMIT = 6.2;      // звёзды ярче этого предела (≈ 6300 штук, граница невооружённого глаза)
const NAME_LIMIT = 3.5;     // подписываем только имена до этой величины

// русские названия самых известных звёзд; для остальных остаётся английское
const RU = {
  Sirius: 'Сириус', Canopus: 'Канопус', Arcturus: 'Арктур', 'Rigil Kentaurus': 'Ригель Кентаурус', Vega: 'Вега', Capella: 'Капелла',
  Rigel: 'Ригель', Procyon: 'Процион', Achernar: 'Ахернар', Betelgeuse: 'Бетельгейзе', Hadar: 'Хадар', Altair: 'Альтаир', Acrux: 'Акрукс',
  Aldebaran: 'Альдебаран', Spica: 'Спика', Antares: 'Антарес', Pollux: 'Поллукс', Fomalhaut: 'Фомальгаут', Mimosa: 'Мимоза',
  Deneb: 'Денеб', Toliman: 'Толиман', Regulus: 'Регул', Adhara: 'Адара', Castor: 'Кастор', Gacrux: 'Гакрукс', Shaula: 'Шаула',
  Bellatrix: 'Беллатрикс', Elnath: 'Эльнат', Miaplacidus: 'Миаплацидус', Alnilam: 'Альнилам', Alnair: 'Альнаир', Alnitak: 'Альнитак',
  Alioth: 'Алиот', Mirfak: 'Мирфак', 'Kaus Australis': 'Каус Австралис', Dubhe: 'Дубхе', Wezen: 'Везен', Alkaid: 'Алькаид',
  Avior: 'Авиор', Sargas: 'Саргас', Menkalinan: 'Менкалинан', Atria: 'Атрия', Alhena: 'Альхена', Peacock: 'Павлин', Polaris: 'Полярная',
  Mirzam: 'Мирцам', Alphard: 'Альфард', Hamal: 'Хамаль', Algieba: 'Альгиеба', Diphda: 'Дифда', Nunki: 'Нунки', Menkent: 'Менкент',
  Alpheratz: 'Альферац', Mirach: 'Мирах', Saiph: 'Саиф', Kochab: 'Кохаб', Rasalhague: 'Расальхаге', Algol: 'Алголь', Almach: 'Альмак',
  Denebola: 'Денебола', Naos: 'Наос', Alphecca: 'Альфекка', Suhail: 'Сухаиль', Mizar: 'Мицар', Sadr: 'Садр', Schedar: 'Шедар',
  Eltanin: 'Этамин', Mintaka: 'Минтака', Caph: 'Каф', Dschubba: 'Дшубба', Merak: 'Мерак', Izar: 'Изар', Enif: 'Эниф', Ankaa: 'Анка',
  Phecda: 'Фекда', Sabik: 'Сабик', Scheat: 'Шеат', Aludra: 'Алудра', Alderamin: 'Альдерамин', Markab: 'Маркаб', Menkar: 'Менкар',
  Zosma: 'Зозма', Acrab: 'Акраб', Arneb: 'Арнеб', Gienah: 'Гиена', Ascella: 'Аскелла', Zubeneschamali: 'Зубенешамали',
  Unukalhai: 'Унукальхай', Sheratan: 'Шератан', Phact: 'Факт', Kraz: 'Краз', Ruchbah: 'Рукбах', Muphrid: 'Мифрид', Lesath: 'Лесат',
  'Kaus Media': 'Каус Медиа', Tarazed: 'Таразед', Porrima: 'Поррима', Zubenelgenubi: 'Зубенельгенуби', Cursa: 'Курса',
  Rasalgethi: 'Расальгети', Rastaban: 'Растабан', Algenib: 'Альгениб', Alcyone: 'Альциона', Vindemiatrix: 'Виндемиатрикс',
  'Deneb Algedi': 'Денеб Альгеди', Tejat: 'Теджат', Acamar: 'Акамар', Gomeisa: 'Гомейса', 'Cor Caroli': 'Сердце Карла',
  Sadalsuud: 'Садальсууд', Matar: 'Матар', Algorab: 'Альгораб', Sadalmelik: 'Садальмелик', Zaurak: 'Заурак', Alnasl: 'Альнасл',
  Pherkad: 'Ферхад', Seginus: 'Сегинус', Albireo: 'Альбирео', Dabih: 'Дабих', Mebsuta: 'Мебсута', Talitha: 'Талита', Sulafat: 'Сулафат',
  Skat: 'Скат', Megrez: 'Мегрец', Chertan: 'Чертан', Alzirr: 'Альзирр', Heze: 'Хезе', Meissa: 'Мейсса', Adhafera: 'Адхафера',
  Sheliak: 'Шелиак', Wasat: 'Васат', Alcor: 'Алькор', Merope: 'Меропа', Electra: 'Электра', Maia: 'Майя', Taygeta: 'Тайгета',
  Thuban: 'Тубан', Alshain: 'Альшаин', Nashira: 'Нашира', Zavijava: 'Завийава', Rotanev: 'Ротанев', Sualocin: 'Суалоцин',
  Alrescha: 'Альриша', Cebalrai: 'Себальрай', Kornephoros: 'Корнефорос', Hassaleh: 'Хассалех', Tureis: 'Турейс',
};

const csv = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const parse = l => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const head = parse(csv[0]), col = n => head.indexOf(n);
const [iId, iProper, iRa, iDec, iMag, iCi] = ['id', 'proper', 'ra', 'dec', 'mag', 'ci'].map(col);

const stars = [];
for (let i = 1; i < csv.length; i++) {
  if (!csv[i]) continue;
  const r = parse(csv[i]);
  if (r[iId] === '0') continue;                // Солнце
  const mag = +r[iMag];
  if (!(mag <= MAG_LIMIT)) continue;
  stars.push({ ra: +r[iRa], dec: +r[iDec], mag, bv: r[iCi] === '' ? 0.6 : +r[iCi], name: r[iProper] });
}
stars.sort((a, b) => a.mag - b.mag);            // самые яркие первыми: индексы имён стабильны

const buf = Buffer.alloc(stars.length * 6), names = [];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
stars.forEach((s, i) => {
  buf.writeUInt16LE(Math.round(s.ra / 24 * 65536) & 0xffff, i * 6);
  buf.writeInt16LE(Math.round(s.dec / 90 * 32767), i * 6 + 2);
  buf.writeUInt8(clamp(Math.round((s.mag + 2) * 20), 0, 255), i * 6 + 4);
  buf.writeInt8(clamp(Math.round(s.bv * 40), -127, 127), i * 6 + 5);
  if (s.name && s.mag <= NAME_LIMIT && !/ [B-Z]$/.test(s.name)) names.push([i, s.name, RU[s.name] || s.name]);
});

const out = `// Сгенерировано tools/build-stars.js из каталога HYG v4.1 (CC BY-SA 4.0, https://github.com/astronexus/HYG-Database).
// Звёзды ярче ${MAG_LIMIT}m, эпоха J2000. 6 байт на звезду: RA uint16 (24ч = 65536), Dec int16 (±90° = ±32767),
// мера яркости uint8 ((m + 2) · 20), B−V int8 (· 40).
const STAR_COUNT = ${stars.length};
const STAR_B64 = "${buf.toString('base64')}";
// [индекс звезды, английское имя, русское имя]
const STAR_NAMES = ${JSON.stringify(names)};
`;
const dest = path.join(__dirname, '..', 'js', 'stars-data.js');
fs.writeFileSync(dest, out);
console.log(stars.length, 'stars,', names.length, 'names,', (out.length / 1024).toFixed(1), 'KB →', dest);
