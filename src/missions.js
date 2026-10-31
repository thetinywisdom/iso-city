import * as THREE from 'three';

// ---------------------------------------------------------------------------------------------
// Missions: free-roam jobs are spread across NPCs (see each def.giver). Story mode still uses the
// shady guy for all paid jobs. Data-driven: add an entry to MISSIONS. Each mission gets a fresh
// state object `S` and the manager `g` (helpers + live refs). Optional hooks:
//   start(S, g)  update(S, dt, g)  hud(S, g) -> { progress, lines?, timer? }  target(S, g) -> Vector3|null
//   onSlap(S, npc, g)  onLine(S, npc, line, g)  pickLine(S, npc, g) -> line|null  onClick(S, npc, g) -> bool
//   onHitPlayer(S, npc, g)  onCaught(S, npc, g)  cleanup(S, g, result)      result: 'complete'|'fail'|'abort'
// Inside a mission call g.complete(line) / g.fail(line). All text: pixel font, swears asterisked.
// ---------------------------------------------------------------------------------------------
export const TUNING = {
  slapTour: { count: 5, time: 60 },
  rejected: { time: 90, bias: 0.6 },
  bully: { speed: 6.65, accel: 9, react: 0.55, safe: { x: -11.0, z: 21.5, r: 1.8 } },
  ball: { speed: 5.7, accel: 7, react: 0.75, escapeDist: 15, surviveTime: 12, pickup: 0.95, clickPx: 30 },
  cap: { time: 90, spot: { x: 12.8, y: 2.8, z: -6.3 }, under: { x: 12.8, z: -6.0 }, reach: 1.8, jumpMin: 0.05, clickPx: 46, giveBack: 2.4, clickGive: 4.5 },
};
const RUDE = ['f**k off', 'go away', 'not interested', 'excuse me?', 'who are you?'];
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const MISSIONS = [
  {
    id: 'slap-tour', name: 'SLAP TOUR', goal: 'slap 5 different people in 60s.',
    giver: 'giver', offer: 'cardio, but make it assault.',
    start(S) { S.hit = new Set(); S.t = TUNING.slapTour.time; },
    update(S, dt, g) { S.t -= dt; if (S.t <= 0) g.fail('time\'s up. weak wrists.'); },
    onSlap(S, n, g) {
      if (n.special === 'giver' || S.hit.has(n)) return;
      S.hit.add(n); g.toast(`SLAP ${S.hit.size}/${TUNING.slapTour.count}`);
      if (S.hit.size >= TUNING.slapTour.count) g.complete('5 faces. zero regrets.');
    },
    hud: (S) => ({ progress: `SLAPPED ${S.hit.size}/${TUNING.slapTour.count}`, timer: S.t }),
    target(S, g) {   // nearest person you haven't slapped yet
      let best = null, bd = Infinity;
      for (const n of g.npcs().list) {
        if (S.hit.has(n) || n.special === 'giver' || n.special === 'bully') continue;
        const d = flat(n.root.position, g.player.position); if (d < bd) { bd = d; best = n; }
      }
      return best && best.root.position;
    },
  },
  {
    id: 'rejected', name: 'GET REJECTED', goal: 'collect 5 different rude replies.',
    giver: 'giver', offer: 'go talk to people. get dunked on.',
    start(S) { S.got = []; S.t = TUNING.rejected.time; },
    update(S, dt, g) { S.t -= dt; if (S.t <= 0) g.fail('nobody hates you enough. yet.'); },
    pickLine(S) {   // while active, people are ruder than usual
      const left = RUDE.filter((l) => !S.got.includes(l));
      return left.length && Math.random() < TUNING.rejected.bias ? left[Math.floor(Math.random() * left.length)] : null;
    },
    onLine(S, n, line, g) {
      if (!RUDE.includes(line) || S.got.includes(line)) return;
      S.got.push(line); g.toast(`"${line}" ${S.got.length}/5`);
      if (S.got.length >= RUDE.length) g.complete('rejected 5 times. proud of you.');
    },
    hud: (S) => ({ progress: `REJECTIONS ${S.got.length}/5`, timer: S.t, lines: RUDE.map((l) => (S.got.includes(l) ? `"${l}"` : '- - -')) }),
    target(S, g) {
      let best = null, bd = Infinity;
      for (const n of g.npcs().list) {
        if (n.special) continue;
        const d = flat(n.root.position, g.player.position); if (d < bd && d > 1.6) { bd = d; best = n; }
      }
      return best && best.root.position;
    },
  },
  {
    id: 'bully', name: 'POKE THE BULLY', goal: 'slap the bully. run to the park circle.',
    giver: 'big-deb', offer: "That bully thinks he's tougher than me. Go slap him for me.",
    start(S, g) {
      S.b = g.special('bully'); S.phase = 'poke';
      g.npcs().calm(S.b, 0); S.b.mode = null;
      const s = TUNING.bully.safe; g.safeZone(s.x, s.z, s.r, true);
    },
    onSlap(S, n, g) {
      if (n !== S.b || S.phase !== 'poke') return;
      S.phase = 'run'; S.t = 0;
      const T = TUNING.bully;
      g.npcs().forceChase(n, { speed: T.speed, accel: T.accel, react: T.react, noGiveUp: true, chase: "you're DEAD, n**d!" });
      g.later(0.25, () => g.dialogue.shout(n, 'oh you did NOT.'));
    },
    update(S, dt, g) {
      if (S.phase !== 'run') return;
      S.t += dt;
      const s = TUNING.bully.safe;
      if (flat(g.player.position, s) < s.r) {
        g.complete('safe! he can\'t enter parks. (court order)');
        g.dialogue.shout(S.b, 'ugh. parks are for nerds.', 2200);
      }
    },
    onHitPlayer(S, n, g) {
      if (n !== S.b || S.phase !== 'run') return;
      S.phase = 'caught';
      g.fail('BULLY: "get rekt, n**d."');
      g.later(0.4, () => g.dialogue.shout(n, 'get rekt, n**d.', 2000));
    },
    cleanup(S, g) {
      g.safeZone(0, 0, 0, false);
      g.later(1.4, () => g.npcs().calm(S.b, 0.2));
    },
    hud: (S, g) => S.phase === 'run'
      ? { progress: `RUN! PARK ${Math.max(0, flat(g.player.position, TUNING.bully.safe) - TUNING.bully.safe.r).toFixed(0)}m` }
      : { progress: 'SLAP THE BULLY' },
    markNpc: (S) => S.b || null,
    target: (S) => (S.phase === 'poke' ? S.b.root.position : new THREE.Vector3(TUNING.bully.safe.x, 0, TUNING.bully.safe.z)),
  },
  {
    id: 'ball', name: 'STEAL MBAPPÉ\'S BALL', goal: 'grab the ball. escape (15m or 12s).',
    giver: 'bully', offer: 'that french guy with the ball? steal it. now.',
    start(S, g) {
      S.m = g.special('mbappe'); S.ball = S.m.ball; S.phase = 'grab'; S.t = 0;
      g.resetBall(); S.dir = new THREE.Vector3(0, 0, 1);
    },
    onPointer(S, x, y, g) {                // clicking the ball walks you to it (instead of slapping Mbappe behind it)
      if (S.phase !== 'grab' || !g.nearScreen(S.ball.position, 0.05, x, y, TUNING.ball.clickPx)) return false;
      const b = S.ball.position, m = S.m.root.position, dx = b.x - m.x, dz = b.z - m.z, d = Math.hypot(dx, dz) || 1;
      g.player.walkTo(b.x + dx / d * 0.35, b.z + dz / d * 0.35);
      return true;
    },
    update(S, dt, g) {
      const p = g.player.position, T = TUNING.ball;
      if (S.phase === 'grab') {
        if (flat(p, S.ball.position) < T.pickup) {
          S.phase = 'run'; S.t = 0;
          g.npcs().forceChase(S.m, { speed: T.speed, accel: T.accel, react: T.react, noGiveUp: true, catch: true, chase: 'OI! MY BALL!' });
          g.dialogue.shout(S.m, 'OI! MY BALL!');
          g.toast('GOT THE BALL. RUN!');
        }
        return;
      }
      if (S.phase !== 'run') return;
      S.t += dt;
      // dribble: the ball rolls just ahead of your feet
      const v = g.player.vel; if (v.lengthSq() > 0.5) S.dir.set(v.x, 0, v.z).normalize();
      const b = S.ball.position, tx = p.x + S.dir.x * 0.5, tz = p.z + S.dir.z * 0.5;
      const mx = tx - b.x, mz = tz - b.z; b.x = tx; b.z = tz;
      b.y = g.city.groundHeight(b.x, b.z) + 0.11;
      S.ball.rotation.x += mz / 0.11; S.ball.rotation.z -= mx / 0.11;
      if (flat(p, S.m.root.position) > T.escapeDist || S.t >= T.surviveTime) {
        S.phase = 'done';
        g.complete('he\'ll live. he has like 40 balls.');
        const m = S.m, npcs = g.npcs();
        m.chaseCfg = null; m.mode = null; m.stagger = null;
        g.dialogue.shout(m, '*shrug* whatever.', 1500);
        g.later(1.3, () => { const secs = npcs.dance(m, g.player.position); if (secs) g.dialogue.showIcon(m, 'note', secs * 1000 - 300);
          g.later((secs || 0) + 0.3, () => { if (!m.mode) npcs.calm(Object.assign(m, { mode: 'return' }), 0); }); });
      }
    },
    onCaught(S, n, g) {
      if (n !== S.m || S.phase !== 'run') return;
      S.phase = 'caught';
      g.fail('MBAPPÉ: "À moi. Évidemment." (mine. obviously.)');
      g.dialogue.shout(n, 'mine. obviously.', 2000);
    },
    onTrip(S, n, g) {                    // tripped over someone mid-escape: the ball rolls off, he takes it back
      if (S.phase !== 'run') return;
      S.phase = 'caught';
      const b = S.ball.position, p = g.player.position;
      b.x = p.x + S.dir.x * 1.4; b.z = p.z + S.dir.z * 1.4; b.y = g.city.groundHeight(b.x, b.z) + 0.11;
      g.fail('you tripped. MBAPPÉ: "Merci!" (thanks!)');
      g.later(0.5, () => g.dialogue.shout(S.m, 'thanks for the ball!', 1800));
    },
    cleanup(S, g, result) {
      g.resetBall();
      if (result !== 'complete') g.npcs().calm(S.m, 0.8);
    },
    hud: (S, g) => S.phase === 'grab' ? { progress: 'GRAB THE BALL' }
      : { progress: `ESCAPE ${Math.min(TUNING.ball.escapeDist, flat(g.player.position, S.m.root.position)).toFixed(0)}/${TUNING.ball.escapeDist}m`, timer: Math.max(0, TUNING.ball.surviveTime - S.t) },
    markNpc: (S) => S.m || null,
    target: (S) => (S.phase === 'grab' ? S.ball.position : null),
  },
  {
    id: 'cap', name: 'KIMATA\'S CAP', goal: 'find kimata\'s cap. bring it back.',
    giver: 'syoya', offer: 'someone yeeted my cap. go fetch it for me?',
    start(S, g) {
      S.s = g.special('syoya'); S.phase = 'find'; S.t = TUNING.cap.time;
      S.s.c.cap.visible = false;
      S.cap = g.spawnCap(S.s.c.cap);
      const c = TUNING.cap.spot; S.cap.position.set(c.x, c.y, c.z);
      S.spark = g.sparkle(); S.cap.add(S.spark);
      S.onKey = (e) => { if (e.code === 'KeyE') S.eT = 0.35; };
      window.addEventListener('keydown', S.onKey);
      g.later(0.2, () => g.dialogue.shout(S.s, 'MY CAP?! it\'s on the bus stop!!', 2600));
    },
    update(S, dt, g) {
      S.t -= dt; if (S.t <= 0) return g.fail('kimata is capless forever. (until retry)');
      const p = g.player.position, T = TUNING.cap;
      if (S.phase === 'find') {
        S.cap.rotation.y += dt * 1.5; S.bob = (S.bob || 0) + dt;
        S.cap.position.y = T.spot.y + Math.abs(Math.sin(S.bob * 3)) * 0.12;   // hop so it reads as 'pick me up'
        S.spark.material.opacity = 0.65 + Math.sin(S.bob * 9) * 0.35; S.spark.material.rotation = S.bob * 2;
        // forgiving grab: anywhere near the shelter front, then jump (any height), press E, or click the cap
        const lift = p.y - g.city.groundHeight(p.x, p.z), near = flat(p, T.under) < T.reach;
        if (S.eT > 0) S.eT -= dt;
        if (near && (lift > T.jumpMin || g.player.airborne || S.eT > 0 || S.want)) {
          S.phase = 'carry'; S.spark.visible = false; g.toast('GOT THE CAP!');
        }
      } else if (S.phase === 'carry') {
        S.cap.position.set(p.x, p.y + 2.05, p.z); S.cap.rotation.y = g.player.heading + Math.PI;
        if (flat(p, S.s.root.position) < T.giveBack) this.handOver(S, g);
      }
    },
    handOver(S, g) {
      S.phase = 'done';
      g.complete('cap secured. hula unlocked.');
      g.later(0.15, () => g.dialogue.say(S.s));   // puts it on, hula + heart
    },
    onClick(S, n, g) {
      if (n !== S.s || S.phase === 'done') return false;
      // clicking him while carrying hands it over if you're close-ish (he may stand somewhere awkward)
      if (S.phase === 'carry' && flat(g.player.position, n.root.position) < TUNING.cap.clickGive) { this.handOver(S, g); return true; }
      g.dialogue.shout(n, S.phase === 'carry' ? 'come closer!!' : 'where\'s my cap?!', 1600); return true;
    },
    onPointer(S, x, y, g) {                // click on/near the cap: walk under it and grab it on arrival
      if (S.phase !== 'find') return false;
      S.want = g.nearScreen(S.cap.position, 0.1, x, y, TUNING.cap.clickPx);
      if (S.want) g.player.walkTo(TUNING.cap.under.x, TUNING.cap.under.z);
      return S.want;
    },
    cleanup(S, g) { S.s.c.cap.visible = true; S.cap.removeFromParent(); window.removeEventListener('keydown', S.onKey); },
    hud: (S) => ({ progress: S.phase === 'find' ? 'GET THE CAP (JUMP / E / CLICK)' : 'BRING IT TO KIMATA', timer: S.t }),
    // Cap is an object during 'find'; Kimata is the single NPC target once you carry it back.
    markNpc: (S) => (S.phase === 'carry' || S.phase === 'done') ? (S.s || null) : null,
    target: (S) => (S.phase === 'find' ? S.cap.position : S.s.root.position),
  },
];

