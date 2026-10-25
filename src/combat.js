import * as THREE from 'three';
import { TUNE, NPC_RADIUS } from './npcs.js?v=20261025g';

// SLAP: long-press an NPC (dialogue.js fires onLongPress) -> the player walks into
// reach, winds up and slaps. Impact = pixel "SLAP!" burst, screen shake, a synthesized
// whoosh + smack, and the NPC's reaction (npcs.js: aggressive slaps back and chases,
// timid runs away). NPC slaps on the player go through the same impact code.
const APPROACH_SPEED = 4.6, APPROACH_TIMEOUT = 4;
const PLAYER_STUN = 0.32, KNOCKBACK = 8;
const TRIP_DIST = 0.42 + NPC_RADIUS + 0.12;   // airborne player touching an NPC -> both fall

export function initCombat({ scene, camera, renderer, pixel, player, getNPCs, dialogue, keys }) {
  const canvas = renderer.domElement;
  const layer = document.getElementById('bubbles');
  const audio = new SlapAudio();
  let target = null, approachT = 0, bestD = Infinity, stuckT = 0, slapping = null, stun = 0, shake = 0;
  // menu actions (actions.js): walk up to `target`, then run actCb instead of a slap; `hold` freezes input for a clip
  let actCb = null, actReach = 0, lockT = 0, lockFace = null, lockCancel = null;
  const bursts = [];
  const tmp = new THREE.Vector3();
  const charOf = () => player.model?.userData?.character || null;

  // ---- wiring ----
  dialogue.onLongPress = (npc) => { audio.unlock(); interrupt(); target = npc; actCb = null; approachT = 0; bestD = Infinity; stuckT = 0; };
  function approach(npc, reach, cb) { audio.unlock(); interrupt(); target = npc; actCb = cb; actReach = reach; approachT = 0; bestD = Infinity; stuckT = 0; }
  function hold(sec, face = null, onCancel = null) { lockT = sec; lockFace = face; lockCancel = onCancel; }
  function interrupt() { const f = lockCancel; lockT = 0; lockCancel = null; f?.(); }
  let wired = null;
  function wire(npcs) {
    if (!npcs || wired === npcs) return;
    wired = npcs;
    npcs.onShout = (n, text) => dialogue.shout(n, text);
    npcs.onSlapPlayer = (n) => hitPlayer(n);
  }
  window.addEventListener('pointerdown', () => audio.unlock(), true);
  const muteHud = document.createElement('div'); muteHud.id = 'hud-mute'; document.body.appendChild(muteHud);
  let muteTimer = 0;
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyM') return;
    audio.muted = !audio.muted;
    muteHud.textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON';
    muteHud.style.display = 'block'; clearTimeout(muteTimer); muteTimer = setTimeout(() => (muteHud.style.display = 'none'), 1200);
  });

  // ---- impacts ----
  function burstAt(pos, text = 'SLAP!') {
    const el = document.createElement('div'); el.className = 'impact';
    const inner = document.createElement('div');
    inner.appendChild(starCanvas());
    const b = document.createElement('b'); b.textContent = text; inner.appendChild(b);
    el.appendChild(inner); layer.appendChild(el);
    bursts.push({ el, pos: pos.clone(), until: performance.now() + 520 });
    placeBursts();
  }
  function impact(a, b) {            // a slaps b (Object3D roots)
    tmp.copy(a.position).lerp(b.position, 0.65); tmp.y = b.position.y + 1.55;
    burstAt(tmp);
    shake = 0.22;
    audio.smack();
  }
  function hitPlayer(n) {
    const p = player.position, q = n.root.position;
    const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz) || 1;
    interrupt(); charOf()?.stopDance?.(0.1);
    impact(n.root, player.root);
    charOf()?.hit(-1);
    stun = Math.max(stun, PLAYER_STUN); slapping = null; target = null;
    player.vel.set(dx / d * KNOCKBACK, 0, dz / d * KNOCKBACK);
    player.heading = Math.atan2(-dx, -dz);       // knocked while facing the slapper
  }

  // ---- trip: jumping into / onto someone knocks you both over ----
  let downT = 0;
  function dustAt(pos) {
    const el = document.createElement('div'); el.className = 'impact dust';
    const inner = document.createElement('div'); inner.appendChild(dustCanvas()); el.appendChild(inner); layer.appendChild(el);
    bursts.push({ el, pos: pos.clone(), until: performance.now() + 600 });
    placeBursts();
  }
  function trip(n) {
    const npcs = getNPCs();
    if (n.special === 'cop') { bounce(n.root.position, 2.4); npcs.emit('copPoked', n, 'trip'); return; }   // he doesn't go down
    const tn = npcs.knockdown(n, player.position);
    if (!tn) return;
    interrupt();
    const p = player.position, q = n.root.position;
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1;
    player.heading = Math.atan2(dx, dz);              // face-plant toward them
    player.vel.set(dx / d * 1.2, 0, dz / d * 1.2);
    const lie = 1.2 + Math.random() * 0.5;
    const tp = charOf()?.knockdown(1, lie) ?? lie + 0.9;
    stun = downT = tp; slapping = null; target = null;
    dialogue.clear?.(n);
    setTimeout(() => {                                 // both hit the ground
      audio.thud(); shake = 0.16;
      tmp.copy(p).lerp(q, 0.5); tmp.y = q.y + 0.25; dustAt(tmp);
    }, 300);
    npcs.emit('playerTrip', n);
  }
  /** Bounced off something immovable: fly back a bit and land on your butt. */
  function bounce(from, power = 3.2) {
    interrupt();
    const p = player.position, dx = p.x - from.x, dz = p.z - from.z, d = Math.hypot(dx, dz) || 1;
    player.heading = Math.atan2(-dx, -dz);            // still facing them, falling backwards
    player.vel.set(dx / d * power, 0, dz / d * power);
    const lie = 0.9 + Math.random() * 0.4;
    const tp = charOf()?.knockdown(-1, lie) ?? lie + 0.9;
    stun = downT = tp; slapping = null; target = null;
    setTimeout(() => { audio.thud(); shake = 0.14; tmp.copy(p); tmp.y += 0.25; dustAt(tmp); }, 330);
    return tp;
  }
  function checkTrip(npcs) {
    if (!npcs || !player.airborne || stun > 0) return;
    const p = player.position;
    for (const n of npcs.list) {
      if (n.down) continue;
      const q = n.root.position;
      if (p.y - q.y > 1.75) continue;                  // sailed clean over their head (not with this jump)
      if ((p.x - q.x) ** 2 + (p.z - q.z) ** 2 < TRIP_DIST * TRIP_DIST) { trip(n); return; }
    }
  }

  // ---- per frame: called by main.js before the player moves ----
  // returns { lock } to freeze input, or { dir, speed } to auto-walk, or null
  function control(dt, keyMoving) {
    const npcs = getNPCs(); wire(npcs);
    checkTrip(npcs);
    if (downT > 0) downT = Math.max(0, downT - dt);
    if (stun > 0) {                                   // clamp at exactly 0: callers test `stun` for truthiness
      stun = Math.max(0, stun - dt);
      if (stun === 0) { player.vel.set(0, 0, 0); if (!player.airborne) player.antic = -1; }   // got up: clean slate
      return { lock: true };
    }
    if (lockT > 0) {                                  // a menu action clip is playing (dance-off, shove, fart)
      if (keyMoving && lockCancel) { interrupt(); return null; }   // WASD walks out of a dance-off
      lockT = Math.max(0, lockT - dt);
      if (lockFace) turnToward(lockFace, dt, 12);
      if (lockT === 0) lockCancel = null;
      return { lock: true };
    }
    if (slapping) {
      const n = slapping.npc, ch = charOf();
      slapping.t += dt;
      turnToward(n.root.position, dt, 20);
      if (!slapping.done && slapping.t >= slapping.hitAt) {
        slapping.done = true;
        const d = player.position.distanceTo(n.root.position);
        if (d < TUNE.reach + 0.5) { impact(player.root, n.root); dialogue.clear(n); npcs.slapped(n, player.position); }
        else audio.whoosh(0.5);
      }
      if (slapping.t >= slapping.hitAt + 0.25 || (ch && !ch.slapping && slapping.done)) slapping = null;
      return { lock: true };
    }
    if (!target) return null;
    if (keyMoving) { target = null; return null; }   // WASD cancels a pending slap
    approachT += dt;
    const p = player.position, q = target.root.position;
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
    if (actCb && d <= actReach) {
      const cb = actCb, n = target; actCb = null; target = null;
      player.vel.multiplyScalar(0.2);
      cb(n);
      return { lock: true };
    }
    if (!actCb && d <= TUNE.reach) {
      const ch = charOf();
      const hitAt = ch ? ch.slap() : 0.25;
      slapping = { npc: target, t: 0, hitAt, done: false };
      setTimeout(() => audio.whoosh(1), Math.max(0, (hitAt - 0.12) * 1000));
      target = null;
      player.vel.multiplyScalar(0.2);
      return { lock: true };
    }
    // give up if we cannot get there (timeout, or no progress for a while: walled off)
    if (d < bestD - 0.05) { bestD = d; stuckT = 0; } else stuckT += dt;
    if (approachT > APPROACH_TIMEOUT || stuckT > 0.8) { target = null; return null; }
    return { dir: { x: dx / d, z: dz / d }, speed: d > 4 ? 7 : APPROACH_SPEED };
  }
  function turnToward(q, dt, rate) {
    const want = Math.atan2(q.x - player.position.x, q.z - player.position.z);
    let diff = want - player.heading; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    player.heading += diff * Math.min(1, dt * rate);
  }

  // ---- screen shake (whole art pixels) + burst placement ----
  function placeBursts() {
    const now = performance.now(), w = canvas.clientWidth, h = canvas.clientHeight;
    const g = pixel && pixel.enabled ? pixel.scale : 1;
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      if (now > b.until) { b.el.remove(); bursts.splice(i, 1); continue; }
      tmp.copy(b.pos).project(camera);
      const x = Math.round(((tmp.x + 1) / 2 * w) / g) * g, y = Math.round(((1 - tmp.y) / 2 * h) / g) * g;
      b.el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }
  let last = performance.now();
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => {
    prev.apply(scene, a);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (shake > 0) {
      shake -= dt;
      const g = pixel && pixel.enabled ? pixel.scale : 1, amp = shake > 0.1 ? 2 : 1;
      const sx = (Math.random() < 0.5 ? -1 : 1) * amp * g, sy = (Math.random() < 0.5 ? -1 : 1) * Math.round(amp / 2) * g;
      const t = shake > 0 ? `translate(${sx}px, ${sy}px)` : '';
      canvas.style.transform = t; layer.style.transform = t;
    }
    placeBursts();
  };

  return {
    control, audio, approach, hold, interrupt, bounce, burstAt, dustAt, shakeIt: (s) => { shake = Math.max(shake, s); },
    get locked() { return lockT > 0; },
    get target() { return target; }, get slapping() { return slapping; }, get stun() { return stun; }, get down() { return downT > 0; }, trip,
    slap: (npc) => dialogue.onLongPress(npc),      // debug / tests
  };
}

