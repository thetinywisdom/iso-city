import * as THREE from 'three';
import { addGhosts } from './player.js?v=20261031h';

// STRAY CATS: a handful of pixel strays living around the city and the park. They wander, sit, groom,
// stretch, loaf, get the zoomies, hop up on benches and low walls, flick their tails and meow now and then.
// Pet one (click it, E next to it, or right-click > PET) and it follows you around. If you get into trouble
// (the cop chases you, the bully goes for you, anyone hits back) every follower hisses, poofs up and bolts
// to a hiding spot, and goes back to being a stray: pet it again to win it back. Cats are not NPCs, so you
// can't slap / push / fart on them, and banana peels don't bother them (they just hop over).
export const CAT = { petR: 1.25, eR: 1.9, skittishR: 2.6, follow0: 1.3, followGap: 0.75, spacing: 0.7, hideMin: 8, hideMax: 14 };
const COATS = {
  tabby: { base: '#ED8F02', stripe: '#93616B', belly: '#FFE166', name: 'ORANGE TABBY' },
  grey: { base: '#5B6A7B', stripe: '#363E47', belly: '#A7BFA4', name: 'GREY CAT' },
  tux: { base: '#292C2E', stripe: null, belly: '#F0F2F4', name: 'TUXEDO CAT' },
  calico: { base: '#F0F2F4', stripe: null, belly: '#F0F2F4', patches: ['#ED8F02', '#292C2E'], name: 'CALICO' },
  cream: { base: '#FFF3C1', stripe: '#DF9E89', belly: '#FCF9EB', name: 'CREAM CAT' },
};
const SPOTS = [   // [x, z, coat] — around the park, the plaza, the sidewalks
  [-21.5, 18.6, 'tabby'], [-14.2, 24.6, 'calico'], [-24.8, 22.6, 'grey'],
  [10.2, 12.8, 'cream'], [4.6, -4.6, 'tux'], [-4.6, 4.8, 'grey'], [23.2, 5.4, 'tabby'],
];
const MEOWS = ['meow.', 'mrrp?', 'mew!', 'prrr...', 'mrow.', '*yawn*'];
const PET_LINES = ['purrrr...', 'prrr prrr', 'mrrp! ♥', '*headbutt*'];
const HISS = ['HSSSS!', 'HSSST!!', 'MRRAOW!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const damp = (c, g, r, dt) => c + (g - c) * (1 - Math.exp(-r * dt));
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function buildCat(coat, seed) {
  const C = COATS[coat];
  const m = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const box = (w, h, d, c, parent, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c)); b.position.set(x, y, z); b.castShadow = true; parent.add(b); return b; };
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.set(0, 0.2, -0.17); root.add(body);   // pivots at the rear hips
  const torso = new THREE.Group(); body.add(torso);
  box(0.21, 0.17, 0.44, C.base, torso, 0, 0.06, 0.18);
  box(0.17, 0.05, 0.38, C.belly, torso, 0, -0.03, 0.19);
  if (C.stripe) for (const z of [0.04, 0.14, 0.24, 0.34]) box(0.215, 0.03, 0.04, C.stripe, torso, 0, 0.13, z);
  if (C.patches) { box(0.215, 0.1, 0.14, C.patches[0], torso, 0, 0.1, 0.08); box(0.215, 0.09, 0.12, C.patches[1], torso, 0, 0.11, 0.3); }
  const head = new THREE.Group(); head.position.set(0, 0.15, 0.42); torso.add(head);
  box(0.19, 0.15, 0.16, C.base, head, 0, 0.02, 0.03);
  box(0.11, 0.06, 0.05, C.belly, head, 0, -0.03, 0.12);                  // muzzle
  box(0.03, 0.02, 0.02, '#FF7DAF', head, 0, 0.0, 0.145);                 // nose
  for (const sx of [-1, 1]) {
    box(0.03, 0.035, 0.02, '#292C2E', head, sx * 0.045, 0.04, 0.115);    // eyes
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.08, 4), m(coat === 'calico' && sx > 0 ? C.patches[0] : C.base));
    ear.position.set(sx * 0.06, 0.12, 0.02); ear.rotation.y = Math.PI / 4; ear.castShadow = true; head.add(ear);
  }
  const legs = [];
  for (const [x, z] of [[-0.07, 0.36], [0.07, 0.36], [-0.07, 0.02], [0.07, 0.02]]) {
    const g = new THREE.Group(); g.position.set(x, 0.0, z); torso.add(g);
    box(0.055, 0.2, 0.055, C.base, g, 0, -0.1, 0);
    box(0.06, 0.035, 0.07, coat === 'tux' || coat === 'calico' ? '#F0F2F4' : C.belly, g, 0, -0.19, 0.01);
    legs.push(g);
  }
  const tail = []; let par = torso, tz = -0.03;
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group(); g.position.set(0, i ? 0 : 0.1, i ? -0.09 : tz); par.add(g);
    box(0.05, 0.05, 0.1, C.stripe && i === 3 ? C.stripe : C.base, g, 0, 0, -0.045);
    tail.push(g); par = g;
  }
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.05), new THREE.MeshBasicMaterial({ visible: false })); // generous: easy to click
  hit.position.set(0, 0.3, 0); root.add(hit);
  return { root, body, torso, head, legs, tail, hit, coat: C };
}

