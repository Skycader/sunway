// Ландшафт: у каждой стороны света своя уникальная примета, чтобы ориентироваться без компаса.
//   север  (+Z) — одна большая заснеженная гора
//   юг     (−Z) — пятиэтажная «хрущёвка» с деревьями (на неё смотрим при старте)
//   восток (−X) — дорога с замершей колонной машин
//   запад  (+X) — красно-белая телевышка с огоньком
// Всё неподвижно и не зависит от положения наблюдателя. Освещается тем же Солнцем, что и небо.
// Единицы — метры, глаз наблюдателя в начале координат, земля на GROUND ниже.
function createLandscape(scene) {
  const GROUND = -1.7;
  const mats = [];                      // материалы, которые зависят от времени суток
  const rng = (seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(20250);
  const lambert = (color, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color }, o));

  const hemi = new THREE.HemisphereLight(0xaecbf2, 0x4a4d38, 0.7);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(hemi, sun);
  scene.fog = new THREE.Fog(0x99b8d8, 250, 1500);

  const root = new THREE.Group();
  root.position.y = GROUND;
  scene.add(root);

  // ---------------- север: гора ----------------
  function makeMountain() {
    const R = 400, H = 320, N = 28;
    const prof = [];
    for (let i = 0; i <= N; i++) { const v = i / N; prof.push(new THREE.Vector2(R * Math.pow(1 - v, 1.35) + 0.001, H * v)); }
    const g = new THREE.LatheGeometry(prof, 80);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    const forest = new THREE.Color(0x24391f), rock = new THREE.Color(0x5b524a), rockDark = new THREE.Color(0x40393a), snowC = new THREE.Color(0xf4f7ff), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const th = Math.atan2(z, x), v = y / H, rad = Math.hypot(x, z);
      const m = 0.14 * Math.sin(5 * th + 2.0) + 0.08 * Math.sin(9 * th + 0.5) + 0.05 * Math.sin(17 * th + 3.0);
      const n = Math.sin(th * 7 + v * 9) * 0.5 + Math.sin(th * 13 - v * 21 + 1.3) * 0.3 + Math.sin(th * 29 + v * 5) * 0.15;
      const k = 1 + (m + 0.06 * n) * (1 - v * 0.45);
      p.setXYZ(i, Math.cos(th) * rad * k, y + 7 * n * (1 - v), Math.sin(th) * rad * k);
      const hv = v + 0.05 * n;
      c.copy(forest).lerp(rock, THREE.MathUtils.smoothstep(hv, 0.17, 0.27));
      c.lerp(rockDark, 0.5 * (0.5 + 0.5 * Math.sin(th * 23 + v * 40)) * THREE.MathUtils.smoothstep(hv, 0.3, 0.5));
      c.lerp(snowC, THREE.MathUtils.smoothstep(hv, 0.60, 0.66));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, lambert(0xffffff, { vertexColors: true, flatShading: true }));
    m.position.set(0, -4, 770);
    return m;
  }
  root.add(makeMountain());

  // ---------------- общие деревья ----------------
  const foliage = [0x3f6b34, 0x4d7d38, 0x2f5a30, 0x6b8f3a, 0x557f3d].map(c => lambert(c, { flatShading: true }));
  const spruceMat = lambert(0x1f4a30, { flatShading: true });
  const trunkMat = lambert(0x4a3a2a);
  const birchMat = lambert(0xd8d4c8);
  function tree(kind, x, z, h) {
    const t = new THREE.Group();
    if (kind === 'spruce') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * h / 8, 0.25 * h / 8, h * 0.2, 6), trunkMat); trunk.position.y = h * 0.1; t.add(trunk);
      for (let i = 0; i < 3; i++) {
        const w = h * (0.32 - i * 0.08), ch = h * 0.42;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(w, ch, 8), spruceMat); cone.position.y = h * (0.28 + i * 0.22) + ch / 2 - h * 0.1; t.add(cone);
      }
    } else {
      const poplar = kind === 'poplar';
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * h / 8, 0.22 * h / 8, h * 0.5, 6), kind === 'birch' ? birchMat : trunkMat); trunk.position.y = h * 0.25; t.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(h * (poplar ? 0.2 : 0.33), 1), foliage[Math.floor(rng() * foliage.length)]);
      crown.scale.set(1, poplar ? 2.6 : 0.9 + rng() * 0.25, 1); crown.position.y = h * (poplar ? 0.62 : 0.68); crown.rotation.y = rng() * 6; t.add(crown);
    }
    t.position.set(x, 0, z);
    return t;
  }

  // ---------------- юг: хрущёвка ----------------
  function facade(lit) {
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 512;
    const c = cv.getContext('2d'), fh = 512 / 5, bay = 512;
    const r = rng;
    if (lit) { c.fillStyle = '#000'; c.fillRect(0, 0, 2048, 512); }
    else {
      c.fillStyle = '#cfc9b8'; c.fillRect(0, 0, 2048, 512);
      for (let x = 0; x < 2048; x += 85) for (let y = 0; y < 512; y += fh) {
        c.fillStyle = `rgba(${r() < .5 ? '255,250,235' : '120,115,100'},${0.04 + r() * 0.06})`; c.fillRect(x, y, 85, fh);
      }
      c.strokeStyle = 'rgba(110,104,90,.55)'; c.lineWidth = 2;
      for (let x = 0; x <= 2048; x += 85) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 512); c.stroke(); }
      for (let f = 1; f < 5; f++) { c.lineWidth = 4; c.beginPath(); c.moveTo(0, f * fh); c.lineTo(2048, f * fh); c.stroke(); }
      c.fillStyle = '#9d978a'; c.fillRect(0, 512 - 10, 2048, 10);
    }
    const win = (x, y, w, h) => {
      if (lit) { if (r() < 0.38) { c.fillStyle = r() < .8 ? '#ffd88a' : '#bfe0ff'; c.fillRect(x, y, w, h); } return; }
      c.fillStyle = '#f1efe8'; c.fillRect(x - 3, y - 3, w + 6, h + 6);
      const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#5d7288'); g.addColorStop(1, '#2d3a4a');
      c.fillStyle = g; c.fillRect(x, y, w, h);
      c.fillStyle = '#f1efe8'; c.fillRect(x + w / 2 - 1.5, y, 3, h); c.fillRect(x, y + h * 0.3, w, 3);
    };
    for (let b = 0; b < 4; b++) {
      const ox = b * bay;
      for (let f = 0; f < 5; f++) {
        const y = f * fh + 22, h = 62;
        win(ox + 40, y, 64, h); win(ox + 120, y + 10, 40, h - 14);           // квартира слева
        win(ox + 352, y + 10, 40, h - 14); win(ox + 408, y, 64, h);          // квартира справа
        if (!lit && f > 0) { c.fillStyle = '#8f8a7d'; c.fillRect(ox + 400, f * fh + fh - 16, 80, 8); c.fillStyle = '#6f6b60'; c.fillRect(ox + 400, f * fh + fh - 16, 80, 2); }
        if (f > 0) win(ox + 246, f * fh - 26, 20, 52);                      // окно лестницы на площадке
      }
      if (!lit) {                                                            // подъезд с козырьком
        c.fillStyle = '#4b3b2e'; c.fillRect(ox + 234, 512 - 76, 44, 66);
        c.fillStyle = '#a7a396'; c.fillRect(ox + 216, 512 - 88, 80, 10);
        c.fillStyle = '#e6e2d4'; c.fillRect(ox + 216, 512 - 90, 80, 3);
      }
    }
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8; return tex;
  }
  function makeKhrushchevka() {
    const W = 56, D = 11, H = 14.5, g = new THREE.Group();
    const front = lambert(0xffffff, { map: facade(false), emissive: 0xffffff, emissiveMap: facade(true), emissiveIntensity: 0 });
    mats.push({ m: front, k: 'windows' });
    const side = lambert(0xc4bdaa);
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [side, side, side, side, front, front]);
    body.position.y = H / 2; g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.8, 0.7, D + 0.8), lambert(0x4c4d51)); roof.position.y = H + 0.35; g.add(roof);
    const vent = lambert(0x8b8678);
    for (const x of [-18, -2, 14]) { const v = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), vent); v.position.set(x, H + 1.2, 0.5); g.add(v); }
    for (const x of [-22, 5, 24]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3, 4), lambert(0x333333)); a.position.set(x, H + 2.2, -1); g.add(a); }
    g.position.set(6, 0, -78);
    return g;
  }
  root.add(makeKhrushchevka());
  // деревья: по краям и редко перед фасадом
  [[-30, -66, 'poplar', 13], [-26, -60, 'birch', 8], [-38, -72, 'poplar', 15], [-20, -63, 'spruce', 9], [-14, -57, 'birch', 6],
   [-6, -56, 'spruce', 5], [10, -58, 'birch', 5.5], [18, -57, 'spruce', 6], [27, -64, 'poplar', 12], [33, -61, 'round', 8],
   [39, -68, 'spruce', 10], [44, -72, 'poplar', 14], [48, -62, 'birch', 9], [-44, -66, 'round', 9], [0, -62, 'round', 4.5],
   [-48, -80, 'spruce', 11], [52, -80, 'poplar', 16], [-33, -92, 'round', 10], [40, -95, 'birch', 9], [4, -97, 'spruce', 10]]
    .forEach(([x, z, k, h]) => root.add(tree(k, x, z, h)));

  // ---------------- восток: дорога с машинами ----------------
  const ROAD_Z = 6.5, ROAD_W = 9, ROAD_LEN = 1100;
  function roadTexture() {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#3a3b3e'; c.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${rng() < .5 ? '255,255,255' : '0,0,0'},${rng() * 0.07})`; c.fillRect(rng() * 256, rng() * 128, 2, 2); }
    c.fillStyle = '#e9e7df';
    c.fillRect(0, 4, 256, 3); c.fillRect(0, 121, 256, 3);              // краевые линии
    c.fillRect(0, 62, 100, 4);                                          // прерывистая осевая
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(ROAD_LEN / 18, 1); tex.anisotropy = 16;
    return tex;
  }
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_LEN, ROAD_W), lambert(0xffffff, { map: roadTexture() }));
  road.rotation.x = -Math.PI / 2; road.position.set(-(ROAD_LEN / 2 - 3), 0.03, ROAD_Z);
  root.add(road);
  for (const s of [-1, 1]) {                                           // тротуары
    const w = new THREE.Mesh(new THREE.BoxGeometry(ROAD_LEN, 0.18, 2.4), lambert(0x8d8b84));
    w.position.set(-(ROAD_LEN / 2 - 3), 0.09, ROAD_Z + s * (ROAD_W / 2 + 1.2)); root.add(w);
  }
  // фонари вдоль дальней стороны
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  mats.push({ m: lampMat, k: 'lamp' });
  const poleMat = lambert(0x55585c);
  for (let i = 0; i < 12; i++) {
    const x = -20 - i * 42, z = ROAD_Z + ROAD_W / 2 + 2.2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7.5, 6), poleMat); pole.position.set(x, 3.75, z);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.4), poleMat); arm.position.set(x, 7.4, z - 1.1);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.9), lampMat); head.position.set(x, 7.3, z - 2.1);
    root.add(pole, arm, head);
  }
  // машина: боковой профиль выдавлен по ширине, окна — тёмная вставка чуть шире кузова
  const bodyShape = new THREE.Shape([[-2.15, 0.3], [2.15, 0.3], [2.15, 0.75], [1.5, 0.9], [0.55, 1.42], [-0.9, 1.42], [-1.55, 0.95], [-2.15, 0.9]].map(([x, y]) => new THREE.Vector2(x, y)));
  const glassShape = new THREE.Shape([[1.4, 0.93], [0.5, 1.36], [-0.85, 1.36], [-1.45, 0.97]].map(([x, y]) => new THREE.Vector2(x, y)));
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 1.75, bevelEnabled: false }); bodyGeo.translate(0, 0, -0.875);
  const glassGeo = new THREE.ExtrudeGeometry(glassShape, { depth: 1.79, bevelEnabled: false }); glassGeo.translate(0, 0, -0.895);
  const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14); wheelGeo.rotateX(Math.PI / 2);
  const lightGeo = new THREE.BoxGeometry(0.06, 0.14, 0.42);
  const glassMat = lambert(0x18232f), wheelMat = lambert(0x151515);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xe8e6d0 }), tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const carColors = [0xc62828, 0xe8e8e8, 0x1d4e9e, 0xf2c12e, 0x6d7278, 0x1a1a1a, 0x2e7d4f, 0xb0b5ba, 0xd9731a, 0x7a1f5c];
  function car(color, x, z, dir) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bodyGeo, lambert(color)), new THREE.Mesh(glassGeo, glassMat));
    for (const sx of [-1.35, 1.35]) for (const sz of [-0.82, 0.82]) { const w = new THREE.Mesh(wheelGeo, wheelMat); w.position.set(sx, 0.33, sz); g.add(w); }
    for (const sz of [-0.6, 0.6]) {
      const h = new THREE.Mesh(lightGeo, headMat); h.position.set(2.16, 0.62, sz); g.add(h);
      const t = new THREE.Mesh(lightGeo, tailMat); t.position.set(-2.16, 0.72, sz); g.add(t);
    }
    g.position.set(x, 0.03, z); g.rotation.y = dir > 0 ? 0 : Math.PI;
    g.scale.setScalar(0.96 + rng() * 0.1);
    return g;
  }
  // колонна на восток (едут в −X, правая полоса — ближняя к наблюдателю), встречная полоса реже
  let cx0 = -11;
  for (let i = 0; i < 13; i++) { root.add(car(carColors[Math.floor(rng() * carColors.length)], cx0, ROAD_Z - 2.25, -1)); cx0 -= 6.6 + rng() * 2.6; }
  for (const cx of [-165, -230, -330]) root.add(car(carColors[Math.floor(rng() * carColors.length)], cx, ROAD_Z - 2.25, -1));
  cx0 = -34;
  for (let i = 0; i < 6; i++) { root.add(car(carColors[Math.floor(rng() * carColors.length)], cx0, ROAD_Z + 2.25, 1)); cx0 -= 11 + rng() * 14; }

  // ---------------- запад: телевышка ----------------
  const towerRed = lambert(0xc9302c), towerWhite = lambert(0xf0f0ec);
  const beacon = new THREE.MeshBasicMaterial({ color: 0x400000 });
  mats.push({ m: beacon, k: 'beacon' });
  (function () {
    const t = new THREE.Group();
    const seg = 10, H = 150, r0 = 7, r1 = 1.4;
    for (let i = 0; i < seg; i++) {
      const ra = r0 + (r1 - r0) * i / seg, rb = r0 + (r1 - r0) * (i + 1) / seg, h = H / seg;
      const s = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, h, 8), i % 2 ? towerWhite : towerRed); s.position.y = h * (i + 0.5); t.add(s);
    }
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3, 5, 10), towerWhite); deck.position.y = H * 0.62; t.add(deck);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.4, 36, 6), towerRed); mast.position.y = H + 18; t.add(mast);
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), beacon); b.position.y = H + 36; t.add(b);
    t.position.set(430, 0, -45);
    root.add(t);
  })();

  // ---------------- освещение по Солнцу ----------------
  const S = THREE.MathUtils.smoothstep, mix = (a, b, t) => a + (b - a) * t;
  function update(dir, time) {
    const h = dir.y;
    const day = S(h, -0.12, 0.25), twi = Math.exp(-Math.pow(h / 0.14, 2));
    // цвет горизонта — тот же, что в небесном шейдере: туман сливает дальние предметы с небом
    scene.fog.color.setRGB(mix(0.025, 0.64, day), mix(0.04, 0.79, day), mix(0.09, 0.95, day));
    sun.position.copy(dir).multiplyScalar(100);
    sun.intensity = 1.25 * S(h, -0.02, 0.2);
    sun.color.setRGB(1, mix(0.58, 0.97, S(h, 0, 0.3)), mix(0.32, 0.9, S(h, 0, 0.3)));
    hemi.intensity = mix(0.22, 1.05, day);
    hemi.color.setRGB(mix(0.10, 0.65, day) + twi * 0.22, mix(0.13, 0.78, day) + twi * 0.08, mix(0.25, 0.95, day));
    hemi.groundColor.setRGB(mix(0.03, 0.30, day), mix(0.03, 0.32, day), mix(0.04, 0.22, day));
    const night = 1 - day;
    for (const { m, k } of mats) {
      if (k === 'windows') m.emissiveIntensity = night * 1.1;
      else if (k === 'lamp') m.color.setRGB(mix(0.16, 1.0, night), mix(0.16, 0.82, night), mix(0.16, 0.45, night));
      else if (k === 'beacon') { const on = night > 0.3 && Math.sin(time * 3) > 0; m.color.setRGB(on ? 1 : 0.25, on ? 0.1 : 0, 0); }
    }
  }
  return { update };
}
