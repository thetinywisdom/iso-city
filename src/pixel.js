import * as THREE from 'three';
import { COMIC } from './palette.js';

// ---------------------------------------------------------------------------
// 3D pixel-art pipeline (t3ssel8r-style)
//  1. scene -> low-res colour target (+ depth texture), toon materials
//  2. scene -> low-res view-space normal target (override material)
//  3. post pass at low res: depth/normal edge outlines, convex-edge highlight,
//     nearest-colour quantisation to the Comic palette (OKLab), optional Bayer
//  4. nearest-neighbour upscale to the canvas, with sub-pixel compensation for
//     the grid-snapped camera so pixels never swim while the camera glides.
// ---------------------------------------------------------------------------

// Palette exception: the two watermelon greens are used ONLY by SYOYA's pool-ring prop
// (characters.js watermelonRing). Everything else in the scene stays on the Comic palette.
export const PROP_GREENS = ['#4DBA5A', '#1F6B35'];
export const PALETTE_HEX = [...Object.values(COMIC).flat(), ...PROP_GREENS];

function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

const N = PALETTE_HEX.length;
const PAL_SRGB = PALETTE_HEX.map((h) => new THREE.Vector3(...hexRGB(h)));
const PAL_LAB = PALETTE_HEX.map((h) => new THREE.Vector3(...oklab(hexRGB(h).map(srgbToLinear))));

const FS_VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const POST_FRAG = /* glsl */`
precision highp float;
#define NPAL ${N}
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tNormal;
uniform vec2 uRes; uniform float uNear; uniform float uFar;
uniform float uDepthThr; uniform float uNormalThr; uniform float uHighlight;
uniform vec3 uOutline; uniform float uOutlineMix;
uniform bool uOutlines; uniform bool uQuant; uniform bool uDither; uniform float uDitherAmt;
uniform int uDebug;
uniform vec3 uPal[NPAL]; uniform vec3 uPalLab[NPAL];
varying vec2 vUv;

float linDepth(float d){ return d >= 0.99999 ? uFar * 4.0 : uNear + d * (uFar - uNear); } // orthographic: linear
vec3 lin2srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
vec3 oklab(vec3 c){
  float l = 0.4122214708*c.r + 0.5363325363*c.g + 0.0514459929*c.b;
  float m = 0.2119034982*c.r + 0.6806995451*c.g + 0.1073969566*c.b;
  float s = 0.0883024619*c.r + 0.2817188376*c.g + 0.6299787005*c.b;
  l = pow(max(l, 0.0), 1.0/3.0); m = pow(max(m, 0.0), 1.0/3.0); s = pow(max(s, 0.0), 1.0/3.0);
  return vec3(0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
              1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
              0.0259040371*l + 0.7827717662*m - 0.8086757660*s);
}
float bayer4(vec2 p){
  int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0)); int i = x + y * 4;
  float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
  m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
  float v = 0.0; for (int k = 0; k < 16; k++) if (k == i) v = m[k];
  return (v + 0.5) / 16.0;
}
void neighbour(vec2 o, float d, vec3 n, inout float depthEdge, inout float normalEdge){
  vec2 uv = vUv + o / uRes;
  float nd = linDepth(texture2D(tDepth, uv).r);
  float diff = nd - d;                       // > 0: neighbour is farther away
  if (diff > uDepthThr) depthEdge = 1.0;     // we are the near side of a silhouette
  vec4 nt = texture2D(tNormal, uv);
  if (nt.a > 0.5) {
    vec3 nn = nt.rgb * 2.0 - 1.0;
    float nDiff = dot(n - nn, vec3(1.0, 1.0, 1.0));            // bias: one side only
    float nInd = smoothstep(-0.01, 0.01, nDiff);
    float dInd = step(-uDepthThr * 0.5, diff);                  // neighbour not in front
    normalEdge += distance(n, nn) * nInd * dInd;
  }
}
void main(){
  vec3 col = texture2D(tColor, vUv).rgb;   // linear
  float d0 = texture2D(tDepth, vUv).r;
  if (uOutlines && d0 < 0.99999) {
    float d = linDepth(d0);
    vec4 nt = texture2D(tNormal, vUv);
    vec3 n = nt.rgb * 2.0 - 1.0;
    float de = 0.0, ne = 0.0;
    neighbour(vec2( 1.0, 0.0), d, n, de, ne);
    neighbour(vec2(-1.0, 0.0), d, n, de, ne);
    neighbour(vec2( 0.0, 1.0), d, n, de, ne);
    neighbour(vec2( 0.0,-1.0), d, n, de, ne);
    if (uDebug == 3) { gl_FragColor = vec4(de, min(ne, 1.0), uDepthThr, 1.0); return; }
    if (de > 0.5) col = mix(col, uOutline, uOutlineMix);
    else if (nt.a > 0.5 && ne > uNormalThr) col = min(col * (1.0 + uHighlight) + 0.02, vec3(1.0));
  }
  if (uDebug == 1) { gl_FragColor = vec4(vec3(clamp((linDepth(d0) - 120.0) / 80.0, 0.0, 1.0)), 1.0); return; }
  if (uDebug == 2) { gl_FragColor = texture2D(tNormal, vUv); return; }
  if (!uQuant) { gl_FragColor = vec4(lin2srgb(clamp(col, 0.0, 1.0)), 1.0); return; }
  vec3 lab = oklab(col);
  if (uDither) lab.x += (bayer4(gl_FragCoord.xy) - 0.5) * uDitherAmt;
  float best = 1e9; vec3 outc = uPal[0];
  for (int i = 0; i < NPAL; i++) {
    vec3 dl = lab - uPalLab[i];
    dl.yz *= 1.4;                           // keep hue families together
    float dd = dot(dl, dl);
    if (dd < best) { best = dd; outc = uPal[i]; }
  }
  gl_FragColor = vec4(outc, 1.0);           // exact palette sRGB values
}`;

