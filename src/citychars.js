// The city's built-in characters as creator definitions + the per-character look overrides the
// creator saves (localStorage isoCity.charOverrides.v1 = { [key]: def }). npcs.js applies them live;
// the NPC keeps its role / special behaviour (Kimata's cap mission + hula, Mbappé's ball, Bad and French,
// the cop's police logic, the giver's missions, the bully's temper, Grandma's rescue).
// Pure data + helpers: no THREE, safe to import from the creator page.
export const OVERRIDE_KEY = 'isoCity.charOverrides.v1';
const loop = (cx, cz, L = 6.65) => [[cx - L, cz - L], [cx + L, cz - L], [cx + L, cz + L], [cx - L, cz + L]];

// The women of the neighbourhood: modular NPC looks (blue-grey base, palette clothes), names on hover, own lines.
export const WOMEN = [
  { seed: 1201, key: 'brenda', name: 'BRENDA', walk: { path: loop(33, 33, 7.15), start: 0, dir: -1, speed: 1.3, along: 0.5 },
    look: { outfit: 'dress', hair: 'ponytail', hairColor: '#292C2E', colors: { top: '#FF5491', accent: '#292C2E', shoe: '#292C2E' }, accessories: ['tote'], accColor: '#FFCC3F' },
    role: 'spy', chatLines: ['i see EVERYTHING.', 'the landlady pays me in cookies.', 'writing that down...'], lines: ['ew.', 'my husband is a cop. sort of.', 'not today, sweaty.', 'do i KNOW you?', 'move it, b*tch.'] },
  { seed: 1202, key: 'tiff', name: 'TIFF', walk: { path: loop(33, 0), start: 1, dir: 1, speed: 1.25, along: 0.5 },
    look: { outfit: 'blouse', hair: 'longStraight', hairColor: '#93616B', glasses: false, hat: 'none', accessories: ['headphones'] },
    plain: true },
  { seed: 1203, key: 'mrs-ito', name: 'MRS. ITO', walk: { path: loop(0, 0), start: 1, dir: 1, speed: 1.1, along: 0.2 },
    look: { outfit: 'cardigan', hair: 'bob', hairColor: '#363E47', glasses: true, colors: { top: '#A7BFA4', inner: '#F0F2F4', bottom: '#363E47', shoe: '#292C2E' }, height: 0.94 },
    plain: true },
  { seed: 1204, key: 'linda', name: 'LINDA', pos: [15.2, -6.2], face: [13.4, -6.1],
    look: { outfit: 'apron', hair: 'bun', hairColor: '#363E47', glasses: false },
    plain: true },
  { seed: 1205, key: 'grandma-fumiko', name: 'GRANDMA FUMIKO', pos: [12.7, 9.3], face: [8.0, 5.0],   // by the plaza bench next to the spawn crossing: easy to find when the cop is on you
    look: { outfit: 'cardigan', hair: 'bun', hairColor: '#F0F2F4', glasses: true, colors: { top: '#F8C0C5', inner: '#F0F2F4', bottom: '#292C2E', shoe: '#292C2E' }, height: 0.88, build: 0.95, accessories: ['tote'], accColor: '#A92D59' },
    role: 'oracle', chatLines: ['cop bothering you? come to grandma.', 'this week feels... familiar.', 'my hip says rain. again.', 'eat something, you noodle!', 'back in my day...'], lines: ["i'll hit you with my purse.", 'in trouble? hide behind grandma, dear.', 'back in my day we slapped HARDER', 'eat something, you look like a noodle', 'speak up, dummy!'] },
  { seed: 1206, key: 'kiko', name: 'KIKO', pos: [-18.6, 27.5], face: [-19.2, 26.6],
    look: { outfit: 'dress', hair: 'bob', hairColor: '#292C2E', colors: { top: '#00B4BC', accent: '#FFCC3F', shoe: '#F0F2F4' }, height: 0.95 },
    plain: true },
  { seed: 1207, key: 'rosa', name: 'ROSA', pos: [-6.4, -14.9], face: [-8, -14.9],
    look: { outfit: 'blazer', hair: 'curlyLong', hairColor: '#4C3F42', colors: { top: '#FF7DAF', inner: '#F0F2F4', bottom: '#292C2E' } },
    plain: true },
  { seed: 1208, key: 'doris', name: 'DORIS', pos: [-13.4, 19.6], face: [-12.6, 20.2],
    look: { outfit: 'coat', hair: 'braids', hairColor: '#4C3F42', glasses: false },
    plain: true },
  { seed: 1209, key: 'big-deb', name: 'BIG DEB', pos: [-12.6, 20.2], face: [-13.4, 19.6],
    look: { outfit: 'sweater', hair: 'ponytail', hairColor: '#292C2E', colors: { top: '#FFE166', bottom: '#2A5B94', shoe: '#F0F2F4' }, build: 1.3, height: 1.03 },
    role: 'deb', chatLines: ['who wants to arm wrestle?', 'i bench-pressed a bus once.', 'protein is a personality.'], lines: ['wanna arm wrestle? no? coward.', 'i eat guys like you for brunch', 'beat it, shrimp.', 'oh h*ll naw.'] },
];

