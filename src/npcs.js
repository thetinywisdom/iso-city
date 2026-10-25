import * as THREE from 'three';
import { addGhosts } from './player.js?v=20261025d';
import { loadCustom, HOMES, VARIETY, STORE_KEY, PLAYER_KEY, getPlayerChar } from './customchars.js?v=20261025d';

// Ambient pedestrians: walkers loop around intersections along the sidewalks and
// over the crosswalks; a few others idle / chat. They yield to the player.
// Lane offset from an intersection centre: on the sidewalk, inside the crosswalk stripes.
// Clockwise and counter-clockwise walkers use different lanes so they pass instead of overlapping.
const loop = (cx, cz, L = 6.65) => [[cx - L, cz - L], [cx + L, cz - L], [cx + L, cz + L], [cx - L, cz + L]];

const WALKERS = [
  { seed: 101, path: loop(0, 0), start: 0, dir: 1, speed: 1.35 },
  { seed: 202, path: loop(0, 0, 7.15), start: 2, dir: -1, speed: 1.25, along: 0.4 },
  { seed: 303, path: loop(0, 0), start: 3, dir: 1, speed: 1.6, along: 0.55 },
  { seed: 404, path: loop(33, 0, 7.15), start: 1, dir: -1, speed: 1.4 },
  { seed: 505, path: loop(0, 33), start: 0, dir: 1, speed: 1.3, along: 0.3 },
  { seed: 606, path: loop(33, 33), start: 2, dir: 1, speed: 1.5 },
  { seed: 111, path: loop(33, 0), start: 3, dir: 1, speed: 1.2, along: 0.5 },
  { seed: 222, path: loop(0, 33, 7.15), start: 1, dir: -1, speed: 1.45, along: 0.6 },
];
const IDLERS = [
  { seed: 707, pos: [-19.6, 26.9], face: [-18.8, 26.4] },   // chatting pair on the sidewalk in front of the park
  { seed: 808, pos: [-18.8, 26.4], face: [-19.6, 26.9] },
  { seed: 909, pos: [-6.4, -14.0], face: [-8, -14.0] },  // window-shopping at the teal tower
  { seed: 1010, pos: [-24.4, 22.7], face: [-21.5, 21.5] }, // watching the fountain (west side of the plaza)
  { seed: 1111, pos: [13.4, -6.1], face: [16, -6.1] },     // waiting at the bus stop
];
// The women of the neighbourhood: modular NPC looks (blue-grey base, palette clothes), names on hover, own lines.
const WOMEN = [
  { seed: 1201, name: 'BRENDA', walk: { path: loop(33, 33, 7.15), start: 0, dir: -1, speed: 1.3, along: 0.5 },
    look: { outfit: 'dress', hair: 'ponytail', hairColor: '#292C2E', colors: { top: '#FF5491', accent: '#292C2E', shoe: '#292C2E' }, accessories: ['tote'], accColor: '#FFCC3F' },
    role: 'spy', chatLines: ['i see EVERYTHING.', 'the landlady pays me in cookies.', 'writing that down...'], lines: ['ew.', 'my husband is a cop. sort of.', 'not today, sweaty.', 'do i KNOW you?', 'move it, b*tch.'] },
  { seed: 1202, name: 'TIFF', walk: { path: loop(33, 0), start: 1, dir: 1, speed: 1.25, along: 0.5 },
    look: { outfit: 'blouse', hair: 'longStraight', hairColor: '#93616B', glasses: false, hat: 'none', accessories: ['headphones'] },
    plain: true },
  { seed: 1203, name: 'MRS. ITO', walk: { path: loop(0, 0), start: 1, dir: 1, speed: 1.1, along: 0.2 },
    look: { outfit: 'cardigan', hair: 'bob', hairColor: '#363E47', glasses: true, colors: { top: '#A7BFA4', inner: '#F0F2F4', bottom: '#363E47', shoe: '#292C2E' }, height: 0.94 },
    plain: true },
  { seed: 1204, name: 'LINDA', pos: [15.2, -6.2], face: [13.4, -6.1],
    look: { outfit: 'apron', hair: 'bun', hairColor: '#363E47', glasses: false },
    plain: true },
  { seed: 1205, name: 'GRANDMA FUMIKO', pos: [-23.6, 23.5], face: [-24.4, 22.7],
    look: { outfit: 'cardigan', hair: 'bun', hairColor: '#F0F2F4', glasses: true, colors: { top: '#F8C0C5', inner: '#F0F2F4', bottom: '#292C2E', shoe: '#292C2E' }, height: 0.88, build: 0.95 },
    role: 'oracle', chatLines: ['this week feels... familiar.', 'my hip says rain. again.', 'eat something, you noodle!', 'back in my day...'], lines: ["i'll hit you with my purse.", 'back in my day we slapped HARDER', 'eat something, you look like a noodle', 'speak up, dummy!'] },
  { seed: 1206, name: 'KIKO', pos: [-18.6, 27.5], face: [-19.2, 26.6],
    look: { outfit: 'dress', hair: 'bob', hairColor: '#292C2E', colors: { top: '#00B4BC', accent: '#FFCC3F', shoe: '#F0F2F4' }, height: 0.95 },
    plain: true },
  { seed: 1207, name: 'ROSA', pos: [-6.4, -14.9], face: [-8, -14.9],
    look: { outfit: 'blazer', hair: 'curlyLong', hairColor: '#4C3F42', colors: { top: '#FF7DAF', inner: '#F0F2F4', bottom: '#292C2E' } },
    plain: true },
  { seed: 1208, name: 'DORIS', pos: [-13.4, 19.6], face: [-12.6, 20.2],
    look: { outfit: 'coat', hair: 'braids', hairColor: '#4C3F42', glasses: false },
    plain: true },
  { seed: 1209, name: 'BIG DEB', pos: [-12.6, 20.2], face: [-13.4, 19.6],
    look: { outfit: 'sweater', hair: 'ponytail', hairColor: '#292C2E', colors: { top: '#FFE166', bottom: '#2A5B94', shoe: '#F0F2F4' }, build: 1.3, height: 1.03 },
    role: 'deb', chatLines: ['who wants to arm wrestle?', 'i bench-pressed a bus once.', 'protein is a personality.'], lines: ['wanna arm wrestle? no? coward.', 'i eat guys like you for brunch', 'beat it, shrimp.', 'oh h*ll naw.'] },
];
// The cop walks a big beat around four blocks (outer sidewalk lane).
const COP_BEAT = { path: [[-7.15, -7.15], [10.4, -7.15], [10.9, -5.0], [17.0, -5.0], [17.3, -7.15], [40.15, -7.15], [40.15, 40.15], [-7.15, 40.15], [-7.15, 17.2], [-4.6, 16.7], [-4.6, 12.6], [-7.15, 12.1]], start: 0, dir: 1, speed: 1.2, along: 0.15 };   // detours round the bus shelter and the bench
// Named easter-egg NPCs (characters.js SPECIALS): stand idle, dance when clicked, always timid.
const SPECIAL_SPOTS = [
  { key: 'mbappe', pos: [-8.5, 2.2], face: [-5.5, 5.0], ball: [0.14, 0.42] },    // quiet west arm of the spawn crossing: clear sightline, kit reads on dark asphalt
  { key: 'syoya', pos: [-15.5, 23.0], face: [-12.5, 26.0] },                       // park lawn east of the fountain plaza, open on all sides
  { key: 'giver', pos: [5.6, -9.7], face: [2.0, -6.0] },                            // mission giver: lurking by the peach building
  { key: 'bully', pos: [-5.5, -9.8], face: [-2.0, -6.0] },                          // the bully: west sidewalk, in plain view of spawn
];
export const NPC_RADIUS = 0.35;
// ---- slap reactions (tuning) ----
export const TUNE = {
  aggressiveChance: 0.35,
  reach: 1.2,            // slap reach (player and NPC)
  reactDelay: 0.3,       // aggressive: pause before slapping back
  chaseSpeed: 6.2,       // between player walk 3.2 and run 7
  chaseAccel: 8,         // units/s² ramp after stopping / slapping
  chaseCooldown: 1.2,    // between slaps while chasing
  shoutEvery: 2.3,       // repeat the chase shout
  giveUpDist: 12, giveUpTime: 10,
  fleeSpeed: 5.6, fleeTime: [4, 6], fleeDist: 10,
  staggerDist: 0.7, staggerTime: 0.28,
};
export const TRIP_LINES = ['ow!!', 'watch it!', 'what the h*ll', 'my back...'];
export const SLIP_LINES = ['who left a BANANA?!', 'my tailbone...', 'not funny!!', 'ow ow ow'];
export const PUSH_CRY = ['MOMMY!!', 'WAAAAH!', "i'm telling!!", 'my spine!!'];
export const PUSH_MAD = ["you're DEAD!", 'oh it is ON!', 'big mistake, pal!'];
export const FAINT_LINES = ['wha... what happened', '*cough* *cough*', 'i saw the light...', 'never again...'];
export const SHOUTS = { chase: 'you motherf**ker!', giveUp: 'yeah run away p**sy!', help: 'help!' };
const hash01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const forced = new URLSearchParams(location.search).get('temper');   // ?temper=aggressive|timid
// Generous invisible click targets (raycasters still hit invisible meshes).
const HIT_GEO = new THREE.CylinderGeometry(0.62, 0.62, 2.3, 8).translate(0, 1.15, 0);
const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });

