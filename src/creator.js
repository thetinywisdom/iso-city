// Character creator page (creator.html). Builds custom characters with the same builder + pixel
// pipeline as the game and saves them to localStorage; the city tab picks them up live.
import * as THREE from 'three';
import { CUSTOM, KIMATA_STYLE, customDefaults, normalizeCustom, randomCustom, createCustom } from '../characters/characters.js?v=20261031j';
import { PixelPipeline, rampUniforms } from './pixel.js?v=20261031j';
import { HOMES, loadCustom, saveCustom, newId, getPlayerChar, setPlayerChar, PLAYER_KEY, isBuiltinChar } from './customchars.js?v=20261031j';
import * as CH from '../characters/characters.js?v=20261031j';
import { CITY_ROSTER, OVERRIDE_KEY, cityBaseDef, loadOverrides, saveOverride, clearOverride } from './citychars.js?v=20261031j';

const MAX = 30;
const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); for (const k of kids) e.append(k); return e; };
const pretty = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
const LABELS = { icecream: 'Ice cream', shopping: 'Shopping bag', dog: 'Dog on a leash', none: 'None', tee: 'T-shirt', tank: 'Tank top',
  busstop: 'Bus stop', sneakers: 'Sneakers', barefoot: 'Barefoot', man: 'Man', woman: 'Woman',
  backcap: 'Back cap', stripetee: 'Striped tee', ring: 'Watermelon ring', mbappe: 'Bad' };
const label = (v) => LABELS[v] || pretty(v);

// ---------------------------------------------------------------- preview ----
rampUniforms.uSunI.value = 1.1;
const host = $('#preview');
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const EMBED = new URLSearchParams(location.search).has('embed');
if (EMBED) { document.documentElement.classList.add('embed'); addEventListener('keydown', (e) => { if (e.code === 'Escape') window.parent?.__gameMenu?.close?.(); }); }
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#EFFAFA');
scene.add(new THREE.HemisphereLight('#ffffff', '#d5dbe0', 2.6));
const sun = new THREE.DirectionalLight('#ffffff', 1.1);
sun.position.set(4, 8, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0015;
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 });
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 24), new THREE.MeshStandardMaterial({ color: '#A8ECF2' }));
ground.position.y = -0.06; ground.receiveShadow = true; scene.add(ground);
const stage = new THREE.Group(); scene.add(stage);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
const pixel = new PixelPipeline(renderer, {});
pixel.toonify(scene);
const CAM_OFFSET = new THREE.Vector3(10, 10, 10), target = new THREE.Vector3(0, 1.15, 0), VIEW = 1.45;
function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false); pixel.setSize(w, h);
  const a = w / h; cam.left = -VIEW * a; cam.right = VIEW * a; cam.top = VIEW; cam.bottom = -VIEW; cam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let ch = null, spin = true, walk = false, yaw = Math.PI / 4;
function rebuild() {
  // never let a preview failure kill the form: log it and keep the old model
  try {
    const next = createCustom(cur);
    if (ch) ch.root.removeFromParent();
    ch = next; stage.add(ch.root); pixel.toonify(ch.root);
  } catch (e) { console.error('[creator] preview rebuild failed', e); }
}
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (ch) {
    if (spin && !ch.dancing) yaw += dt * 0.9;
    ch.root.rotation.y = yaw;
    ch.update(dt, { speed: walk && !ch.dancing ? 1.4 : 0 });
  }
  pixel.placeCamera(cam, target, CAM_OFFSET, VIEW * 2);
  pixel.render(scene, cam);
});

// ------------------------------------------------------------------ state ----
let cur = customDefaults('man'), editingId = null, editingCity = null;
const status = (msg, err = false) => { const s = $('#status'); s.textContent = msg; s.classList.toggle('err', err); clearTimeout(status.t); status.t = setTimeout(() => (s.textContent = ''), 3500); };