// 44x32 art-pixel star burst, drawn per pixel so the edges stay crisp.
let STAR = null;
function starCanvas() {
  const c = document.createElement('canvas'); c.width = 44; c.height = 32;
  if (!STAR) {
    const W = 44, H = 32, cx = 21.5, cy = 15.5, spikes = 9;
    const r = (a, R0, R1) => {   // radius of a spiky star at angle a
      const s = (a / (Math.PI * 2)) * spikes, f = s - Math.floor(s);
      const tri = 1 - Math.abs(f - 0.5) * 2;
      const jag = 1 + 0.18 * Math.sin(Math.floor(s) * 2.7);        // irregular spikes read as comic
      return (R0 + (R1 - R0) * tri) * jag;
    };
    const inside = (x, y, k) => {
      const dx = (x - cx) / 1.25, dy = y - cy, a = Math.atan2(dy, dx) + Math.PI;
      return Math.hypot(dx, dy) <= r(a, 8.5 * k, 15 * k);
    };
    STAR = new ImageData(W, H);
    const put = (x, y, hex) => {
      const i = (y * W + x) * 4; STAR.data.set([1, 3, 5].map((j) => parseInt(hex.slice(j, j + 2), 16)).concat(255), i);
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!inside(x, y, 1)) continue;
      const edge = !inside(x + 1, y, 1) || !inside(x - 1, y, 1) || !inside(x, y + 1, 1) || !inside(x, y - 1, 1);
      put(x, y, edge ? '#292C2E' : inside(x, y, 0.62) ? '#FF5491' : '#FFCC3F');
    }
  }
  c.getContext('2d').putImageData(STAR, 0, 0);
  return c;
}