export function initCats({ scene, city, player, getNPCs, dialogue, combat, actions, police, pixel }) {
  const hooks = {};   // story.js can override a cat's voice (day 5: they bark)
  const state = { pets: 0, scatters: 0, trouble: 0, lastTrouble: null };
  const cats = [];
  const tmp = new THREE.Vector3();
  const blocked = (x, z, r = 0.25) => {
    const b = city.bounds; if (x < b.min || x > b.max || z < b.min || z > b.max) return true;
    for (const c of city.colliders) if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return c;
    return false;
  };
  const free = (x, z, r = 0.3) => !blocked(x, z, r);
  function nearestFree(x, z) {
    for (let rr = 0; rr < 4; rr += 0.4) for (let a = 0; a < 12; a++) {
      const px = x + Math.cos(a / 12 * Math.PI * 2) * rr, pz = z + Math.sin(a / 12 * Math.PI * 2) * rr;
      if (free(px, pz, 0.35)) return [px, pz];
    }
    return [x, z];
  }
  // perches: low colliders (benches, planters, bins, the fruit stand) a cat can hop onto
  const perches = city.colliders.filter((c) => c.top !== undefined && c.top < 1.3 && (c.maxX - c.minX) < 4 && (c.maxZ - c.minZ) < 4);

  SPOTS.forEach(([x, z, coat], i) => {
    const [px, pz] = nearestFree(x, z);
    const M = buildCat(coat, i);
    M.root.position.set(px, city.groundHeight(px, pz), pz); M.root.rotation.y = Math.random() * 6.28;
    M.root.scale.setScalar(1.2); scene.add(M.root); pixel?.toonify?.(M.root); addGhosts(M.root);
    const cat = { id: i, cat: true, ...M, tag: null, bubbleY: 1.05, home: new THREE.Vector3(px, 0, pz), heading: M.root.rotation.y,
      mode: 'idle', pose: 'sit', t: 1 + Math.random() * 3, speed: 0, target: null, y: M.root.position.y, perch: null,
      follow: false, slot: 0, sniffT: 0, poof: 0, phase: Math.random() * 6, flick: 0, meowT: 8 + Math.random() * 25, startleT: 0,
      p: { pitch: 0, low: 0, roll: 0, headX: 0, headY: 0, tailUp: 0.6, legFold: 0, groom: 0, arch: 0 } };
    cat.menuItems = [['pet', 'PET']];
    cat.onChoose = () => petRequest(cat);
    cats.push(cat);
  });
  const followers = () => cats.filter((c) => c.follow);

  // ---- picking (left click = pet, right click = PET menu) ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const camera = () => window.__game?.camera;
  function pickCat(x, y) {
    const cam = camera(); if (!cam) return null;
    const r = (window.__game.renderer.domElement).getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects(cats.map((c) => c.hit), false)[0];
    return h ? cats.find((c) => c.hit === h.object) : null;
  }
  const prevPre = dialogue.preClick;
  dialogue.preClick = (x, y) => { const c = pickCat(x, y); if (c) { petRequest(c); return true; } return !!prevPre?.(x, y); };
  if (actions?.hooks) actions.hooks.pickExtra = pickCat;
  dialogue.hoverables?.push((x, y) => { const c = pickCat(x, y); return c ? { target: c, label: 'PET' } : null; });
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyE' || e.repeat || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    let best = null, bd = CAT.eR;
    for (const c of cats) { const d = c.root.position.distanceTo(player.position); if (d < bd && !c.follow) { bd = d; best = c; } }
    if (!best) for (const c of cats) { const d = c.root.position.distanceTo(player.position); if (d < bd) { bd = d; best = c; } }
    if (best) petRequest(best);
  });

  function petRequest(c) {
    if (c.mode === 'hide' || c.mode === 'flee' || c.poof > 0) { dialogue.show(c, pick(HISS), 1100); return; }
    if (c.mode !== 'follow') { c.mode = 'await'; c.t = 6; c.speed = 0; }
    let reach = CAT.petR;
    if (c.perch) {   // up on a bench/wall: the player can only stand at its edge, so reach over it
      const b = c.perch, p = c.root.position, ex = Math.min(p.x - b.minX, b.maxX - p.x), ez = Math.min(p.z - b.minZ, b.maxZ - p.z);
      reach = Math.max(reach, Math.min(ex, ez) + 1.0);
    }
    const pp = player.position, cp = c.root.position;
    if (Math.hypot(cp.x - pp.x, cp.z - pp.z) <= reach + 0.6) { pet(c); return; }   // already close enough: just pet
    combat.approach(c, reach, () => pet(c));
  }
  function pet(c) {
    state.pets++;
    combat.hold(1.1, c.root.position);
    if (c.perch) { c.perch = null; }
    c.mode = 'petted'; c.t = 1.2; c.pose = 'sit'; c.speed = 0;
    c.heading = Math.atan2(player.position.x - c.root.position.x, player.position.z - c.root.position.z);
    dialogue.show(c, pick(PET_LINES), 1500);
    hearts(c);
    combat.audio?.pop?.();
  }
  // floating pixel hearts
  const HEART = ['.XX.XX.', 'XPPXPPX', 'XPPPPPX', '.XPPPX.', '..XPX..', '...X...'];
  function heartCanvas() {
    const cv = document.createElement('canvas'); cv.width = 7; cv.height = 6; const x = cv.getContext('2d');
    HEART.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') { x.fillStyle = ch === 'P' ? '#FF5491' : '#A92D59'; x.fillRect(i, j, 1, 1); } }));
    cv.className = 'cat-heart'; return cv;
  }
  const floaters = [];
  function hearts(c) { for (let i = 0; i < 4; i++) { const el = heartCanvas(); document.body.appendChild(el); floaters.push({ el, c, t: -i * 0.18, dx: (i - 1.5) * 0.22 }); } }

  // ---- HUD ----
  const hud = document.createElement('div'); hud.id = 'cat-hud';
  const icon = document.createElement('canvas'); icon.width = 9; icon.height = 7;
  { const x = icon.getContext('2d'); ['X.......X', 'XX.....XX', 'XXXXXXXXX', 'XOXXXXXOX', 'XXXXPXXXX', '.XXXXXXX.', '..XXXXX..']
    .forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') { x.fillStyle = ch === 'O' ? '#292C2E' : ch === 'P' ? '#FF7DAF' : '#ED8F02'; x.fillRect(i, j, 1, 1); } })); }
  hud.appendChild(icon); const hudTxt = document.createElement('span'); hud.appendChild(hudTxt); document.body.appendChild(hud);
  let hudN = -1;
  function renderHud() { const n = followers().length; if (n === hudN) return; hudN = n; hud.style.display = n ? 'flex' : 'none'; hudTxt.textContent = ` x${n} FOLLOWING`; }

  // ---- trouble: every follower scatters ----
  function trouble(why) {
    state.lastTrouble = why;
    const fs = followers(); if (!fs.length) return;
    state.trouble++;
    for (const c of fs) scatter(c);
  }
  function scatter(c) {
    state.scatters++;
    c.follow = false; c.mode = 'poof'; c.t = 0.55 + Math.random() * 0.25; c.poof = 1; c.speed = 0; c.perch = null;
    c.heading = Math.atan2(player.position.x - c.root.position.x, player.position.z - c.root.position.z);
    dialogue.show(c, pick(HISS), 1300);
    // a hiding spot: away from the player, 8-14 m, ideally tucked next to something
    const p = c.root.position;
    let best = null;
    for (let k = 0; k < 40 && !best; k++) {
      const away = Math.atan2(p.x - player.position.x, p.z - player.position.z) + (Math.random() - 0.5) * 2.2;
      const d = CAT.hideMin + Math.random() * (CAT.hideMax - CAT.hideMin);
      const x = p.x + Math.sin(away) * d, z = p.z + Math.cos(away) * d;
      if (free(x, z, 0.35) && (k > 25 || blocked(x, z, 1.2))) best = [x, z];
    }
    c.hideAt = best ? new THREE.Vector3(best[0], 0, best[1]) : c.home.clone();
  }
  let wiredNPCs = null, prevPolice = 'idle';
  function wire() {
    const npcs = getNPCs(); if (!npcs || wiredNPCs === npcs) return; wiredNPCs = npcs;
    npcs.on('hitPlayer', () => trouble('hit'));
    npcs.on('playerTrip', () => trouble('trip'));
    npcs.on('caught', () => trouble('caught'));
  }

  // ---- behaviour ----
  function chooseIdle(c) {
    const r = Math.random();
    c.perch = null;
    if (r < 0.28) { c.mode = 'wander'; c.target = wanderTarget(c); c.t = 8; }
    else if (r < 0.42) { c.mode = 'idle'; c.pose = 'sit'; c.t = 3 + Math.random() * 4; }
    else if (r < 0.54) { c.mode = 'idle'; c.pose = 'groom'; c.t = 3 + Math.random() * 3; }
    else if (r < 0.62) { c.mode = 'idle'; c.pose = 'stretch'; c.t = 1.6; }
    else if (r < 0.74) { c.mode = 'idle'; c.pose = 'loaf'; c.t = 5 + Math.random() * 6; }
    else if (r < 0.82) { c.mode = 'idle'; c.pose = 'lie'; c.t = 5 + Math.random() * 6; }
    else if (r < 0.9) { c.mode = 'zoom'; c.t = 1.4 + Math.random() * 1.2; c.target = wanderTarget(c, 6); }
    else { const pr = nearPerch(c); if (pr) { c.mode = 'toPerch'; c.perchC = pr; c.target = perchEdge(c, pr); c.t = 10; } else { c.mode = 'idle'; c.pose = 'sit'; c.t = 3; } }
  }
  function wanderTarget(c, R = 5) {
    for (let k = 0; k < 20; k++) {
      const a = Math.random() * 6.28, d = 1.5 + Math.random() * R;
      const x = c.home.x + Math.cos(a) * d, z = c.home.z + Math.sin(a) * d;
      if (free(x, z, 0.3) && lineFree(c.root.position, x, z)) return new THREE.Vector3(x, 0, z);
    }
    return c.home.clone();
  }
  function lineFree(p, x, z) { for (let i = 1; i <= 8; i++) { const u = i / 8; if (blocked(p.x + (x - p.x) * u, p.z + (z - p.z) * u, 0.22)) return false; } return true; }
  function nearPerch(c) {
    let best = null, bd = 7;
    for (const pc of perches) { const cx = (pc.minX + pc.maxX) / 2, cz = (pc.minZ + pc.maxZ) / 2, d = Math.hypot(cx - c.root.position.x, cz - c.root.position.z); if (d < bd && !cats.some((o) => o.perch === pc || o.perchC === pc && o !== c)) { bd = d; best = pc; } }
    return best;
  }
  function perchEdge(c, pc) {
    const cx = (pc.minX + pc.maxX) / 2, cz = (pc.minZ + pc.maxZ) / 2, p = c.root.position;
    const a = Math.atan2(p.x - cx, p.z - cz), hw = (pc.maxX - pc.minX) / 2, hd = (pc.maxZ - pc.minZ) / 2;
    for (let k = 0; k < 8; k++) {
      const aa = a + k * 0.8 * (k % 2 ? 1 : -1);
      const x = cx + Math.sin(aa) * (hw + 0.45), z = cz + Math.cos(aa) * (hd + 0.45);
      if (free(x, z, 0.22)) return new THREE.Vector3(x, 0, z);
    }
    return null;
  }

  function steer(c, tx, tz, speed, dt, stopR = 0.15) {
    const p = c.root.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < stopR) { c.speed = damp(c.speed, 0, 10, dt); return true; }
    const want = Math.atan2(dx, dz);
    c.heading += angDiff(c.heading, want) * Math.min(1, dt * (speed > 4 ? 12 : 7));
    c.speed = damp(c.speed, speed, 6, dt);
    const s = c.speed * dt, mx = Math.sin(c.heading) * s, mz = Math.cos(c.heading) * s;
    if (!c.perch) {
      if (free(p.x + mx, p.z + mz, 0.22)) { p.x += mx; p.z += mz; }
      else if (free(p.x + mx, p.z, 0.22)) p.x += mx;
      else if (free(p.x, p.z + mz, 0.22)) p.z += mz;
      else { c.stuck = (c.stuck || 0) + dt; }
    }
    return false;
  }

  function update(dt) {
    wire();
    const pol = police?.state?.mode || 'idle';
    if (pol === 'chase' && prevPolice !== 'chase') trouble('cop');
    prevPolice = pol;
    const npcs = getNPCs();
    if (npcs && followers().length) {
      for (const n of npcs.list) if (n.mode === 'chase' && !n.down && n.root.position.distanceTo(player.position) < 30) { trouble(n.special === 'bully' ? 'bully' : n.landlady ? 'landlady' : 'chase'); break; }
      if (combat.down) trouble('down');
    }
    const pv = player.vel ? Math.hypot(player.vel.x, player.vel.z) : 0;
    const fl = followers();
    for (const c of cats) {
      const p = c.root.position;
      c.t -= dt; c.phase += dt; c.poof = Math.max(0, c.poof - dt * 0.35);
      const dp = Math.hypot(p.x - player.position.x, p.z - player.position.z);
      // skittish: a strayer bolts a few metres if you run right past it
      if (!c.follow && c.mode !== 'await' && c.mode !== 'petted' && c.mode !== 'poof' && c.mode !== 'flee' && c.mode !== 'hide' && dp < CAT.skittishR && pv > 4.2 && c.startleT <= 0) {
        c.startleT = 4; c.perch = null; c.mode = 'startle'; c.t = 1.1; c.hop = 0.25;
        const a = Math.atan2(p.x - player.position.x, p.z - player.position.z);
        c.target = new THREE.Vector3(p.x + Math.sin(a) * 3.2, 0, p.z + Math.cos(a) * 3.2);
        if (!free(c.target.x, c.target.z)) c.target = wanderTarget(c, 3);
        if (Math.random() < 0.5) dialogue.show(c, 'mrrOW!', 900);
      }
      c.startleT -= dt;
      let pose = 'walk';
      switch (c.mode) {
        case 'idle': pose = c.pose; if (c.t <= 0) chooseIdle(c); c.speed = damp(c.speed, 0, 8, dt); break;
        case 'wander': if (steer(c, c.target.x, c.target.z, 0.9, dt) || c.t <= 0 || c.stuck > 0.6) { c.stuck = 0; c.mode = 'idle'; c.pose = Math.random() < 0.5 ? 'sit' : 'loaf'; c.t = 2 + Math.random() * 3; } break;
        case 'zoom': {
          if (Math.random() < dt * 2.2 || c.stuck > 0.2) { c.stuck = 0; c.target = wanderTarget(c, 6); }
          steer(c, c.target.x, c.target.z, 6.2, dt, 0.4);
          if (c.t <= 0) { c.mode = 'idle'; c.pose = 'sit'; c.t = 2.5; }
          break;
        }
        case 'startle': if (steer(c, c.target.x, c.target.z, 5.5, dt, 0.3) || c.t <= 0) { c.mode = 'idle'; c.pose = 'sit'; c.t = 2 + Math.random() * 2; } break;
        case 'toPerch': {
          if (!c.target) { c.mode = 'idle'; c.t = 1; break; }
          if (steer(c, c.target.x, c.target.z, 1.1, dt, 0.2)) {   // hop up
            const pc = c.perchC; c.perch = pc; c.perchC = null; c.hop = 0.35;
            p.x = THREE.MathUtils.clamp(p.x, pc.minX + 0.2, pc.maxX - 0.2); p.z = THREE.MathUtils.clamp(p.z, pc.minZ + 0.2, pc.maxZ - 0.2);
            p.x = (p.x + (pc.minX + pc.maxX) / 2) / 2; p.z = (p.z + (pc.minZ + pc.maxZ) / 2) / 2;
            c.mode = 'perched'; c.pose = Math.random() < 0.5 ? 'sit' : 'loaf'; c.t = 6 + Math.random() * 8;
          } else if (c.t <= 0 || c.stuck > 0.6) { c.stuck = 0; c.perchC = null; c.mode = 'idle'; c.t = 1; }
          break;
        }
        case 'perched': pose = c.pose; c.speed = 0; if (c.t <= 0) { const e = perchEdge(c, c.perch); c.perch = null; c.hop = 0.3; if (e) { p.x = e.x; p.z = e.z; } chooseIdle(c); } break;
        case 'await': pose = 'sit'; c.speed = damp(c.speed, 0, 10, dt);
          c.heading += angDiff(c.heading, Math.atan2(player.position.x - p.x, player.position.z - p.z)) * Math.min(1, dt * 4);
          if (combat.target !== c && c.t < 5.8 && Math.hypot(player.position.x - p.x, player.position.z - p.z) < 2.4) { pet(c); break; }   // walk-up got blocked (bench, fence) but we're close: reach over
          if (c.t <= 0) { c.mode = 'idle'; c.t = 1; } break;
        case 'petted': pose = 'sit'; c.p.headY = Math.sin(c.phase * 6) * 0.25; if (c.t <= 0) { c.follow = true; c.mode = 'follow'; c.home.copy(p); } break;
        case 'follow': pose = followStep(c, fl.indexOf(c), dt); break;
        case 'poof': pose = 'poof'; c.speed = 0; if (c.t <= 0) { c.mode = 'flee'; c.t = 7; } break;
        case 'flee': if (steer(c, c.hideAt.x, c.hideAt.z, 6.4, dt, 0.4) || c.t <= 0 || c.stuck > 0.8) { c.stuck = 0; c.mode = 'hide'; c.t = 5 + Math.random() * 3; c.home.copy(p); } break;
        case 'hide': pose = 'loaf'; c.speed = 0; if (c.t <= 0) { c.mode = 'idle'; c.pose = 'sit'; c.t = 2; } break;
        default: c.mode = 'idle';
      }
      if (c.mode === 'wander' || c.mode === 'zoom' || c.mode === 'flee' || c.mode === 'startle' || c.mode === 'toPerch') pose = c.speed > 0.15 ? 'walk' : 'sit';
      if (c.mode === 'follow' && pose === 'walk' && c.speed < 0.1) pose = 'sit';
      // meow now and then (when on screen-ish)
      c.meowT -= dt;
      if (c.meowT <= 0) { c.meowT = 18 + Math.random() * 30; if (dp < 16 && c.mode !== 'flee' && c.mode !== 'poof') dialogue.show(c, hooks.voice?.(c) || pick(MEOWS), 1400); }
      if (Math.random() < dt * 0.4) c.flick = 1;
      animate(c, pose, dt);
    }
    // keep followers apart
    for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) {
      const a = fl[i].root.position, b = fl[j].root.position, dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d > 0.001 && d < CAT.spacing) { const k = (CAT.spacing - d) * 0.5, ux = dx / d * k, uz = dz / d * k;
        if (free(a.x - ux, a.z - uz, 0.22)) { a.x -= ux; a.z -= uz; } if (free(b.x + ux, b.z + uz, 0.22)) { b.x += ux; b.z += uz; } }
    }
    renderHud();
    placeFloaters(dt);
  }

  function followStep(c, idx, dt) {
    const p = c.root.position, h = player.heading || 0;
    // slots trail behind you in a loose staggered line
    const back = CAT.follow0 + idx * CAT.followGap, side = (idx % 2 ? 1 : -1) * (0.35 + 0.15 * idx);
    const tx = player.position.x - Math.sin(h) * back + Math.cos(h) * side * 0.6;
    const tz = player.position.z - Math.cos(h) * back - Math.sin(h) * side * 0.6;
    const d = Math.hypot(tx - p.x, tz - p.z), dpl = Math.hypot(player.position.x - p.x, player.position.z - p.z);
    if (dpl > 40) { const [fx, fz] = nearestFree(tx, tz); p.x = fx; p.z = fz; return 'sit'; }   // teleported away: catch up off-screen
    if (c.sniffT > 0) { c.sniffT -= dt; c.speed = damp(c.speed, 0, 10, dt); return 'sniff'; }
    if (d > 0.7 && dpl < 3.2 && Math.random() < dt * 0.12) { c.sniffT = 0.8 + Math.random() * 1.2; return 'sniff'; }
    if (d < 0.45 || dpl < 0.9) { c.speed = damp(c.speed, 0, 6, dt); return c.speed < 0.3 ? (c.restT = (c.restT || 0) + dt, c.restT > 4 ? 'loaf' : 'sit') : 'walk'; }
    c.restT = 0;
    const pv = player.vel ? Math.hypot(player.vel.x, player.vel.z) : 0;
    const sp = d > 5 ? Math.max(6.5, pv + 1.5) : d > 2 ? Math.max(2.4, pv + 0.8) : Math.max(1.0, Math.min(pv + 0.4, 2.4));
    steer(c, tx, tz, sp, dt, 0.35);
    if (c.stuck > 1.2) { c.stuck = 0; const [fx, fz] = nearestFree(tx, tz); if (lineFree(p, fx, fz)) { p.x = fx; p.z = fz; } }
    return 'walk';
  }

  // ---- pose animation (damped towards per-pose targets) ----
  const POSES = {
    walk: { pitch: 0, low: 0, roll: 0, headX: 0, tailUp: 0.55, legFold: 0, groom: 0, arch: 0 },
    sit: { pitch: -0.62, low: -0.02, roll: 0, headX: 0.5, tailUp: -0.2, legFold: 0, groom: 0, arch: 0 },
    groom: { pitch: -0.62, low: -0.02, roll: 0, headX: 0.9, tailUp: -0.2, legFold: 0, groom: 1, arch: 0 },
    stretch: { pitch: 0.32, low: -0.02, roll: 0, headX: -0.25, tailUp: 1.0, legFold: 0, groom: 0, arch: -0.3 },
    loaf: { pitch: 0, low: -0.15, roll: 0, headX: 0.05, tailUp: -0.05, legFold: 1, groom: 0, arch: 0 },
    lie: { pitch: 0, low: -0.13, roll: 1.25, headX: 0.25, tailUp: -0.05, legFold: 0.4, groom: 0, arch: 0 },
    sniff: { pitch: 0.12, low: -0.02, roll: 0, headX: -0.55, tailUp: 0.35, legFold: 0, groom: 0, arch: 0 },
    poof: { pitch: 0, low: 0.05, roll: 0, headX: 0.2, tailUp: 1.45, legFold: 0, groom: 0, arch: 0.6 },
  };
  function animate(c, pose, dt) {
    const T = POSES[pose] || POSES.walk, P = c.p, R = pose === 'poof' ? 18 : 6;
    for (const k of Object.keys(T)) P[k] = damp(P[k], T[k], R, dt);
    const p = c.root.position;
    // height: ground / perch + hop arc
    const gy = c.perch ? c.perch.top : city.groundHeight(p.x, p.z);
    c.y = damp(c.y, gy, c.hop > 0 ? 9 : 20, dt);
    let hopY = 0; if (c.hop > 0) { c.hop -= dt; hopY = Math.sin(Math.max(0, c.hop) / 0.35 * Math.PI) * 0.35; }
    p.y = c.y + hopY;
    c.root.rotation.y = c.heading;
    const walk = Math.min(1, c.speed / 1.2), run = Math.min(1, Math.max(0, (c.speed - 2.5) / 3));
    const hz = 2.2 + c.speed * 1.6; c.gait = (c.gait || 0) + dt * hz * walk;
    const s = Math.sin(c.gait * Math.PI * 2);
    c.body.rotation.x = P.pitch + (run ? Math.sin(c.gait * Math.PI * 2) * 0.12 * run : 0);
    c.body.rotation.z = P.roll;
    c.body.position.y = 0.2 + P.low + P.arch * 0.04 + Math.abs(s) * 0.02 * walk;
    const poofS = 1 + c.poof * 0.22; c.torso.scale.set(poofS, poofS * (1 + P.arch * 0.08), 1);
    c.head.rotation.x = P.headX - (pose === 'sit' || pose === 'groom' ? 0.5 : 0) * 0 + (pose === 'groom' ? Math.sin(c.phase * 7) * 0.18 : 0) + (pose === 'sniff' ? Math.sin(c.phase * 14) * 0.05 : 0);
    c.head.rotation.x -= P.pitch;   // keep the head level when the body tips up to sit
    c.head.rotation.y = pose === 'groom' ? 0.5 : (c.mode === 'petted' ? c.p.headY : damp(c.head.rotation.y, 0, 4, dt));
    c.legs.forEach((g, i) => {
      const front = i < 2, ph = (i === 0 || i === 3) ? 0 : Math.PI;
      let rx = Math.sin(c.gait * Math.PI * 2 + ph + (run && front ? 0.6 : 0)) * (0.55 + run * 0.35) * walk;
      rx -= P.pitch * (front ? 1 : 0.2);                         // front legs stay vertical when sitting
      if (!front && P.pitch < -0.2) rx += 1.1 * Math.min(1, -P.pitch / 0.6);   // haunches tuck under
      if (pose === 'stretch' && front) rx -= 0.8;
      if (front && i === 0 && P.groom > 0.5) rx -= 1.3 + Math.sin(c.phase * 7) * 0.15;   // paw up to the face
      g.rotation.x = rx;
      g.scale.y = (front && P.pitch < -0.2 ? 1.25 : 1) * (1 - P.legFold * 0.75);
    });
    c.flick = Math.max(0, c.flick - dt * 2.5);
    c.tail.forEach((g, i) => {
      g.rotation.x = i === 0 ? -P.tailUp : -P.tailUp * 0.18 + (P.tailUp > 0.3 ? 0.25 : -0.1);
      g.rotation.y = Math.sin(c.phase * (pose === 'poof' ? 18 : 2) + i * 0.7) * (0.12 + c.flick * 0.5) * (i + 1) * 0.5;
      if (pose === 'loaf' || pose === 'lie') g.rotation.y = 0.5 + Math.sin(c.phase + i) * 0.05 + c.flick * 0.3;
    });
  }
  function placeFloaters(dt) {
    const cam = camera(); if (!cam) return;
    const cv = window.__game.renderer.domElement, w = cv.clientWidth, h = cv.clientHeight;
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.t += dt;
      if (f.t > 1.3) { f.el.remove(); floaters.splice(i, 1); continue; }
      if (f.t < 0) { f.el.style.visibility = 'hidden'; continue; }
      tmp.copy(f.c.root.position); tmp.x += f.dx; tmp.y += 0.6 + f.t * 0.9; tmp.project(cam);
      const x = Math.round(((tmp.x + 1) / 2 * w) / 3) * 3, y = Math.round(((1 - tmp.y) / 2 * h) / 3) * 3;
      f.el.style.visibility = 'visible'; f.el.style.opacity = f.t > 0.9 ? String(1 - (f.t - 0.9) / 0.4) : '1';
      f.el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }
  // cursor hint
  window.addEventListener('pointermove', (e) => { if (e.target === window.__game?.renderer?.domElement && pickCat(e.clientX, e.clientY)) e.target.style.cursor = 'pointer'; });

  let last = performance.now();
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt);
    prev.apply(scene, a);
  };
  return { cats, state, followers, pet, petRequest, trouble, scatter, pickCat, COATS, hooks };
}
