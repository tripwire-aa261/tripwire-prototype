// Where can a lost drone be? A particle filter that keeps going after the track drops.
//
// When the track is lost, 1,000 guesses ("particles") start at the last tracked position and speed. Each 1.5 s frame:
//  1. every guess flies on: either it keeps cruising (speed up to VMAX, heading wanders) or it slows to a hover;
//  2. if Tripwire locates the drone again (a located frame, track not confirmed yet), guesses near that fix gain weight;
//  3. if Tripwire sees nothing, guesses that are moving through well-covered ground lose weight, because a moving
//     drone there would very likely have been seen. Guesses that are hovering keep their weight: a hovering drone
//     has no Doppler shift and is cancelled with the direct signal (twin/flights.py, zero-Doppler notch), so not
//     seeing it says nothing against a hover. Guesses outside coverage also keep their weight.
// What survives is the region the drone can be in. While it hovers over the drop point, the region stays small
// around the last position; if it flies off out of coverage, the region spreads along its way out.
//
// Detection rates per coverage class (located / detected only / not seen) come from the same simulated flights:
// the share of frames a moving drone was located in each class. A real site would measure them by flying a test
// drone at commissioning (ASSUMPTION that the rates carry over).

export const N = 1000;
export const VMAX = 20;      // m/s, ASSUMPTION: top speed of a small quadcopter (~19 m/s for the DJI Mavic 3 class)
const ACC = 2.0;             // m/s^2 heading/speed wander while cruising, ASSUMPTION
         // per frame: a cruising drone starts to hover, ASSUMPTION
           // per frame: a hovering drone flies on, ASSUMPTION
const V_NOTCH = 1.0;         // m/s: below this the echo sits in the zero-Doppler notch (6 Hz at 2 GHz is ~0.5 m/s)
const CELL = 20;             // m, grid of the drawn region
export const MASS = 0.9;     // the region holds 90% of the probability

function rng(seed) {  // mulberry32: the same flight always draws the same region
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }

function mapState(m, x, y) {
  if (!m) return 0;
  const b = Math.round((x - m.x0) / m.step), a = Math.round((y - m.y0) / m.step);
  if (a < 0 || b < 0 || a >= m.n || b >= m.n) return 0;
  return +m.state[a * m.n + b] || 0;
}

// Share of frames a moving drone was located, per coverage class, from this flight set.
export function calibrate(runsAndGeos, m) {
  const hit = [0, 0, 0], tot = [0, 0, 0];
  for (const { geo, run } of runsAndGeos) {
    for (let k = 1; k < geo.t.length; k++) {
      const [x, y] = geo.xy[k], [px, py] = geo.xy[k - 1];
      if (Math.hypot(x - px, y - py) < 0.5) continue;  // hovering frames do not count
      const s = mapState(m, x, y);
      tot[s]++; hit[s] += run.loc[k] ? 1 : 0;
    }
  }
  return tot.map((t, s) => (t > 20 ? hit[s] / t : [0.02, 0.25, 0.6][s]));
}

// Region for every frame of a run where the track is not held after it was first confirmed.
// Returns an array (per frame) of null or {cells: [[x, y, w]], area_ha, inside, cx, cy, frames, hover}.
// trust: how much of the measured detection rate one miss counts for; stop/go: per-frame chance a cruising guess
// starts to hover / a hovering guess flies on. ASSUMPTIONS, tuned so the drawn 90% region holds the true drone about
// 90% of the time over all 168 simulated flights (first 45 s after each loss): 91% overall, 96% inside the fence +
// 150 m, 100% while hovering; mean region 6.8 ha. A first guess (trust 0.6, stop 0.12) held it only 76% of the time.
export const OPT = { trust: 0.4, hold: 0.97, stop: 0.03, go: 0.1 };
export const MAX_FRAMES = 30;  // after 45 s without a track the region is dropped and the drone reported lost
export function searchZones(geo, run, m, pdet, dt, seed = 7) {
  const T = geo.t.length, out = new Array(T).fill(null);
  const ft = run.trk.indexOf(1);
  if (ft < 0) return out;
  const r = rng(seed);
  let P = null, since = 0;
  for (let k = ft + 1; k < T; k++) {
    if (run.trk[k]) { P = null; continue; }
    if (!P) {  // track just dropped: start from the last tracked fix and its speed
      const j = k - 1, j0 = Math.max(ft, j - 2);
      const e = run.est[j], s0 = Math.max(run.err[j], 10);
      const span = Math.max(1, j - j0) * dt;
      const vx0 = (run.est[j][0] - run.est[j0][0]) / span, vy0 = (run.est[j][1] - run.est[j0][1]) / span;
      P = { x: new Float32Array(N), y: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N), slow: new Uint8Array(N), w: new Float64Array(N) };
      for (let n = 0; n < N; n++) {
        P.x[n] = e[0] + s0 * gauss(r); P.y[n] = e[1] + s0 * gauss(r);
        P.vx[n] = vx0 + 2.5 * gauss(r); P.vy[n] = vy0 + 2.5 * gauss(r);
        P.slow[n] = r() < 0.25 ? 1 : 0; P.w[n] = 1 / N;
      }
      since = 0;
    }
    since++;
    if (since > MAX_FRAMES) { out[k] = { lost: true, frames: since }; continue; }
    // 1. fly on
    for (let n = 0; n < N; n++) {
      if (P.slow[n]) { if (r() < OPT.go) { P.slow[n] = 0; const a = r() * 2 * Math.PI, v = 4 + 10 * r(); P.vx[n] = v * Math.cos(a); P.vy[n] = v * Math.sin(a); } }
      else if (r() < OPT.stop) P.slow[n] = 1;
      if (P.slow[n]) { P.vx[n] = 0.3 * gauss(r); P.vy[n] = 0.3 * gauss(r); }
      else {
        P.vx[n] += ACC * dt * gauss(r); P.vy[n] += ACC * dt * gauss(r);
        const v = Math.hypot(P.vx[n], P.vy[n]);
        if (v > VMAX) { P.vx[n] *= VMAX / v; P.vy[n] *= VMAX / v; }
      }
      P.x[n] += P.vx[n] * dt; P.y[n] += P.vy[n] * dt;
    }
    // 2-3. what Tripwire saw this frame
    let sw = 0;
    for (let n = 0; n < N; n++) {
      let l;
      if (run.loc[k]) {
        const s2 = Math.max(run.err[k], 15) ** 2 * 2, dx = P.x[n] - run.est[k][0], dy = P.y[n] - run.est[k][1];
        l = 0.02 + Math.exp(-(dx * dx + dy * dy) / s2);
      } else {
        const moving = Math.hypot(P.vx[n], P.vy[n]) > V_NOTCH;
        l = moving ? 1 - OPT.trust * pdet[mapState(m, P.x[n], P.y[n])] : OPT.hold;
      }
      P.w[n] *= l; sw += P.w[n];
    }
    if (!(sw > 0)) { for (let n = 0; n < N; n++) P.w[n] = 1 / N; sw = 1; }
    let ess = 0;
    for (let n = 0; n < N; n++) { P.w[n] /= sw; ess += P.w[n] * P.w[n]; }
    let slowShare = 0;
    for (let n = 0; n < N; n++) if (P.slow[n] || Math.hypot(P.vx[n], P.vy[n]) <= V_NOTCH) slowShare += P.w[n];
    out[k] = region(P, geo.xy[k], since, slowShare);
    if (1 / ess < N / 2) resample(P, r);
  }
  return out;
}

