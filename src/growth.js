// Story mode: the city grows a little every day of the week (and snaps back on the Day 7 reset: it's a time loop).
// Empty lots fill up with fenced building sites, scaffolding and finally new buildings + a rent billboard.
// Free roam never calls this, so the sandbox city stays exactly as it was.
import * as THREE from 'three';
import { COMIC, SCHEMES, P } from './palette.js?v=20261025j';

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
function building(g, L, floors, s, { winX = true, winZ = true, door = 'x' } = {}) {
  const w = L.x1 - L.x0, d = L.z1 - L.z0, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, h = floors * 3;
  box(g, cx, CURB + h / 2, cz, w, h, d, s.body);
  box(g, cx, CURB + h + 0.18, cz, w + 0.3, 0.36, d + 0.3, P.roof);
  for (let f = 1; f < floors; f++) {
    const wy = CURB + f * 3 + 1.7;
    if (winZ) for (let u = L.x0 + 1.2; u <= L.x1 - 1.2; u += 2.2) box(g, u + 0.35, wy, L.z1 + 0.02, 1.1, 1.4, 0.06, s.win);
    if (winX) for (let u = L.z0 + 1.2; u <= L.z1 - 1.2; u += 2.2) box(g, L.x1 + 0.02, wy, u + 0.35, 0.06, 1.4, 1.1, s.win);
  }
  if (door === 'x') { box(g, L.x1 + 0.03, CURB + 1.15, cz - d * 0.2, 0.06, 2.3, 1.3, s.door); box(g, L.x1 + 0.03, CURB + 1.4, cz + d * 0.15, 0.06, 1.5, Math.min(3, d * 0.35), s.win); }
  else { box(g, cx - w * 0.2, CURB + 1.15, L.z1 + 0.03, 1.3, 2.3, 0.06, s.door); box(g, cx + w * 0.15, CURB + 1.4, L.z1 + 0.03, Math.min(3, w * 0.35), 1.5, 0.06, s.win); }
  return h;
}
function fence(g, L) {   // site hoarding: yellow/black boards round the lot, a gap-free box
  const w = L.x1 - L.x0, d = L.z1 - L.z0, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
  for (const [x, z, a, b] of [[cx, L.z1, w, 0.12], [cx, L.z0, w, 0.12], [L.x1, cz, 0.12, d], [L.x0, cz, 0.12, d]]) box(g, x, CURB + 0.75, z, a, 1.5, b, Y[1]);
  for (let u = L.x0 + 0.6; u < L.x1 - 0.3; u += 1.2) box(g, u, CURB + 1.0, L.z1 + 0.07, 0.36, 0.3, 0.04, N[0]);
  for (let u = L.z0 + 0.6; u < L.z1 - 0.3; u += 1.2) box(g, L.x1 + 0.07, CURB + 1.0, u, 0.04, 0.3, 0.36, N[0]);
  box(g, cx, CURB + 0.03, cz, w - 0.3, 0.06, d - 0.3, W[1]);   // dirt
}
function crane(g, x, z, h, arm) {
  box(g, x, CURB + h / 2, z, 0.5, h, 0.5, Y[0]);
  box(g, x + arm * 0.35, CURB + h + 0.2, z, arm, 0.3, 0.3, Y[0]);
  box(g, x - 1.1, CURB + h + 0.2, z, 1.0, 0.6, 0.6, N[1]);
  box(g, x + arm * 0.8, CURB + h - 1.2, z, 0.04, 2.6, 0.04, N[0]);
  box(g, x + arm * 0.8, CURB + h - 2.6, z, 0.5, 0.3, 0.5, B[2]);
}
const BUILD = {
  site(g, L) {
    fence(g, L);
    const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
    crane(g, L.x0 + 1.4, L.z0 + 1.4, Math.min(11, 6 + (L.z1 - L.z0) * 0.3), 4.5);
    box(g, cx + 0.6, CURB + 0.45, cz + 0.6, 1.6, 0.9, 1.0, W[2]);   // brick pallet
    box(g, cx - 0.8, CURB + 0.3, cz - 0.5, 1.4, 0.6, 0.6, N[2]);
    sign(g, 'COMING SOON', L.x1 + 0.09, CURB + 1.0, cz + 0.8, 2.4, 0.6, Math.PI / 2);
  },
  rise3(g, L) {
    fence(g, L);
    const I = { x0: L.x0 + 0.5, x1: L.x1 - 0.5, z0: L.z0 + 0.5, z1: L.z1 - 0.5 };
    building(g, I, 2, SCHEMES.teal, { door: 'x' });
    for (let f = 0; f <= 3; f++) box(g, I.x1 + 0.35, CURB + f * 1.8 + 0.05, (I.z0 + I.z1) / 2, 0.5, 0.08, I.z1 - I.z0, W[1]);   // scaffold boards
    for (let u = I.z0; u <= I.z1 + 0.01; u += (I.z1 - I.z0) / 4) box(g, I.x1 + 0.55, CURB + 3.3, u, 0.06, 6.6, 0.06, N[2]);
    crane(g, L.x0 + 1.0, L.z0 + 1.0, 12, 4.5);
  },
  tower4(g, L) { const h = building(g, L, 4, SCHEMES.teal, { door: 'x' }); box(g, L.x1 + 0.5, CURB + 2.75, (L.z0 + L.z1) / 2, 1.0, 0.14, (L.z1 - L.z0) * 0.6, T[2]); g.userData.top = CURB + h + 0.36; },
  kiosk(g, L) {
    const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
    const I = { x0: L.x0 + 0.6, x1: L.x1 - 0.4, z0: cz - 2.4, z1: cz + 2.4 };
    building(g, I, 1, SCHEMES.pink, { door: 'x' });
    box(g, I.x1 + 0.6, CURB + 2.6, cz, 1.2, 0.14, 4.6, K[1]);
    sign(g, 'RAMEN', I.x1 + 0.08, CURB + 3.6, cz, 2.6, 0.8, Math.PI / 2, N[4], K[0]);
    for (const dz of [-1.4, 0, 1.4]) { box(g, I.x1 + 1.5, CURB + 0.35, cz + dz, 0.35, 0.7, 0.35, W[1]); }   // stools
  },
  row(g, L) {
    const n = 4, w = (L.x1 - L.x0) / n, S = [SCHEMES.butter, SCHEMES.blue, SCHEMES.peach, SCHEMES.pink];
    for (let i = 0; i < n; i++) {
      const I = { x0: L.x0 + i * w + 0.25, x1: L.x0 + (i + 1) * w - 0.25, z0: L.z0, z1: L.z1 };
      const h = building(g, I, i % 2 ? 2 : 1, S[i], { door: 'z', winX: false });
      box(g, (I.x0 + I.x1) / 2, CURB + h + 0.6, (I.z0 + I.z1) / 2, I.x1 - I.x0 - 0.4, 0.8, I.z1 - I.z0 - 0.4, S[i].accent);   // little roofs
    }
  },
  shop3(g, L) {
    building(g, L, 3, SCHEMES.pink, { door: 'x' });
    box(g, L.x1 + 0.6, CURB + 2.75, (L.z0 + L.z1) / 2, 1.2, 0.14, (L.z1 - L.z0) * 0.7, K[1]);
    sign(g, 'NEW!', L.x1 + 0.08, CURB + 5.0, L.z0 + 1.2, 1.6, 0.8, Math.PI / 2, N[4], K[1]);
  },
  tower7(g, L) {
    const h = building(g, L, 7, SCHEMES.white, { door: 'z' });
    box(g, (L.x0 + L.x1) / 2, CURB + h + 1.6, (L.z0 + L.z1) / 2, 0.12, 2.6, 0.12, N[0]);
    box(g, (L.x0 + L.x1) / 2, CURB + h + 2.95, (L.z0 + L.z1) / 2, 0.3, 0.3, 0.3, K[1]);
  },
  shop2(g, L) {
    building(g, L, 2, SCHEMES.butter, { door: 'z' });
    box(g, (L.x0 + L.x1) / 2, CURB + 2.75, L.z1 + 0.6, (L.x1 - L.x0) * 0.8, 0.14, 1.2, Y[0]);
    sign(g, 'BAKERY', (L.x0 + L.x1) / 2, CURB + 4.2, L.z1 + 0.08, 2.6, 0.7, 0, N[0], Y[2]);
  },
  billboard(g, L, ctx) {   // on the lot-A tower's roof (4 floors)
    const top = CURB + 12 + 0.36, cz = (L.z0 + L.z1) / 2, x = L.x1 - 0.6;
    for (const dz of [-2.2, 2.2]) box(g, x, top + 1.0, cz + dz, 0.18, 2.0, 0.18, N[0]);
    box(g, x - 0.1, top + 2.6, cz, 0.12, 2.0, 6.0, N[0]);
    g.userData.bill = sign(g, ctx.free ? 'RENT FREE!' : 'RENT ¥77,777', x + 0.0, top + 2.6, cz, 5.8, 1.8, Math.PI / 2, ctx.free ? N[0] : N[4], ctx.free ? Y[1] : K[1]);
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
      live[id] = { key, group: g, col };
      if (!had || had.replace('+', '') !== k) added.push(NAMES[k]);
    }
    return added;
  }
  return { apply, live, LOTS, get count() { return Object.keys(live).length; } };
}
