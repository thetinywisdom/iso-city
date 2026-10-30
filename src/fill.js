// CITY FILL: the empty lots and bare ground get filled from day 1 (story and free roam): extra buildings and
// shops, a pocket park, a parking lot with cars, power poles with wires, street signs, bikes, vending machines,
// benches, bushes and trees, plus a skyline of backdrop blocks past the edge of the walkable map.
// Everything stays off the walking lanes, the chase routes, the hiding bins and the story spots
// (spawn, the run-down apartment's door, the landlady's house lot west of the white building, the park).
// Every building's front faces its nearest road (facing.js). All baked into the city's single draw call.
import * as THREE from 'three';
import { mat } from './bucket.js?v=20261031h';
import { COMIC, P } from './palette.js?v=20261031h';
import { faceFrame } from './facing.js?v=20261031h';

const { blues: B, pinks: K, teals: T, warm: W, neutrals: N, yellows: Y } = COMIC;
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
};
// the run-down apartment the hero lives in (story wake / sleep spot is right outside its door)
export const APARTMENT = { x0: -29, x1: -21, z0: -16, z1: -7.6, door: { x: -27, z: -6.6 } };

export function addFill({ solid, bsolid = solid, addCollider, props, building, lamp, CURB, scene }) {
  const y0 = CURB;
  const part = (x, z, ry, lx, ly, lz, sx, sy, sz, color, geo = G.box, rx = 0, rz = 0) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    solid.add(geo, mat(x + lx * c + lz * s, ly, z - lx * s + lz * c, sx, sy, sz, ry, rx, rz), color);
  };
  const colR = (x, z, hx, hz, ry, top) => (Math.abs(Math.sin(ry)) > 0.7 ? addCollider(x, z, hz, hx, top) : addCollider(x, z, hx, hz, top));

  // ---------------- small props ----------------
  // a parked car along local z (ry = 0: nose to +z); low collider you can hop onto
  function car(x, z, ry, body) {
    part(x, z, ry, 0, y0 + 0.55, 0, 1.7, 0.6, 3.6, body);                    // body
    part(x, z, ry, 0, y0 + 1.1, -0.25, 1.5, 0.55, 1.9, body);                // cabin
    part(x, z, ry, 0, y0 + 1.1, 0.72, 1.36, 0.42, 0.04, B[3]);               // windscreen
    part(x, z, ry, 0, y0 + 1.1, -1.21, 1.36, 0.42, 0.04, B[3]);              // rear window
    for (const sx of [-0.76, 0.76]) part(x, z, ry, sx, y0 + 1.1, -0.25, 0.04, 0.4, 1.6, B[3]);
    for (const sx of [-0.8, 0.8]) for (const sz of [-1.15, 1.15]) part(x, z, ry, sx, y0 + 0.3, sz, 0.6, 0.24, 0.6, N[0], G.cyl12, 0, Math.PI / 2);
    for (const sx of [-0.55, 0.55]) { part(x, z, ry, sx, y0 + 0.6, 1.81, 0.34, 0.16, 0.04, Y[3]); part(x, z, ry, sx, y0 + 0.6, -1.81, 0.3, 0.14, 0.04, K[1]); }
    colR(x, z, 0.9, 1.85, ry, y0 + 1.4);
  }
  function pole(x, z, h = 6.2) {   // wooden power pole with a cross arm; returns the wire anchor points
    solid.add(G.cyl8, mat(x, y0 + h / 2, z, 0.26, h, 0.26), W[1]);
    solid.add(G.box, mat(x, y0 + h - 0.45, z, 1.7, 0.14, 0.14), W[1]);
    for (const dx of [-0.7, 0.7]) solid.add(G.box, mat(x + dx, y0 + h - 0.3, z, 0.1, 0.16, 0.1), N[4]);
    solid.add(G.cyl8, mat(x + 0.25, y0 + h - 1.3, z, 0.4, 0.6, 0.4), N[2]);  // transformer can
    addCollider(x, z, 0.18, 0.18);
    return [[x - 0.7, y0 + h - 0.22, z], [x + 0.7, y0 + h - 0.22, z]];
  }
  function wire(a, b, sag = 0.45) {  // two straight segments with a sag in the middle
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag, (a[2] + b[2]) / 2];
    for (const [p, q] of [[a, m], [m, b]]) {
      const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], len = Math.hypot(dx, dy, dz);
      const ry = Math.atan2(dx, dz), rx = -Math.atan2(dy, Math.hypot(dx, dz));
      const o = new THREE.Object3D(); o.position.set((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2);
      o.rotation.set(rx, ry, 0, 'YXZ'); o.scale.set(0.05, 0.05, len); o.updateMatrix();
      solid.add(G.box, o.matrix, N[0]);
    }
  }
  function poleLine(pts, h) {
    const tops = pts.map(([x, z]) => pole(x, z, h));
    for (let i = 1; i < tops.length; i++) for (const k of [0, 1]) wire(tops[i - 1][k], tops[i][k]);
  }
  function streetSign(x, z, c1 = T[2], c2 = B[1]) {
    solid.add(G.cyl8, mat(x, y0 + 1.5, z, 0.1, 3.0, 0.1), N[1]);
    solid.add(G.box, mat(x + 0.5, y0 + 2.85, z, 1.2, 0.3, 0.05), c1);
    solid.add(G.box, mat(x, y0 + 2.5, z + 0.5, 0.05, 0.3, 1.2), c2);
    solid.add(G.box, mat(x + 0.5, y0 + 2.85, z + 0.03, 0.8, 0.06, 0.02), N[4]);
    solid.add(G.box, mat(x + 0.03, y0 + 2.5, z + 0.5, 0.02, 0.06, 0.8), N[4]);
    addCollider(x, z, 0.12, 0.12);
  }
  function bike(x, z, ry = 0, c = K[1]) {   // a bike on its kickstand
    for (const lz of [-0.5, 0.5]) part(x, z, ry, 0, y0 + 0.36, lz, 0.72, 0.06, 0.72, N[0], G.cyl12, 0, Math.PI / 2);
    part(x, z, ry, 0, y0 + 0.55, 0, 0.05, 0.06, 0.95, c, G.box, -0.35);
    part(x, z, ry, 0, y0 + 0.7, -0.1, 0.05, 0.06, 0.6, c);
    part(x, z, ry, 0, y0 + 0.84, -0.3, 0.1, 0.05, 0.25, N[0]);
    part(x, z, ry, 0, y0 + 0.92, 0.38, 0.5, 0.05, 0.05, N[0]);
    colR(x, z, 0.2, 0.6, ry, y0 + 0.95);
  }
  const lot = (x0, x1, z0, z1, c, y = 0.025) => solid.add(G.box, mat((x0 + x1) / 2, y0 + y, (z0 + z1) / 2, x1 - x0, 0.05, z1 - z0), c);

  // ---------------- the run-down apartment (block NW of spawn, front on the main east-west street) ----------------
  const A = APARTMENT;
  building({ x0: A.x0, x1: A.x1, z0: A.z0, z1: A.z1, floors: 3, scheme: 'white', awning: false, name: 'run-down apartment' });
  {
    const F = faceFrame(A, '+z'), put = (fc, u, y, out, along, h, thick, color, rr = 0) => {
      const Fr = faceFrame(A, fc), [px, pz] = Fr.pos(u, out), [sx, sz] = Fr.size(along, thick);
      const [rx, rz] = Fr.ax ? [rr, 0] : [0, rr]; bsolid.add(G.box, mat(px, y, pz, sx, h, sz, 0, rx, rz), color);
    };
    // grime: a dark wet streak band + cracks (zig-zag segments) on the street-side walls
    put('+z', 0, y0 + 0.3, 0.025, F.len, 0.6, 0.02, N[2]);
    put('+x', 0, y0 + 0.3, 0.025, A.z1 - A.z0, 0.6, 0.02, N[2]);
    const crack = (fc, u, y, n, s) => { for (let i = 0; i < n; i++) put(fc, u + (i % 2 ? 0.18 : -0.18) * s, y - i * 0.45, 0.035, 0.07, 0.55, 0.02, N[0], (i % 2 ? 0.6 : -0.6)); };
    crack('+z', -2.6, y0 + 8.2, 6, 1); crack('+z', 2.2, y0 + 5.0, 5, -1); crack('+x', 1.5, y0 + 7.6, 6, 1); crack('+x', -2.8, y0 + 3.6, 4, -1);
    // boarded-up windows: crossed planks over some of the windows
    for (const [fc, u, f] of [['+z', -1.65, 1], ['+z', 2.75, 2], ['+x', -0.85, 2], ['+x', 3.55, 1]]) {
      const y = y0 + f * 3 + 1.7;
      put(fc, u, y, 0.06, 1.5, 0.22, 0.05, W[1], 0.5); put(fc, u, y, 0.07, 1.5, 0.22, 0.05, W[2], -0.5);
      put(fc, u, y + 0.45, 0.065, 1.4, 0.18, 0.05, W[1]);
    }
    // a broken step, a dumpster, junk mail pile, a sagging fire-escape on the +x side
    put('+z', -F.len * 0.25, y0 + 0.1, 0.55, 1.8, 0.2, 1.0, N[3]);
    solid.add(G.box, mat(A.x1 - 0.9, y0 + 0.6, A.z1 + 1.2, 1.4, 1.2, 1.0, 0.1), T[0]);
    solid.add(G.box, mat(A.x1 - 0.9, y0 + 1.25, A.z1 + 1.2, 1.5, 0.12, 1.1, 0.1, 0.12), T[1]);
    addCollider(A.x1 - 0.9, A.z1 + 1.2, 0.75, 0.6, y0 + 1.3);
    for (let f = 1; f < 3; f++) {
      bsolid.add(G.box, mat(A.x1 + 0.55, y0 + f * 3, (A.z0 + A.z1) / 2 + 1.5, 1.1, 0.08, 3.2, 0, 0.06), N[1]);
      bsolid.add(G.box, mat(A.x1 + 1.08, y0 + f * 3 + 0.5, (A.z0 + A.z1) / 2 + 1.5, 0.05, 1.0, 3.2), N[1]);
    }
    // the flickering sign (its own mesh so it can buzz on and off); a letter is dead
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#292C2E'; g.fillRect(0, 0, 256, 64); g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#FF5491'; g.fillText('PAL', 56, 34); g.fillStyle = '#5B6A7B'; g.fillText('A', 97, 34); g.fillStyle = '#FF5491'; g.fillText('CE APTS', 176, 34);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sm = new THREE.MeshBasicMaterial({ map: tex, color: '#ffffff' });
    const sgn = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), sm);
    const [sx, sz] = F.pos(0.4, 0.12); sgn.position.set(sx, y0 + 3.0, sz); sgn.rotation.y = F.ry; sgn.name = 'apartment-sign';
    const dim = new THREE.Color('#5B6A7B'), on = new THREE.Color('#ffffff');
    sgn.onBeforeRender = () => { const t = performance.now() / 1000; const flick = Math.sin(t * 23) * Math.sin(t * 7.1) > 0.55 || (t % 4.3) < 0.25; sm.color.copy(flick ? dim : on); };
    scene.add(sgn); sgn.layers.enable(5);
    bsolid.add(G.box, mat(sx, y0 + 3.0, sz - 0.04, 4.6, 1.3, 0.06), N[0]);
  }
  bike(A.x0 - 0.4, A.z1 + 1.0, 0.2, B[2]);
  props.bin(A.x1 - 2.6, A.z1 + 0.9, 1);

  // ---------------- block NW of spawn: a corner shop, the parking lot ----------------
  building({ x0: -17, x1: -7.6, z0: -29, z1: -21.6, floors: 3, scheme: 'peach', sign: true, name: 'corner shop (NW)' });
  props.vending(-6.6, -23.3, Math.PI / 2); props.vending(-6.6, -24.5, Math.PI / 2);
  // parking lot (open asphalt with stall lines, a lamp, four cars)
  lot(-29.5, -18.5, -29.5, -18.5, N[1]);
  for (let x = -28.8; x <= -19; x += 2.6) solid.add(G.box, mat(x, y0 + 0.055, -27.5, 0.1, 0.02, 3.6), N[4]);
  for (let x = -28.8; x <= -19; x += 2.6) solid.add(G.box, mat(x, y0 + 0.055, -20.6, 0.1, 0.02, 3.6), N[4]);
  car(-27.5, -27.4, 0, K[1]); car(-22.3, -27.4, 0, B[2]); car(-24.9, -20.6, Math.PI, Y[1]); car(-19.7, -20.6, Math.PI, T[2]);
  lamp(-18.9, -24.0);
  props.bush(-29.2, -17.6, 0.8); props.bush(-18.8, -17.8, 0.7);

  // ---------------- pocket park (south of the peach building) ----------------
  lot(8, 17.4, -29.5, -21, N[3]);
  solid.add(G.box, mat(12.7, y0 + 0.06, -25.2, 9.0, 0.02, 1.4), W[3]);
  props.roundTree(9.4, -28.2, 0.9); props.autumnTree(16, -28.3, 0.85); props.blossomTree(9.5, -22.4, 0.8);
  props.parkBench(12.5, -23.2, Math.PI); props.parkBench(13.5, -27.2, 0);
  props.bush(16.6, -22.2, 0.8); props.bush(11, -29, 0.7); props.planter(15.2, -24.1, Y[1]);
  bike(17.0, -25.4, 0.15, Y[1]);
  props.vending(20.6, -27.6, 0); props.conifer(24, -28, 0.95);

  // ---------------- east of the x = 33 street ----------------
  building({ x0: 40.6, x1: 47, z0: -30, z1: -24.6, floors: 3, scheme: 'butter', sign: true, name: 'laundromat (E)' });
  props.bush(41.4, -9.0, 0.8); props.bush(44.2, -8.8, 0.7); props.roundTree(48.4, -20, 0.9); props.conifer(48.4, -14, 0.9); props.bush(48.4, -26.8, 0.8); bike(46.2, -9.2, Math.PI / 2, T[2]);
  props.vending(43.4, 8.4, Math.PI); props.bin(41.6, 8.4, 0);

  // ---------------- south strip: little greens by the far blocks ----------------
  props.roundTree(-8.6, 44, 0.85); props.bush(-9.0, 41.6, 0.7); props.conifer(-28.6, 41.8, 0.9); props.bush(-28.6, 44.8, 0.8);
  props.blossomTree(27.2, 44.5, 0.8); props.bush(26.8, 41.4, 0.7);

  // ---------------- power lines + street signs (curbside, clear of the walking lanes) ----------------
  poleLine([[27.6, -12], [27.6, -20], [27.6, -28]], 6.2);
  poleLine([[-12, 38.6], [-20, 38.6], [-28, 38.6]], 6.2);
  poleLine([[-31.5, -28], [-31.5, -17], [-31.5, -7], [-31.5, 7], [-31.5, 17.5], [-31.5, 27], [-31.5, 40], [-31.5, 48]], 6.6);
  streetSign(27.6, -5.4); streetSign(38.4, -5.4, Y[1], K[1]); streetSign(-5.4, 27.6, K[1], T[2]); streetSign(5.4, 38.4, B[2], Y[1]);

  // ---------------- skyline: backdrop blocks past the walkable edge (x, z < -30) ----------------
  const BACK = [
    [-48, -33, -15, -7.6, 6, 'blue'], [-48, -34, -27, -17, 8, 'pink'], [-47, -33, -46, -30.5, 10, 'teal'],
    [-28, -18.5, -47, -32, 7, 'butter'], [-16, -7.6, -46, -32, 9, 'white'],
    [7.6, 17, -46, -32, 6, 'peach'], [19, 25.5, -45, -32, 11, 'blue'], [40.6, 48, -46, -32, 8, 'pink'],
    [-48, -33, 7.6, 16, 5, 'peach'], [-47, -33, 18, 25.4, 7, 'teal'], [-48, -33, 40.6, 48, 4, 'butter'],
  ];
  for (const [x0, x1, z0, z1, floors, scheme] of BACK) building({ x0, x1, z0, z1, floors, scheme, awning: floors < 7, sign: floors >= 8, name: 'backdrop ' + scheme, kind: 'backdrop' });
}