export class NPCs {
  constructor(scene, charMod, city) {
    this.city = city; this.list = [];
    this.group = new THREE.Group(); scene.add(this.group);
    this.slapHit = charMod.SLAP_HIT || 0.3;
    // hooks wired by combat.js
    this.onShout = null;        // (npc, text) => void
    this.onSlapPlayer = null;   // (npc) => void, called when an NPC's hand connects
    for (const w of WALKERS) {
      const c = charMod.createNPC({ seed: w.seed });
      const n = this._wrap(c, w.seed);
      const a = w.path[w.start], b = w.path[(w.start + w.dir + 4) % 4];
      const t = w.along || 0;
      n.root.position.set(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t);
      Object.assign(n, { path: w.path, idx: (w.start + w.dir + 4) % 4, dir: w.dir, speed: w.speed, walker: true });
      this.list.push(n);
    }
    for (const i of IDLERS) {
      const n = this._wrap(charMod.createNPC({ seed: i.seed }), i.seed);
      n.root.position.set(i.pos[0], 0, i.pos[1]);
      n.heading = Math.atan2(i.face[0] - i.pos[0], i.face[1] - i.pos[1]);
      n.home = { x: i.pos[0], z: i.pos[1], heading: n.heading };
      n.walker = false; n.idleT = Math.random() * 3;
      this.list.push(n);
    }
    for (const w of WOMEN) {
      const n = this._wrap(charMod.createNPC({ seed: w.seed, ...w.look }), w.seed);
      Object.assign(n, { tag: w.name, woman: true }, w.plain ? {} : { lines: w.lines, chatLines: w.chatLines, role: w.role, important: true });
      if (w.walk) {
        const W = w.walk, a = W.path[W.start], b = W.path[(W.start + W.dir + 4) % 4], t = W.along || 0;
        n.root.position.set(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t);
        Object.assign(n, { path: W.path, idx: (W.start + W.dir + 4) % 4, dir: W.dir, speed: W.speed, walker: true });
      } else {
        n.root.position.set(w.pos[0], 0, w.pos[1]);
        n.heading = Math.atan2(w.face[0] - w.pos[0], w.face[1] - w.pos[1]);
        n.home = { x: w.pos[0], z: w.pos[1], heading: n.heading };
        n.walker = false; n.idleT = Math.random() * 3;
      }
      this.list.push(n);
    }
    if (charMod.createSpecial) for (const s of SPECIAL_SPOTS) {
      const n = this._wrap(charMod.createSpecial(s.key), 0);
      const sp = charMod.SPECIALS[s.key];
      Object.assign(n, { important: true, special: s.key, tag: sp.tag, danceName: sp.dance, icon: sp.icon, role: sp.role || null, temper: sp.temper || 'timid', walker: false, idleT: 0 });
      n.root.position.set(s.pos[0], 0, s.pos[1]);
      n.heading = n.root.rotation.y = Math.atan2(s.face[0] - s.pos[0], s.face[1] - s.pos[1]);
      n.home = { x: s.pos[0], z: s.pos[1], heading: n.heading };
      if (s.ball) {   // a football resting at his feet (stays put in the world)
        const b = football(), h = n.heading; b.name = 'football';
        b.position.set(s.pos[0] + Math.sin(h) * s.ball[1] + Math.cos(h) * s.ball[0], 0, s.pos[1] + Math.cos(h) * s.ball[1] - Math.sin(h) * s.ball[0]);
        b.position.y = city.groundHeight(b.position.x, b.position.z) + 0.11;
        this.group.add(b); n.ball = b; n.ballHome = b.position.clone();
      }
      this.list.push(n);
    }
    if (charMod.SPECIALS?.cop) {
      const n = this._wrap(charMod.createSpecial('cop'), 0), sp = charMod.SPECIALS.cop, W = COP_BEAT;
      Object.assign(n, { important: true, special: 'cop', tag: sp.tag, role: 'cop', temper: 'timid', idleT: 0,
        lines: ['move along.', "i've got my eye on you, punk.", '*munch munch*', 'nothing to see here.', 'is that a donut? no? then beat it.'] });
      const a = W.path[W.start], b = W.path[(W.start + W.dir + 4) % 4];
      n.root.position.set(a[0] + (b[0] - a[0]) * W.along, 0, a[1] + (b[1] - a[1]) * W.along);
      Object.assign(n, { path: W.path, idx: (W.start + W.dir + 4) % 4, dir: W.dir, speed: W.speed, walker: true });
      this.list.push(n);
    }
    // variety pedestrians made from the creator's options (held items, body types...)
    this.charMod = charMod; this.toonify = null; this.customs = [];
    if (charMod.createCustom && charMod.randomCustom) for (const v of VARIETY) {
      const def = { ...charMod.randomCustom(v.seed), ...v.over, id: 'variety' + v.seed };
      const n = this._wrap(charMod.createCustom(def), v.seed);
      n.variety = true;
      if (v.walk) this._walkLoop(n, v.walk); else this._idleAt(n, v.pos, v.face);
      this.list.push(n);
    }
    if (charMod.createCustom) {
      this.syncCustom();
      addEventListener('storage', (e) => { if (e.key === STORE_KEY || e.key === PLAYER_KEY || e.key === null) this.syncCustom(); });
    }
    for (const n of this.list) n.root.position.y = city.groundHeight(n.root.position.x, n.root.position.z);
  }
  _walkLoop(n, W) {
    const path = loop(W.c[0], W.c[1], W.L || 6.65), a = path[W.start || 0], b = path[((W.start || 0) + (W.dir || 1) + 4) % 4], t = W.along ?? 0.5;
    n.root.position.set(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t);
    Object.assign(n, { path, idx: ((W.start || 0) + (W.dir || 1) + 4) % 4, dir: W.dir || 1, speed: W.speed || 1.3, walker: true });
  }
  _free(x, z, r = 0.4) {
    for (const c of this.city.colliders) if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return false;
    for (const o of this.list) if (Math.hypot(o.root.position.x - x, o.root.position.z - z) < 0.85) return false;
    return true;
  }
  _idleAt(n, pos, face) {
    let [x, z] = pos;
    for (let k = 0; k < 60 && !this._free(x, z); k++) { const a = k * 2.4, d = 0.6 + k * 0.12; x = pos[0] + Math.cos(a) * d; z = pos[1] + Math.sin(a) * d; }
    n.root.position.set(x, this.city.groundHeight(x, z), z);
    n.heading = n.root.rotation.y = Math.atan2(face[0] - x, face[1] - z);
    n.home = { x, z, heading: n.heading };
    n.walker = false; n.idleT = Math.random() * 3;
  }
  /** (Re)spawn the creator's saved characters from localStorage. Returns the number spawned. */
  syncCustom() {
    const C = this.charMod;
    for (const n of this.customs) { n.root.removeFromParent(); const i = this.list.indexOf(n); if (i >= 0) this.list.splice(i, 1); n.removed = true; }
    this.customs = []; this.customGen = (this.customGen || 0) + 1;
    const defs = loadCustom(), me = getPlayerChar();
    defs.forEach((raw, i) => {
      if (me && raw.id === me) return;   // you're playing as them — no NPC twin
      let n;
      try {
        const d = C.normalizeCustom(raw);
        n = this._wrap(C.createCustom(d), 7000 + i);
        const lines = d.lines.length ? d.lines : null;
        Object.assign(n, { tag: d.name.toUpperCase(), custom: true, customId: raw.id, important: true, lines,
          chatLines: d.bubble ? [d.bubble] : lines, danceStyle: d.dance });
        const H = HOMES[d.home] || HOMES.fountain;
        if (H.walk) this._walkLoop(n, { c: [[0, 0], [33, 0], [0, 33], [33, 33]][i % 4], L: i % 2 ? 7.15 : 6.65, start: i % 4, dir: i % 2 ? -1 : 1, speed: 1.3 });
        else this._idleAt(n, H.pos, H.face);
        n.root.position.y = this.city.groundHeight(n.root.position.x, n.root.position.z);
      } catch (e) { console.warn('custom character skipped:', e.message); if (n) n.root.removeFromParent(); return; }
      this.list.push(n); this.customs.push(n);
      this.toonify?.(n.root);
    });
    return this.customs.length;
  }
  _wrap(c, seed) {
    const root = new THREE.Group(); root.add(c.root); addGhosts(c.root); this.group.add(root);
    const hit = new THREE.Mesh(HIT_GEO, HIT_MAT); hit.visible = false; root.add(hit);
    // temperament is rolled at spawn (seeded, so the same person is always the same) and kept secret
    const temper = forced === 'aggressive' || forced === 'timid' ? forced
      : hash01(seed) < TUNE.aggressiveChance ? 'aggressive' : 'timid';
    const n = { c, root, hit, heading: 0, curSpeed: 0, wait: 0, talkT: 0, lastLine: null, seed,
      temper, mode: null, modeT: 0, stagger: null, pendingHit: -1, cooldown: 0, shoutT: 0 };
    hit.userData.npc = n;
    return n;
  }
  get positions() { return this.list.map((n) => n.root.position); }
  get hitboxes() { return this.list.map((n) => n.hit); }
  get roots() { return this.list.map((n) => n.root); }
  get TUNE() { return TUNE; }
  // debug: move an NPC (and its idle home) somewhere else
  place(i, x, z, heading = 0) {
    const n = typeof i === 'number' ? this.list[i] : i;
    n.root.position.set(x, n.root.position.y, z); n.heading = heading;
    if (n.home) Object.assign(n.home, { x, z, heading });
  }
  /** Start a special NPC's dance (faces the player, stands still). Returns the duration in s, 0 if busy. */
  dance(n, playerPos) {
    if (!n.special || n.mode || n.stagger || n.down || n.c.dancing) return 0;
    n.talkT = 0; n.danceTo = playerPos;
    return n.c.dance(n.danceName);
  }
  get specials() { return this.list.filter((n) => n.special); }
  setTemperament(i, t) { (typeof i === 'number' ? this.list[i] : i).temper = t; }
  // Stop, turn to face the player for `secs`, then resume what they were doing.
  // Ignored while an NPC is angry / scared (they keep chasing / fleeing).
  talk(n, secs, playerPos) { if (n.mode) return; n.talkT = secs; n.talkTo = playerPos; }
  endTalk(n) { n.talkT = 0; }
  _shout(n, key) { const c = n.chaseCfg; this.onShout?.(n, (c && c[key]) || SHOUTS[key]); }
  // ---- mission hooks: tiny event bus (slap, hitPlayer, caught) ----
  on(evt, fn) { (this._ev ||= {})[evt] = ((this._ev[evt]) || []).concat(fn); return () => { this._ev[evt] = this._ev[evt].filter((f) => f !== fn); }; }
  emit(evt, ...a) { for (const f of (this._ev?.[evt] || [])) f(...a); }
  /** Make an NPC chase the player right now. cfg: {speed, accel, react, noGiveUp, catch, chase, giveUp} (shout overrides). */
  forceChase(n, cfg = {}) {
    if (n.c.dancing) n.c.stopDance(0.12);
    n.chaseCfg = cfg; n.talkT = 0;
    n.mode = 'react'; n.modeT = cfg.react ?? TUNE.reactDelay; n.chaseT = 0; n.chaseV = 0;
  }
  /** Walk to (x,z) to watch something (emits 'gathered' on arrival). */
  gatherTo(n, x, z) {
    if (n.down || n.mode || n.stagger) return false;
    if (n.c.dancing) n.c.stopDance(0.1);
    n.talkT = 0; n.mode = 'gather'; n.gather = { x, z }; n.gatherT = 0; n.modeT = 99;
    return true;
  }
  /** Walk back to the route / home spot (after being pulled away). */
  goHome(n, standFor = 0.2) {
    if (n.down) return;
    n.chaseCfg = null; n.stagger = null; n.mode = 'return'; n.modeT = standFor; n.target = this._nearestWaypoint(n);
  }
  /** Calm an NPC down: stop chasing/fleeing and walk back to their route/spot. */
  calm(n, standFor = 0.6) {
    n.chaseCfg = null; n.pendingHit = -1;
    if (!n.mode && !n.stagger) return;
    n.stagger = null; n.mode = 'return'; n.modeT = standFor; n.target = this._nearestWaypoint(n);
  }