const GIVER_LINES = {
  first: 'psst. wanna do something stupid?',
  again: ['you again? fine.', 'back for more?', 'i got a job. a dumb one.'],
  turnIn: 'legend.',
  busy: 'you\'re on a job. go. GO.',
  menace: 'ok you\'re officially a menace. more coming soon.',
  later: 'coward. i\'ll be here.',
};
// story mode (RENT'S DUE): the same 5 gigs, but as paid jobs. No stars, no unlocks, no free-roam save.
const JOB_LINES = { first: 'psst. need rent money? i got jobs.', again: ['you again? rent\'s not gonna pay itself.', 'back for more? same jobs. obviously.', 'pick one. any one. they all pay.'], later: 'broke AND a coward. ok.' };
const SAVE_KEY = 'isoCity.missions.v1';

// tiny per-pixel art (crisp at any pixel scale)
const ART = {
  // HUD tracker stars only. Floating ? / ! marks use the v=20261031i comic talk-hint bubble look.
  star: ['....X....', '...XYX...', '...XYX...', 'XXXXYXXXX', 'XYYYYYYYX', '.XYYYYYX.', '..XYYYX..', '.XYYXYYX.', 'XYXX.XXYX', 'XX.....XX'],
  starOff: ['....X....', '...XWX...', '...XWX...', 'XXXXWXXXX', 'XWWWWWWWX', '.XWWWWWX.', '..XWWWX..', '.XWWXWWX.', 'XWXX.XXWX', 'XX.....XX'],
};
const COL = { X: '#292C2E', Y: '#FFCC3F', W: '#5B6A7B', P: '#FF5491', F: '#F0F2F4' };
function artCanvas(kind, s = 3) {
  const rows = ART[kind], c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const x = c.getContext('2d');
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') { x.fillStyle = COL[ch]; x.fillRect(i, j, 1, 1); } }));
  c.style.width = c.width * s + 'px'; c.style.height = c.height * s + 'px';
  return c;
}

