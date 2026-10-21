// Две панели поверх неба: выбор обсерватории вместо клика по глобусу и окно поиска звёзд.
// Обе получают всё нужное через ctx, внутренностей app.js не знают.

// ---------- меню обсерваторий ----------
function initObservatoryMenu(ctx) {
  const { t } = I18N;
  const btn = document.getElementById('obsBtn'), menu = document.getElementById('obsMenu');
  const fmt = (v, pos, neg) => Math.abs(v).toFixed(2) + '° ' + (v >= 0 ? pos : neg);
  const idx = () => I18N.lang === 'ru' ? 1 : 0;

  function render() {
    menu.innerHTML = '';
    OBSERVATORIES.forEach((o, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option'); li.dataset.idx = i;
      const lat = t('lat'), lon = t('lon');
      li.innerHTML = '<b></b><span></span>';
      li.firstChild.textContent = o.name[idx()];
      li.lastChild.textContent = o.city[idx()] + ' · ' + fmt(o.lat, lat[0], lat[1]) + ' ' + fmt(o.lon, lon[0], lon[1]);
      menu.appendChild(li);
    });
  }
  function place() {
    const r = btn.getBoundingClientRect();
    const w = Math.min(380, innerWidth - 16);
    menu.style.width = w + 'px';
    menu.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
    const room = innerHeight - r.bottom - 12, above = r.top - 12;
    // открываем вниз; если места мало, то вверх
    if (room >= 240 || room >= above) { menu.style.top = r.bottom + 6 + 'px'; menu.style.bottom = 'auto'; menu.style.maxHeight = Math.max(160, room) + 'px'; }
    else { menu.style.bottom = innerHeight - r.top + 6 + 'px'; menu.style.top = 'auto'; menu.style.maxHeight = Math.max(160, above) + 'px'; }
  }
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (!menu.hidden) { close(); return; }
    menu.hidden = false; place(); btn.setAttribute('aria-expanded', 'true');
    const cur = menu.querySelector('[aria-selected="true"]'); if (cur) cur.scrollIntoView({ block: 'nearest' });
  });
  menu.addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    ctx.pick(+li.dataset.idx); close();
  });
  document.addEventListener('click', e => { if (!menu.contains(e.target) && !btn.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  addEventListener('resize', () => { if (!menu.hidden) place(); });
  I18N.onChange(render);
  render();

  // правая кнопка: копировать координаты или открыть точку в Google Картах
  const ctxMenu = document.getElementById('obsCtx'), copyText = document.getElementById('ctxCopyText');
  const closeCtx = () => { ctxMenu.hidden = true; };
  const here = () => { const o = ctx.coords(); return o.lat.toFixed(5) + ', ' + o.lon.toFixed(5); };
  btn.addEventListener('contextmenu', e => {
    e.preventDefault(); close();
    copyText.textContent = t('copyCoords');
    ctxMenu.hidden = false;
    const w = ctxMenu.offsetWidth, h = ctxMenu.offsetHeight;
    ctxMenu.style.left = Math.max(8, Math.min(innerWidth - w - 8, e.clientX)) + 'px';
    ctxMenu.style.top = Math.max(8, Math.min(innerHeight - h - 8, e.clientY)) + 'px';
  });
  document.getElementById('ctxMaps').addEventListener('click', () => {
    window.open('https://www.google.com/maps?q=' + encodeURIComponent(here()), '_blank', 'noopener');
    closeCtx();
  });
  document.getElementById('ctxCopy').addEventListener('click', async () => {
    const text = here();
    try { await navigator.clipboard.writeText(text); }
    catch (err) {                                   // file:// и старые браузеры: запасной путь через скрытое поле
      const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e2) {} ta.remove();
    }
    copyText.textContent = t('copied');
    setTimeout(closeCtx, 700);
  });
  document.addEventListener('pointerdown', e => { if (!ctxMenu.contains(e.target)) closeCtx(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCtx(); });
  addEventListener('blur', closeCtx);
  addEventListener('resize', closeCtx);

  return {
    // выделяем в списке текущую обсерваторию
    select(i) { menu.querySelectorAll('li').forEach(li => li.setAttribute('aria-selected', String(+li.dataset.idx === i))); },
  };
}

// ---------- окно поиска звёзд ----------
function initStarSearch(ctx) {
  const { t, num } = I18N;
  const modal = document.getElementById('starModal'), input = document.getElementById('starQuery');
  const tbody = document.querySelector('#starTable tbody'), openBtn = document.getElementById('starSearchBtn');
  const empty = document.getElementById('starEmpty');
  const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const rows = [];
  let timer = 0;

  function build() {
    tbody.innerHTML = '';
    rows.length = 0;
    const ru = I18N.lang === 'ru';
    for (const s of STAR_NAMES) {
      const [i, en, rus, con, spect, ly, lum] = s;
      const conN = con && CONSTELLATIONS[con] ? CONSTELLATIONS[con] : [con || '', con || ''];
      const tr = document.createElement('tr');
      tr.dataset.idx = i;
      tr.innerHTML = '<td class="c-name"><b></b><small></small></td><td class="c-lamp"><i class="lamp"></i></td><td class="c-pos"></td>' +
        '<td class="c-num c-mag"></td><td class="c-num c-lum"></td><td class="c-num c-dist opt"></td><td class="c-con opt"><span></span><small></small></td>';
      tr.querySelector('b').textContent = ru ? rus : en;
      tr.querySelector('small').textContent = ru ? (rus !== en ? en : '') : (rus !== en ? rus : '');
      tr.querySelector('.c-mag').textContent = num(ctx.mag(i).toFixed(2));
      tr.querySelector('.c-lum').textContent = lum == null ? '—' : fmtLum(lum);
      tr.querySelector('.c-dist').textContent = ly == null ? '—' : fmtDist(ly);
      tr.querySelector('.c-con span').textContent = conN[ru ? 1 : 0];
      tr.querySelector('.c-con small').textContent = spect || '';
      tr._hay = norm([en, rus, conN[0], conN[1], con, spect].join(' '));
      tbody.appendChild(tr);
      rows.push(tr);
    }
    filter();
    refresh();
  }
  function fmtLum(v) {
    return v >= 100 ? new Intl.NumberFormat(t('locale')).format(Math.round(v)) : num(v >= 10 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, ''));
  }
  const fmtDist = ly => new Intl.NumberFormat(t('locale'), { maximumFractionDigits: ly < 100 ? 1 : 0 }).format(ly) + ' ' + t('lyUnit');

  // видна ли звезда сейчас: над горизонтом и небо достаточно тёмное
  const v = new THREE.Vector3();
  function refresh() {
    const night = ctx.night();
    for (const tr of rows) {
      if (tr.hidden) continue;
      ctx.world(+tr.dataset.idx, v);
      const alt = Math.asin(v.y / v.length()) / (Math.PI / 180);
      let az = Math.atan2(-v.x, v.z) / (Math.PI / 180); if (az < 0) az += 360;
      const visible = alt > 1 && night > 0.4;
      tr.querySelector('.lamp').classList.toggle('on', visible);
      tr.title = t(visible ? 'visibleNow' : (alt > 0 ? 'tooBright' : 'belowHorizon'));
      tr.querySelector('.c-pos').textContent = visible ? t('alt') + ' ' + num(alt.toFixed(1)) + '° · ' + t('az') + ' ' + az.toFixed(0) + '°' : '—';
    }
  }
  function filter() {
    const q = norm(input.value).trim().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const tr of rows) { const ok = q.every(w => tr._hay.includes(w)); tr.hidden = !ok; if (ok) shown++; }
    empty.hidden = shown > 0;
  }

  function open() {
    modal.hidden = false;
    refresh();
    clearInterval(timer); timer = setInterval(refresh, 500);
    input.focus(); input.select();
  }
  function close() { modal.hidden = true; clearInterval(timer); }
  openBtn.addEventListener('click', open);
  document.getElementById('starClose').addEventListener('click', close);
  modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });
  input.addEventListener('input', () => { filter(); refresh(); });
  tbody.addEventListener('click', e => {
    const tr = e.target.closest('tr'); if (!tr) return;
    close(); ctx.focus(+tr.dataset.idx);
  });
  I18N.onChange(build);
  build();
}

