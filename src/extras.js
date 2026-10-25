// Gameplay extras hooked from main.js with one line: contact shadows that show
// through roofs (task 4), click-to-talk NPC chat bubbles (task 7), and long-press SLAP (combat.js).
import { ContactShadows } from './shadows.js';
import { initDialogue } from './dialogue.js';
import { initCombat } from './combat.js';

export function initExtras({ scene, camera, renderer, pixel, city, player, getNPCs, keys }) {
  const shadows = new ContactShadows(scene, city);
  shadows.track(player.root, 0.45);
  let tracked = 0;
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => {   // pick up NPCs once the character module has loaded
    const npcs = getNPCs();
    if (npcs && npcs.list.length !== tracked) { for (const r of npcs.roots) shadows.track(r, 0.4); tracked = npcs.list.length; }
    prev.apply(scene, a);
  };
  const dialogue = initDialogue({ scene, camera, renderer, pixel, player, getNPCs });
  const combat = initCombat({ scene, camera, renderer, pixel, player, getNPCs, dialogue, keys });
  return { shadows, dialogue, combat };
}
