import * as THREE from 'three';
import { mat } from './bucket.js?v=20261031o';
import { COMIC } from './palette.js?v=20261031o';

// Street-furniture & vegetation library. Everything is baked into the city's
// shared vertex-colour Bucket (one draw call) and uses Comic palette colours
// only, so the toon ramp + quantiser keep it on-palette.
const { blues: B, pinks: K, teals: T, warm: W, neutrals: N, yellows: Y } = COMIC;
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  ico: new THREE.IcosahedronGeometry(1, 0),
};

export function makeProps(solid, addCollider, CURB, treesBucket = null) {
  // place a part at local (lx, ly, lz) of an object at (x, z) rotated by ry
  const part = (geo, x, z, ry, lx, ly, lz, sx, sy, sz, color, rx = 0, rz = 0) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    solid.add(geo, mat(x + lx * c + lz * s, ly, z - lx * s + lz * c, sx, sy, sz, ry, rx, rz), color);
  };
  const col = (x, z, hx, hz, ry = 0, top) =>
    (Math.abs(Math.sin(ry)) > 0.7 ? addCollider(x, z, hz, hx, top) : addCollider(x, z, hx, hz, top));
  const y0 = CURB;

  // ---------------- trees ----------------
  // Trees bake into their own bucket (city-trees) and are logged, so story mode can swap them for spinning
  // instanced copies (the day 5+ glitch). draw*(bk, x, z, s, yb) work in world space or local space (x=z=0, yb=0).
  const treeBucket = treesBucket || solid, treeLog = [];
  function crownTree(bk, x, z, s, trunk, c1, c2, yb = y0) {
    bk.add(G.cyl8, mat(x, yb + 0.8 * s, z, 0.3 * s, 1.6 * s, 0.3 * s), trunk);
    bk.add(G.ico, mat(x, yb + 2.5 * s, z, 1.3 * s, 1.15 * s, 1.3 * s, 0.4), c1);
    bk.add(G.ico, mat(x + 0.55 * s, yb + 3.15 * s, z - 0.35 * s, 0.75 * s, 0.7 * s, 0.75 * s, 1.1), c2);
  }
  const DRAW = {
    round: (bk, x, z, s, yb) => crownTree(bk, x, z, s, T[0], N[3], N[3], yb),
    blossom: (bk, x, z, s, yb = y0) => { crownTree(bk, x, z, s, W[0], K[3], K[2], yb); bk.add(G.ico, mat(x - 0.6 * s, yb + 2.2 * s, z + 0.5 * s, 0.6 * s, 0.55 * s, 0.6 * s, 0.7), K[2]); },
    autumn: (bk, x, z, s, yb = y0) => { crownTree(bk, x, z, s, W[0], Y[1], Y[0], yb); bk.add(G.ico, mat(x - 0.5 * s, yb + 2.0 * s, z + 0.55 * s, 0.6 * s, 0.55 * s, 0.6 * s, 0.2), Y[2]); },
    conifer: (bk, x, z, s, yb = y0) => {
      bk.add(G.cyl8, mat(x, yb + 0.4 * s, z, 0.3 * s, 0.8 * s, 0.3 * s), T[0]);
      bk.add(G.cone, mat(x, yb + 1.6 * s, z, 2.0 * s, 1.8 * s, 2.0 * s, 0.2), T[1]);
      bk.add(G.cone, mat(x, yb + 2.6 * s, z, 1.55 * s, 1.6 * s, 1.55 * s, 0.6), T[1]);
      bk.add(G.cone, mat(x, yb + 3.5 * s, z, 1.05 * s, 1.4 * s, 1.05 * s, 0.1), T[1]);
    },
  };
  const plant = (kind, r) => (x, z, s = 1) => { DRAW[kind](treeBucket, x, z, s); treeLog.push({ kind, x, z, s, y: y0 }); addCollider(x, z, r, r); };
  const roundTree = plant('round', 0.3), blossomTree = plant('blossom', 0.3), autumnTree = plant('autumn', 0.3), conifer = plant('conifer', 0.35);
  function sapling(x, z, s = 1) {
    solid.add(G.cyl8, mat(x, y0 + 0.65 * s, z, 0.12, 1.3 * s, 0.12), W[1]);
    solid.add(G.box, mat(x + 0.18, y0 + 0.5, z, 0.06, 1.0, 0.06), W[2]); // stake
    solid.add(G.ico, mat(x, y0 + 1.55 * s, z, 0.55 * s, 0.6 * s, 0.55 * s, 0.3), N[3]);
    solid.add(G.box, mat(x, y0 + 0.02, z, 0.7, 0.04, 0.7), W[0]); // tree pit
    addCollider(x, z, 0.18, 0.18);
  }

  // ---------------- greenery ----------------
  function bush(x, z, s = 1, color = T[1]) {
    solid.add(G.ico, mat(x, y0 + 0.4 * s, z, 0.6 * s, 0.5 * s, 0.6 * s, 0.3), color);
    solid.add(G.ico, mat(x + 0.4 * s, y0 + 0.3 * s, z + 0.25 * s, 0.4 * s, 0.35 * s, 0.4 * s, 1.0), color);
    addCollider(x, z, 0.55 * s, 0.55 * s, y0 + 0.85 * s);
  }
  function hedge(x, z, len = 2, ry = 0) {
    part(G.box, x, z, ry, 0, y0 + 0.4, 0, len, 0.8, 0.6, T[1]);
    for (let u = -len / 2 + 0.4; u < len / 2; u += 0.8) part(G.ico, x, z, ry, u, y0 + 0.82, 0, 0.42, 0.22, 0.34, T[1]);
    col(x, z, len / 2, 0.3, ry, y0 + 0.95);
  }
  function planter(x, z, flower = K[1]) {
    solid.add(G.box, mat(x, y0 + 0.25, z, 0.9, 0.5, 0.9), W[2]);
    solid.add(G.box, mat(x, y0 + 0.52, z, 1.0, 0.08, 1.0), W[1]);
    solid.add(G.ico, mat(x, y0 + 0.7, z, 0.42, 0.3, 0.42, 0.5), T[1]);
    for (const [dx, dz] of [[0.2, 0.15], [-0.18, 0.22], [0.05, -0.22], [-0.2, -0.1]])
      solid.add(G.box, mat(x + dx, y0 + 0.95, z + dz, 0.14, 0.14, 0.14), flower);
    addCollider(x, z, 0.5, 0.5, y0 + 0.95);
  }

  // ---------------- benches (sitter faces local +z, backrest at local -z) ----------------
  function slatBench(x, z, ry = 0) {
    for (const lx of [-0.75, 0.75]) {
      part(G.box, x, z, ry, lx, y0 + 0.22, 0.05, 0.08, 0.44, 0.5, N[0]);
      part(G.box, x, z, ry, lx, y0 + 0.6, -0.22, 0.08, 0.7, 0.08, N[0]);
    }
    for (const lz of [-0.12, 0.05, 0.22]) part(G.box, x, z, ry, 0, y0 + 0.46, lz, 1.8, 0.06, 0.14, W[1]);
    for (const ly of [0.68, 0.86]) part(G.box, x, z, ry, 0, y0 + ly, -0.24, 1.8, 0.12, 0.05, W[1]);
    col(x, z, 0.95, 0.4, ry, y0 + 0.92);
  }
  function blockBench(x, z, ry = 0, len = 1.6) {
    for (const lx of [-len / 2 + 0.25, len / 2 - 0.25]) part(G.box, x, z, ry, lx, y0 + 0.2, 0, 0.3, 0.4, 0.5, N[2]);
    part(G.box, x, z, ry, 0, y0 + 0.45, 0, len, 0.12, 0.6, W[3]);
    col(x, z, len / 2, 0.3, ry, y0 + 0.51);
  }
  function parkBench(x, z, ry = 0) {
    for (const lx of [-0.8, 0.8]) {
      part(G.box, x, z, ry, lx, y0 + 0.3, 0, 0.08, 0.6, 0.55, N[0]);
      part(G.box, x, z, ry, lx, y0 + 0.62, 0.02, 0.1, 0.06, 0.5, N[0]); // armrest
      part(G.box, x, z, ry, lx * 0.95, y0 + 0.65, -0.26, 0.08, 0.75, 0.08, N[0]);
    }
    for (const lz of [-0.12, 0.04, 0.2]) part(G.box, x, z, ry, 0, y0 + 0.45, lz, 1.6, 0.06, 0.13, T[1]);
    for (const ly of [0.72, 0.9]) part(G.box, x, z, ry, 0, y0 + ly, -0.27, 1.6, 0.12, 0.05, T[1]);
    col(x, z, 0.9, 0.38, ry, y0 + 0.96);
  }

  // ---------------- small street furniture ----------------
  function bin(x, z, kind = 0) {
    if (kind === 0) { // round teal litter bin with dark lid
      solid.add(G.cyl8, mat(x, y0 + 0.4, z, 0.55, 0.8, 0.55), T[1]);
      solid.add(G.cyl8, mat(x, y0 + 0.83, z, 0.62, 0.08, 0.62), N[0]);
      solid.add(G.box, mat(x, y0 + 0.55, z + 0.27, 0.22, 0.08, 0.02), T[3]);
    } else { // square yellow bin on a post
      solid.add(G.box, mat(x, y0 + 0.35, z, 0.1, 0.7, 0.1), N[0]);
      solid.add(G.box, mat(x, y0 + 0.75, z, 0.5, 0.6, 0.5), Y[1]);
      solid.add(G.box, mat(x, y0 + 1.07, z, 0.56, 0.06, 0.56), N[0]);
    }
    addCollider(x, z, 0.32, 0.32, y0 + (kind === 0 ? 0.87 : 1.1));
  }
  function bollard(x, z) {
    solid.add(G.cyl8, mat(x, y0 + 0.4, z, 0.24, 0.8, 0.24), N[0]);
    solid.add(G.cyl8, mat(x, y0 + 0.62, z, 0.26, 0.1, 0.26), Y[1]);
    addCollider(x, z, 0.15, 0.15, y0 + 0.67);
  }
  // fences: centred at (x, z), running along local x for `len`
  function picketFence(x, z, len, ry = 0) {
    for (const ly of [0.3, 0.6]) part(G.box, x, z, ry, 0, y0 + ly, 0, len, 0.07, 0.05, N[4]);
    for (let u = -len / 2 + 0.1; u <= len / 2 - 0.05; u += 0.3) {
      part(G.box, x, z, ry, u, y0 + 0.42, 0.04, 0.1, 0.84, 0.04, N[4]);
      part(G.box, x, z, ry, u, y0 + 0.86, 0.04, 0.07, 0.07, 0.04, N[4], 0, Math.PI / 4);
    }
    col(x, z, len / 2, 0.08, ry, y0 + 0.9);
  }
  function railing(x, z, len, ry = 0) {
    part(G.box, x, z, ry, 0, y0 + 0.95, 0, len, 0.07, 0.07, N[0]);
    part(G.box, x, z, ry, 0, y0 + 0.2, 0, len, 0.05, 0.05, N[1]);
    for (let u = -len / 2; u <= len / 2 + 0.01; u += len / Math.max(1, Math.round(len / 0.25)))
      part(G.box, x, z, ry, u, y0 + 0.5, 0, 0.04, 0.95, 0.04, Math.abs(u) > len / 2 - 0.05 ? N[0] : N[1]);
    col(x, z, len / 2, 0.08, ry, y0 + 0.99);
  }
  // bus shelter, open toward local +z
  function busStop(x, z, ry = 0) {
    for (const lx of [-1.3, 1.3]) for (const lz of [-0.5, 0.4]) part(G.box, x, z, ry, lx, y0 + 1.15, lz, 0.08, 2.3, 0.08, N[0]);
    part(G.box, x, z, ry, 0, y0 + 2.36, -0.05, 2.9, 0.12, 1.2, N[1]);            // roof
    part(G.box, x, z, ry, 0, y0 + 1.3, -0.5, 2.5, 1.7, 0.04, B[3]);              // glass back
    part(G.box, x, z, ry, -1.3, y0 + 1.3, -0.05, 0.04, 1.7, 0.8, B[3]);          // glass side
    part(G.box, x, z, ry, 0.5, y0 + 1.5, -0.47, 1.0, 1.2, 0.03, K[1]);           // poster
    part(G.box, x, z, ry, 0, y0 + 0.45, -0.28, 2.0, 0.08, 0.36, W[1]);           // seat
    part(G.box, x, z, ry, 1.65, y0 + 1.25, 0.5, 0.08, 2.5, 0.08, N[0]);          // sign pole
    part(G.box, x, z, ry, 1.65, y0 + 2.35, 0.5, 0.5, 0.5, 0.06, Y[1]);           // sign
    part(G.box, x, z, ry, 1.65, y0 + 2.35, 0.54, 0.26, 0.2, 0.02, N[0]);
    { const c = Math.cos(ry), s = Math.sin(ry);
      col(x - 0.3 * s, z - 0.3 * c, 1.35, 0.25, ry);
      addCollider(x + 1.65 * c + 0.5 * s, z - 1.65 * s + 0.5 * c, 0.12, 0.12); }
  }
  function vending(x, z, ry = 0) {
    part(G.box, x, z, ry, 0, y0 + 0.95, 0, 1.0, 1.9, 0.8, K[0]);
    part(G.box, x, z, ry, -0.12, y0 + 1.15, 0.41, 0.62, 1.2, 0.02, B[3]);        // window
    for (const ly of [0.8, 1.15, 1.5]) for (const lx of [-0.3, -0.12, 0.06])
      part(G.box, x, z, ry, lx, y0 + ly, 0.42, 0.1, 0.18, 0.02, [K[1], Y[1], T[2]][Math.round((lx + 0.3) / 0.18) % 3]);
    part(G.box, x, z, ry, 0.33, y0 + 1.25, 0.42, 0.18, 0.5, 0.02, N[0]);         // buttons panel
    part(G.box, x, z, ry, 0.33, y0 + 1.35, 0.43, 0.08, 0.08, 0.02, Y[1]);
    part(G.box, x, z, ry, -0.1, y0 + 0.3, 0.42, 0.6, 0.18, 0.02, N[0]);          // tray
    part(G.box, x, z, ry, 0, y0 + 1.93, 0, 1.04, 0.08, 0.84, K[1]);
    col(x, z, 0.5, 0.4, ry);
  }
  function bikeRack(x, z, ry = 0) {
    for (const lx of [-0.6, 0, 0.6]) {
      for (const s of [-0.18, 0.18]) part(G.box, x, z, ry, lx, y0 + 0.4, s, 0.06, 0.8, 0.06, N[0]);
      part(G.box, x, z, ry, lx, y0 + 0.8, 0, 0.06, 0.06, 0.42, N[0]);
    }
    // a parked bike (along local z, front wheel at +z)
    for (const lz of [-0.15, 0.85]) part(G.cyl12, x, z, ry, 0.3, y0 + 0.36, lz, 0.72, 0.06, 0.72, N[0], 0, Math.PI / 2);
    part(G.box, x, z, ry, 0.3, y0 + 0.55, 0.35, 0.05, 0.06, 0.95, B[2], -0.35);
    part(G.box, x, z, ry, 0.3, y0 + 0.7, 0.2, 0.05, 0.06, 0.6, B[2]);
    part(G.box, x, z, ry, 0.3, y0 + 0.82, 0.0, 0.1, 0.05, 0.25, N[0]);           // saddle
    part(G.box, x, z, ry, 0.3, y0 + 0.9, 0.72, 0.5, 0.05, 0.05, N[0]);           // handlebar
    { const c = Math.cos(ry), s = Math.sin(ry); col(x + 0.2 * s, z + 0.2 * c, 0.9, 0.5, ry, y0 + 0.95); }
  }
  function fountain(x, z) {
    solid.add(G.cyl12, mat(x, y0 + 0.25, z, 2.8, 0.5, 2.8), N[4]);
    solid.add(G.cyl12, mat(x, y0 + 0.47, z, 2.4, 0.06, 2.4), B[2]);
    solid.add(G.cyl8, mat(x, y0 + 0.75, z, 0.45, 1.0, 0.45), N[4]);
    solid.add(G.cyl12, mat(x, y0 + 1.25, z, 1.2, 0.18, 1.2), N[4]);
    solid.add(G.cyl12, mat(x, y0 + 1.35, z, 1.0, 0.04, 1.0), B[3]);
    solid.add(G.cyl8, mat(x, y0 + 1.6, z, 0.16, 0.5, 0.16), B[3]);
    solid.add(G.ico, mat(x, y0 + 1.9, z, 0.18, 0.14, 0.18), B[4]);
    addCollider(x, z, 1.35, 1.35, y0 + 0.5);     // low rim: hop onto it / over the edge
    addCollider(x, z, 0.6, 0.6, y0 + 1.45);      // centre column + bowl
  }

  // ---------------- park (20 x 8: open east lawn + fountain plaza in the west half) ----------------
  function park(x0, z0, x1, z1) {
    const cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, PW = 1.8;
    const fx = x0 + 6;                                                                   // fountain plaza
    solid.add(G.box, mat((x0 + x1) / 2, y0 + 0.03, cz, w - 0.2, 0.06, d - 0.2), N[3]);  // lawn
    solid.add(G.box, mat((x0 + x1) / 2, y0 + 0.065, cz, w - 0.2, 0.02, PW), W[3]);      // main east-west path
    solid.add(G.box, mat(fx, y0 + 0.065, cz, PW, 0.02, d - 0.2), W[3]);                 // north-south path
    solid.add(G.box, mat(fx, y0 + 0.068, cz, 4.8, 0.02, 4.8), W[3]);                    // plaza
    solid.add(G.box, mat(x1 - 1.5, y0 + 0.068, cz, 2.8, 0.02, 5.0), W[3]);              // east gate apron
    solid.add(G.box, mat(x1 - 5.5, y0 + 0.066, z1 - 1.5, 3.2, 0.02, 2.8), W[3]);        // front gate apron
    fountain(fx, cz);
    // fences with wide gaps: picket on the camera-facing sides (+x, +z), railing on the back sides
    const segs = (a0, a1, gaps) => {
      const out = []; let s0 = a0 + 0.15;
      for (const [g0, g1] of gaps) { out.push([s0, g0]); s0 = g1; }
      out.push([s0, a1 - 0.15]); return out.filter(([p, q]) => q - p > 0.3);
    };
    for (const [p, q] of segs(x0, x1, [[fx - PW / 2, fx + PW / 2], [x1 - 7.1, x1 - 3.9]])) picketFence((p + q) / 2, z1 - 0.12, q - p, 0);
    for (const [p, q] of segs(x0, x1, [[fx - PW / 2, fx + PW / 2], [x1 - 6.2, x1 - 3.8]])) railing((p + q) / 2, z0 + 0.12, q - p, 0);
    for (const [p, q] of segs(z0, z1, [[cz - 2.5, cz + 2.5]])) picketFence(x1 - 0.12, (p + q) / 2, q - p, Math.PI / 2);
    for (const [p, q] of segs(z0, z1, [[cz - PW / 2, cz + PW / 2]])) railing(x0 + 0.12, (p + q) / 2, q - p, Math.PI / 2);
    // benches round the fountain (off the paths) + one on the open lawn
    parkBench(fx - 2.7, cz + 2.9, Math.PI);
    parkBench(fx + 2.7, cz - 2.9, 0);
    // trees at the edges, the middle stays open
    roundTree(x0 + 1.6, z0 + 1.6, 0.95);
    conifer(x0 + 1.5, z1 - 1.5, 0.9);
    autumnTree(x1 - 12, z1 - 1.3, 0.85);
    roundTree(x1 - 9, z0 + 1.3, 0.85);
    blossomTree(x1 - 1.6, z1 - 1.4, 0.9);
    autumnTree(x1 - 1.6, z0 + 1.4, 0.8);
    bush(x0 + 3, z1 - 0.8, 0.8); bush(x1 - 9.5, z1 - 0.8, 0.8); bush(x1 - 8, z0 + 0.75, 0.8);
    planter(x1 - 0.75, cz - 3.1, K[1]); planter(x1 - 0.75, cz + 3.1, Y[1]);
  }

  return { treeLog, treeDraw: DRAW, roundTree, blossomTree, autumnTree, conifer, sapling, bush, hedge, planter,
    slatBench, blockBench, parkBench, bin, bollard, picketFence, railing, busStop, vending, bikeRack, fountain, park };
}
