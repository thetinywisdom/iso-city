// Story mode: the loop starts to show its seams. Each day stacks on the one before.
//   DAY 5: trees spin in place, stray cats BARK, a few buildings get an iridescent holographic shimmer.
//   DAY 6: + the shady guy talks weird, random people get deja vu.
//   DAY 7: + the shady guy (and the odd stranger) tells you to WAKE UP.
import * as THREE from 'three';
import { COMIC } from './palette.js?v=20261031o';
import { Bucket } from './bucket.js?v=20261031o';

const { blues: B, pinks: K, teals: T, yellows: Y } = COMIC;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const SHADY_WEIRD = ['job job job. take the job. the job.', 'you look like you\'ve played this before.', '.boj a deen uoy ,yeh', 'press E to... no wait. wrong game.',
  'the save file says you were here yesterday.', 'same job. same job. same jo-', 'i\'m just a line of dialogue, man.', 'don\'t stare at the edge of the map too long.', 'who\'s holding the controller? you? or YOU?'];
export const DEJA = ['Haven\'t we done this already?', 'I swear I\'ve lived this Tuesday 40 times.', 'You again? ...same shirt, same face.'];
export const WAKE = ['Wake up. It\'s about time.', 'Tick tock. Wake up.', 'The machine is hungry. Wake up.'];

