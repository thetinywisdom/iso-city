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

// Heart pixel art (same glyph dialogue uses for ♥ icons).
const HEART = ['.XX...XX.', 'XPPX.XPPX', 'XPPPXPPPX', 'XPPPPPPPX', 'XPPPPPPPX', '.XPPPPPX.', '..XPPPX..', '...XPX...', '....X....'];
function heartCanvas() {
  const c = document.createElement('canvas'); c.width = HEART[0].length; c.height = HEART.length;
  const x = c.getContext('2d');
  HEART.forEach((row, y) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    x.fillStyle = ch === 'P' ? '#FF5491' : '#A92D59';
    x.fillRect(i, y, 1, 1);
  }));
  c.style.width = c.width * 3 + 'px'; c.style.height = c.height * 3 + 'px';
  return c;
}
/** Persistent comic speech bubble (white + black outline + tail) with the pink heart inside. */
function makeHeartBubble() {
  const el = document.createElement('div'); el.className = 'overhead-icon grandma-heart'; el.style.display = 'none';
  const bb = document.createElement('div'); bb.className = 'bb'; bb.appendChild(heartCanvas()); el.appendChild(bb);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'tail'); svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
  const fill = document.createElementNS('http://www.w3.org/2000/svg', 'polygon'); fill.setAttribute('class', 'tf');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); line.setAttribute('class', 'tl');
  svg.appendChild(fill); svg.appendChild(line); el.appendChild(svg);
  const layer = document.getElementById('bubbles') || document.body;
  layer.appendChild(el);
  return { el, bb, fill, line };
}

export function initGrandma({ scene, camera, renderer, player, getNPCs, dialogue, combat, police }) {
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
  // per frame: heart-in-bubble over her head, proximity auto-rescue, rush-and-slap walk
  let icon = null, iconC = null, last = performance.now();
  const _hp = new THREE.Vector3();
  const prevR = scene?.onBeforeRender;
  if (scene) scene.onBeforeRender = (...a) => {
    prevR?.apply(scene, a);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    const g = gran(); if (!g) return;
    if (!icon) icon = makeHeartBubble();
    // Hide while she has a speech/shout bubble, or she's down / off-camera.
    const speaking = !!(dialogue.bubbles && dialogue.bubbles.has(g));
    const trouble = inTrouble();
    let show = !g.down && !speaking && camera && renderer;
    if (show) {
      if (!state.iconH || iconC !== g.c) {
        iconC = g.c;
        const box = new THREE.Box3().setFromObject(g.c.root);
        state.iconH = Math.max(1.4, box.max.y - g.root.position.y) + 0.15;
      }
      g.root.getWorldPosition(_hp);
      _hp.y += state.iconH + (trouble ? 0.04 * Math.sin(now * 0.016) : 0.03 * Math.sin(now * 0.003));
      _hp.project(camera);
      const canvas = renderer.domElement;
      const sx = (_hp.x + 1) / 2 * canvas.clientWidth;
      const sy = (1 - _hp.y) / 2 * canvas.clientHeight;
      show = _hp.z < 1 && _hp.z > -1;
      if (show) {
        const w = icon.bb.offsetWidth || 43, h = icon.bb.offsetHeight || 37;
        const TAIL = 14;
        // Stack cleanly above the hover name-tag when it is also showing on grandma.
        let lift = 0;
        try { if (dialogue.hover === g) lift = 32; } catch (_) {}
        let x = Math.round(sx - w / 2), y = Math.round(sy - TAIL - h - lift);
        icon.el.style.display = '';
        icon.el.style.transform = `translate(${x}px, ${y}px)`;
        // Tail tip on the head, base under the bubble body (same geometry as dialogue bubbles).
        const tx = Math.round(sx) - x, ty = Math.round(sy) - y;
        const bx = Math.max(12, Math.min(w - 12, tx)), by = h - 3, half = 6;
        const on = ty > by + 4;
        icon.fill.setAttribute('points', on ? `${bx - half},${by} ${tx},${ty} ${bx + half},${by}` : '');
        icon.line.setAttribute('points', on ? `${bx - half},${by + 1} ${tx},${ty} ${bx + half},${by + 1}` : '');
        // Pulse scale while you're in trouble.
        const k = trouble ? 1 + 0.08 * Math.abs(Math.sin(now * 0.008)) : 1;
        icon.bb.style.transform = `scale(${k})`;
      }
    }
    if (!show) icon.el.style.display = 'none';
    state.iconPulse = trouble;
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
  return { state, rescue, get icon() { return icon?.el || null; }, get acting() { return !!act; }, gran, inTrouble, GRANDMA, get cooldownLeft() { return Math.max(0, state.cdUntil - performance.now() / 1000); } };
}
