// One in-game menu (Esc or the MENU button): CONTROLS · CHARACTERS · CREATOR. The game pauses while it is open.
import { loadCustom, setPlayerChar, playerCharDef } from './customchars.js?v=20261031i';

const CONTROLS = [
  ['MOUSE', '— the main controls —'],
  ['CLICK GROUND', 'walk there'], ['CLICK PERSON', 'talk (far away: walk up first)'], ['DOUBLE-CLICK PERSON', 'push'],
  ['HOLD CLICK ON PERSON', 'slap'], ['RIGHT-CLICK PERSON', 'menu: dance-off, push, slap, fart'], ['RIGHT-CLICK GROUND', 'drop a banana'],
  ['CLICK CAT', 'pet'], ['CLICK TRASH BIN', 'hide in / climb out'], ['WHEEL', 'zoom'],
  ['KEYBOARD', '— still works too —'],
  ['WASD / ARROWS', 'walk'], ['SHIFT', 'run'], ['SPACE', 'jump'], ['B', 'drop a banana'], ['E', 'pet cat / hide in bin'],
  ['Q', "that's weird! (story; also in the right-click menu)"], ['F', 'slap (story finale)'], ['ENTER', 'ok / accept'], ['C', 'character creator'], ['ESC', 'this menu'],
];

export function initGameMenu({ onPick, getStory, onOpen }) {
  const root = document.createElement('div');
  root.id = 'game-menu';
  root.innerHTML = `<div class="gm-box" role="dialog" aria-label="Menu">
    <div class="gm-top"><span class="gm-h">MENU · PAUSED</span><button class="gm-x" title="Close (Esc)">✕</button></div>
    <div class="gm-tabs"><button data-tab="controls">CONTROLS</button><button data-tab="chars">CHARACTERS</button><button data-tab="creator">CREATOR</button><button class="gm-title" data-act="title">TITLE SCREEN</button></div>
    <div class="gm-pane" data-pane="controls"><table class="gm-keys">${CONTROLS.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v}</td></tr>`).join('')}</table></div>
    <div class="gm-pane" data-pane="chars"><p class="gm-note">WHO YOU PLAY AS. MAKE MORE IN THE CREATOR TAB.</p><div class="gm-chars"></div></div>
    <div class="gm-pane" data-pane="creator"><div class="gm-frame"></div><p class="gm-note">saved in this browser. <a href="creator.html" target="isoCityCreator">open in its own tab</a></p></div>
  </div>`;
  document.body.appendChild(root);
  const btn = document.createElement('button');
  btn.id = 'menuBtn'; btn.textContent = 'MENU [ESC]'; btn.title = 'Controls, characters, creator';
  document.body.appendChild(btn);
  for (const el of [root, btn]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
  const $ = (s) => root.querySelector(s);
  let open = false, tab = 'controls';

  function renderChars() {
    const cur = playerCharDef()?.id || null, list = [{ id: null, name: 'BALD GUY' }, ...loadCustom()];
    const host = $('.gm-chars'); host.innerHTML = '';
    for (const d of list) {
      const b = document.createElement('button');
      b.className = 'gm-char' + ((d.id || null) === cur ? ' on' : '');
      b.textContent = String(d.name || 'NO NAME').toUpperCase() + ((d.id || null) === cur ? '  (YOU)' : '');
      b.addEventListener('click', () => { setPlayerChar(d.id || null); onPick?.(); renderChars(); });
      host.appendChild(b);
    }
  }
  function show(t) {
    tab = t || tab;
    for (const b of root.querySelectorAll('.gm-tabs [data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
    for (const p of root.querySelectorAll('.gm-pane')) p.classList.toggle('on', p.dataset.pane === tab);
    if (tab === 'chars') renderChars();
    if (tab === 'creator' && !$('.gm-frame iframe')) {
      const f = document.createElement('iframe'); f.src = 'creator.html?embed=1'; f.title = 'Character creator'; $('.gm-frame').appendChild(f);
    }
    $('.gm-title').style.display = getStory?.() ? '' : 'none';
  }
  function openMenu(t) { open = true; onOpen?.(); root.classList.add('on'); document.body.classList.add('paused'); show(t); }
  function close() { open = false; root.classList.remove('on'); document.body.classList.remove('paused'); btn.blur(); }
  root.querySelectorAll('.gm-tabs [data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  $('.gm-x').addEventListener('click', close);
  $('.gm-title').addEventListener('click', () => { close(); getStory?.()?.showTitle?.(); });
  btn.addEventListener('click', (e) => { e.preventDefault(); open ? close() : openMenu(); });
  addEventListener('storage', () => { if (open && tab === 'chars') renderChars(); });
  // Esc: other overlays (story cards, job offers, the right-click menu) get it first
  const shown = (sel) => { const x = document.querySelector(sel); return !!x && getComputedStyle(x).display !== 'none' && getComputedStyle(x).visibility !== 'hidden'; };
  const busy = () => !!document.querySelector('#story-card.on, #story-title.on, #story-fade.on') || shown('#npc-menu') || shown('#mission-offer') || shown('#mission-banner') || !!getStory?.()?.isBusy?.() || !!getStory?.()?.finale?.active;
  addEventListener('keydown', (e) => {     // capture: decide before the other Esc handlers change anything
    if (e.code === 'Escape') {
      if (open) { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.repeat || busy()) return;
      e.preventDefault(); e.stopPropagation(); openMenu(); return;
    }
    if (open) e.stopPropagation();          // game keys do nothing while paused
  }, true);
  const api = { get isOpen() { return open; }, open: openMenu, close, show, get tab() { return tab; } };
  window.__gameMenu = api;
  return api;
}
