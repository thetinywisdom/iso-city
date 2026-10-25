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
export function loadCustom() {
  try {
    const a = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    return Array.isArray(a) ? a.filter((d) => d && typeof d === 'object') : [];
  } catch { return []; }
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
export function saveCustom(list) { localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
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
