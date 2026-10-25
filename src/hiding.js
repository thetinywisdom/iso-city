import * as THREE from 'three';

// HIDING BINS: lidded trash cans around the streets, the back alleys and the park edge. Walk up and press E
// (or click a bin) to hop in: the lid rattles, two eyes peek out under it and the HUD says HIDDEN. The cop
// loses you: he runs to where he last saw you, yells WHERE'D HE GO?!, pokes around and gives up. If he's
// watching when you jump in he just pulls you back out. E, WASD, a click or Space pops you out again
// (sometimes wearing a banana peel). Bins are low colliders: you can't walk through them, you can jump on them.
export const BIN = { r: 0.42, h: 1.0, useR: 1.7, clickR: 1.25, yankAfter: 0.7, peelChance: 0.4, peelFor: 6 };
export const BIN_SPOTS = [   // checked clear of buildings, props and NPC walking lanes (see probe in pwtool)
  [6.3, -15.0],     // west side of the peach building, by the mission giver
  [-6.2, -17.5],    // behind the teal tower's corner
  [16.6, -18.4],    // back of the peach building (alley)
  [-10.5, 6.7],     // north wall of the white building, next to the spawn crossing
  [27.45, 12.0],    // beside the blue building on the x = 33 street
  [16.5, 24.6],     // the gap between the pink and butter buildings
  [19.5, 41.2],     // in front of the far teal building
  [-25.0, 21.0],    // park, west edge
];
const COL = { body: '#198085', band: '#194A4C', lid: '#00B4BC', handle: '#194A4C', eye: '#F0F2F4', pupil: '#292C2E', inside: '#292C2E', peel: '#FFE166', peelDk: '#ED8F02', tip: '#4C3F42' };
const YANK = ['OUT YOU COME, PUNK!', 'I SAW THAT, GENIUS!', 'NICE TRY! BINS ARE FOR TRASH!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function buildBin() {
  const m = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const root = new THREE.Group(), body = new THREE.Group();
  const cyl = (r0, r1, h, c, y) => { const me = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 10), m(c)); me.position.y = y; body.add(me); return me; };
  cyl(BIN.r, BIN.r * 0.88, BIN.h - 0.1, COL.body, (BIN.h - 0.1) / 2);
  for (const y of [0.22, 0.62]) cyl(BIN.r + 0.025, BIN.r + 0.025, 0.07, COL.band, y);
  const mouth = cyl(BIN.r - 0.04, BIN.r - 0.04, 0.02, COL.inside, BIN.h - 0.1);
  root.add(body);
  const lid = new THREE.Group(); lid.position.y = BIN.h - 0.1;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(BIN.r + 0.05, BIN.r + 0.05, 0.08, 10), m(COL.lid)); disc.position.y = 0.04; lid.add(disc);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(BIN.r * 0.55, BIN.r + 0.02, 0.1, 10), m(COL.lid)); dome.position.y = 0.13; lid.add(dome);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.08), m(COL.handle)); handle.position.y = 0.21; lid.add(handle);
  root.add(lid);
  // peeking eyes (face the camera: +x/+z), only shown while someone is inside
  const eyes = new THREE.Group(); eyes.visible = false; eyes.position.y = BIN.h - 0.06; eyes.rotation.y = Math.PI / 4;
  const pupils = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.04), m(COL.eye)); w.position.set(s * 0.09, 0, BIN.r - 0.02); eyes.add(w);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.03), m(COL.pupil)); p.position.set(s * 0.09, -0.005, BIN.r + 0.01); eyes.add(p); pupils.push(p);
  }
  root.add(eyes);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(BIN.r + 0.15, BIN.r + 0.15, BIN.h + 0.3, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = (BIN.h + 0.3) / 2; root.add(hit);
  return { root, lid, eyes, pupils, hit, mouth };
}
function buildPeel() {   // banana peel hat: three floppy petals and a stalk
  const m = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const g = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), m(COL.peel)); cap.position.y = 0.05; g.add(cap);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + 0.4, petal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.3), m(i === 1 ? COL.peelDk : COL.peel));
    petal.position.set(Math.sin(a) * 0.17, 0.0, Math.cos(a) * 0.17); petal.rotation.set(0.7 * Math.cos(a), a, -0.7 * Math.sin(a)); g.add(petal);
  }
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), m(COL.tip)); tip.position.y = 0.15; g.add(tip);
  return g;
}