const UP_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tSrc; uniform vec2 uLow; uniform vec2 uVis; uniform vec2 uOffset;
varying vec2 vUv;
void main(){
  vec2 p = vUv * uVis + (uLow - uVis) * 0.5 + uOffset;
  gl_FragColor = texture2D(tSrc, p / uLow);
}`;

// ---------------------------------------------------------------------------
// Palette-ramp toon shading. Every lit fragment is snapped to one of three tones
// picked by hand from the Comic palette for its base colour, the way a pixel
// artist shades: [sunlit / top, shaded side, cast shadow]. Hue stays inside a
// family (with a little hue-shift for light tints) instead of drifting.
// ---------------------------------------------------------------------------
//            base        shaded side  cast shadow / dark
export const RAMPS = {
  '#203A57': ['#203A57', '#292C2E'], '#2A5B94': ['#203A57', '#203A57'], '#3B7EE1': ['#2A5B94', '#2A5B94'],
  '#B0E9FF': ['#3B7EE1', '#3B7EE1'], '#DBF5FE': ['#B0E9FF', '#B0E9FF'],
  '#A92D59': ['#4C3F42', '#4C3F42'], '#FF5491': ['#A92D59', '#A92D59'], '#FF7DAF': ['#FF5491', '#FF5491'],
  '#F8C0C5': ['#DF9E89', '#DF9E89'], '#F9F0F1': ['#F8C0C5', '#F8C0C5'],
  '#194A4C': ['#292C2E', '#292C2E'], '#198085': ['#194A4C', '#194A4C'], '#00B4BC': ['#198085', '#198085'],
  '#A8ECF2': ['#B0E9FF', '#00B4BC'], '#EFFAFA': ['#A8ECF2', '#A8ECF2'],
  '#4C3F42': ['#292C2E', '#292C2E'], '#93616B': ['#4C3F42', '#4C3F42'], '#DF9E89': ['#93616B', '#93616B'],
  '#F1CDC3': ['#DF9E89', '#DF9E89'], '#FCF0ED': ['#F1CDC3', '#F1CDC3'],
  '#292C2E': ['#292C2E', '#292C2E'], '#363E47': ['#292C2E', '#292C2E'], '#5B6A7B': ['#363E47', '#363E47'],
  '#A7BFA4': ['#5B6A7B', '#5B6A7B'], '#F0F2F4': ['#DBF5FE', '#DBF5FE'],
  '#ED8F02': ['#93616B', '#93616B'], '#FFCC3F': ['#ED8F02', '#ED8F02'], '#FFE166': ['#FFCC3F', '#FFCC3F'],
  '#FFF3C1': ['#FFE166', '#FFCC3F'], '#FCF9EB': ['#FFF3C1', '#FFF3C1'],
};
// Off-palette colours used by the character module, mapped onto palette ramps.
export const ALIASES = { '#B6C2CA': ['#DBF5FE', '#B0E9FF', '#B0E9FF'], '#ED612B': ['#ED8F02', '#93616B', '#93616B'],
  '#4DBA5A': ['#4DBA5A', '#1F6B35', '#1F6B35'], '#1F6B35': ['#1F6B35', '#194A4C', '#194A4C'] };   // prop-only greens (see PROP_GREENS)

const MATCH = [], OUT0 = [], OUT1 = [], OUT2 = [];
for (const [h, [m, d]] of Object.entries(RAMPS)) { MATCH.push(h); OUT0.push(h); OUT1.push(m); OUT2.push(d); }
for (const [h, [b, m, d]] of Object.entries(ALIASES)) { MATCH.push(h); OUT0.push(b); OUT1.push(m); OUT2.push(d); }
const col = (h) => new THREE.Color(h); // linear working space
export const rampUniforms = {
  uMatch: { value: MATCH.map(col) }, uOut0: { value: OUT0.map(col) }, uOut1: { value: OUT1.map(col) }, uOut2: { value: OUT2.map(col) },
  uSunI: { value: 1.4 }, uTopThr: { value: 0.6 }, uSideThr: { value: 0.2 },
};
const NR = MATCH.length;
const RAMP_CHUNK = /* glsl */`
{
  vec3 base = diffuseColor.rgb;
  vec3 o0 = vO0, o1 = vO1, o2 = vO2;   // ramp resolved per vertex (flat)
  float lb = max(dot(base, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
  float sun = dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722)) / (lb * uSunI * RECIPROCAL_PI);
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float up = dot(normalize(normal), upV);
  vec3 tone;
  if (up > 0.7) tone = sun > uTopThr ? o0 : o2;          // ground / roofs: lit or in cast shadow
  else tone = sun > uSideThr ? o0 : (up < -0.3 ? o2 : o1); // walls: sunlit side or shaded side
  outgoingLight = tone;
}
#include <opaque_fragment>`;