export const COP_LINES = ['move along.', "i've got my eye on you, punk.", '*munch munch*', 'nothing to see here.', 'is that a donut? no? then beat it.'];

/** Editable city characters, in creator order (Kimata first). `special` = SPECIALS key in characters.js. */
export const CITY_ROSTER = [
  { key: 'syoya', name: 'KIMATA', special: 'syoya', note: 'Hula + cap mission stay. Clicked: he hulas (talk lines unused).' },
  { key: 'mbappe', name: 'MBAPPÉ', special: 'mbappe', note: 'Ball, Bad dance and French stay. The black 9 + kit trim are not creator parts (plain white tee).' },
  { key: 'bully', name: 'BULLY', special: 'bully', note: 'Stays aggressive. Angry brows are not a creator part.' },
  { key: 'grandma-fumiko', name: 'GRANDMA FUMIKO', woman: true, note: 'Still the oracle: hiding behind her calls the cop off.' },
  { key: 'cop', name: 'OFFICER DOUGH', special: 'cop', note: 'Police logic stays. Badges, belt, radio and donut are not creator parts.' },
  { key: 'giver', name: '??? (SHADY GUY)', special: 'giver', note: 'The shady guy IS the mission giver: missions stay. Popped collar approximated by the coat.' },
  ...WOMEN.filter((w) => w.key !== 'grandma-fumiko').map((w) => ({ key: w.key, name: w.name, woman: true,
    note: w.role === 'spy' ? 'The landlady\'s spy role stays.' : w.role === 'deb' ? 'Big Deb\'s role stays.' : '' })),
];
const SPECIAL_LOOK = (P, K) => ({   // the createNPC options the special builders in characters.js use
  giver: { seed: 4711, outfit: 'coat', hair: 'buzz', hairColor: P.black, glasses: false, hat: 'beanie', hatColor: P.black,
    colors: { top: K.warm[1], inner: P.black, bottom: P.black, shoe: P.black, accent: P.slate, shorts: false }, accessories: [], height: 1.0, build: 1.04 },
  bully: { seed: 666, outfit: 'tank', hair: 'buzz', hairColor: P.black, glasses: false, hat: 'none',
    colors: { top: K.pinks[1], inner: K.pinks[1], bottom: P.black, shoe: P.white, accent: P.black, shorts: true }, accessories: [], height: 1.1, build: 1.42 },
  cop: { seed: 9110, outfit: 'sweater', hair: 'buzz', hairColor: P.black, glasses: false, hat: 'cap', hatColor: K.blues[0],
    colors: { top: K.blues[1], inner: K.blues[1], bottom: K.blues[0], shoe: P.black, accent: P.black, shorts: false }, accessories: [], height: 1.02, build: 1.5 },
});

/** The original look of a city character as a creator definition (C = the characters.js module). */
export function cityBaseDef(key, C) {
  const P = C.PALETTE, K = C.COMIC, SL = SPECIAL_LOOK(P, K);
  const w = WOMEN.find((o) => o.key === key);
  let d;
  if (key === 'syoya') d = C.normalizeCustom({ ...structuredClone(C.KIMATA_STYLE), name: 'KIMATA', lines: ['aloha!', 'seen my cap?', 'hula is a lifestyle.'], home: 'fountain' });
  else if (key === 'mbappe') d = C.normalizeCustom({ gender: 'man', body: 'average', height: 1.02, skin: K.warm[1], hair: 'buzz', hairColor: P.black, hat: 'none',
    top: 'tee', topColor: P.white, innerColor: P.black, bottom: 'shorts', bottomColor: P.white, shoes: 'sneakers', shoeColor: P.black,
    acc: {}, held: 'none', dance: 'mbappe', name: 'MBAPPÉ', lines: ['oh là là !', 'on joue ?', 'allez, allez !'] });
  else if (key === 'giver') { d = C.npcLookToCustom(SL.giver, { name: '???', lines: ['psst.', 'wanna do something stupid?', 'i got a job. a dumb one.'] }); d.acc.sunglasses = true; d.shoes = 'boots'; }
  else if (key === 'bully') { d = C.npcLookToCustom(SL.bully, { name: 'BULLY', lines: ['what you lookin at?', 'move, nerd.', 'wanna go?!'] }); d.body = 'muscle'; }
  else if (key === 'cop') { d = C.npcLookToCustom(SL.cop, { name: 'OFFICER DOUGH', lines: COP_LINES.slice() }); d.acc.moustache = true; d.hairColor = P.black; d.shoes = 'boots'; }
  else if (w) d = C.npcLookToCustom({ seed: w.seed, ...w.look }, { gender: 'woman', name: w.name, ...(w.lines ? { lines: w.lines.slice() } : {}) });
  else return null;
  return d;
}
export const sameLines = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

export function loadOverrides() {
  try { const o = JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; }
}
export function saveOverride(key, def) { const o = loadOverrides(); o[key] = def; localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o)); }
export function clearOverride(key) { const o = loadOverrides(); delete o[key]; localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o)); }
