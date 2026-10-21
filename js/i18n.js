// Локализация: ru / en. Статический текст — по data-i / data-i-aria, динамический — через I18N.t(ключ).
const I18N = (() => {
  const DICT = {
    ru: {
      locale: 'ru-RU', decimal: ',',
      title: 'Небосвод', language: 'Язык',
      localTime: 'местное время', sunAlt: 'Высота солнца', azimuth: 'Азимут', timeOfDay: 'Время суток',
      orbitView: 'Вид с орбиты', sun: 'Солнце', observer: 'Наблюдатель', dayOfYear: 'День года',
      winter: 'зима', spring: 'весна', summer: 'лето', autumn: 'осень',
      playing: 'Идёт время', inPause: 'На паузе', always: 'Маркер Солнца', follow: 'Следовать', followSunTip: 'Следовать за Солнцем: камера всегда смотрит на него', 
      compass: 'Компас', starLabels: 'Подписывать звёзды', smooth: 'Плавное ускорение',
      speedLabel: 'Скорость времени',
      searchStars: 'Искать звёзды', searchPlaceholder: 'Название звезды или созвездия…', pickObservatory: 'Выбрать обсерваторию', close: 'Закрыть',
      colStar: 'Звезда', colStatus: 'Видна', colPos: 'Положение', colMag: 'Блеск, m', colLum: 'Светимость, L☉', colDist: 'Расстояние', colCon: 'Созвездие · класс',
      visibleNow: 'Сейчас видна на небе', tooBright: 'Над горизонтом, но небо слишком светлое', belowHorizon: 'Под горизонтом',
      now: 'Сейчас', nowTip: 'Выставить настоящие дату и время', declTip: 'δ — склонение Солнца: на сколько градусов Солнце севернее (+) или южнее (−) небесного экватора. Это и есть смена сезонов: от −23,4° в день зимнего солнцестояния до +23,4° летом. При δ = 0° (равноденствие) Солнце в полдень стоит в зените на экваторе.', settings: 'Настройки',
      mObjects: { house: 'Хрущёвка', tree: 'Дерево', car: 'Автомобиль', road: 'Дорога', sidewalk: 'Тротуар', path: 'Тропинка', lamp: 'Фонарь', ground: 'Земля', mountain: 'Гора', tower: 'Телевышка', sun: 'Солнце', moon: 'Луна', star: 'Звезда', none: 'Ничего не нашлось' },
      mUnit: 'м', kmUnit: 'км', mlnKm: 'млн км', trlKm: 'трлн км', mLight: 'свет идёт', mEarthR: 'радиуса Земли', mAU: 'а.е.', mNoData: 'нет данных в каталоге', mMag: 'блеск', mYears: 'лет', mApprox: 'условный масштаб', zoomLabel: 'Масштаб', zoomFov: 'поле зрения', camera: 'Камера', segFree: 'Свободно', tipFree: 'Камера сама никуда не наводится: смотрите куда угодно.', tipAlways: 'Если Солнце ушло за горизонт, на небе остаётся бледная метка — кольцо с точкой в том месте, где оно сейчас. Так видно, с какой стороны и насколько глубоко оно под землёй, и где появится утром.',
      tipMoon: 'Показывает Луну на небе и на мини-карте. Её свет ложится на землю, а яркая Луна приглушает звёзды и Млечный Путь. Значок рядом — фаза и освещённая доля диска.',
      tipLabels: 'Подписывает яркие звёзды названиями. Подписи появляются ночью при приближении: чем сильнее зум (колесо мыши), тем больше звёзд подписано.',
      tipSearch: 'Список подписанных звёзд с поиском. Нажми на строку — камера плавно наведётся на звезду.',
      tipCompass: 'Лента с направлением взгляда в верхней части экрана: стороны света и градусы. Её можно тянуть мышкой — обзор вращается быстрее, чем при перетаскивании неба.',
      tipSmooth: 'Время разгоняется и тормозит плавно, а не рывком, когда двигаешь ползунок скорости.',
      showMoon: 'Показывать Луну', focus: 'Следовать', moonLabel: 'Луна', focusMoonTip: 'Следовать за Луной: камера наводится на неё и держит в центре', pickYear: 'Выбрать год',
      moonPhases: { new: 'Новолуние', wc: 'Растущий серп', fq: 'Первая четверть', wg: 'Растущая Луна', full: 'Полнолуние', lg: 'Убывающая Луна', lq: 'Последняя четверть', lc: 'Убывающий серп' },
      copyCoords: 'Скопировать координаты', openMaps: 'Открыть в Google Картах', copied: 'Скопировано ✓',
      alt: 'выс.', az: 'аз.', nothingFound: 'Ничего не найдено', lyUnit: 'св. лет',
      realtime: 'реальное время', paused: 'пауза', accel: 'ускорение',
      unitS: 'с', unitH: 'ч', unitMin: 'мин',
      dayIn: n => 'сутки за ' + n, polarNight: 'полярная ночь', polarDay: 'полярный день',
      daylightIn: n => 'световой день за ' + n,
      zoom: 'зум', weight: n => 'вес 70 кг → ' + n + ' кг', weightless: 'НЕВЕСОМОСТЬ / РАЗРУШЕНИЕ ПЛАНЕТЫ',
      zoomTip: 'Зум ×1 — поле зрения человека, 120° по длинной стороне экрана.\n' +
        'Первое число в скобках — текущий угол обзора по длинной стороне экрана.\n' +
        'Второе — видимый размер Солнца с учётом увеличения, в масштабе зума ×1. Реальный — 0,53° (32′), при ×1200 Солнце заполняет почти всё небо (около 160°).',
      weightTip: 'Вес человека массой 70 кг на весах в точке наблюдателя.\n' +
        'Если сутки ускорены в X раз, Земля крутится в X раз быстрее, и центробежная сила растёт как X².\n' +
        'При ×1 учтены сплюснутость Земли и реальное вращение: полюс ≈ 70,18 кг, 50° ≈ 70,04 кг, экватор ≈ 69,81 кг.\n' +
        'На экваторе невесомость наступает около ×17, на 50° — около ×26. На полюсе вес от ускорения не зависит.',
      tickMin: 'минута в секунду', tickHour: 'час в секунду',
      months: 'ЯФМАМИИАСОНД',
      lat: ['с.ш.', 'ю.ш.'], lon: ['в.д.', 'з.д.'],
      cardinals: ['С', 'В', 'Ю', 'З'],
      names: { 0: 'Север', 90: 'Восток', 180: 'Юг', 270: 'Запад' },
      inter: { 45: 'СВ', 135: 'ЮВ', 225: 'ЮЗ', 315: 'СЗ' },
      rumb: ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'],
      sunPtr: 'солнце',
    },
    en: {
      locale: 'en-GB', decimal: '.',
      title: 'Firmament', language: 'Language',
      localTime: 'local time', sunAlt: 'Sun altitude', azimuth: 'Azimuth', timeOfDay: 'Time of day',
      orbitView: 'Orbit view', sun: 'Sun', observer: 'Observer', dayOfYear: 'Day of year',
      winter: 'winter', spring: 'spring', summer: 'summer', autumn: 'autumn',
      playing: 'Playing', inPause: 'In Pause', always: 'Sun marker', follow: 'Follow', followSunTip: 'Follow the Sun: the camera keeps it in view', 
      compass: 'Compass', starLabels: 'Label stars', smooth: 'Smooth acceleration',
      speedLabel: 'Time speed',
      searchStars: 'Search stars', searchPlaceholder: 'Star or constellation name…', pickObservatory: 'Choose an observatory', close: 'Close',
      colStar: 'Star', colStatus: 'Seen', colPos: 'Position', colMag: 'Mag', colLum: 'Luminosity, L☉', colDist: 'Distance', colCon: 'Constellation · class',
      visibleNow: 'Visible in the sky now', tooBright: 'Above the horizon, but the sky is too bright', belowHorizon: 'Below the horizon',
      now: 'Now', nowTip: 'Set the real date and time', declTip: 'δ is the Sun’s declination: how many degrees the Sun is north (+) or south (−) of the celestial equator. It drives the seasons: from −23.4° at the winter solstice to +23.4° in summer. At δ = 0° (equinox) the Sun is at the zenith over the equator at noon.', settings: 'Settings',
      mObjects: { house: 'Apartment block', tree: 'Tree', car: 'Car', road: 'Road', sidewalk: 'Sidewalk', path: 'Footpath', lamp: 'Street lamp', ground: 'Ground', mountain: 'Mountain', tower: 'TV tower', sun: 'Sun', moon: 'Moon', star: 'Star', none: 'Nothing here' },
      mUnit: 'm', kmUnit: 'km', mlnKm: 'million km', trlKm: 'trillion km', mLight: 'light takes', mEarthR: 'Earth radii', mAU: 'AU', mNoData: 'not in the catalogue', mMag: 'magnitude', mYears: 'years', mApprox: 'stylised scale', zoomLabel: 'Zoom', zoomFov: 'field of view', camera: 'Camera', segFree: 'Free', tipFree: 'The camera does not track anything: look wherever you like.', tipAlways: 'When the Sun is below the horizon, a faint marker stays in the sky: a ring with a dot where it is right now. It shows which way and how deep it is under the ground, and where it will rise.',
      tipMoon: 'Shows the Moon in the sky and on the mini-map. Its light falls on the ground, and a bright Moon dims the stars and the Milky Way. The icon next to it is the phase and the lit fraction.',
      tipLabels: 'Labels bright stars with their names. Labels appear at night as you zoom in: the stronger the zoom (mouse wheel), the more stars are named.',
      tipSearch: 'A searchable list of named stars. Click a row and the camera smoothly turns to that star.',
      tipCompass: 'The strip at the top shows where you are looking: cardinal points and degrees. Drag it with the mouse to look around faster than dragging the sky.',
      tipSmooth: 'Time speeds up and slows down gradually instead of jumping when you move the speed slider.',
      showMoon: 'Show the Moon', focus: 'Follow', moonLabel: 'Moon', focusMoonTip: 'Follow the Moon: the camera aims at it and keeps it centered', pickYear: 'Choose a year',
      moonPhases: { new: 'New Moon', wc: 'Waxing crescent', fq: 'First quarter', wg: 'Waxing gibbous', full: 'Full Moon', lg: 'Waning gibbous', lq: 'Last quarter', lc: 'Waning crescent' },
      copyCoords: 'Copy coordinates', openMaps: 'Open in Google Maps', copied: 'Copied ✓',
      alt: 'alt', az: 'az', nothingFound: 'Nothing found', lyUnit: 'ly',
      realtime: 'real time', paused: 'paused', accel: 'accelerated',
      unitS: 's', unitH: 'h', unitMin: 'min',
      dayIn: n => 'day in ' + n, polarNight: 'polar night', polarDay: 'polar day',
      daylightIn: n => 'daylight in ' + n,
      zoom: 'zoom', weight: n => '70 kg → ' + n + ' kg', weightless: 'WEIGHTLESSNESS / PLANET BREAKS APART',
      zoomTip: 'Zoom ×1 is the human field of view, 120° along the long side of the screen.\n' +
        'The first number in brackets is the current field of view along the long side of the screen.\n' +
        'The second is the apparent size of the Sun with magnification, at zoom ×1 scale. The real one is 0.53° (32′); at ×1200 the Sun fills almost the whole sky (about 160°).',
      weightTip: 'Weight of a 70 kg person on scales at the observer’s location.\n' +
        'If the day is sped up X times, the Earth spins X times faster and the centrifugal force grows as X².\n' +
        'At ×1 the Earth’s oblateness and real rotation are included: pole ≈ 70.18 kg, 50° ≈ 70.04 kg, equator ≈ 69.81 kg.\n' +
        'At the equator weightlessness sets in around ×17, at 50° around ×26. At the pole weight does not depend on the speed-up.',
      tickMin: 'a minute per second', tickHour: 'an hour per second',
      months: 'JFMAMJJASOND',
      lat: ['N', 'S'], lon: ['E', 'W'],
      cardinals: ['N', 'E', 'S', 'W'],
      names: { 0: 'North', 90: 'East', 180: 'South', 270: 'West' },
      inter: { 45: 'NE', 135: 'SE', 225: 'SW', 315: 'NW' },
      rumb: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
      sunPtr: 'sun',
    },
  };
  const FLAG = { ru: '🇷🇺', en: '🇺🇸' };
  const listeners = [];
  const store = {
    get() { try { return localStorage.getItem('sky.lang'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem('sky.lang', v); } catch (e) {} },
  };
  let lang = store.get();
  if (!DICT[lang]) lang = /^ru|^uk|^be/i.test(navigator.language || '') ? 'ru' : 'en';

  const api = {
    get lang() { return lang; },
    t: k => DICT[lang][k],
    // десятичный разделитель: «1.5» → «1,5» для ru
    num: s => String(s).replace('.', DICT[lang].decimal),
    onChange: cb => listeners.push(cb),
    apply() {
      const d = DICT[lang];
      document.documentElement.lang = lang;
      document.title = d.title;
      document.querySelectorAll('[data-i]').forEach(el => { el.textContent = d[el.dataset.i]; });
      document.querySelectorAll('[data-i-ph]').forEach(el => { el.placeholder = d[el.dataset.iPh]; });
      document.querySelectorAll('[data-i-aria]').forEach(el => {
        const v = d[el.dataset.iAria];
        el.setAttribute('aria-label', v); if (el.tagName === 'BUTTON' && !el.dataset.iTip) el.title = v;
      });
      document.querySelectorAll('[data-i-tip]').forEach(el => { el.dataset.tip = d[el.dataset.iTip]; });
      const flag = document.getElementById('langFlag'); if (flag) flag.textContent = FLAG[lang];
      document.querySelectorAll('#langMenu li').forEach(li => li.setAttribute('aria-selected', li.dataset.lang === lang));
    },
    set(l) {
      if (!DICT[l] || l === lang) return;
      lang = l; store.set(l);
      api.apply();
      listeners.forEach(cb => cb(l));
    },
  };

  function initUi() {
    const box = document.getElementById('lang'), btn = document.getElementById('langBtn'), menu = document.getElementById('langMenu');
    const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', e => {
      e.stopPropagation();
      menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden));
    });
    menu.addEventListener('click', e => {
      const li = e.target.closest('li'); if (!li) return;
      api.set(li.dataset.lang); close();
    });
    document.addEventListener('click', e => { if (!box.contains(e.target)) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    // не отдаём клики по переключателю в перетаскивание/клик по мини-карте
    box.addEventListener('pointerdown', e => e.stopPropagation());
    api.apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUi); else initUi();
  return api;
})();
