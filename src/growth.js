// Story mode: the city grows a little every day of the week (and snaps back on the Day 7 reset: it's a time loop).
// Empty lots fill up with fenced building sites, scaffolding and finally new buildings + a rent billboard.
// Free roam never calls this, so the sandbox city stays exactly as it was.
import * as THREE from 'three';
import { COMIC, SCHEMES, P } from './palette.js?v=20261031z';
import { frontFor, faceFrame } from './facing.js?v=20261031z';

const { blues: B, pinks: K, teals: T, warm: W, neutrals: N, yellows: Y } = COMIC;
const CURB = 0.2;
// lots (clear of walker lanes, hiding bins, homes); each lists what stands there from a given day on
export const LOTS = {
  A: { x0: 19.5, x1: 24.8, z0: -24, z1: -10, stages: [[2, 'site'], [3, 'rise3'], [4, 'tower4']] },
  B: { x0: 41.5, x1: 45.8, z0: -22, z1: -12, stages: [[2, 'kiosk']] },
  C: { x0: -26, x1: -11, z0: 41.5, z1: 46, stages: [[3, 'site'], [4, 'row']] },
  F: { x0: 41.5, x1: 46, z0: 21, z1: 25, stages: [[4, 'site'], [5, 'shop3']] },
  D: { x0: 41.5, x1: 46, z0: 41.5, z1: 46, stages: [[5, 'site'], [6, 'tower7']] },
  E: { x0: 20.5, x1: 24.8, z0: 41.5, z1: 46, stages: [[6, 'shop2']] },
  R: { x0: 19.5, x1: 24.8, z0: -24, z1: -10, stages: [[7, 'billboard']], overlay: true },   // on top of lot A's tower
};
const NAMES = { site: 'A BUILDING SITE', rise3: 'SCAFFOLDING', tower4: 'A NEW TOWER', kiosk: 'A RAMEN KIOSK', row: 'A ROW OF HOUSES', shop3: 'A NEW SHOP', tower7: 'A BIG TOWER', shop2: 'A BAKERY', billboard: 'A RENT BILLBOARD' };