  /** The player's hand connected. `from` = player position. */
  slapped(n, from) {
    const p = n.root.position;
    const dx = p.x - from.x, dz = p.z - from.z, d = Math.hypot(dx, dz) || 1;
    if (n.special === 'cop') { this.emit('copPoked', n, 'slap'); return; }   // you don't slap a cop. he just gets mad.
    if (n.down) { this.emit('slap', n); return; }   // kicking them while they're down: no stagger/state changes
    if (n.c.dancing) n.c.stopDance(0.12);     // a slap cuts a dance short
    n.c.hit(-1);                               // player's right hand -> head snaps to the NPC's right
    n.stagger = { t: TUNE.staggerTime, x: dx / d, z: dz / d };
    n.talkT = 0;
    n.root.rotation.y = Math.atan2(-dx, -dz);  // face the slapper
    if (n.temper === 'aggressive') {
      if (n.mode !== 'chase') { n.mode = 'react'; n.modeT = TUNE.reactDelay + TUNE.staggerTime * 0.5; }
      n.chaseT = 0;
    } else {
      n.mode = 'flee'; n.modeT = TUNE.fleeTime[0] + Math.random() * (TUNE.fleeTime[1] - TUNE.fleeTime[0]);
      this._shout(n, 'help');
    }
    this.emit('slap', n);
  }

