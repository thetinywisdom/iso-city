import * as THREE from 'three';

// BANANAS: press B to drop a peel behind you (carry up to 3, refill at the fruit stand in the park).
// ANY NPC who steps on a peel slips and lies flat for a couple of seconds. After they get up,
// aggressive types chase you; timid ones grumble and carry on. Peels vanish when used or after a while.
export const BANANA = { max: 3, life: 30, hitR: 0.55, maxOnGround: 4, lie: 2.1, stand: { x: -12.2, z: 19.4 }, refillR: 1.9 };
// pixel peel (12x10 art pixels), Comic yellows + warm-brown tips, drawn once
const PEEL = [
  '....DD......',
  '....YY......',
  '...YLLY.....',
  '..YLLLLY....',
  '.YLLYYLLY...',
  'YLLY..YLLY..',
  'YLY....YLLY.',
  'OY......YLYO',
  'D........YOD',
  '..........D.',
];
const COLS = { Y: '#FFCC3F', L: '#FFE166', O: '#ED8F02', D: '#4C3F42' };
function peelTex() {
  const c = document.createElement('canvas'); c.width = 12; c.height = 10; const x = c.getContext('2d');
  PEEL.forEach((r, j) => [...r].forEach((ch, i) => { if (COLS[ch]) { x.fillStyle = COLS[ch]; x.fillRect(i, j, 1, 1); } }));
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return { t, c };
}

export function initBananas({ scene, city, player, getNPCs, dialogue, combat, missions, pixel }) {
  const state = { supply: BANANA.max, dropped: 0, slips: 0, refills: 0, last: null };
  const peels = [];
  const { t: TEX, c: ICON } = peelTex();
  const geo = new THREE.PlaneGeometry(0.72, 0.6);
  // ---- fruit stand (low cart, striped awning, a pile of bananas); low collider you can hop over ----
  const stand = new THREE.Group(); scene.add(stand);
  {
    const S = BANANA.stand, y = city.groundHeight(S.x, S.z);
    const m = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const box = (w, h, d, x, yy, z, c) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c)); b.position.set(x, yy, z); b.castShadow = true; b.receiveShadow = true; stand.add(b); return b; };
    box(1.6, 0.7, 0.9, 0, 0.45, 0, '#93616B');            // cart body
    box(1.7, 0.08, 1.0, 0, 0.82, 0, '#4C3F42');           // counter edge
    for (const sx of [-0.72, 0.72]) box(0.06, 1.2, 0.06, sx, 1.4, -0.38, '#292C2E');   // awning poles
    for (let i = 0; i < 5; i++) box(0.36, 0.08, 1.1, -0.72 + i * 0.36, 2.02, 0.02, i % 2 ? '#F0F2F4' : '#FFCC3F');   // striped awning
    for (const [bx, bz, r] of [[-0.45, 0.05, 0.3], [0, -0.05, -0.2], [0.42, 0.08, 0.5], [-0.2, 0.2, 1.2], [0.25, -0.2, 2]]) {   // banana bunches
      const g = new THREE.Group(); g.position.set(bx, 0.93, bz); g.rotation.y = r; stand.add(g);
      for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 3, 6, Math.PI * 0.8), m(k === 1 ? '#FFE166' : '#FFCC3F')); b.rotation.set(Math.PI / 2, 0, k * 0.35); b.position.y = k * 0.03; g.add(b); }
    }
    for (const sx of [-0.55, 0.55]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 8), m('#292C2E')); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.17, 0.47); stand.add(w); }
    stand.position.set(S.x, y, S.z);
    city.colliders.push({ minX: S.x - 0.85, maxX: S.x + 0.85, minZ: S.z - 0.5, maxZ: S.z + 0.5, top: y + 0.9, stand: true });
    pixel?.toonify?.(stand);
  }
  // ---- HUD: [B] peel icon x N ----
  const hud = document.createElement('div'); hud.id = 'banana-hud';
  const ic = document.createElement('canvas'); ic.width = 12; ic.height = 10; ic.getContext('2d').drawImage(ICON, 0, 0);
  const txt = document.createElement('span');
  hud.append(ic, txt); document.body.appendChild(hud);
  let hudKey = '';
  function renderHud() {
    const k = state.supply + (state.supply ? '' : 'e');
    if (k === hudKey) return; hudKey = k;
    txt.textContent = state.supply ? ` x${state.supply} [B] DROP` : ' x0 FRUIT STAND!';
    hud.classList.toggle('empty', !state.supply);
  }
  function toast(t) { missions?.toast ? missions.toast(t) : null; }

  function drop() {
    if (combat.stun > 0) return false;
    if (state.supply <= 0) { toast('NO BANANAS! (FRUIT STAND)'); return false; }
    const p = player.position, h = player.heading;
    const x = p.x - Math.sin(h) * 0.75, z = p.z - Math.cos(h) * 0.75;
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: TEX, transparent: true, alphaTest: 0.5, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = Math.random() * Math.PI * 2;
    mesh.position.set(x, city.groundHeight(x, z) + 0.03, z); mesh.renderOrder = 2;
    scene.add(mesh);
    peels.push({ mesh, t: 0, x, z });
    while (peels.length > BANANA.maxOnGround) remove(peels[0]);
    state.supply--; state.dropped++; state.last = { x, z };
    combat.audio?.whoosh?.(0.3);
    return true;
  }
  function remove(pl) { const i = peels.indexOf(pl); if (i >= 0) peels.splice(i, 1); pl.mesh.removeFromParent(); pl.mesh.material.dispose(); }
  function step(dt) {
    const npcs = getNPCs();
    for (const pl of peels.slice()) {
      pl.t += dt;
      if (pl.t > BANANA.life) { remove(pl); continue; }
      pl.mesh.visible = pl.t < BANANA.life - 3 || Math.floor(pl.t * 6) % 2 === 0;   // blink before vanishing
      if (!npcs) continue;
      // Any NPC (walker, idle, special, chaser…) who steps on a peel slips.
      // Aggression reaction after get-up lives in npcs.slip → _getUp.
      for (const n of npcs.list) {
        if (n.down) continue;
        const q = n.root.position;
        if (Math.hypot(q.x - pl.x, q.z - pl.z) < BANANA.hitR) {
          if (npcs.slip(n, BANANA.lie)) {
            state.slips++; remove(pl);
            const v = q.clone(); v.y += 1.6; combat.burstAt(v, 'SLIP!');
            dialogue.shout(n, 'WHOA-OA-OA!', 1100);
            combat.audio?.whoosh?.(1); setTimeout(() => { combat.audio?.thud?.(); combat.shakeIt?.(0.15); const d = q.clone(); d.y += 0.25; combat.dustAt(d); }, 320);
          }
          break;
        }
      }
    }
    // refill at the stand
    const S = BANANA.stand, p = player.position;
    if (state.supply < BANANA.max && Math.hypot(p.x - S.x, p.z - S.z) < BANANA.refillR) {
      state.supply = BANANA.max; state.refills++; toast(`BANANAS x${BANANA.max}!`);
    }
    renderHud();
  }
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyB' && !e.repeat && !e.target.closest?.('input,textarea')) { e.preventDefault(); drop(); } });
  let last = performance.now();
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => { prev.apply(scene, a); const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt); };
  renderHud();
  return { state, peels, drop, stand, setSupply: (n) => { state.supply = n; } };
}
