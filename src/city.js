import * as THREE from 'three';
import { Bucket, mat } from './bucket.js?v=20261031s';
import { P, SCHEMES, COMIC } from './palette.js?v=20261031s';
import { makeProps } from './props.js?v=20261031s';
import { resolveFace, faceFrame } from './facing.js?v=20261031s';
import { addFill } from './fill.js?v=20261031s';
import { markInk } from './pixel.js?v=20261031s';

// Small art-direction test scene: a main intersection at (0,0) plus two
// streets on the near (+x / +z) side, so the block nearest the camera has
// street-facing fronts the isometric camera can actually see.
export const ROAD = 10;
export const SIDEWALK = 2.5;
export const CURB = 0.2;
const R = ROAD / 2;
const EDGE = 50;
const ROADS = [0, 33];                       // road centre lines (both axes)
const SPANS = [[-EDGE, -R], [R, 33 - R], [33 + R, EDGE]]; // block extents per axis

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  ico: new THREE.IcosahedronGeometry(1, 0),
};

export function generateCity(scene) {
  const solid = new Bucket();
  const bsolid = new Bucket();   // buildings only: the one mesh that gets cartoon ink
  const colliders = [];
  const blocks = [];
  // top: world height of a LOW prop (fence, bush, bench...) the player can jump over; omitted = tall (always blocks)
  const addCollider = (cx, cz, hx, hz, top) =>
    colliders.push(top === undefined ? { minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz }
      : { minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz, top, stand: Math.min(hx, hz) >= 0.25 });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshLambertMaterial({ color: P.sky }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true;
  scene.add(ground);

  // Roads, lane dashes, crosswalks
  for (const c of ROADS) {
    solid.add(G.box, mat(0, -0.01, c, EDGE * 2, 0.02, ROAD), P.road);
    solid.add(G.box, mat(c, -0.01, 0, ROAD, 0.02, EDGE * 2), P.road);
    for (let p = -EDGE + 1; p < EDGE - 2; p += 4) {
      if (ROADS.some((o) => Math.abs(p + 1 - o) < R + 3.5)) continue;
      solid.add(G.box, mat(p + 1, 0.005, c, 2, 0.02, 0.2), P.paint);
      solid.add(G.box, mat(c, 0.005, p + 1, 0.2, 0.02, 2), P.paint);
    }
  }
  for (const ix of ROADS) for (const iz of ROADS) {
    for (let st = -3.6; st <= 3.6; st += 1.8) for (const s of [-1, 1]) {
      solid.add(G.box, mat(ix + st, 0.006, iz + s * (R + 1.6), 0.9, 0.02, 2.4), P.paint);
      solid.add(G.box, mat(ix + s * (R + 1.6), 0.006, iz + st, 2.4, 0.02, 0.9), P.paint);
    }
  }

  // Sidewalk slabs
  for (const [x0, x1] of SPANS) for (const [z0, z1] of SPANS) {
    solid.add(G.box, mat((x0 + x1) / 2, CURB / 2, (z0 + z1) / 2, x1 - x0, CURB, z1 - z0), P.sidewalk);
    blocks.push({ x0, x1, z0, z1 });
  }

  // ---- props ----
  const treeSolid = new Bucket();
  const props = makeProps(solid, addCollider, CURB, treeSolid);
  const tree = props.roundTree;
  function lamp(x, z) {
    const y = CURB;
    solid.add(G.cyl8, mat(x, y + 0.12, z, 0.4, 0.24, 0.4), P.black);
    solid.add(G.cyl8, mat(x, y + 2.0, z, 0.14, 3.8, 0.14), P.black);
    solid.add(G.box, mat(x, y + 4.05, z, 0.6, 0.35, 0.6), P.lampGlow);
    solid.add(G.box, mat(x, y + 4.3, z, 0.75, 0.12, 0.75), P.black);
    addCollider(x, z, 0.25, 0.25);
  }
  const bench = props.slatBench;

  // Building: light wall, roof cap, windows on the camera-facing faces (+x, +z) and on the front;
  // door + shop window + optional awning/blade sign on the FRONT, which faces the nearest road (facing.js).
  const buildings = [];
  function building({ x0, z0, x1, z1, floors, scheme, door, awning = true, sign = false, name = scheme, kind = 'base' }) {
    const C = SCHEMES[scheme];
    const L = { x0, x1, z0, z1 };
    const face = resolveFace(L, door);
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const h = floors * 3, base = CURB;
    bsolid.add(G.box, mat(cx, base + h / 2, cz, w, h, d), C.body);
    bsolid.add(G.box, mat(cx, base + h + 0.18, cz, w + 0.3, 0.36, d + 0.3), P.roof);
    const faces = new Set(['+x', '+z', face]);
    for (let f = 1; f < floors; f++) {
      const wy = base + f * 3 + 1.7;
      for (const fc of faces) {
        const F = faceFrame(L, fc);
        for (let u = F.lo + 1.5; u <= F.lo + F.len - 1.2; u += 2.2) {
          const [px, pz] = F.pos(u + 0.35 - F.mid, 0.02), [sx, sz] = F.size(1.1, 0.06);
          bsolid.add(G.box, mat(px, wy, pz, sx, 1.4, sz), C.win);
        }
      }
    }
    const F = faceFrame(L, face), put = (u, y, out, along, hh, thick, color, rx = 0, rz = 0) => {
      const [px, pz] = F.pos(u, out), [sx, sz] = F.size(along, thick); bsolid.add(G.box, mat(px, y, pz, sx, hh, sz, 0, rx, rz), color);
    };
    put(-F.len * 0.25, base + 1.15, 0.03, 1.3, 2.3, 0.06, C.door);
    put(F.len * 0.15, base + 1.4, 0.03, F.len * 0.4, 1.5, 0.06, C.win);
    if (awning) { const [rx, rz] = F.tilt(0.22); put(0, base + 2.75, 0.7, F.len * 0.8, 0.14, 1.4, C.accent, rx, rz); }
    if (sign) {
      put(-F.len / 2 + 0.8, base + 4.6, 0.6, 0.14, 1.4, 1.1, C.accent);
      put(-F.len / 2 + 0.8, base + 4.6, 0.1, 0.2, 0.2, 0.2, P.black);
    }
    addCollider(cx, cz, w / 2, d / 2);
    buildings.push({ x0, x1, z0, z1, face, name, kind, base, h });
    return { face, h };
  }

  const S = SIDEWALK, a = R + S, b = 33 - R - S; // inner lot range of the near block: [7.5, 25.5]

  // Near block (+x,+z): fronts face the new +x / +z streets (visible to camera);
  // the corner by the main intersection is a small plaza.
  building({ x0: b - 8, z0: a, x1: b, z1: a + 8, floors: 5, scheme: 'blue', door: 'x', awning: false, sign: true });
  building({ x0: a, z0: b - 8, x1: a + 8, z1: b, floors: 3, scheme: 'pink', door: 'z', sign: true });
  building({ x0: b - 8, z0: b - 8, x1: b, z1: b, floors: 2, scheme: 'butter', door: 'z' });
  tree(a + 3.5, a + 3.5, 1.15);
  bench(a + 6.5, a + 3.5, -Math.PI / 2);
  // Other corners
  building({ x0: -a - 12, z0: -a - 12, x1: -a, z1: -a, floors: 6, scheme: 'teal', door: 'x', sign: true });
  building({ x0: a, z0: -a - 10, x1: a + 10, z1: -a, floors: 4, scheme: 'peach', door: 'z' });
  building({ x0: -a - 10, z0: a, x1: -a, z1: a + 9, floors: 3, scheme: 'white', door: 'x' });
  // Beyond the near streets — low buildings for context
  building({ x0: 33 + a, z0: a + 2, x1: 33 + a + 8, z1: a + 12, floors: 2, scheme: 'pink', awning: false, name: 'pink (east)' });
  building({ x0: a + 2, z0: 33 + a, x1: a + 11, z1: 33 + a + 7, floors: 2, scheme: 'teal', awning: false, name: 'teal (south)' });

  // Trees / lamps / benches on sidewalks
  tree(a + 3, R + 1.2); props.autumnTree(a + 13, R + 1.2, 1.05); props.blossomTree(R + 1.2, a + 13);
  tree(-R - 1.2, -a - 4, 1.1); tree(-a - 5, R + 1.2); props.autumnTree(R + 1.2, -a - 6, 0.95);
  props.conifer(-R - 1.2, -a - 9, 1.0); tree(-R - 1.2, b + 0.2, 1.05); tree(a + 13, -R - 1.2);
  props.conifer(33 - R - 1.2, a + 16, 1.05); props.blossomTree(a + 17, 33 - R - 1.2, 1.05); tree(33 + R + 1.2, a + 16);
  for (const [x, z] of [[R + 1, R + 1], [-R - 1, R + 1], [R + 1, -R - 1], [-R - 1, -R - 1],
    [a + 9, R + 1], [R + 1, a + 9], [-a - 8, -R - 1], [-R - 1, a + 6],
    [33 - R - 1, 33 - R - 1], [33 - R - 1, a + 13], [a + 13, 33 - R - 1], [33 + R + 1, 33 + R + 1]]) lamp(x, z);
  bench(a + 6, R + 0.9, Math.PI); bench(R + 0.9, -a - 2.5, -Math.PI / 2);

  // ---- street detail (densifies the existing blocks; keeps clear of NPC walking lanes) ----
  // Park on the empty lot behind the white building, stretched west to the map edge (20 x 8):
  // wide open east gate onto the x = -6 sidewalk, fountain plaza in the west half.
  props.park(-a - 20, a + 10, -a, b);
  // Bus stop + vending machine + bin on the north sidewalk of the main east-west street
  props.busStop(12.8, -6.75, 0); props.vending(15.9, -6.95, 0); props.bin(9.4, -5.9, 0);
  props.bin(R + 1.0, -a - 4.3, 1); props.blockBench(-R - 0.95, -a - 13, Math.PI / 2, 2.0);
  // South sidewalk: bike rack, bin, sapling; plaza: planter + bush
  props.bikeRack(23.8, 6.55, 0); props.bin(18.4, R + 0.85, 1); props.sapling(R + 1.2, a + 3);
  props.planter(a + 1.3, a + 1.3, COMIC.yellows[1]); props.bush(a + 1.2, a + 7.2, 0.9);
  props.bin(R + 1.0, a + 5.2, 0); props.planter(R + 1.2, b - 1.2, COMIC.pinks[1]);
  // White building: bollards in front of its door, a hedge and a bin
  props.bollard(-R - 0.5, a + 1.2); props.bollard(-R - 0.5, a + 3.4);
  props.bin(-R - 0.8, a + 7.6, 1); props.hedge(-a + 0.45, a + 7.4, 2.6, Math.PI / 2);
  // Blue building: planters flanking the door, sapling, bench along x = 33 street
  props.planter(b + 0.8, a + 1.1, COMIC.pinks[1]); props.planter(b + 0.8, a + 3.9, COMIC.teals[2]);
  props.sapling(33 - R - 1.2, b - 8);
  // Near side of the z = 33 street: concrete bench, bin, railing in front of the butter building
  props.blockBench(a + 6.5, 33 - R - 0.9, Math.PI); props.bin(a + 9.6, 33 - R - 0.8, 0);
  props.railing(b - 2.2, b + 0.45, 3.6, 0);

  addFill({ solid, bsolid, addCollider, props, building, lamp, CURB, scene });

  const cityMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  scene.add(solid.build(cityMat));
  const bMesh = bsolid.build(cityMat); bMesh.name = 'city-buildings'; scene.add(markInk(bMesh));
  const treeMesh = treeSolid.build(cityMat); treeMesh.name = 'city-trees'; scene.add(treeMesh);

  function groundHeight(x, z) {
    for (const k of blocks) if (x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1) return CURB;
    return 0;
  }
  return { colliders, buildings, groundHeight, bounds: { min: -30, max: 46 }, spawn: new THREE.Vector3(0, 0, 0), trees: { mesh: treeMesh, log: props.treeLog, draw: props.treeDraw } };
}