// ------------------------------------------------------------------- form ----
const form = $('#form');
const controls = [];   // {sync()} redrawn when `cur` changes
function changed() { rebuild(); for (const c of controls) c.sync(); }
function card(title, ...kids) { const c = el('div', { className: 'card' }, el('h3', { textContent: title }), ...kids); form.append(c); return c; }
function field(name, ...kids) { return el('div', { className: 'field' }, el('label', { className: 'lab', textContent: name }), ...kids); }
function chips(key, opts, { onPick, get } = {}) {
  const box = el('div', { className: 'chips', role: 'group' });
  for (const v of opts) {
    const b = el('button', { className: 'chip', type: 'button', textContent: label(v) }); b.dataset.v = v; b.dataset.key = key;
    b.onclick = () => { if (onPick) onPick(v); else cur[key] = v; changed(); };
    box.append(b);
  }
  controls.push({ sync: () => { const val = get ? get() : cur[key]; for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.v === val)); } });
  return box;
}
function swatches(key, colors = CUSTOM.colors) {
  const box = el('div', { className: 'swatches' });
  for (const c of colors) {
    const b = el('button', { className: 'sw', type: 'button', title: c }); b.style.background = c; b.dataset.c = c; b.dataset.key = key;
    b.onclick = () => { cur[key] = c; changed(); };
    box.append(b);
  }
  controls.push({ sync: () => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.c === cur[key])); } });
  return box;
}
function text(key, opts = {}) {
  const i = el('input', { type: 'text', maxLength: opts.max || 18, placeholder: opts.ph || '' }); i.id = 'f_' + key;
  i.oninput = () => { cur[key] = opts.upper ? i.value.toUpperCase() : i.value; if (opts.rebuild) rebuild(); };
  controls.push({ sync: () => { if (document.activeElement !== i) i.value = cur[key] || ''; } });
  return i;
}

