import { registerPools } from './french.js?v=20261031ab';
// OFFICER DOUGH: patrols the streets. Slap / push / fart on / trip someone where he can see it (or where a
// witness yells for him) and he chases you, WEE-OO. Break line of sight or get far away for a few seconds
// and he gives up. If he catches you: GAME OVER, "START AGAIN?" reloads the scene (saved missions are kept).
// tuned to be beatable: a sprint (7) outruns him, he loses you after 2.5 s out of sight; hiding in a bin (hiding.js) makes him search
const TUNE = { seeR: 14, hearR: 26, witnessR: 6, keepR: 16, loseAfter: 2.5, speed: 5.6, accel: 5.5, searchFor: 4.5, searchR: 2.6, watchR: 9 };
const L = {
  saw: ['HEY! I SAW THAT!', 'FREEZE, PUNK!', 'THAT\'S A CRIME!', 'OH NO YOU DIDN\'T!'],
  witness: ['POLICE!!', 'OFFICER! THAT ONE!', 'COPS! COPS!', 'HE DID IT!'],
  coming: ['ON MY WAY! WEE-OO!', 'I\'M COMIN\'!', 'HOLD IT RIGHT THERE!'],
  poked: { slap: 'THAT\'S ASSAULTING AN OFFICER!', push: 'HANDS OFF THE BADGE!', trip: 'NICE TRY, PUNK!', stink: 'DID YOU JUST... GROSS! YOU\'RE NICKED!' },
  chase: ['WEE-OO WEE-OO! STOP!', 'STOP RIGHT THERE!', 'HALT! IN THE NAME OF DONUTS!', 'WEE-OO! WEE-OO!'],
  giveUp: ['ugh... my donut\'s getting cold.', 'i\'ll get you next time...', '*wheeze* forget it.'],
  caught: ['GOTCHA! YOU\'RE NICKED!', 'BUSTED, PUNK!'],
  lost: ['WHERE\'D HE GO?!', 'WHERE\'D HE GO?!', 'HUH?! WHERE\'D HE GO?!'],
  searching: ['come out, come out...', 'i KNOW you\'re here...', 'sniff sniff... smells like crime.'],
  giveUpHid: ['must\'ve been the wind...', 'ugh. lost him. donut time.', 'he\'s... gone? WEIRD.'],
};
registerPools({ witness: L.witness });
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function initPolice({ scene, city, player, getNPCs, dialogue, combat, actions }) {
  const hooks = { onOver: null, onRestart: null };   // story.js: reword the overlay / skip to the next morning
  const state = { mode: 'idle', offences: 0, reports: 0, chases: 0, escapes: 0, caught: 0, lostT: 0, last: null };
  let cop = null, wired = null, last = performance.now(), pendT = -1, lastSeen = null, searchT = 0, hidFn = () => false;
  const tall = () => city.colliders.filter((c) => c.top == null);
  // 2D line of sight: blocked by tall colliders (buildings), not by fences or bushes
  function los(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    for (const c of tall()) {
      let t0 = 0, t1 = 1;
      for (const [o, d, lo, hi] of [[a.x, dx, c.minX, c.maxX], [a.z, dz, c.minZ, c.maxZ]]) {
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { t0 = 2; break; } continue; }
        let u = (lo - o) / d, v = (hi - o) / d; if (u > v) [u, v] = [v, u];
        t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) break;
      }
      if (t0 <= t1 && t0 < 1 && t1 > 0) return false;
    }
    return true;
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  // ---- HUD ----
  const wanted = document.createElement('div'); wanted.id = 'wanted'; wanted.innerHTML = '<span>WEE-OO</span> WANTED!';
  const over = document.createElement('div'); over.id = 'game-over';
  over.innerHTML = '<div class="go-box"><div class="go-title">GAME OVER</div><div class="go-sub">BUSTED BY OFFICER DOUGH</div><button class="mo-btn mo-yes go-btn">START AGAIN?</button></div>';
  document.body.append(wanted, over);
  const btn = over.querySelector('.go-btn');
  btn.addEventListener('click', (e) => { e.stopPropagation(); restart(); });
  over.addEventListener('pointerdown', (e) => e.stopPropagation());
  window.addEventListener('keydown', (e) => { if (state.mode === 'over' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); restart(); } }, true);

  function restart() {   // fresh scene: player at spawn, everyone reset; saved mission progress stays (localStorage)
    if (state.mode === 'over' && hooks.onRestart?.()) {   // story mode: a night in the cell, then the next morning (no reload)
      state.mode = 'idle'; over.classList.remove('on'); combat.hold(0);
      if (cop) { const n = getNPCs(); n?.calm?.(cop, 0.3); n?.goHome?.(cop); }
      return;
    }
    state.restarting = true;
    const u = new URL(location.href); u.searchParams.delete('reset');
    location.replace(u.toString());
  }

  function startChase(line) {
    if (!cop || cop.down || state.mode === 'over') return;
    const npcs = getNPCs();
    if (line) dialogue.shout(cop, line, 1600);
    npcs.forceChase(cop, { catch: true, speed: TUNE.speed, accel: TUNE.accel, noGiveUp: true, react: 0.45, chase: pick(L.chase) });
    if (state.mode !== 'chase') { state.chases++; lastSeen = { x: player.position.x, y: 0, z: player.position.z }; }
    state.mode = 'chase'; state.lostT = 0; state.searching = false; wanted.classList.add('on');
  }
  function giveUp(line) {
    const hid = state.searching;
    state.mode = 'idle'; state.escapes++; state.lostT = 0; state.searching = false; wanted.classList.remove('on', 'losing');
    if (cop) { if (cop.chaseCfg) cop.chaseCfg.target = null; dialogue.shout(cop, line || pick(hid ? L.giveUpHid : L.giveUp), 2000); getNPCs().calm(cop, 1.2); }
  }
  // someone (grandma) talks him out of it: chase over, he stands there sheepish for `stand` seconds
  function callOff(line, stand = 2.5) {
    if (state.mode !== 'chase') return false;
    state.mode = 'idle'; state.calledOff = (state.calledOff || 0) + 1; state.lostT = 0; state.searching = false; wanted.classList.remove('on', 'losing');
    if (cop) { if (cop.chaseCfg) cop.chaseCfg.target = null; if (line) dialogue.shout(cop, line, 2200); getNPCs().calm(cop, stand); }
    return true;
  }
  function offence(victim, kind) {
    if (!cop || state.mode === 'over' || state.restarting) return;
    state.offences++; state.last = kind;
    if (victim === cop) { startChase(L.poked[kind] || L.poked.slap); return; }
    if (state.mode === 'chase') { state.lostT = 0; return; }
    const cp = cop.root.position, pp = player.position;
    if (!cop.down && dist(cp, pp) < TUNE.seeR && los(cp, pp)) { startChase(pick(L.saw)); return; }
    // nobody official saw it: someone nearby yells for him
    const npcs = getNPCs(), vp = victim.root.position;
    let w = !victim.down && !victim.fly ? victim : null;
    if (!w) {
      let bd = TUNE.witnessR;
      for (const o of npcs.list) { if (o === victim || o === cop || o.down) continue; const d = dist(o.root.position, vp); if (d < bd) { bd = d; w = o; } }
    }
    if (!w) return;
    state.reports++;
    setTimeout(() => dialogue.shout(w, pick(L.witness), 1500), 250);
    if (dist(cp, pp) < TUNE.hearR) { pendT = 0.9; }
  }
  function gameOver() {
    if (state.mode === 'over') return;
    state.mode = 'over'; state.caught++; wanted.classList.remove('on');
    const npcs = getNPCs();
    dialogue.shout(cop, pick(L.caught), 3000);
    npcs.calm(cop, 999); cop.targetHeading = Math.atan2(player.position.x - cop.root.position.x, player.position.z - cop.root.position.z);
    actions?.closeMenu?.();
    combat.hold(1e6, cop.root.position);
    combat.audio?.thud?.(); combat.shakeIt?.(0.3);
    hooks.onOver?.(over);
    setTimeout(() => { over.classList.add('on'); btn.focus(); }, 700);
  }

  function wire(npcs) {
    if (wired === npcs) return; wired = npcs;
    cop = npcs.list.find((n) => n.special === 'cop') || null;
    for (const ev of ['slap', 'trip', 'push', 'stink']) npcs.on(ev, (n) => offence(n, ev));
    npcs.on('copPoked', (n, kind) => offence(n, kind));
    npcs.on('caught', (n) => { if (n === cop && state.mode === 'chase') gameOver(); });
  }

  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => {
    prev.apply(scene, a);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    const npcs = getNPCs(); if (!npcs || !npcs.list.length) return;
    wire(npcs); if (!cop) return;
    if (pendT > 0 && (pendT -= dt) <= 0) { pendT = -1; if (state.mode === 'idle') startChase(pick(L.coming)); }
    if (state.mode !== 'chase') return;
    if (!cop.down && !cop.stagger && cop.mode !== 'chase' && cop.mode !== 'react') {
      const wasS = state.searching, lt = state.lostT; startChase(null);
      if (wasS && cop.chaseCfg) { state.searching = true; state.lostT = lt; cop.chaseCfg.target = { ...lastSeen }; }
      return;
    }   // knocked out of it: back at it
    const cp = cop.root.position, pp = player.position, d = dist(cp, pp);
    const hidden = hidFn();
    const sees = !hidden && d < TUNE.keepR && los(cp, pp);
    if (sees || !lastSeen) lastSeen = { x: pp.x, y: pp.y, z: pp.z };
    if (hidden) {   // in a bin: he runs to where he last saw you and pokes around, then gives up
      const cc = cop.chaseCfg;
      if (!state.searching) { state.searching = true; state.searches = (state.searches || 0) + 1; searchT = 0; state.lostT = Math.max(state.lostT, 0.01); if (cc) cc.target = { ...lastSeen }; dialogue.shout(cop, pick(L.lost), 1800); }
      searchT += dt;
      if (cc && cc.target && !cop.down && Math.hypot(cc.target.x - cp.x, cc.target.z - cp.z) < 1.0) {   // got there: try another spot nearby
        const a = Math.random() * Math.PI * 2, r = TUNE.searchR * (0.5 + Math.random() * 0.5);
        cc.target = { x: lastSeen.x + Math.cos(a) * r, y: 0, z: lastSeen.z + Math.sin(a) * r };
        if (Math.random() < 0.35) dialogue.shout(cop, pick(L.searching), 1500);
      }
      state.lostT += dt * (cop.down ? 0.6 : 1);
      wanted.classList.add('losing');
      if (state.lostT >= TUNE.searchFor) giveUp();
      return;
    }
    if (state.searching) { state.searching = false; if (cop.chaseCfg) cop.chaseCfg.target = null; }   // popped out: back on you
    state.lostT = cop.down ? state.lostT + dt * 0.6 : sees ? 0 : state.lostT + dt;   // flat on his back (banana!) you get a head start
    wanted.classList.toggle('losing', state.lostT > 0);
    if (state.lostT >= TUNE.loseAfter) giveUp();
  };
  // can the cop see the player right now (close and in line of sight)? hiding.js asks this when you hop in a bin
  const watching = (r = TUNE.watchR) => !!cop && !cop.down && state.mode === 'chase' && dist(cop.root.position, player.position) < r && los(cop.root.position, player.position);
  return { state, hooks, offence, startChase, giveUp, callOff, gameOver, restart, los, watching, setHiddenFn(f) { hidFn = f; }, get cop() { return cop; }, TUNE, el: { wanted, over } };
}
