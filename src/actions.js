import * as THREE from 'three';
import { registerPools } from './french.js?v=20261031v';

// Right-click an NPC -> comic text-bubble ring: Dance-off / Push / Slap / Fart (+ Mission on job givers).
// The player walks up first (combat.approach), then the clip plays with input held (combat.hold).
// Cartoon mayhem: dance battles that can turn into street parties, shoves that domino, stink clouds.
const MENU_FAR = 9, MENU_DRIFT = 3.5;
const REACH = { dance: 1.9, push: 1.1, fart: 1.5 };
const SILLY = ['robot', 'chicken', 'disco', 'sprinkler'];
const MY_DANCES = ['flail', 'robot', 'sprinkler'];
const SIGNATURE = { mbappe: 'mbappe', syoya: 'hula' };
const DANCE_SECS = 6.2;
const L = {
  concede: ['ok ok you win', 'i yield!!', 'teach me, master', 'how do your legs DO that'],
  mock: ['lame.', 'my grandma dances better', 'was that a seizure?', 'cringe.'],
  party: ['WOOO!', 'DANCE PARTY!', 'yeah yeah YEAH!', 'go go go!'],
  bully: ["dance?! i'll show you a dance!", 'you serious?! c\'mere!', 'DANCE THIS!'],
  stink: ['UGH!', 'who did that?!', 'my eyes!!', 'dude...', 'WHAT DID YOU EAT?!', '*gag*', 'it burns!!'],
  cheer: ['WOOO!', '👏', '👏👏', 'GO GO GO!', 'WOOO!'],
  bullyWatch: ['nerds.', 'pfft.', '...'],
  copDance: ["dance? i'm ON DUTY.", 'not in uniform, pal.', 'move along.'],
  bullyLaugh: ['lol. weak.', 'HAHAHA', 'was that a push?', 'cute.', 'tickles.'],
  faint: ['my eyes!!', '*gasp*', 'so... green...'],
  mad: ['you nasty little-', 'oh you\'re gonna PAY', 'that\'s it!!'],
};
registerPools(L);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const G1 = '#4DBA5A', G2 = '#1F6B35';   // ring greens: the stink cloud

