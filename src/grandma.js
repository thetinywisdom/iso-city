// GRANDMA FUMIKO to the rescue: she waits by the plaza bench next to the spawn crossing, a little pink heart over
// her head (it pulses while you're in trouble). Run past her (within ~3.5 u) while Officer Dough or the bully is after
// you and she steps in on her own: she marches up, slaps him ("GO AWAY, YOU BIG DONUT!"), he staggers, apologises and
// gives up. Clicking her still works. Then she needs a rest (~60 s cooldown: "grandma's tired, dear").
import * as THREE from 'three';
export const GRANDMA = { tag: 'GRANDMA FUMIKO', cooldown: 60, reach: 1.9, whackR: 4.2, stand: 3, autoR: 3.5, slapR: 1.05, rushMax: 4 };
const L = {
  copGo: ['GO AWAY, YOU BIG DONUT!', 'SHOO, DONUT BOY!', 'OFF YOU POP, OFFICER DONUT!'],
  copSorry: ['S-SORRY MA\'AM!', 'YES MA\'AM. SORRY MA\'AM.', 'OW! OKAY, OKAY! I\'M GOING!'],
  bully: ['ugh, FINE, granny.', 'okay okay, not the purse!', 'you got lucky, n**d.'],
  tired: ['grandma\'s tired, dear.', 'grandma\'s tired, dear. run!', 'grandma\'s tired, dear. give me a minute.'],
  after: ['and eat something!', 'such a nice boy. mostly.', 'hmph. police these days.'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// tiny pixel heart (Comic pinks), 7x6 art pixels
const HEART = ['.11.11.', '1221111', '1211111', '.11111.', '..111..', '...0...'];
function heartSprite() {
  const c = document.createElement('canvas'); c.width = 7; c.height = 6; const x = c.getContext('2d');
  const col = { 0: '#A92D59', 1: '#FF5491', 2: '#F9F0F1' };
  HEART.forEach((row, y) => [...row].forEach((ch, i) => { if (col[ch]) { x.fillStyle = col[ch]; x.fillRect(i, y, 1, 1); } }));
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
  s.scale.set(0.46, 0.4, 1); s.renderOrder = 998; s.name = 'grandmaIcon'; return s;   // drawn on top so you can spot her behind buildings
}

export function initGrandma({ scene, player, getNPCs, dialogue, combat, police }) {
  const state = { rescues: 0, tiredSays: 0, cdUntil: 0, shooed: 0, whacks: 0, autos: 0, tiredUntil: 0 };
  let act = null;   // { g, target, t, onHit } while she walks up to slap someone
  const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const gran = () => getNPCs()?.list.find((n) => (n.cityKey ? n.cityKey === 'grandma-fumiko' : n.tag === GRANDMA.tag)) || null;
  const bully = () => getNPCs()?.list.find((n) => n.special === 'bully') || null;
  const kid = () => { const d = player.model?.userData?.character?.def; return d && d.gender === 'woman' ? 'GRANDDAUGHTER' : 'GRANDSON'; };
  const copOn = () => police.state.mode === 'chase';
  const bullyOn = () => { const b = bully(); return !!(b && !b.down && b.chaseCfg && (b.mode === 'chase' || b.mode === 'react')); };
  const inTrouble = () => copOn() || bullyOn();

  function face(n, p) { n.targetHeading = Math.atan2(p.x - n.root.position.x, p.z - n.root.position.z); }
  function whack(g, n) {   // slap swing + a knock-back stagger on n
    face(g, n.root.position); g.c.slap?.();
    setTimeout(() => {
      const gp = g.root.position, p = n.root.position, dx = p.x - gp.x, dz = p.z - gp.z, d = Math.hypot(dx, dz) || 1;
      combat.burstAt?.(new THREE.Vector3(p.x, p.y + 1.5, p.z), 'WHACK!'); combat.audio?.smack?.(); combat.audio?.thud?.(); combat.shakeIt?.(0.1);
      n.stagger = { x: dx / d, z: dz / d, t: 0.28 }; n.mode = 'return'; n.modeT = GRANDMA.stand; n.target = getNPCs()._nearestWaypoint(n); state.whacks++;
    }, 220);
  }
  // she walks up to whoever's chasing you and slaps them, then toddles back home
  function rush(g, target, onHit) { act = { g, target, t: 0, onHit }; g.c.stopDance?.(0.1); g.mode = null; g.stagger = null; }
  function goHome(g) { const N = getNPCs(); g.talkT = 0; g.mode = 'return'; g.modeT = 1.6; g.target = N._nearestWaypoint(g); }
  function rescue(g, auto = false) {
    if (!inTrouble()) return false;
    const now = performance.now() / 1000;
    if (now < state.cdUntil) { if (now > state.tiredUntil) { state.tiredSays++; state.tiredUntil = now + 4; dialogue.shout(g, pick(L.tired), 1800); } return true; }
    if (auto) state.autos++;
    state.rescues++; state.cdUntil = now + GRANDMA.cooldown;
    const N = getNPCs();
    g.c.stopDance?.(0.1); N.talk?.(g, 2.5, player.position);
    let target = null;
    if (copOn() && police.cop) {
      const cop = police.cop;
      dialogue.shout(g, `OFFICER! LEAVE MY ${kid()} ALONE!`, 1800);
      police.callOff(null, GRANDMA.stand + 2);
      face(cop, g.root.position);
      rush(g, cop, () => { dialogue.shout(g, pick(L.copGo), 2200); whack(g, cop); setTimeout(() => dialogue.shout(cop, pick(L.copSorry), 2000), 900); });
      target = cop;
    }
    const b = bully();
    if (bullyOn()) {
      if (!target) dialogue.shout(g, 'SHOO! LEAVE MY ' + kid() + ' ALONE, YOU BIG LUMP!', 2400);
      N.calm(b, GRANDMA.stand + 2); if (b.mode !== 'return') { b.mode = 'return'; b.modeT = GRANDMA.stand + 2; b.target = N._nearestWaypoint(b); }
      face(b, g.root.position); state.shooed++;
      if (!target) rush(g, b, () => { whack(g, b); setTimeout(() => dialogue.shout(b, pick(L.bully), 1800), 900); });
      else setTimeout(() => dialogue.shout(b, pick(L.bully), 1800), 1500);
    }
    setTimeout(() => { if (!inTrouble()) dialogue.show?.(g, pick(L.after), 2000); }, 4200);
    return true;
  }
  // talking to her while chased: run to her, then she steps in
  const prevClick = dialogue.onClick;
  dialogue.onClick = (n) => {
    if (n && (n.cityKey ? n.cityKey === 'grandma-fumiko' : n.tag === GRANDMA.tag) && inTrouble() && !n.down) {
      if (flat(n.root.position, player.position) <= GRANDMA.reach + 0.3) rescue(n);
      else combat.approach(n, GRANDMA.reach, () => { if (!rescue(n)) dialogue.show?.(n, 'all clear, dear.', 1600); });
      return true;
    }
    return !!prevClick?.(n);
  };
  // per frame: the heart icon, the proximity auto-rescue and her rush-and-slap walk
  let icon = null, iconOn = null, iconC = null, last = performance.now();
  const prevR = scene?.onBeforeRender;
  if (scene) scene.onBeforeRender = (...a) => {
    prevR?.apply(scene, a);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    const g = gran(); if (!g) return;
    if (!icon) icon = heartSprite();
    if (iconOn !== g.root) { g.root.add(icon); iconOn = g.root; state.iconH = 0; }
    if (!state.iconH || iconC !== g.c) { iconC = g.c; const bb = new THREE.Box3().setFromObject(g.c.root); state.iconH = Math.max(1.4, bb.max.y - g.root.position.y) + 0.42; }
    const trouble = inTrouble();
    const k = trouble ? 1 + 0.35 * Math.abs(Math.sin(now * 0.008)) : 1;
    icon.scale.set(0.46 * k, 0.4 * k, 1); icon.position.set(0, state.iconH + (trouble ? 0.04 * Math.sin(now * 0.016) : 0.03 * Math.sin(now * 0.003)), 0);
    icon.visible = !g.down; state.iconPulse = trouble;
    // auto: you ran into her range while chased
    if (!act && trouble && !g.down && flat(g.root.position, player.position) < GRANDMA.autoR) rescue(g, true);
    const A = act;
    if (A) {
      A.t += dt;
      const gp = g.root.position, tp = A.target.root.position, dx = tp.x - gp.x, dz = tp.z - gp.z, d = Math.hypot(dx, dz);
      if (d <= GRANDMA.slapR + 0.05 || A.t > GRANDMA.rushMax || A.target.down) {
        act = null; g.mode = null; g.talkT = 0.8; g.talkTo = tp; face(g, tp);
        if (!A.target.down) A.onHit(); setTimeout(() => goHome(g), 900);
      } else {   // walk (npcs.js 'return' mode = real walk cycle) to a point just short of him
        g.mode = 'return'; g.modeT = 0; g.returnT = 0; g.stagger = null;
        g.target = { i: -1, x: tp.x - dx / d * GRANDMA.slapR * 0.9, z: tp.z - dz / d * GRANDMA.slapR * 0.9 };
      }
    }
  };
  return { state, rescue, get icon() { return icon; }, get acting() { return !!act; }, gran, inTrouble, GRANDMA, get cooldownLeft() { return Math.max(0, state.cdUntil - performance.now() / 1000); } };
}
