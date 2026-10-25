// Which way a building faces: its front (door, shop window, awning, signs) points at the NEAREST road,
// i.e. into the playable streets, never at a wall or the map edge. Ties prefer the camera-facing +x / +z.
export const ROAD_LINES = [0, 33];
export function faceDists(L) {
  const c = [];
  for (const r of ROAD_LINES) {
    if (r >= L.x1) c.push(['+x', r - L.x1, 0]);
    if (r <= L.x0) c.push(['-x', L.x0 - r, 1]);
    if (r >= L.z1) c.push(['+z', r - L.z1, 0]);
    if (r <= L.z0) c.push(['-z', L.z0 - r, 1]);
  }
  return c.sort((a, b) => a[1] - b[1] || a[2] - b[2]);
}
export function frontFor(L) { return faceDists(L)[0]?.[0] || '+x'; }
// is `face` one of the nearest-road faces (within eps)?
export function faceOk(L, face, eps = 0.05) { const d = faceDists(L); return !!d.length && d.some(([f, v]) => f === face && v <= d[0][1] + eps); }
export function normalOf(face) { const s = face[0] === '+' ? 1 : -1; return face[1] === 'x' ? [s, 0] : [0, s]; }
// accept legacy 'x' / 'z' door params; fall back to the nearest road if the asked face is wrong
export function resolveFace(L, face) {
  if (face === 'x' || face === 'z') face = '+' + face;
  return face && faceOk(L, face) ? face : frontFor(L);
}
// A frame on a building face: u runs along the face (0 = centre), out = distance in front of it.
export function faceFrame(L, face) {
  const ax = face[1] === 'x', s = face[0] === '+' ? 1 : -1;
  const plane = ax ? (s > 0 ? L.x1 : L.x0) : (s > 0 ? L.z1 : L.z0);
  const mid = ax ? (L.z0 + L.z1) / 2 : (L.x0 + L.x1) / 2;
  const len = ax ? L.z1 - L.z0 : L.x1 - L.x0;
  const lo = ax ? L.z0 : L.x0;
  return {
    face, ax, s, len, lo, mid,
    pos: (u, out) => (ax ? [plane + s * out, mid + u] : [mid + u, plane + s * out]),
    size: (along, thick) => (ax ? [thick, along] : [along, thick]),        // [sx, sz]
    ry: ax ? (s > 0 ? Math.PI / 2 : -Math.PI / 2) : (s > 0 ? 0 : Math.PI),   // a plane facing out
    tilt: (a) => (ax ? [0, -s * a] : [s * a, 0]),                           // [rx, rz] droop away from the wall
  };
}