export function initGlitch({ scene, city, player, getNPCs, dialogue, combat, cats, pixel }) {
  const G = { day: 0, spin: false, holo: false, barks: 0, weird: 0, deja: 0, wake: 0 };
  const noInk = scene.userData.noInk || (scene.userData.noInk = new Set());

  // ---------- spinning trees: the baked trees swap for instanced copies that can turn ----------
  const spinG = new THREE.Group(); spinG.name = 'glitch-trees'; spinG.visible = false; scene.add(spinG);
  const spinners = [];   // { mesh, items: [{x,y,z,s,a,w}] }
  let built = false;
  function buildSpinners() {
    built = true;
    const T0 = city.trees; if (!T0?.log?.length) return;
    const mat = T0.mesh.material, byKind = {};
    for (const t of T0.log) (byKind[t.kind] ||= []).push(t);
    for (const [kind, list] of Object.entries(byKind)) {
      const bk = new Bucket(); T0.draw[kind](bk, 0, 0, 1, 0);
      const geo = bk.build(mat).geometry;
      const m = new THREE.InstancedMesh(geo, mat, list.length); m.castShadow = true; m.receiveShadow = true; m.name = 'glitch-trees-' + kind;
      const items = list.map((t, i) => ({ ...t, a: Math.random() * 6.283, w: (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 2.6), ph: Math.random() * 6.283 }));
      spinners.push({ mesh: m, items }); spinG.add(m);
    }
    pixel?.toonify?.(spinG);
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function spinTick(dt, now) {
    for (const sp of spinners) {
      sp.items.forEach((t, i) => {
        // spin in bursts: whirl, slow, whirl again
        const burst = 0.35 + 0.65 * Math.max(0, Math.sin(now / 900 + t.ph));
        t.a += t.w * burst * dt;
        _p.set(t.x, t.y, t.z); _q.setFromAxisAngle(UP, t.a); _s.setScalar(t.s);
        sp.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      });
      sp.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  function setSpin(on) {
    if (on && !built) buildSpinners();
    on = on && spinners.length > 0;
    G.spin = on; spinG.visible = on;
    if (city.trees?.mesh) city.trees.mesh.visible = !on;
  }

  // ---------- holographic buildings: an iridescent shell over a few of them (their own outlines stay) ----------
  const holoMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, c0: { value: new THREE.Color(B[3]) }, c1: { value: new THREE.Color(K[3]) }, c2: { value: new THREE.Color(T[3]) }, c3: { value: new THREE.Color(Y[3]) } },
    vertexShader: 'varying vec3 vW, vN, vV; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uT; uniform vec3 c0, c1, c2, c3; varying vec3 vW, vN, vV;
      void main(){ float f = 1.0 - abs(dot(vN, vV));
        float h = fract(vW.y * 0.22 + (vW.x + vW.z) * 0.07 + f * 0.8 - uT * 0.25);
        vec3 c = h < 0.25 ? mix(c0, c1, h * 4.0) : h < 0.5 ? mix(c1, c2, (h - 0.25) * 4.0) : h < 0.75 ? mix(c2, c3, (h - 0.5) * 4.0) : mix(c3, c0, (h - 0.75) * 4.0);
        float scan = step(0.82, fract(vW.y * 2.2 - uT * 1.6));
        gl_FragColor = vec4(c, 0.42 + 0.25 * f + 0.2 * scan); }` });
  const holoG = new THREE.Group(); holoG.name = 'glitch-holo'; holoG.visible = false; scene.add(holoG);
  const holoPicks = [];
  {
    const bs = (city.buildings || []).filter((b) => b.h > 0);
    const step = Math.max(1, Math.floor(bs.length / 6));
    for (let i = 0; i < bs.length && holoPicks.length < 6; i += step) holoPicks.push(bs[(i + 1) % bs.length]);
    for (const b of holoPicks) {
      const w = b.x1 - b.x0 + 0.14, d = b.z1 - b.z0 + 0.14, h = b.h + 0.6;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), holoMat);
      m.position.set((b.x0 + b.x1) / 2, (b.base || 0) + h / 2 - 0.02, (b.z0 + b.z1) / 2); m.renderOrder = 4; m.userData.building = b.name;
      holoG.add(m); noInk.add(m);
    }
  }
  function setHolo(on) { G.holo = on; holoG.visible = on; }

  // ---------- cats bark ----------
  let barkT = 4;
  if (cats?.hooks) cats.hooks.voice = (c) => (G.day >= 5 ? (combat.audio?.bark?.(), G.barks++, 'WOOF!') : null);
  function barkTick(dt) {
    if ((barkT -= dt) > 0) return;
    barkT = 5 + Math.random() * 5;
    const pp = player.position; let best = null, bd = 18;
    for (const c of cats?.cats || []) { if (c.mode === 'poof' || !c.root) continue; const d = c.root.position.distanceTo(pp); if (d < bd) { bd = d; best = c; } }
    if (!best) return;
    dialogue.show(best, pick(['WOOF!', 'WOOF! WOOF!', 'BARK!', 'ARF!']), 1500); G.barks++;
    combat.audio?.bark?.(Math.max(0.25, 1 - bd / 18));
  }

  // ---------- day 6+: the shady guy + deja vu; day 7: wake up ----------
  const shady = () => getNPCs()?.list.find((n) => n.special === 'giver' && !n.removed);
  let talkT = 6;
  function talkTick(dt) {
    if ((talkT -= dt) > 0) return;
    talkT = (G.day >= 7 ? 7 : 9) + Math.random() * 5;
    const pp = player.position, s = shady();
    if (s && !s.mode && s.root.position.distanceTo(pp) < 22 && Math.random() < 0.6) {
      const line = G.day >= 7 ? pick(WAKE) : pick(SHADY_WEIRD);
      dialogue.show(s, line, 3600); G.day >= 7 ? G.wake++ : G.weird++; return;
    }
    const near = (getNPCs()?.list || []).filter((n) => !n.mode && !n.special && !n.story && !n.down && n.root.position.distanceTo(pp) < 13);
    const n = near[Math.floor(Math.random() * near.length)]; if (!n) return;
    if (G.day >= 7 && Math.random() < 0.35) { dialogue.show(n, pick(['wake up.', 'psst. wake up.', 'it\'s about time.']), 2600); G.wake++; }
    else { dialogue.show(n, pick(DEJA), 3200); G.deja++; }
  }
  /** story.js asks first when picking a click/hover line */
  function pickLine(n) {
    if (G.day < 6) return null;
    if (n.special === 'giver') { if (G.day >= 7 && Math.random() < 0.7) { G.wake++; return pick(WAKE); } G.weird++; return pick(SHADY_WEIRD); }
    if (!n.special && !n.story && Math.random() < 0.35) { G.deja++; return pick(DEJA); }
    return null;
  }

  /** per frame from story.js. day = the story day while the loop is live, 0 otherwise */
  function tick(dt, now, day) {
    G.day = day || 0;
    const on5 = G.day >= 5;
    if (on5 !== G.spin) setSpin(on5);
    if (on5 !== G.holo) setHolo(on5);
    if (!on5) return;
    holoMat.uniforms.uT.value = now / 1000;
    spinTick(dt, now);
    barkTick(dt);
    if (G.day >= 6) talkTick(dt);
  }
  return { G, tick, pickLine, setSpin, setHolo, holoPicks, spinners, holoG, spinG };
}