export function initMissions({ scene, camera, renderer, pixel, city, player, getNPCs, dialogue, combat }) {
  const canvas = renderer.domElement;
  // ---- save ----
  const blank = () => ({ stars: [], unlocked: MISSIONS.length - 1, turnIn: [], met: false });
  let save = blank();
  if (new URLSearchParams(location.search).get('reset') === '1') { try { localStorage.removeItem(SAVE_KEY); } catch {} }
  try { save = { ...blank(), ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; } catch {}
  // Phase 1 multi-giver: every free-roam job is available from its own NPC (no sequential unlock).
  if (!save.story) save.unlocked = Math.max(save.unlocked ?? 0, MISSIONS.length - 1);
  // play mode: null (title up: nothing shows), 'free' (the old 5-mission tracker + stars, saved), 'story' (paid jobs only,
  // a throwaway in-memory record; the free-roam save is never read or written while the story runs)
  let mode = null;
  let freeSave = save;
  const storyBlank = () => ({ stars: [], unlocked: MISSIONS.length - 1, turnIn: [], met: false, story: true });
  const persist = () => { if (mode === 'story' || save.story) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };

  let active = null;     // { def, S }
  let lastFailed = null; // def, for R = retry
  let timers = [];
  const later = (secs, fn) => timers.push({ t: secs, fn });

  // ---- DOM: HUD, banner, offer panel, giver marker, off-screen arrow ----
  const root = document.createElement('div'); root.id = 'missions'; document.body.appendChild(root);
  const hud = document.createElement('div'); hud.id = 'mission-hud'; root.appendChild(hud);
  const banner = document.createElement('div'); banner.id = 'mission-banner'; root.appendChild(banner);
  const toastEl = document.createElement('div'); toastEl.id = 'mission-toast'; root.appendChild(toastEl);
  const panel = document.createElement('div'); panel.id = 'mission-offer'; root.appendChild(panel);
  // Pool of floating marks: '?' on every giver, '!' on a single-NPC mission target. No floating star.
  const markPool = [];
  function acquireMark() {
    let m = markPool.find((x) => x.free);
    if (!m) {
      const el = document.createElement('div'); el.className = 'mission-mark'; root.appendChild(el);
      m = { el, free: true, kind: null }; markPool.push(m);
    }
    m.free = false; return m;
  }
  function releaseMarks() {
    // Free + hide (used when leaving a mode / clearing everything).
    for (const m of markPool) { m.free = true; m.el.style.display = 'none'; }
  }
  function paintMark(m, kind) {
    // kind 'q' → '?' (ask), 'bang' → '!' — big comic bubble. Avoid toggling display when
    // already showing the same kind so CSS animations are not restarted every frame.
    if (m.kind === kind && m.el.firstChild) {
      if (m.el.style.display !== 'block') m.el.style.display = 'block';
      return;
    }
    m.kind = kind; m.el.replaceChildren();
    if (!kind) { m.el.className = 'mission-mark'; m.el.style.display = 'none'; return; }
    const glyph = kind === 'bang' ? '!' : '?';
    m.el.className = 'mission-mark talk-hint-mark ' + (kind === 'bang' ? 'bang' : 'ask');
    const bb = document.createElement('div'); bb.className = 'bb'; bb.textContent = glyph;
    m.el.appendChild(bb);
    m.el.style.left = '0'; m.el.style.top = '0';
    m.el.style.display = 'block';
  }
  const arrow = document.createElement('canvas'); arrow.id = 'mission-arrow'; arrow.width = arrow.height = 11; root.appendChild(arrow);
  let bannerTimer = 0, toastTimer = 0;

  const g = {
    player, city, dialogue, later,
    npcs: getNPCs,
    special: (key) => getNPCs()?.list.find((n) => n.special === key),
    toast(text) { toastEl.textContent = text; toastEl.style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => (toastEl.style.display = 'none'), 1400); },
    complete(line) { finish('complete', line); },
    fail(line) { finish('fail', line); },
    resetBall() { const m = g.special('mbappe'); if (m?.ball && m.ballHome) { m.ball.position.copy(m.ballHome); m.ball.rotation.set(0, 0, 0); } },
    spawnCap(src) {   // world copy of a cap mesh group (same toon materials)
      const cap = src.clone(true); cap.visible = true; cap.rotation.set(0, 0, 0); cap.position.set(0, 0, 0);
      const holder = new THREE.Group(); holder.add(cap); cap.scale.setScalar(2.1); cap.position.y = -0.02;
      holder.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(holder); pixel.toonify?.(holder); return holder;
    },
    project: (p, dy) => project(p, dy),
    nearScreen(p, dy, x, y, px) { const q = project(p, dy), r = canvas.getBoundingClientRect(); return Math.hypot(x - r.left - q.x, y - r.top - q.y) < px; },
    sparkle() {       // bright pulsing 4-point star sprite (unlit, always on top) so pickups are easy to spot
      const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
      x.fillStyle = '#fff6a0'; x.fillRect(7, 1, 2, 14); x.fillRect(1, 7, 14, 2); x.fillStyle = '#ffffff'; x.fillRect(6, 6, 4, 4);
      x.fillStyle = '#ffd23a'; x.fillRect(7, 3, 2, 1); x.fillRect(7, 12, 2, 1); x.fillRect(3, 7, 1, 2); x.fillRect(12, 7, 1, 2);
      const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
      s.scale.setScalar(1.1); s.position.set(0.3, 0.55, 0); s.renderOrder = 999; return s;
    },
    safeZone(x, z, r, on) {
      zone.visible = on; if (!on) return;
      zone.position.set(x, city.groundHeight(x, z) + 0.09, z); zone.userData.r = r; zone.scale.setScalar(r);
    },
  };

  // park safe-zone ring (yellow, flat, pulses)
  const zone = new THREE.Group(); zone.visible = false; scene.add(zone);
  {
    const ringM = new THREE.MeshBasicMaterial({ color: '#FFCC3F', side: THREE.DoubleSide });
    const edgeM = new THREE.MeshBasicMaterial({ color: '#292C2E', side: THREE.DoubleSide });
    const a = new THREE.Mesh(new THREE.RingGeometry(0.82, 1.0, 32), ringM); a.rotation.x = -Math.PI / 2; zone.add(a);
    const b = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.08, 32), edgeM); b.rotation.x = -Math.PI / 2; b.position.y = -0.005; zone.add(b);
    const c = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 24), ringM); c.rotation.x = -Math.PI / 2; zone.add(c);
  }

  // ---- giver offer (free roam: per-NPC jobs; story: shady guy still offers every job) ----
  const npcKey = (n) => (n && (n.special || n.cityKey)) || null;
  const findGiver = (key) => getNPCs()?.list.find((n) => n.special === key || n.cityKey === key) || null;
  const giverLabel = (key) => { const n = findGiver(key); return (n && (n.tag || n.cityKey || n.special) || key || '?').toString().toUpperCase(); };
  const missionsFor = (n) => {
    if (!n || !mode) return [];
    if (mode === 'story') return n.special === 'giver' ? MISSIONS.map((d, i) => ({ d, i })).filter(({ i }) => i <= save.unlocked) : [];
    const key = npcKey(n);
    return MISSIONS.map((d, i) => ({ d, i })).filter(({ d, i }) => d.giver === key && i <= save.unlocked);
  };
  const isOfferNpc = (n) => missionsFor(n).length > 0;
  let offer = null;   // { idx, line, npc }
  function openOffer(line, npc) {
    const list = missionsFor(npc);
    if (!list.length) return;
    const firstNew = mode === 'story' ? list.find(({ d }) => !save.stars.includes(d.id)) || list[Math.floor(Math.random() * list.length)] : list.find(({ d }) => !save.stars.includes(d.id));
    offer = { idx: (firstNew || list[list.length - 1]).i, line, npc };
    renderOffer();
  }
  function renderOffer() {
    if (!offer) { panel.style.display = 'none'; return; }
    const d = MISSIONS[offer.idx], job = mode === 'story', done = !job && save.stars.includes(d.id), list = missionsFor(offer.npc);
    panel.innerHTML = '';
    const q = document.createElement('div'); q.className = 'mo-line'; q.textContent = `"${offer.line}"`; panel.appendChild(q);
    const tit = document.createElement('div'); tit.className = 'mo-title';
    tit.textContent = job ? `JOB: ${d.name}` : `#${offer.idx + 1} ${d.name}`; if (done) tit.appendChild(artCanvas('star', 2)); panel.appendChild(tit);
    const o = document.createElement('div'); o.className = 'mo-goal'; o.textContent = d.offer; panel.appendChild(o);
    const gl = document.createElement('div'); gl.className = 'mo-goal'; gl.textContent = 'GOAL: ' + d.goal; panel.appendChild(gl);
    const pay = job && hooks.jobPay?.(d); if (pay) { const pd = document.createElement('div'); pd.className = 'mo-goal mo-pay'; pd.textContent = 'PAYS ' + pay; panel.appendChild(pd); }
    const row = document.createElement('div'); row.className = 'mo-row';
    const btn = (label, fn, cls = '') => { const b = document.createElement('button'); b.className = 'mo-btn ' + cls; b.textContent = label; b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); fn(); }); row.appendChild(b); return b; };
    if (list.length > 1) btn('<', () => cycle(-1), 'mo-small');
    btn(job ? 'TAKE JOB [ENTER]' : done ? 'REPLAY [ENTER]' : 'ACCEPT [ENTER]', accept, 'mo-yes');
    btn('LATER [ESC]', later_);
    if (list.length > 1) btn('>', () => cycle(1), 'mo-small');
    panel.appendChild(row);
    panel.style.display = 'block';
  }
  function cycle(dir) { const list = missionsFor(offer.npc); const k = list.findIndex(({ i }) => i === offer.idx); offer.idx = list[(k + dir + list.length) % list.length].i; renderOffer(); }
  function accept() { if (!offer) return; const i = offer.idx; offer = null; renderOffer(); start(MISSIONS[i].id); }
  function later_() {
    if (!offer) return;
    const who = offer.npc; offer = null; renderOffer();
    if (who) dialogue.show(who, mode === 'story' ? JOB_LINES.later : GIVER_LINES.later, 1800);
  }

  function clickGiver(n) {
    if (!n || !isOfferNpc(n)) return;
    combat.audio?.unlock?.();
    if (n.mode) { dialogue.shout(n, 'not NOW!', 1200); return; }
    if (active) { dialogue.show(n, GIVER_LINES.busy, 2000); return; }
    const no = hooks.canOffer?.(n);   // story mode: a refusal line (e.g. two jobs a day) instead of an offer
    if (typeof no === 'string') { dialogue.clear(n); dialogue.show(n, no, 2600); getNPCs()?.talk(n, 2.6, player.position); return; }
    const mine = missionsFor(n);
    const myTurn = save.turnIn.filter((id) => mine.some(({ d }) => d.id === id));
    let line;
    if (mode === 'story') line = !save.met ? JOB_LINES.first : JOB_LINES.again[Math.floor(Math.random() * JOB_LINES.again.length)];
    else if (myTurn.length) {
      save.turnIn = save.turnIn.filter((id) => !myTurn.includes(id)); persist();
      const allDone = save.stars.length >= MISSIONS.length;
      line = allDone ? GIVER_LINES.menace : GIVER_LINES.turnIn;
      save.met = true; persist();
      dialogue.clear(n); getNPCs()?.talk(n, 2.4, player.position); dialogue.show(n, line, 2200); return;
    } else if (n.special === 'giver') {
      if (!save.met) line = GIVER_LINES.first;
      else if (save.stars.length >= MISSIONS.length) line = GIVER_LINES.menace;
      else line = GIVER_LINES.again[Math.floor(Math.random() * GIVER_LINES.again.length)];
    } else {
      // other free-roam givers: speak their job pitch in a comic bubble
      const pickM = mine.find(({ d }) => !save.stars.includes(d.id)) || mine[0];
      line = pickM?.d.offer || GIVER_LINES.again[0];
    }
    save.met = true; persist();
    dialogue.clear(n);
    getNPCs()?.talk(n, 4, player.position);
    dialogue.show(n, line, 2800);
    openOffer(line, n);
  }

  // ---- lifecycle ----
  function start(id) {
    const def = MISSIONS.find((d) => d.id === id); if (!def) return false;
    if (active) finish('abort');
    hideBanner(); lastFailed = null;
    active = { def, S: {} };
    def.start?.(active.S, g);
    g.toast('GO!');
    return true;
  }
  const hooks = { canOffer: null, onComplete: null };   // story.js
  function finish(result, line = '') {
    if (!active) return;
    const { def, S } = active; active = null;
    def.cleanup?.(S, g, result);
    if (result === 'complete') {
      const i = MISSIONS.indexOf(def);
      if (mode !== 'story' && !save.stars.includes(def.id)) { save.stars.push(def.id); save.turnIn.push(def.id); }
      save.unlocked = Math.max(save.unlocked, Math.min(MISSIONS.length - 1, i + 1));
      persist();
      showBanner(true, line); jingle(true);
      hooks.onComplete?.(def, banner);
    } else if (result === 'fail') {
      lastFailed = def; showBanner(false, line); jingle(false);
    }
  }
  function retry() { if (lastFailed) start(lastFailed.id); }

  function showBanner(ok, line) {
    banner.innerHTML = '';
    banner.className = ok ? 'ok' : 'bad';
    const h = document.createElement('div'); h.className = 'mb-head';
    const job = mode === 'story';
    h.append(job ? (ok ? 'JOB DONE ' : 'JOB FAILED') : ok ? 'MISSION COMPLETE ' : 'MISSION FAILED'); if (ok && !job) h.appendChild(artCanvas('star', 3));
    banner.appendChild(h);
    if (line) { const l = document.createElement('div'); l.className = 'mb-line'; l.textContent = line; banner.appendChild(l); }
    const s = document.createElement('div'); s.className = 'mb-sub';
    if (ok) {
      if (job) s.textContent = '';
      else if (save.stars.length >= MISSIONS.length) s.textContent = 'ALL STARS. NICE.';
      else {
        const tid = save.turnIn[save.turnIn.length - 1]; const td = MISSIONS.find((mm) => mm.id === tid);
        s.textContent = td ? ('TURN IN: ' + giverLabel(td.giver)) : 'TURN IN';
      }
    }
    else {
      const b = document.createElement('button'); b.className = 'mo-btn mo-yes'; b.textContent = 'RETRY [R]';
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); retry(); });
      s.appendChild(b);
    }
    banner.appendChild(s);
    banner.style.display = 'block';
    clearTimeout(bannerTimer); bannerTimer = setTimeout(hideBanner, ok ? 3200 : 7000);
  }
  function hideBanner() { banner.style.display = 'none'; clearTimeout(bannerTimer); }

  // ---- jingle (square-wave arpeggio; respects M mute) ----
  function jingle(ok) {
    const a = combat.audio; if (!a) return; a.unlock?.();
    if (a.muted || !a.ctx) return;
    const c = a.ctx, t0 = c.currentTime + 0.02;
    const notes = ok ? [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3], [784, 0.42], [1047, 0.5]] : [[392, 0], [330, 0.16], [262, 0.32], [196, 0.5]];
    for (const [f, dt] of notes) {
      const o = c.createOscillator(), gn = c.createGain();
      o.type = 'square'; o.frequency.value = f;
      const len = ok ? (dt >= 0.5 ? 0.35 : 0.1) : 0.16;
      gn.gain.setValueAtTime(0.0001, t0 + dt); gn.gain.exponentialRampToValueAtTime(0.07, t0 + dt + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + len);
      o.connect(gn).connect(c.destination); o.start(t0 + dt); o.stop(t0 + dt + len + 0.02);
    }
  }

  // ---- hooks into dialogue / npcs ----
  dialogue.preClick = (x, y) => !!(active && active.def.onPointer?.(active.S, x, y, g));
  dialogue.onClick = (n) => {
    if (n.special === 'giver') { clickGiver(n); return true; }
    return !!(active && active.def.onClick?.(active.S, n, g));
  };
  dialogue.pickLine = (n) => (active && active.def.pickLine ? active.def.pickLine(active.S, n, g) : null);
  dialogue.onLine = (n, line) => active?.def.onLine?.(active.S, n, line, g);
  let wired = null;
  function wire() {
    const npcs = getNPCs(); if (!npcs || wired === npcs) return;
    wired = npcs;
    npcs.on('slap', (n) => active?.def.onSlap?.(active.S, n, g));
    npcs.on('hitPlayer', (n) => active?.def.onHitPlayer?.(active.S, n, g));
    npcs.on('caught', (n) => active?.def.onCaught?.(active.S, n, g));
    npcs.on('playerTrip', (n) => active?.def.onTrip?.(active.S, n, g));
  }

  window.addEventListener('keydown', (e) => {
    if (offer && (e.code === 'Enter' || e.code === 'NumpadEnter')) { e.preventDefault(); accept(); }
    else if (offer && e.code === 'Escape') later_();
    else if (offer && e.code === 'Tab') { e.preventDefault(); cycle(e.shiftKey ? -1 : 1); }
    else if (e.code === 'KeyR' && lastFailed && !active) retry();
    else if (e.code === 'Escape' && banner.style.display === 'block') hideBanner();
  });

  // ---- per frame ----
  const v = new THREE.Vector3();
  const snap = (val) => { const s = pixel && pixel.enabled ? pixel.scale : 1; return Math.round(val / s) * s; };
  function project(p, dy = 0) { v.set(p.x, p.y + dy, p.z).project(camera); return { x: (v.x + 1) / 2 * canvas.clientWidth, y: (1 - v.y) / 2 * canvas.clientHeight, z: v.z }; }
  function renderHud() {
    const parts = [];
    if (mode === 'free') {   // the free-roam star tracker
      const stars = document.createElement('div'); stars.className = 'mh-stars';
      stars.appendChild(artCanvas(save.stars.length ? 'star' : 'starOff', 2)); stars.append(` ${save.stars.length}/${MISSIONS.length}`);
      parts.push(stars);
    }
    if (active) {
      const h = active.def.hud?.(active.S, g) || {};
      const t = document.createElement('div'); t.className = 'mh-title'; t.textContent = active.def.name; parts.push(t);
      const p = document.createElement('div'); p.className = 'mh-prog';
      p.textContent = h.progress || '';
      if (h.timer !== undefined) { const tm = document.createElement('span'); tm.className = h.timer < 10 ? 'mh-timer low' : 'mh-timer'; tm.textContent = ` ${Math.ceil(h.timer)}s`; p.appendChild(tm); }
      parts.push(p);
      for (const l of h.lines || []) { const d = document.createElement('div'); d.className = l.startsWith('-') ? 'mh-line off' : 'mh-line'; d.textContent = l; parts.push(d); }
    } else if (mode === 'free' && (save.stars.length < MISSIONS.length || save.turnIn.length)) {
      const d = document.createElement('div'); d.className = 'mh-line'; d.textContent = (() => {
        if (save.turnIn.length) {
          const td = MISSIONS.find((mm) => mm.id === save.turnIn[0]);
          return td ? ('TURN IN: ' + giverLabel(td.giver)) : 'TURN IN';
        }
        const next = MISSIONS.find((mm) => !save.stars.includes(mm.id));
        return next ? ('FIND ' + giverLabel(next.giver) + ' (!)') : 'FIND A GIVER (!)';
      })(); parts.push(d);
    }
    const key = parts.map((p) => p.textContent + p.className).join('|');
    if (key !== hud.dataset.key) { hud.replaceChildren(...parts); hud.dataset.key = key; }
    hud.style.display = parts.length ? '' : 'none';
  }
  function npcHasSpeech(npc) {
    try { return !!(dialogue.bubbles && dialogue.bubbles.has(npc)); } catch (_) { return false; }
  }
  function renderMarker() {
    // Soft-free only — do NOT display:none marks we are about to reuse (that restarts CSS anims).
    for (const m of markPool) m.free = true;
    if (!mode) { for (const m of markPool) m.el.style.display = 'none'; return; }
    // '?' on every NPC who currently has a mission to give (free-roam givers + story shady).
    const wantQ = [];
    for (const n of (getNPCs()?.list || [])) {
      if (!isOfferNpc(n) || !n.root) continue;
      if (offer && offer.npc === n) continue;          // talking to them — offer panel owns the moment
      if (npcHasSpeech(n)) continue;                   // don't sit on top of a comic bubble
      wantQ.push(n);
    }
    // '!' on the one NPC this active mission targets (if any). Cleared when the mission ends.
    let bangN = active ? (active.def.markNpc?.(active.S, g) || null) : null;
    if (bangN && (!bangN.root || npcHasSpeech(bangN) || (offer && offer.npc === bangN))) bangN = null;
    // Target '!' wins over giver '?' on the same head.
    const qList = bangN ? wantQ.filter((n) => n !== bangN) : wantQ;
    // Screen-pixel lift so the mark sits clearly ABOVE the hover name-tag (body+tail+gap),
    // and still reads above the head when the tag is hidden. Size is CSS px — never shrinks with distance.
    const MARK_LIFT = 52; // ~tag body (~22) + tail (~14) + gap (~8) + a little air
    for (const n of qList) {
      const m = acquireMark(); paintMark(m, 'q');
      const s = project(n.root.getWorldPosition(new THREE.Vector3()), 2.55);
      m.el.style.transform = `translate(${snap(s.x)}px, ${snap(s.y - MARK_LIFT)}px) translate(-50%, -100%)`;
    }
    if (bangN) {
      const m = acquireMark(); paintMark(m, 'bang');
      const s = project(bangN.root.getWorldPosition(new THREE.Vector3()), 2.55);
      m.el.style.transform = `translate(${snap(s.x)}px, ${snap(s.y - MARK_LIFT)}px) translate(-50%, -100%)`;
    }
    // Hide leftovers that were not reused this frame.
    for (const m of markPool) { if (m.free) m.el.style.display = 'none'; }
  }
  function idleArrowNpc() {
    // Prefer turn-in giver, else first giver with an open (unstarred) job, else any offer npc.
    if (save.turnIn.length) {
      const td = MISSIONS.find((mm) => mm.id === save.turnIn[0]);
      const gv = td ? findGiver(td.giver) : null;
      if (gv) return gv;
    }
    const next = MISSIONS.find((mm) => !save.stars.includes(mm.id) && findGiver(mm.giver));
    if (next) return findGiver(next.giver);
    return (getNPCs()?.list || []).find((n) => isOfferNpc(n)) || null;
  }
  const arrowCache = new Map();
  function renderArrow() {
    const bangN = active ? (active.def.markNpc?.(active.S, g) || null) : null;
    const tgt = active?.def.target?.(active.S, g)
      || (bangN && bangN.root.position)
      || (!active && mode ? idleArrowNpc()?.root.position : null);
    if (!tgt) { arrow.style.display = 'none'; return; }
    const s = project(tgt, 1.0), w = canvas.clientWidth, h = canvas.clientHeight, m = 40;
    if (s.x > m && s.x < w - m && s.y > m && s.y < h - m && s.z < 1) { arrow.style.display = 'none'; return; }
    const cx = w / 2, cy = h / 2; let dx = s.x - cx, dy = s.y - cy; if (s.z > 1) { dx = -dx; dy = -dy; }
    const k = Math.min((cx - m) / Math.abs(dx || 1e-6), (cy - m) / Math.abs(dy || 1e-6));
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 8)) % 16;
    if (!arrowCache.has(ang)) {   // per-pixel arrow, 16 directions
      const ctx = arrow.getContext('2d'), img = ctx.createImageData(11, 11), a = ang * Math.PI / 8;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
        const px = x - 5, py = y - 5, u = px * ca + py * sa, vv = -px * sa + py * ca;   // u along the arrow
        const inside = (lim) => u <= 4 + lim && u >= -4 - lim && (u > 0 ? Math.abs(vv) <= (4 - u) * 1.05 + lim : Math.abs(vv) <= 1.4 + lim && u > -4 - lim);
        const col = inside(0) ? [255, 204, 63] : inside(1.1) ? [41, 44, 46] : null;
        if (col) img.data.set([...col, 255], (y * 11 + x) * 4);
      }
      arrowCache.set(ang, img);
    }
    arrow.getContext('2d').putImageData(arrowCache.get(ang), 0, 0);
    arrow.style.display = 'block';
    arrow.style.transform = `translate(${snap(cx + dx * k - 16)}px, ${snap(cy + dy * k - 16)}px)`;
  }

  let last = performance.now();
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => {
    prev.apply(scene, a);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    wire();
    for (const t of timers) { t.t -= dt; if (t.t <= 0) { t.done = true; try { t.fn(); } catch (e) { console.error(e); } } }
    timers = timers.filter((t) => !t.done);
    if (active && getNPCs()) active.def.update?.(active.S, dt, g);
    if (zone.visible) { const s = zone.userData.r * (1 + 0.06 * Math.sin(now * 0.008)); zone.scale.setScalar(s); }
    renderHud(); renderMarker(); renderArrow();
  };

  const api = {
    hooks, list: MISSIONS, TUNING, toast: (t) => g.toast(t),
    get active() { return active && { id: active.def.id, S: active.S }; },
    get save() { return save; },
    get offer() { return offer; },
    start, retry, accept, later: later_, openOffer, clickGiver: (n) => { if (n) clickGiver(n); else { const gv = g.special('giver'); if (gv) clickGiver(gv); } },
    isOfferNpc, missionsFor, npcKey, findGiver,
    complete: (l = 'debug') => g.complete(l), fail: (l = 'debug') => g.fail(l), abort: () => finish('abort'),
    reset() { finish('abort'); save = mode === 'story' ? storyBlank() : (freeSave = blank()); if (mode !== 'story') try { localStorage.removeItem(SAVE_KEY); } catch {} offer = null; renderOffer(); hideBanner(); lastFailed = null; },
    unlockAll() { save.unlocked = MISSIONS.length - 1; persist(); },
    get mode() { return mode; },
    /** 'free' | 'story' | null. Story swaps in a blank paid-jobs record and never touches the free-roam save. */
    setMode(m) {
      if (m === mode) return;
      finish('abort'); offer = null; renderOffer(); hideBanner(); lastFailed = null; zone.visible = false;
      mode = m;
      save = m === 'story' ? storyBlank() : freeSave;
      hud.dataset.key = ''; releaseMarks();
    },
  };
  return api;
}
