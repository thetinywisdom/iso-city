import * as THREE from 'three';
import { mat } from './bucket.js';
import { COMIC } from './palette.js';

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

export function makeProps(solid, addCollider, CURB) {
  // place a part at local (lx, ly, lz) of an object at (x, z) rotated by ry
  const part = (geo, x, z, ry, lx, ly, lz, sx, sy, sz, color, rx = 0, rz = 0) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    solid.add(geo, mat(x + lx * c + lz * s, ly, z - lx * s + lz * c, sx, sy, sz, ry, rx, rz), color);
  };
  const col = (x, z, hx, hz, ry = 0) =>
    (Math.abs(Math.sin(ry)) > 0.7 ? addCollider(x, z, hz, hx) : addCollider(x, z, hx, hz));
  const y0 = CURB;

  // ---------------- trees ----------------
  function crownTree(x, z, s, trunk, c1, c2) {
    solid.add(G.cyl8, mat(x, y0 + 0.8 * s, z, 0.3 * s, 1.6 * s, 0.3 * s), trunk);
    solid.add(G.ico, mat(x, y0 + 2.5 * s, z, 1.3 * s, 1.15 * s, 1.3 * s, 0.4), c1);
    solid.add(G.ico, mat(x + 0.55 * s, y0 + 3.15 * s, z - 0.35 * s, 0.75 * s, 0.7 * s, 0.75 * s, 1.1), c2);
    addCollider(x, z, 0.3, 0.3);
  }
  const roundTree = (x, z, s = 1) => crownTree(x, z, s, T[0], N[3], N[3]);
  const blossomTree = (x, z, s = 1) => {
    crownTree(x, z, s, W[0], K[3], K[2]);
    solid.add(G.ico, mat(x - 0.6 * s, y0 + 2.2 * s, z + 0.5 * s, 0.6 * s, 0.55 * s, 0.6 * s, 0.7), K[2]);
  };
  const autumnTree = (x, z, s = 1) => {
    crownTree(x, z, s, W[0], Y[1], Y[0]);
    solid.add(G.ico, mat(x - 0.5 * s, y0 + 2.0 * s, z + 0.55 * s, 0.6 * s, 0.55 * s, 0.6 * s, 0.2), Y[2]);
  };
  function conifer(x, z, s = 1) {
    solid.add(G.cyl8, mat(x, y0 + 0.4 * s, z, 0.3 * s, 0.8 * s, 0.3 * s), T[0]);
    solid.add(G.cone, mat(x, y0 + 1.6 * s, z, 2.0 * s, 1.8 * s, 2.0 * s, 0.2), T[1]);
    solid.add(G.cone, mat(x, y0 + 2.6 * s, z, 1.55 * s, 1.6 * s, 1.55 * s, 0.6), T[1]);
    solid.add(G.cone, mat(x, y0 + 3.5 * s, z, 1.05 * s, 1.4 * s, 1.05 * s, 0.1), T[1]);
    addCollider(x, z, 0.35, 0.35);
  }
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
    addCollider(x, z, 0.55 * s, 0.55 * s);
  }
  function hedge(x, z, len = 2, ry = 0) {
    part(G.box, x, z, ry, 0, y0 + 0.4, 0, len, 0.8, 0.6, T[1]);
    for (let u = -len / 2 + 0.4; u < len / 2; u += 0.8) part(G.ico, x, z, ry, u, y0 + 0.82, 0, 0.42, 0.22, 0.34, T[1]);
    col(x, z, len / 2, 0.3, ry);
  }
  function planter(x, z, flower = K[1]) {
    solid.add(G.box, mat(x, y0 + 0.25, z, 0.9, 0.5, 0.9), W[2]);
    solid.add(G.box, mat(x, y0 + 0.52, z, 1.0, 0.08, 1.0), W[1]);
    solid.add(G.ico, mat(x, y0 + 0.7, z, 0.42, 0.3, 0.42, 0.5), T[1]);
    for (const [dx, dz] of [[0.2, 0.15], [-0.18, 0.22], [0.05, -0.22], [-0.2, -0.1]])
      solid.add(G.box, mat(x + dx, y0 + 0.95, z + dz, 0.14, 0.14, 0.14), flower);
    addCollider(x, z, 0.5, 0.5);
  }

  // ---------------- benches (sitter faces local +z, backrest at local -z) ----------------
  function slatBench(x, z, ry = 0) {
    for (const lx of [-0.75, 0.75]) {
      part(G.box, x, z, ry, lx, y0 + 0.22, 0.05, 0.08, 0.44, 0.5, N[0]);
      part(G.box, x, z, ry, lx, y0 + 0.6, -0.22, 0.08, 0.7, 0.08, N[0]);
    }
    for (const lz of [-0.12, 0.05, 0.22]) part(G.box, x, z, ry, 0, y0 + 0.46, lz, 1.8, 0.06, 0.14, W[1]);
    for (const ly of [0.68, 0.86]) part(G.box, x, z, ry, 0, y0 + ly, -0.24, 1.8, 0.12, 0.05, W[1]);
    col(x, z, 0.95, 0.4, ry);
  }
  function blockBench(x, z, ry = 0, len = 1.6) {
    for (const lx of [-len / 2 + 0.25, len / 2 - 0.25]) part(G.box, x, z, ry, lx, y0 + 0.2, 0, 0.3, 0.4, 0.5, N[2]);
    part(G.box, x, z, ry, 0, y0 + 0.45, 0, len, 0.12, 0.6, W[3]);
    col(x, z, len / 2, 0.3, ry);
  }
  function parkBench(x, z, ry = 0) {
    for (const lx of [-0.8, 0.8]) {
      part(G.box, x, z, ry, lx, y0 + 0.3, 0, 0.08, 0.6, 0.55, N[0]);
      part(G.box, x, z, ry, lx, y0 + 0.62, 0.02, 0.1, 0.06, 0.5, N[0]); // armrest
      part(G.box, x, z, ry, lx * 0.95, y0 + 0.65, -0.26, 0.08, 0.75, 0.08, N[0]);
    }
    for (const lz of [-0.12, 0.04, 0.2]) part(G.box, x, z, ry, 0, y0 + 0.45, lz, 1.6, 0.06, 0.13, T[1]);
    for (const ly of [0.72, 0.9]) part(G.box, x, z, ry, 0, y0 + ly, -0.27, 1.6, 0.12, 0.05, T[1]);
    col(x, z, 0.9, 0.38, ry);
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
    addCollider(x, z, 0.32, 0.32);
  }
  function bollard(x, z) {
    solid.add(G.cyl8, mat(x, y0 + 0.4, z, 0.24, 0.8, 0.24), N[0]);
    solid.add(G.cyl8, mat(x, y0 + 0.62, z, 0.26, 0.1, 0.26), Y[1]);
    addCollider(x, z, 0.15, 0.15);
  }
  // fences: centred at (x, z), running along local x for `len`
  function picketFence(x, z, len, ry = 0) {
    for (const ly of [0.3, 0.6]) part(G.box, x, z, ry, 0, y0 + ly, 0, len, 0.07, 0.05, N[4]);
    for (let u = -len / 2 + 0.1; u <= len / 2 - 0.05; u += 0.3) {
      part(G.box, x, z, ry, u, y0 + 0.42, 0.04, 0.1, 0.84, 0.04, N[4]);
      part(G.box, x, z, ry, u, y0 + 0.86, 0.04, 0.07, 0.07, 0.04, N[4], 0, Math.PI / 4);
    }
    col(x, z, len / 2, 0.08, ry);
  }
  function railing(x, z, len, ry = 0) {
    part(G.box, x, z, ry, 0, y0 + 0.95, 0, len, 0.07, 0.07, N[0]);
    part(G.box, x, z, ry, 0, y0 + 0.2, 0, len, 0.05, 0.05, N[1]);
    for (let u = -len / 2; u <= len / 2 + 0.01; u += len / Math.max(1, Math.round(len / 0.25)))
      part(G.box, x, z, ry, u, y0 + 0.5, 0, 0.04, 0.95, 0.04, Math.abs(u) > len / 2 - 0.05 ? N[0] : N[1]);
    col(x, z, len / 2, 0.08, ry);
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
    { const c = Math.cos(ry), s = Math.sin(ry); col(x + 0.2 * s, z + 0.2 * c, 0.9, 0.5, ry); }
  }
  function fountain(x, z) {
    solid.add(G.cyl12, mat(x, y0 + 0.25, z, 2.8, 0.5, 2.8), N[4]);
    solid.add(G.cyl12, mat(x, y0 + 0.47, z, 2.4, 0.06, 2.4), B[2]);
    solid.add(G.cyl8, mat(x, y0 + 0.75, z, 0.45, 1.0, 0.45), N[4]);
    solid.add(G.cyl12, mat(x, y0 + 1.25, z, 1.2, 0.18, 1.2), N[4]);
    solid.add(G.cyl12, mat(x, y0 + 1.35, z, 1.0, 0.04, 1.0), B[3]);
    solid.add(G.cyl8, mat(x, y0 + 1.6, z, 0.16, 0.5, 0.16), B[3]);
    solid.add(G.ico, mat(x, y0 + 1.9, z, 0.18, 0.14, 0.18), B[4]);
    addCollider(x, z, 1.35, 1.35);
  }

  // ---------------- small park ----------------
  function park(x0, z0, x1, z1) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, PW = 1.6;
    solid.add(G.box, mat(cx, y0 + 0.03, cz, w - 0.2, 0.06, d - 0.2), N[3]);           // lawn
    solid.add(G.box, mat(cx, y0 + 0.065, cz, w - 0.2, 0.02, PW), W[3]);               // paths
    solid.add(G.box, mat(cx, y0 + 0.065, cz, PW, 0.02, d - 0.2), W[3]);
    fountain(cx, cz);
    // fences: picket on the camera-facing sides (+x, +z), railing on the back sides; gaps for paths
    const segs = (a0, a1, mid) => [[a0 + 0.15, mid - PW / 2], [mid + PW / 2, a1 - 0.15]];
    for (const [a, b2] of segs(x0, x1, cx)) {
      picketFence((a + b2) / 2, z1 - 0.12, b2 - a, 0);
      railing((a + b2) / 2, z0 + 0.12, b2 - a, 0);
    }
    for (const [a, b2] of segs(z0, z1, cz)) {
      picketFence(x1 - 0.12, (a + b2) / 2, b2 - a, Math.PI / 2);
      railing(x0 + 0.12, (a + b2) / 2, b2 - a, Math.PI / 2);
    }
    // benches facing the paths / fountain
    parkBench(cx - 2.9, cz + 1.45, Math.PI);
    parkBench(cx + 2.9, cz - 1.45, 0);
    parkBench(cx - 1.45, cz - 2.4, Math.PI / 2);
    // tree variety in the corners
    roundTree(x0 + 1.6, z0 + 1.6, 0.95);
    conifer(x0 + 1.5, z1 - 1.5, 0.9);
    blossomTree(x1 - 1.7, z1 - 1.6, 0.9);
    autumnTree(x1 - 1.7, z0 + 1.6, 0.85);
    bush(cx + 1.5, z1 - 0.8, 0.8); bush(cx - 2.2, z1 - 0.75, 0.8);
    planter(x1 - 0.75, cz + 1.4, K[1]); planter(x1 - 0.75, cz - 1.4, Y[1]);
  }

  return { roundTree, blossomTree, autumnTree, conifer, sapling, bush, hedge, planter,
    slatBench, blockBench, parkBench, bin, bollard, picketFence, railing, busStop, vending, bikeRack, fountain, park };
}