  /** Jumped into by the player: falls onto their back (facing the jumper), lies, gets up, complains.
   *  Chasers resume the chase; aggressive ones start one (like a slap). Returns the down time in s. */
  knockdown(n, from, lie = 1.2 + Math.random() * 0.6, post = null) {
    if (n.down || !n.c.knockdown || n.special === 'cop') return 0;
    const p = n.root.position;
    n.root.rotation.y = n.targetHeading = Math.atan2(from.x - p.x, from.z - p.z);
    const t = n.c.knockdown(-1, lie);              // also cancels a dance cleanly
    n.down = { t, wasChasing: n.mode === 'chase' || n.mode === 'react', cfg: n.chaseCfg, post };
    n.talkT = 0; n.stagger = null; n.pendingHit = -1; n.chaseV = 0; n.curSpeed = 0;
    this.emit('trip', n);
    return t;
  }
  /** Banana peel: feet fly up, flat on the back for a couple of seconds. Works on anyone (cop, bully, landlady);
   *  a chaser picks the chase back up after getting up. Returns the down time. */
  slip(n, lie = 2.0) {
    if (n.down || !n.c.knockdown) return 0;
    if (n.c.dancing) n.c.stopDance(0.05);
    const p = n.root.position, h = n.root.rotation.y;
    const t = n.c.knockdown(-1, lie);          // falls backwards (heels toward where they were running)
    n.root.rotation.y = h;
    n.down = { t, wasChasing: n.mode === 'chase' || n.mode === 'react', cfg: n.chaseCfg, post: 'slip' };
    n.talkT = 0; n.stagger = null; n.pendingHit = -1; n.chaseV = 0; n.curSpeed = 0;
    this.emit('slip', n);
    return t;
  }
  /** Cartoon shove: knocked off their feet, short airborne arc, flailing; lands with a thud (emits 'land').
   *  Anyone they sail into goes down too (domino, emits 'domino'). */
  shove(n, from, power = 7.5, depth = 0) {
    const p = n.root.position;
    const dx = p.x - from.x, dz = p.z - from.z, d = Math.hypot(dx, dz) || 1;
    if (n.special === 'bully' || n.special === 'cop') return 0;      // an immovable object
    if (!this.knockdown(n, from, 1.5 + Math.random() * 0.6, 'push')) return 0;
    n.fly = { vx: dx / d * power, vz: dz / d * power, vy: 4.2 + power * 0.25, t: 0, power, depth };
    return n.down.t;
  }
  /** Get angry right now: glare, slap, chase (like an aggressive NPC that was slapped, minus the stagger). */
  provoke(n, react = 0.4) {
    if (n.down) return;
    if (n.c.dancing) n.c.stopDance(0.12);
    n.talkT = 0;
    if (n.mode !== 'chase') { n.mode = 'react'; n.modeT = react; }
    n.chaseT = 0; n.shoutT = 0.9;
  }
  /** Run away from the player for a few seconds. */
  flee(n, secs = 3 + Math.random() * 2) {
    if (n.down) return;
    if (n.c.dancing) n.c.stopDance(0.12);
    n.talkT = 0; n.mode = 'flee'; n.modeT = secs;
  }
  /** Any NPC: start a named dance facing `to` (generic or signature). Returns the duration, 0 if busy. */
  danceAny(n, name, to) {
    if (n.mode || n.stagger || n.down) return 0;
    n.talkT = 0; n.danceTo = to;
    return n.c.dance(name);
  }
  _getUp(n) {
    const d = n.down; n.down = null;
    if (d.post === 'push' || d.post === 'faint') {
      const L = d.post === 'push' ? (n.temper === 'aggressive' ? PUSH_MAD : PUSH_CRY) : FAINT_LINES;
      this.onShout?.(n, L[Math.floor(Math.random() * L.length)]);
      if (d.wasChasing && n.chaseCfg === d.cfg && n.mode) { n.mode = 'react'; n.modeT = 0.25; n.shoutT = 1.2; }
      else if (n.temper === 'aggressive') { n.mode = 'react'; n.modeT = 0.5; n.chaseT = 0; n.shoutT = 1.4; }
      else if (d.post === 'push') { n.mode = 'flee'; n.modeT = 3.5 + Math.random() * 1.5; }
      this.emit('getUp', n, d.post);
      return;
    }
    const TL = d.post === 'slip' ? SLIP_LINES : TRIP_LINES;
    this.onShout?.(n, TL[Math.floor(Math.random() * TL.length)]);
    if (d.wasChasing && n.chaseCfg === d.cfg && n.mode) { n.mode = 'react'; n.modeT = 0.25; n.chaseT = n.chaseT || 0; n.shoutT = 1.2; }
    else if (n.temper === 'aggressive' && !n.mode) { n.mode = 'react'; n.modeT = 0.6; n.chaseT = 0; n.shoutT = 1.2; }
  }

