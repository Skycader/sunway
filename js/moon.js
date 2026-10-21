// Луна: текстура, материал с фазой и ориентацией диска. Положение считает js/astro.js, сцену собирает app.js.
const MoonKit = (() => {
  function texture() {
    const t = new THREE.Texture();
    t.anisotropy = 8;
    const img = new Image();
    img.onload = () => { t.image = img; t.needsUpdate = true; };
    img.src = MOON_JPG;
    return t;
  }

  // Освещение по закону Ломмеля — Зеелигера (у Луны нет потемнения к краю, как у шара с законом Ламберта),
  // мягкий терминатор, пепельный свет, атмосферное покраснение у горизонта и бледность на дневном небе.
  function material(tex) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uTex: { value: tex }, uSunObj: { value: new THREE.Vector3(1, 0, 0) },
        uEarthshine: { value: 0.05 }, uDay: { value: 0 }, uDetail: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: 1.15 },
      },
      vertexShader: `
        varying vec3 vN;
        void main(){ vN = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D uTex; uniform vec3 uSunObj; uniform vec3 uTint;
        uniform float uEarthshine; uniform float uDay; uniform float uGain; uniform float uDetail;
        varying vec3 vN;
        float h3(vec3 p){ p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float vnoise(vec3 x){
          vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        void main(){
          vec3 n = normalize(vN);
          // +Z — на Землю, +Y — к северу; долгота 0 в центре карты, на восток вправо
          vec2 uv = vec2(atan(n.x, n.z) / 6.2831853 + 0.5, asin(clamp(n.y, -1.0, 1.0)) / 3.14159265 + 0.5);
          vec3 alb = texture2D(uTex, uv).rgb;
          // при сильном зуме карты не хватает: добавляем мелкую зернистость поверхности (реголит) и «кратерные» пятна
          if (uDetail > 0.0) {
            float g = vnoise(n * 260.0) * 0.5 + vnoise(n * 620.0) * 0.3 + vnoise(n * 1500.0) * 0.2;
            float b = vnoise(n * 90.0);
            alb *= 1.0 + uDetail * ((g - 0.5) * 0.7 + (b - 0.5) * 0.35);
          }
          float mu0 = dot(n, uSunObj), mu = max(n.z, 0.0);
          float lit = max(mu0, 0.0) / (max(mu0, 0.0) + mu + 0.03) * 2.0;
          float term = smoothstep(-0.03, 0.14, mu0);
          vec3 col = alb * lit * term * uGain;
          col += alb * vec3(0.55, 0.68, 1.0) * uEarthshine * (1.0 - term);      // пепельный свет
          col *= uTint;
          col = mix(col, vec3(dot(col, vec3(0.333))), 0.35 * uDay);
          gl_FragColor = vec4(col, 1.0 - 0.38 * uDay);
        }`
    });
  }

  // кватернион диска в системе звёздной сферы: +Z на Землю (в начало координат), +Y к небесному северу
  const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3(), m = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
  function orient(pos, outQ) {
    z.copy(pos).negate().normalize();
    x.copy(up).cross(z).normalize();
    y.copy(z).cross(x);
    return outQ.setFromRotationMatrix(m.makeBasis(x, y, z));
  }

  const phaseKey = (illum, waxing) => illum < 0.03 ? 'new' : illum > 0.97 ? 'full'
    : illum < 0.4 ? (waxing ? 'wc' : 'lc') : illum < 0.6 ? (waxing ? 'fq' : 'lq') : (waxing ? 'wg' : 'lg');

  return { texture, material, orient, phaseKey };
})();