// Body
card('BODY',
  field('Start from', chips('gender', CUSTOM.genders, {
    onPick: (g) => { const keep = { name: cur.name, lines: cur.lines, bubble: cur.bubble, dance: cur.dance, home: cur.home, held: cur.held, heldColor: cur.heldColor };
      const wasDefaultName = ['NEW GUY', 'NEW GAL'].includes(cur.name); cur = { ...customDefaults(g), ...keep }; if (wasDefaultName) cur.name = customDefaults(g).name; } })),
  el('div', { className: 'hint', textContent: 'Sets man / woman defaults — every part below stays mixable.' }),
  field('Body type', chips('body', CUSTOM.bodies)),
  (() => {
    const r = el('input', { type: 'range', min: CUSTOM.height[0], max: CUSTOM.height[1], step: 0.01, id: 'f_height' });
    const v = el('b');
    r.oninput = () => { cur.height = +r.value; v.textContent = Math.round(cur.height * 100) + '%'; rebuild(); };
    controls.push({ sync: () => { r.value = cur.height; v.textContent = Math.round(cur.height * 100) + '%'; } });
    return field('Height', el('div', { className: 'range' }, el('span', { textContent: `short ${Math.round(CUSTOM.height[0] * 100)}%` }), r, el('span', { textContent: `${Math.round(CUSTOM.height[1] * 100)}% tall` })), el('div', { className: 'hint' }, 'now: ', v));
  })(),
  field('Skin', swatches('skin', CUSTOM.skins)),
);
// Hair & head
card('HAIR & HEAD',
  field('Hair style', chips('hair', CUSTOM.hairs)),
  field('Hair colour', swatches('hairColor')),
  field('Hat', chips('hat', CUSTOM.hats)),
  field('Hat colour', swatches('hatColor')),
);
// Clothes
card('CLOTHES',
  field('Top', chips('top', CUSTOM.tops)),
  field('Top colour', swatches('topColor')),
  field('Inner / collar colour', swatches('innerColor')),
  field('Bottom', chips('bottom', CUSTOM.bottoms)),
  field('Bottom colour', swatches('bottomColor')),
  field('Shoes', chips('shoes', CUSTOM.shoes)),
  field('Shoe colour', swatches('shoeColor')),
);
// Accessories
card('ACCESSORIES',
  (() => {
    const box = el('div', { className: 'chips' });
    for (const k of CUSTOM.accs) {
      const b = el('button', { className: 'chip', type: 'button', textContent: label(k) }); b.dataset.acc = k;
      b.onclick = () => { cur.acc[k] = !cur.acc[k]; if (k === 'glasses' && cur.acc.glasses) cur.acc.sunglasses = false; if (k === 'sunglasses' && cur.acc.sunglasses) cur.acc.glasses = false; changed(); };
      box.append(b);
    }
    controls.push({ sync: () => { for (const b of box.children) b.setAttribute('aria-pressed', String(!!cur.acc[b.dataset.acc])); } });
    return field('Wear (toggle)', box);
  })(),
  field('Accessory colour (earrings, bag, frames)', swatches('accColor')),
  el('h3', { textContent: 'HOLDING', style: 'margin-top:14px' }),
  field('Held item', chips('held', CUSTOM.helds)),
  field('Item colour', swatches('heldColor')),
  el('div', { className: 'hint', textContent: 'Guitar strums, football juggles and boombox bobs when idle. Held in the left hand — the right one is for slapping.' }),
);
// Personality
const linesBox = el('textarea', { id: 'f_lines', placeholder: 'one line per row (3 to 5)' });
const linesHint = el('div', { className: 'hint' });
const readLines = () => linesBox.value.split('\n').map((s) => s.trim()).filter(Boolean);
const showLinesHint = () => { const n = readLines().length; linesHint.textContent = `${n} line${n === 1 ? '' : 's'} — needs 3 to 5`; linesHint.classList.toggle('bad', n < 3 || n > 5); };
linesBox.oninput = () => { cur.lines = readLines(); showLinesHint(); };
controls.push({ sync: () => { if (document.activeElement !== linesBox) linesBox.value = cur.lines.join('\n'); showLinesHint(); } });
const homeSel = el('select', { id: 'f_home' });
for (const [k, h] of Object.entries(HOMES)) homeSel.append(el('option', { value: k, textContent: h.label }));
homeSel.onchange = () => { cur.home = homeSel.value; };
controls.push({ sync: () => { homeSel.value = cur.home; } });
card('PERSONALITY',
  field('Name', text('name', { upper: true, ph: 'NAME' })),
  field('Talk lines (when you click them)', linesBox, linesHint),
  field('Chat bubble line (optional — said to neighbours)', text('bubble', { max: 60, ph: 'e.g. have you seen my cat?' })),
  field('Dance style', chips('dance', CUSTOM.dances)),
  field('Home spot', homeSel),
);

// ---------------------------------------------------------------- buttons ----
$('#pvSpin').onclick = (e) => { spin = !spin; e.target.setAttribute('aria-pressed', String(spin)); };
$('#pvWalk').onclick = (e) => { walk = !walk; e.target.setAttribute('aria-pressed', String(walk)); };
$('#pvDance').onclick = () => { if (ch && !ch.dancing) ch.dance(cur.dance); };