function rampMaterial(m) {
  const r = m.clone();
  r.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, rampUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', `uniform vec3 diffuse; uniform vec3 uMatch[${NR}]; uniform vec3 uOut0[${NR}]; uniform vec3 uOut1[${NR}]; uniform vec3 uOut2[${NR}];
flat varying vec3 vO0; flat varying vec3 vO1; flat varying vec3 vO2;
void main() {`)
      .replace('#include <color_vertex>', `#include <color_vertex>
  {
    vec3 base = diffuse;
    #if defined( USE_COLOR )
      base *= color.rgb;
    #endif
    float best = 1e9; int bi = 0;
    for (int i = 0; i < ${NR}; i++) { vec3 d = base - uMatch[i]; float dd = dot(d, d); if (dd < best) { best = dd; bi = i; } }
    vO0 = uOut0[bi]; vO1 = uOut1[bi]; vO2 = uOut2[bi];
  }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `flat varying vec3 vO0; flat varying vec3 vO1; flat varying vec3 vO2;\nuniform float uSunI; uniform float uTopThr; uniform float uSideThr;\nvoid main() {`)
      .replace('#include <opaque_fragment>', RAMP_CHUNK);
  };
  r.customProgramCacheKey = () => 'pixelRamp';
  r.userData.orig = m;
  return r;
}

