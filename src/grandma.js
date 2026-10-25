// GRANDMA FUMIKO to the rescue: she sits by the plaza bench next to the spawn crossing. Talk to her (click) while
// Officer Dough or the bully is after you and she steps in: "OFFICER! LEAVE MY GRANDSON ALONE!", a handbag whack
// if he's close, and he slinks off apologising. The bully gets shooed too. Then she needs a rest (~60 s cooldown).
import * as THREE from 'three';
export const GRANDMA = { tag: 'GRANDMA FUMIKO', cooldown: 60, reach: 1.9, whackR: 4.2, stand: 3 };
const L = {
  copSorry: ['S-SORRY MA\'AM!', 'YES MA\'AM. SORRY MA\'AM.', 'OW! OKAY, OKAY! I\'M GOING!'],
  bully: ['ugh, FINE, granny.', 'okay okay, not the purse!', 'you got lucky, n**d.'],
  tired: ['grandma\'s tired, dear.', 'grandma\'s tired, dear. run!', 'give grandma a minute, dear.'],
  after: ['and eat something!', 'such a nice boy. mostly.', 'hmph. police these days.'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function initGrandma({ player, getNPCs, dialogue, combat, police }) {
  const state = { rescues: 0, tiredSays: 0, cdUntil: 0, shooed: 0, whacks: 0 };
  const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const gran = () => getNPCs()?.list.find((n) => n.tag === GRANDMA.tag) || null;
  const bully = () => getNPCs()?.list.find((n) => n.special === 'bully') || null;
  const kid = () => { const d = player.model?.userData?.character?.def; return d && d.gender === 'woman' ? 'GRANDDAUGHTER' : 'GRANDSON'; };
  const copOn = () => police.state.mode === 'chase';
  const bullyOn = () => { const b = bully(); return !!(b && !b.down && b.chaseCfg && (b.mode === 'chase' || b.mode === 'react')); };
  const inTrouble = () => copOn() || bullyOn();

  function face(n, p) { n.targetHeading = Math.atan2(p.x - n.root.position.x, p.z - n.root.position.z); }
  function whack(g, n) {   // handbag swing + a little knock-back on n
    face(g, n.root.position); g.c.slap?.();
    setTimeout(() => {
      const gp = g.root.position, p = n.root.position, dx = p.x - gp.x, dz = p.z - gp.z, d = Math.hypot(dx, dz) || 1;
      combat.burstAt?.(new THREE.Vector3(p.x, p.y + 1.5, p.z), 'WHACK!'); combat.audio?.thud?.(); combat.shakeIt?.(0.08);
      n.stagger = { x: dx / d, z: dz / d, t: 0.25 }; state.whacks++;
    }, 260);
  }
  function rescue(g) {
    if (!inTrouble()) return false;
    const now = performance.now() / 1000;
    if (now < state.cdUntil) { state.tiredSays++; dialogue.shout(g, pick(L.tired), 1800); return true; }
    state.rescues++; state.cdUntil = now + GRANDMA.cooldown;
    const N = getNPCs();
    g.c.stopDance?.(0.1); N.talk?.(g, 2.5, player.position);
    let target = null;
    if (copOn() && police.cop) {
      const cop = police.cop;
      dialogue.shout(g, `OFFICER! LEAVE MY ${kid()} ALONE!`, 2400);
      police.callOff(null, GRANDMA.stand);
      face(cop, g.root.position);
      if (flat(cop.root.position, g.root.position) < GRANDMA.whackR) whack(g, cop);
      setTimeout(() => dialogue.shout(cop, pick(L.copSorry), 2000), 900);
      target = cop;
    }
    const b = bully();
    if (bullyOn()) {
      if (!target) dialogue.shout(g, 'SHOO! LEAVE MY ' + kid() + ' ALONE, YOU BIG LUMP!', 2400);
      N.calm(b, GRANDMA.stand); face(b, g.root.position); state.shooed++;
      if (!target && flat(b.root.position, g.root.position) < GRANDMA.whackR) whack(g, b);
      setTimeout(() => dialogue.shout(b, pick(L.bully), 1800), target ? 1500 : 900);
    }
    setTimeout(() => { if (!inTrouble()) dialogue.show?.(g, pick(L.after), 2000); }, 3400);
    return true;
  }
  // talking to her while chased: run to her, then she steps in
  const prevClick = dialogue.onClick;
  dialogue.onClick = (n) => {
    if (n && n.tag === GRANDMA.tag && inTrouble() && !n.down) {
      if (flat(n.root.position, player.position) <= GRANDMA.reach + 0.3) rescue(n);
      else combat.approach(n, GRANDMA.reach, () => { if (!rescue(n)) dialogue.show?.(n, 'all clear, dear.', 1600); });
      return true;
    }
    return !!prevClick?.(n);
  };
  return { state, rescue, gran, inTrouble, GRANDMA, get cooldownLeft() { return Math.max(0, state.cdUntil - performance.now() / 1000); } };
}
