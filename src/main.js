import * as THREE from 'three';
import { generateCity } from './city.js?v=20261025l';
import { loadCustom, STORE_KEY, PLAYER_KEY, setPlayerChar, playerCharDef } from './customchars.js?v=20261025l';
import { Player, JUMP } from './player.js?v=20261025l';
import { P } from './palette.js?v=20261025l';
import { PixelPipeline, placeSnappedSun } from './pixel.js?v=20261025l';
import { NPCs, NPC_RADIUS } from './npcs.js?v=20261025l';
import { initExtras } from './extras.js?v=20261025l';
import { initGameMenu } from './gamemenu.js?v=20261025l';

// ---- Renderer / scene --------------------------------------------------------
const SKY = new THREE.Color(P.sky);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(new URLSearchParams(location.search).get('pr') ? +new URLSearchParams(location.search).get('pr') : navigator.webdriver ? 0.34 : Math.min(window.devicePixelRatio || 1, 2)); // full resolution, crisp (automated runs: third-res, software GL is slow)
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap; // hard, crisp shadow edges;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = SKY;

// ---- Isometric orthographic camera ------------------------------------------
const VIEW = 30;                         // world units visible vertically at zoom 1
const YAW = THREE.MathUtils.degToRad(45);
const PITCH = Math.atan(1 / Math.SQRT2); // 35.264° true isometric
const DIST = 160;
const camOffset = new THREE.Vector3(
  Math.cos(PITCH) * Math.sin(YAW), Math.sin(PITCH), Math.cos(PITCH) * Math.cos(YAW)).multiplyScalar(DIST);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600);
let zoom = 1.6;
// ---- Cartoon pipeline: toon ramps + black ink outlines, full resolution -----------
const params = new URLSearchParams(location.search);
const pixel = new PixelPipeline(renderer, { outlines: params.get('outlines') !== '0' });
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  pixel.setSize(window.innerWidth, window.innerHeight);
}
resize();
window.addEventListener('resize', resize);
scene.fog = new THREE.Fog(SKY, DIST + 20, DIST + 90);

// Screen-relative ground axes for WASD
const camForward = new THREE.Vector3(-camOffset.x, 0, -camOffset.z).normalize();
const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

// ---- Lights ------------------------------------------------------------------
// Flat-vector look: strong ambient fill, gentle key light, light shadows.
scene.add(new THREE.HemisphereLight('#ffffff', '#dfe4e8', 2.2));
const sun = new THREE.DirectionalLight('#ffffff', 1.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 220 });
sun.shadow.bias = -0.0012;
sun.shadow.normalBias = 0.06;
if ('intensity' in sun.shadow) sun.shadow.intensity = 0.5;
const SUN_OFFSET = new THREE.Vector3(-40, 70, 25);
scene.add(sun, sun.target);

// ---- World -------------------------------------------------------------------
const city = generateCity(scene);
pixel.toonify(scene);
let npcs = null;
const player = new Player(); // placeholder capsule until a character model loads

player.position.copy(city.spawn);
player.heading = Math.PI / 4 + Math.PI; // face "up" the screen
scene.add(player.root);

// ---- Character hook ----------------------------------------------------------
// Real characters live in ../characters/characters.js and export
// createMainCharacter() and createNPC(options). If the file exists we swap the
// placeholder capsule for the main character; otherwise the capsule stays.
let charMod = null, playingAs = undefined;
/** Rebuild the player model from the saved choice (isoCity.playerChar.v1); falls back to the default guy. */
function applyPlayerChar(force = false) {
  if (!charMod?.createMainCharacter) return;
  const def = charMod.createCustom ? playerCharDef() : null;
  const key = def ? def.id + ':' + JSON.stringify(def) : 'default';
  if (!force && key === playingAs) return;
  let model = null;
  if (def) { try { model = charMod.createCustom(def); } catch (e) { console.warn('custom player failed, using default:', e.message); } }
  if (!model) model = charMod.createMainCharacter();
  player.setModel(model); pixel.toonify(player.root);
  playingAs = model.def ? key : 'default';
  player.heroName = model.def ? String(model.def.name || 'YOU').toUpperCase() : null;
  updatePlayerBtn();
}
function updatePlayerBtn() {}
addEventListener('storage', (e) => { if (e.key === PLAYER_KEY || e.key === STORE_KEY || e.key === null) applyPlayerChar(); });
import('../characters/characters.js?v=20261025l')
  .then((mod) => {
    charMod = mod;
    if (mod?.createMainCharacter) applyPlayerChar(true);
    if (mod?.createNPC) { npcs = new NPCs(scene, mod, city); npcs.toonify = (r) => pixel.toonify(r); }
    pixel.toonify(scene);
  })
  .catch((e) => console.info('Character module not loaded, using placeholder:', e.message));

// Click-to-move target marker
const marker = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.7, 24),
  new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false }));
