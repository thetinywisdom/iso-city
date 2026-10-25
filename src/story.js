// Story mode: "RENT'S DUE" (Phase B core). Title screen (STORY / FREE ROAM), a 7-day rent loop with paid jobs
// (2 a day), sleep at the Z on the spawn point, Day 5 / 6 glitches, the Day 7 reset + the choice card, and the
// oddity hunt ("THAT'S WEIRD!" [Q], 7 of 10 per loop). Free roam is the untouched sandbox.
// Saves to localStorage isoCity.story.v1. The hidden house + the 7:00 finale come in Phase C.
import * as THREE from 'three';
import { COMIC } from './palette.js?v=20261025h';

export const STORY_KEY = 'isoCity.story.v1';
export const RENT = 77777;
export const JOBS_PER_DAY = 2;
export const PAY = { 'slap-tour': 8800, rejected: 7700, bully: 12100, ball: 11000, cap: 9900 };
const MODE_KEY = 'isoCity.mode';          // sessionStorage: same-tab reloads skip the title
const SLEEP = { x: 0, z: 0, r: 1.1 };     // the Z sits on the spawn point
const yen = (v) => '¥' + Math.round(v).toLocaleString('en-US');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const { blues: B, pinks: K, teals: T, warm: W, neutrals: N, yellows: Y } = COMIC;

// ---- the two new faces ----
export const LANDLADY_DEF = { name: 'LANDLADY', gender: 'woman', body: 'fat', height: 0.85, skin: W[3], hair: 'bun', hairColor: N[2],
  top: 'cardigan', topColor: K[0], innerColor: K[3], bottom: 'dress', bottomColor: K[1], shoes: 'flats', shoeColor: N[0],
  acc: { glasses: true, sunglasses: false, moustache: false, beard: false, earrings: true, bag: false }, accColor: Y[1],
  held: 'none', dance: 'robot', lines: ['RENT!'] };
export const BRICK_DEF = { name: 'BRICK', gender: 'man', body: 'muscle', height: 1.12, skin: W[2], hair: 'buzz', hairColor: N[0],
  top: 'tank', topColor: Y[1], innerColor: N[4], bottom: 'shorts', bottomColor: B[0], shoes: 'sneakers', shoeColor: N[4],
  acc: { glasses: false, sunglasses: false, moustache: false, beard: true, earrings: false, bag: false }, accColor: N[0],
  held: 'none', dance: 'flex', lines: ['do you even lift?', 'leg day. every day.', 'protein is a personality.'] };
const BRICK_SPOT = { pos: [-10.2, 19.6], face: [-6.5, 16.5] };

// ---- Mbappé's story lines (french + english underneath) ----
const MB_LINES = {
  early: [['Encore toi? Tu bosses trop, mec.', 'you again? you work too much, man.'], ['Le loyer? Moi, on me paie pour courir.', 'rent? me, they pay me to run.']],
  5: [['Attends... tu m\'as déjà dit ça hier.', 'wait... you told me that yesterday.']],
  6: [['Le ciel... il est de quelle couleur, là?!', 'the sky... what colour is it right now?!']],
  loop: [['Déjà vu, mon pote. Déjà vu.', 'déjà vu, buddy. déjà vu.'], ['On a déjà vécu cette semaine, non?', 'haven\'t we lived this week already?']],
  noBall: [['Mon ballon? Bof. Qui a besoin d\'un ballon?', 'my ball? meh. who needs a ball?']],
};