function validate() {
  cur.lines = readLines();
  if (!cur.name.trim()) return 'Give them a name.';
  if (cur.lines.length < 3 || cur.lines.length > 5) return 'Talk lines: 3 to 5, one per row.';
  return null;
}
function save(asCopy) {
  const err = validate(); if (err) return status(err, true);
  if (editingCity && !asCopy) {   // a built-in city character: write the look override, the game applies it live
    const def = normalizeCustom(cur);
    saveOverride(editingCity, def); cur = def;
    status(`${def.name} updated in the city.`); changed(); return renderCity();
  }
  if (asCopy && editingCity) { editingCity = null; editingId = null; renderCity(); }
  const list = loadCustom();
  const def = { ...normalizeCustom(cur) };
  if (editingId && !asCopy) {
    if (isBuiltinChar(editingId)) return status(`${def.name} is permanent — use DUP to make your own.`, true);
    const i = list.findIndex((d) => d.id === editingId);
    if (i >= 0) { list[i] = { ...def, id: editingId }; saveCustom(list); status(`${def.name} updated.`); return renderList(); }
  }
  if (list.length >= MAX) return status(`Max ${MAX} characters — delete one first.`, true);
  if (asCopy && editingId) def.name = (def.name.slice(0, 15) + ' 2');
  const id = newId(); list.push({ ...def, id }); saveCustom(list);
  editingId = id; cur = normalizeCustom(def);
  status(`${def.name} saved — they're in the city now.`);
  changed(); renderList();
}
$('#btnSave').onclick = () => save(false);
$('#btnCopy').onclick = () => save(true);
$('#btnKimata').onclick = () => {   // Kimata's look: keeps name, lines and home
  const keep = { name: cur.name, lines: cur.lines, bubble: cur.bubble, home: cur.home };
  cur = normalizeCustom({ ...cur, ...structuredClone(KIMATA_STYLE), ...keep }); changed(); status('Kimata style!');
};
$('#btnRandom').onclick = () => { const keepId = editingId; cur = normalizeCustom(randomCustom()); editingId = keepId; changed(); status('Randomized!'); };
$('#btnNew').onclick = () => { cur = customDefaults(cur.gender); editingId = null; editingCity = null; changed(); renderList(); renderCity(); };

function renderList() {
  const ul = $('#saved'); ul.textContent = '';
  const list = loadCustom();
  $('#count').textContent = `${list.length}/${MAX}`;
  if (!list.length) ul.append(el('li', { className: 'empty', textContent: 'Nobody yet — make someone and hit SAVE.' }));
  const pid = getPlayerChar(), you = pid && list.find((d) => d.id === pid);
  const pd = $('#playDefault');
  if (pd) { pd.setAttribute('aria-pressed', String(!you)); pd.textContent = you ? 'PLAY AS BALD GUY' : '★ YOU: BALD GUY'; }
  for (const d of list) {
    const li = el('li', { className: d.id === editingId ? 'editing' : '' }); li.dataset.id = d.id;
    const dot = el('span', { className: 'dot' }); dot.style.background = d.topColor || '#F0F2F4';
    const btn = (t, fn, cls = '') => { const b = el('button', { className: 'pbtn sm ' + cls, type: 'button', textContent: t }); b.onclick = fn; return b; };
    let armed = false;
    const del = btn('DEL', () => {
      if (isBuiltinChar(d)) return status(`${d.name} is permanent.`, true);
      if (!armed) { armed = true; del.textContent = 'SURE?'; del.classList.add('pink'); setTimeout(() => { armed = false; del.textContent = 'DEL'; del.classList.remove('pink'); }, 2500); return; }
      saveCustom(loadCustom().filter((o) => o.id !== d.id));
      if (editingId === d.id) editingId = null;
      status(`${d.name} deleted.`); renderList();
    });
    del.dataset.act = 'del';
    const edit = btn('EDIT', () => { cur = normalizeCustom(d); editingId = d.id; editingCity = null; changed(); renderList(); renderCity(); status(`Editing ${d.name}.`); }); edit.dataset.act = 'edit';
    const dup = btn('DUP', () => {
      const L = loadCustom(); if (L.length >= MAX) return status(`Max ${MAX} characters.`, true);
      L.push({ ...d, id: newId(), name: String(d.name).slice(0, 15) + ' 2' }); saveCustom(L); status(`${d.name} duplicated.`); renderList();
    }); dup.dataset.act = 'dup';
    const me = getPlayerChar() === d.id;
    const play = btn(me ? '★ YOU' : 'PLAY', () => {
      if (getPlayerChar() === d.id) { setPlayerChar(null); status('Back to the bald guy.'); }
      else { setPlayerChar(d.id); status(`You're playing as ${d.name} now.`); }
      renderList();
    }, me ? 'yellow' : ''); play.dataset.act = 'play'; play.title = me ? 'Playing as them — click to go back to the bald guy' : 'Play as this character';
    if (me) li.classList.add('me');
    li.append(dot, el('span', { className: 'nm', textContent: d.name + (isBuiltinChar(d) ? ' ★' : '') }), play, edit, dup, del);
    ul.append(li);
  }
}