  // ---- collision for NPCs that leave their lane (reuses the city colliders) ----
  _blocked(x, z, r = NPC_RADIUS) {
    const b = this.city.bounds;
    if (x < b.min || x > b.max || z < b.min || z > b.max) return true;
    for (const c of this.city.colliders)
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
    return false;
  }
  // move with slide-along-walls; returns the distance actually moved
  _move(p, dx, dz) {
    if (!this._blocked(p.x + dx, p.z + dz)) { p.x += dx; p.z += dz; return Math.hypot(dx, dz); }
    let m = 0;
    if (!this._blocked(p.x + dx, p.z)) { p.x += dx; m += Math.abs(dx); }
    if (!this._blocked(p.x, p.z + dz)) { p.z += dz; m += Math.abs(dz); }
    return m;
  }
  // steer toward (hx,hz) but pick the nearest free direction if an obstacle is ahead
  _steer(n, hx, hz, look = 1.1) {
    const p = n.root.position, base = Math.atan2(hx, hz);
    const prefer = n.steerSide || 1;
    for (const off of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.1, -2.1, 2.6, -2.6]) {
      const a = base + off * prefer;
      const sx = Math.sin(a), sz = Math.cos(a);
      if (!this._blocked(p.x + sx * look, p.z + sz * look) && !this._blocked(p.x + sx * look * 0.5, p.z + sz * look * 0.5)) {
        if (off !== 0) n.steerSide = Math.sign(off) * prefer;   // keep circling the same way round
        return [sx, sz];
      }
    }
    return [hx, hz];
  }
  _nearestWaypoint(n) {
    const p = n.root.position;
    if (!n.walker) return { i: -1, x: n.home.x, z: n.home.z };
    let best = 0, bd = Infinity;
    n.path.forEach((w, i) => { const d = Math.hypot(w[0] - p.x, w[1] - p.z); if (d < bd) { bd = d; best = i; } });
    return { i: best, x: n.path[best][0], z: n.path[best][1] };
  }

  // returns the move speed this frame
  _combat(n, dt, pp, playerR) {
    const p = n.root.position;
    const dx = pp.x - p.x, dz = pp.z - p.z, dist = Math.hypot(dx, dz) || 1e-6;
    n.modeT -= dt; n.cooldown -= dt;
    // the hand of an NPC slap connects a moment after the swing starts
    if (n.pendingHit >= 0) {
      n.pendingHit -= dt;
      if (n.pendingHit < 0 && dist < TUNE.reach + 0.45) { this.onSlapPlayer?.(n); this.emit('hitPlayer', n); }
    }
    if (n.stagger) {                         // knocked back a step
      n.chaseV = 0;
      const s = n.stagger, step = (TUNE.staggerDist / TUNE.staggerTime) * Math.min(dt, s.t);
      this._move(p, s.x * step, s.z * step);
      s.t -= dt; if (s.t <= 0) n.stagger = null;
      return 0;
    }
    const faceP = () => { n.targetHeading = Math.atan2(dx, dz); };
    const cc = n.chaseCfg || {};
    const trySlap = () => {
      if (cc.catch) {                        // grabs instead of slapping (e.g. Mbappé taking his ball back)
        if (dist < TUNE.reach * 0.9) { this.emit('caught', n); return true; }
        return false;
      }
      if (dist < TUNE.reach && n.cooldown <= 0 && !n.c.slapping) {
        n.c.slap(); n.pendingHit = this.slapHit; n.cooldown = TUNE.chaseCooldown;
        return true;
      }
      return false;
    };
    if (n.mode === 'react') {                // glare for a beat, then slap back
      faceP();
      if (n.modeT <= 0) {
        trySlap();
        n.mode = 'chase'; n.chaseT = 0; n.shoutT = 0.35;
      }
      return 0;
    }
    if (n.mode === 'chase') {
      n.chaseT += dt; n.shoutT -= dt;
      faceP();
      if (n.shoutT <= 0) { this._shout(n, 'chase'); n.shoutT = TUNE.shoutEvery; }
      if (!cc.noGiveUp && (dist > TUNE.giveUpDist || n.chaseT > TUNE.giveUpTime)) {
        this._shout(n, 'giveUp');
        n.mode = 'return'; n.modeT = 1.4; n.chaseCfg = null;   // stand and yell first
        n.target = this._nearestWaypoint(n);
        return 0;
      }
      if (n.c.slapping) { n.chaseV = 0; return 0; }
      if (trySlap()) { n.chaseV = 0; return 0; }
      const stopAt = TUNE.reach * 0.75 + playerR * 0.2;
      if (dist <= stopAt) return 0;
      const [sx, sz] = this._steer(n, dx / dist, dz / dist);
      n.targetHeading = Math.atan2(sx, sz);
      // ramp up (gives a slapped player a head start to break away)
      n.chaseV = Math.min(cc.speed ?? TUNE.chaseSpeed, (n.chaseV || 0) + (cc.accel ?? TUNE.chaseAccel) * dt);
      const step = Math.min(n.chaseV * dt, dist - stopAt);
      this._move(p, sx * step, sz * step);
      return n.chaseV;
    }
    if (n.mode === 'flee') {
      if (n.modeT <= 0 || dist > TUNE.fleeDist) {
        n.mode = 'return'; n.modeT = 0.8; n.target = this._nearestWaypoint(n);
        return 0;
      }
      // away from the player, nudged toward the nearest sidewalk lane / waypoint so they stay on paths
      let hx = -dx / dist, hz = -dz / dist;
      const wp = this._nearestWaypoint(n), wx = wp.x - p.x, wz = wp.z - p.z, wd = Math.hypot(wx, wz) || 1;
      if (wx / wd * hx + wz / wd * hz > -0.2) { hx += wx / wd * 0.35; hz += wz / wd * 0.35; }
      const hl = Math.hypot(hx, hz); hx /= hl; hz /= hl;
      const [sx, sz] = this._steer(n, hx, hz, 1.4);
      n.targetHeading = Math.atan2(sx, sz);
      this._move(p, sx * TUNE.fleeSpeed * dt, sz * TUNE.fleeSpeed * dt);
      return TUNE.fleeSpeed;
    }
    if (n.mode === 'gather') {              // walking over to watch a dance-off (spectator); arrives -> 'gathered'
      const t = n.gather, tx = t.x - p.x, tz = t.z - p.z, td = Math.hypot(tx, tz);
      n.gatherT = (n.gatherT || 0) + dt;
      if (td < 0.2 || n.gatherT > 9) { n.mode = null; n.gatherT = 0; this.emit('gathered', n); return 0; }
      const [sx, sz] = this._steer(n, tx / td, tz / td, Math.min(1.1, td));
      n.targetHeading = Math.atan2(sx, sz);
      const spd = 3.4, step = Math.min(spd * dt, td);
      this._move(p, sx * step, sz * step);
      return spd;
    }
    if (n.mode === 'return') {              // calm down, walk back to the route and carry on
      if (n.modeT > 0) { if (n.temper === 'aggressive') faceP(); return 0; }
      const t = n.target, tx = t.x - p.x, tz = t.z - p.z, td = Math.hypot(tx, tz);
      n.returnT = (n.returnT || 0) + dt;
      if (td < 0.15 || n.returnT > 25) {
        n.mode = null; n.returnT = 0;
        if (n.walker) { n.idx = t.i; n.wait = 0.5; }
        else { if (td < 1.5) { p.x = t.x; p.z = t.z; } n.heading = n.home.heading; n.idleT = 0; }
        return 0;
      }
      const [sx, sz] = this._steer(n, tx / td, tz / td, Math.min(1.1, td));
      n.targetHeading = Math.atan2(sx, sz);
      const spd = n.walker ? Math.max(n.speed, 1.4) : 1.4, step = Math.min(spd * dt, td);
      this._move(p, sx * step, sz * step);
      return spd;
    }
    n.mode = null;
    return 0;
  }

  update(dt, playerPos, playerR) {
    for (const n of this.list) {
      const p = n.root.position;
      let speed = 0;
      if (n.bonkT > 0) n.bonkT -= dt;
      if (n.sway > 0) { n.sway = Math.max(0, n.sway - dt); n.root.rotation.x = 0.07 * Math.sin(n.sway * 28) * n.sway / 0.35; }
      if (n.down && n.fly) {                   // shoved: airborne arc, then a thud
        const f = n.fly; f.t += dt;
        this._move(p, f.vx * dt, f.vz * dt);
        f.vy -= 30 * dt; p.y += f.vy * dt;
        for (const o of this.list) {           // domino: whoever they sail into goes down too
          if (o === n || o.down || f.depth > 5) continue;
          const q = o.root.position;
          if ((q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 0.8 * 0.8) {
            if (o.special === 'bully') {          // bounces right off him
              if (o.bonkT > 0) continue;
              const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz) || 1, s = Math.max(2.5, Math.hypot(f.vx, f.vz) * 0.45);
              f.vx = dx / d * s; f.vz = dz / d * s; f.vy = Math.max(f.vy, 2.5); f.depth = 99;
              o.bonkT = 0.6; this.emit('bonk', o, n); continue;
            }
            if (this.shove(o, p, Math.max(4, f.power * 0.75), f.depth + 1)) { o.down.t += 0.2 * (f.depth + 1); this.emit('domino', o, n); }
          }
        }
        const gy = this.city.groundHeight(p.x, p.z);
        if ((f.vy < 0 && p.y <= gy + 0.02) || f.t > 1.5) { p.y = gy + 0.02; n.fly = null; this.emit('land', n); }
        n.down.t -= dt; n.talkT = 0; n.curSpeed = 0;
        n.c.update(dt, 0);
        continue;
      }
      if (n.down) {                            // knocked over: lie still, then get up
        n.down.t -= dt; n.talkT = 0; n.curSpeed = 0;
        if (n.down.t <= 0) this._getUp(n);
        const gy = this.city.groundHeight(p.x, p.z);
        p.y += (gy + 0.02 - p.y) * Math.min(1, dt * 15);
        n.c.update(dt, 0);
        continue;
      }
      if (n.mode || n.stagger) {
        n.talkT = 0;
        speed = this._combat(n, dt, playerPos, playerR);
      } else if (n.c.dancing) {               // dancing on the spot, facing the player
        const tp = n.danceTo || playerPos;
        n.targetHeading = Math.atan2(tp.x - p.x, tp.z - p.z);
      } else if (n.talkT > 0) {
        n.talkT -= dt;
        const tp = n.talkTo || playerPos;
        n.targetHeading = Math.atan2(tp.x - p.x, tp.z - p.z);
      } else if (n.walker) {
        const tgt = n.path[n.idx];
        const dx = tgt[0] - p.x, dz = tgt[1] - p.z, dist = Math.hypot(dx, dz);
        if (dist < 0.08) { n.idx = (n.idx + n.dir + 4) % 4; n.wait = Math.random() < 0.25 ? 0.6 + Math.random() : 0; }
        else {
          const hx = dx / dist, hz = dz / dist;
          n.targetHeading = Math.atan2(hx, hz);
          // yield to the player if they stand in the way
          const px = playerPos.x - p.x, pz = playerPos.z - p.z, pd = Math.hypot(px, pz);
          const ahead = (px * hx + pz * hz) / (pd || 1);
          const blocked = pd < NPC_RADIUS + playerR + 0.45 && ahead > 0.3;
          if (n.wait > 0) n.wait -= dt;
          else if (!blocked) {
            speed = n.speed;
            const step = Math.min(dist, speed * dt);
            p.x += hx * step; p.z += hz * step;
          }
        }
      } else if (n.special) {                 // special idlers: stand at their spot
        n.idleT += dt;
        n.targetHeading = n.heading + Math.sin(n.idleT * 0.5) * 0.12;
      } else {
        n.idleT += dt;
        // chatting: small turns of the head/body every few seconds
        n.targetHeading = n.heading + Math.sin(n.idleT * 0.7) * 0.25;
      }
      if (n.targetHeading !== undefined) {
        let d = n.targetHeading - n.root.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        n.root.rotation.y += d * Math.min(1, dt * (n.mode ? 14 : 8));
      }
      // chase / flee accelerate fast so the run animation kicks in right away
      n.curSpeed += (speed - n.curSpeed) * Math.min(1, dt * (n.mode ? 14 : 10));
      const gy = this.city.groundHeight(p.x, p.z);
      p.y += (gy + 0.02 - p.y) * Math.min(1, dt * 15);
      n.c.update(dt, n.curSpeed > 0.15 ? n.curSpeed : 0);
    }
  }
}

// low-poly football: white icosphere with black pentagon patches
const BALL = { white: new THREE.MeshLambertMaterial({ color: '#F0F2F4', flatShading: true }), black: new THREE.MeshLambertMaterial({ color: '#292C2E', flatShading: true }) };
function football() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), BALL.white); ball.castShadow = true; g.add(ball);
  const ico = new THREE.IcosahedronGeometry(1, 0).getAttribute('position'), seen = [];
  for (let i = 0; i < ico.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(ico, i).normalize();
    if (seen.some((o) => o.distanceTo(v) < 0.01)) continue; seen.push(v);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 5), BALL.black);
    m.position.copy(v).multiplyScalar(0.104); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); g.add(m);
  }
  g.rotation.set(0.4, 0.7, 0.2);
  return g;
}