// 24x14 art-pixel dust puff (three grey blobs), cached
let DUST = null;
function dustCanvas() {
  const c = document.createElement('canvas'); c.width = 24; c.height = 14;
  if (!DUST) {
    DUST = new ImageData(24, 14);
    const blobs = [[6, 9, 4.6], [12, 6.5, 5.6], [18, 9, 4.6]];
    const inside = (x, y, k = 1) => blobs.some(([bx, by, r]) => Math.hypot(x + 0.5 - bx, (y + 0.5 - by) * 1.15) <= r * k);
    for (let y = 0; y < 14; y++) for (let x = 0; x < 24; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1);
      const col = edge ? [0x5E, 0x63, 0x66] : y < 7 ? [0xF0, 0xF2, 0xF4] : [0xC9, 0xCD, 0xD0];
      DUST.data.set(col.concat(255), (y * 24 + x) * 4);
    }
  }
  c.getContext('2d').putImageData(DUST, 0, 0);
  return c;
}

// Tiny WebAudio synth: band-passed noise sweep (whoosh) + noise crack with a low thump (smack).
class SlapAudio {
  constructor() { this.ctx = null; this.muted = false; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { this.ctx = new AC(); } catch { this.ctx = null; return; }
    const n = this.ctx.sampleRate * 0.5;
    this.noise = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  _noise(t0, dur, type, f0, f1, gain, q = 1) {
    const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(c.destination); src.start(t0); src.stop(t0 + dur + 0.02);
  }
  whoosh(vol = 1) {
    if (this.muted || !this.ctx) return;
    this._noise(this.ctx.currentTime, 0.16, 'bandpass', 500, 2600, 0.25 * vol, 1.4);
  }
  clap(vol = 1) {   // one hand clap: two quick bright noise ticks
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.045, 'bandpass', 2200, 1300, 0.16 * vol, 1.1);
    this._noise(t + 0.011, 0.035, 'bandpass', 1500, 900, 0.1 * vol, 1.1);
  }
  thud() {   // body hitting the pavement: low sine drop + muffled noise
    if (this.muted || !this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    this._noise(t, 0.16, 'lowpass', 600, 120, 0.55, 0.7);
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.2);
    g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.26);
  }
  // cartoon fart: wobbling low sawtooth through a resonant lowpass, flutter gated, plus a puff of noise.
  // Random length and pitch every time; silent when muted.
  fart() {
    if (this.muted || !this.ctx) return 0;
    const c = this.ctx, t = c.currentTime, dur = 0.35 + Math.random() * 0.85, f0 = 48 + Math.random() * 62;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * (1.1 + Math.random() * 0.4), t);
    o.frequency.exponentialRampToValueAtTime(f0 * (0.6 + Math.random() * 0.3), t + dur);
    const wob = c.createOscillator(), wg = c.createGain(); wob.frequency.value = 7 + Math.random() * 9; wg.gain.value = f0 * 0.3;
    wob.connect(wg).connect(o.frequency);
    const am = c.createGain(); am.gain.value = 0.6;
    const flut = c.createOscillator(), fg = c.createGain(); flut.type = 'square'; flut.frequency.value = 22 + Math.random() * 18; fg.gain.value = 0.4;
    flut.connect(fg).connect(am.gain);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(380 + Math.random() * 320, t); lp.frequency.exponentialRampToValueAtTime(160, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.025);
    g.gain.setValueAtTime(0.55, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(am).connect(lp).connect(g).connect(c.destination);
    for (const x of [o, wob, flut]) { x.start(t); x.stop(t + dur + 0.05); }
    this._noise(t, dur * 0.8, 'lowpass', 700, 150, 0.22, 1.5);
    return dur;
  }
  smack() {
    if (this.muted || !this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    this._noise(t, 0.09, 'highpass', 1800, 900, 0.7);
    this._noise(t, 0.05, 'bandpass', 3200, 2000, 0.4, 2);
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.16);
  }
}
