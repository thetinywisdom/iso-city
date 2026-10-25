import * as THREE from 'three';

// Click an NPC -> pixel-art chat bubble with a random line above their head.
// The listener runs in the capture phase on window, so a click that hits an NPC
// is consumed before main.js's click-to-move handler on the canvas sees it.
export const LINES = ['hi', 'hello', 'who are you?', 'excuse me?', 'not interested', 'f**k off',
  'go away', 'yes?', '?', 'free Palestine'];
const SHOW_MS = 2500;
export const LONG_PRESS_MS = 400;
const RING_N = 15;

export function initDialogue({ scene, camera, renderer, getNPCs, player, pixel }) {
  const canvas = renderer.domElement;
  const layer = document.createElement('div');
  layer.id = 'bubbles';
  document.body.appendChild(layer);
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const bubbles = new Map(); // npc -> { el, until }
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
      if (secs > 0) { showIcon(npc, npc.icon, secs * 1000 - 300); place(); }
      return;
    }
    let line = api.pickLine?.(npc) || null;   // missions may bias the line
    if (!line) do line = LINES[Math.floor(Math.random() * LINES.length)]; while (line === npc.lastLine && LINES.length > 1);
    npc.lastLine = line;
    show(npc, line, SHOW_MS, false);
    getNPCs().talk(npc, SHOW_MS / 1000, player.position);
    place();
    api.onLine?.(npc, line);
  }
  // Shout: bigger, red-bordered, shaking bubble. Does not stop the NPC.
  function shout(npc, text, ms = 1900) { show(npc, text, ms, true); place(); }
  function show(npc, line, ms, isShout) {
    let b = bubbles.get(npc);
    if (b) b.el.remove();
    const el = document.createElement('div');
    el.className = isShout ? 'bubble shout' : 'bubble';
    const span = document.createElement('span'); span.textContent = line; el.appendChild(span);
    layer.appendChild(el);
    // centre on whole pixels (a -50% transform would land text on half pixels and blur it)
    span.style.left = -Math.round(span.offsetWidth / 2 / 3) * 3 + 'px';
    b = { el, until: performance.now() + ms, shout: isShout };
    bubbles.set(npc, b);
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
    const el = document.createElement('div'); el.className = 'bubble icon';
    const span = document.createElement('span'); span.appendChild(iconCanvas(kind)); el.appendChild(span);
    layer.appendChild(el);
    span.style.left = -Math.round(span.offsetWidth / 2 / 3) * 3 + 'px';
    b = { el, until: performance.now() + ms, shout: false, icon: true };
    bubbles.set(npc, b);
  }
  function hideAll() {   // closes chat bubbles; shouts keep going
    for (const [n, b] of bubbles) { if (b.shout || b.icon) continue; b.el.remove(); getNPCs()?.endTalk(n); bubbles.delete(n); }
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
  function endPress(talk) {
    if (!press) return;
    const p = press; press = null; ring.style.display = 'none';
    if (talk && !p.fired) say(p.npc);
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
      press.fired = true;
      api.onLongPress?.(press.npc);
      setTimeout(() => { if (press && press.fired) endPress(false); }, 160);
    }
    requestAnimationFrame(tickPress);
  }
  window.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas || (e.pointerType === 'mouse' && e.button !== 0)) return;
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
      const n = pick(lastMove.clientX, lastMove.clientY);
      canvas.style.cursor = n ? 'pointer' : '';
      hoverNPC = n && n.tag ? n : null;
      tagEl.textContent = hoverNPC ? hoverNPC.tag : '';
      tagEl.style.display = hoverNPC ? 'block' : 'none';
      if (hoverNPC) tagEl.style.marginLeft = -Math.round(tagEl.offsetWidth / 2 / 3) * 3 + 'px';
    });
  });
  canvas.addEventListener('pointerleave', () => { hoverNPC = null; tagEl.style.display = 'none'; });
  // hover name tag for named NPCs (pixel font, follows them under the bubble line)
  let hoverNPC = null;
  const tagEl = document.createElement('div'); tagEl.className = 'nametag'; layer.appendChild(tagEl);

  // Follow the NPC's head in screen space; snapped to the art-pixel grid.
  function place() {
    const now = performance.now();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const g = pixel && pixel.enabled ? pixel.scale : 1;
    for (const [npc, b] of bubbles) {
      if (now > b.until) { b.el.remove(); bubbles.delete(npc); continue; }
      npc.root.getWorldPosition(head); head.y += 2.35;
      head.project(camera);
      const x = Math.round(((head.x + 1) / 2 * w) / g) * g;
      const y = Math.round(((1 - head.y) / 2 * h) / g) * g;
      b.el.style.transform = `translate(${x}px, ${y}px)`;
      b.el.style.visibility = head.z < 1 ? 'visible' : 'hidden';
    }
    tagEl.style.visibility = hoverNPC && bubbles.has(hoverNPC) ? 'hidden' : 'visible';   // the bubble takes the spot
    if (hoverNPC) {
      hoverNPC.root.getWorldPosition(head); head.y += 2.1; head.project(camera);
      const x = Math.round(((head.x + 1) / 2 * w) / g) * g, y = Math.round(((1 - head.y) / 2 * h) / g) * g;
      tagEl.style.transform = `translate(${x}px, ${y}px)`;
    }
  }
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => { prev.apply(scene, a); place(); };
  function clear(npc) { const b = bubbles.get(npc); if (b) { b.el.remove(); bubbles.delete(npc); } }
  const api = { say, shout, clear, pick, hideAll, bubbles, get hover() { return hoverNPC; }, setHover(n) { hoverNPC = n; tagEl.textContent = n ? n.tag : ''; tagEl.style.display = n ? 'block' : 'none'; if (n) tagEl.style.marginLeft = -Math.round(tagEl.offsetWidth / 2 / 3) * 3 + 'px'; }, onLongPress: null, onClick: null, pickLine: null, onLine: null, show: (n, t, ms = SHOW_MS, sh = false) => { show(n, t, ms, sh); place(); }, showIcon: (n, k, ms) => { showIcon(n, k, ms); place(); }, get pressing() { return press; } };
  return api;
}
