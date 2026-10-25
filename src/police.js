// OFFICER DOUGH: patrols the streets. Slap / push / fart on / trip someone where he can see it (or where a
// witness yells for him) and he chases you, WEE-OO. Break line of sight or get far away for a few seconds
// and he gives up. If he catches you: GAME OVER, "START AGAIN?" reloads the scene (saved missions are kept).
const TUNE = { seeR: 14, hearR: 26, witnessR: 6, keepR: 19, loseAfter: 3, speed: 6.0, accel: 6 };
const L = {
  saw: ['HEY! I SAW THAT!', 'FREEZE, PUNK!', 'THAT\'S A CRIME!', 'OH NO YOU DIDN\'T!'],
  witness: ['POLICE!!', 'OFFICER! THAT ONE!', 'COPS! COPS!', 'HE DID IT!'],
  coming: ['ON MY WAY! WEE-OO!', 'I\'M COMIN\'!', 'HOLD IT RIGHT THERE!'],
  poked: { slap: 'THAT\'S ASSAULTING AN OFFICER!', push: 'HANDS OFF THE BADGE!', trip: 'NICE TRY, PUNK!', stink: 'DID YOU JUST... GROSS! YOU\'RE NICKED!' },
  chase: ['WEE-OO WEE-OO! STOP!', 'STOP RIGHT THERE!', 'HALT! IN THE NAME OF DONUTS!', 'WEE-OO! WEE-OO!'],
  giveUp: ['ugh... my donut\'s getting cold.', 'i\'ll get you next time...', '*wheeze* forget it.'],
  caught: ['GOTCHA! YOU\'RE NICKED!', 'BUSTED, PUNK!'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function initPolice({ scene, city, player, getNPCs, dialogue, combat, actions }) {
  const state = { mode: 'idle', offences: 0, reports: 0, chases: 0, escapes: 0, caught: 0, lostT: 0, last: null };
  let cop = null, wired = null, last = performance.now(), pendT = -1;
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
    state.restarting = true;
    const u = new URL(location.href); u.searchParams.delete('reset');
    location.replace(u.toString());
  }

  function startChase(line) {
    if (!cop || cop.down || state.mode === 'over') return;
    const npcs = getNPCs();
    if (line) dialogue.shout(cop, line, 1600);
    npcs.forceChase(cop, { catch: true, speed: TUNE.speed, accel: TUNE.accel, noGiveUp: true, react: 0.45, chase: pick(L.chase) });
    if (state.mode !== 'chase') state.chases++;
    state.mode = 'chase'; state.lostT = 0; wanted.classList.add('on');
  }
  function giveUp() {
    state.mode = 'idle'; state.escapes++; state.lostT = 0; wanted.classList.remove('on');
    if (cop && !cop.down) { dialogue.shout(cop, pick(L.giveUp), 2000); getNPCs().calm(cop, 1.2); }
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
    if (cop.down || cop.stagger) return;
    if (cop.mode !== 'chase' && cop.mode !== 'react') { startChase(null); return; }   // knocked out of it: back at it
    const cp = cop.root.position, pp = player.position, d = dist(cp, pp);
    const sees = d < TUNE.keepR && los(cp, pp);
    state.lostT = sees ? 0 : state.lostT + dt;
    wanted.classList.toggle('losing', state.lostT > 0);
    if (state.lostT >= TUNE.loseAfter) giveUp();
  };
  return { state, offence, startChase, giveUp, gameOver, restart, los, get cop() { return cop; }, TUNE, el: { wanted, over } };
}
