import * as THREE from 'three';
import { COMIC } from './palette.js?v=20261025d';

// Contact ("blob") shadows that stay visible through occluders.
// When a character walks behind a building its real (shadow-mapped) shadow is
// hidden by the roof, so every tracked character also gets a flat pixel-ish
// ellipse at its feet that is drawn AFTER the opaque world (renderOrder 0.5)
// with depthTest off, but BEFORE the character's ghost (1) and body (2), so the
// character always covers its own blob. Colours are exact palette entries, so
// the pixel quantiser keeps them as-is: a #292C2E core with a #5B6A7B rim, which
// reads on both the roofs (#363E47) and the road (#5B6A7B).
const CORE = COMIC.neutrals[0], RIM = COMIC.neutrals[2];

function blobMesh(r) {
  const g = new THREE.Group();
  const mk = (rad, color, order) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(rad, 10),
      new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = order; m.castShadow = false; m.receiveShadow = false;
    m.frustumCulled = false; m.userData.noToon = true;
    return m;
  };
  g.add(mk(r * 1.25, RIM, 0.5), mk(r, CORE, 0.6));

  return g;
}

export class ContactShadows {
  constructor(scene, city) {
    this.city = city; this.items = []; this.group = new THREE.Group(); scene.add(this.group);
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
      mesh.position.set(p.x, this.city.groundHeight(p.x, p.z) + 0.04, p.z);
      mesh.visible = obj.visible !== false;
      mesh.updateMatrixWorld(true);
    }
  }
}
const _v = new THREE.Vector3();
