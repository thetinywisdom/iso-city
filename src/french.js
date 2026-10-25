// Mbappé speaks French. Every line is [french, small english translation].
// Swears are asterisked like everywhere else in the game.
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export const FR = {
  talk: [['Regarde et apprends, mon pote.', 'watch and learn, buddy.'], ['Oh là là, encore toi?', 'oh la la, you again?'],
    ['Je suis trop fort, c\'est fatigant.', 'being this good is exhausting.'], ['Tu veux un autographe? Non.', 'want an autograph? no.'],
    ['Ça, c\'est du talent, chéri.', 'that, darling, is talent.'], ['Allez, dégage, je m\'entraîne!', 'go on, scram, i\'m training!']],
  concede: [['Ok ok, t\'as gagné... cette fois.', 'ok ok, you win... this time.'], ['Pas mal, pour un amateur.', 'not bad, for an amateur.'],
    ['Tes jambes... c\'est quoi ça?!', 'your legs... what ARE those?!']],
  mock: [['Nul. Complètement nul.', 'lame. totally lame.'], ['Ma grand-mère danse mieux!', 'my grandma dances better!'],
    ['C\'est quoi ce b*rdel?!', 'what the h*ll was that?!'], ['Oh là là... la honte.', 'oh la la... the shame.']],
  party: [['ALLEZ ALLEZ!', 'come on come on!'], ['C\'EST LA FÊTE!', 'it\'s a party!'], ['OUAIS OUAIS OUAIS!', 'yeah yeah yeah!']],
  cheer: [['ALLEZ!', 'go!'], ['BRAVO!', 'bravo!'], ['OH LÀ LÀ!', 'oh la la!']],
  stink: [['P*TAIN! ÇA PUE!', 'f*ck! it stinks!'], ['M*rde, c\'est quoi ça?!', 'sh*t, what is that?!'],
    ['Mes yeux! MES YEUX!', 'my eyes! MY EYES!'], ['T\'as mangé quoi, toi?!', 'what did YOU eat?!'], ['Beurk! Dégueulasse!', 'yuck! disgusting!']],
  faint: [['Je... meurs...', 'i\'m... dying...'], ['Oh là là... tout est vert...', 'oh la la... everything\'s green...']],
  mad: [['Espèce de petit c*n!', 'you little j*rk!'], ['Tu vas me le payer!', 'you\'ll pay for this!'], ['C\'est fini, toi!', 'you\'re finished!']],
  help: [['AÏE! Au secours!', 'ow! help!'], ['P*TAIN! Ça fait mal!', 'f*ck! that hurts!'], ['Mon visage! Mon beau visage!', 'my face! my beautiful face!']],
  chase: [['REVIENS ICI, ESPÈCE DE M*RDE!', 'get back here, you little sh*t!'], ['JE VAIS T\'ATTRAPER!', 'i\'m gonna catch you!']],
  giveUp: [['Pff. Cours, poule mouillée!', 'pfft. run, chicken!'], ['Ouais, c\'est ça, fuis!', 'yeah, that\'s right, run!']],
  whoa: [['OH LÀ LÀ LÀ LÀ!', 'whoa-oa-oa!'], ['M*RDE! UNE BANANE?!', 'sh*t! a banana?!']],
  witness: [['POLICE! C\'est lui!', 'police! it\'s him!'], ['Monsieur l\'agent! LÀ!', 'officer! THERE!'], ['Au voleur! Au voleur!', 'stop, thief! stop, thief!']],
  dots: [['...', '...']],
  dance: [['Regarde ça!', 'watch this!'], ['Admire le maître.', 'behold the master.'], ['Musique, s\'il vous plaît!', 'music, please!']],
};
// exact lines (missions / one-offs): english -> [french, english]
const EXACT = {
  'OI! MY BALL!': ['OH! MON BALLON!', 'oi! my ball!'],
  '*shrug* whatever.': ['*haussement d\'épaules* bof.', '*shrug* whatever.'],
  'mine. obviously.': ['À moi. Évidemment.', 'mine. obviously.'],
  'thanks for the ball!': ['Merci pour le ballon, crétin!', 'thanks for the ball, dummy!'],
  'WHOA-OA-OA!': null, '...': null,
};
const CAT = new Map();     // english line -> category (pools registered by the modules that own them)
export function registerPools(pools) { for (const k in pools) if (FR[k]) for (const s of pools[k]) CAT.set(s, k); }
CAT.set('WHOA-OA-OA!', 'whoa'); CAT.set('...', 'dots');
export const isFrench = (npc) => npc?.special === 'mbappe' || npc?.lang === 'fr';
/** French version of what this NPC was about to say: [french, english]. */
export function frLine(text, cat) {
  if (EXACT[text]) return EXACT[text];
  const c = cat || CAT.get(text);
  if (c && FR[c]) return pick(FR[c]);
  return ['Oh là là!', String(text)];
}