// -------------------------------------------------------- city characters ----
const cityDef = (key) => { const o = loadOverrides()[key]; return o ? normalizeCustom(o) : cityBaseDef(key, CH); };
function editCity(key) {
  const r = CITY_ROSTER.find((o) => o.key === key); if (!r) return;
  cur = cityDef(key); editingCity = key; editingId = null;
  changed(); renderList(); renderCity(); status(`Editing ${r.name} (city).`);
}
function resetCity(key) {
  clearOverride(key);
  if (editingCity === key) { cur = cityDef(key); changed(); }
  const r = CITY_ROSTER.find((o) => o.key === key); status(`${r ? r.name : key} is back to the original.`); renderCity();
}
function renderCity() {
  const ul = $('#city'); if (!ul) return; ul.textContent = '';
  const ov = loadOverrides();
  $('#btnSave').textContent = editingCity ? 'SAVE TO CITY' : 'SAVE';
  for (const r of CITY_ROSTER) {
    const edited = !!ov[r.key], d = cityDef(r.key);
    const li = el('li', { className: (r.key === editingCity ? 'editing ' : '') + (edited ? 'edited' : '') }); li.dataset.key = r.key;
    const dot = el('span', { className: 'dot' }); dot.style.background = d ? d.topColor : '#F0F2F4';
    const btn = (t, fn, cls = '') => { const b = el('button', { className: 'pbtn sm ' + cls, type: 'button', textContent: t }); b.onclick = fn; return b; };
    const edit = btn('EDIT', () => editCity(r.key)); edit.dataset.act = 'cedit';
    const reset = btn('RESET', () => resetCity(r.key)); reset.dataset.act = 'creset'; reset.disabled = !edited;
    reset.title = 'Reset to original';
    const name = edited && d && d.name.toUpperCase() !== r.name ? `${d.name} (${r.name})` : r.name;
    li.append(dot, el('span', { className: 'nm', textContent: name + (edited ? ' *' : '') }), edit, reset);
    ul.append(li);
  }
  const r = CITY_ROSTER.find((o) => o.key === editingCity);
  const note = $('#cityNote'); if (note) note.textContent = r ? `Editing ${r.name} — ${r.note || 'keeps their role.'} Dance style: specials keep their own dance.` : '* = edited';
}

// ---------------------------------------------------------- export/import ----
$('#btnExport').onclick = () => {
  const blob = new Blob([JSON.stringify({ app: 'iso-city', kind: 'characters', v: 1, chars: loadCustom() }, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'iso-city-characters.json' }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  status('Exported.');
};
$('#importFile').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const arr = Array.isArray(data) ? data : Array.isArray(data?.chars) ? data.chars : [data];
    const list = loadCustom(); let n = 0;
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue;
      const d = normalizeCustom(raw), i = raw.id ? list.findIndex((o) => o.id === raw.id) : -1;
      if (i >= 0) list[i] = { ...d, id: raw.id };
      else { if (list.length >= MAX) break; list.push({ ...d, id: typeof raw.id === 'string' ? raw.id : newId() }); }
      n++;
    }
    saveCustom(list); renderList(); status(`Imported ${n} character${n === 1 ? '' : 's'}.`, n === 0);
  } catch (err) { status('That file is not character JSON.', true); }
};
addEventListener('storage', (e) => { if (e.key === null || e.key === 'isoCity.customChars.v1' || e.key === PLAYER_KEY) renderList(); if (e.key === null || e.key === OVERRIDE_KEY) renderCity(); });

$('#playDefault').onclick = () => { setPlayerChar(null); status('Back to the bald guy.'); renderList(); };
// go
changed(); renderList(); renderCity();
window.__creator = { get cur() { return cur; }, set cur(v) { cur = v; changed(); }, get ch() { return ch; }, get editingId() { return editingId; }, get editingCity() { return editingCity; }, renderList, renderCity, editCity, resetCity, save };
