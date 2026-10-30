// Gameplay extras hooked from main.js with one line: contact shadows that show
// through roofs (task 4), click-to-talk NPC chat bubbles (task 7), and long-press SLAP (combat.js).
import { ContactShadows } from './shadows.js?v=20261031e';
import { initDialogue } from './dialogue.js?v=20261031e';
import { initCombat } from './combat.js?v=20261031e';
import { initMissions } from './missions.js?v=20261031e';
import { initActions } from './actions.js?v=20261031e';
import { initChatter } from './chatter.js?v=20261031e';
import { initPolice } from './police.js?v=20261031e';
import { initBananas } from './bananas.js?v=20261031e';
import { initCats } from './cats.js?v=20261031e';
import { initHiding } from './hiding.js?v=20261031e';
import { initGrandma } from './grandma.js?v=20261031e';
import { initStory } from './story.js?v=20261031e';

export function initExtras({ scene, camera, renderer, pixel, city, player, getNPCs, keys }) {
  const shadows = new ContactShadows(scene, city);
  shadows.track(player.root, 0.45);
  let tracked = 0;
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => {   // pick up NPCs once the character module has loaded
    const npcs = getNPCs();
    if (npcs && npcs.list.length + (npcs.customGen || 0) * 1000 !== tracked) { for (const r of npcs.roots) shadows.track(r, 0.4); tracked = npcs.list.length + (npcs.customGen || 0) * 1000; }
    prev.apply(scene, a);
  };
  const dialogue = initDialogue({ scene, camera, renderer, pixel, player, getNPCs });
  const combat = initCombat({ scene, camera, renderer, pixel, player, getNPCs, dialogue, keys });
  const missions = initMissions({ scene, camera, renderer, pixel, city, player, getNPCs, dialogue, combat });
  const actions = initActions({ scene, camera, renderer, pixel, player, getNPCs, dialogue, combat, missions });
  const chatter = initChatter({ scene, player, getNPCs, dialogue });
  const police = initPolice({ scene, city, player, getNPCs, dialogue, combat, actions });
  const bananas = initBananas({ scene, city, player, getNPCs, dialogue, combat, missions, pixel });
  const cats = initCats({ scene, city, player, getNPCs, dialogue, combat, actions, police, pixel });
  const hiding = initHiding({ scene, camera, city, player, keys, getNPCs, dialogue, combat, police, missions, shadows, pixel });
  const grandma = initGrandma({ scene, player, getNPCs, dialogue, combat, police });
  const story = initStory({ scene, camera, city, player, getNPCs, dialogue, combat, missions, police, pixel, actions, bananas, cats });   // last: wraps dialogue hooks
  actions.hooks.groundRight = () => bananas.drop();   // right-click the ground = drop a banana (B still works)
  return { shadows, dialogue, combat, missions, actions, chatter, police, bananas, cats, hiding, grandma, story };
}
