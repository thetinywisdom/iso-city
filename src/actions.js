import * as THREE from 'three';

// Right-click an NPC -> small pixel context menu: DANCE-OFF / PUSH / SLAP / FART (+ MISSION on the giver).
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
  faint: ['my eyes!!', '*gasp*', 'so... green...'],
  mad: ['you nasty little-', 'oh you\'re gonna PAY', 'that\'s it!!'],
};
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

  // ---- the menu ----
  const menu = document.createElement('div'); menu.id = 'npc-menu'; document.body.appendChild(menu);
  let open = null;
  const ITEMS = [['dance', 'DANCE-OFF'], ['push', 'PUSH'], ['slap', 'SLAP'], ['fart', 'FART']];
  function openMenu(npc) {
    menu.innerHTML = '';
    if (npc.tag) { const h = document.createElement('div'); h.className = 'nm-head'; h.textContent = npc.tag; menu.appendChild(h); }
    const items = (npc.special === 'giver' ? [['mission', 'MISSION']] : []).concat(ITEMS);
    for (const [k, label] of items) {
      const b = document.createElement('button'); b.className = 'nm-item'; b.dataset.act = k; b.textContent = label;
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); });
      b.addEventListener('click', (e) => { e.stopPropagation(); choose(k); });
      menu.appendChild(b);
    }
    open = { npc, at: npc.root.position.clone() };
    menu.style.display = 'block';
    menu.style.animation = 'none'; void menu.offsetWidth; menu.style.animation = '';
    placeMenu();
  }
  function closeMenu() { if (!open) return; open = null; menu.style.display = 'none'; }
  function placeMenu() {
    if (!open) return;
    const g = pixel && pixel.enabled ? pixel.scale : 1, w = canvas.clientWidth, h = canvas.clientHeight;
    open.npc.root.getWorldPosition(tmp); tmp.y += 1.5; tmp.project(camera);
    let x = (tmp.x + 1) / 2 * w + 33, y = (1 - tmp.y) / 2 * h - 45;
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    if (x + mw > w - 6) x -= mw + 66;                       // flip to the left near the screen edge
    x = Math.max(6, x); y = Math.max(6, Math.min(y, h - mh - 6));
    menu.style.transform = `translate(${Math.round(x / g) * g}px, ${Math.round(y / g) * g}px)`;
  }
  window.addEventListener('pointerdown', (e) => {
    if (open && !menu.contains(e.target)) closeMenu();        // a click anywhere else closes it (and still does its thing)
    if (e.target !== canvas || e.button !== 2) return;
    const npc = dialogue.pick(e.clientX, e.clientY);
    if (!npc) return;                                          // right click on the ground: nothing
    e.stopImmediatePropagation(); e.preventDefault();
    dialogue.hideAll();
    openMenu(npc);
  }, true);
  window.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.code === 'Escape') { closeMenu(); return; }
    const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);   // number keys pick an item
    const btns = menu.querySelectorAll('.nm-item');
    if (i >= 0 && btns[i]) { e.preventDefault(); choose(btns[i].dataset.act); }
  });

  function choose(kind) {
    if (!open) return;
    const n = open.npc; closeMenu();
    combat.audio.unlock();
    if (kind === 'mission') { missions.clickGiver(); return; }
    if (kind === 'slap') { combat.slap(n); return; }
    if (n.down && kind !== 'fart') { dialogue.show(n, '...', 1200); return; }
    combat.approach(n, REACH[kind], (t) => ACT[kind](t));
  }

  // ---- DANCE-OFF ----
  function danceOff(n) {
    const npcs = getNPCs(), ch = charOf();
    if (n.down) return;
    if (n.special === 'bully') {                 // refuses. violently.
      dialogue.shout(n, pick(L.bully)); npcs.provoke(n, 0.35); return;
    }
    if (n.mode === 'chase' || n.mode === 'react') { npcs.provoke(n, 0.2); return; }
    const tag = { n };
    const myDance = pick(MY_DANCES);
    ch?.dance?.(myDance);
    dialogue.showIcon(player, 'note', DANCE_SECS * 1000);
    if (n.c.dancing) n.c.stopDance(0.1);
    if (n.mode) n.mode = null;                       // even someone fleeing stops for a dance battle
    n.talkT = 1.4; n.talkTo = player.position;        // stop and size up the challenger
    const theirs = SIGNATURE[n.special] || pick(SILLY.filter((d) => d !== myDance));
    later(1.1, () => {                                 // they answer the challenge
      if (getNPCs().danceAny(n, theirs, player.position)) dialogue.showIcon(n, 'note', (DANCE_SECS - 1.1) * 1000);
    }, tag);
    const stopAll = () => { ch?.stopDance?.(0.2); if (!n.party) n.c.stopDance(0.25); n.talkT = 0; };
    combat.hold(DANCE_SECS, n.root.position, () => { cancelTag(tag); stopAll(); dialogue.clear(player); });
    later(DANCE_SECS, () => {
      ch?.stopDance?.(0.25);
      const r = force.outcome || (Math.random() < 0.22 ? 'mayhem' : Math.random() < 0.5 ? 'concede' : 'mock');
      state.lastOutcome = r;
      if (r === 'mayhem') party(n);
      else { n.c.stopDance(0.25); dialogue.show(n, pick(L[r]), 2200); if (r === 'concede') n.c.hit?.(1); }
    }, tag);
    state.lastDance = { me: myDance, them: theirs, npc: n };
  }
  function party(n) {   // the street joins in: nearby people dance and cheer for a few seconds
    const npcs = getNPCs(), p = player.position, crew = [];
    for (const o of npcs.list) {
      if (o === n || o.down || o.mode || o.special === 'bully' || o.special === 'giver') continue;
      if (o.root.position.distanceTo(p) < 13 && crew.length < 6) crew.push(o);
    }
    const all = [n, ...crew], PARTY = 4.4;
    dialogue.shout(n, pick(L.party));
    all.forEach((o, i) => later(0.18 * i, () => {
      if (o.down || o.mode) return;
      const d = SIGNATURE[o.special] || pick(SILLY);
      o.talkT = 0; o.danceTo = p; o.c.dance(d); o.party = true;
      if (i && Math.random() < 0.5) dialogue.shout(o, pick(L.party), 1500); else dialogue.showIcon(o, 'note', (PARTY - 0.3) * 1000);
      later(PARTY - 0.18 * i, () => { o.party = false; o.c.stopDance(0.3); });
    }));
    const ch = charOf(); ch?.dance?.('flail');
    combat.hold(PARTY, null, () => ch?.stopDance?.(0.2));
    later(PARTY, () => ch?.stopDance?.(0.3));
    dialogue.showIcon(player, 'note', PARTY * 1000);
    state.lastParty = all.length;
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
      dialogue.clear(n);
      npcs.shove(n, p, n.special ? 6.5 : 7.5);
      npcs.emit('push', n);
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
  }

  const ACT = { dance: danceOff, push, fart };
  const state = { clouds: 0, stunk: 0, faints: 0, lands: 0, dominoes: 0, lastOutcome: null, lastParty: 0, lastDance: null };
  let last = performance.now();
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => {
    prev.apply(scene, a);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    wire(getNPCs());
    for (const x of timers.slice()) { x.t -= dt; if (x.t <= 0) { timers.splice(timers.indexOf(x), 1); x.fn(); } }
    stepClouds(dt);
    if (open) {
      const n = open.npc, p = n.root.position;
      if (n.down || p.distanceTo(player.position) > MENU_FAR || Math.hypot(p.x - open.at.x, p.z - open.at.z) > MENU_DRIFT) closeMenu();
      else placeMenu();
    }
  };

  return { openMenu, closeMenu, choose, get open() { return open; }, menu, force, state, clouds, cloud, danceOff, push, fart };
}