marker.material.color.set(P.marker);
marker.rotation.x = -Math.PI / 2; marker.visible = false;
scene.add(marker);

// ---- Input ---------------------------------------------------------------------
const keys = new Set();
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run' };
// Character creator: opens in a new tab; saved characters spawn here live (storage event in npcs.js)
function openCreator() { gameMenu.open('creator'); }
const gameMenu = initGameMenu({ onPick: () => { applyPlayerChar(); npcs?.syncCustom?.(); }, getStory: () => extras?.story, onOpen: () => { keys.clear(); clickTarget = null; } });
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC' && !e.repeat && !e.metaKey && !e.ctrlKey) { openCreator(); return; }
  if (e.code === 'Space') { e.preventDefault(); if (e.repeat) return; if (extras?.hiding?.hidden) { if (!extras.hiding.state.doomed) extras.hiding.popOut(); return; } if (!(extras?.combat.stun > 0)) player.jump(); return; }
  const k = KEYMAP[e.code];
  if (k) { keys.add(k); e.preventDefault(); if (k !== 'run') clickTarget = null; }
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
window.addEventListener('blur', () => keys.clear());

let clickTarget = null, stuckTime = 0;
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
// lets missions redirect a click (e.g. click the cap -> walk under it)
player.walkTo = (x, z) => {
  clickTarget = new THREE.Vector3(x, 0, z); stuckTime = 0;
  marker.position.set(x, city.groundHeight(x, z) + 0.05, z); marker.visible = true;
};
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, hit)) {
    clickTarget = hit; stuckTime = 0;
    marker.position.set(hit.x, city.groundHeight(hit.x, hit.z) + 0.05, hit.z);
    marker.visible = true;
  }
});
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoom = THREE.MathUtils.clamp(zoom * Math.exp(-e.deltaY * 0.0012), 0.55, 3);
}, { passive: false });

// ---- Collision -----------------------------------------------------------------
const RADIUS = 0.42;
// Low props (collider.top set: fences, bushes, benches, bins, fountain rim...) only block while the
// feet are below their top: a jump carries you over them. CLEAR = leg-tuck forgiveness.
const CLEAR = 0.12;
const lowClear = (c) => c.top !== undefined && player.position.y >= c.top - CLEAR;
function blocked(x, z) {
  for (const c of city.colliders) {
    if (lowClear(c)) continue;
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx, dz = z - nz;
    if (dx * dx + dz * dz < RADIUS * RADIUS) return true;
  }
  if (npcs) {
    const rr = (RADIUS + NPC_RADIUS) ** 2, p = player.position;
    for (const q of npcs.positions) {
      const d0 = (p.x - q.x) ** 2 + (p.z - q.z) ** 2, d1 = (x - q.x) ** 2 + (z - q.z) ** 2;
      if (d1 < rr && d1 < d0) return true; // only block moves that get closer (never trap)
    }
  }
  return false;
}
// standable low props (benches, bins, planters, bushes, fountain rim): land on top when the feet come down onto them
function standHeight(x, z) {
  let h = -Infinity;
  for (const c of city.colliders) {
    if (!c.stand || player.position.y < c.top - 0.15) continue;
    if (x > c.minX - 0.12 && x < c.maxX + 0.12 && z > c.minZ - 0.12 && z < c.maxZ + 0.12) h = Math.max(h, c.top);
  }
  return h;
}
// came down overlapping a low prop without standing on it (fence, bollard, edge of a bench): slide off it
function depenetrate() {
  const p = player.position;
  for (const c of city.colliders) {
    if (c.top === undefined || lowClear(c)) continue;
    const nx = Math.max(c.minX, Math.min(p.x, c.maxX)), nz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
    let dx = p.x - nx, dz = p.z - nz; const d = Math.hypot(dx, dz);
    if (d >= RADIUS) continue;
    if (d > 1e-4) { p.x = nx + dx / d * (RADIUS + 0.01); p.z = nz + dz / d * (RADIUS + 0.01); continue; }
    // centre inside the box: out through the nearest side
    const opts = [[c.minX - RADIUS - 0.01 - p.x, 0], [c.maxX + RADIUS + 0.01 - p.x, 0], [0, c.minZ - RADIUS - 0.01 - p.z], [0, c.maxZ + RADIUS + 0.01 - p.z]];
    opts.sort((u, v) => Math.hypot(...u) - Math.hypot(...v));
    p.x += opts[0][0]; p.z += opts[0][1];
  }
}
function tryMove(dx, dz) {
  const p = player.position;
  const b = city.bounds;
  const nx = THREE.MathUtils.clamp(p.x + dx, b.min, b.max);
  if (!blocked(nx, p.z)) p.x = nx;
  const nz = THREE.MathUtils.clamp(p.z + dz, b.min, b.max);
  if (!blocked(p.x, nz)) p.z = nz;
}