function resample(P, r) {  // systematic resampling, with a little jitter so guesses do not collapse
  const c = new Float64Array(N); let acc = 0;
  for (let n = 0; n < N; n++) { acc += P.w[n]; c[n] = acc; }
  const idx = new Uint32Array(N), u0 = r() / N;
  let j = 0;
  for (let n = 0; n < N; n++) { const u = u0 + n / N; while (j < N - 1 && c[j] < u) j++; idx[n] = j; }
  const cp = (a) => Float32Array.from(idx, (i) => a[i]);
  P.x = cp(P.x).map((v) => v + 3 * gauss(r)); P.y = cp(P.y).map((v) => v + 3 * gauss(r));
  P.vx = cp(P.vx); P.vy = cp(P.vy); P.slow = Uint8Array.from(idx, (i) => P.slow[i]); P.w.fill(1 / N);
}

function region(P, truth, frames, hover) {
  const g = new Map();
  let cx = 0, cy = 0;
  for (let n = 0; n < N; n++) {
    const key = `${Math.floor(P.x[n] / CELL)},${Math.floor(P.y[n] / CELL)}`;
    g.set(key, (g.get(key) || 0) + P.w[n]); cx += P.w[n] * P.x[n]; cy += P.w[n] * P.y[n];
  }
  const cells = [...g.entries()].sort((a, b) => b[1] - a[1]);
  const keep = []; let acc = 0;
  for (const [key, w] of cells) { if (acc >= MASS) break; acc += w; const [a, b] = key.split(',').map(Number); keep.push([a * CELL, b * CELL, w]); }
  // the drone counts as inside if its cell or a neighbour is in the region (the grid is coarse)
  const ta = Math.floor(truth[0] / CELL), tb = Math.floor(truth[1] / CELL);
  const set = new Set(keep.map(([x, y]) => `${x / CELL},${y / CELL}`));
  let inside = false;
  for (let da = -1; da <= 1 && !inside; da++) for (let db = -1; db <= 1; db++) if (set.has(`${ta + da},${tb + db}`)) { inside = true; break; }
  const wmax = keep.length ? keep[0][2] : 1;
  return { cells: keep.map(([x, y, w]) => [x, y, w / wmax]), cell: CELL, area_ha: (keep.length * CELL * CELL) / 1e4, inside, cx, cy, frames, hover };
}

// One-call helper for the app: all runs of a site/drone/signal/interference set share the calibration.
export function zonesFor(F, E, key, fl) {
  const [site, drone, sig, interf] = key.split('|');
  const g = F.sites[site], runs = F.runs[key] || [];
  const m = E.maps.find((mm) => mm.k[0] === site && mm.k[1] === drone && mm.k[2] === 'ring8_enh_hist' && mm.k[4] === +interf && mm.k[5] === g.n && (mm.signals || 'cell') === sig);
  const pdet = calibrate(runs.map((run, k) => ({ run, geo: g.flights[k] })), m);
  return { pdet, zones: runs[fl] ? searchZones(g.flights[fl], runs[fl], m, pdet, g.dt, 7 + fl) : [] };
}