export class PixelPipeline {
  constructor(renderer, opts = {}) {
    this.renderer = renderer;
    this.enabled = opts.enabled ?? true;
    this.scale = opts.scale ?? 3;
    this.minScale = 1; this.maxScale = 8;
    this.toonCache = new WeakMap();
    this._toonRoots = new Set();

    const rt = (depth) => {
      const t = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
      if (depth) { t.depthTexture = new THREE.DepthTexture(4, 4); t.depthTexture.type = THREE.UnsignedIntType;
        t.depthTexture.minFilter = t.depthTexture.magFilter = THREE.NearestFilter; }
      return t;
    };
    this.colorRT = rt(true); this.normalRT = rt(false); this.quantRT = rt(false);
    this.normalMat = new THREE.MeshNormalMaterial({ flatShading: true });

    this.postMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: this.colorRT.texture }, tDepth: { value: this.colorRT.depthTexture }, tNormal: { value: this.normalRT.texture },
        uRes: { value: new THREE.Vector2() }, uNear: { value: 1 }, uFar: { value: 600 },
        uDepthThr: { value: 0.2 }, uNormalThr: { value: opts.normalThr ?? 0.45 }, uHighlight: { value: opts.highlight ?? 0.18 },
        uOutline: { value: new THREE.Color(opts.outline ?? '#292C2E') }, uOutlineMix: { value: opts.outlineMix ?? 0.85 },
        uOutlines: { value: true }, uQuant: { value: true }, uDither: { value: false }, uDitherAmt: { value: 0.06 },
        uDebug: { value: 0 }, uPal: { value: PAL_SRGB }, uPalLab: { value: PAL_LAB },
      },
    });
    this.upMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: UP_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: this.quantRT.texture }, uLow: { value: new THREE.Vector2() }, uVis: { value: new THREE.Vector2() }, uOffset: { value: new THREE.Vector2() } },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene(); this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.depthThrPx = opts.depthThrPx ?? 3.0;   // silhouette threshold, in low-res pixels of world depth
    this._right = new THREE.Vector3(); this._up = new THREE.Vector3();
    this.setSize(window.innerWidth, window.innerHeight);
  }

  get outlines() { return this.postMat.uniforms.uOutlines.value; }
  set outlines(v) { this.postMat.uniforms.uOutlines.value = v; }
  get dither() { return this.postMat.uniforms.uDither.value; }
  set dither(v) { this.postMat.uniforms.uDither.value = v; }
  get quantize() { return this.postMat.uniforms.uQuant.value; }
  set quantize(v) { this.postMat.uniforms.uQuant.value = v; }

  setSize(w, h) {
    this.width = w; this.height = h;
    this.visW = w / this.scale; this.visH = h / this.scale;
    this.lowW = Math.ceil(this.visW) + 2; this.lowH = Math.ceil(this.visH) + 2;   // 1px margin for sub-pixel shifts
    for (const t of [this.colorRT, this.normalRT, this.quantRT]) t.setSize(this.lowW, this.lowH);
    this.postMat.uniforms.uRes.value.set(this.lowW, this.lowH);
    this.upMat.uniforms.uLow.value.set(this.lowW, this.lowH);
    this.upMat.uniforms.uVis.value.set(this.visW, this.visH);
  }
  setScale(s) { this.scale = THREE.MathUtils.clamp(Math.round(s), this.minScale, this.maxScale); this.setSize(this.width, this.height); }

  // Swap Lambert materials under `root` for palette-ramp toon versions (and back).
  toonify(root, on = this.enabled) {
    this._toonRoots.add(root);
    root.traverse((o) => {
      if (!o.isMesh || o.userData.isGhost) return;
      const swap = (m) => {
        if (on) {
          if (!m.isMeshLambertMaterial || m.userData.orig) return m;
          let t = this.toonCache.get(m);
          if (!t) { t = rampMaterial(m); this.toonCache.set(m, t); }
          return t;
        }
        return m.userData.orig || m;
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
  }
  setEnabled(v) { this.enabled = v; for (const r of this._toonRoots) this.toonify(r, v); }

  // Place an orthographic camera (iso offset from target), size its frustum and,
  // in pixel mode, snap it to the low-res texel grid. Returns world size of one low-res pixel.
  placeCamera(camera, target, offset, viewHeight) {
    const aspect = this.width / this.height;
    camera.zoom = 1;
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    if (!this.enabled) {
      camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2;
      camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      return viewHeight / this.height;
    }
    const pw = viewHeight / this.visH;
    camera.left = -this.lowW * pw / 2; camera.right = this.lowW * pw / 2;
    camera.top = this.lowH * pw / 2; camera.bottom = -this.lowH * pw / 2;
    camera.updateProjectionMatrix();
    const e = camera.matrixWorld.elements;
    this._right.set(e[0], e[1], e[2]); this._up.set(e[4], e[5], e[6]);
    const r = camera.position.dot(this._right), u = camera.position.dot(this._up);
    const dr = r - Math.round(r / pw) * pw, du = u - Math.round(u / pw) * pw;
    camera.position.addScaledVector(this._right, -dr).addScaledVector(this._up, -du);
    camera.updateMatrixWorld();
    this.upMat.uniforms.uOffset.value.set(dr / pw, du / pw);
    this.pixelWorld = pw;
    return pw;
  }

  render(scene, camera) {
    const r = this.renderer;
    if (!this.enabled) { r.setRenderTarget(null); r.render(scene, camera); return; }
    const U = this.postMat.uniforms;
    U.uNear.value = camera.near; U.uFar.value = camera.far;
    U.uDepthThr.value = this.pixelWorld * this.depthThrPx;

    const autoShadow = r.shadowMap.autoUpdate;
    r.setRenderTarget(this.colorRT); r.render(scene, camera);

    // normals pass (no shadows re-render, no background)
    r.shadowMap.autoUpdate = false;
    const bg = scene.background, fog = scene.fog, ov = scene.overrideMaterial;
    const cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
    scene.background = null; scene.fog = null; scene.overrideMaterial = this.normalMat;
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(this.normalRT); r.render(scene, camera);
    scene.background = bg; scene.fog = fog; scene.overrideMaterial = ov;
    r.setClearColor(cc, ca);
    r.shadowMap.autoUpdate = autoShadow;

    this.quad.material = this.postMat;
    r.setRenderTarget(this.quantRT); r.render(this.quadScene, this.quadCam);
    this.quad.material = this.upMat;
    r.setRenderTarget(null); r.render(this.quadScene, this.quadCam);
  }
}

// Keep a following directional light's shadow map aligned to its own texel grid
// so hard shadow edges don't crawl as the light tracks the player.
const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
export function placeSnappedSun(sun, target, offset) {
  const cam = sun.shadow.camera;
  const texel = (cam.right - cam.left) / sun.shadow.mapSize.x;
  const dir = offset.clone().normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
  const up = dir.clone().cross(right).normalize();
  _v.copy(target);
  const a = _v.dot(right), b = _v.dot(up);
  _v.addScaledVector(right, Math.round(a / texel) * texel - a).addScaledVector(up, Math.round(b / texel) * texel - b);
  sun.target.position.copy(_v);
  sun.position.copy(_v).add(offset);
  sun.target.updateMatrixWorld();
}
