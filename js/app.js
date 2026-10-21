(() => {
  const { t, num } = I18N;
  const DEG = Math.PI / 180;
  const $ = id => document.getElementById(id);

  // ================== НЕБО (вид наблюдателя) ==================
  const canvas = $('sky');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 3000);
  // Зум ×1 = поле зрения человека по длинной стороне экрана (бинокулярное, ~120°).
  // Шире прямолинейная проекция не умеет: к 180° картинка растягивается до бесконечности.
  const EYE_FOV = 120;
  const ZOOM_MIN = 1, ZOOM_MAX = 60;
  let zoom = 1;
  function longFov() { return 2 * Math.atan(Math.tan(EYE_FOV / 2 * DEG) / zoom) / DEG; }
  function applyZoom() {
    const half = longFov() / 2 * DEG;
    // camera.fov в three.js — вертикальный угол; длинная сторона может быть и горизонтальной
    camera.fov = camera.aspect >= 1 ? 2 * Math.atan(Math.tan(half) / camera.aspect) / DEG : 2 * half / DEG;
    camera.updateProjectionMatrix();
    skyMat.uniforms.uPix.value = camera.fov * DEG / Math.max(1, innerHeight);
  }
  camera.rotation.order = 'YXZ';
  let yaw = 0, pitch = 0.32; // yaw 0 = смотрим на юг (-Z)

  // Система координат неба: +Y — зенит, -Z — юг, +Z — север, +X — запад, -X — восток
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uMarker: { value: 0 }, uPix: { value: 0.002 } },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uSun;
      uniform float uMarker;
      uniform float uPix;   // угол одного пикселя, рад
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = uSun.y;
        float day = smoothstep(-0.12, 0.25, h);
        float t = clamp(d.y, 0.0, 1.0);

        vec3 zen = mix(vec3(0.004,0.008,0.025), vec3(0.13,0.34,0.80), day);
        vec3 hor = mix(vec3(0.025,0.04,0.09),  vec3(0.64,0.79,0.95), day);
        vec3 col = mix(hor, zen, pow(t, 0.45));

        float cosS = dot(d, uSun);
        float twi = exp(-pow(h / 0.14, 2.0));
        float toward = pow(cosS * 0.5 + 0.5, 3.0);
        float band = exp(-t * 5.0);
        col += vec3(1.0, 0.40, 0.12) * twi * toward * band * 0.95;
        col += vec3(0.45, 0.18, 0.40) * twi * band * 0.18;

        float sunVis = smoothstep(-0.04, 0.01, h);
        vec3 sunCol = mix(vec3(1.0,0.45,0.18), vec3(1.0,0.97,0.9), smoothstep(0.0, 0.25, h));
        // ореол не должен выгорать в белое пятно, иначе на глаз Солнце кажется крупнее своих 32′
        float angS = length(d - uSun);
        col += sunCol * pow(max(cosS,0.0), 60.0) * 0.30 * sunVis;
        col += sunCol * exp(-angS / 0.012) * 0.28 * sunVis;
        col = min(col, vec3(0.93));

        if (d.y < 0.0) {
          vec3 g = mix(vec3(0.008,0.010,0.014), vec3(0.15,0.19,0.13), day);
          g += vec3(0.30,0.12,0.04) * twi * toward * 0.25;
          col = mix(g, hor, exp(d.y * 40.0));
        } else {
          // диск всегда ярче ореола вокруг: у горизонта тёплый жёлто-оранжевый, днём почти белый
          // реальный угловой радиус Солнца 0,2666° (диаметр ≈ 0,53°); хорда |d − s| ≈ угол без потери точности float
          float ang = length(d - uSun);
          float disc = 1.0 - smoothstep(0.004654 - uPix, 0.004654 + uPix, ang);
          vec3 discCol = mix(vec3(1.0, 0.78, 0.50), vec3(1.0, 0.98, 0.94), smoothstep(0.0, 0.3, h)) * 1.3;
          col = mix(col, max(col, discCol), disc);
        }
        // указатель солнца под горизонтом: тусклое кольцо с точкой, без свечения
        if (uMarker > 0.5 && h < 0.0) {
          float a = acos(clamp(cosS, -1.0, 1.0));
          float ring = smoothstep(0.0035, 0.0012, abs(a - 0.024));
          float dotc = smoothstep(0.0055, 0.0035, a);
          col = mix(col, vec3(0.80, 0.68, 0.48), max(ring, dotc) * 0.75);
        }
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 32), skyMat);
  skyDome.renderOrder = -1;   // небо первым: ландшафт с буфером глубины рисуется поверх
  scene.add(skyDome);

  // звёзды: настоящий каталог (js/stars-data.js, HYG, эпоха J2000)
  const R = 900;
  const N = STAR_COUNT;
  const raw = Uint8Array.from(atob(STAR_B64), c => c.charCodeAt(0));
  const dv = new DataView(raw.buffer);
  const pos = new Float32Array(N * 3), size = new Float32Array(N), bri = new Float32Array(N), tint = new Float32Array(N * 3), starMag = new Float32Array(N);
  // показатель цвета B−V → RGB: от голубых (−0,3) через белые и жёлтые к красным (1,8)
  const BV_STOPS = [[-0.3, 0.62, 0.72, 1.0], [0.0, 0.80, 0.86, 1.0], [0.3, 0.96, 0.96, 1.0], [0.6, 1.0, 0.95, 0.84], [1.0, 1.0, 0.82, 0.62], [1.4, 1.0, 0.68, 0.45], [1.8, 1.0, 0.55, 0.35]];
  function bvColor(bv, out, o) {
    bv = Math.max(BV_STOPS[0][0], Math.min(BV_STOPS[BV_STOPS.length - 1][0], bv));
    let i = 0; while (i < BV_STOPS.length - 2 && bv > BV_STOPS[i + 1][0]) i++;
    const A = BV_STOPS[i], B = BV_STOPS[i + 1], f = (bv - A[0]) / (B[0] - A[0]);
    out[o] = A[1] + (B[1] - A[1]) * f; out[o + 1] = A[2] + (B[2] - A[2]) * f; out[o + 2] = A[3] + (B[3] - A[3]) * f;
  }
  for (let i = 0; i < N; i++) {
    const ra = dv.getUint16(i * 6, true) / 65536 * Math.PI * 2;
    const dec = dv.getInt16(i * 6 + 2, true) / 32767 * Math.PI / 2;
    const mag = raw[i * 6 + 4] / 20 - 2, bv = dv.getInt8(i * 6 + 5) / 40;
    pos[i*3]   = -Math.cos(dec) * Math.sin(ra) * R;
    pos[i*3+1] =  Math.sin(dec) * R;
    pos[i*3+2] = -Math.cos(dec) * Math.cos(ra) * R;
    const t = Math.max(0, Math.min(1, (6.5 - mag) / 8));
    size[i] = 1.3 + 3.8 * Math.pow(t, 1.5);
    bri[i] = 0.3 + 0.7 * Math.pow(t, 0.7);
    starMag[i] = mag;
    bvColor(bv, tint, i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  starGeo.setAttribute('aBri', new THREE.BufferAttribute(bri, 1));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(tint, 3));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uNight: { value: 0 }, uPR: { value: renderer.getPixelRatio() } },
    vertexShader: `
      attribute float aSize; attribute float aBri; attribute vec3 aColor;
      varying float vB; varying float vY; varying vec3 vC;
      uniform float uPR;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vY = normalize(wp.xyz).y; vB = aBri; vC = aColor;
        gl_PointSize = aSize * uPR;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uNight; varying float vB; varying float vY; varying vec3 vC;
      void main(){
        if (vY < 0.0) discard;
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, r) * vB * uNight * smoothstep(0.0, 0.06, vY);
        gl_FragColor = vec4(vC, a);
      }`
  });
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  spin.add(new THREE.Points(starGeo, starMat));
  tilt.add(spin);
  scene.add(tilt);
  const landscape = createLandscape(scene, renderer);

  // ---------- подписи звёзд: кольцо, от него наклонная линия и название на полке ----------
  const labels = $('labels'), lctx = labels.getContext('2d'), starLabelsOn = $('starLabels');
  const starPos = new THREE.Vector3();
  let markStar = -1, markUntil = 0, focusing = false;   // выбранная в поиске звезда и плавный наведение камеры
  const LBL = { ring: 6, diag: 14, lift: 3 };
  function drawStarLabels(night) {
    const dpr = Math.min(devicePixelRatio, 2), W = labels.clientWidth, H = labels.clientHeight;
    if (labels.width !== Math.round(W * dpr) || labels.height !== Math.round(H * dpr)) { labels.width = Math.round(W * dpr); labels.height = Math.round(H * dpr); }
    const c = lctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    if (markStar >= 0 && performance.now() > markUntil) markStar = -1;
    const fade = THREE.MathUtils.smoothstep(zoom, 1.25, 1.7) * THREE.MathUtils.smoothstep(night, 0.35, 0.9);
    const enabled = starLabelsOn.checked && fade > 0.01;
    if (!enabled && markStar < 0) return;
    // чем сильнее зум, тем более тусклые звёзды подписываем
    const maxMag = 0.3 + 2.2 * Math.log2(zoom / 1.25);
    const idx = I18N.lang === 'ru' ? 2 : 1;
    c.font = '600 12px Manrope, system-ui, sans-serif';
    c.textBaseline = 'alphabetic';
    const placed = [];
    const hit = (x0, y0, x1, y1) => placed.some(r => x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]);
    // выбранная в поиске звезда подписывается всегда и первой, остальные — по яркости и зуму
    const order = markStar >= 0 ? [STAR_NAMES.find(n => n[0] === markStar), ...STAR_NAMES.filter(n => n[0] !== markStar)] : STAR_NAMES;
    for (const n of order) {
      const i = n[0], forced = i === markStar;
      if (!forced && (!enabled || starMag[i] > maxMag)) continue;   // имена отсортированы по яркости
      starPos.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(spin.matrixWorld);
      if (!forced && starPos.y < R * 0.03) continue;      // ниже горизонта и в дымке у самой земли
      starPos.project(camera);
      if (starPos.z >= 1 || Math.abs(starPos.x) > 1 || Math.abs(starPos.y) > 1) continue;
      const sx = (starPos.x + 1) / 2 * W, sy = (1 - starPos.y) / 2 * H;
      const text = n[idx], tw = c.measureText(text).width;
      // пробуем четыре положения: вниз-вправо, вверх-вправо, вниз-влево, вверх-влево
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const p1x = sx + dx * (LBL.ring * 0.7 + LBL.diag), p1y = sy + dy * (LBL.ring * 0.7 + LBL.diag);
        const p2x = p1x + dx * (tw + 10);
        const x0 = Math.min(p1x, p2x), x1 = Math.max(p1x, p2x), y0 = p1y - 16, y1 = p1y + 3;
        if (x0 < 4 || x1 > W - 4 || y0 < 4 || y1 > H - 4 || hit(x0, y0, x1, y1)) continue;
        placed.push([x0 - 4, y0 - 2, x1 + 4, y1 + 2]);
        c.globalAlpha = forced ? 1 : fade;
        c.strokeStyle = 'rgba(170,198,236,.7)'; c.lineWidth = 1;
        c.beginPath(); c.arc(sx, sy, LBL.ring, 0, Math.PI * 2); c.stroke();
        c.beginPath();
        c.moveTo(sx + dx * LBL.ring * 0.7, sy + dy * LBL.ring * 0.7); c.lineTo(p1x, p1y); c.lineTo(p2x, p1y); c.stroke();
        c.fillStyle = '#e4eeff'; c.textAlign = dx > 0 ? 'left' : 'right';
        c.fillText(text, p1x + dx * 5, p1y - LBL.lift);
        break;
      }
    }
    c.globalAlpha = 1;
  }

  // ================== АСТРОНОМИЯ (упрощённая) ==================
  // H_g — часовой угол солнца на Гринвиче, dec — склонение солнца
  function solar(ms) {
    const d = new Date(ms);
    const doy = (ms - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000;
    const dec = -23.44 * DEG * Math.cos(2 * Math.PI * (doy + 10) / 365);
    const B = 2 * Math.PI * (doy - 81) / 365;
    const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    const utcH = (ms / 3.6e6) % 24;
    const Hg = (utcH + eot / 60 - 12) * 15 * DEG;
    const raSun = 2 * Math.PI * (doy - 80) / 365.25;
    return { dec, Hg, raSun, eot };
  }
  const xAxis = new THREE.Vector3(1, 0, 0);
  function skySun(sol, latDeg, lonDeg) {
    const H = sol.Hg + lonDeg * DEG;
    const v = new THREE.Vector3(Math.cos(sol.dec) * Math.sin(H), Math.sin(sol.dec), -Math.cos(sol.dec) * Math.cos(H));
    v.applyAxisAngle(xAxis, Math.PI / 2 - latDeg * DEG);
    return { dir: v, lst: H - sol.eot / 60 * 15 * DEG + sol.raSun };
  }

  // ================== СОСТОЯНИЕ ==================
  const slider = $('speed');
  // Год не важен: модель знает только день года (сезон) и время суток.
  // Время идёт по кругу внутри выбранного дня, день года меняет только игрок.
  const YEAR0 = Date.UTC(2025, 0, 1);            // невисокосный опорный год
  const DAY = 864e5;
  const mod = (v, m) => ((v % m) + m) % m;
  const _now = new Date();
  let doy = Math.round((Date.UTC(2025, _now.getUTCMonth(), _now.getUTCDate()) - YEAR0) / DAY);
  let todUtc = mod(Date.now(), DAY);
  let simTime = YEAR0 + doy * DAY + todUtc;
  const setSim = () => { simTime = YEAR0 + doy * DAY + todUtc; };
  let target = 1, speed = 1, paused = false;
  const observer = { lat: 50, lon: Math.max(-180, Math.min(180, -new Date().getTimezoneOffset() / 4)) };

  const MAX_EXP = 4;
  let fmtNum, fmtTime, fmtDay;
  function makeFormats() {
    const loc = t('locale');
    fmtNum = new Intl.NumberFormat(loc);
    fmtTime = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });
    fmtDay = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', timeZone: 'UTC' });
  }
  makeFormats();

  function fmtDur(s) {
    if (s < 60) return num(s.toFixed(1)) + ' ' + t('unitS');
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = Math.round(s % 60);
    return ((h ? h + ' ' + t('unitH') + ' ' : '') + (m ? m + ' ' + t('unitMin') + ' ' : '') + (!h && sec ? sec + ' ' + t('unitS') : '')).trim();
  }
  // долгота светового дня (часы) на широте при склонении dec, с учётом рефракции (−0,833°)
  function daylightHours(latDeg, dec) {
    const la = latDeg * DEG;
    const c = (Math.sin(-0.833 * DEG) - Math.sin(la) * Math.sin(dec)) / (Math.cos(la) * Math.cos(dec));
    if (c >= 1) return 0;
    if (c <= -1) return 24;
    return 2 * Math.acos(c) / DEG / 15;
  }
  function zoomText() {
    const z = zoom < 10 ? num(zoom.toFixed(1)) : String(Math.round(zoom));
    const f = longFov();
    // видимый размер Солнца с учётом увеличения, как в бинокле: 2·atan(зум · tg 16′)
    const sun = 2 * Math.atan(zoom * Math.tan(0.2666 * DEG)) / DEG;
    const fmt = v => (v < 10 ? v.toFixed(v < 1 ? 2 : 1) : Math.round(v).toString()).replace('.', t('decimal'));
    return t('zoom') + ' ×' + z + ' (' + fmt(f) + '° / ' + fmt(sun) + '°)';
  }
  // ---------- вес человека 70 кг при ускоренном вращении Земли ----------
  // При ×1 — нормальная сила тяжести эллипсоида WGS84 (формула Сомильяны): она уже учитывает
  // и сплюснутость Земли, и центробежную силу от настоящего вращения. Из неё выделяем чистую
  // гравитацию, а центробежную часть пересчитываем для вращения в X раз быстрее.
  const W0 = 7.292115e-5, G0 = 9.80665, MASS = 70;
  const WGS_A = 6378137, WGS_E2 = 0.00669437999013;
  function weightKg(latDeg, X) {
    const sl = Math.sin(latDeg * DEG), cl = Math.cos(latDeg * DEG);
    const gNormal = 9.7803253359 * (1 + 0.00193185265241 * sl * sl) / Math.sqrt(1 - WGS_E2 * sl * sl);
    const N = WGS_A / Math.sqrt(1 - WGS_E2 * sl * sl);          // радиус кривизны; N·cos(φ) — расстояние до оси
    const cent1 = W0 * W0 * N * cl * cl;                          // вертикальная центробежная при ×1
    const gEff = gNormal + cent1 - X * X * cent1;                  // гравитация − центробежная при ×X
    return { kg: MASS * gEff / G0, gEff };
  }
  function fmtKg(v) {
    const a = Math.abs(v);
    const str = a < 1000 ? num(a.toFixed(2)) : fmtNum.format(Math.round(a));
    return (v < 0 ? '−' : '') + str;
  }
  function updDaylen() {
    const el = $('daylen');
    let zl = $('zoomLine');
    if (!zl) {
      el.textContent = '';
      zl = document.createElement('span'); zl.id = 'zoomLine'; zl.className = 'zoomline';
      const wl = document.createElement('span'); wl.id = 'weightLine'; wl.className = 'zoomline';
      el.append(zl, document.createElement('br'), wl, document.createElement('br'), document.createElement('span'));
    }
    zl.textContent = zoomText();
    zl.title = t('zoomTip');
    const w = weightKg(observer.lat, speed);
    const wl = $('weightLine');
    wl.textContent = t('weight')(fmtKg(w.kg)) + (w.gEff <= 0 ? ' · ' + t('weightless') : '');
    wl.title = t('weightTip');
    wl.classList.toggle('danger', w.gEff <= 0);
    el.lastChild.textContent = dayLenText(target);
  }
  function dayLenText(mult) {
    const sol = solar(simTime);
    const dh = daylightHours(observer.lat, sol.dec);
    let day;
    if (dh === 0) day = t('polarNight');
    else if (dh === 24) day = t('polarDay');
    else day = t('daylightIn')(fmtDur(dh * 3600 / mult));
    return t('dayIn')(fmtDur(86400 / mult)) + '\n' + day;
  }
  function onSlider() {
    const p = +slider.value / 1000;
    const raw = Math.pow(10, p * MAX_EXP);
    target = raw < 10 ? Math.round(raw * 10) / 10 : raw < 100 ? Math.round(raw) : Math.round(raw / 10) * 10;
    slider.style.setProperty('--p', (p * 100) + '%');
    updDaylen();
  }
  slider.addEventListener('input', onSlider);
  onSlider();

  const ticksEl = $('ticks');
  const tickVals = [1, 10, 60, 100, 1000, 3600, 10000];
  function placeTicks() {
    ticksEl.innerHTML = '';
    const w = slider.clientWidth, thumb = 26;
    const narrow = w < 520;
    tickVals.forEach(v => {
      if (narrow && (v === 60 || v === 3600)) return;
      const s = document.createElement('span');
      s.textContent = '×' + fmtNum.format(v);
      if (v === 60) s.title = t('tickMin');
      if (v === 3600) s.title = t('tickHour');
      s.style.left = (thumb / 2 + Math.log10(v) / MAX_EXP * (w - thumb)) + 'px';
      ticksEl.appendChild(s);
    });
  }

  // ---------- время суток (местное, пояс по долготе) ----------
  const todIn = $('tod');
  let todActive = false;
  const zoneH = () => Math.round(observer.lon / 15);
  todIn.addEventListener('input', () => {
    todUtc = mod(+todIn.value * 60000 - zoneH() * 3.6e6, DAY);
    setSim();
  });
  todIn.addEventListener('pointerdown', () => { todActive = true; });
  addEventListener('pointerup', () => { todActive = false; });
  // полоса под ползунком: ночь / сумерки / день для текущей широты и дня года
  let todKey = '';
  function paintTodTrack(sol) {
    const key = observer.lat.toFixed(1) + '|' + observer.lon.toFixed(1) + '|' + doy;
    if (key === todKey) return;
    todKey = key;
    const la = observer.lat * DEG, z = zoneH();
    const noonLocal = 12 - observer.lon / 15 - sol.eot / 60 + z;
    const night = [13, 20, 48], twi = [214, 110, 70], gold = [240, 190, 110], day = [120, 175, 232];
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const stops = [];
    for (let i = 0; i <= 96; i++) {
      const t = i / 4;
      const H = (t - noonLocal) * 15 * DEG;
      const alt = Math.asin(Math.sin(la) * Math.sin(sol.dec) + Math.cos(la) * Math.cos(sol.dec) * Math.cos(H)) / DEG;
      let c;
      if (alt <= -12) c = night;
      else if (alt <= 0) c = mix(night, twi, (alt + 12) / 12);
      else if (alt <= 8) c = mix(gold, day, alt / 8);
      else c = day;
      stops.push(`rgb(${c}) ${(t / 24 * 100).toFixed(2)}%`);
    }
    todIn.style.setProperty('--tg', `linear-gradient(to right, ${stops.join(',')})`);
  }

  // ---------- день года ----------
  const doyIn = $('doy'), monthsEl = $('months');
  doyIn.value = doy;
  function syncDoy() {
    const decl = solar(simTime).dec / DEG;
    $('doyLabel').textContent = fmtDay.format(new Date(simTime)) + ' · δ ' + (decl >= 0 ? '+' : '−') + num(Math.abs(decl).toFixed(1)) + '°';
    $('season').classList.toggle('south', observer.lat < 0);
  }
  // ---------- мини-карта в мини-карте: орбита Земли, вид с северного полюса эклиптики ----------
  const orbitC = $('orbit'), octx = orbitC.getContext('2d');
  let orbitTimer = 0, doyHeld = false;
  // долгота Земли на орбите: 0° у Солнца в точке весеннего равноденствия (~20 марта), Земля — напротив
  const earthAng = d => (360 * (d - 79) / 365.25 + 180) * DEG;
  function drawOrbit() {
    const S = orbitC.clientWidth; if (!S) return;
    const dpr = Math.min(devicePixelRatio, 2);
    if (orbitC.width !== Math.round(S * dpr)) { orbitC.width = orbitC.height = Math.round(S * dpr); }
    const c = octx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2, R = S * 0.34;
    const css = getComputedStyle($('season'));
    const col = k => css.getPropertyValue(k).trim() || '#fff';
    // орбита, раскрашенная по сезонам (меняет цвета для южного полушария вместе с ползунком)
    c.lineWidth = 3; c.lineCap = 'butt';
    [[79, 172, '--spr'], [172, 265, '--sum'], [265, 355, '--aut'], [355, 444, '--win']].forEach(([a, b, k]) => {
      c.strokeStyle = col(k); c.globalAlpha = 0.85;
      c.beginPath(); c.arc(cx, cy, R, -earthAng(a), -earthAng(b), true); c.stroke();
    });
    c.globalAlpha = 1;
    // точки равноденствий и солнцестояний
    [79, 172, 265, 355].forEach(d => {
      const a = earthAng(d);
      c.fillStyle = '#e9eef8';
      c.beginPath(); c.arc(cx + R * Math.cos(a), cy - R * Math.sin(a), 1.6, 0, Math.PI * 2); c.fill();
    });
    // Солнце
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, S * 0.13);
    g.addColorStop(0, 'rgba(255,246,220,1)'); g.addColorStop(0.3, 'rgba(255,200,110,.9)'); g.addColorStop(1, 'rgba(255,150,50,0)');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, S * 0.13, 0, Math.PI * 2); c.fill();
    // Земля: освещённая половина смотрит на Солнце
    const a = earthAng(doy), ex = cx + R * Math.cos(a), ey = cy - R * Math.sin(a), er = Math.max(4, S * 0.045);
    const toSun = Math.atan2(cy - ey, cx - ex);
    c.fillStyle = '#0e1a36'; c.beginPath(); c.arc(ex, ey, er, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6fa8ec'; c.beginPath(); c.arc(ex, ey, er, toSun - Math.PI / 2, toSun + Math.PI / 2); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(230,240,255,.9)'; c.lineWidth = 1; c.beginPath(); c.arc(ex, ey, er + 2.5, 0, Math.PI * 2); c.stroke();
    // наклон оси: северный полюс всегда смотрит в одну сторону (к Солнцу — в июне)
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(ex, ey + er + 3); c.lineTo(ex, ey - er - 5); c.stroke();
    c.fillStyle = '#ff8a7a'; c.beginPath(); c.arc(ex, ey - er - 5, 1.8, 0, Math.PI * 2); c.fill();
    // направление движения: стрелка чуть впереди Земли
    const fa = a + 0.32, fx = cx + R * Math.cos(fa), fy = cy - R * Math.sin(fa);
    const dir = Math.atan2(-(Math.cos(fa)), -Math.sin(fa));
    c.save(); c.translate(fx, fy); c.rotate(dir);
    c.fillStyle = 'rgba(233,238,248,.8)'; c.beginPath(); c.moveTo(4, 0); c.lineTo(-3, -3); c.lineTo(-3, 3); c.closePath(); c.fill();
    c.restore();
  }
  function showOrbit() {
    drawOrbit();
    orbitC.classList.add('show');
    clearTimeout(orbitTimer);
    orbitTimer = setTimeout(() => { if (!doyHeld) orbitC.classList.remove('show'); }, 1800);
  }
  doyIn.addEventListener('pointerdown', () => { doyHeld = true; showOrbit(); });
  addEventListener('pointerup', () => { if (doyHeld) { doyHeld = false; showOrbit(); } });
  doyIn.addEventListener('input', () => {
    doy = +doyIn.value;
    showOrbit();
    setSim();
    syncDoy();
    updDaylen();
  });
  function placeMonths() {
    const w = doyIn.clientWidth, thumb = 16;
    if (!w) return;
    monthsEl.innerHTML = '';
    t('months').split('').forEach((m, i) => {
      const mid = (Date.UTC(2025, i, 15) - Date.UTC(2025, 0, 1)) / 864e5 / 364;
      const s = document.createElement('span');
      s.textContent = m;
      s.style.left = (thumb / 2 + mid * (w - thumb)) + 'px';
      monthsEl.appendChild(s);
    });
  }
  if (window.ResizeObserver) new ResizeObserver(placeMonths).observe(doyIn);
  $('pause').addEventListener('click', e => {
    paused = !paused;
    $('pauseText').textContent = t(paused ? 'inPause' : 'playing');
    e.currentTarget.classList.toggle('paused', paused);
  });

  function fmtCoord(o) {
    const la = num(Math.abs(o.lat).toFixed(1)) + '° ' + t('lat')[o.lat >= 0 ? 0 : 1];
    const lo = num(Math.abs(o.lon).toFixed(1)) + '° ' + t('lon')[o.lon >= 0 ? 0 : 1];
    return la + '  ' + lo;
  }

  // обзор неба мышью
  let drag = null;
  // по небу тянем 1:1 с углом экрана, по ленте компаса — в несколько раз быстрее и только по горизонту
  const COMPASS_GAIN = 4;
  function bindDrag(el, gain, horizontalOnly) {
    el.addEventListener('pointerdown', e => {
      if (follow.checked) { follow.checked = false; saveFlag('follow', false); }
      drag = { x: e.clientX, y: e.clientY, yaw, pitch };
      focusing = false;
      el.setPointerCapture(e.pointerId); el.classList.add('drag');
    });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      const k = camera.fov * DEG / canvas.clientHeight * gain;
      yaw = drag.yaw + (e.clientX - drag.x) * k;
      if (!horizontalOnly) pitch = Math.max(-1.4, Math.min(1.5, drag.pitch + (e.clientY - drag.y) * k));
    });
    const end = () => { drag = null; el.classList.remove('drag'); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  bindDrag(canvas, 1, false);
  bindDrag($('compass'), COMPASS_GAIN, true);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * Math.exp(-e.deltaY * 0.0015)));
    applyZoom();
    updDaylen();
  }, { passive: false });

  // стороны света
  const cards = [[0, 0, 0, 1], [1, -1, 0, 0], [2, 0, 0, -1], [3, 1, 0, 0]].map(([i, x, y, z]) => {
    const el = document.createElement('div');
    el.className = 'cardinal'; el.textContent = t('cardinals')[i];
    document.body.appendChild(el);
    return { el, v: new THREE.Vector3(x, 0.012, z).multiplyScalar(500) };
  });
  const tmp = new THREE.Vector3();

  // «солнце всегда»
  // флажки, запоминаются в браузере
  function loadFlag(k, def) { try { const v = localStorage.getItem('sky.' + k); return v === null ? def : v === '1'; } catch (e) { return def; } }
  function saveFlag(k, v) { try { localStorage.setItem('sky.' + k, v ? '1' : '0'); } catch (e) {} }
  const always = $('always'), follow = $('follow'), compassOn = $('compassOn');
  always.checked = loadFlag('always', false);
  follow.checked = loadFlag('follow', false);
  compassOn.checked = loadFlag('compass', true);
  starLabelsOn.checked = loadFlag('starLabels', true);
  starLabelsOn.addEventListener('change', () => saveFlag('starLabels', starLabelsOn.checked));
  const smooth = $('smooth');
  smooth.checked = loadFlag('smooth', true);
  smooth.addEventListener('change', () => saveFlag('smooth', smooth.checked));
  always.addEventListener('change', () => saveFlag('always', always.checked));
  follow.addEventListener('change', () => saveFlag('follow', follow.checked));
  compassOn.addEventListener('change', () => { saveFlag('compass', compassOn.checked); applyCompass(); });

  // ---------- компас (пеленг по горизонтали взгляда) ----------
  const compass = $('compass'), cctx = compass.getContext('2d');
  function applyCompass() {
    compass.hidden = !compassOn.checked;
    document.body.classList.toggle('compass-on', compassOn.checked);
    resize();
  }
  function drawCompass(camAzDeg, sunAzDeg, sunAltDeg) {
    if (compass.hidden) return;
    const NAMES = t('names'), INTER = t('inter'), RUMB = t('rumb');
    const dpr = Math.min(devicePixelRatio, 2);
    const W = compass.clientWidth, Ht = compass.clientHeight;
    if (compass.width !== Math.round(W * dpr) || compass.height !== Math.round(Ht * dpr)) {
      compass.width = Math.round(W * dpr); compass.height = Math.round(Ht * dpr);
    }
    const c = cctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, Ht);
    const off = Ht - 46;               // отступ под вырез телефона
    const cx = W / 2;
    const tanHalf = Math.tan(camera.fov * DEG / 2) * camera.aspect;
    const xOf = d => cx + Math.tan(d * DEG) / tanHalf * cx;   // d — отклонение от направления взгляда
    const ppd = cx / tanHalf * DEG;                           // пикселей на градус в центре
    const step = [0.5, 1, 2, 5, 10, 15, 30, 45, 90].find(s => s * ppd >= 62) || 90;
    const minor = step >= 10 ? 5 : step / 2;
    const halfView = Math.min(85, Math.atan(tanHalf) / DEG);
    const isMul = (a, m) => Math.abs(a / m - Math.round(a / m)) < 1e-6;
    const mod = (v, m) => ((v % m) + m) % m;
    const rel = a => mod(a - camAzDeg + 180, 360) - 180;   // всегда в [-180, 180)

    c.textAlign = 'center'; c.textBaseline = 'middle';
    // засечки
    for (let a = Math.ceil((camAzDeg - halfView) / minor) * minor; a <= camAzDeg + halfView; a += minor) {
      const d = a - camAzDeg;
      const x = xOf(d);
      const major = isMul(a, step);
      c.strokeStyle = major ? 'rgba(230,238,250,.75)' : 'rgba(200,215,240,.32)';
      c.lineWidth = major ? 1.5 : 1;
      c.beginPath(); c.moveTo(x, off + 46); c.lineTo(x, off + (major ? 34 : 39)); c.stroke();
    }
    // текущий пеленг считаем заранее: под его плашкой подписи не рисуем
    const brgF = mod(camAzDeg, 360);
    const brg = step < 5 ? num((Math.round(brgF * 10) / 10 % 360).toFixed(1)) : String(Math.round(brgF) % 360);
    const txt = brg + '° ' + RUMB[Math.round(brgF / 45) % 8];
    c.font = '600 13px "JetBrains Mono", ui-monospace, monospace';
    const bw = c.measureText(txt).width + 18;
    // стороны света — сначала, чтобы числа рядом с ними не налезали
    const taken = [[cx - bw / 2 - 6, cx + bw / 2 + 6]];
    c.font = '800 13px Manrope, system-ui, sans-serif';
    for (const k in NAMES) {
      const d = rel(+k); if (Math.abs(d) > halfView) continue;
      const x = xOf(d), w = c.measureText(NAMES[k]).width;
      if (taken.some(([l, r]) => x + w / 2 > l && x - w / 2 < r)) continue;   // не прятать наполовину под плашкой
      c.fillStyle = +k === 0 ? '#ff8a7a' : '#f2f6fc';
      c.fillText(NAMES[k], x, off + 19);
      taken.push([x - w / 2 - 8, x + w / 2 + 8]);
    }
    c.font = '700 12px Manrope, system-ui, sans-serif';
    for (const k in INTER) {
      const d = rel(+k); if (Math.abs(d) > halfView) continue;
      const x = xOf(d), w = c.measureText(INTER[k]).width;
      if (taken.some(([l, r]) => x + w / 2 > l && x - w / 2 < r)) continue;
      c.fillStyle = 'rgba(242,246,252,.85)';
      c.fillText(INTER[k], x, off + 19);
      taken.push([x - w / 2 - 8, x + w / 2 + 8]);
    }
    c.font = '500 12px "JetBrains Mono", ui-monospace, monospace';
    for (let a = Math.ceil((camAzDeg - halfView) / step) * step; a <= camAzDeg + halfView; a += step) {
      const an = Math.round(mod(a, 360) * 10) / 10 % 360;
      if (NAMES[an] || INTER[an]) continue;
      const x = xOf(a - camAzDeg);
      const label = num(an);
      const w = c.measureText(label).width;
      if (taken.some(([l, r]) => x + w / 2 > l && x - w / 2 < r)) continue;
      c.fillStyle = 'rgba(170,186,210,.9)';
      c.fillText(label, x, off + 19);
    }
    // солнце на ленте
    const ds = rel(sunAzDeg);
    if (Math.abs(ds) <= halfView) {
      const x = xOf(ds), up = sunAltDeg > 0;
      c.beginPath(); c.arc(x, off + 37, 4.5, 0, Math.PI * 2);
      c.fillStyle = up ? '#ffc46b' : 'rgba(217,195,156,.45)'; c.fill();
      if (up) { c.strokeStyle = 'rgba(255,196,107,.35)'; c.lineWidth = 4; c.stroke(); }
    }
    // центральная метка и текущий пеленг
    c.font = '600 13px "JetBrains Mono", ui-monospace, monospace';
    c.fillStyle = 'rgba(8,13,26,.96)';
    c.strokeStyle = 'rgba(255,196,107,.8)'; c.lineWidth = 1;
    const bx = cx - bw / 2, by = off + 7, bh = 24, r = 6;
    c.beginPath();
    c.moveTo(bx + r, by); c.arcTo(bx + bw, by, bx + bw, by + bh, r); c.arcTo(bx + bw, by + bh, bx, by + bh, r);
    c.arcTo(bx, by + bh, bx, by, r); c.arcTo(bx, by, bx + bw, by, r); c.closePath();
    c.fill(); c.stroke();
    c.fillStyle = '#ffc46b'; c.fillText(txt, cx, by + bh / 2 + 0.5);
    c.beginPath(); c.moveTo(cx, off + 33); c.lineTo(cx - 5, off + 46); c.lineTo(cx + 5, off + 46); c.closePath(); c.fill();
  }
  const ptr = document.createElement('div');
  ptr.className = 'sunptr';
  ptr.innerHTML = '<i></i><span></span>';
  ptr.hidden = true;
  document.body.appendChild(ptr);
  const ptrArrow = ptr.firstChild, ptrText = ptr.lastChild;
  const camDir = new THREE.Vector3();

  function updatePointer(sunDir, altDeg) {
    if (!always.checked) { ptr.hidden = true; return; }
    camDir.copy(sunDir).transformDirection(camera.matrixWorldInverse);
    tmp.copy(sunDir).multiplyScalar(500).project(camera);
    const inView = camDir.z < 0 && Math.abs(tmp.x) <= 0.97 && Math.abs(tmp.y) <= 0.97;
    if (inView) { ptr.hidden = true; return; }
    ptr.hidden = false;
    let dx = camDir.x, dy = camDir.y;
    if (camDir.z < 0 && Math.abs(tmp.x) < 50) { dx = tmp.x; dy = tmp.y; }
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const W = innerWidth, H = innerHeight;
    const cx = W / 2, cy = H / 2;
    const top = 24, bottom = H - 120;
    const hx = Math.max(10, cx - 40);
    const hy = Math.max(10, Math.min(cy - top, bottom - cy));
    const k = Math.min(Math.abs(dx) > 1e-6 ? hx / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? hy / Math.abs(dy) : Infinity);
    let x = cx + dx * k, y = cy - dy * k;
    // не залезать под панели: сдвигаем стрелку под панель, над которой она оказалась
    for (const r of panelRects) {
      if (x > r.left - 8 && x < r.right + 8 && y > r.top - 8 && y < r.bottom + 8) y = Math.min(bottom, r.bottom + 16);
    }
    ptrArrow.style.transform = `rotate(${Math.atan2(-dy, dx)}rad)`;
    ptrText.textContent = t('sunPtr') + ' ' + (altDeg >= 0 ? '+' : '−') + Math.abs(altDeg).toFixed(0) + '°';
    ptr.style.flexDirection = dx < 0 ? 'row' : 'row-reverse';
    const bw = ptr.offsetWidth, bh = ptr.offsetHeight;
    ptr.style.transform = `translate(${x - (dx < 0 ? 6 : bw - 6)}px, ${y - bh / 2}px)`;
  }

  // ================== МИНИ-МОДЕЛЬ: ЗЕМЛЯ И СОЛНЦЕ С ОРБИТЫ ==================
  // Инерциальная рамка: +Y — ось Земли (север). Солнце неподвижно на склонении dec,
  // Земля вращается вокруг Y на гринвичский часовой угол солнца. Орбитального движения нет.
  const gCanvas = $('globe');
  const gRenderer = new THREE.WebGLRenderer({ canvas: gCanvas, antialias: true, alpha: true });
  gRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  gRenderer.setClearColor(0x000000, 0);
  const gScene = new THREE.Scene();
  const gCam = new THREE.PerspectiveCamera(40, 4 / 3, 0.1, 600);
  const gTarget = new THREE.Vector3(0, 0, 0);
  let orb = { theta: 60 * DEG, phi: 0.35, r: 4.3 };

  // текстура Земли из маски суши
  function makeEarthTexture() {
    const W = 512, H = 256;
    const bin = atob(LAND_B64);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d');
    const img = cx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const lat = 90 - (y + 0.5) / H * 180, al = Math.abs(lat);
      const desert = Math.exp(-Math.pow((al - 24) / 8, 2)) * 0.85;
      const ice = lat < -62 || al > 72 ? 1 : 0;
      const tundra = Math.min(1, Math.max(0, (al - 55) / 15));
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const land = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
        const n = (Math.sin(x * 0.37 + y * 0.21) + Math.sin(x * 0.11 - y * 0.29)) * 0.04;
        let r, g, b;
        if (land) {
          r = 0.22 + desert * 0.52 + tundra * 0.2; g = 0.40 + desert * 0.18 + tundra * 0.08; b = 0.18 + desert * 0.16 + tundra * 0.12;
          if (ice) { r = 0.88; g = 0.92; b = 0.95; }
          r += n; g += n; b += n;
        } else {
          const pole = Math.min(1, Math.max(0, (al - 50) / 30));
          r = 0.04 + pole * 0.04; g = 0.14 + pole * 0.06; b = 0.33 + pole * 0.05;
        }
        const o = i * 4;
        img.data[o] = Math.min(255, r * 255); img.data[o + 1] = Math.min(255, g * 255); img.data[o + 2] = Math.min(255, b * 255); img.data[o + 3] = 255;
      }
    }
    cx.putImageData(img, 0, 0);
    // мягкие сетки: экватор и тропики
    cx.globalAlpha = 0.18; cx.strokeStyle = '#ffffff'; cx.lineWidth = 1;
    [0, 23.44, -23.44].forEach(lat => { const y = (90 - lat) / 180 * H; cx.setLineDash(lat ? [3, 4] : []); cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); });
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  const earthMat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: makeEarthTexture() }, uSun: { value: new THREE.Vector3(1, 0, 0) } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform sampler2D uTex; uniform vec3 uSun;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN);
        vec3 tex = texture2D(uTex, vUv).rgb;
        float l = dot(n, uSun);
        float day = smoothstep(-0.06, 0.10, l);
        vec3 dayC = tex * (0.35 + 0.85 * max(l, 0.0));
        vec3 nightC = tex * 0.09 + vec3(0.008, 0.012, 0.035);
        vec3 col = mix(nightC, dayC, day);
        col += vec3(0.55, 0.22, 0.06) * exp(-pow(l / 0.07, 2.0)) * 0.35;
        float rim = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 3.0);
        col += vec3(0.35, 0.6, 1.0) * rim * (0.08 + 0.9 * smoothstep(-0.25, 0.4, l));
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), earthMat);
  gScene.add(earth);

  // ось Земли
  const axisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.3, 0), new THREE.Vector3(0, 1.3, 0)]);
  gScene.add(new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: 0x8fa6c8, transparent: true, opacity: 0.35 })));

  // наблюдатель: точка + «столбик» к зениту, прикреплены к вращающейся Земле
  const obsGroup = new THREE.Group();
  const obsDot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffc46b }));
  const obsStick = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.28, 0)]),
    new THREE.LineBasicMaterial({ color: 0xffc46b })
  );
  const obsRing = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.075, 32), new THREE.MeshBasicMaterial({ color: 0xffc46b, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
  obsRing.rotation.x = -Math.PI / 2;
  obsGroup.add(obsDot, obsStick, obsRing);
  earth.add(obsGroup);

  function llToVec(latDeg, lonDeg, r = 1) {
    const la = latDeg * DEG, lo = lonDeg * DEG;
    return new THREE.Vector3(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r);
  }
  const yUp = new THREE.Vector3(0, 1, 0);
  let observerSite = -1, obsMenu = null;   // индекс выбранной обсерватории или −1, если точка выбрана кликом по Земле
  function placeObserver() {
    const n = llToVec(observer.lat, observer.lon);
    obsGroup.position.copy(n).multiplyScalar(1.003);
    obsGroup.quaternion.setFromUnitVectors(yUp, n);
    $('obsCoord').textContent = fmtCoord(observer);
    const o = OBSERVATORIES[observerSite], li = I18N.lang === 'ru' ? 1 : 0;
    $('obsName').textContent = o ? o.name[li] + ' · ' + o.city[li] : '';
    if (obsMenu) obsMenu.select(observerSite);
  }
  placeObserver();
  obsMenu = initObservatoryMenu({
    coords: () => observer,
    pick(i) { observerSite = i; observer.lat = OBSERVATORIES[i].lat; observer.lon = OBSERVATORIES[i].lon; placeObserver(); },
  });
  obsMenu.select(observerSite);

  // солнце мини-модели
  function glowTexture(stops) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture([[0, 'rgba(255,240,200,1)'], [0.18, 'rgba(255,214,130,0.95)'], [0.35, 'rgba(255,170,70,0.35)'], [1, 'rgba(255,140,40,0)']]),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
  }));
  // солнце далеко: лучи у Земли практически параллельны, на экране — маленький диск
  const SUN_DIST = 120;
  sunGlow.scale.set(5, 5, 1);
  gScene.add(sunGlow);

  // фоновые звёзды для мини-карты
  {
    const n = 500, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection ? new THREE.Vector3().randomDirection() : new THREE.Vector3(Math.random()-.5, Math.random()-.5, Math.random()-.5).normalize();
      v.multiplyScalar(250); p.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    gScene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb4d8, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.6 })));
  }

  const sunW = new THREE.Vector3();
  function updateGlobe(sol) {
    sunW.set(Math.cos(sol.dec), Math.sin(sol.dec), 0);
    earthMat.uniforms.uSun.value.copy(sunW);
    earth.rotation.y = sol.Hg;
    sunGlow.position.copy(sunW).multiplyScalar(SUN_DIST);
  }

  // метка «Солнце» у края мини-карты, когда далёкое солнце вне кадра
  const gsun = $('gsun'), gsunArrow = gsun.firstChild;
  const gd = new THREE.Vector3(), gp = new THREE.Vector3();
  function updateGlobeSunMark() {
    gd.copy(sunW).transformDirection(gCam.matrixWorldInverse);
    gp.copy(sunGlow.position).project(gCam);
    if (gd.z < 0 && Math.abs(gp.x) < 0.95 && Math.abs(gp.y) < 0.95) { gsun.hidden = true; return; }
    gsun.hidden = false;
    let dx = gd.x, dy = gd.y;
    if (gd.z < 0 && Math.abs(gp.x) < 50) { dx = gp.x; dy = gp.y; }
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const hx = gW / 2 - 12, hy = gH / 2 - 12;
    const k = Math.min(Math.abs(dx) > 1e-6 ? hx / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? hy / Math.abs(dy) : Infinity);
    const x = gW / 2 + dx * k, y = gH / 2 - dy * k;
    gsunArrow.style.transform = `rotate(${Math.atan2(-dy, dx)}rad)`;
    gsun.style.flexDirection = dx < 0 ? 'row' : 'row-reverse';
    const bw = gsun.offsetWidth, bh = gsun.offsetHeight;
    const tx = Math.max(2, Math.min(gW - bw - 2, x - (dx < 0 ? 4 : bw - 4)));
    const ty = Math.max(2, Math.min(gH - bh - 2, y - bh / 2));
    gsun.style.transform = `translate(${tx}px, ${ty}px)`;
  }

  function placeGlobeCam() {
    const c = Math.cos(orb.phi);
    gCam.position.set(gTarget.x + orb.r * c * Math.cos(orb.theta), gTarget.y + orb.r * Math.sin(orb.phi), gTarget.z + orb.r * c * Math.sin(orb.theta));
    gCam.lookAt(gTarget);
  }
  placeGlobeCam();

  // клик/перетаскивание по Земле — перенос наблюдателя; по фону — облёт
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hitEarth(e) {
    const r = gCanvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, gCam);
    const h = ray.intersectObject(earth, false)[0];
    return h ? h.point : null;
  }
  function moveObserverTo(pt) {
    observerSite = -1;
    const l = earth.worldToLocal(pt.clone()).normalize();
    observer.lat = Math.asin(Math.max(-1, Math.min(1, l.y))) / DEG;
    observer.lon = Math.atan2(-l.z, l.x) / DEG;
    placeObserver();
  }
  let gDrag = null;
  gCanvas.addEventListener('pointerdown', e => {
    const p = hitEarth(e);
    gCanvas.setPointerCapture(e.pointerId);
    if (p) { gDrag = { mode: 'move' }; moveObserverTo(p); }
    else { gDrag = { mode: 'orbit', x: e.clientX, y: e.clientY, theta: orb.theta, phi: orb.phi }; gCanvas.classList.add('drag'); }
  });
  gCanvas.addEventListener('pointermove', e => {
    if (!gDrag) { gCanvas.classList.toggle('over-earth', !!hitEarth(e)); return; }
    if (gDrag.mode === 'move') { const p = hitEarth(e); if (p) moveObserverTo(p); }
    else {
      orb.theta = gDrag.theta + (e.clientX - gDrag.x) * 0.01;
      orb.phi = Math.max(-1.4, Math.min(1.4, gDrag.phi + (e.clientY - gDrag.y) * 0.01));
      placeGlobeCam();
    }
  });
  const gEnd = () => { gDrag = null; gCanvas.classList.remove('drag'); };
  gCanvas.addEventListener('pointerup', gEnd);
  gCanvas.addEventListener('pointercancel', gEnd);
  gCanvas.addEventListener('wheel', e => {
    e.preventDefault();
    orb.r = Math.max(3.2, Math.min(12, orb.r * (1 + e.deltaY * 0.001)));
    placeGlobeCam();
  }, { passive: false });

  let gW = 1, gH = 1;
  function sizeGlobe() {
    const w = gCanvas.clientWidth, h = gCanvas.clientHeight;
    if (!w || !h) return;
    gW = w; gH = h;
    gRenderer.setSize(w, h, false);
    gCam.aspect = w / h;
    gCam.updateProjectionMatrix();
  }
  if (window.ResizeObserver) new ResizeObserver(sizeGlobe).observe(gCanvas);

  // ================== РАЗМЕРЫ ==================
  let panelRects = [];
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    applyZoom();
    placeTicks();
    placeMonths();
    sizeGlobe();
    panelRects = [$('clockPanel').getBoundingClientRect(), $('globePanel').getBoundingClientRect()];
    if (!compass.hidden) panelRects.push(compass.getBoundingClientRect());
  }
  addEventListener('resize', resize);
  applyCompass();

  // ================== ЦИКЛ ==================
  let last = performance.now();
  let hudTick = 0;
  const focusV = new THREE.Vector3();
  const starWorld = (i, out) => out.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(spin.matrixWorld);
  initStarSearch({
    mag: i => starMag[i],
    night: () => starMat.uniforms.uNight.value,
    world: starWorld,
    focus(i) {
      if (follow.checked) { follow.checked = false; saveFlag('follow', false); }
      markStar = i; markUntil = performance.now() + 20000; focusing = true;
    },
  });
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    const ls = Math.log(speed), lt = Math.log(target);
    // разгон быстрее торможения: при разгоне время на малых скоростях почти не идёт, и медленный разгон ощущается как задержка
    const rate = lt > ls ? 9 : 3;
    speed = Math.exp(ls + (lt - ls) * (1 - Math.exp(-dt * rate)));
    if (!smooth.checked || Math.abs(target - speed) / target < 0.002) speed = target;
    if (!paused) todUtc = mod(todUtc + dt * 1000 * speed, DAY);
    setSim();

    const sol = solar(simTime);
    const s = skySun(sol, observer.lat, observer.lon);
    skyMat.uniforms.uSun.value.copy(s.dir);
    landscape.update(s.dir, now / 1000, always.checked && s.dir.y < 0);
    starMat.uniforms.uNight.value = 1 - THREE.MathUtils.smoothstep(s.dir.y, -0.21, -0.03);
    tilt.rotation.x = Math.PI / 2 - observer.lat * DEG;
    spin.rotation.y = -s.lst;

    const sunAz = Math.atan2(-s.dir.x, s.dir.z);
    const sunAlt = Math.asin(Math.max(-1, Math.min(1, s.dir.y)));
    if (follow.checked) {
      const k = 1 - Math.exp(-dt * 5);
      let dy = (Math.PI - sunAz) - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      yaw += dy * k;
      pitch += (Math.max(-1.4, Math.min(1.5, sunAlt)) - pitch) * k;
    }
    if (focusing && !drag) {
      starWorld(markStar, focusV);
      const ty = Math.PI - Math.atan2(-focusV.x, focusV.z);
      const tp = Math.max(-1.4, Math.min(1.5, Math.asin(focusV.y / focusV.length())));
      const k = 1 - Math.exp(-dt * 5);
      let dy = ty - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      yaw += dy * k; pitch += (tp - pitch) * k;
      if (zoom < 3) { zoom = Math.min(3, zoom * Math.exp(dt * 2.5)); applyZoom(); }
      if (Math.abs(dy) < 0.004 && Math.abs(tp - pitch) < 0.004 && zoom >= 3) focusing = false;
    }
    if (!drag) yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));   // держим угол в [-π, π], иначе он копится за сутки
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.updateMatrixWorld();

    for (const c of cards) {
      tmp.copy(c.v).project(camera);
      const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
      c.el.hidden = !vis || compassOn.checked;
      if (vis) c.el.style.transform = `translate(${(tmp.x + 1) / 2 * innerWidth - 6}px, ${(1 - tmp.y) / 2 * innerHeight - 22}px)`;
    }

    const alt = Math.asin(Math.max(-1, Math.min(1, s.dir.y))) / DEG;
    skyMat.uniforms.uMarker.value = always.checked ? 1 : 0;
    updatePointer(s.dir, alt);
    drawCompass((Math.PI - yaw) / DEG, ((sunAz / DEG) + 360) % 360, alt);
    renderer.render(scene, camera);
    drawStarLabels(starMat.uniforms.uNight.value);

    updateGlobe(sol);
    gRenderer.render(gScene, gCam);
    updateGlobeSunMark();

    if (now - hudTick > 100) {
      hudTick = now;
      // местное время наблюдателя: пояс по долготе (15° = 1 час)
      const zone = zoneH();
      const local = mod(todUtc + zone * 3.6e6, DAY);
      $('clock').textContent = fmtTime.format(new Date(local));
      if (!todActive) todIn.value = Math.floor(local / 60000);
      paintTodTrack(sol);
      updDaylen();
      syncDoy();
      $('zone').textContent = 'UTC' + (zone >= 0 ? '+' : '−') + Math.abs(zone);
      let az = Math.atan2(-s.dir.x, s.dir.z) / DEG; if (az < 0) az += 360;
      $('alt').textContent = alt.toFixed(1) + '°';
      $('az').textContent = az.toFixed(0) + '°';
      const shown = speed < 9.95 ? num(speed.toFixed(1).replace('.0', '')) : fmtNum.format(Math.round(speed));
      $('mult').innerHTML = '×' + shown +
        '<small>' + t(paused ? 'paused' : target === 1 && speed === 1 ? 'realtime' : 'accel') + '</small>';
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // смена языка: форматы, подписи, которые строятся один раз, и немедленное обновление HUD
  I18N.onChange(() => {
    makeFormats();
    placeTicks(); placeMonths();
    $('pauseText').textContent = t(paused ? 'inPause' : 'playing');
    cards.forEach((c, i) => { c.el.textContent = t('cardinals')[i]; });
    placeObserver();
    hudTick = 0;
  });
})();