export function initStory({ scene, camera, city, player, getNPCs, dialogue, combat, missions, police, pixel }) {
  const params = new URLSearchParams(location.search);
  let S = load();
  let mode = null;            // 'story' | 'free' | null (title up)
  let busy = false;           // a cutscene / card is up
  let story = null;           // live story-only objects (landlady, Brick, oddity props)
  const ui = buildUI();

  function fresh() { return { v: 1, day: 0, loop: 1, money: 0, jobs: 0, phase: 'intro', set: [], found: [], house: false, endings: [], mbDay: -1 }; }
  function load() { try { const s = JSON.parse(localStorage.getItem(STORY_KEY)); if (s && s.v === 1) return { ...fresh(), ...s }; } catch {} return null; }
  function persist() { if (S) try { localStorage.setItem(STORY_KEY, JSON.stringify(S)); } catch {} }

  // ================= UI =================
  function buildUI() {
    const root = document.createElement('div'); root.id = 'story';
    root.innerHTML = `
      <div id="story-title"><div class="st-box">
        <div class="st-logo">RENT'S DUE</div><div class="st-sub">7 DAYS. ${yen(RENT)}. ONE LANDLADY.</div>
        <div class="st-btns"><button class="mo-btn mo-yes st-cont">CONTINUE</button><button class="mo-btn mo-yes st-new">STORY</button><button class="mo-btn st-free">FREE ROAM</button></div>
        <div class="st-hint">CLICK TO WALK · HOLD TO SLAP · SPACE TO JUMP</div></div></div>
      <div id="story-hud"><div class="sh-day"></div><div class="sh-money"></div><div class="sh-jobs"></div></div>
      <button id="story-weird" class="mo-btn mo-yes">THAT'S WEIRD! [Q]</button>
      <div id="story-card"></div>
      <div id="story-fade"><div></div></div>
      <div id="story-tear"></div>
      <div id="story-z"></div>
      <button id="story-menu">MENU</button>`;
    document.body.appendChild(root);
    const $ = (s) => root.querySelector(s);
    for (const el of [$('#story-title'), $('#story-card'), $('#story-weird'), $('#story-menu'), $('#story-z')]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
    $('.st-new').addEventListener('click', () => { if (S && S.phase !== 'intro' && !confirmNew()) return; begin('story', true); });
    $('.st-cont').addEventListener('click', () => begin('story', false));
    $('.st-free').addEventListener('click', () => begin('free'));
    $('#story-weird').addEventListener('click', (e) => { e.stopPropagation(); weird(); });
    $('#story-menu').addEventListener('click', (e) => { e.stopPropagation(); showTitle(); });
    $('#story-z').addEventListener('click', (e) => { e.stopPropagation(); if (mode === 'story' && !busy) sleepPrompt(); });
    // pixel "Zz" sprite (comic palette, per-pixel)
    const zc = document.createElement('canvas'), rows = ['XXXXX.....', '...X......', '..X..XXX..', '.X.....X..', 'XXXXX.X...', '.....XXX..'];
    zc.width = rows[0].length; zc.height = rows.length; const zx = zc.getContext('2d');
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === 'X') { zx.fillStyle = j < 5 && i < 5 ? B[2] : B[1]; zx.fillRect(i, j, 1, 1); } }));
    zc.style.width = zc.width * 6 + 'px'; zc.style.height = zc.height * 6 + 'px'; $('#story-z').appendChild(zc);
    return { root, $, title: $('#story-title'), hud: $('#story-hud'), weird: $('#story-weird'), card: $('#story-card'), fade: $('#story-fade'), tear: $('#story-tear'), z: $('#story-z'), menu: $('#story-menu') };
  }
  function confirmNew() { return true; }   // a new story simply overwrites the save (the title shows CONTINUE first)
  function showTitle() {
    closeCard(); busy = false;
    ui.title.classList.add('on');
    ui.$('.st-cont').style.display = S && S.phase !== 'intro' ? '' : 'none';
    ui.$('.st-new').textContent = S && S.phase !== 'intro' ? 'NEW STORY' : 'STORY';
  }
  function hud() {
    const on = mode === 'story';
    ui.hud.classList.toggle('on', on); ui.menu.classList.toggle('on', !!mode); ui.z.classList.toggle('on', on && !busy);
    ui.weird.classList.toggle('on', on && S.phase === 'hunt');
    document.body.classList.toggle('story-on', on); document.body.classList.toggle('story-hunt', on && S.phase === 'hunt');
    if (!on) return;
    ui.$('.sh-day').textContent = `DAY ${S.day}` + (S.loop > 1 ? `  LOOP ${S.loop}` : '');
    ui.$('.sh-money').textContent = `${yen(S.money)} / ${yen(RENT)}`;
    const j = ui.$('.sh-jobs');
    if (S.phase === 'hunt' || S.phase === 'house') { j.textContent = `ODDITIES ${S.found.length}/7`; j.className = 'sh-jobs odd'; }
    else { j.textContent = `JOBS ${S.jobs}/${JOBS_PER_DAY}`; j.className = 'sh-jobs' + (S.jobs >= JOBS_PER_DAY ? ' done' : ''); }
  }
  // generic card: { head, lines[], buttons: [[label, fn, yes?]], cls }
  function card({ head, lines = [], buttons = [], cls = '' }) {
    busy = true; ui.card.className = 'on ' + cls; ui.card.innerHTML = '';
    const h = document.createElement('div'); h.className = 'sc-head'; h.textContent = head; ui.card.appendChild(h);
    for (const l of lines) { const d = document.createElement('div'); d.className = 'sc-line'; d.textContent = l; ui.card.appendChild(d); }
    const row = document.createElement('div'); row.className = 'sc-row';
    buttons.forEach(([label, fn, yes], i) => {
      const b = document.createElement('button'); b.className = 'mo-btn' + (yes ? ' mo-yes' : ''); b.textContent = label; b.dataset.i = i;
      b.addEventListener('click', (e) => { e.stopPropagation(); closeCard(); fn(); });
      row.appendChild(b);
    });
    ui.card.appendChild(row); hud();
    combat.hold(1e6);
    setTimeout(() => row.querySelector('.mo-yes, .mo-btn')?.focus(), 30);
  }
  function closeCard() { if (!ui.card.classList.contains('on')) return; ui.card.className = ''; ui.card.innerHTML = ''; busy = false; combat.hold(0); hud(); }
  function fadeTo(text, mid, ms = 1400) {
    busy = true; hud(); combat.hold(1e6);
    ui.fade.firstChild.textContent = text; ui.fade.className = 'on';
    setTimeout(() => { mid?.(); }, ms * 0.5);
    setTimeout(() => { ui.fade.className = 'on out'; }, ms);
    setTimeout(() => { ui.fade.className = ''; if (!ui.card.classList.contains('on')) { busy = false; combat.hold(0); } hud(); }, ms + 360);
  }
  function toast(t) { missions.toast(t); }

  // ================= mode switch =================
  function begin(m, isNew = false) {
    ui.title.classList.remove('on');
    try { sessionStorage.setItem(MODE_KEY, m); } catch {}
    if (m === 'free') { if (mode === 'story') { location.reload(); return; } mode = 'free'; hud(); return; }   // leaving a live story: reload into a clean sandbox
    if (!getNPCs()) { setTimeout(() => begin(m, isNew), 100); return; }   // the cast loads async
    if (isNew || !S) { S = fresh(); persist(); }
    mode = 'story'; setupStory(); hud();
    if (S.phase === 'intro') dayZero();
    else if (S.phase === 'choice') choiceCard();
    else fadeTo(`DAY ${S.day}`, null, 900);
  }
  function setupStory() {
    const npcs = getNPCs(); if (!npcs || story) return;
    const C = npcs.charMod;
    story = { npcs, odd: {} };
    // Brick: the muscle guy, a story-mode resident of the park lawn
    const b = npcs._wrap(C.createCustom({ ...BRICK_DEF, id: 'story-brick' }), 9101);
    Object.assign(b, { tag: 'BRICK', important: true, story: 'brick', lines: BRICK_DEF.lines.slice() });
    npcs._idleAt(b, BRICK_SPOT.pos, BRICK_SPOT.face); npcs.list.push(b); npcs.toonify?.(b.root); story.brick = b;
    applyOddities();
  }
  function spawnLandlady(x = 2.4, z = 2.4) {
    const npcs = getNPCs(); if (!npcs) return null;
    if (story.landlady) return story.landlady;
    const n = npcs._wrap(npcs.charMod.createCustom({ ...LANDLADY_DEF, id: 'story-landlady' }), 9001);
    Object.assign(n, { tag: 'LANDLADY', important: true, story: 'landlady', lines: ['RENT!'], walker: false, idleT: 0, temper: 'timid' });
    n.root.position.set(x, city.groundHeight(x, z) + 0.02, z);
    n.heading = n.root.rotation.y = Math.atan2(player.position.x - x, player.position.z - z);
    n.home = { x, z, heading: n.heading };
    npcs.list.push(n); npcs.toonify?.(n.root); story.landlady = n;
    return n;
  }
  function removeLandlady() {
    const n = story?.landlady; if (!n) return;
    const npcs = getNPCs(); n.root.removeFromParent(); n.removed = true;
    const i = npcs.list.indexOf(n); if (i >= 0) npcs.list.splice(i, 1);
    story.landlady = null;
  }
  function toSpawn() { player.position.set(city.spawn.x + 1.2, city.groundHeight(city.spawn.x + 1.2, city.spawn.z + 1.2) + 0.02, city.spawn.z + 1.2); player.vel?.set(0, 0, 0); zInside = true; }

  // ================= the day loop =================
  function dayZero() {
    S.day = 0; S.jobs = 0; persist(); hud(); toSpawn();
    const ll = spawnLandlady();
    dialogue.shout(ll, 'RENT!', 2600);
    const again = S.loop > 1;
    setTimeout(() => card({ head: again ? 'RENT\'S DUE. AGAIN?' : 'RENT\'S DUE', cls: 'notice',
      lines: again ? [`"${yen(RENT)}. 7 days. same as always, dear."`, 'wait. didn\'t she say that already?']
        : [`"${yen(RENT)}. You have 7 days."`, '"pay up, or ELSE."', 'the shady guy has odd jobs. 2 a day. sleep at the Z.'],
      buttons: [[again ? 'UGH. [ENTER]' : 'OK... [ENTER]', () => { removeLandlady(); S.phase = S.phase === 'intro' ? 'grind' : S.phase; nextDay(); }, true]] }), 700);
  }
  function nextDay(text) {
    fadeTo(text || `DAY ${S.day + 1}`, () => {
      S.day++; S.jobs = 0; toSpawn(); persist(); hud(); applyOddities();
      if (S.day >= 7) setTimeout(rentDay, 1300);
    });
  }
  let zInside = true;
  function sleepPrompt() {
    if (busy || mode !== 'story' || missions.active) { if (missions.active) toast('FINISH THE JOB FIRST'); return; }
    card({ head: 'SLEEP?', lines: [S.jobs < JOBS_PER_DAY && S.phase !== 'hunt' && S.phase !== 'house' ? `only ${S.jobs}/${JOBS_PER_DAY} jobs done today.` : 'good work today. probably.', `ends day ${S.day}.`],
      buttons: [['SLEEP [ENTER]', () => nextDay('Z Z Z'), true], ['NOT YET [ESC]', () => {}]] });
  }
  function rentDay() {
    const ll = spawnLandlady();
    dialogue.shout(ll, 'RENT! ' + yen(RENT) + '. NOW.', 3000);
    const enough = S.money >= RENT;
    card({ head: 'DAY 7: RENT DAY', cls: 'notice', lines: enough ? [`you've got ${yen(S.money)}. you can pay!`] : [`you've got ${yen(S.money)}. that's... not ${yen(RENT)}.`],
      buttons: [[enough ? `PAY ${yen(RENT)}` : `PAY ${yen(S.money)}`, reset, true]] });
  }
  function reset() {
    glitch(2); const lost = S.money;
    dialogue.shout(story.landlady, 'hehe. see you on day 0, dear.', 2400);
    setTimeout(() => {
      S.day = 0; S.money = 0; hud();
      card({ head: 'RESET', cls: 'bad', lines: ['the counter flips to 0.', `you wake up broke. your ${yen(lost)} is gone.`, 'same morning. same city.'],
        buttons: [['...WHAT? [ENTER]', afterReset, true]] });
    }, 900);
  }
  function afterReset() {
    removeLandlady();
    if (S.phase === 'grind') { S.phase = 'choice'; persist(); choiceCard(); return; }
    S.loop++;                                 // hunting (or past it): a new loop, a fresh set of oddities
    if (S.phase === 'hunt') { S.found = []; S.set = rollSet(); }
    persist(); dayZero();
  }
  function choiceCard() {
    card({ head: 'SAME JOBS. SAME LINES.', lines: ['everyone does the exact same thing. every day.', 'keep working, or... is this weird?'],
      buttons: [['KEEP WORKING', employeeEnding], ['THAT\'S WEIRD!', startHunt, true]] });
  }
  function employeeEnding() {
    if (!S.endings.includes('employee')) S.endings.push('employee');
    S.phase = 'grind'; S.loop++; persist();
    card({ head: 'EMPLOYEE OF THE MONTH', cls: 'ending', lines: ['ENDING 1 of 3', 'he grinds forever. the counter resets. the credits roll.', 'starring: you, the shady guy, and a very patient landlady.'],
      buttons: [['BACK TO WORK', dayZero], ['THAT\'S WEIRD!', startHunt, true], ['FREE ROAM', () => begin('free')]] });
  }
  function startHunt() {
    S.phase = 'hunt'; S.loop = Math.max(2, S.loop); S.found = []; S.set = rollSet(); persist();
    card({ head: 'THAT\'S WEIRD!', lines: ['7 things in this loop are wrong.', 'go up close and press Q (or THAT\'S WEIRD!).', 'find all 7 before day 7.'],
      buttons: [['LET\'S GO [ENTER]', () => dayZero(), true]] });
  }

  // ================= jobs: hooks into missions.js =================
  missions.hooks.canOffer = () => {
    if (mode !== 'story') return true;
    if (busy) return 'not now.';
    if (S.jobs >= JOBS_PER_DAY) return pick(['that\'s enough for today. go sleep.', 'two jobs a day, kid. go SLEEP.', 'come back tomorrow. same jobs. obviously.']);
    return true;
  };
  missions.hooks.onComplete = (def, banner) => {
    if (mode !== 'story') return;
    const pay = PAY[def.id] || 8000;
    S.money += pay; S.jobs++; persist(); hud();
    const sub = banner?.querySelector('.mb-sub');
    if (sub) sub.textContent = `+${yen(pay)}` + (S.jobs >= JOBS_PER_DAY ? '  DONE FOR TODAY. SLEEP AT THE Z' : '  ONE MORE JOB TODAY');
  };
  // ---- busted: a night in the cell, then the next morning ----
  police.hooks.onOver = (over) => {
    const t = over.querySelector('.go-title'), s = over.querySelector('.go-sub'), b = over.querySelector('.go-btn');
    if (mode === 'story') { t.textContent = 'BUSTED'; s.textContent = 'A NIGHT IN THE CELL'; b.textContent = 'NEXT MORNING'; }
    else { t.textContent = 'GAME OVER'; s.textContent = 'BUSTED BY OFFICER DOUGH'; b.textContent = 'START AGAIN?'; }
  };
  police.hooks.onRestart = () => {
    if (mode !== 'story') return false;
    missions.active && missions.abort();
    nextDay('A NIGHT IN THE CELL');
    return true;
  };

  // ================= dialogue: Mbappé's story lines, polite bully, rude "hi" =================
  const prevClick = dialogue.onClick;
  dialogue.onClick = (n) => {
    if (mode === 'story' && busy) return true;
    if (mode === 'story' && n.special === 'mbappe' && !n.mode && !n.c.dancing) {
      const key = S.loop * 10 + S.day;
      if (on('mbappe') || S.mbDay !== key) {
        S.mbDay = key; persist();
        const pool = on('mbappe') ? MB_LINES.noBall : S.loop > 1 ? MB_LINES.loop : S.day === 5 ? MB_LINES[5] : S.day === 6 ? MB_LINES[6] : MB_LINES.early;
        dialogue.show(n, pick(pool), 3200); getNPCs()?.talk(n, 3, player.position);
        return true;
      }
    }
    if (mode === 'story' && n.story === 'landlady') { dialogue.shout(n, 'RENT!', 1600); return true; }
    return prevClick?.(n);
  };
  const prevPick = dialogue.pickLine;
  dialogue.pickLine = (n) => {
    if (mode === 'story') {
      if (n.special === 'bully' && on('bully')) return pick(['please may i slap you? thank you.', 'pardon me. thank you kindly.', 'please. and thank you.']);
      if (on('rude') && n.temper === 'aggressive' && !n.special && !n.important) return 'hi.';
      if (n.story === 'brick' && on('brick')) return pick(['where did it all go...', 'i skipped ONE leg day.', 'my gains... gone.']);
      if (S.day === 5 && Math.random() < 0.25 && n.lastLine) return n.lastLine;   // déjà vu: the same line again
    }
    return prevPick?.(n) || null;
  };

  // ================= oddities =================
  const ODD = {
    tree: { name: 'UPSIDE-DOWN TREE', pos: () => story.odd.tree?.position, r: 4.5 },
    brick: { name: 'BRICK LOST HIS MUSCLE', pos: () => story.brick?.root.position, r: 4 },
    mbappe: { name: 'MBAPPÉ HAS NO BALL', pos: () => sp('mbappe')?.root.position, r: 4 },
    kimata: { name: 'KIMATA HULAS WITH NO RING', pos: () => sp('syoya')?.root.position, r: 4.5 },
    bully: { name: 'A POLITE BULLY', pos: () => sp('bully')?.root.position, r: 4 },
    fountain: { name: 'THE FOUNTAIN FLOWS UP', pos: () => FOUNTAIN, r: 5 },
    backwards: { name: 'WALKING BACKWARDS', pos: () => story.back?.root.position, r: 4 },
    rude: { name: 'THE RUDE ONES JUST SAY "HI"', pos: () => nearestRude(), r: 3.5 },
    banana: { name: 'OFFICER DOUGH EATS A BANANA', pos: () => sp('cop')?.root.position, r: 4 },
    shady: { name: 'THE SHADY GUY FACES THE WALL', pos: () => sp('giver')?.root.position, r: 4 },
  };
  const ODD_IDS = Object.keys(ODD);
  const FOUNTAIN = new THREE.Vector3(-21.5, 0, 21.5);
  const TREE_AT = [12.6, -5.6];
  const sp = (k) => getNPCs()?.list.find((n) => n.special === k);
  function nearestRude() {
    let best = null, bd = Infinity;
    for (const n of getNPCs()?.list || []) if (n.temper === 'aggressive' && !n.special && !n.important && !n.removed) { const d = n.root.position.distanceTo(player.position); if (d < bd) { bd = d; best = n.root.position; } }
    return best;
  }
  function rollSet() { const a = ODD_IDS.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, 7); }
  function on(id) { return mode === 'story' && S && S.phase === 'hunt' && S.set.includes(id) && !S.found.includes(id); }
  function applyOddities() {
    if (!story) return;
    const npcs = story.npcs, C = npcs.charMod;
    // tree
    if (on('tree') && !story.odd.tree) { story.odd.tree = upsideDownTree(); scene.add(story.odd.tree); npcs.toonify?.(story.odd.tree); }
    if (!on('tree') && story.odd.tree) { story.odd.tree.removeFromParent(); story.odd.tree = null; }
    // Brick: muscle <-> skinny
    const want = on('brick') ? 'skinny' : 'muscle';
    if (story.brick && story.brick._body !== want) { npcs._swapModel(story.brick, C.createCustom({ ...BRICK_DEF, body: want, id: 'story-brick' })); story.brick._body = want; }
    // Mbappé's ball
    const m = sp('mbappe'); if (m?.ball) m.ball.visible = !on('mbappe') || missions.active?.id === 'ball';
    // Kimata's ring
    const k = sp('syoya'); if (k?.c.ring) k.c.ring.visible = !on('kimata');
    // fountain spray
    if (on('fountain') && !story.odd.fountain) { story.odd.fountain = upwardSpray(); scene.add(story.odd.fountain); }
    if (!on('fountain') && story.odd.fountain) { story.odd.fountain.removeFromParent(); story.odd.fountain = null; }
    // backwards walker
    if (on('backwards') && !story.back) story.back = npcs.list.find((n) => n.walker && !n.special && !n.important && !n.custom) || null;
    if (!on('backwards') && story.back) { story.back.c.root.rotation.y = 0; story.back = null; }
    // cop banana
    const cop = sp('cop');
    if (cop) {
      const donut = cop.c.parts?.wristR?.children.filter((o) => o.isMesh && o.geometry?.type === 'TorusGeometry') || [];
      const b = on('banana');
      for (const d of donut) d.visible = !b;
      if (b && !cop._banana && cop.c.parts?.wristR) { cop._banana = bananaMesh(); cop.c.parts.wristR.add(cop._banana); npcs.toonify?.(cop._banana); }
      if (cop._banana) cop._banana.visible = b;
    }
    // shady guy: back turned (handled per frame)
    const g = sp('giver'); if (g && !on('shady')) g.c.root.rotation.y = 0;
  }
  function upsideDownTree() {
    const g = new THREE.Group(), x = TREE_AT[0], z = TREE_AT[1], y0 = city.groundHeight(x, z);
    const M = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), M(N[3])); crown.position.set(0, 0.55, 0); crown.scale.set(1.2, 0.8, 1.2); g.add(crown);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 1.7, 8), M(T[0])); trunk.position.set(0, 1.9, 0); g.add(trunk);
    for (const [a, l] of [[0.6, 0.7], [2.4, 0.6], [4.2, 0.65]]) {   // roots in the air
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, l, 6), M(T[0]));
      r.position.set(Math.cos(a) * 0.22, 2.85, Math.sin(a) * 0.22); r.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8); g.add(r);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(x, y0, z); return g;
  }
  function upwardSpray() {   // water drops climbing out of the fountain into the sky
    const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: B[3] }), mat2 = new THREE.MeshBasicMaterial({ color: B[2] }), geo = new THREE.BoxGeometry(0.14, 0.22, 0.14);
    for (let i = 0; i < 26; i++) { const d = new THREE.Mesh(geo, i % 3 ? mat : mat2); d.userData = { a: i * 2.4, r: 0.15 + (i % 4) * 0.12, ph: i / 26 }; g.add(d); }
    g.position.set(FOUNTAIN.x, city.groundHeight(FOUNTAIN.x, FOUNTAIN.z) + 1.9, FOUNTAIN.z); g.userData.spray = true; return g;
  }
  function bananaMesh() {
    const g = new THREE.Group(), M = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.04), M(i === 1 ? Y[1] : Y[2])); s.position.set(-0.02, -0.06 - i * 0.05, 0.03 + Math.sin(i * 0.9) * 0.03); s.rotation.x = 0.4 - i * 0.4; g.add(s); }
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.02), M(W[0])); tip.position.set(-0.02, -0.02, 0.02); g.add(tip);
    return g;
  }
  let weirdCd = 0;
  function weird() {
    if (mode !== 'story' || S.phase !== 'hunt' || busy || weirdCd > performance.now()) return;
    weirdCd = performance.now() + 700;
    let best = null, bd = Infinity;
    for (const id of S.set) {
      if (S.found.includes(id)) continue;
      const p = ODD[id].pos(); if (!p) continue;
      const d = Math.hypot(p.x - player.position.x, p.z - player.position.z);
      if (d < ODD[id].r && d < bd) { bd = d; best = id; }
    }
    if (!best) { toast(pick(['HMM. NOPE, THAT\'S NORMAL.', 'LOOKS NORMAL. SUSPICIOUSLY.', 'NOTHING WEIRD HERE.'])); return; }
    const p = ODD[best].pos().clone(); p.y += 1.6;
    combat.burstAt?.(p, 'WEIRD!'); combat.audio?.thud?.();
    S.found.push(best); persist(); applyOddities(); hud();
    toast(`${ODD[best].name}  ${S.found.length}/7`);
    if (S.found.length >= 7) setTimeout(houseTeaser, 1300);
  }
  function houseTeaser() {
    S.phase = 'house'; S.house = true; persist(); hud();
    card({ head: '7/7 ODDITIES', cls: 'ending', lines: ['somewhere across town, a door creaks open.', 'the landlady\'s hidden house is out there.', '(CHAPTER 7: THE HOUSE. COMING NEXT UPDATE)'],
      buttons: [['OK [ENTER]', () => {}, true]] });
  }

  // ================= glitches (day 5 small, day 6 big) =================
  let glitchT = 8, skyT = 0;
  const BG = scene.background?.isColor ? scene.background : null, SKY0 = BG ? BG.clone() : null;   // recolour in place: pixel.js swaps scene.background mid-frame
  const FOG = scene.fog?.color || null, FOG0 = FOG ? FOG.clone() : null;
  const SKIES = [K[3], Y[2], B[3], T[3], W[3]].map((c) => new THREE.Color(c));
  function glitch(level) {
    const cv = document.querySelector('#app canvas'); if (!cv) return;
    let i = 0; const steps = level > 1 ? 8 : 5;
    const iv = setInterval(() => {
      cv.style.translate = i < steps ? `${(i % 2 ? -1 : 1) * 3 * (level > 1 ? 2 : 1)}px ${(i % 3) * 3 - 3}px` : '';
      if (++i > steps) clearInterval(iv);
    }, 60);
    if (level > 1) {   // tear bands + a sky that flips colour
      ui.tear.innerHTML = '';
      for (let k = 0; k < 4; k++) { const d = document.createElement('div'); d.style.top = Math.round(Math.random() * 90) + '%'; d.style.height = (3 * (2 + Math.floor(Math.random() * 6))) + 'px'; d.style.background = pick([K[1], B[2], Y[1], T[2], N[0]]); d.style.translate = `${(Math.random() < 0.5 ? -1 : 1) * 3 * Math.floor(2 + Math.random() * 8)}px 0`; ui.tear.appendChild(d); }
      ui.tear.className = 'on'; setTimeout(() => (ui.tear.className = ''), 260);
      if (BG) { const c = pick(SKIES); BG.copy(c); FOG?.copy(c); skyT = performance.now() + 1600; }
    }
  }
  function glitchTick(dt) {
    if (mode !== 'story' || busy || (S.day !== 5 && S.day !== 6)) return;
    glitchT -= dt;
    if (glitchT > 0) return;
    glitchT = S.day === 5 ? 14 + Math.random() * 8 : 8 + Math.random() * 5;
    glitch(S.day === 6 ? 2 : 1);
    if (S.day === 5) {   // someone near you says the same thing three times
      const n = (getNPCs()?.list || []).filter((o) => !o.mode && !o.special && o.root.position.distanceTo(player.position) < 14)[0];
      if (n) { const l = n.lastLine || 'nice weather.'; dialogue.show(n, `${l} ${l} ${l}`, 2600); }
    }
  }

  // ================= per frame =================
  const tmp = new THREE.Vector3();
  let last = performance.now();
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => {
    prev.apply(scene, a);
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (skyT && now >= skyT && BG) { skyT = 0; BG.copy(SKY0); if (FOG) FOG.copy(FOG0); }
    if (mode !== 'story') return;
    glitchTick(dt);
    // Z on the spawn point (screen space, art-pixel snapped)
    const g = pixel && pixel.enabled ? pixel.scale : 1, cv = document.querySelector('#app canvas');
    tmp.set(SLEEP.x, city.groundHeight(SLEEP.x, SLEEP.z) + 1.6 + Math.round(Math.sin(now / 400)) * 0.12, SLEEP.z).project(camera);
    if (cv) { const x = Math.round(((tmp.x + 1) / 2 * cv.clientWidth) / g) * g, y = Math.round(((1 - tmp.y) / 2 * cv.clientHeight) / g) * g; ui.z.style.transform = `translate(${x - 30}px, ${y - 18}px)`; }
    const d = Math.hypot(player.position.x - SLEEP.x, player.position.z - SLEEP.z);
    if (d < SLEEP.r && !zInside && !busy && !missions.active) { zInside = true; sleepPrompt(); }
    else if (d > SLEEP.r + 0.6) zInside = false;
    // oddity animation
    if (story) {
      if (story.back) story.back.c.root.rotation.y = Math.PI;
      const gv = sp('giver'); if (gv && on('shady')) gv.c.root.rotation.y = Math.PI;
      const k = sp('syoya'); if (k && on('kimata') && !k.c.dancing && !k.mode && !busy) story.npcs.dance?.(k, player.position);
      if (story.odd.fountain) for (const o of story.odd.fountain.children) { const u = o.userData, t = (now / 1400 + u.ph) % 1; o.position.set(Math.cos(u.a + t) * u.r * (1 - t), t * 7, Math.sin(u.a + t) * u.r * (1 - t)); o.visible = t < 0.96; }
      if (story.landlady && !story.landlady.mode) story.landlady.targetHeading = Math.atan2(player.position.x - story.landlady.root.position.x, player.position.z - story.landlady.root.position.z);
    }
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyQ' && !e.repeat && mode === 'story') { weird(); return; }
    if (!ui.card.classList.contains('on')) return;
    const bs = [...ui.card.querySelectorAll('button')];
    if (e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); (bs.find((b) => b.classList.contains('mo-yes')) || bs[0])?.click(); }
    else if (e.code === 'Escape' && bs.length > 1) { e.preventDefault(); e.stopPropagation(); bs[bs.length - 1].click(); }
  }, true);

  // ================= start =================
  function boot() {
    const qm = params.get('mode');
    let m = qm === 'story' || qm === 'free' ? qm : null;
    if (!m) try { m = sessionStorage.getItem(MODE_KEY); } catch {}
    if (!m && navigator.webdriver) m = 'free';   // automated test runs: straight into the sandbox
    if (m === 'free') begin('free');
    else if (m === 'story') begin('story', params.get('new') === '1');
    else showTitle();
  }
  // story needs the NPC list; the title can go up straight away
  boot();
  hud();

  return {
    get mode() { return mode; }, get state() { return S; }, get busy() { return busy; }, ODD, PAY, RENT,
    begin, showTitle, weird, nextDay, sleepPrompt, glitch, applyOddities, closeCard, rentDay,
    get story() { return story; }, el: ui,
    debug: { set(patch) { Object.assign(S, patch); persist(); applyOddities(); hud(); } },
  };
}
