// Shared bits for the character creator (creator.html) and the city: storage + named home spots.
export const STORE_KEY = 'isoCity.customChars.v1';
// Named places a custom character hangs out at (idle there, chat with neighbours). 'stroll' walks the block.
export const HOMES = {
  fountain: { label: 'Fountain plaza', pos: [-19.2, 19.6], face: [-21.5, 21.5] },
  lawn: { label: 'Park lawn', pos: [-11.8, 23.6], face: [-14.5, 22.0] },
  busstop: { label: 'Bus stop', pos: [12.2, -6.2], face: [13.4, -6.1] },
  crossing: { label: 'Spawn crossing', pos: [-3.2, 3.4], face: [0, 0] },
  tower: { label: 'Teal tower', pos: [-6.4, -12.6], face: [-8, -13.0] },
  fruit: { label: 'Fruit stand', pos: [-10.6, 17.6], face: [-12.2, 19.2] },
  stroll: { label: 'Strolls the block', walk: true },
};
// Built into the game: every player sees them. Kept exact from the user's export.
export const BUILTIN_CHARS = [
  {
    v: 1, name: 'NAYEON', gender: 'man', body: 'skinny', height: 0.97, skin: '#F1CDC3',
    hair: 'ponytail', hairColor: '#93616B', hat: 'none', hatColor: '#F9F0F1',
    top: 'sweater', topColor: '#A92D59', innerColor: '#F1CDC3', bottom: 'skirt', bottomColor: '#A8ECF2',
    shoes: 'boots', shoeColor: '#FFCC3F',
    acc: { glasses: false, sunglasses: true, moustache: false, beard: false, earrings: true, bag: true },
    accColor: '#FF5491', held: 'umbrella', heldColor: '#DBF5FE',
    lines: ['Pop, pop!', 'One in a million!', 'Living my best life.'],
    bubble: 'Once? or Twice?', dance: 'flail', home: 'stroll', id: 'cmvnkdzlxi20h',
  },
  {
    v: 1, name: 'FELI', gender: 'woman', body: 'average', height: 0.9, skin: '#F1CDC3',
    hair: 'longStraight', hairColor: '#292C2E', hat: 'cap', hatColor: '#3B7EE1',
    top: 'none', topColor: '#203A57', innerColor: '#203A57', bottom: 'dress', bottomColor: '#203A57',
    shoes: 'sneakers', shoeColor: '#ED8F02',
    acc: { glasses: false, sunglasses: false, moustache: false, beard: false, earrings: false, bag: true },
    accColor: '#ED8F02', held: 'shopping', heldColor: '#3B7EE1',
    lines: ['Nyahaha', 'I have a theory', 'Mon?'],
    bubble: 'イケメン大好き', dance: 'disco', home: 'fountain', id: 'cmvnkmzoqam8p',
  },
  {
    v: 1, name: 'KOTARO', gender: 'man', body: 'average', height: 1.1, skin: '#FCF0ED',
    hair: 'spiky', hairColor: '#FFF3C1', hat: 'none', hatColor: '#2A5B94',
    top: 'tee', topColor: '#5B6A7B', innerColor: '#DBF5FE', bottom: 'pants', bottomColor: '#203A57',
    shoes: 'sneakers', shoeColor: '#292C2E',
    acc: { glasses: false, sunglasses: false, moustache: false, beard: false, earrings: false, bag: false },
    accColor: '#FF5491', held: 'none', heldColor: '#FF5491',
    lines: ['Asaka Kotaro イムニダ', 'Hi', 'ハローマイネームイスコウタロウ'],
    bubble: 'ハトめっちゃ好き', dance: 'chicken', home: 'fountain', id: 'cmvnktp6giaph',
  },
  {
    v: 1, name: 'BRIAN', gender: 'man', body: 'average', height: 1.02, skin: '#F1CDC3',
    hair: 'buzz', hairColor: '#363E47', hat: 'backcap', hatColor: '#198085',
    top: 'tee', topColor: '#EFFAFA', innerColor: '#F0F2F4', bottom: 'pants', bottomColor: '#203A57',
    shoes: 'sneakers', shoeColor: '#A7BFA4',
    acc: { glasses: true, sunglasses: false, moustache: false, beard: false, earrings: false, bag: false },
    accColor: '#292C2E', held: 'skateboard', heldColor: '#4C3F42',
    lines: ['I made this game', 'You dumb', 'Tanga yawa', 'Bapak lo jelek', 'Muka lu berminyak'],
    bubble: 'I miss my wife', dance: 'mbappe', home: 'fountain', id: 'cmvv5u4oo8ga7',
  },
];
const builtinIds = () => new Set(BUILTIN_CHARS.map((c) => c.id));
const builtinNames = () => new Set(BUILTIN_CHARS.map((c) => String(c.name || '').toUpperCase()));
export function isBuiltinChar(d) {
  if (!d) return false;
  if (typeof d === 'string') return builtinIds().has(d);
  return builtinIds().has(d.id) || builtinNames().has(String(d.name || '').toUpperCase());
}
function loadStored() {
  try {
    const a = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    return Array.isArray(a) ? a.filter((d) => d && typeof d === 'object') : [];
  } catch { return []; }
}
/** Built-ins first, then the player's saved ones (skipping any that match a built-in id or name). */
export function loadCustom() {
  const ids = builtinIds(), names = builtinNames();
  const extras = loadStored().filter((d) => d && !ids.has(d.id) && !names.has(String(d.name || '').toUpperCase()));
  return [...BUILTIN_CHARS.map((c) => ({ ...c, acc: { ...c.acc } })), ...extras];
}
// Which saved character the player plays as (null = the default bald guy).
export const PLAYER_KEY = 'isoCity.playerChar.v1';
export function getPlayerChar() {
  try { const v = JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null'); return v && typeof v.id === 'string' ? v.id : null; } catch { return null; }
}
export function setPlayerChar(id) {
  try { if (id) localStorage.setItem(PLAYER_KEY, JSON.stringify({ id })); else localStorage.removeItem(PLAYER_KEY); } catch {}
}
/** The saved design the player is playing as, or null (default guy / deleted design). */
export function playerCharDef() { const id = getPlayerChar(); return id ? loadCustom().find((d) => d.id === id) || null : null; }
/** Write only user-made characters; built-ins stay in the source. */
export function saveCustom(list) {
  const ids = builtinIds(), names = builtinNames();
  const only = (Array.isArray(list) ? list : []).filter((d) => d && !ids.has(d.id) && !names.has(String(d.name || '').toUpperCase()));
  localStorage.setItem(STORE_KEY, JSON.stringify(only));
}
export const newId = () => 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
// Seeded variety pedestrians built from the creator's options (plain, generic lines).
export const VARIETY = [
  { seed: 9001, over: { held: 'guitar', body: 'average' }, pos: [-16.6, 19.4], face: [-21.5, 21.5] },
  { seed: 9002, over: { held: 'dog' }, walk: { c: [0, 33], L: 7.15, start: 2, dir: 1, speed: 1.2 } },
  { seed: 9003, over: { held: 'skateboard', body: 'skinny' }, walk: { c: [33, 0], L: 6.65, start: 0, dir: -1, speed: 1.6 } },
  { seed: 9004, over: { held: 'boombox', body: 'muscle' }, pos: [8.6, 7.2], face: [6.6, 6.6] },
  { seed: 9005, over: { held: 'balloon', body: 'fat' }, pos: [-25.0, 18.6], face: [-21.5, 21.5] },
  { seed: 9006, over: { held: 'umbrella' }, walk: { c: [33, 33], L: 6.65, start: 1, dir: -1, speed: 1.25 } },
  { seed: 9007, over: { held: 'coffee' }, pos: [14.4, -7.4], face: [13.4, -6.1] },
];
