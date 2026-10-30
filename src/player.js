import * as THREE from 'three';
import { P } from './palette.js?v=20261031d';

// Silhouette shown only where the player is hidden behind buildings.
const ghostMat = new THREE.MeshBasicMaterial({ color: P.ghost, depthWrite: false });
ghostMat.depthFunc = THREE.GreaterDepth;

export function addGhosts(obj) {
  const meshes = [];
  obj.traverse((o) => { if (o.isMesh && !o.userData.isGhost) meshes.push(o); });
  for (const m of meshes) {
    m.castShadow = true;
    m.renderOrder = 2;
    const g = new THREE.Mesh(m.geometry, ghostMat);
    g.userData.isGhost = true;
    g.renderOrder = 1;
    g.castShadow = false;
    m.add(g); // inherits transforms + animation of the source mesh
  }
}

// Placeholder: orange capsule with a peach "face" marker so facing is readable.
function createPlaceholder() {
  const g = new THREE.Group();
  const flat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 10), flat(P.placeholder));
  body.position.y = 0.87;
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.12), flat(P.placeholderFace));
  face.position.set(0, 1.38, 0.38);
  g.add(body, face);
  return g;
}

// Jump tuning: ~1.3 units high (clears fences / bushes / benches), short anticipation crouch, no double jump.
export const JUMP = { height: 1.3, gravity: 36, anticipation: 0.08, airControl: 2.5 };

// Wraps whatever character model is used. Character modules are expected to
// return either a THREE.Object3D or { object3d|mesh|root, update(dt, state) }.
export class Player {
  constructor(model = null) {
    this.root = new THREE.Group();
    this.heading = 0;
    this.walkAmt = 0;
    this.phase = 0;
    this.turn = 0;
    // vertical physics (feet height = root.position.y)
    this.vy = 0; this.grounded = true; this.antic = -1;
    this.vel = new THREE.Vector3();           // horizontal momentum
    this.setModel(model);
  }

  setModel(model) {
    if (this.model) this.root.remove(this.model);
    let obj = null, update = null;
    if (model && model.isObject3D) { obj = model; update = model.userData?.character?.update ? model.userData.character : null; }
    else if (model) { obj = model.root || model.object3d || model.mesh || model.group; update = model; }
    this.char = model && !model.isObject3D ? model : model?.userData?.character || null;   // for the head anchor (bubbles)
    this.isPlaceholder = !obj;
    this.model = obj || createPlaceholder();
    // characters.js API: character.update(dt, { speed, grounded, vy, crouch, turn })
    this.modelUpdate = update && typeof update.update === 'function' ? (dt, st) => update.update(dt, st) : null;
    addGhosts(this.model);
    this.root.add(this.model);
  }

  get position() { return this.root.position; }
  get airborne() { return !this.grounded; }
  get crouch() { return this.antic >= 0 ? Math.min(1, this.antic / JUMP.anticipation) : 0; }

  /** Space: anticipation crouch, then takeoff. Ignored while airborne/crouching (no double jump). */
  jump() {
    if (!this.grounded || this.antic >= 0) return false;
    this.antic = 0;
    return true;
  }

  /** Vertical step: gravity while airborne, curb step-smoothing while grounded. groundY = floor height here. */
  stepVertical(dt, groundY) {
    const p = this.root.position;
    if (this.antic >= 0) {
      this.antic += dt;
      if (this.antic >= JUMP.anticipation) {
        this.antic = -1; this.grounded = false;
        this.vy = Math.sqrt(2 * JUMP.gravity * JUMP.height);
        p.y = Math.max(p.y, groundY);
      }
    }
    if (!this.grounded) {
      this.vy -= JUMP.gravity * dt;
      p.y += this.vy * dt;
      if (p.y <= groundY && this.vy <= 0) { p.y = groundY; this.vy = 0; this.grounded = true; }
      else if (p.y < groundY) p.y = groundY;          // rising past a raised sidewalk edge
    } else if (p.y - groundY > 0.3) {
      this.grounded = false; this.vy = 0;             // walked off a bench / fountain rim: fall
    } else {
      p.y += (groundY - p.y) * Math.min(1, dt * 20);  // existing step-height smoothing
    }
  }

  animate(dt, moving, running, targetHeading, speed = 0) {
    const prev = this.heading;
    if (moving && targetHeading !== null) {
      let diff = targetHeading - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.heading += diff * Math.min(1, dt * (this.grounded ? 14 : 5));
    }
    const rate = dt > 0 ? (this.heading - prev) / dt : 0;
    this.turn += (rate - this.turn) * Math.min(1, dt * 10);
    this.root.rotation.y = this.heading;
    const goal = moving ? (running ? 1.3 : 1) : 0;
    this.walkAmt += (goal - this.walkAmt) * Math.min(1, dt * 10);
    this.phase += dt * (running ? 13 : 9.5) * Math.min(1, this.walkAmt + 0.001);

    if (this.modelUpdate) {
      this.modelUpdate(dt, { speed: moving ? speed : 0, grounded: this.grounded, vy: this.vy, crouch: this.crouch, turn: this.turn });
    } else if (this.isPlaceholder) {
      // simple bob + lean for the capsule
      this.model.position.y = Math.abs(Math.sin(this.phase)) * 0.12 * this.walkAmt;
      this.model.rotation.x = 0.1 * this.walkAmt;
      this.model.rotation.z = Math.sin(this.phase) * 0.06 * this.walkAmt;
    }
  }
}