const mats = new Map();
const M = (c) => { let m = mats.get(c); if (!m) { m = new THREE.MeshLambertMaterial({ color: c, flatShading: true }); mats.set(c, m); } return m; };
const BOX = new THREE.BoxGeometry(1, 1, 1);
export function box(g, x, y, z, w, h, d, c, ry = 0) {
  const m = new THREE.Mesh(BOX, M(c)); m.position.set(x, y, z); m.scale.set(w, h, d); m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
// a pixel sign: chunky low-res canvas text, nearest filtered (no smoothing)
function signTex(text, fg, bg, w = 64, h = 16) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = `bold ${h - 6}px monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2 + 1);
  // hard-threshold the antialiasing so it reads as pixels in two colours only
  const id = x.getImageData(0, 0, w, h), d = id.data, f = new THREE.Color(fg), b = new THREE.Color(bg);
  for (let i = 0; i < d.length; i += 4) { const on = Math.abs(d[i] - b.r * 255) + Math.abs(d[i + 1] - b.g * 255) + Math.abs(d[i + 2] - b.b * 255) > 200; const s = on ? f : b; d[i] = s.r * 255; d[i + 1] = s.g * 255; d[i + 2] = s.b * 255; d[i + 3] = 255; }
  x.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function sign(g, text, x, y, z, w, h, ry, fg = N[0], bg = Y[1]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTex(text, fg, bg, Math.max(32, text.length * 9), 16) }));
  m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m;
}
// every lot's front (door, shopfront, awning, signs) faces its nearest road: see facing.js
export const faceOfLot = (L) => frontFor(L);
function fput(g, F, u, y, out, along, h, thick, c) { const [px, pz] = F.pos(u, out), [sx, sz] = F.size(along, thick); return box(g, px, y, pz, sx, h, sz, c); }
function building(g, L, floors, s, opts) { const n0 = g.children.length, h = building0(g, L, floors, s, opts); for (const m of g.children.slice(n0)) m.layers.enable(5); return h; }
function building0(g, L, floors, s, { face = frontFor(L), sideWin = true } = {}) {
  const w = L.x1 - L.x0, d = L.z1 - L.z0, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, h = floors * 3;
  box(g, cx, CURB + h / 2, cz, w, h, d, s.body);
  box(g, cx, CURB + h + 0.18, cz, w + 0.3, 0.36, d + 0.3, P.roof);
  const faces = new Set(sideWin ? ['+x', '+z', face] : [face]);
  for (let f = 1; f < floors; f++) {
    const wy = CURB + f * 3 + 1.7;
    for (const fc of faces) { const F = faceFrame(L, fc); for (let u = F.lo + 1.2; u <= F.lo + F.len - 1.2; u += 2.2) fput(g, F, u + 0.35 - F.mid, wy, 0.02, 1.1, 1.4, 0.06, s.win); }
  }
  const F = faceFrame(L, face);
  fput(g, F, -F.len * 0.2, CURB + 1.15, 0.03, 1.3, 2.3, 0.06, s.door);
  fput(g, F, F.len * 0.15, CURB + 1.4, 0.03, Math.min(3, F.len * 0.35), 1.5, 0.06, s.win);
  return h;
}
function fence(g, L, face) {   // site hoarding: yellow/black boards round the lot, a gap-free box
  const w = L.x1 - L.x0, d = L.z1 - L.z0, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
  for (const [x, z, a, b] of [[cx, L.z1, w, 0.12], [cx, L.z0, w, 0.12], [L.x1, cz, 0.12, d], [L.x0, cz, 0.12, d]]) box(g, x, CURB + 0.75, z, a, 1.5, b, Y[1]);
  for (const fc of new Set(['+x', '+z', face])) { const F = faceFrame(L, fc); for (let u = 0.6; u < F.len - 0.3; u += 1.2) fput(g, F, F.lo + u - F.mid, CURB + 1.0, 0.07, 0.36, 0.3, 0.04, N[0]); }
  box(g, cx, CURB + 0.03, cz, w - 0.3, 0.06, d - 0.3, W[1]);   // dirt
}
function crane(g, x, z, h, arm) {
  box(g, x, CURB + h / 2, z, 0.5, h, 0.5, Y[0]);
  box(g, x + arm * 0.35, CURB + h + 0.2, z, arm, 0.3, 0.3, Y[0]);
  box(g, x - 1.1, CURB + h + 0.2, z, 1.0, 0.6, 0.6, N[1]);
  box(g, x + arm * 0.8, CURB + h - 1.2, z, 0.04, 2.6, 0.04, N[0]);
  box(g, x + arm * 0.8, CURB + h - 2.6, z, 0.5, 0.3, 0.5, B[2]);
}
const fsign = (g, F, text, u, y, w, h, fg, bg) => { const [px, pz] = F.pos(u, 0.09); return sign(g, text, px, y, pz, w, h, F.ry, fg, bg); };
const BUILD = {
  site(g, L) {
    const face = frontFor(L), F = faceFrame(L, face);
    fence(g, L, face);
    const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
    crane(g, L.x0 + 1.4, L.z0 + 1.4, Math.min(11, 6 + (L.z1 - L.z0) * 0.3), 4.5);
    box(g, cx + 0.6, CURB + 0.45, cz + 0.6, 1.6, 0.9, 1.0, W[2]);   // brick pallet
    box(g, cx - 0.8, CURB + 0.3, cz - 0.5, 1.4, 0.6, 0.6, N[2]);
    fsign(g, F, 'COMING SOON', 0.8, CURB + 1.0, 2.4, 0.6);
  },
  rise3(g, L) {
    const face = frontFor(L);
    fence(g, L, face);
    const I = { x0: L.x0 + 0.5, x1: L.x1 - 0.5, z0: L.z0 + 0.5, z1: L.z1 - 0.5 }, F = faceFrame(I, face);
    building(g, I, 2, SCHEMES.teal, { face });
    for (let f = 0; f <= 3; f++) fput(g, F, 0, CURB + f * 1.8 + 0.05, 0.35, F.len, 0.08, 0.5, W[1]);   // scaffold boards
    for (let u = 0; u <= F.len + 0.01; u += F.len / 4) fput(g, F, F.lo + u - F.mid, CURB + 3.3, 0.55, 0.06, 6.6, 0.06, N[2]);
    crane(g, L.x0 + 1.0, L.z0 + 1.0, 12, 4.5);
  },
  tower4(g, L) { const face = frontFor(L), F = faceFrame(L, face); const h = building(g, L, 4, SCHEMES.teal, { face }); fput(g, F, 0, CURB + 2.75, 0.5, F.len * 0.6, 0.14, 1.0, T[2]); g.userData.top = CURB + h + 0.36; },
  kiosk(g, L) {
    const face = frontFor(L), ax = face[1] === 'x';
    const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
    const I = ax ? { x0: L.x0 + (face[0] === '+' ? 0.6 : 1.6), x1: L.x1 - (face[0] === '+' ? 1.6 : 0.6), z0: cz - 2.4, z1: cz + 2.4 }
      : { x0: cx - 2.4, x1: cx + 2.4, z0: L.z0 + (face[0] === '+' ? 0.6 : 1.6), z1: L.z1 - (face[0] === '+' ? 1.6 : 0.6) };
    const F = faceFrame(I, face);
    building(g, I, 1, SCHEMES.pink, { face });
    fput(g, F, 0, CURB + 2.6, 0.6, 4.6, 0.14, 1.2, K[1]);
    fsign(g, F, 'RAMEN', 0, CURB + 3.6, 2.6, 0.8, N[4], K[0]);
    for (const du of [-1.4, 0, 1.4]) fput(g, F, du, CURB + 0.35, 1.5, 0.35, 0.7, 0.35, W[1]);   // stools
  },
  row(g, L) {
    const face = frontFor(L), ax = face[1] === 'x';
    const n = 4, S = [SCHEMES.butter, SCHEMES.blue, SCHEMES.peach, SCHEMES.pink];
    const span = ax ? L.z1 - L.z0 : L.x1 - L.x0, w = span / n;
    for (let i = 0; i < n; i++) {
      const I = ax ? { x0: L.x0, x1: L.x1, z0: L.z0 + i * w + 0.25, z1: L.z0 + (i + 1) * w - 0.25 } : { x0: L.x0 + i * w + 0.25, x1: L.x0 + (i + 1) * w - 0.25, z0: L.z0, z1: L.z1 };
      const h = building(g, I, i % 2 ? 2 : 1, S[i], { face, sideWin: false });
      box(g, (I.x0 + I.x1) / 2, CURB + h + 0.6, (I.z0 + I.z1) / 2, I.x1 - I.x0 - 0.4, 0.8, I.z1 - I.z0 - 0.4, S[i].accent);   // little roofs
    }
  },
  shop3(g, L) {
    const face = frontFor(L), F = faceFrame(L, face);
    building(g, L, 3, SCHEMES.pink, { face });
    fput(g, F, 0, CURB + 2.75, 0.6, F.len * 0.7, 0.14, 1.2, K[1]);
    fsign(g, F, 'NEW!', -F.len / 2 + 1.2, CURB + 5.0, 1.6, 0.8, N[4], K[1]);
  },
  tower7(g, L) {
    const face = frontFor(L);
    const h = building(g, L, 7, SCHEMES.white, { face });
    box(g, (L.x0 + L.x1) / 2, CURB + h + 1.6, (L.z0 + L.z1) / 2, 0.12, 2.6, 0.12, N[0]);
    box(g, (L.x0 + L.x1) / 2, CURB + h + 2.95, (L.z0 + L.z1) / 2, 0.3, 0.3, 0.3, K[1]);
  },
  shop2(g, L) {
    const face = frontFor(L), F = faceFrame(L, face);
    building(g, L, 2, SCHEMES.butter, { face });
    fput(g, F, 0, CURB + 2.75, 0.6, F.len * 0.8, 0.14, 1.2, Y[0]);
    fsign(g, F, 'BAKERY', 0, CURB + 4.2, 2.6, 0.7, N[0], Y[2]);
  },
  billboard(g, L, ctx) {   // on the lot-A tower's roof (4 floors), facing the same way as the tower
    const top = CURB + 12 + 0.36, F = faceFrame(L, frontFor(L));
    for (const du of [-2.2, 2.2]) fput(g, F, du, top + 1.0, -0.6, 0.18, 2.0, 0.18, N[0]);
    fput(g, F, 0, top + 2.6, -0.7, 6.0, 2.0, 0.12, N[0]);
    const [px, pz] = F.pos(0, -0.6);
    g.userData.bill = sign(g, ctx.free ? 'RENT FREE!' : 'RENT ¥77,777', px, top + 2.6, pz, 5.8, 1.8, F.ry, ctx.free ? N[0] : N[4], ctx.free ? Y[1] : K[1]);
  },
};
const SOLID = { site: 1, rise3: 1, tower4: 1, kiosk: 1, row: 1, shop3: 1, tower7: 1, shop2: 1 };

export function initGrowth({ scene, city, pixel }) {
  const live = {};   // lot -> { key, group, col }
  function stageOf(L, day) { let k = null; for (const [d, s] of L.stages) if (day >= d) k = s; return k; }
  function clear(id) {
    const o = live[id]; if (!o) return;
    o.group.removeFromParent();
    const i = city.colliders.indexOf(o.col); if (i >= 0) city.colliders.splice(i, 1);
    const j = city.buildings?.indexOf(o.rec); if (j >= 0) city.buildings.splice(j, 1);
    delete live[id];
  }
  /** Rebuild the lots for `day` (0 = the base city). Returns the names of what is new since the last call. */
  function apply(day, ctx = {}) {
    const added = [];
    for (const [id, L] of Object.entries(LOTS)) {
      const k = stageOf(L, day), key = k ? k + (ctx.free ? '+' : '') : null;
      if (live[id]?.key === key) continue;
      const had = live[id]?.key; clear(id);
      if (!k) continue;
      const g = new THREE.Group(); g.name = 'grow-' + id; BUILD[k](g, L, ctx); scene.add(g); pixel?.toonify?.(g);
      let col = null;
      if (SOLID[k]) { col = { minX: L.x0 - 0.1, maxX: L.x1 + 0.1, minZ: L.z0 - 0.1, maxZ: L.z1 + 0.1, grow: id }; city.colliders.push(col); }
      let rec = null;
      if (SOLID[k] && city.buildings) { rec = { ...LOTS[id], face: frontFor(L), name: 'lot ' + id + ' ' + k, kind: 'growth' }; delete rec.stages; city.buildings.push(rec); }
      live[id] = { key, group: g, col, rec };
      if (!had || had.replace('+', '') !== k) added.push(NAMES[k]);
    }
    return added;
  }
  return { apply, live, LOTS, get count() { return Object.keys(live).length; } };
}
