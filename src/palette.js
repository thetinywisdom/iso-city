// The user's Procreate "Comic" palette — 30 colours, 6 ramps, dark -> light.
// Every colour in the scene comes from here.
export const COMIC = {
  blues:    ['#203A57', '#2A5B94', '#3B7EE1', '#B0E9FF', '#DBF5FE'],
  pinks:    ['#A92D59', '#FF5491', '#FF7DAF', '#F8C0C5', '#F9F0F1'],
  teals:    ['#194A4C', '#198085', '#00B4BC', '#A8ECF2', '#EFFAFA'],
  warm:     ['#4C3F42', '#93616B', '#DF9E89', '#F1CDC3', '#FCF0ED'],
  neutrals: ['#292C2E', '#363E47', '#5B6A7B', '#A7BFA4', '#F0F2F4'],
  yellows:  ['#ED8F02', '#FFCC3F', '#FFE166', '#FFF3C1', '#FCF9EB'],
};
const { blues: B, pinks: K, teals: T, warm: W, neutrals: N, yellows: Y } = COMIC;

// Semantic roles used by the scene (all picked from the ramps above).
export const P = {
  sky: T[4],          // #EFFAFA background / far ground
  road: N[2],         // #5B6A7B
  sidewalk: N[4],     // #F0F2F4
  paint: N[4],        // road markings
  black: N[0],        // #292C2E poles, details
  roof: N[1],         // #363E47 roof caps
  ghost: N[4],        // occluded-character silhouette (light, readable on dark roofs)
  sage: N[3],         // #A7BFA4 tree crowns
  trunk: T[0],        // #194A4C tree trunks
  lampGlow: Y[2],     // #FFE166
  wood: W[1],         // #93616B benches
  marker: K[1],       // #FF5491 click-to-move ring
  placeholder: Y[0],  // #ED8F02 capsule
  placeholderFace: W[3],
};

// Building schemes: light wall, mid/dark windows & door, saturated accent.
export const SCHEMES = {
  pink:   { body: K[3], win: K[0], door: N[1], accent: K[1] },
  blue:   { body: B[4], win: B[1], door: B[0], accent: B[2] },
  butter: { body: Y[3], win: N[2], door: W[0], accent: Y[1] },
  teal:   { body: T[3], win: T[1], door: T[0], accent: T[2] },
  peach:  { body: W[3], win: W[1], door: W[0], accent: Y[0] },
  white:  { body: N[4], win: N[2], door: B[1], accent: B[2] },
};