// ---- Loop ------------------------------------------------------------------------
const camTarget = player.position.clone();
let camFocus = null, zoomNow = zoom;
const clock = new THREE.Clock();
const move = new THREE.Vector3();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (gameMenu.isOpen) { pixel.render(scene, camera); requestAnimationFrame(tick); return; }   // paused
  let running = keys.has('run');
  let speed = (running ? 7 : 3.2) * (extras?.story?.speedMul || 1); // walk/run speeds matched to the character's natural stride

  move.set(0, 0, 0);
  if (keys.has('up')) move.add(camForward);
  if (keys.has('down')) move.sub(camForward);
  if (keys.has('right')) move.add(camRight);
  if (keys.has('left')) move.sub(camRight);

  if (move.lengthSq() === 0 && clickTarget) {
    move.set(clickTarget.x - player.position.x, 0, clickTarget.z - player.position.z);
    if (move.length() < 0.25) { clickTarget = null; move.set(0, 0, 0); }
  }
  // slap: walk into reach of the target NPC, then freeze input during the swing / when hit
  const ctl = extras ? extras.combat.control(dt, keys.has('up') || keys.has('down') || keys.has('left') || keys.has('right')) : null;
  // hiding in a trash can: frozen in place; any move key pops you out (hiding.js)
  const hid = extras?.hiding ? extras.hiding.control(keys.has('up') || keys.has('down') || keys.has('left') || keys.has('right')) : false;
  if (hid) { move.set(0, 0, 0); clickTarget = null; player.vel.set(0, 0, 0); }
  if (ctl?.lock) { move.set(0, 0, 0); clickTarget = null; }
  else if (ctl?.dir) { move.set(ctl.dir.x, 0, ctl.dir.z); clickTarget = null; speed = ctl.speed; running = speed > 5; }
  if (!clickTarget) marker.visible = false;

  const moving = move.lengthSq() > 0;
  let actualSpeed = 0;
  let targetHeading = null;
  if (moving) { move.normalize(); targetHeading = Math.atan2(move.x, move.z); }
  // momentum: accelerate/brake toward the wanted velocity (little air control mid-jump)
  const vel = player.vel;
  const accel = player.airborne ? JUMP.airControl : (moving ? 12 : 14);
  vel.lerp(move.clone().multiplyScalar(moving ? speed : 0), 1 - Math.exp(-accel * dt));
  if (vel.lengthSq() > 1e-4) {
    const before = player.position.clone();
    tryMove(vel.x * dt, vel.z * dt);
    actualSpeed = dt > 0 ? before.distanceTo(player.position) / dt : 0;
    if (actualSpeed < vel.length() * 0.5 && !player.airborne) vel.multiplyScalar(0.5); // bumped into something (keep momentum mid-jump)
  }
  if (moving) {
    if (clickTarget && !player.airborne) {
      const progressed = actualSpeed * dt;
      stuckTime = progressed < speed * dt * 0.2 ? stuckTime + dt : 0;
      if (stuckTime > 0.35) clickTarget = null; // walked into a wall
    }
  }
  const gy = hid ? city.groundHeight(player.position.x, player.position.z) + 0.02   // inside the bin: feet on the ground, no push-out
    : Math.max(city.groundHeight(player.position.x, player.position.z) + 0.02, standHeight(player.position.x, player.position.z));
  player.stepVertical(dt, gy); // gravity + jump; step-height smoothing on the ground
  if (!hid) depenetrate();
  player.animate(dt, actualSpeed > 0.2, running, targetHeading, actualSpeed);

  if (marker.visible) {
    const s = 1 + Math.sin(performance.now() * 0.008) * 0.15;
    marker.scale.set(s, s, s);
  }

  // Camera follow (smooth)
  // story scenes can frame someone else (camFocus: { pos: Vector3, zoom })
  const fc = camFocus;
  camTarget.lerp(fc ? fc.pos : player.position, 1 - Math.exp(-dt * (fc ? 3 : 6)));
  zoomNow += ((fc?.zoom ?? zoom) - zoomNow) * (1 - Math.exp(-dt * 3));
  if (npcs) npcs.update(dt, player.position, RADIUS);
  pixel.placeCamera(camera, camTarget, camOffset, VIEW / zoomNow); 

  // Sun + shadow frustum follow the player (snapped to shadow texels: no crawling)
  placeSnappedSun(sun, camTarget, SUN_OFFSET);

  pixel.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Expose a little debug handle (used by the headless smoke test).
window.__game = { menu: gameMenu, player, standHeight, city, camera, renderer, scene, keys, pixel, get npcs() { return npcs; }, setZoom: (z) => (zoom = zoomNow = z), focus: (f) => { camFocus = f || null; }, get camFocus() { return camFocus; } };
const extras = window.__game.extras = initExtras({ scene, camera, renderer, pixel, city, player, keys, getNPCs: () => npcs });
window.__game.missions = extras.missions;