// ---------- выбор года ----------
function initYearMenu(ctx) {
  const btn = document.getElementById('yearBtn'), menu = document.getElementById('yearMenu'), text = document.getElementById('yearText');
  const FROM = 1900, TO = 2100;
  for (let y = FROM; y <= TO; y++) {
    const li = document.createElement('li'); li.setAttribute('role', 'option'); li.dataset.year = y; li.textContent = y; menu.appendChild(li);
  }
  const mark = () => {
    text.textContent = ctx.get();
    menu.querySelectorAll('li').forEach(li => li.setAttribute('aria-selected', String(+li.dataset.year === ctx.get())));
  };
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  function place() {
    const r = btn.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(innerWidth - 108, r.left)) + 'px';
    const room = innerHeight - r.bottom - 12, above = r.top - 12;
    if (room >= 220 || room >= above) { menu.style.top = r.bottom + 6 + 'px'; menu.style.bottom = 'auto'; menu.style.maxHeight = Math.min(300, Math.max(140, room)) + 'px'; }
    else { menu.style.bottom = innerHeight - r.top + 6 + 'px'; menu.style.top = 'auto'; menu.style.maxHeight = Math.min(300, Math.max(140, above)) + 'px'; }
  }
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (!menu.hidden) { close(); return; }
    menu.hidden = false; place(); btn.setAttribute('aria-expanded', 'true');
    const cur = menu.querySelector('[aria-selected="true"]'); if (cur) menu.scrollTop = cur.offsetTop - menu.clientHeight / 2 + cur.offsetHeight / 2;
  });
  menu.addEventListener('click', e => { const li = e.target.closest('li'); if (!li) return; ctx.set(+li.dataset.year); mark(); close(); });
  document.addEventListener('click', e => { if (!menu.contains(e.target) && !btn.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  addEventListener('resize', () => { if (!menu.hidden) place(); });
  mark();
}
