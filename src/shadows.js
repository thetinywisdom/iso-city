import * as THREE from 'three';
import { COMIC } from './palette.js?v=20261031h';

// Contact ("blob") shadows: a flat ellipse at each tracked character's feet.
// They live on the ground only: depth-tested against the world (so a character,
// bin or prop standing in front of / on top of a blob fully hides it), never
// write depth, sit just above the ground with a polygonOffset (no z-fighting),
// and draw early in the transparent pass (renderOrder -1) at 50% opacity.
// Core disc + non-overlapping rim ring, so the blob is one even 50% tone.
// The group is in scene.userData.noInk, so it never touches the building ink.
const CORE = COMIC.neutrals[0], RIM = COMIC.neutrals[2];
export const SHADOW_OPACITY = 0.5;

function blobMesh(r) {
  const g = new THREE.Group();
  const mat = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: SHADOW_OPACITY,
    depthTest: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const mk = (geo, color) => {
    const m = new THREE.Mesh(geo, mat(color));
    m.rotation.x = -Math.PI / 2; m.renderOrder = -1; m.castShadow = false; m.receiveShadow = false;
    m.frustumCulled = false; m.userData.noToon = true; m.userData.blobShadow = true;
    return m;
  };
  g.add(mk(new THREE.RingGeometry(r, r * 1.25, 10), RIM), mk(new THREE.CircleGeometry(r, 10), CORE));
  return g;
}

export class ContactShadows {
  constructor(scene, city) {
    this.city = city; this.items = []; this.group = new THREE.Group(); scene.add(this.group);
    this.group.name = 'contact-shadows';
    (scene.userData.noInk || (scene.userData.noInk = new Set())).add(this.group);
    // Re-position just before every render pass (after main.js has moved characters).
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = (...args) => { prev.apply(scene, args); this.update(); };
  }
  track(obj, r = 0.42) {
    if (!obj || this.items.some((i) => i.obj === obj)) return;
    const mesh = blobMesh(r); this.group.add(mesh); this.items.push({ obj, mesh });
  }
  update() {
    for (let i = this.items.length - 1; i >= 0; i--) {   // drop shadows of removed characters
      const it = this.items[i]; if (it.obj.isObject3D && !it.obj.parent) { it.mesh.removeFromParent(); this.items.splice(i, 1); }
    }
    for (const { obj, mesh } of this.items) {
      const p = obj.getWorldPosition ? obj.getWorldPosition(_v) : obj;
      mesh.position.set(p.x, this.city.groundHeight(p.x, p.z) + 0.03, p.z);
      mesh.visible = obj.visible !== false;
      mesh.updateMatrixWorld(true);
    }
  }
}
const _v = new THREE.Vector3();