export function initHiding({ scene, camera, city, player, keys, getNPCs, dialogue, combat, police, missions, shadows, pixel }) {
  const state = { hidden: null, hides: 0, yanks: 0, peels: 0, pops: 0 };
  const bins = [];
  BIN_SPOTS.forEach(([x, z], i) => {
    const B = buildBin(), y = city.groundHeight(x, z);
    B.root.position.set(x, y, z); B.root.rotation.y = i * 0.7;
    scene.add(B.root); pixel?.toonify?.(B.root); shadows?.track?.(B.root, 0.5);
    const col = { minX: x - BIN.r, maxX: x + BIN.r, minZ: z - BIN.r, maxZ: z + BIN.r, top: y + BIN.h + 0.12, bin: true };
    city.colliders.push(col);
    bins.push({ id: i, x, z, ...B, col, rattle: 0, peekT: 0, blinkT: 2 });
  });
  for (const b of bins) b.hit.userData.bin = b;

  // ---- HUD ----
  const hud = document.createElement('div'); hud.id = 'hide-hud'; document.body.appendChild(hud);
  let hudKey = '';
  function setHud(k) {
    if (k === hudKey) return; hudKey = k;
    hud.className = k ? 'on ' + k : '';
    hud.innerHTML = k === 'hidden' ? '<b>HIDDEN</b> <span>E / MOVE: POP OUT</span>' : k === 'near' ? '<span>E: HIDE IN BIN</span>' : '';
  }

  const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function nearestBin(r = BIN.useR) {
    let best = null, bd = r;
    for (const b of bins) { const d = Math.hypot(b.x - player.position.x, b.z - player.position.z); if (d < bd) { bd = d; best = b; } }
    return best;
  }

  let peel = null, peelT = 0, yankT = -1;
  function hop(b) {
    if (state.hidden || police.state.mode === 'over' || combat.stun) return false;
    const watched = police.watching();
    state.hidden = b; state.hides++; b.rattle = 0.6; b.peekT = 0;
    removePeel();
    combat.interrupt?.(); actionsClose();
    player.vel.set(0, 0, 0);
    player.position.set(b.x, b.root.position.y + 0.05, b.z);
    player.root.visible = false;
    b.eyes.visible = !watched; b.lid.position.y = BIN.h - 0.1;
    combat.audio?.thud?.(); combat.dustAt?.(new THREE.Vector3(b.x, b.root.position.y + BIN.h, b.z));
    state.doomed = watched;
    if (watched) { yankT = BIN.yankAfter; }   // he saw you climb in: he's coming to pull you out
    setHud(watched ? '' : 'hidden');
    return true;
  }
  function popOut(how = 'self') {
    const b = state.hidden; if (!b) return;
    state.hidden = null; state.doomed = false; yankT = -1; state.pops++;
    b.eyes.visible = false; b.rattle = 0.35; b.lid.position.y = BIN.h - 0.1; b.lid.rotation.set(0, 0, 0);
    // step out on the camera side (toward +x/+z), or away from the cop when yanked
    let dx = 0.7, dz = 0.7;
    const cop = police.cop;
    if (how === 'yank' && cop) { dx = cop.root.position.x - b.x; dz = cop.root.position.z - b.z; }
    const d = Math.hypot(dx, dz) || 1, out = BIN.r + 0.55;
    let px = b.x + dx / d * out, pz = b.z + dz / d * out;
    for (let k = 0; k < 8 && blockedAt(px, pz); k++) { const a = Math.atan2(dz, dx) + (k + 1) * Math.PI / 4; px = b.x + Math.cos(a) * out; pz = b.z + Math.sin(a) * out; }
    player.position.x = px; player.position.z = pz; player.position.y = Math.max(player.position.y, b.root.position.y);
    player.root.visible = true; player.vel.set(0, 0, 0);
    setHud('');
    if (how === 'yank') {
      state.yanks++;
      if (cop) dialogue.shout(cop, pick(YANK), 1800);
      combat.burstAt?.(new THREE.Vector3(b.x, b.root.position.y + 1.2, b.z), 'YOINK!');
      combat.audio?.thud?.();
      police.startChase?.(null);
      return;
    }
    if (how !== 'reset' && Math.random() < BIN.peelChance) addPeel();
  }
  function blockedAt(x, z) {
    for (const c of city.colliders) if (x > c.minX - 0.35 && x < c.maxX + 0.35 && z > c.minZ - 0.35 && z < c.maxZ + 0.35) return true;
    const bd = city.bounds; return x < bd.min || x > bd.max || z < bd.min || z > bd.max;
  }
  function headY() {
    const box = new THREE.Box3().setFromObject(player.model || player.root);
    return Math.max(1.2, box.max.y - player.root.position.y);
  }
  function addPeel() {
    peel = buildPeel(); peel.position.y = headY() - 0.04; peel.rotation.y = Math.random() * 6;
    player.root.add(peel); pixel?.toonify?.(peel); peelT = BIN.peelFor; state.peels++;
  }
  function removePeel() { if (peel) { peel.removeFromParent(); peel = null; } }
  const actionsClose = () => { try { window.__game?.extras?.actions?.closeMenu?.(); } catch {} };

  police.setHiddenFn(() => !!state.hidden && !state.doomed);

  // ---- input ----
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyE' || e.repeat || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    if (state.hidden) { e.stopImmediatePropagation(); e.preventDefault(); if (!state.doomed) popOut(); return; }
    const b = nearestBin(); if (!b) return;
    // a cat right next to you wins over a bin further away (not while the cop is after you, and not your follower cat)
    const cats = window.__game?.extras?.cats?.cats || [];
    const bd = flat(b, player.position);
    if (police.state.mode !== 'chase' && cats.some((c) => c.root && !c.follow && c.mode !== 'follow' && flat(c.root.position, player.position) < Math.min(bd, 1.2))) return;   // on the run, the bin always wins
    e.stopImmediatePropagation(); e.preventDefault();
    hop(b);
  }, true);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickBin(x, y) {
    const cam = window.__game?.camera; if (!cam) return null;
    const r = window.__game.renderer.domElement.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects(bins.map((b) => b.hit), false)[0];
    return h ? h.object.userData.bin : null;
  }
  function request(b) {
    if (state.hidden) { if (!state.doomed) popOut(); return; }
    if (Math.hypot(b.x - player.position.x, b.z - player.position.z) <= BIN.clickR + 0.25) { hop(b); return; }
    combat.approach({ root: b.root, bin: true }, BIN.clickR, () => hop(b));
  }
  const prevPre = dialogue.preClick;
  dialogue.preClick = (x, y) => {
    const b = pickBin(x, y);
    if (b) { request(b); return true; }
    if (state.hidden && !state.doomed) { popOut(); return false; }   // clicking anywhere else pops you out (and walks there)
    return !!prevPre?.(x, y);
  };

  // main.js asks every frame: while hidden the player doesn't move; any move input pops you out
  function control(wantsMove) {
    if (!state.hidden) return false;
    if (wantsMove && !state.doomed) { popOut(); return false; }
    return true;
  }

  // ---- per frame ----
  let last = performance.now();
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => {
    prev.apply(scene, a);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (state.hidden && police.state.mode === 'over') popOut('reset');
    if (yankT > 0 && (yankT -= dt) <= 0) popOut('yank');
    const h = state.hidden;
    if (h) { player.position.x = h.x; player.position.z = h.z; player.vel.set(0, 0, 0); }
    for (const b of bins) {
      if (b.rattle > 0) {
        b.rattle = Math.max(0, b.rattle - dt);
        const k = b.rattle / 0.6, t = now * 0.05;
        b.lid.position.y = BIN.h - 0.1 + Math.abs(Math.sin(t)) * 0.08 * k;
        b.lid.rotation.set(Math.sin(t * 1.3) * 0.18 * k, b.lid.rotation.y, Math.cos(t * 1.1) * 0.18 * k);
        b.root.rotation.z = Math.sin(t * 0.9) * 0.04 * k;
        if (b.rattle === 0) { b.lid.rotation.x = b.lid.rotation.z = 0; b.root.rotation.z = 0; if (h !== b) b.lid.position.y = BIN.h - 0.1; }
      } else if (h === b) {   // peeking: lid propped up on your head, eyes glance around and blink
        b.peekT += dt; b.blinkT -= dt;
        const lift = 0.15 + Math.sin(b.peekT * 1.7) * 0.015;
        b.lid.position.y = BIN.h - 0.1 + lift; b.eyes.position.y = BIN.h - 0.1 + lift * 0.55;
        b.lid.rotation.z = Math.sin(b.peekT * 0.8) * 0.06;
        const look = Math.sin(b.peekT * 1.1) > 0.3 ? 0.025 : Math.sin(b.peekT * 1.1) < -0.3 ? -0.025 : 0;
        for (const p of b.pupils) p.position.x = Math.sign(p.position.x) * 0.09 + look;
        const blink = b.blinkT < 0.12;
        b.eyes.scale.y = blink ? 0.15 : 1;
        if (b.blinkT <= 0) b.blinkT = 1.8 + Math.random() * 2.5;
      }
    }
    if (peel && (peelT -= dt) <= 0) removePeel();
    if (peel && player.airborne) { peel.position.y += dt * 2; if (peel.position.y > headY() + 0.6) removePeel(); }   // jumping shakes it off
    if (!h) setHud(nearestBin(BIN.useR) && police.state.mode !== 'over' ? 'near' : '');
  };
  return { state, bins, hop, popOut, control, request, nearestBin, get hidden() { return !!state.hidden; }, get peel() { return peel; }, BIN };
}
