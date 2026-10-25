import * as THREE from 'three';

// Collects many small static meshes (with per-object vertex colour) and bakes
// them into a single BufferGeometry -> one draw call per material.
const _c = new THREE.Color();
const cache = new WeakMap();
function nonIndexed(geo) {
  if (!geo.index) return geo;
  let g = cache.get(geo);
  if (!g) { g = geo.toNonIndexed(); cache.set(geo, g); }
  return g;
}

export class Bucket {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; }

  add(geo, matrix, color) {
    const g = nonIndexed(geo).clone();
    g.applyMatrix4(matrix);
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    const uv = g.attributes.uv ? g.attributes.uv.array : null;
    _c.set(color);
    const count = p.length / 3;
    for (let i = 0; i < count; i++) {
      this.pos.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      this.nor.push(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
      if (uv) this.uv.push(uv[i * 2], uv[i * 2 + 1]); else this.uv.push(0.02, 0.02);
      this.col.push(_c.r, _c.g, _c.b);
    }
    g.dispose();
  }

  build(material, { cast = true, receive = true } = {}) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();
export function mat(x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
