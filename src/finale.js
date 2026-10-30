// Story mode, chapter 7: the landlady's hidden house and the 7:00 finale.
// The house shows up once all 7 oddities are found. Inside: a 7:00 timer, a landlady who is faster than you
// and dodges, a time machine (a black hole floating in the middle of the room), a bowl of bananas and (soon enough) Officer Dough.
// Slap her (F) to stun her, push her (E) into the black hole. GIVE UP any time: ACCEPT FATE.
import * as THREE from 'three';
import { COMIC } from './palette.js?v=20261031m';
import { box, sign } from './growth.js?v=20261031m';

const { blues: B, pinks: K, teals: T, warm: W, neutrals: N, yellows: Y } = COMIC;
export const HOUSE = { x0: -28, x1: -21, z0: 8.5, z1: 14, door: { x: -24.5, z: 14.9, r: 1.1 } };
export const HX = 110, HZ = 0;
const RW = 9, RD = 7;                                   // room half-size
export const PAD = { x: HX, z: HZ, r: 1.6 };              // the black hole: shove her under it
export const BH = { y: 2.7, core: 1.1, pull: 5.5, pullSpeed: 0.5, minD: 1.2 };
export const ENTRY = { x: HX + 6.5, z: HZ + 5.5 };
export const BOWL = { x: HX + 3, z: HZ - 6.1, r: 1.7 };
export const TIME = 420;
export const TUNE = { llSpeed: 7.8, notice: 3.6, rest: 0.75, tiredRest: 1.7, dizzy: 3.2, copAt: 45, copAtSnitch: 20, copBack: 25, thrownOut: 60, pushR: 2.0, slapR: 1.7 };
const SPOTS = [[-5, 4.5], [-7, 1], [-3, -4.5], [1, -4.8], [4.5, -2], [7, -4.5], [2.5, 2.5], [-1, 5], [6.5, 1.5], [-4.5, -1.5], [-7.2, -1.8]].map(([x, z]) => ({ x: HX + x, z: HZ + z }));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function initFinale(ctx) {
  const { scene, city, player, getNPCs, dialogue, combat, actions, police, bananas, pixel, LANDLADY_DEF } = ctx;
  const F = { active: false, won: false, t: TIME, ll: null, baby: null, dizzy: 0, rest: 0, goal: null, stuck: 0, dashes: 0, copCalled: false, copT: 0, copOut: 0, copHome: null,
    stuns: 0, pushes: 0, thrown: 0, gaveUp: 0, suck: null, babyT: 6, doorIn: false, bowlT: 0 };
  const gy = (x, z) => city.groundHeight(x, z);
  const toon = (g) => pixel?.toonify?.(g);

  // ---------------- the house (outside) ----------------
  const outside = new THREE.Group(); outside.name = 'landlady-house'; outside.visible = false; scene.add(outside);
  {
    const L = HOUSE, w = L.x1 - L.x0, d = L.z1 - L.z0, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, y0 = gy(cx, cz);
    const body = new THREE.Group(); body.position.set(cx, y0, cz); body.rotation.z = 0.035; outside.add(body);   // crooked
    box(body, 0, 2.3, 0, w, 4.6, d, K[2]);
    box(body, 0, 5.0, 0, w + 0.5, 0.8, d + 0.5, N[0]);
    box(body, -0.8, 6.0, -0.4, w - 1.6, 1.2, d - 1.2, K[0], 0.06);
    box(body, 1.8, 6.9, 0.6, 0.7, 1.6, 0.7, N[4]);                                     // chimney
    box(body, HOUSE.door.x - cx, 1.15, d / 2 + 0.04, 1.3, 2.3, 0.08, K[0]);           // door, +z face
    box(body, HOUSE.door.x - cx + 0.4, 1.2, d / 2 + 0.1, 0.16, 0.16, 0.06, Y[1]);      // knob
    for (const u of [-2.4, 1.8]) box(body, u, 2.9, d / 2 + 0.04, 1.2, 1.1, 0.06, B[3]);
    box(body, w / 2 + 0.04, 2.9, -0.8, 0.06, 1.1, 1.4, B[3]);
    sign(body, 'RENT', HOUSE.door.x - cx, 2.75, d / 2 + 0.1, 1.4, 0.5, 0, N[0], Y[1]);
    body.traverse((m) => m.layers.enable(5));   // the house exterior is a building: it keeps its ink
  }
  const outCol = { minX: HOUSE.x0, maxX: HOUSE.x1, minZ: HOUSE.z0, maxZ: HOUSE.z1, house: 'outside' };
  toon(outside);
  function showHouse(on) {
    outside.visible = !!on;
    const i = city.colliders.indexOf(outCol);
    if (on && i < 0) { city.colliders.push(outCol); unstick(outCol); }
    if (!on && i >= 0) city.colliders.splice(i, 1);
  }
  function unstick(c) {   // anyone standing where the house appears gets nudged out the front
    for (const n of getNPCs()?.list || []) { const p = n.root.position; if (p.x > c.minX - 0.4 && p.x < c.maxX + 0.4 && p.z > c.minZ - 0.4 && p.z < c.maxZ + 0.4) { p.x = HOUSE.door.x + (Math.random() - 0.5) * 3; p.z = c.maxZ + 1.2; } }
  }

  // ---------------- the room (inside, far east of the city in the void) ----------------
  const room = new THREE.Group(); room.name = 'landlady-room'; room.visible = false; scene.add(room);
  const roomCols = [];
  const solid = (x0, x1, z0, z1, top = null) => roomCols.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, top: top ?? undefined, house: 'room' });
  let bh = null;
  {
    const y = 0;
    box(room, HX, y - 0.6, HZ, 90, 1, 90, N[0]).receiveShadow = false;                     // the void
    box(room, HX, y - 0.05, HZ, RW * 2, 0.1, RD * 2, W[2]);                                // floor
    for (let i = -RW + 1; i < RW; i += 2) box(room, HX + i, y + 0.005, HZ, 0.06, 0.02, RD * 2, W[3]);   // floorboards
    box(room, HX - 1.5, y + 0.02, HZ + 0.5, 7, 0.03, 5, K[1]);                              // rug
    // back walls tall (-z, -x: the camera looks from +x,+z), front walls low so you can see in
    box(room, HX, 2.5, HZ - RD - 0.15, RW * 2 + 0.6, 5, 0.3, K[2]); solid(HX - RW - 0.3, HX + RW + 0.3, HZ - RD - 0.3, HZ - RD);
    box(room, HX - RW - 0.15, 2.5, HZ, 0.3, 5, RD * 2 + 0.6, K[3]); solid(HX - RW - 0.3, HX - RW, HZ - RD - 0.3, HZ + RD + 0.3);
    box(room, HX, 0.35, HZ + RD + 0.15, RW * 2 + 0.6, 0.7, 0.3, K[2]); solid(HX - RW - 0.3, HX + RW + 0.3, HZ + RD, HZ + RD + 0.3, 0.7);
    box(room, HX + RW + 0.15, 0.35, HZ, 0.3, 0.7, RD * 2 + 0.6, K[3]); solid(HX + RW, HX + RW + 0.3, HZ - RD - 0.3, HZ + RD + 0.3, 0.7);
    for (let u = -RW + 1.5; u < RW; u += 3) box(room, HX + u, 4.0, HZ - RD + 0.02, 1.4, 1.0, 0.04, K[0]);   // wallpaper hearts (squares)
    sign(room, 'RENT IS DUE', HX + 2, 3.4, HZ - RD + 0.03, 3.6, 0.9, 0, K[0], Y[2]);
    sign(room, 'NO REFUNDS', HX - RW + 0.03, 3.4, HZ + 2.5, 3.2, 0.8, Math.PI / 2, N[0], Y[1]);
    // sofa (back wall), table + banana bowl, tv, clock
    box(room, HX - 2.5, 0.45, HZ - RD + 0.8, 3.6, 0.9, 1.2, B[1]); box(room, HX - 2.5, 1.1, HZ - RD + 0.35, 3.6, 0.9, 0.35, B[0]); solid(HX - 4.3, HX - 0.7, HZ - RD, HZ - RD + 1.4, 1.2);
    box(room, BOWL.x, 0.4, BOWL.z, 1.6, 0.8, 1.0, W[3]); solid(BOWL.x - 0.8, BOWL.x + 0.8, BOWL.z - 0.5, BOWL.z + 0.5, 0.8);
    box(room, BOWL.x, 0.92, BOWL.z, 0.8, 0.22, 0.6, T[2]);
    for (const [dx, dz] of [[-0.2, 0], [0.12, -0.1], [0.05, 0.14]]) box(room, BOWL.x + dx, 1.1, BOWL.z + dz, 0.34, 0.12, 0.12, Y[1], dx * 3);
    box(room, HX + 7.6, 0.6, HZ - RD + 0.7, 2.0, 1.2, 0.9, N[1]); box(room, HX + 7.6, 1.75, HZ - RD + 0.55, 1.8, 1.1, 0.2, N[0]); box(room, HX + 7.6, 1.75, HZ - RD + 0.67, 1.5, 0.8, 0.04, T[3]); solid(HX + 6.5, HX + 8.7, HZ - RD, HZ - RD + 1.2, 1.2);
    box(room, HX - RW + 0.4, 0.5, HZ + 4.5, 0.8, 1.0, 1.6, Y[2]); solid(HX - RW, HX - RW + 0.8, HZ + 3.7, HZ + 5.3, 1.0);   // side table
  }
  toon(room);
  // ---------------- the time machine: a black hole in the middle of the room ----------------
  {
    const noInk = scene.userData.noInk || (scene.userData.noInk = new Set());
    const g = new THREE.Group(); g.name = 'black-hole'; g.position.set(PAD.x, BH.y, PAD.z); room.add(g);
    const col = (c) => new THREE.Color(c);
    const core = new THREE.Mesh(new THREE.SphereGeometry(BH.core, 28, 18), new THREE.MeshBasicMaterial({ color: N[0] }));
    core.name = 'bh-core'; g.add(core);
    // the swirling accretion ring: comic purples -> pinks -> oranges, banded and turning
    const diskMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uA: { value: col(K[0]) }, uB: { value: col(K[1]) }, uC: { value: col(Y[0]) }, uD: { value: col(Y[2]) }, uR0: { value: BH.core * 1.18 }, uR1: { value: BH.core * 3.0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uT, uR0, uR1; uniform vec3 uA, uB, uC, uD; varying vec2 vP;
        void main(){ float r = length(vP), k = clamp((r - uR0) / (uR1 - uR0), 0.0, 1.0), a = atan(vP.y, vP.x);
          float sw = sin(a * 3.0 + k * 9.0 - uT * 3.2) * 0.5 + 0.5;
          float band = step(0.5, fract(k * 4.0 + sw * 0.6 - uT * 0.35));
          vec3 c = k < 0.33 ? mix(uD, uC, k * 3.0) : k < 0.66 ? mix(uC, uB, (k - 0.33) * 3.0) : mix(uB, uA, (k - 0.66) * 3.0);
          c = mix(c, uA, band * 0.35);
          float al = (1.0 - smoothstep(0.75, 1.0, k)) * smoothstep(0.0, 0.06, k) * (0.62 + 0.38 * sw);
          gl_FragColor = vec4(c, al); }` });
    const disk = new THREE.Mesh(new THREE.RingGeometry(BH.core * 1.18, BH.core * 3.0, 72, 1), diskMat);
    disk.name = 'bh-disk'; disk.rotation.x = -Math.PI / 2 + 0.42; disk.renderOrder = 2; g.add(disk); noInk.add(disk);
    // the bright photon ring hugging the core (gets an outline: it is solid)
    const halo = new THREE.Mesh(new THREE.TorusGeometry(BH.core * 1.06, 0.07, 6, 48), new THREE.MeshBasicMaterial({ color: Y[1] }));
    halo.rotation.x = -Math.PI / 2 + 0.42; g.add(halo);
    // lensing shimmer: a fresnel shell that wobbles colour at the rim
    const lensMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      uniforms: { uT: { value: 0 }, uA: { value: col(K[2]) }, uB: { value: col(T[2]) }, uC: { value: col(Y[1]) } },
      vertexShader: 'varying vec3 vN, vV; varying vec3 vW; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vW = position; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform float uT; uniform vec3 uA, uB, uC; varying vec3 vN, vV, vW;
        void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); float w = sin(vW.y * 9.0 + uT * 4.0 + sin(vW.x * 7.0 - uT * 3.0)) * 0.5 + 0.5;
          vec3 c = mix(mix(uA, uB, w), uC, smoothstep(0.7, 1.0, f));
          gl_FragColor = vec4(c, f * (0.55 + 0.35 * w)); }` });
    const lens = new THREE.Mesh(new THREE.SphereGeometry(BH.core * 1.5, 28, 18), lensMat);
    lens.name = 'bh-lens'; lens.renderOrder = 3; g.add(lens); noInk.add(lens);
    // particles spiralling in
    const NP = 140, pos = new Float32Array(NP * 3), colr = new Float32Array(NP * 3), pts = [];
    const pcs = [K[1], K[2], Y[0], Y[1], Y[2], W[2]].map(col);
    for (let i = 0; i < NP; i++) { pts.push({ a: Math.random() * 6.283, r: BH.core * (1.2 + Math.random() * 3.2), h: (Math.random() - 0.5) * 0.5, s: 0.5 + Math.random() * 0.9 }); const c = pcs[i % pcs.length]; colr.set([c.r, c.g, c.b], i * 3); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    const points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, depthWrite: false }));
    points.name = 'bh-points'; points.rotation.x = 0.42; g.add(points); noInk.add(points);
    // its shadow on the rug
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(BH.core * 1.3, 28), new THREE.MeshBasicMaterial({ color: K[0], transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(PAD.x, 0.035, PAD.z); room.add(shadow); noInk.add(shadow);
    bh = { g, core, disk, halo, lens, points, pts, diskMat, lensMat, shadow, pulse: 0 };
  }
  const flashEl = document.createElement('div'); flashEl.id = 'bh-flash'; document.body.appendChild(flashEl);
  function flash() { flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on'); }
  function bhTick(dt, now) {
    if (!bh || !room.visible) return;
    const t = now / 1000;
    bh.diskMat.uniforms.uT.value = t; bh.lensMat.uniforms.uT.value = t;
    bh.disk.rotation.z -= dt * 1.4; bh.halo.rotation.z += dt * 0.8;
    bh.pulse = Math.max(0, bh.pulse - dt * 1.5);
    const sc = 1 + Math.sin(t * 2.2) * 0.04 + bh.pulse * 0.35; bh.g.scale.setScalar(sc);
    bh.g.position.y = BH.y + Math.sin(t * 1.3) * 0.12;
    const P = bh.points.geometry.attributes.position;
    bh.pts.forEach((p, i) => {
      p.a += dt * p.s * (2.6 / Math.max(0.4, p.r)); p.r -= dt * p.s * 0.55;
      if (p.r < BH.core * 1.02) { p.r = BH.core * (3.0 + Math.random() * 1.4); p.a = Math.random() * 6.283; }
      P.setXYZ(i, Math.cos(p.a) * p.r, p.h * (p.r / 3), Math.sin(p.a) * p.r);
    });
    P.needsUpdate = true;
  }
  // a gentle pull on whoever stands near it (never quite into it)
  function pullTick(dt) {
    if (!F.active || ctx.isBusy() || player.vel?.y > 0.5) return;
    const p = player.position, dx = PAD.x - p.x, dz = PAD.z - p.z, d = Math.hypot(dx, dz);
    if (d > BH.pull || d < BH.minD) return;
    const step = Math.min(d - BH.minD, BH.pullSpeed * (1 - d / BH.pull) * 1.6 * dt);
    p.x += dx / d * step; p.z += dz / d * step;
  }
  // the city's edge: while you're inside, the bounds grow to reach the room; these keep the city crowd in
  const EDGE = [{ minX: 46, maxX: 47.5, minZ: -32, maxZ: 48 }, { minX: -32, maxX: 48, minZ: 46, maxZ: 47.5 }].map((c) => ({ ...c, house: 'edge' }));
  const B0 = { ...city.bounds };
  function roomOn(on) {
    room.visible = on;
    for (const c of [...roomCols, ...EDGE]) { const i = city.colliders.indexOf(c); if (on && i < 0) city.colliders.push(c); if (!on && i >= 0) city.colliders.splice(i, 1); }
    city.bounds.min = B0.min; city.bounds.max = on ? HX + RW + 4 : B0.max;
  }

  // ---------------- HUD: timer + GIVE UP ----------------
  const hudEl = document.createElement('div'); hudEl.id = 'finale-hud';
  hudEl.innerHTML = '<div class="fh-t">7:00</div><div class="fh-k">F SLAP · E PUSH · B BANANA</div><button class="mo-btn fh-give">GIVE UP</button>';
  document.body.appendChild(hudEl);
  hudEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  hudEl.querySelector('.fh-give').addEventListener('click', (e) => { e.stopPropagation(); askGiveUp(); });
  const timerEl = hudEl.querySelector('.fh-t');
  function hud() { hudEl.classList.toggle('on', F.active); timerEl.textContent = fmt(F.t); timerEl.classList.toggle('low', F.t < 60); }

  // ---------------- the landlady (finale brain) ----------------
  const stars = new THREE.Group(); stars.visible = false; scene.add(stars);
  for (let i = 0; i < 3; i++) box(stars, 0, 0, 0, 0.16, 0.16, 0.16, Y[1]).castShadow = false;
  toon(stars);
  function spawnLL() {
    const npcs = getNPCs();
    const n = npcs._wrap(npcs.charMod.createCustom({ ...LANDLADY_DEF, id: 'finale-landlady' }), 9002);
    const x = HX - 4, z = HZ + 2;
    Object.assign(n, { tag: 'LANDLADY', important: true, story: 'landlady', finale: true, landlady: true, lines: ['RENT!'], walker: false, idleT: 0, temper: 'timid' });
    n.root.position.set(x, gy(x, z) + 0.02, z);
    n.heading = n.root.rotation.y = Math.atan2(ENTRY.x - x, ENTRY.z - z); n.home = { x, z, heading: n.heading };
    n.drive = drive;
    npcs.list.push(n); npcs.toonify?.(n.root);
    F.ll = n; F.dizzy = 0; F.rest = 0; F.goal = null; F.dashes = 0;
    return n;
  }
  function drop(n) {
    if (!n) return; const npcs = getNPCs(); n.root.removeFromParent(); n.removed = true;
    const i = npcs.list.indexOf(n); if (i >= 0) npcs.list.splice(i, 1);
  }
  function pickGoal(p, pp) {
    let best = null, bs = -Infinity;
    for (const s of SPOTS) {
      const vx = s.x - p.x, vz = s.z - p.z, len = Math.hypot(vx, vz); if (len < 1.5) continue;
      const wx = pp.x - p.x, wz = pp.z - p.z, along = (wx * vx + wz * vz) / len;
      const perp = Math.abs(wx * vz - wz * vx) / len;
      let sc = Math.hypot(s.x - pp.x, s.z - pp.z) + Math.random() * 1.5;
      if (along > 0 && along < len + 0.5 && perp < 1.6) sc -= 8;                     // don't run past the player
      if (len > 11) sc -= 2;
      if (sc > bs) { bs = sc; best = s; }
    }
    return best;
  }
  function drive(dt, pp, npcs) {
    const n = F.ll, p = n.root.position;
    n.mode = null; n.stagger = null; n.chaseCfg = null;
    if (!F.active) return 0;
    const dx0 = pp.x - p.x, dz0 = pp.z - p.z, dpl = Math.hypot(dx0, dz0);
    if (F.dizzy > 0) { n.root.rotation.y += dt * 5; n.targetHeading = n.root.rotation.y; return 0; }
    if (F.rest > 0) { F.rest -= dt; n.targetHeading = Math.atan2(dx0, dz0); return 0; }
    if (F.goal) {
      const dx = F.goal.x - p.x, dz = F.goal.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.2) {
        F.goal = null; F.dashes++;
        const tired = F.dashes % 3 === 0;
        F.rest = tired ? TUNE.tiredRest : TUNE.rest;
        if (tired) dialogue.shout(n, pick(['huff... huff...', 'my KNEES...', 'hold on... RENT...']), 1500);
        else if (Math.random() < 0.5) dialogue.shout(n, pick(['RENT!', 'RENT!!', 'TOO SLOW, DEAR!', 'PAY UP!']), 1100);
        return 0;
      }
      const step = Math.min(d, TUNE.llSpeed * dt);
      const moved = npcs._move(p, dx / d * step, dz / d * step);
      n.targetHeading = Math.atan2(dx, dz);
      F.stuck = moved < step * 0.3 ? F.stuck + dt : 0;
      if (F.stuck > 0.3) { F.stuck = 0; F.goal = null; }
      return TUNE.llSpeed;
    }
    if (dpl < TUNE.notice) { F.goal = pickGoal(p, pp); if (Math.random() < 0.3) dialogue.shout(n, pick(['NOPE!', 'HEHE!', 'NOT TODAY!']), 900); return 0; }
    n.targetHeading = Math.atan2(dx0, dz0);
    return 0;
  }
  function onSlap(n) {
    if (!F.active || n !== F.ll || F.suck) return;
    F.dizzy = TUNE.dizzy; F.goal = null; F.rest = 0; F.stuns++;
    dialogue.shout(n, pick(['OW! MY PERM!', 'WHY YOU LITTLE-', '@#$%!']), 1500);
    if (!F.copCalled) setTimeout(() => F.active && !F.copCalled && callCop('OFFICER! OFFICER DOUGH!'), 600);
  }
  let wired = null;
  function wire() {
    const npcs = getNPCs(); if (!npcs || wired === npcs) return; wired = npcs;
    npcs.on('slap', onSlap);
    npcs.on('push', (n) => { if (n === F.ll) F.pushes++; });
  }

  // ---------------- Officer Dough: the landlady's accomplice ----------------
  function callCop(line) {
    const cop = police.cop; if (!cop || !F.active) return;
    F.copCalled = true; F.copOut = 0;
    if (!F.copHome) F.copHome = { x: cop.home?.x ?? cop.root.position.x, z: cop.home?.z ?? cop.root.position.z };
    if (F.ll && line) dialogue.shout(F.ll, line, 1800);
    const x = HX + 8, z = HZ + 6.2;
    cop.down = null; cop.fly = null;
    cop.root.position.set(x, gy(x, z) + 0.02, z);
    combat.dustAt?.(cop.root.position); combat.audio?.thud?.();
    police.startChase('OFFICER DOUGH, ON THE CASE!');
    ctx.toast('THE LANDLADY CALLED OFFICER DOUGH!');
  }
  function copAway() {
    const cop = police.cop; if (!cop || !F.copHome) return;
    if (police.state.mode === 'chase') police.callOff(null, 0.2);
    cop.down = null; cop.fly = null; cop.chaseCfg = null; cop.mode = null; cop.stagger = null;
    cop.root.position.set(F.copHome.x, gy(F.copHome.x, F.copHome.z) + 0.02, F.copHome.z);
    getNPCs()?.goHome?.(cop);
  }
  // busted inside: thrown out of the room, the clock loses a minute, the cop comes back later
  function thrownOut() {
    F.thrown++; F.t = Math.max(1, F.t - TUNE.thrownOut);
    copAway(); F.copOut = TUNE.copBack; F.copCalled = true;
    ctx.fadeTo('BACK IN!', () => { tpPlayer(ENTRY.x, ENTRY.z); hud(); }, 1000);
  }

  // ---------------- enter / leave ----------------
  function tpPlayer(x, z) { player.position.set(x, gy(x, z) + 0.02, z); player.vel?.set(0, 0, 0); }
  function doorPrompt() {
    const S = ctx.S();
    if (S.phase === 'after') { ctx.toast('CLOSED. FOREVER.'); return; }
    if (ctx.missions.active) { ctx.toast('FINISH THE JOB FIRST'); return; }
    ctx.card({ head: 'THE LANDLADY\'S HOUSE', lines: ['the door is open a crack. something inside goes tick... tick...', 'once you\'re in: 7:00 on the clock.', 'F: slap her dizzy. E: push her into the black hole.', 'bananas help. she\'s fast. GIVE UP any time.'],
      buttons: [['GO IN [ENTER]', enter, true], ['NOT YET [ESC]', () => {}]] });
  }
  function enter() {
    ctx.fadeTo('7:00', () => {
      roomOn(true); wire();
      drop(F.ll); spawnLL();
      Object.assign(F, { active: true, won: false, t: TIME, copCalled: false, copOut: 0, copT: (ctx.S().snitched || 0) > 0 ? TUNE.copAtSnitch : TUNE.copAt, suck: null, stuns: 0, pushes: 0 });
      tpPlayer(ENTRY.x, ENTRY.z);
      dialogue.shout(F.ll, 'RENT! YOU CAME TO PAY, DEAR?', 2400);
      if ((ctx.S().snitched || 0) > 0) setTimeout(() => F.ll && F.active && dialogue.shout(F.ll, 'brenda told me EVERYTHING.', 2200), 2600);
      hud(); ctx.hud();
    }, 1600);
  }
  function leave(x = HOUSE.door.x, z = HOUSE.z1 + 1.8) {
    F.active = false; stars.visible = false;
    copAway(); F.copHome = null;
    drop(F.ll); F.ll = null;
    roomOn(false); tpPlayer(x, z); hud(); ctx.hud();
  }
  function askGiveUp() {
    if (!F.active || ctx.isBusy()) return;
    ctx.card({ head: 'GIVE UP?', lines: ['pay the rent. go back to day 0.', 'no shame. (some shame.)'], buttons: [['GIVE UP', () => acceptFate('gave up'), true], ['KEEP GOING [ESC]', () => {}]] });
  }
  function acceptFate(why) {
    if (!F.active) return;
    F.active = false; F.gaveUp++; stars.visible = false; copAway(); hud();
    const S = ctx.S(); if (!S.endings.includes('fate')) S.endings.push('fate'); ctx.persist();
    if (F.ll) dialogue.shout(F.ll, 'that\'s a good tenant. RENT!', 2400);
    setTimeout(() => ctx.card({ head: 'ACCEPT FATE', cls: 'ending', lines: ['ENDING 2 of 3', why === 'time' ? 'the clock hits 0:00. the landlady wins. she always wins.' : 'you hand over the rent. she pats your head.', '"see you on day 0, dear."'],
      buttons: [['TRY AGAIN [ENTER]', retry, true], ['WAKE UP (DAY 0)', wakeUp], ['FREE ROAM', () => { leave(); ctx.begin('free'); }]] }), 900);
  }
  function retry() { ctx.fadeTo('7:00', () => { copAway(); F.copHome = null; drop(F.ll); spawnLL(); Object.assign(F, { active: true, t: TIME, copCalled: false, copOut: 0, copT: TUNE.copAt, suck: null }); tpPlayer(ENTRY.x, ENTRY.z); hud(); }, 1200); }
  function wakeUp() { leave(); ctx.wakeUp(); }

  // ---------------- RENT FREE: sucked into her own time machine ----------------
  function win() {
    const n = F.ll; F.active = false; F.won = true; stars.visible = false; hud();
    police.state.mode === 'chase' && police.callOff('...huh?', 3);
    F.suck = { t: 0, n, from: n.root.position.clone() };
    n.drive = () => 0; n.down = null; n.fly = null;
    combat.burstAt?.(new THREE.Vector3(PAD.x, BH.y, PAD.z), 'ZWOOP!'); if (bh) bh.pulse = 1; combat.shakeIt?.(0.4); combat.audio?.whoosh?.(1);
    dialogue.shout(n, 'NOOO! MY RENT! MY BEAUTIFUL RENT!', 2000);
    ctx.glitch(2);
  }
  function suckTick(dt) {
    const s = F.suck; if (!s) return;
    // spiral in: the orbit shrinks and speeds up, she rises to the core, shrinks and spins, then a flash
    if (s.a0 === undefined) { s.a0 = Math.atan2(s.from.z - PAD.z, s.from.x - PAD.x); s.r0 = Math.max(1.2, Math.hypot(s.from.x - PAD.x, s.from.z - PAD.z)); s.y0 = s.from.y; }
    s.t += dt; const k = Math.min(1, s.t / 1.4), n = s.n;
    const r = s.r0 * Math.pow(1 - k, 1.4), a = s.a0 + k * k * 11 + k * 3, y = s.y0 + (BH.y - 0.4 - s.y0) * Math.min(1, k * 1.4);
    n.root.position.set(PAD.x + Math.cos(a) * r, y, PAD.z + Math.sin(a) * r);
    n.root.rotation.y += dt * (6 + k * 26); n.root.rotation.z = Math.sin(k * 9) * 0.6 * k;
    n.root.scale.setScalar(Math.max(0.01, 1 - Math.pow(k, 1.6)));
    if (s.t > 1.5) {
      F.suck = null; n.root.rotation.z = 0; drop(n); F.ll = null; flash(); if (bh) bh.pulse = 1.4;
      combat.burstAt?.(new THREE.Vector3(PAD.x, BH.y, PAD.z), 'POP!'); combat.shakeIt?.(0.5); combat.audio?.thud?.();
      setTimeout(rentFree, 700);
    }
  }
  function rentFree() {
    const S = ctx.S(); if (!S.endings.includes('free')) S.endings.push('free'); ctx.persist();
    ctx.card({ head: 'RENT FREE', cls: 'ending', lines: ['ENDING 3 of 3', 'the landlady gets sucked into her own black hole.', 'the clock stops. the loop breaks.', 'tomorrow is... day 8?'],
      buttons: [['DAY 8 [ENTER]', () => ctx.fadeTo('DAY 8', () => { leave(); ctx.afterLoop(); }, 1800), true]] });
  }
  // ---------------- the baby landlady: she will never stop ----------------
  function spawnBaby() {
    const npcs = getNPCs(); if (!npcs || F.baby) return;
    const n = npcs._wrap(npcs.charMod.createCustom({ ...LANDLADY_DEF, id: 'baby-landlady', name: 'BABY LANDLADY' }), 9003);
    const x = player.position.x + 1.5, z = player.position.z + 1.5;
    Object.assign(n, { tag: 'BABY LANDLADY', important: true, story: 'baby', baby: true, lines: ['RENT!'], walker: false, idleT: 0, temper: 'timid' });
    n.root.scale.setScalar(0.55);
    n.root.position.set(x, gy(x, z) + 0.02, z); n.home = { x, z, heading: 0 };
    n.drive = (dt, pp, ns) => {
      const p = n.root.position; n.mode = null; n.stagger = null; n.chaseCfg = null;
      const dx = pp.x - p.x, dz = pp.z - p.z, d = Math.hypot(dx, dz);
      n.targetHeading = Math.atan2(dx, dz);
      if (d > 8) { p.x = pp.x - dx / d * 2; p.z = pp.z - dz / d * 2; return 0; }   // she always finds you
      if (d < 1.7) return 0;
      const sp = Math.min(6.4, 1.5 + d * 1.6), st = sp * dt;
      ns._move(p, dx / d * st, dz / d * st); return sp;
    };
    npcs.list.push(n); npcs.toonify?.(n.root); F.baby = n; F.babyT = 3;
  }
  function babyTick(dt) {
    const n = F.baby; if (!n || ctx.isBusy()) return;
    if ((F.babyT -= dt) <= 0) { F.babyT = 8 + Math.random() * 4; dialogue.shout(n, pick(['RENT!', 'RENT!!', 'RENT!', 'RENT! RENT!']), 1400); F.babyYells = (F.babyYells || 0) + 1; }
  }
  function dropBaby() { drop(F.baby); F.baby = null; }

  // ---------------- keys ----------------
  window.addEventListener('keydown', (e) => {
    if (!F.active || e.repeat || ctx.isBusy() || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    if (e.code !== 'KeyF' && e.code !== 'KeyE') return;
    e.preventDefault(); e.stopImmediatePropagation();
    const n = F.ll; if (!n || n.removed) return;
    if (e.code === 'KeyF') dialogue.onLongPress?.(n);
    else {
      const d = n.root.position.distanceTo(player.position);
      if (d <= TUNE.pushR) actions.push(n); else combat.approach(n, 1.1, () => actions.push(n));
    }
  }, true);

  // ---------------- per frame (called by story.js) ----------------
  function tick(dt, now) {
    const S = ctx.S();
    bhTick(dt, now); suckTick(dt); babyTick(dt);
    // the door
    if (outside.visible && !F.active && !ctx.isBusy()) {
      const d = Math.hypot(player.position.x - HOUSE.door.x, player.position.z - HOUSE.door.z);
      if (d < HOUSE.door.r && !F.doorIn) { F.doorIn = true; doorPrompt(); }
      else if (d > HOUSE.door.r + 0.8) F.doorIn = false;
    }
    if (!F.active) return;
    const n = F.ll;
    if (n && F.dizzy > 0) {
      F.dizzy -= dt; stars.visible = F.dizzy > 0;
      const p = n.root.position;
      stars.children.forEach((s, i) => { const a = now / 180 + i * 2.1; s.position.set(p.x + Math.cos(a) * 0.5, p.y + 1.95, p.z + Math.sin(a) * 0.5); });
    } else stars.visible = false;
    // into the machine: knocked down or flying across the pad
    if (n && !F.suck && (n.down || n.fly) && Math.hypot(n.root.position.x - PAD.x, n.root.position.z - PAD.z) < PAD.r) { win(); return; }
    // the bowl: bananas
    F.bowlT -= dt;
    if (F.bowlT <= 0 && Math.hypot(player.position.x - BOWL.x, player.position.z - BOWL.z) < BOWL.r && bananas.state.supply < 3) { bananas.setSupply(3); F.bowlT = 6; ctx.toast('BANANAS x3! [B] DROP ONE IN HER WAY'); }
    if (ctx.isBusy() || police.state.mode === 'over') return;
    pullTick(dt);
    F.t -= dt; hud();
    if (F.t <= 0) { acceptFate('time'); return; }
    // the cop
    if (!F.copCalled) { F.copT -= dt; if (F.copT <= 0) callCop('OFFICER DOUGH! HE WON\'T PAY!'); }
    else if (F.copOut > 0) { F.copOut -= dt; if (F.copOut <= 0) callCop('OFFICER! HE\'S BACK!'); }
    else if (police.state.mode === 'idle') { F.copRe = (F.copRe || 0) + dt; if (F.copRe > 3) { F.copRe = 0; police.startChase('YOU AGAIN!'); } }
  }
  // story.js: a fresh day 0 / new story: no house, no room, no baby
  function resetAll() { if (F.active || room.visible) leave(); dropBaby(); }
  return { F, get active() { return F.active; }, HOUSE, PAD, BH, get bh() { return bh; }, ENTRY, TUNE, SPOTS, showHouse, enter, leave, tick, thrownOut, acceptFate, askGiveUp, win, spawnBaby, dropBaby, resetAll, callCop, room, outside, el: hudEl, stars,
    get inside() { return room.visible; } };
}
