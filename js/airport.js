// Аэропорт перед горой: полоса, рулёжная дорожка, перрон, терминал, диспетчерская башня и один самолёт «как Boeing 737»,
// который живёт по кругу: заход → посадка → пробег → рулёжка к терминалу → стоянка → рулёжка → разбег → взлёт → уход вдаль.
// Всё в метрах, в системе landscape (+Z — север, на гору). Самолёт летит по часам реального времени, не по ускоренному.
function createAirport({ root, lambert, rng }) {
  // порядок от наблюдателя: полоса (ближе всех) → рулёжка → перрон со стоянкой → терминал и башня; за ними гора
  const RW_Z = 380, RW_X0 = -400, RW_X1 = 400, RW_W = 32;
  const TW_Z = RW_Z + 38, APRON_Z0 = TW_Z + 7, APRON_Z1 = APRON_Z0 + 26;
  const lit = [];                                   // материалы с ночной подсветкой: { m, k }
  const polyOff = { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 };
  const tag = (o, label) => { o.userData.label = label; o.userData.noCast = o.userData.noReceive = true; return o; };

  // ---------------- покрытия ----------------
  function runwayTexture() {
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#2f3033'; c.fillRect(0, 0, 2048, 128);
    for (let i = 0; i < 1800; i++) { c.fillStyle = `rgba(${rng() < .5 ? '255,255,255' : '0,0,0'},${rng() * 0.06})`; c.fillRect(rng() * 2048, rng() * 128, 3, 2); }
    c.fillStyle = '#e9e9e4';
    c.fillRect(0, 4, 2048, 3); c.fillRect(0, 121, 2048, 3);                       // кромки
    for (let x = 150; x < 1900; x += 90) c.fillRect(x, 62, 52, 4);                // осевая
    for (const x0 of [14, 2034 - 60]) for (let i = 0; i < 8; i++) c.fillRect(x0, 18 + i * 12, 60, 6);   // «зебра» порогов
    for (const x of [300, 1748]) { c.fillRect(x, 34, 26, 10); c.fillRect(x, 84, 26, 10); }            // зона приземления
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 16; return t;
  }
  function taxiTexture() {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d');
    c.fillStyle = '#3a3b3e'; c.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(${rng() < .5 ? '255,255,255' : '0,0,0'},${rng() * 0.06})`; c.fillRect(rng() * 256, rng() * 64, 2, 2); }
    c.fillStyle = '#e2b92b'; c.fillRect(0, 30, 256, 3);
    const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 16; return t;
  }
  function slab(x0, x1, z0, z1, mat, y, label) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    root.add(tag(m, label)); return m;
  }
  const rwMat = lambert(0xffffff, { map: runwayTexture(), ...polyOff });
  slab(RW_X0, RW_X1, RW_Z - RW_W / 2, RW_Z + RW_W / 2, rwMat, 0.07, 'runway');
  const txTex = taxiTexture(); txTex.repeat.set(30, 1);
  const txMat = lambert(0xffffff, { map: txTex, ...polyOff });
  slab(-320, 40, TW_Z - 7, TW_Z + 7, txMat, 0.08, 'taxiway');                 // параллельная рулёжка
  const txTex2 = taxiTexture(); txTex2.repeat.set(3, 1);
  slab(-14, 14, RW_Z + RW_W / 2, TW_Z - 7, lambert(0xffffff, { map: txTex2, ...polyOff }), 0.08, 'taxiway');   // съезд с полосы у x=0
  slab(-312, -278, RW_Z + RW_W / 2, TW_Z - 7, txMat, 0.08, 'taxiway');         // разворот у начала разбега
  slab(-190, 25, APRON_Z0, APRON_Z1, lambert(0x8d8f93, { ...polyOff }), 0.09, 'apron');   // перрон

  // ---------------- терминал ----------------
  function terminalFacade(emissive) {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = emissive ? '#000' : '#c9ccd0'; c.fillRect(0, 0, 1024, 128);
    if (!emissive) { c.fillStyle = '#a2a7ae'; c.fillRect(0, 0, 1024, 14); c.fillRect(0, 114, 1024, 14); }
    for (let x = 14; x < 1010; x += 42) {
      if (emissive) { if (rng() < 0.8) { c.fillStyle = rng() < .85 ? '#ffe2a0' : '#bfe0ff'; c.fillRect(x, 26, 34, 74); } }
      else {
        const g = c.createLinearGradient(0, 26, 0, 100); g.addColorStop(0, '#5f87a8'); g.addColorStop(1, '#27394b');
        c.fillStyle = g; c.fillRect(x, 26, 34, 74); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + 3, 28, 4, 70);
      }
    }
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; return t;
  }
  const TERM = { x: -80, z: APRON_Z1 + 9, w: 100, d: 16, h: 12 };
  const termMat = lambert(0xffffff, { map: terminalFacade(false), emissive: 0xffffff, emissiveMap: terminalFacade(true), emissiveIntensity: 0 });
  lit.push({ m: termMat, k: 'glow' });
  const wall = lambert(0xb9bcc2);
  const terminal = new THREE.Mesh(new THREE.BoxGeometry(TERM.w, TERM.h, TERM.d), [wall, wall, lambert(0x6c7077), wall, termMat, termMat]);
  terminal.position.set(TERM.x, TERM.h / 2, TERM.z);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(TERM.w + 6, 0.5, 9), lambert(0x7a7f87));
  canopy.position.set(TERM.x, TERM.h - 1.2, TERM.z - TERM.d / 2 - 3);
  root.add(tag(terminal, 'terminal'), tag(canopy, 'terminal'));

  // ---------------- башня ----------------
  const TOWER = { x: 60, z: APRON_Z1 + 7 };
  const glassLit = new THREE.MeshBasicMaterial({ color: 0x1d2b3a }); lit.push({ m: glassLit, k: 'cab' });
  const tower = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 3.0, 26, 14), lambert(0xd6d8da)); shaft.position.y = 13;
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 3.4, 2.4, 14), lambert(0xc8cbd0)); cab.position.y = 27;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.0, 3.6, 14, 1, true), glassLit); glass.position.y = 30;
  const cabRoof = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.0, 0.8, 14), lambert(0x80858c)); cabRoof.position.y = 32.2;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 8, 6), lambert(0x555a60)); mast.position.y = 36.6;
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x400000 }); lit.push({ m: beaconMat, k: 'beacon' });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), beaconMat); beacon.position.y = 41;
  tower.add(shaft, cab, glass, cabRoof, mast, beacon);
  tower.position.set(TOWER.x, 0, TOWER.z);
  root.add(tag(tower, 'airtower'));
  tower.traverse(o => { o.userData.noCast = o.userData.noReceive = true; });

  // ---------------- огни полосы ----------------
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x2a2a28 }); lit.push({ m: edgeMat, k: 'edge' });
  const lights = [];
  for (let x = RW_X0 + 8; x <= RW_X1 - 8; x += 40) for (const s of [-1, 1]) lights.push([x, RW_Z + s * (RW_W / 2 + 1.2)]);
  const lightMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), edgeMat, lights.length);
  const mtx = new THREE.Matrix4();
  lights.forEach(([x, z], i) => { mtx.makeTranslation(x, 0.2, z); lightMesh.setMatrixAt(i, mtx); });
  lightMesh.instanceMatrix.needsUpdate = true;
  lightMesh.userData.noCast = lightMesh.userData.noReceive = true; lightMesh.userData.label = 'runway';
  root.add(lightMesh);

  // ---------------- самолёт ----------------
  const plane = new THREE.Group();
  const white = new THREE.Color(0xf4f4f1), grey = new THREE.Color(0xb7bcc3), gold = new THREE.Color(0xe0a63a);
  // фюзеляж — тело вращения; окраска по вершинам: белый верх, серое брюхо, золотая полоса вдоль борта
  const prof = [[0.05, -19.6], [0.55, -19.0], [1.0, -17.6], [1.45, -15.5], [1.8, -12.5], [1.95, -9]];
  for (let y = -7; y <= 12.5; y += 2) prof.push([1.95, y]);
  prof.push([1.9, 14.2], [1.7, 15.9], [1.35, 17.4], [0.9, 18.5], [0.45, 19.2], [0.0, 19.55]);
  const fusGeo = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 40);
  fusGeo.rotateZ(-Math.PI / 2);
  {
    const p = fusGeo.attributes.position, col = new Float32Array(p.count * 3), cc = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      cc.copy(white);
      if (y < -0.95) cc.copy(grey);
      else if (y > -0.5 && y < -0.12 && x > -13 && x < 15.2) cc.copy(gold);
      if (x < -15.5 && y > -0.2) cc.copy(gold);
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
    }
    fusGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  plane.add(new THREE.Mesh(fusGeo, lambert(0xffffff, { vertexColors: true })));
  // Мерцание иллюминаторов было z-fighting: коробочка толщиной 8 см лежала почти на самой обшивке, а на 400–1500 м буфер глубины
  // различает десятки сантиметров, поэтому две поверхности «спорили» за пиксель. Теперь окна выступают на 5 см, а материал
  // со смещением полигонов (polygonOffset) всегда выигрывает у обшивки.
  const glassDark = new THREE.MeshBasicMaterial({ color: 0x0f1a27, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const frameMat = new THREE.MeshBasicMaterial({ color: 0xc9cdd3, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const winGeo = new THREE.BoxGeometry(0.3, 0.42, 0.1);
  const wins = new THREE.InstancedMesh(winGeo, glassDark, 2 * 28);
  let wi = 0;
  for (const s of [-1, 1]) for (let i = 0; i < 28; i++) { mtx.makeTranslation(-9.2 + i * 0.82, 0.5, s * 1.91); wins.setMatrixAt(wi++, mtx); }
  wins.instanceMatrix.needsUpdate = true;
  plane.add(wins);
  // кабина экипажа: два лобовых стекла и по два боковых окна с рамками. Каждая панель стоит на поверхности носа и смотрит по её нормали
  // (lookAt направляет локальную ось Z), блок чуть утоплен в обшивку, а стекло выступает и выигрывает за счёт polygonOffset
  const origin = new THREE.Vector3(), nrm = new THREE.Vector3();
  function pane(w, h, x, y, z, nx, ny, nz) {
    nrm.set(nx, ny, nz).normalize();
    const f = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.08), frameMat), g = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), glassDark);
    for (const m of [f, g]) { m.position.set(x, y, z); m.lookAt(origin.set(x, y, z).add(nrm)); }
    g.translateZ(0.035);
    plane.add(f, g);
  }
  for (const s of [-1, 1]) {
    pane(1.0, 0.62, 16.5, 1.38, s * 0.62, 0.25, 0.916, s * 0.40);     // лобовые
    pane(0.82, 0.5, 15.0, 0.95, s * 1.53, 0.12, 0.52, s * 0.85);        // передние боковые
    pane(0.64, 0.46, 13.9, 0.95, s * 1.68, 0.05, 0.49, s * 0.87);        // задние боковые
  }
  // крылья и оперение выдавливаем из контура в плане
  function surface(points, depth, mirror) {
    const sh = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);                                  // контур лёг в плоскость XZ, толщина вверх
    if (mirror) g.scale(1, 1, -1);
    return g;
  }
  const wingMat = lambert(0xc4c9d0, { side: THREE.DoubleSide });
  const wingPlan = [[3, 1], [-5.3, 17.6], [-7.1, 17.6], [-4.4, 1]];
  for (const m of [false, true]) {
    const w = new THREE.Mesh(surface(wingPlan, 0.35, m), wingMat); w.position.set(0.8, -0.9, 0); plane.add(w);
    const wl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.9, 0.12), lambert(0xe0a63a)); wl.position.set(-5.2, 0.2, (m ? 1 : -1) * 18.5); wl.rotation.y = 0.1; plane.add(wl);   // законцовка
    const tp = new THREE.Mesh(surface([[0, 0.5], [-4.0, 7], [-5.2, 7], [-3.6, 0.5]], 0.22, m), wingMat); tp.position.set(-14.6, 0.55, 0); plane.add(tp);
  }
  const finGeo = new THREE.ExtrudeGeometry(new THREE.Shape([[0, 0], [-5, 7.4], [-7.1, 7.4], [-6.9, 0]].map(([x, y]) => new THREE.Vector2(x, y))), { depth: 0.3, bevelEnabled: false });
  finGeo.translate(0, 0, -0.15);
  const fin = new THREE.Mesh(finGeo, lambert(0xe0a63a, { side: THREE.DoubleSide })); fin.position.set(-12.2, 1.4, 0); plane.add(fin);
  // двигатели
  const engMat = lambert(0xa8aeb6);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.95, 4.0, 18), engMat); e.rotation.z = Math.PI / 2; e.position.set(2.2, -1.75, s * 6.3);
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), lambert(0x30343a)); fan.rotation.y = Math.PI / 2; fan.position.set(4.26, -1.75, s * 6.3);
    const py = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 0.3), engMat); py.position.set(1.4, -1.0, s * 6.3);
    plane.add(e, fan, py);
  }
  // шасси
  const gear = new THREE.Group();
  const tyre = lambert(0x151515), strut = lambert(0x9da2a9), wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14);
  function leg(x, z, twin) {
    const l = new THREE.Group();
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.3, 8), strut); st.position.y = -2.2;
    l.add(st);
    for (const dz of twin ? [-0.28, 0.28] : [0]) { const w = new THREE.Mesh(wheelGeo, tyre); w.rotation.x = Math.PI / 2; w.position.set(0, -3.0, dz); l.add(w); }
    l.position.set(x, 0, z); gear.add(l);
  }
  leg(13.6, 0, true); leg(-1.2, 2.9, true); leg(-1.2, -2.9, true);
  plane.add(gear);
  // огни: левая красная, правая зелёная, белый проблесковый на хвосте и красный маяк сверху
  const navRed = new THREE.MeshBasicMaterial({ color: 0x300000 }), navGreen = new THREE.MeshBasicMaterial({ color: 0x002a0c });
  const strobe = new THREE.MeshBasicMaterial({ color: 0x222222 }), beaconTop = new THREE.MeshBasicMaterial({ color: 0x300000 }), landing = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const bulb = (mat, x, y, z, r) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat); b.position.set(x, y, z); plane.add(b); };
  bulb(navRed, -6.2, -0.3, -18.1, 0.28); bulb(navGreen, -6.2, -0.3, 18.1, 0.28); bulb(strobe, -19.6, 0.1, 0, 0.25); bulb(beaconTop, 3.5, 2.0, 0, 0.25);
  bulb(landing, 14.0, -1.7, 0, 0.35);
  plane.traverse(o => { o.userData.noCast = o.userData.noReceive = true; });
  plane.userData.label = 'plane';
  plane.visible = false;
  root.add(plane);
  const GEAR_H = 3.5;                                        // высота оси фюзеляжа над землёй на стоянке

  // ---------------- маршрут ----------------
  const V_APP = 64, SLOPE = 0.0524, X_FAR = 3300, X_TD = 330;
  const v3 = (x, z) => new THREE.Vector3(x, 0, z);
  const spline = pts => new THREE.CatmullRomCurve3(pts.map(p => v3(p[0], p[1])), false, 'centripetal');
  // рулёжка к стоянке и от неё; концы подогнаны под пробег (x≈0 на полосе) и разворот в начале разбега
  const taxiIn = spline([[26, RW_Z], [10, RW_Z], [2, RW_Z + 6], [-4, RW_Z + 22], [-8, TW_Z - 14], [-16, TW_Z - 4], [-36, TW_Z + 6], [-60, TW_Z + 14]]);
  const taxiOut = spline([[-60, TW_Z + 14], [-90, TW_Z + 8], [-140, TW_Z + 2], [-220, TW_Z], [-285, TW_Z - 1], [-303, TW_Z - 9], [-309, RW_Z + 19], [-303, RW_Z + 9], [-285, RW_Z + 1], [-262, RW_Z]]);
  const LEN_IN = taxiIn.getLength(), LEN_OUT = taxiOut.getLength();
  const ROLL_A = 6.0, V_TAXI = 10, T_PARK = 24, A_TO = 6.2, V_ROT = 76;
  const T_APP = (X_FAR - X_TD) / V_APP;
  const ROLL_T = (V_APP - 12) / ROLL_A, ROLL_D = V_APP * ROLL_T - 0.5 * ROLL_A * ROLL_T * ROLL_T;
  const TO_T = (V_ROT - 8) / A_TO, TO_X0 = -262, TO_X1 = TO_X0 + (V_ROT * V_ROT - 64) / (2 * A_TO);
  const CLIMB_ANG = 0.14, CLIMB_T = (X_FAR - TO_X1) / 92, IDLE_T = 22;
  const phases = [
    ['approach', T_APP], ['rollout', ROLL_T], ['taxiIn', LEN_IN / V_TAXI], ['parked', T_PARK], ['taxiOut', LEN_OUT / V_TAXI],
    ['takeoff', TO_T], ['climb', CLIMB_T], ['idle', IDLE_T],
  ];
  const CYCLE = phases.reduce((s, p) => s + p[1], 0);
  // ?planeT=секунды в адресе — начать цикл с нужного места (для отладки); по умолчанию — на подлёте
  const dbgT = Number(new URLSearchParams(location.search).get('planeT'));
  let clock = dbgT > 0 ? dbgT : T_APP * 0.62;               // стартуем уже на подлёте, чтобы самолёт был виден почти сразу
  const info = { visible: false, pos: new THREE.Vector3(), speed: 0, alt: 0, phase: 'idle', gear: true };
  const tan = new THREE.Vector3(), pt = new THREE.Vector3();

  function pose() {
    let t = ((clock % CYCLE) + CYCLE) % CYCLE, name = 'idle', pi = 0;
    for (let i = 0; i < phases.length; i++) { if (t < phases[i][1]) { name = phases[i][0]; pi = i; break; } t -= phases[i][1]; }
    let x = 0, y = 0, z = RW_Z, fx = -1, fz = 0, pitch = 0, speed = 0;
    switch (name) {
      case 'approach': {
        speed = V_APP; x = X_FAR - V_APP * t; y = Math.max(0, (x - X_TD) * SLOPE);
        pitch = -0.02 + (y < 12 ? (12 - y) / 12 * 0.05 : 0);     // перед касанием лёгкое выравнивание
        break;
      }
      case 'rollout': {
        const v = V_APP - ROLL_A * t; speed = v; x = X_TD - (V_APP * t - 0.5 * ROLL_A * t * t); pitch = Math.max(0, 0.03 * (1 - t / 2)); break;
      }
      case 'taxiIn': { const u = Math.min(1, t * V_TAXI / LEN_IN); taxiIn.getPointAt(u, pt); taxiIn.getTangentAt(u, tan); x = pt.x; z = pt.z; fx = tan.x; fz = tan.z; speed = V_TAXI; break; }
      case 'parked': { taxiIn.getPointAt(1, pt); taxiIn.getTangentAt(1, tan); x = pt.x; z = pt.z; fx = tan.x; fz = tan.z; speed = 0; break; }
      case 'taxiOut': { const u = Math.min(1, t * V_TAXI / LEN_OUT); taxiOut.getPointAt(u, pt); taxiOut.getTangentAt(u, tan); x = pt.x; z = pt.z; fx = tan.x; fz = tan.z; speed = V_TAXI; break; }
      case 'takeoff': { speed = 8 + A_TO * t; x = TO_X0 + 8 * t + 0.5 * A_TO * t * t; fx = 1; pitch = t > TO_T - 2.2 ? 0.2 * Math.min(1, (t - (TO_T - 2.2)) / 2.2) : 0; break; }
      case 'climb': { speed = V_ROT + 16 * Math.min(1, t / 14); x = TO_X1 + speed * t * 0.97; y = Math.max(0, (x - TO_X1) * Math.tan(CLIMB_ANG)) * 1.0; fx = 1; pitch = 0.18 - Math.min(0.08, t * 0.004); break; }
      default: break;
    }
    return { name, x, y, z, fx, fz, pitch, speed };
  }

  const state = { airborne: false };
  function tick(dt, night, time) {
    clock += dt;
    const s = pose();
    plane.visible = s.name !== 'idle';
    info.visible = plane.visible; info.phase = s.name; info.speed = s.speed; info.alt = s.y;
    if (!plane.visible) return;
    const h = s.y + GEAR_H;
    plane.position.set(s.x, h, s.z);
    plane.rotation.order = 'YZX';
    plane.rotation.y = Math.atan2(-s.fz, s.fx);
    plane.rotation.z = s.pitch;
    gear.visible = !(s.name === 'climb' && s.y > 18) && !(s.name === 'approach' && s.y > 400);
    info.gear = gear.visible;
    info.pos.set(s.x, h + root.position.y, s.z);              // мировая точка (земля в root смещена на GROUND)
  }

  // ночные огни: самолёт мигает, огни полосы, терминал и кабина башни светятся
  function update(night, time) {
    for (const { m, k } of lit) {
      if (k === 'glow') m.emissiveIntensity = night * 1.0;
      else if (k === 'cab') m.color.setRGB(0.1 + night * 0.85, 0.16 + night * 0.7, 0.23 + night * 0.35);
      else if (k === 'edge') m.color.setRGB(0.16 + night * 0.84, 0.16 + night * 0.72, 0.12 + night * 0.4);
      else if (k === 'beacon') { const on = night > 0.3 && Math.sin(time * 3.2) > 0.2; m.color.setRGB(on ? 1 : 0.25, on ? 0.1 : 0, 0); }
    }
    const nav = Math.max(0.35, night);                          // навигационные огни горят всегда, ночью ярче
    navRed.color.setRGB(0.3 + 0.7 * nav, 0.02, 0.02); navGreen.color.setRGB(0.02, 0.2 + 0.8 * nav, 0.12);
    const flash = Math.sin(time * 8) > 0.82, beac = Math.sin(time * 4.4) > 0;
    strobe.color.setRGB(flash ? 1 : 0.18, flash ? 1 : 0.18, flash ? 1 : 0.18);
    beaconTop.color.setRGB(beac ? 1 : 0.2, beac ? 0.1 : 0, 0);
    const landOn = (info.phase === 'approach' && info.alt < 260) || info.phase === 'takeoff' || (info.phase === 'climb' && info.alt < 60);
    landing.color.setRGB(landOn ? 1 : 0.15, landOn ? 0.97 : 0.15, landOn ? 0.85 : 0.15);
  }

  return { tick, update, info: () => info };
}