export function initActions({ scene, camera, renderer, pixel, player, getNPCs, dialogue, combat, missions }) {
  const canvas = renderer.domElement;
  const charOf = () => player.model?.userData?.character || null;
  const force = {};                       // tests: { outcome: 'mock'|'concede'|'mayhem', faint: true|false }
  const tmp = new THREE.Vector3();

  // ---- frame clock + cancellable timers ----
  let timers = [];
  function later(sec, fn, tag = null) { timers.push({ t: sec, fn, tag }); }
  function cancelTag(tag) { timers = timers.filter((x) => x.tag !== tag); }

  // ---- the ring menu (comic white text bubbles around the character) ----
  const menu = document.createElement('div'); menu.id = 'npc-menu'; document.body.appendChild(menu);
  let open = null;
  const hooks = {};                       // hooks.pickExtra(x, y) -> a non-NPC thing with its own menu (cats)
  const ITEMS = [['dance', 'Dance-off'], ['push', 'Push'], ['slap', 'Slap'], ['fart', 'Fart']];
  const SHOW = { dance: 'Dance-off', push: 'Push', slap: 'Slap', fart: 'Fart', mission: 'Mission', pet: 'Pet', weird: "That's weird!" };
  const RING_R0 = 96;                     // base radius; grows a bit with more buttons
  function openMenu(npc) {
    menu.innerHTML = '';
    const canMission = missions.isOfferNpc?.(npc) || (missions.mode === 'story' && npc.special === 'giver');
    const items = (npc.menuItems || (canMission ? [['mission', 'MISSION']] : []).concat(ITEMS)).concat(hooks.extraItems?.(npc) || []);   // cats: just PET; story hunt: + THAT'S WEIRD!
    items.forEach(([k, label], i) => {
      const b = document.createElement('button'); b.className = 'nm-btn'; b.dataset.act = k; b.type = 'button';
      b.style.animationDelay = (i * 0.03) + 's';
      const txt = document.createElement('span'); txt.className = 'nm-txt'; txt.textContent = SHOW[k] || label; b.appendChild(txt);
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); });
      b.addEventListener('click', (e) => { e.stopPropagation(); choose(k); });
      menu.appendChild(b);
    });
    open = { npc, at: npc.root.position.clone() };
    menu.style.display = 'block';
    placeMenu();
  }
  function closeMenu() { if (!open) return; open = null; menu.style.display = 'none'; menu.innerHTML = ''; }
  function placeMenu() {
    if (!open) return;
    const g = pixel && pixel.enabled ? pixel.scale : 1, w = canvas.clientWidth, h = canvas.clientHeight;
    open.npc.root.getWorldPosition(tmp); tmp.y += 1.15; tmp.project(camera);
    let cx = (tmp.x + 1) / 2 * w, cy = (1 - tmp.y) / 2 * h;
    const btns = [...menu.querySelectorAll('.nm-btn')], n = btns.length || 1;
    const R = RING_R0 + Math.max(0, n - 4) * 14;
    // measure buttons, then clamp the ring centre so every one stays on-screen
    let maxHalfW = 40, maxHalfH = 14;
    for (const b of btns) { maxHalfW = Math.max(maxHalfW, b.offsetWidth / 2); maxHalfH = Math.max(maxHalfH, b.offsetHeight / 2); }
    const pad = 6;
    cx = Math.max(R + maxHalfW + pad, Math.min(cx, w - R - maxHalfW - pad));
    cy = Math.max(R + maxHalfH + pad, Math.min(cy, h - R - maxHalfH - pad));
    btns.forEach((b, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const cos = Math.cos(a), sin = Math.sin(a);
      const bw = b.offsetWidth || 80, bh = b.offsetHeight || 28;
      let x = cx + cos * R - bw / 2, y = cy + sin * R - bh / 2;
      x = Math.max(pad, Math.min(x, w - bw - pad));
      y = Math.max(pad, Math.min(y, h - bh - pad));
      b.style.left = `${Math.round(x / g) * g}px`;
      b.style.top = `${Math.round(y / g) * g}px`;
    });
  }
  window.addEventListener('pointerdown', (e) => {
    const was = open;
    if (open && !menu.contains(e.target)) closeMenu();        // a click anywhere else closes it (and still does its thing)
    if (e.target !== canvas || e.button !== 2) return;
    const npc = hooks.pickExtra?.(e.clientX, e.clientY) || dialogue.pick(e.clientX, e.clientY);   // cats first (pickExtra)
    if (!npc) { e.preventDefault(); hooks.groundRight?.(e); return; }   // right click on the ground: drop a banana
    e.stopImmediatePropagation(); e.preventDefault();
    if (was && was.npc === npc) return;                       // right-click same character again = just closed
    dialogue.hideAll();
    openMenu(npc);
  }, true);
  window.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.code === 'Escape') { closeMenu(); return; }
    const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);   // number keys pick an item
    const btns = menu.querySelectorAll('.nm-btn');
    if (i >= 0 && btns[i]) { e.preventDefault(); choose(btns[i].dataset.act); }
  });

  function choose(kind) {
    if (!open) return;
    const n = open.npc; closeMenu();
    act(n, kind);
  }
  // left double-click on someone = PUSH (dialogue.js); also the menu's way in
  dialogue.onDoubleClick = (n) => { if (n.onChoose) return; dialogue.hideAll(); act(n, 'push'); };
  function act(n, kind) {
    if (hooks.onExtra?.(n, kind)) return;
    combat.audio.unlock();
    if (n.onChoose) { n.onChoose(kind); return; }
    if (kind === 'mission') { missions.clickGiver(n); return; }
    if (kind === 'slap') { combat.slap(n); return; }
    if (n.down && kind !== 'fart') { dialogue.show(n, '...', 1200); return; }
    combat.approach(n, REACH[kind], (t) => ACT[kind](t));
  }

  // ---- DANCE-OFF ----
  // ---- DANCE-OFF + street party ----
  const PARTY_R = 9, CROWD_MIN = 1, BIG_EXTRA = 4.6;   // you + your opponent + 1 more = a party; on-screen folks walk over to clap
  const canJoin = (o) => !o.down && !o.mode && !o.stagger && o.special !== 'bully' && o.special !== 'giver' && o.special !== 'cop' && !(missions.active && o.special);
  const crowdAt = (c, n) => getNPCs().list.filter((o) => o !== n && canJoin(o) && Math.hypot(o.root.position.x - c.x, o.root.position.z - c.z) < PARTY_R);
  function danceOff(n) {
    const npcs = getNPCs(), ch = charOf();
    if (n.down) return;
    if (n.special === 'bully') {                 // refuses. violently.
      dialogue.shout(n, pick(L.bully)); npcs.provoke(n, 0.35); return;
    }
    if (n.special === 'cop') { dialogue.shout(n, pick(L.copDance), 1800); return; }
    if (n.mode === 'chase' || n.mode === 'react') { npcs.provoke(n, 0.2); return; }
    const tag = { n };
    const myDance = ch?.def?.dance || pick(MY_DANCES);   // playing as a custom character: their own dance (e.g. "Bad")
    ch?.dance?.(myDance);
    if (n.c.dancing) n.c.stopDance(0.1);
    if (n.mode) n.mode = null;                       // even someone fleeing stops for a dance battle
    n.talkT = 1.4; n.talkTo = player.position;        // stop and size up the challenger
    const theirs = n.danceStyle || SIGNATURE[n.special] || pick(SILLY.filter((d) => d !== myDance));
    const center = new THREE.Vector3().copy(player.position).lerp(n.root.position, 0.5);
    const crowd = crowdAt(center, n);
    const big = crowd.length >= CROWD_MIN;           // enough people around: the street ALWAYS joins in
    state.lastCrowd = crowd.length;
    dialogue.showIcon(player, 'note', (big ? DANCE_SECS + BIG_EXTRA : DANCE_SECS) * 1000);
    if (big) callSpectators(center, n, crowd);
    later(1.1, () => {                                 // they answer the challenge
      if (getNPCs().danceAny(n, theirs, player.position)) dialogue.showIcon(n, 'note', (DANCE_SECS - 1.1) * 1000);
    }, tag);
    const stopAll = () => { ch?.stopDance?.(0.2); if (!n.party) n.c.stopDance(0.25); n.talkT = 0; };
    combat.hold(big ? DANCE_SECS + BIG_EXTRA : DANCE_SECS, n.root.position, () => { cancelTag(tag); stopAll(); dialogue.clear(player); });
    if (big) {
      state.lastOutcome = 'mayhem';
      later(1.7, () => { if (!n.down && !n.mode) startParty(n, crowd, center, DANCE_SECS + BIG_EXTRA - 1.7); else sendHome(); }, tag);
      later(DANCE_SECS, () => { const c = charOf(); if (!c?.dancing) c?.dance?.(c?.def?.dance || 'flail'); }, tag);
      later(DANCE_SECS + BIG_EXTRA, () => { ch?.stopDance?.(0.3); if (!P) sendHome(); }, tag);
    } else later(DANCE_SECS, () => {
      ch?.stopDance?.(0.25);
      const r = force.outcome || (Math.random() < 0.22 ? 'mayhem' : Math.random() < 0.5 ? 'concede' : 'mock');
      state.lastOutcome = r;
      if (r === 'mayhem') party(n);
      else { n.c.stopDance(0.25); dialogue.show(n, pick(L[r]), 2200); if (r === 'concede') n.c.hit?.(1); }
    }, tag);
    state.lastDance = { me: myDance, them: theirs, npc: n };
  }
  function party(n) {   // small-crowd mayhem: whoever's around joins in for a few seconds
    const c = new THREE.Vector3().copy(player.position).lerp(n.root.position, 0.5), PARTY = 4.4;
    startParty(n, crowdAt(c, n).slice(0, 8), c, PARTY);
    const ch = charOf(); ch?.dance?.(ch?.def?.dance || 'flail');
    combat.hold(PARTY, null, () => ch?.stopDance?.(0.2));
    later(PARTY, () => ch?.stopDance?.(0.3));
    dialogue.showIcon(player, 'note', PARTY * 1000);
  }

  // everyone on screen (except the bully, the cop, the giver) walks over to the ring's edge to watch
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4();
  let gathering = new Set(), gatherCenter = new THREE.Vector3();
  function onScreen(o) {
    camera.updateMatrixWorld(); pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pm);
    tmp.copy(o.root.position); tmp.y += 1;
    return frustum.containsPoint(tmp);
  }
  function callSpectators(center, n, crowd) {
    sendHome(); gatherCenter = center.clone ? center.clone() : new THREE.Vector3(center.x, 0, center.z);
    const npcs = getNPCs(), skip = new Set([n, ...crowd]);
    for (const o of npcs.list) {
      if (skip.has(o) || !canJoin(o) || !onScreen(o)) continue;
      const q = o.root.position;
      let dx = q.x - center.x, dz = q.z - center.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      const r = PARTY_R - 0.9 - Math.random() * 0.8;
      if (npcs.gatherTo(o, center.x + dx * r, center.z + dz * r)) { gathering.add(o); o.gathered = true; state.called++; }
    }
    state.lastCalled = gathering.size;
  }
  function sendHome() {   // the show's over: walk back to wherever they were
    const npcs = getNPCs();
    for (const o of gathering) { o.gathered = false; if (o.mode === 'gather' || !o.mode) { if (o.c.dancing) o.c.stopDance(0.3); npcs.goHome(o, 0.3 + Math.random() * 0.5); } }
    gathering = new Set();
  }

  // party state: dancers (crew), late-comers clap (spect), the bully watches with arms crossed (watch)
  let P = null;
  const ring = new THREE.Mesh(new THREE.RingGeometry(PARTY_R - 0.18, PARTY_R, 72, 1),
    new THREE.MeshBasicMaterial({ color: '#FFCC3F', transparent: true, opacity: 0, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 1; ring.visible = false; scene.add(ring);
  const danceFor = (o) => o.danceStyle || SIGNATURE[o.special] || pick(SILLY);
  function startParty(n, crew, center, dur) {
    if (P) endParty(true);
    P = { n, center: center.clone(), t: dur, T: dur, crew: new Set([n]), spect: new Set(), watch: new Set(), clapT: 0, wooT: 1.2 };
    ring.position.set(center.x, player.position.y + 0.03, center.z); ring.visible = true; ring.material.opacity = 0;
    dialogue.shout(n, pick(L.party));
    n.party = true; n.talkT = 0; n.danceTo = player.position;
    if (!n.c.dancing) n.c.dance(danceFor(n));
    crew.forEach((o, i) => later(0.15 * i, () => {
      if (!P || !canJoin(o)) return;
      P.crew.add(o); o.party = true; o.talkT = 0; o.danceTo = P.center; o.c.dance(danceFor(o));
      if (Math.random() < 0.4) dialogue.shout(o, pick(L.party), 1500); else dialogue.showIcon(o, 'note', Math.max(500, (P.t - 0.3) * 1000));
    }));
    for (const o of gathering) if (!o.mode && !o.down && o.c.dancing) { if (o.danceStyle) { P.crew.add(o); o.party = true; o.c.dance(danceFor(o)); } else { o.spectator = true; P.spect.add(o); } }
    state.lastParty = crew.length + 1; state.parties++;
  }
  function release(o) { o.party = false; o.spectator = false; if (!o.down && !o.mode && o.c.dancing) o.c.stopDance(0.3); o.talkT = 0; }
  function endParty(keep = false) {
    if (!P) return;
    for (const s of [P.crew, P.spect, P.watch]) for (const o of s) release(o);
    P = null; ring.visible = false;
    if (!keep) sendHome();
  }
  function stepParty(dt) {
    if (!P) return;
    P.t -= dt;
    ring.material.opacity = 0.45 * Math.min(1, (P.T - P.t) / 0.4, P.t / 0.5);
    if (P.t <= 0) { endParty(); return; }
    const inR = (o) => Math.hypot(o.root.position.x - P.center.x, o.root.position.z - P.center.z) < PARTY_R;
    for (const o of getNPCs().list) {
      if (o.mode === 'gather') continue;           // still walking over
      const busy = o.down || o.mode || o.stagger;
      if (P.crew.has(o)) {
        if (busy) { P.crew.delete(o); o.party = false; }
        else if (!o.c.dancing) { o.danceTo = o === P.n ? player.position : P.center; o.c.dance(danceFor(o)); }   // keep it going
        continue;
      }
      if (P.spect.has(o) || P.watch.has(o)) { if (busy) { P.spect.delete(o); P.watch.delete(o); o.spectator = false; } continue; }
      if (busy || (missions.active && o.special) || o.special === 'cop' || o.special === 'giver' || !inR(o)) continue;
      o.talkT = 0; o.danceTo = P.center; o.spectator = true;
      if (o.danceStyle) { P.crew.add(o); o.party = true; o.spectator = false; o.c.dance(danceFor(o)); continue; }   // has their own dance (custom "Bad" etc.): joins the crew, never just claps
      if (o.special === 'bully') { P.watch.add(o); o.c.dance('crossed'); if (Math.random() < 0.5) dialogue.shout(o, pick(L.bullyWatch), 1600); }
      else { P.spect.add(o); o.c.dance('clap'); state.claps++; }
    }
    if (P.spect.size) {
      if ((P.clapT -= dt) <= 0) { P.clapT = 0.16 + Math.random() * 0.14; combat.audio.clap(0.5 + Math.random() * 0.5); }
      if ((P.wooT -= dt) <= 0) { P.wooT = 1.1 + Math.random() * 1.4; dialogue.shout(pick([...P.spect]), pick(L.cheer), 1200); }
    }
  }

  // ---- PUSH ----
  function push(n) {
    const npcs = getNPCs(), ch = charOf();
    ch?.dance?.('shove');
    combat.hold(0.5, n.root.position);
    later(0.21, () => {
      const p = player.position, q = n.root.position;
      if (p.distanceTo(q) > REACH.push + 0.9 || n.down) { combat.audio.whoosh(0.5); return; }
      tmp.copy(p).lerp(q, 0.6); tmp.y = q.y + 1.4; combat.burstAt(tmp, 'SHOVE!');
      combat.audio.whoosh(1); combat.audio.smack(); combat.shakeIt(0.25);
      if (n.special === 'bully') { bullyBonk(n); return; }
      if (n.special === 'cop') { combat.bounce(q, 2.2); npcs.emit('copPoked', n, 'push'); return; }
      dialogue.clear(n);
      npcs.shove(n, p, n.special ? 6.5 : 7.5);
      npcs.emit('push', n);
    });
  }

  // the bully doesn't budge: you bounce off and land on your butt, he laughs and flexes
  function bullyBonk(n) {
    const npcs = getNPCs(), p = player.position, q = n.root.position;
    tmp.copy(p).lerp(q, 0.6); tmp.y = q.y + 1.5; combat.burstAt(tmp, Math.random() < 0.5 ? 'BONK' : 'SHOVE?');
    combat.audio.smack(); combat.shakeIt(0.12);
    n.c.stopDance?.(0.05);
    n.sway = 0.35;                                    // barely sways
    combat.bounce(q);
    state.bonks++;
    npcs.emit('bonk', n, null);
    later(0.35, () => dialogue.shout(n, pick(L.bullyLaugh), 2000));
    later(1.0, () => {
      if (n.down) return;
      if (missions.active) { npcs.provoke(n, 0.1); return; }
      n.mode = null; npcs.danceAny(n, 'flex', p);
    });
  }

  // ---- FART ----
  const clouds = [];
  function fart(n) {
    const ch = charOf(), p = player.position, q = n.root.position;
    const away = new THREE.Vector3(p.x * 2 - q.x, 0, p.z * 2 - q.z);    // turn the butt toward them
    ch?.dance?.('squat');
    combat.hold(0.95, away);
    later(0.32, () => {
      const dur = combat.audio.fart();
      tmp.copy(player.position); tmp.y += 1.1; combat.burstAt(tmp, pick(['BRRRT!', 'PFFRT!', 'BRAAP!']));
      cloud(player.position.clone(), dur);
    });
  }
  // pixel puff texture: two ring greens, crisp edges (NearestFilter), drawn once
  function puffTex() {
    const N = 16, c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d');
    const blobs = [[8, 9, 6], [5, 7, 3.6], [11, 6.5, 4]];
    const inside = (i, j) => blobs.some(([bx, by, r]) => Math.hypot(i + 0.5 - bx, j + 0.5 - by) <= r);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!inside(i, j)) continue;
      const edge = !inside(i + 1, j) || !inside(i - 1, j) || !inside(i, j + 1) || !inside(i, j - 1);
      x.fillStyle = edge || (j > 11 && (i + j) % 3 === 0) ? G2 : G1; x.fillRect(i, j, 1, 1);
    }
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function wavyTex(phase) {   // three wavy stink lines
    const c = document.createElement('canvas'); c.width = 12; c.height = 16;
    const x = c.getContext('2d'); x.fillStyle = G2;
    for (const cx of [2, 6, 10]) for (let j = 0; j < 14; j++) x.fillRect(cx + (((j >> 1) + phase + cx) % 4 < 2 ? 0 : 1) - 1, j + 1, 1, 1);
    const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  let PUFF = null, WAVY = null;
  function cloud(at, dur = 0.6) {
    PUFF ||= puffTex(); WAVY ||= [wavyTex(0), wavyTex(2)];
    const grp = new THREE.Group(); grp.position.copy(at); scene.add(grp);
    const puffs = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.SpriteMaterial({ map: PUFF, transparent: true, depthWrite: false, opacity: 0.9 });
      const s = new THREE.Sprite(m); grp.add(s);
      puffs.push({ s, a: i / 10 * Math.PI * 2 + Math.random() * 0.5, r: 0.5 + Math.random() * 0.6, y: 0.4 + Math.random() * 0.9, k: 0.8 + Math.random() * 0.5, d: Math.random() * 0.25 });
    }
    const lines = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.SpriteMaterial({ map: WAVY[0], transparent: true, depthWrite: false });
      const s = new THREE.Sprite(m); s.scale.set(0.5, 0.67, 1); grp.add(s);
      lines.push({ s, a: i / 3 * Math.PI * 2 + 0.4, ph: i * 0.37 });
    }
    clouds.push({ grp, puffs, lines, t: 0, life: 3.1 + Math.min(0.6, dur * 0.5), hit: new Set(), at });
    state.clouds++;
  }
  function stepClouds(dt) {
    const npcs = getNPCs();
    for (let ci = clouds.length - 1; ci >= 0; ci--) {
      const C = clouds[ci]; C.t += dt;
      const u = Math.min(1, C.t / C.life), spread = 1 - (1 - u) ** 2;
      const R = 0.9 + 2.6 * spread;                      // the cloud spreads out
      const fade = C.t > C.life - 0.7 ? Math.max(0, (C.life - C.t) / 0.7) : 1;
      for (const P of C.puffs) {
        const grow = Math.min(1, Math.max(0, C.t - P.d) / 0.25);
        const r = P.r * (0.4 + 0.6 * grow) + 2.3 * spread * P.k;
        P.s.position.set(Math.cos(P.a + C.t * 0.25) * r, P.y + C.t * 0.18 * P.k, Math.sin(P.a + C.t * 0.25) * r);
        const sc = (0.9 + 0.9 * spread) * P.k * grow; P.s.scale.set(sc, sc, 1);
        P.s.material.opacity = 0.9 * fade;
      }
      C.lines.forEach((Ln, i) => {
        const r = 0.6 + 1.6 * spread;
        Ln.s.position.set(Math.cos(Ln.a) * r, 1.4 + ((C.t * 0.7 + Ln.ph) % 1) * 0.8, Math.sin(Ln.a) * r);
        Ln.s.material.map = WAVY[Math.floor(C.t * 7 + i) % 2];
        Ln.s.material.opacity = fade;
      });
      if (npcs && C.t < C.life - 0.4) for (const n of npcs.list) {
        if (C.hit.has(n) || n.down) continue;
        const q = n.root.position;
        if (Math.hypot(q.x - C.at.x, q.z - C.at.z) < R) { C.hit.add(n); stinkReact(n, C.at); }
      }
      if (C.t >= C.life) { scene.remove(C.grp); C.puffs.forEach((P) => P.s.material.dispose()); C.lines.forEach((x) => x.s.material.dispose()); clouds.splice(ci, 1); }
    }
  }
  function stinkReact(n, at) {
    const npcs = getNPCs();
    state.stunk++;
    npcs.emit('stink', n);
    if (n.special === 'cop') return;            // police.js handles him
    const faint = force.faint ?? Math.random() < 0.16;
    if (faint && n.special !== 'bully') {
      dialogue.shout(n, pick(L.faint), 1300);
      later(0.45, () => {
        if (n.down) return;
        if (npcs.knockdown(n, at, 2.2 + Math.random() * 0.8, 'faint')) {
          state.faints++;
          later(0.36, () => { combat.audio.thud(); tmp.copy(n.root.position); tmp.y += 0.25; combat.dustAt(tmp); });
        }
      });
      return;
    }
    if (n.mode === 'chase' || n.mode === 'react') { dialogue.shout(n, pick(L.stink), 1400); return; }
    dialogue.shout(n, pick(L.stink), 1600);
    const away = new THREE.Vector3(n.root.position.x * 2 - at.x, 0, n.root.position.z * 2 - at.z);
    if (n.c.dancing) n.c.stopDance(0.05);
    n.talkT = 0; n.danceTo = away;
    later(0.02, () => { if (!n.down && !n.mode) n.c.dance('gag'); });
    later(1.05, () => {
      if (n.down || n.mode) return;
      if (n.temper === 'aggressive' && Math.random() < 0.55) { dialogue.shout(n, pick(L.mad), 1500); npcs.provoke(n, 0.2); }
      else npcs.flee(n, 2.5 + Math.random() * 1.5);
    });
  }

  // ---- land / domino feedback (thud + dust + shake) ----
  let wired = null;
  function wire(npcs) {
    if (!npcs || wired === npcs) return; wired = npcs;
    npcs.on('land', (n) => {
      combat.audio.thud(); combat.shakeIt(0.18);
      tmp.copy(n.root.position); tmp.y += 0.25; combat.dustAt(tmp);
      state.lands++;
    });
    npcs.on('domino', () => { state.dominoes++; });
    npcs.on('gathered', (o) => {                   // a spectator reached the ring: face the dancers and clap
      if (!gathering.has(o)) return;
      o.talkT = 0; o.danceTo = P ? P.center : gatherCenter;
      if (P && o.danceStyle) { P.crew.add(o); o.party = true; o.c.dance(danceFor(o)); return; }   // a dancer with their own move joins in
      o.c.dance('clap'); state.claps++;
      if (P) { o.spectator = true; P.spect.add(o); }   // early birds clap for the dance-off itself until the party starts
    });
    npcs.on('bonk', (o, flier) => {                  // someone got thrown into the bully: they bounce off
      if (!flier) return;
      state.bonks++; o.sway = 0.35; combat.audio.smack();
      tmp.copy(o.root.position); tmp.y += 1.5; combat.burstAt(tmp, 'BONK');
      later(0.3, () => dialogue.shout(o, pick(L.bullyLaugh), 1800));
    });
  }

  const ACT = { dance: danceOff, push, fart };
  const state = { clouds: 0, stunk: 0, faints: 0, lands: 0, dominoes: 0, lastOutcome: null, lastParty: 0, lastDance: null, bonks: 0, parties: 0, claps: 0, lastCrowd: 0, called: 0, lastCalled: 0 };
  let last = performance.now();
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => {
    prev.apply(scene, a);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    wire(getNPCs());
    for (const x of timers.slice()) { x.t -= dt; if (x.t <= 0) { timers.splice(timers.indexOf(x), 1); x.fn(); } }
    stepClouds(dt);
    stepParty(dt);
    if (open) {
      const n = open.npc, p = n.root.position;
      if (n.down || p.distanceTo(player.position) > MENU_FAR || Math.hypot(p.x - open.at.x, p.z - open.at.z) > MENU_DRIFT) closeMenu();
      else placeMenu();
    }
  };

  return { hooks, openMenu, closeMenu, choose, act, get open() { return open; }, menu, force, state, clouds, cloud, danceOff, push, fart, get party() { return P; }, get gathering() { return gathering; }, endParty, PARTY_R };
}
