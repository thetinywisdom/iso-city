// Idle small talk: NPCs standing close together take turns with little chat bubbles.
// Groups are found every half second; each group has its own turn clock. Paused while the player
// is talking to someone nearby so real dialogue is never covered.
const OPEN = ['did you SEE what brenda wore?', 'my cat has a lawyer now', 'i only eat beige food', 'that bald guy slaps people',
  'rent is HOW much?!', 'i farted in the elevator. twice.', 'my ex is a magician. poof.', "don't look now... baldy.",
  'is it lunch yet?', 'my therapist quit on me', 'i licked a bus pole once', 'the cop eats 12 donuts a day',
  'the bully cried at a movie', 'my hips do NOT lie', 'i googled myself. 0 results.', 'my mom says i am cool'];
const REPLY = ['shut UP.', 'no WAY.', 'lol', 'sameee', 'wait what?', 'i KNOW right?!', 'ew.', 'bless your heart.',
  'ugh, men.', "that's illegal", 'mood.', 'tell me more...', 'GIRL.', 'b*tch, same.', 'i hate it here', 'huh.'];
const R = 2.3, SHOW_MS = 2300;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function initChatter({ scene, player, getNPCs, dialogue }) {
  const groups = new Map();   // key -> { members, turn, t, open }
  let scanT = 0, last = performance.now();
  const state = { lines: 0, groups: 0, paused: 0 };
  const idle = (n) => !n.walker && !n.special && !n.mode && !n.down && !n.stagger && !n.c.dancing && !(n.talkT > 0) && !n.party && !n.spectator;
  function scan() {
    const list = getNPCs()?.list.filter(idle) || [];
    const parent = new Map(list.map((n) => [n, n]));
    const find = (n) => { while (parent.get(n) !== n) n = parent.get(n); return n; };
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i].root.position, b = list[j].root.position;
      if (Math.hypot(a.x - b.x, a.z - b.z) < R) parent.set(find(list[i]), find(list[j]));
    }
    const sets = new Map();
    for (const n of list) { const r = find(n); if (!sets.has(r)) sets.set(r, []); sets.get(r).push(n); }
    const seen = new Set();
    for (const members of sets.values()) {
      if (members.length < 2) continue;
      members.sort((a, b) => a.seed - b.seed);
      const key = members.map((m) => m.seed).join(',');
      seen.add(key);
      if (!groups.has(key)) groups.set(key, { members, turn: Math.floor(Math.random() * members.length), t: 0.6 + Math.random() * 2.5, open: true });
    }
    for (const k of [...groups.keys()]) if (!seen.has(k)) groups.delete(k);
    state.groups = groups.size;
  }
  const busyNear = (g) => {   // someone near this group has a real (non-chat) bubble, e.g. the player is talking to them
    for (const [n, b] of dialogue.bubbles) {
      if (b.chat) continue;
      const q = n.root.position;
      if (g.members.some((m) => Math.hypot(m.root.position.x - q.x, m.root.position.z - q.z) < 3.5)) return true;
    }
    return false;
  };
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => {
    prev.apply(scene, a);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!getNPCs()) return;
    if ((scanT -= dt) <= 0) { scanT = 0.5; scan(); }
    for (const g of groups.values()) {
      if ((g.t -= dt) > 0) continue;
      if (busyNear(g)) { g.t = 1; state.paused++; continue; }
      const n = g.members[g.turn % g.members.length];
      if (idle(n) && dialogue.chat(n, pick(g.open ? OPEN : REPLY), SHOW_MS)) { state.lines++; g.open = !g.open || g.members.length > 2 && Math.random() < 0.3; }
      g.turn++; g.t = 2.6 + Math.random() * 1.2;
    }
  };
  return { state, groups, scan };
}
