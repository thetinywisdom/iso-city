import * as THREE from 'three';
import { isFrench, frLine } from './french.js?v=20261031i';

// Click an NPC -> pixel-art chat bubble with a random line above their head.
// The listener runs in the capture phase on window, so a click that hits an NPC
// is consumed before main.js's click-to-move handler on the canvas sees it.
export const LINES = ['hi', 'hello', 'who are you?', 'excuse me?', 'not interested', 'f**k off',
  'go away', 'yes?', '?', 'free Palestine'];
const SHOW_MS = 2500;
export const LONG_PRESS_MS = 400;
export const DBL_MS = 250;            // a second click inside this turns a talk into a push
const TALK_R = 6, TALK_REACH = 3;   // talk from up to TALK_R away; further = walk up to TALK_REACH first
const RING_N = 15;

export function initDialogue({ scene, camera, renderer, getNPCs, player, pixel }) {
  const canvas = renderer.domElement;
  const layer = document.createElement('div');
  layer.id = 'bubbles';
  document.body.appendChild(layer);
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const bubbles = new Map(); // npc -> { el, until }
  const hints = new Map();   // npc -> { el, bb, fill, line, kind }  comic ! / ? above talkable heads
  const HINT_R = 11;         // world units: only near the player (avoids crowd clutter)
  const HINT_MAX = 6;        // cap on simultaneous icons
  const head = new THREE.Vector3();

  function pick(clientX, clientY) {
    const npcs = getNPCs(); if (!npcs) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(npcs.hitboxes, false);
    return hits.length ? hits[0].object.userData.npc : null;
  }

  function say(npc) {
    if (api.onClick?.(npc)) return;          // missions can take over a click (giver, quest NPCs)
    if (npc.special && npc.danceName) {                      // easter-egg NPCs dance instead of talking
      if (npc.c.dancing || npc.mode) return;   // clicks mid-dance (or while scared) do nothing
      const secs = getNPCs().dance(npc, player.position);
      if (secs > 0 && isFrench(npc)) {   // a cheeky french quip first, then the dance icon
        show(npc, frLine(null, Math.random() < 0.5 ? 'talk' : 'dance'), 1800, false); place();
        setTimeout(() => { if (npc.c.dancing && !npc.mode) { showIcon(npc, npc.icon, secs * 1000 - 2100); place(); } }, 1800);
      } else if (secs > 0) { showIcon(npc, npc.icon, secs * 1000 - 300); place(); }
      return;
    }
    let line = api.pickLine?.(npc) || null;   // missions may bias the line
    const pool = npc.lines && Math.random() < 0.65 ? npc.lines : LINES;   // named people have their own lines
    if (!line) do line = pool[Math.floor(Math.random() * pool.length)]; while (line === npc.lastLine && pool.length > 1);
    npc.lastLine = line;
    show(npc, line, SHOW_MS, false);
    getNPCs().talk(npc, SHOW_MS / 1000, player.position);
    place();
    api.onLine?.(npc, line);
  }
  // Shout: bigger, red-bordered, shaking bubble. Does not stop the NPC.
  function shout(npc, text, ms = 1900) { show(npc, text, ms, true); place(); }
  // Every bubble is the same comic bubble: a rounded body (.bb) + an SVG tail whose tip sits on the
  // speaker's head. place() lays them all out each frame (clamped to the screen, stacked so they don't overlap).
  const SVGNS = 'http://www.w3.org/2000/svg';
  function makeBubble(cls) {
    const el = document.createElement('div'); el.className = 'bubble' + (cls ? ' ' + cls : '');
    const bb = document.createElement('div'); bb.className = 'bb'; el.appendChild(bb);
    const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('class', 'tail'); svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
    const fill = document.createElementNS(SVGNS, 'polygon'); fill.setAttribute('class', 'tf');
    const line = document.createElementNS(SVGNS, 'polyline'); line.setAttribute('class', 'tl');
    svg.append(fill, line); el.appendChild(svg);
    layer.appendChild(el);
    return { el, bb, fill, line };
  }
  function whoLine(npc, text) { const w = document.createElement('div'); w.className = 'who'; w.textContent = text; return w; }
  function show(npc, line, ms, isShout, opt = {}) {
    let b = bubbles.get(npc);
    if (b) b.el.remove();
    const B = makeBubble(isShout ? 'shout' : '');
    const tag = opt.tag !== undefined ? opt.tag : (!opt.chat && npc.tag ? npc.tag : '');
    if (tag || opt.step) { const w = whoLine(npc, tag || ''); if (opt.step) { const s = document.createElement('i'); s.className = 'step'; s.textContent = opt.step; w.appendChild(s); } B.bb.appendChild(w); }
    const span = document.createElement('span'); span.className = 'txt';
    if (isFrench(npc) && !opt.story) {   // Mbappé: french line + a small english translation underneath
      const [fr, en] = Array.isArray(line) ? line : frLine(line);
      span.append(fr); const sub = document.createElement('small'); sub.className = 'en'; sub.textContent = '(' + en + ')'; span.append(sub);
      B.el.classList.add('fr');
    } else span.textContent = line;
    B.bb.appendChild(span);
    if (opt.cap) { const c = document.createElement('div'); c.className = 'cap'; c.textContent = opt.cap; B.bb.appendChild(c); }
    if (opt.hint) { const h = document.createElement('div'); h.className = 'hint'; h.textContent = opt.hint; B.bb.appendChild(h); }
    if (opt.story) B.el.classList.add('story');
    b = { ...B, until: performance.now() + ms, shout: isShout, story: !!opt.story, chat: !!opt.chat, prio: opt.story ? 4 : isShout ? 3 : 2 };
    bubbles.set(npc, b);
    if (!isShout && !opt.chat) npc.talked = true;   // real talk / story advances → optional ? next time
    return b;
  }
  // floating pixel icon bubble (♪ / ♥), drawn per-pixel on a tiny canvas
  const ICONS = {
    note: ['...XX...', '...XXX..', '...X.XX.', '...X..XX', '...X...X', '...X....', '...X....', '.XXX....', 'XXXX....', 'XXXX....', '.XX.....'],
    heart: ['.XX...XX.', 'XPPX.XPPX', 'XPPPXPPPX', 'XPPPPPPPX', 'XPPPPPPPX', '.XPPPPPX.', '..XPPPX..', '...XPX...', '....X....'],
  };
  function iconCanvas(kind) {
    const rows = ICONS[kind] || ICONS.note, c = document.createElement('canvas');
    c.width = rows[0].length; c.height = rows.length;
    const x = c.getContext('2d');
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') return; x.fillStyle = ch === 'P' ? '#FF5491' : kind === 'note' ? '#292C2E' : '#A92D59'; x.fillRect(i, j, 1, 1); }));
    c.style.width = c.width * 3 + 'px'; c.style.height = c.height * 3 + 'px';
    return c;
  }
  function showIcon(npc, kind, ms) {
    let b = bubbles.get(npc); if (b) b.el.remove();
    const B = makeBubble('icon'); B.bb.appendChild(iconCanvas(kind));
    b = { ...B, until: performance.now() + ms, shout: false, icon: true, prio: 1 };
    bubbles.set(npc, b);
  }
  function hideAll() {   // closes chat bubbles; shouts keep going
    for (const [n, b] of bubbles) { if (b.shout || b.icon || b.story) continue; b.el.remove(); if (!n.cat) getNPCs()?.endTalk(n); bubbles.delete(n); }
  }

  // Short click/tap on an NPC = talk. Hold >= LONG_PRESS_MS = slap (api.onLongPress).
  // A pixel charge ring fills up next to the pointer while holding.
  let press = null;
  const ring = document.createElement('canvas');
  ring.className = 'charge'; ring.width = ring.height = RING_N; layer.appendChild(ring);
  const rctx = ring.getContext('2d');
  const RING_COL = ['#292C2E', '#FFCC3F', '#F0F2F4', '#FF5491'];
  function drawRing(f) {        // per-pixel ring so the edges stay crisp (no canvas antialiasing)
    const img = rctx.createImageData(RING_N, RING_N), c = (RING_N - 1) / 2;
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    for (let y = 0; y < RING_N; y++) for (let x = 0; x < RING_N; x++) {
      const dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
      let col = null;
      if (d <= 6.9 && d >= 2.6) {
        if (d > 5.9 || d < 3.6) col = RING_COL[0];
        else {
          const ang = (Math.atan2(dx, -dy) / (Math.PI * 2) + 1) % 1;
          col = ang <= f ? (f >= 1 ? RING_COL[3] : RING_COL[1]) : RING_COL[2];
        }
      }
      if (col) { const [r, g, b] = hex(col), i = (y * RING_N + x) * 4; img.data.set([r, g, b, 255], i); }
    }
    rctx.putImageData(img, 0, 0);
  }
  // Mouse: click = talk (held back DBL_MS so a double-click can win), double-click = push (api.onDoubleClick),
  // hold = slap (api.onLongPress). Too far to talk: walk up first (api.approach, set by combat.js).
  let pend = null;
  function cancelPending() { if (pend) { clearTimeout(pend.timer); pend = null; } }
  function talkTo(npc) {
    if (npc.removed) return;
    const q = npc.root.position, d = Math.hypot(q.x - player.position.x, q.z - player.position.z);
    if (d > TALK_R && api.approach) { api.approach(npc, TALK_REACH, () => say(npc), TALK_R - TALK_REACH - 0.5); api.onFar?.(npc); return; }
    say(npc);
  }
  function endPress(click) {
    if (!press) return;
    const p = press; press = null; ring.style.display = 'none';
    if (!click || p.fired) return;
    if (pend && pend.npc === p.npc) { cancelPending(); api.onDoubleClick?.(p.npc); return; }
    if (pend) { const n = pend.npc; cancelPending(); talkTo(n); }
    pend = { npc: p.npc, timer: setTimeout(() => { const n = pend?.npc; pend = null; if (n) talkTo(n); }, DBL_MS) };
  }
  function tickPress() {
    if (!press) return;
    const f = Math.min(1, (performance.now() - press.t0) / LONG_PRESS_MS);
    // show the ring only after a short delay so quick clicks stay clean
    if (performance.now() - press.t0 > 90) {
      ring.style.display = 'block';
      const g = 3;
      ring.style.transform = `translate(${Math.round((press.x + 12) / g) * g}px, ${Math.round((press.y - 54) / g) * g}px)`;
      drawRing(f);
    }
    if (f >= 1 && !press.fired) {
      press.fired = true; cancelPending();
      api.onLongPress?.(press.npc);
      setTimeout(() => { if (press && press.fired) endPress(false); }, 160);
    }
    requestAnimationFrame(tickPress);
  }
  window.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (api.modal?.(e)) { e.stopImmediatePropagation(); e.preventDefault(); return; }   // a story line on screen: a click just advances it
    if (api.preClick?.(e.clientX, e.clientY)) { e.stopImmediatePropagation(); e.preventDefault(); hideAll(); return; }   // e.g. a mission pickup under the cursor beats the NPC behind it
    const npc = pick(e.clientX, e.clientY);
    if (npc) {
      e.stopImmediatePropagation(); e.preventDefault();
      endPress(false);
      press = { npc, t0: performance.now(), x: e.clientX, y: e.clientY, id: e.pointerId, fired: false };
      requestAnimationFrame(tickPress);
    } else hideAll();
  }, true);
  window.addEventListener('pointerup', (e) => { if (press && e.pointerId === press.id) endPress(true); }, true);
  window.addEventListener('pointercancel', (e) => { if (press && e.pointerId === press.id) endPress(false); }, true);
  window.addEventListener('pointermove', (e) => {
    if (press && e.pointerId === press.id) { press.x = e.clientX; press.y = e.clientY; }
  }, true);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  let hoverQueued = false, lastMove = null;
  canvas.addEventListener('pointermove', (e) => {
    lastMove = e;
    if (hoverQueued) return; hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      const x = lastMove.clientX, y = lastMove.clientY;
      let n = null, label = null;
      for (const f of api.hoverables) { const r = f(x, y); if (r) { n = r.target; label = r.label; break; } }   // cats, bins, pickups first (same order as clicks)
      if (!n) n = pick(x, y);
      canvas.style.cursor = n ? 'pointer' : '';
      setTag(n, label);
    });
  });
  canvas.addEventListener('pointerleave', () => { setTag(null); canvas.style.cursor = ''; });
  // hover name tag for named NPCs + a story "mark" (LANDLADY / ¥ RENT ¥): the same comic bubble, small
  let hoverNPC = null;
  const tagB = makeBubble('tag'); tagB.el.style.display = 'none';
  const markB = makeBubble('tag mark'); markB.el.style.display = 'none';
  let markNPC = null;
  function setTag(n, label) { hoverNPC = n && (label || n.tag) ? n : null; const t = hoverNPC ? label || n.tag : ''; if (tagB.bb.textContent !== t) tagB.bb.textContent = t; }
  function setMark(n, text) {
    markNPC = n || null;
    if (markNPC && markB.bb.textContent !== text) markB.bb.textContent = text;
  }

  // ---- head anchor: the top of the speaker's actual head (hair / hat included), not a fixed height ----
  const MARGIN = 0.1, TAIL = 14, EDGE = 6;
  const hw = new THREE.Vector3(), box = new THREE.Box3(), tb = new THREE.Box3();
  function headNode(n) {
    const h = n.c?.parts?.headCenter || n.char?.parts?.headCenter || n.parts?.headCenter;
    if (h) return h;
    return n.head?.isObject3D ? n.head : null;
  }
  function headTop(n, hn, now) {   // world-units from the head node up to the top of what's visible on it
    const c = n._headTop;
    if (c && c.node === hn && now - c.t < 500) return c.v;
    box.makeEmpty();
    hn.traverseVisible((o) => {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.union(tb);
    });
    hn.getWorldPosition(hw);
    const v = box.isEmpty() ? 0.25 : Math.max(0.05, Math.min(1.2, box.max.y - hw.y));
    n._headTop = { node: hn, t: now, v };
    return v;
  }
  /** Screen point (CSS px) just above the speaker's head. */
  function anchor(n, now = performance.now()) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const hn = headNode(n);
    if (hn) { hn.getWorldPosition(head); head.y += headTop(n, hn, now) + MARGIN; }
    else { n.root.getWorldPosition(head); head.y += n.bubbleY ?? 2.35; }
    head.project(camera);
    return { x: (head.x + 1) / 2 * w, y: (1 - head.y) / 2 * h, vis: head.z < 1 && n.root?.visible !== false && !n.removed };
  }


  // ---- talk hints: comic ! / ? above people you can talk to (near the player only) ----
  function hintKind(n) {
    const o = api.hintFor?.(n);
    if (o === null) return null;
    if (o === '!' || o === '?') return o;
    if (!n || n.removed || n.down || n.cat) return null;
    if (n.special === 'giver') return '!';                         // job board
    if ((n.important || n.story) && !n.talked) return '!';         // story beat / something new
    return '?';                                                   // optional chat, or already talked
  }
  function ensureHint(n, kind) {
    let h = hints.get(n);
    if (h && h.kind === kind) return h;
    if (h) h.el.remove();
    const B = makeBubble('talk-hint ' + (kind === '!' ? 'bang' : 'ask'));
    B.bb.textContent = kind;
    // no tail on these — they sit as a floating mark just above the head
    B.fill.setAttribute('points', ''); B.line.setAttribute('points', '');
    h = { ...B, kind, prio: 0.4 };
    hints.set(n, h);
    return h;
  }
  function clearHint(n) { const h = hints.get(n); if (h) { h.el.remove(); hints.delete(n); } }
  function refreshHints() {
    const npcs = getNPCs()?.list; if (!npcs) { for (const n of [...hints.keys()]) clearHint(n); return; }
    const px = player.position.x, pz = player.position.z;
    const cand = [];
    for (const n of npcs) {
      if (n.removed || n.down || !n.root?.visible) continue;
      const kind = hintKind(n); if (!kind) continue;
      if (bubbles.has(n)) continue;                 // hide while their chat / shout / icon / story bubble is up
      if (n === markNPC) continue;                  // landlady mark already tags her
      const d = Math.hypot(n.root.position.x - px, n.root.position.z - pz);
      if (d > HINT_R) continue;
      cand.push({ n, kind, d });
    }
    cand.sort((a, b) => a.d - b.d);
    const keep = new Set();
    for (const c of cand.slice(0, HINT_MAX)) { ensureHint(c.n, c.kind); keep.add(c.n); }
    for (const n of [...hints.keys()]) if (!keep.has(n)) clearHint(n);
  }

  // Lay out every bubble: centred over the head, tail tip on the head, clamped to the screen, no overlaps.
  function place() {
    const now = performance.now();
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const items = [];
    for (const [npc, b] of bubbles) {
      if (now > b.until) { b.el.remove(); bubbles.delete(npc); continue; }
      items.push({ npc, b, prio: b.prio ?? 2 });
    }
    refreshHints();
    for (const [npc, h] of hints) {
      if (bubbles.has(npc) || npc === markNPC) { h.el.style.visibility = 'hidden'; continue; }
      items.push({ npc, b: h, prio: h.prio, hint: true });
    }
    const tagOn = hoverNPC && !bubbles.has(hoverNPC) && hoverNPC !== markNPC && !hints.has(hoverNPC);
    tagB.el.style.display = tagOn ? '' : 'none';
    if (tagOn) items.push({ npc: hoverNPC, b: tagB, prio: 0 });
    const markOn = markNPC && !bubbles.has(markNPC);
    markB.el.style.display = markOn ? '' : 'none';
    if (markOn) items.push({ npc: markNPC, b: markB, prio: 0.5 });
    // read pass (no writes in between, so layout is measured once)
    for (const it of items) { it.a = anchor(it.npc, now); it.w = it.b.bb.offsetWidth; it.h = it.b.bb.offsetHeight; }
    items.sort((p, q) => q.prio - p.prio || q.a.y - p.a.y);
    const placed = [];
    for (const it of items) {
      const { a, w, h } = it;
      if (!a.vis) { it.b.el.style.visibility = 'hidden'; it.b.tip = null; continue; }
      let x = Math.round(a.x - w / 2), y = Math.round(a.y - (it.hint ? 8 : TAIL) - h);
      const clampX = () => { x = Math.max(EDGE, Math.min(W - EDGE - w, x)); };
      const clampY = () => { y = Math.max(EDGE, Math.min(H - EDGE - h, y)); };
      clampX(); clampY();
      let moved = false;
      for (let k = 0; k < 8; k++) {
        const o = placed.find((r) => x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y);
        if (!o) break;
        moved = true;
        const up = o.y - h - 4;
        if (up >= EDGE) y = up;
        else { x = a.x < o.x + o.w / 2 ? o.x - w - 4 : o.x + o.w + 4; clampX(); }
      }
      placed.push({ x, y, w, h });
      const el = it.b.el;
      el.style.visibility = 'visible';
      el.style.zIndex = moved ? '1' : ''; // stacked bubbles sit behind, so their tails tuck under the nearer bubble
      el.style.transform = `translate(${x}px, ${y}px)`;
      // tail: base on the body's bottom edge (as close under the head as the body allows), tip on the head
      const tx = Math.round(Math.max(EDGE, Math.min(W - EDGE, a.x))) - x, ty = Math.round(Math.max(EDGE, Math.min(H - EDGE, a.y))) - y;
      const bx = Math.max(12, Math.min(w - 12, tx)), by = h - 3, half = it.prio < 1 ? 5 : 8;
      const on = !it.hint && ty > by + 4;
      it.b.fill.setAttribute('points', on ? `${bx - half},${by} ${tx},${ty} ${bx + half},${by}` : '');
      it.b.line.setAttribute('points', on ? `${bx - half},${by + 1} ${tx},${ty} ${bx + half},${by + 1}` : '');
      it.b.tip = on ? { x: x + tx, y: y + ty } : null;
      it.b.box = { x, y, w, h };
      it.b.anchor = { x: a.x, y: a.y };
    }
  }
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => { prev.apply(scene, a); place(); };
  function clear(npc) { const b = bubbles.get(npc); if (b) { b.el.remove(); bubbles.delete(npc); } }
  // idle small-talk (chatter.js): small, quiet bubble; never replaces a real one
  function chat(npc, line, ms) {
    const b = bubbles.get(npc);
    if (b && !b.chat) return false;
    show(npc, line, ms, false, { chat: true });
    const nb = bubbles.get(npc); nb.chat = true; nb.prio = 0.8; nb.el.classList.add('chat'); nb.bb.querySelector('.who')?.remove();
    place(); return true;
  }
  const api = { say, chat, shout, clear, pick, hideAll, bubbles, hints, get hover() { return hoverNPC; }, setHover(n, label) { setTag(n, label); }, hoverables: [], onDoubleClick: null, approach: null, talkTo, get pending() { return pend; }, DBL_MS, setMark, anchor, headNode, place, modal: null, story: (n, line, opt = {}) => { const b = show(n, line, 1e9, false, { ...opt, story: true }); place(); return b; }, onLongPress: null, onClick: null, pickLine: null, onLine: null, hintFor: null, show: (n, t, ms = SHOW_MS, sh = false, opt) => { show(n, t, ms, sh, opt); place(); }, showIcon: (n, k, ms) => { showIcon(n, k, ms); place(); }, get pressing() { return press; } };
  return api;
}
