// 3D playback of one full signal-chain simulation run (twin/run.py output), at any of the facilities.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { $, esc, X, fillSelect, state, designName, designFor, RADIO, RADIO_KEYS } from './data.js';

const RUN_DIR = 'runs/';
const fmtM = (x) => (x == null ? '—' : x >= 1000 ? `${(x / 1000).toFixed(2)} km` : `${Math.round(x)} m`);

let site = null, towersDoc = null, siteKey = null, elev0 = 0, gridC, gridF;
let run = null, rdBlob = null, runsIndex = [], apiMeta = null, replays = null, replayNote = '';
let tNow = 0, playing = true, rdListener = 0, active = false, pinned = false;

// ------------------------------------------------------------------ terrain helpers
async function loadGrid(dir, meta) {
  const raw = new Int16Array(await (await fetch(dir + meta.file)).arrayBuffer());
  const z = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) z[i] = raw[i] / 10;
  return { z, nx: meta.nx, ny: meta.ny, x0: meta.x0, y0: meta.y0, step: meta.step_m };
}
function bilinear(g, x, y) {
  const fx = Math.min(Math.max((x - g.x0) / g.step, 0), g.nx - 1.001), fy = Math.min(Math.max((y - g.y0) / g.step, 0), g.ny - 1.001);
  const j = Math.floor(fx), i = Math.floor(fy), tx = fx - j, ty = fy - i;
  const a = g.z[i * g.nx + j], b = g.z[i * g.nx + j + 1], c = g.z[(i + 1) * g.nx + j], d = g.z[(i + 1) * g.nx + j + 1];
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}
const inside = (g, x, y) => x >= g.x0 && y >= g.y0 && x <= g.x0 + g.step * (g.nx - 1) && y <= g.y0 + g.step * (g.ny - 1);
const ground = (x, y) => (inside(gridF, x, y) ? bilinear(gridF, x, y) : bilinear(gridC, x, y));
const w = (x, y, z) => new THREE.Vector3(x, z - elev0, -y);
export function distToPolygon(px, py, poly) {
  let best = Infinity, ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ins = !ins;
    const dx = xj - xi, dy = yj - yi, L2 = dx * dx + dy * dy || 1e-9;
    const t = Math.min(1, Math.max(0, ((px - xi) * dx + (py - yi) * dy) / L2));
    best = Math.min(best, Math.hypot(px - (xi + t * dx), py - (yi + t * dy)));
  }
  return ins ? 0 : best;
}

// ------------------------------------------------------------------ scene
const view = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
view.appendChild(renderer.domElement);
const labels = new CSS2DRenderer();
Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
view.appendChild(labels.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1016);
scene.fog = new THREE.Fog(0x0b1016, 6000, 16000);
const camera = new THREE.PerspectiveCamera(45, 1, 2, 60000);
camera.position.set(1500, 1100, 1700);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.05;
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a2430, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.position.set(-3000, 4000, 2000);
scene.add(sun);
function label(text, cls = '') {
  const el = document.createElement('div');
  el.className = `label3d ${cls}`;
  el.textContent = text;
  return new CSS2DObject(el);
}
function terrainMesh(g, stride, drop) {
  const nx = Math.floor((g.nx - 1) / stride) + 1, ny = Math.floor((g.ny - 1) / stride) + 1;
  const pos = new Float32Array(nx * ny * 3), col = new Float32Array(nx * ny * 3);
  const lo = new THREE.Color(0x1d3324), mid = new THREE.Color(0x3d4b33), hi = new THREE.Color(0x77735c), c = new THREE.Color();
  for (let i = 0; i < ny; i++) for (let j = 0; j < nx; j++) {
    const k = i * nx + j, z = g.z[(i * stride) * g.nx + j * stride];
    pos.set([g.x0 + j * stride * g.step, z - elev0 - drop, -(g.y0 + i * stride * g.step)], k * 3);
    const t = Math.min(Math.max((z - elev0) / 300, 0), 1);
    c.copy(lo).lerp(mid, Math.min(t * 2, 1)).lerp(hi, Math.max(t * 2 - 1, 0));
    col.set([c.r, c.g, c.b], k * 3);
  }
  const idx = [];
  for (let i = 0; i < ny - 1; i++) for (let j = 0; j < nx - 1; j++) { const a = i * nx + j, b = a + 1, d = a + nx, e = d + 1; idx.push(a, b, d, b, e, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
}

const siteGroup = new THREE.Group(), towerGroup = new THREE.Group(), runGroup = new THREE.Group(), dyn = new THREE.Group(), beamGroup = new THREE.Group();
scene.add(siteGroup, towerGroup, runGroup, dyn);
let coverageMesh = null;

async function ensureSite(key) {
  if (siteKey === key) return;
  const id = X.sites[key].id, dir = `../data/sites/${id}/`;
  site = await (await fetch(dir + 'site.json')).json();
  towersDoc = await (await fetch(dir + 'towers.json')).json();
  elev0 = site.origin.elev_m;
  [gridC, gridF] = await Promise.all([loadGrid(dir, site.terrain.coarse), loadGrid(dir, site.terrain.fine)]);
  siteKey = key;
  siteGroup.clear();
  siteGroup.add(terrainMesh(gridC, 2, 3), terrainMesh(gridF, 1, 0));
  const fence = site.fence.map(([x, y]) => w(x, y, ground(x, y) + 3));
  siteGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fence), new THREE.LineBasicMaterial({ color: 0xe2e8f0 })));
  const mat = new THREE.MeshLambertMaterial({ color: 0x9aa5b4 });
  for (const b of site.buildings) {
    const pts = b.poly.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y));
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: b.height_m, bevelEnabled: false }), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = ground(b.poly[0][0], b.poly[0][1]) - elev0;
    siteGroup.add(m);
  }
  const c = X.sites[key].centre;
  const lab = label(`${site.name} (OpenStreetMap outline)`);
  lab.position.copy(w(c[0], Math.max(...site.fence.map((p) => p[1])) + 40, ground(c[0], c[1]) + 40));
  siteGroup.add(lab);
  controls.target.copy(w(c[0], c[1], ground(c[0], c[1])));
  camera.position.copy(w(c[0] + 1500, c[1] - 1700, ground(c[0], c[1]) + 1100));
}

function zoneLine(buffer) {
  const c = X.sites[siteKey].centre, zone = [];
  for (let a = 0; a <= 360; a += 3) {
    const r0 = Math.sin((a * Math.PI) / 180), r1 = Math.cos((a * Math.PI) / 180);
    let lo = 0, hi = 2000;
    for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; (distToPolygon(c[0] + m * r0, c[1] + m * r1, site.fence) <= buffer ? (lo = m) : (hi = m)); }
    zone.push(w(c[0] + lo * r0, c[1] + lo * r1, ground(c[0] + lo * r0, c[1] + lo * r1) + 4));
  }
  const zl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(zone), new THREE.LineDashedMaterial({ color: 0xe2e8f0, dashSize: 14, gapSize: 10 }));
  zl.computeLineDistances();
  return zl;
}

function buildTowers() {
  towerGroup.clear();
  const used = new Map();
  for (const ill of run?.illuminators || []) { const tid = ill.id.split(':')[0]; used.set(tid, [...(used.get(tid) || []), ill.operator]); }
  for (const t of towersDoc.towers) {
    const on = used.has(t.id);
    if (!on && !$('showAllTowers').checked) continue;
    const g = ground(t.x, t.y), h = t.height_agl_m || 30;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(4, 9, h, 6), new THREE.MeshLambertMaterial({ color: on ? 0xa78bfa : 0x475569 }));
    mast.position.copy(w(t.x, t.y, g + h / 2));
    towerGroup.add(mast);
    if (on) {
      const l = label(`${used.get(t.id).join('+')} tower · ${(t.distance_m / 1000).toFixed(1)} km`, 'tx');
      l.position.copy(w(t.x, t.y, g + h + 25));
      towerGroup.add(l);
    }
  }
}

function droneModel() {
  const g = new THREE.Group(), s = 14;
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.15 * s, 0.4 * s), new THREE.MeshLambertMaterial({ color: 0xf8fafc })));
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.22 * s, 0.02 * s, 16), new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.5 }));
    r.position.set(dx * 0.32 * s, 0.1 * s, dz * 0.32 * s);
    g.add(r);
  }
  return g;
}
const drone = droneModel();
const bird = new THREE.Mesh(new THREE.ConeGeometry(4, 10, 6), new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
const droneLabel = label('ground truth drone'), birdLabel = label('bird');
const dropLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x64748b }));
const pairLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 }));
const fixPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xfacc15, size: 16, sizeAttenuation: true }));
const trkGroup = new THREE.Group();
dyn.add(drone, bird, droneLabel, birdLabel, dropLine, pairLines, fixPts, trkGroup);

const BEAM_R = 320;
function beams(l) {
  const a = l.antenna || { kind: 'iso', faces: [0], az_bw_deg: 360 };
  const [x, y, z] = l.pos, out = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: a.az_bw_deg >= 360 ? 0.07 : 0.16, side: THREE.DoubleSide, depthWrite: false });
  for (const az of a.faces) {
    const half = Math.min(a.az_bw_deg, 360) / 2, pts = [new THREE.Vector3(0, 0, 0)];
    for (let d = -half; d <= half + 1e-6; d += Math.max(2, half / 20)) { const r = ((az + d) * Math.PI) / 180; pts.push(new THREE.Vector3(BEAM_R * Math.sin(r), 0, -BEAM_R * Math.cos(r))); }
    const idx = [];
    for (let k = 1; k < pts.length - 1; k++) idx.push(0, k, k + 1);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(w(x, y, z + 2));
    out.push(m);
  }
  return out;
}

const PROC = { crs_p0: 'beacon-only processing', crs_all: 'all reference signals', full: 'whole-signal processing' };
function designText(p, l) {
  const a = l?.antenna;
  if (!a || a.kind === 'iso') return `${p.rx_elements} antenna(s), v0.2 antenna model`;
  const name = { omni: 'all-round', patch: 'panel', lpda: 'log-periodic', yagi: 'Yagi' }[a.kind];
  return `${a.elements} ${name} antenna${a.elements > 1 ? 's' : ''}${a.faces.length > 1 ? ` facing ${a.faces.length} ways` : ''}`;
}

let loadSeq = 0; // a newer pick cancels a load still in flight
async function loadRun(id) {
  const my = ++loadSeq;
  let doc = null;
  try { const r = await fetch(`${RUN_DIR}${id}.json`, { cache: 'no-store' }); if (r.ok) doc = await r.json(); } catch { doc = null; }
  if (!doc) { if (my === loadSeq) $('runSummary').innerHTML = `<span class="bad">Run "${esc(id)}" is not on this server</span> (runs you make yourself stay on your own computer).`; return; }
  // The .bin holds the raw radar view only; the web deploy leaves it out (size limit), the replay still plays.
  let blob = null;
  try { const r = await fetch(`${RUN_DIR}${id}.bin`, { cache: 'no-store' }); if (r.ok) blob = new Uint8Array(await r.arrayBuffer()); } catch { blob = null; }
  if (my !== loadSeq) return;
  run = doc; rdBlob = blob;
  await ensureSite(run.site?.key || run.scenario || 'hays');
  if (my !== loadSeq) return;
  runGroup.clear();
  beamGroup.clear();
  buildTowers();
  runGroup.add(zoneLine(run.params.zone_buffer_m));
  for (const l of run.listeners) {
    const [x, y, z] = l.pos;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 18, 8), new THREE.MeshLambertMaterial({ color: 0x38bdf8 }));
    mast.position.copy(w(x, y, z));
    const box = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 10), new THREE.MeshLambertMaterial({ color: 0x38bdf8, emissive: 0x0c4a6e }));
    box.position.copy(w(x, y, z + 9));
    const lab = label(l.id.replace('L', 'S'), 'rx');
    lab.position.copy(w(x, y, z + 26));
    runGroup.add(mast, box, lab);
    beamGroup.add(...beams(l));
  }
  beamGroup.visible = $('showBeams').checked;
  runGroup.add(beamGroup);
  for (const kind of ['drone', 'bird']) {
    if (!run.frames[0].truth[kind]) continue;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(run.frames.map((f) => w(...f.truth[kind].pos))),
      new THREE.LineDashedMaterial({ color: kind === 'drone' ? 0xcbd5e1 : 0x64748b, dashSize: 10, gapSize: 8 }));
    line.computeLineDistances();
    runGroup.add(line);
  }
  buildCoverage();
  $('timeline').max = run.frames[run.frames.length - 1].t;
  tNow = 0;
  rdListener = Math.min(rdListener, run.listeners.length - 1);
  $('rdTabs').innerHTML = run.listeners.map((l, i) => `<button data-i="${i}" class="${i === rdListener ? 'on' : ''}">${l.id.replace('L', 'S')}</button>`).join('');
  $('rdTabs').querySelectorAll('button').forEach((b) => (b.onclick = () => { rdListener = +b.dataset.i; $('rdTabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); drawFrame(true); }));
  const p = run.params, dm = run.drone_model;
  $('runSummary').innerHTML = `${replayNote}${esc(X.sites[siteKey].name)} · ${esc(dm.name)} at ${p.altitude_agl_m} m · ${p.n_listeners} sensors, each with ${esc(designText(p, run.listeners[0]))}, ${esc(PROC[p.processing || 'crs_p0'])}${p.mic_range_m ? ' + microphone' : ''} · interference removal ${p.cochannel_suppression_db} dB · ${run.illuminators.length} cell towers used`;
  runCards();
  errorChart();
  fillParamTable();
  lastFrameIdx = -1;
}

function buildCoverage() {
  if (coverageMesh) runGroup.remove(coverageMesh);
  const c = run.coverage, n = c.n;
  const data = new Uint8Array(n * n * 4), pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = i * n + j, x = c.x0 + j * c.step_m, y = c.y0 + i * c.step_m;
    pos.set([x, ground(x, y) - elev0 + 4, -y], k * 3);
    uv.set([j / (n - 1), i / (n - 1)], k * 2);
    const s = c.state[k], zone = distToPolygon(x, y, site.fence) <= run.params.zone_buffer_m;
    if (s === 2) data.set([52, 211, 153, zone ? 150 : 80], k * 4);
    else if (s === 1) data.set([251, 191, 36, zone ? 140 : 60], k * 4);
    else if (zone) data.set([248, 113, 113, 130], k * 4);
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j; idx.push(a, a + 1, a + n, a + 1, a + n + 1, a + n); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  coverageMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  coverageMesh.visible = $('showCoverage').checked;
  runGroup.add(coverageMesh);
}

function runCards() {
  const m = run.metrics, p = run.params;
  const cards = [
    ['Area covered', `${run.coverage.zone_located_pct.toFixed(0)}%`, `within ${p.zone_buffer_m} m of the fence (coverage map)`],
    ['Time tracked', `${m.track_availability_pct}%`, 'of this flight inside the zone'],
    ['Tracking accuracy', m.median_error_m == null ? '—' : fmtM(m.median_error_m), 'median track error'],
    ['First tracked', m.first_track_distance_m == null ? 'never' : fmtM(m.first_track_distance_m), 'from the nearest sensor'],
    ['Updates', `every ${p.frame_dt_s} s`, `${p.cit_s} s integration`],
    ['False alerts', `${m.false_tracks}`, `bird tracked ${m.bird_tracks}×`],
  ];
  $('runCards').innerHTML = cards.map(([k, v, s]) => `<div class="card"><small>${k}</small><b>${v}</b><span class="note small">${s}</span></div>`).join('');
}

// ------------------------------------------------------------------ tracking error chart
// Per update: distance from the ground truth drone to the nearest track estimate, counted when that track is within
// 60 m across the ground (the twin's "tracked" rule in twin/run.py); otherwise "no track on the drone".
const ERR_NEAR_M = 60;
let errGeom = null;
function errorChart() {
  const svg = $('errChart');
  if (!svg) return;
  const fr = run.frames, T = fr[fr.length - 1].t, zb = run.params.zone_buffer_m;
  const pts = fr.map((f) => {
    const d = f.truth.drone.pos;
    const near = f.tracks.filter((tr) => Math.hypot(tr.pos[0] - d[0], tr.pos[1] - d[1]) < ERR_NEAR_M);
    return { t: f.t, e: near.length ? Math.min(...near.map((tr) => Math.hypot(tr.pos[0] - d[0], tr.pos[1] - d[1], tr.pos[2] - d[2]))) : null,
      zone: distToPolygon(d[0], d[1], site.fence) <= zb };
  });
  const emax = Math.max(60, Math.ceil(Math.max(0, ...pts.map((p) => p.e ?? 0)) / 20) * 20);
  const W = 960, H = 230, ml = 56, mr = 16, mt = 12, mb = 40, pw = W - ml - mr, ph = H - mt - mb, dt = run.params.frame_dt_s;
  const Xp = (t) => ml + (t / T) * pw, Yp = (e) => mt + ph - (Math.min(e, emax) / emax) * ph;
  let g = '';
  // Background: when the drone is inside the protected zone, and when no track is on it.
  for (const p of pts) {
    const x = Xp(Math.max(0, p.t - dt / 2)), w2 = Xp(Math.min(T, p.t + dt / 2)) - x;
    if (p.zone) g += `<rect x="${x}" y="${mt}" width="${w2 + 0.5}" height="${ph}" fill="rgba(56,189,248,.10)"/>`;
    if (p.e == null) g += `<rect x="${x}" y="${mt + ph - 6}" width="${w2 + 0.5}" height="6" fill="#64748b"/>`;
  }
  for (let e = 0; e <= emax; e += 20) g += `<line class="grid" x1="${ml}" x2="${ml + pw}" y1="${Yp(e)}" y2="${Yp(e)}"/><text x="${ml - 6}" y="${Yp(e) + 4}" text-anchor="end">${e} m</text>`;
  const tstep = T > 120 ? 30 : 20;
  for (let t = 0; t <= T + 1e-6; t += tstep) g += `<text x="${Xp(t)}" y="${H - 22}" text-anchor="middle">${t} s</text>`;
  g += `<text class="axis" x="${ml + pw / 2}" y="${H - 4}" text-anchor="middle">time in the flight</text>`;
  g += `<text class="axis" transform="translate(14 ${mt + ph / 2}) rotate(-90)" text-anchor="middle">error</text>`;
  const med = run.metrics.median_error_m;
  if (med != null) g += `<line class="tier" stroke="#fbbf24" x1="${ml}" x2="${ml + pw}" y1="${Yp(med)}" y2="${Yp(med)}"/><text class="target" x="${ml + 6}" y="${Yp(med) - 5}">median ${fmtM(med)}</text>`;
  // The error line, broken where there is no track on the drone.
  let seg = [];
  const flush = () => { if (seg.length > 1) g += `<polyline fill="none" stroke="#fb7185" stroke-width="2" points="${seg.join(' ')}"/>`; seg = []; };
  for (const p of pts) { if (p.e == null) { flush(); continue; } seg.push(`${Xp(p.t)},${Yp(p.e)}`); g += `<circle cx="${Xp(p.t)}" cy="${Yp(p.e)}" r="2.5" fill="#fb7185"><title>t = ${p.t.toFixed(1)} s: ${Math.round(p.e)} m</title></circle>`; }
  flush();
  g += `<line id="errNow" x1="${ml}" x2="${ml}" y1="${mt}" y2="${mt + ph}" stroke="#fbbf24" stroke-width="2"/>`;
  g += `<rect x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="transparent" style="cursor:pointer" id="errHit"/>`;
  svg.innerHTML = g;
  errGeom = { Xp, T, ml, pw };
  $('errHit').onclick = (ev) => {
    const r = svg.getBoundingClientRect(), x = ((ev.clientX - r.left) / r.width) * W;
    tNow = Math.max(0, Math.min(T, ((x - ml) / pw) * T));
  };
  const tracked = pts.filter((p) => p.e != null), inZone = pts.filter((p) => p.zone);
  $('errNote').innerHTML = `${med != null ? `Dashed line: the median error, ${fmtM(med)}, which is this run's tracking accuracy. ` : ''}The track estimate was on the drone for ${tracked.length} of ${pts.length} updates (${inZone.filter((p) => p.e != null).length} of the ${inZone.length} inside the protected zone).
    Error = straight-line distance, height included. Click the chart to jump the 3D replay to that moment.`;
}
function errCursor() {
  if (!errGeom || !$('errNow')) return;
  const x = errGeom.Xp(Math.min(tNow, errGeom.T));
  $('errNow').setAttribute('x1', x); $('errNow').setAttribute('x2', x);
}

// ------------------------------------------------------------------ per frame
function frameAt(t) {
  const f = run.frames, dt = run.params.frame_dt_s, i = Math.min(Math.floor(t / dt), f.length - 1);
  return { i, a: f[i], b: f[Math.min(i + 1, f.length - 1)], u: Math.min(Math.max((t - f[i].t) / dt, 0), 1) };
}
const lerp3 = (p, q, u) => p.map((v, k) => v + (q[k] - v) * u);
let lastFrameIdx = -1;
function drawFrame(force = false) {
  if (!run) return;
  const { i, a, b, u } = frameAt(tNow);
  const dp = lerp3(a.truth.drone.pos, b.truth.drone.pos, u), pos = w(...dp);
  drone.position.copy(pos);
  drone.children.forEach((c, k) => { if (k) c.rotation.y += 0.8; });
  droneLabel.position.copy(pos).add(new THREE.Vector3(0, 22, 0));
  dropLine.geometry.setFromPoints([pos, w(dp[0], dp[1], ground(dp[0], dp[1]))]);
  if (a.truth.bird) {
    const bp = lerp3(a.truth.bird.pos, b.truth.bird.pos, u);
    bird.position.copy(w(...bp)); birdLabel.position.copy(w(...bp)).add(new THREE.Vector3(0, 16, 0));
    bird.visible = birdLabel.visible = true;
  } else bird.visible = birdLabel.visible = false;
  $('timeline').value = tNow;
  errCursor();
  $('timeLabel').textContent = `t = ${tNow.toFixed(1)} s of ${run.frames[run.frames.length - 1].t.toFixed(0)} s`;
  if (i === lastFrameIdx && !force) return;
  lastFrameIdx = i;
  const seg = [], heard = new Set(a.drone_hits.map((h, pi) => (h ? run.pairs[pi].rx : -1)).filter((x) => x >= 0));
  for (const li of heard) seg.push(w(...run.listeners[li].pos).add(new THREE.Vector3(0, 9, 0)), w(...a.truth.drone.pos));
  pairLines.geometry.setFromPoints(seg);
  fixPts.geometry.setFromPoints(a.fixes.map((f) => w(...f.pos)));
  trkGroup.clear();
  for (const tr of a.tracks) {
    const hist = run.frames.slice(0, i + 1).flatMap((f) => f.tracks.filter((x) => x.id === tr.id).map((x) => w(...x.pos)));
    if (hist.length > 1) trkGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hist), new THREE.LineBasicMaterial({ color: 0xfb7185 })));
    const s = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfb7185 }));
    s.position.copy(w(...tr.pos));
    // The tracker's guess of where the drone is. Tracks without a rotor signature are usually the bird.
    const l = label(tr.label === 'no rotor signature' ? 'track estimate (no drone rotors seen)' : 'track estimate', 'trk');
    l.position.copy(w(...tr.pos)).add(new THREE.Vector3(0, 20, 0));
    trkGroup.add(s, l);
  }
  const d = a.truth.drone.pos;
  const nearTrack = a.tracks.some((tr) => Math.hypot(tr.pos[0] - d[0], tr.pos[1] - d[1]) < 60);
  const nearFix = a.fixes.some((f) => Math.hypot(f.pos[0] - d[0], f.pos[1] - d[1]) < 60);
  const nHits = a.drone_hits.reduce((s, h) => s + h, 0);
  const st = nearTrack ? ['TRACKED', 'trk'] : nearFix ? ['LOCATED', 'trk'] : nHits ? ['DETECTED', 'det'] : ['NOT SEEN', 'lost'];
  $('hudState').className = `pill ${st[1]}`;
  $('hudState').textContent = st[0];
  const hover = Math.hypot(...a.truth.drone.vel) < 0.1;
  $('hudDetail').textContent = `${heard.size}/${run.listeners.length} sensors hear the drone${hover ? ' · HOVERING: invisible to radar (no motion, no Doppler)' : ''}`;
  drawRD(i);
}


// ------------------------------------------------------------------ raw radar view (technical)
const LUT = (() => {
  const stops = [[0, 0, 4, 20], [0.25, 59, 15, 112], [0.5, 140, 41, 129], [0.75, 222, 73, 104], [1, 252, 253, 191]], out = new Uint8Array(256 * 3);
  for (let v = 0; v < 256; v++) {
    const t = v / 255, k = stops.findIndex((s) => s[0] >= t), s1 = stops[Math.max(k, 1)], s0 = stops[Math.max(k, 1) - 1], u = (t - s0[0]) / (s1[0] - s0[0]);
    for (let c = 0; c < 3; c++) out[v * 3 + c] = s0[c + 1] + (s1[c + 1] - s0[c + 1]) * u;
  }
  return out;
})();
const rdOff = document.createElement('canvas');
function drawRD(fi) {
  if (!$('rd').offsetParent) return; // hidden
  if (!rdBlob || !rdBlob.length) {
    const c = $('rd').getContext('2d'); c.fillStyle = '#111a23'; c.fillRect(0, 0, 300, 300);
    c.fillStyle = '#8396a8'; c.font = '12px system-ui'; c.fillText('Raw radar view: run serve.py locally', 20, 150); return;
  }
  const ax = run.rd.axes, rows = ax.range[2], cols = ax.doppler[2], off = (fi * run.rd.per_frame + rdListener) * rows * cols;
  rdOff.width = cols; rdOff.height = rows;
  const octx = rdOff.getContext('2d'), img = octx.createImageData(cols, rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = rdBlob[off + r * cols + c], o = ((rows - 1 - r) * cols + c) * 4;
    img.data[o] = LUT[v * 3]; img.data[o + 1] = LUT[v * 3 + 1]; img.data[o + 2] = LUT[v * 3 + 2]; img.data[o + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  const cv = $('rd'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height, ml = 34, mb = 22, pw = W - ml - 6, ph = H - mb - 6;
  ctx.fillStyle = '#0b1016'; ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(rdOff, ml, 6, pw, ph);
  const d0 = ax.doppler[0], dd = ax.doppler[1], dmax = d0 + dd * cols, rmax = ax.range[0] + ax.range[1] * rows;
  const Xp = (nu) => ml + ((nu - d0) / (dmax - d0)) * pw, Yp = (r) => 6 + ph - (r / rmax) * ph;
  ctx.fillStyle = '#8396a8'; ctx.font = '10px system-ui';
  for (const nu of [-150, -75, 0, 75, 150]) ctx.fillText(`${nu}`, Xp(nu) - 8, H - 8);
  for (const r of [0, 500, 1000, 1500]) ctx.fillText(`${r}`, 2, Yp(r) + 3);
  const f = run.frames[fi], pi = f.rd_pairs[rdListener], pr = run.pairs[pi], ill = run.illuminators[pr.ill];
  const [tr, tnu, tsnr] = f.pair_truth[pi];
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  if (tr < rmax && Math.abs(tnu) < 150) { ctx.beginPath(); ctx.arc(Xp(tnu), Yp(tr), 8, 0, 2 * Math.PI); ctx.stroke(); }
  ctx.strokeStyle = '#facc15';
  for (const [r, nu] of f.dets[pi]) if (r < rmax && Math.abs(nu) < 150) ctx.strokeRect(Xp(nu) - 4, Yp(r) - 4, 8, 8);
  $('rdNote').innerHTML = `Sensor ${esc(run.listeners[pr.rx].id.replace('L', 'S'))} with ${esc(ill.label)}. Vertical: extra path length (m); horizontal: Doppler (Hz). White circle = the drone (expected SNR ${tsnr.toFixed(1)} dB); yellow squares = detections.`;
  const n = pr.noise, parts = [['thermal', 'Receiver noise'], ['quantisation', 'Digitizing (ADC)'], ['residue', 'Direct-signal leftover'], ['cochannel', 'Neighbor-cell interference']];
  const top = Math.max(...parts.map(([k]) => n[k]));
  $('noiseBar').innerHTML = `<div class="note small">Noise floor for this pair (widest = what limits it):</div>` + parts.map(([k, name]) => {
    const v = n[k], width = Math.max(0, Math.min(100, ((v + 190) / (top + 190)) * 100));
    return `<div class="nb ${v === top ? 'dom' : ''}"><span>${name}</span><div><i style="width:${width}%"></i></div><span>${v < -300 ? 'none' : v.toFixed(0)}</span></div>`;
  }).join('');
}

// ------------------------------------------------------------------ dialogs
export function fillParamTable() {
  if (!run) return;
  const src = run.param_sources;
  $('srcTable').innerHTML = run.assumptions.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('');
  $('paramTable').innerHTML = Object.entries(run.params).filter(([k]) => src[k]).map(([k, v]) =>
    `<tr><td>${esc(src[k][0])}</td><td>${esc(v ?? (k === 'lumped_loss_db' ? run.lumped_loss_db.toFixed(1) + ' (calibrated)' : 'calibrated'))}</td><td>${esc(src[k][1])}</td></tr>`).join('');
  $('dataTable').innerHTML = [...(site?.sources || []), ...(towersDoc?.sources || [])].map((s) => `<tr><td colspan="3">${esc(s)}</td></tr>`).join('');
}

export function drawCalibration(calibration) {
  if (!calibration) { $('calBody').innerHTML = '<p class="note">calibration.json not found.</p>'; return; }
  const c = calibration, v = c.validation;
  const simRows = Object.entries(v.simulated).map(([k, x]) => `<tr><td>${esc(k)}</td><td>${x.pd_pct}%</td><td>${x.range_error_m ? `${x.range_error_m[0]} ± ${x.range_error_m[1]} m` : '—'}</td></tr>`).join('');
  const paperRows = Object.entries(v.paper_table1_pd_pct).map(([k, x]) => `${esc(k)}: ${x}%`).join(' · ');
  $('calBody').innerHTML = `<div class="kv"><span>Lumped echo loss (fitted)</span><b>${c.lumped_loss_db.toFixed(1)} dB</b>
      <span>Direct-signal cancellation depth (fitted)</span><b>${c.dpi_residual_db.toFixed(0)} dB</b>
      <span>Fig. 11 max range at Pfa 1e-4: simulated / paper</span><b>${Math.round(c.figure11_calibrated.max_range_m)} m / ~1600 m</b></div>
    <h3>Table 1 trial</h3><table><tr><th>Simulated</th><th>Pd at Pfa 0.008</th><th>Range error</th></tr>${simRows}</table>
    <p class="note small">Paper: ${paperRows}; range error ${esc(v.paper_range_error_m)}.</p><p class="note small"><b>Fit status:</b> ${esc(c.fit_status)}</p>
    <h3>Fig. 11 reproduction (calibrated)</h3>`;
  const f = c.figure11_calibrated, cv = $('fig11'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height, ml = 44, mb = 28;
  ctx.fillStyle = '#18222d'; ctx.fillRect(0, 0, W, H);
  const lx = (r) => Math.log10(r), xmin = lx(200), xmax = lx(4000), ys = f.cut_db;
  const ymin = Math.min(...ys, ...Object.values(f.thresholds_db)) - 2, ymax = Math.max(...ys) + 2;
  const Xp = (r) => ml + ((lx(r) - xmin) / (xmax - xmin)) * (W - ml - 10), Yp = (db) => H - mb - ((db - ymin) / (ymax - ymin)) * (H - mb - 10);
  ctx.fillStyle = '#8396a8'; ctx.font = '11px system-ui';
  for (const r of [300, 500, 1000, 2000, 3000]) ctx.fillText(`${r} m`, Xp(r) - 14, H - 8);
  for (let db = Math.ceil(ymin / 5) * 5; db < ymax; db += 5) ctx.fillText(`${db} dB`, 2, Yp(db) + 4);
  const colors = { '0.01': '#64748b', '0.001': '#94a3b8', '0.0001': '#f87171' };
  for (const [k, v2] of Object.entries(f.thresholds_db)) { ctx.strokeStyle = colors[k]; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(Xp(200), Yp(v2)); ctx.lineTo(Xp(4000), Yp(v2)); ctx.stroke(); ctx.fillStyle = colors[k]; ctx.fillText(`Pfa ${k}`, W - 80, Yp(v2) - 3); }
  ctx.setLineDash([]); ctx.fillStyle = '#38bdf8';
  f.bistatic_range_m.forEach((r, i) => { if (r > 200) { ctx.beginPath(); ctx.arc(Xp(r), Yp(ys[i]), 2.2, 0, 2 * Math.PI); ctx.fill(); } });
  ctx.strokeStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(Xp(250), Yp(f.fit.intercept_db + f.fit.slope_db_per_decade * lx(250))); ctx.lineTo(Xp(3500), Yp(f.fit.intercept_db + f.fit.slope_db_per_decade * lx(3500))); ctx.stroke();
  ctx.strokeStyle = '#34d399'; ctx.beginPath(); ctx.moveTo(Xp(1600), 8); ctx.lineTo(Xp(1600), H - mb); ctx.stroke();
  ctx.fillStyle = '#34d399'; ctx.fillText('paper: ~1600 m', Xp(1600) + 4, 20);
}

// ------------------------------------------------------------------ new-run form
const fmt = { n_listeners: (v) => v, altitude_agl_m: (v) => `${v} m`, cit_s: (v) => `${(+v).toFixed(1)} s`, network_load: (v) => `${Math.round(v * 100)}%`, max_illuminators: (v) => v, cochannel_suppression_db: (v) => `${v} dB` };
function setForm(values) {
  const f = $('runForm');
  for (const [k, v] of Object.entries(values)) {
    const el = f.elements[k];
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    const out = el.parentElement.querySelector('output');
    if (out && fmt[k]) out.textContent = fmt[k](v);
  }
}
function initForm() {
  const f = $('runForm');
  fillSelect($('f_site'), Object.keys(X.sites).map((k) => [k, `${X.sites[k].name} (${X.sites[k].type})`]), state.site);
  fillSelect($('f_drone'), Object.entries(apiMeta.drones).map(([k, d]) => [k, d.name]), state.drone);
  fillSelect($('f_design'), Object.keys(X.designs).map((k) => [k, designName(k)]), designFor(state.radio));
  const d = apiMeta.defaults;
  setForm({ n_listeners: state.n || 8, altitude_agl_m: state.req.height_m, cochannel_suppression_db: state.interf, network_load: d.network_load, cit_s: 0.8, max_illuminators: d.max_illuminators, adc_bits: 12, pointing: 'inward', bird: true });
  f.querySelectorAll('input[type=range]').forEach((el) => el.addEventListener('input', () => setForm({ [el.name]: el.value })));
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const params = {};
    for (const el of f.elements) {
      if (!el.name || ['id', 'site', 'design'].includes(el.name)) continue;
      params[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    }
    Object.assign(params, X.designs[f.elements.design.value].params);
    $('runBtn').disabled = true;
    $('runStatus').textContent = 'starting…';
    const res = await fetch('/api/run', { method: 'POST', body: JSON.stringify({ site: f.elements.site.value, params, id: f.elements.id.value }) });
    const body = await res.json();
    if (!res.ok) { $('runStatus').textContent = body.error; $('runBtn').disabled = false; return; }
    const bar = f.querySelector('.progress'); bar.hidden = false;
    const poll = setInterval(async () => {
      const j = await (await fetch(`/api/job/${body.job}`)).json();
      bar.firstElementChild.style.width = j.total ? `${(100 * j.done) / j.total}%` : '2%';
      $('runStatus').textContent = j.status === 'running' ? `simulating ${j.done}/${j.total || '…'} frames` : j.status;
      if (j.status !== 'running') {
        clearInterval(poll); $('runBtn').disabled = false; bar.hidden = true;
        if (j.status === 'finished') { await refreshRuns(); $('runSelect').value = j.run_id; replayNote = ''; await loadRun(j.run_id); $('runStatus').textContent = `finished: ${j.run_id}`; }
        else $('runStatus').textContent = `failed: ${j.error}`;
      }
    }, 1500);
  };
}

// Precomputed replays (tools/make_replays.py): one per facility x drone x radio, at the recommended sensor count.
// bladeRF and B210 share one: the same radio in the model.
const replayId = (siteK, drone, radio) => `replay-${siteK}-${drone}-${radio === 'custom' ? 'custom' : 'ots'}`;
async function loadReplay() {
  const r = replays?.replays.find((x) => x.id === replayId($('rpSite').value, $('rpDrone').value, $('rpRadio').value));
  if (!r || !r.metrics) { loadSeq++; $('runSummary').innerHTML = '<span class="bad">This replay has not been computed yet</span> (run tools/make_replays.py).'; return; }
  const radio = $('rpRadio').value, t = replays.targets;
  replayNote = `<b>${r.n} × ${esc(RADIO[radio].name)} sensors</b>: ${r.meets ? `the fewest that meet ${t.area_pct}% area and ${t.tracked_pct}% tracked` : `the best tried; nothing meets ${t.area_pct}% area and ${t.tracked_pct}% tracked`}, with ${r.interference_db} dB of interference removal${r.interference_db > X.axes.interference[0] ? ' (unproven)' : " (today's assumption)"}.${radio === 'b210' ? ' The B210 behaves like the bladeRF in the model, so it shares this replay.' : ''} These full simulations use the microphone version of the sensor: background history is not in the full simulation yet.<br>`;
  await loadRun(r.id);
}
async function refreshRuns() {
  let idx = { runs: [] };
  try { idx = await (await fetch(`${RUN_DIR}index.json`, { cache: 'no-store' })).json(); } catch { /* static deploy without a run list */ }
  try { replays = await (await fetch(`${RUN_DIR}replays.json`, { cache: 'no-store' })).json(); } catch { replays = null; }
  runsIndex = idx.runs.filter((r) => r.params?.antenna && r.params.antenna !== 'iso' && !r.id.startsWith('replay-')); // v0.2 runs live in the archive
  const name = (r) => `${r.id} · ${X.sites[r.scenario]?.name || r.scenario} · ${r.drone}`;
  $('runSelect').innerHTML = runsIndex.map((r) => `<option value="${esc(r.id)}">${esc(name(r))}</option>`).join('');
}

function resize() {
  const { clientWidth: wd, clientHeight: ht } = view;
  if (!wd || !ht) return;
  renderer.setSize(wd, ht); labels.setSize(wd, ht);
  camera.aspect = wd / ht; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);
let lastT = performance.now();
function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.1);
  lastT = t;
  if (active && run) {
    if (playing) { tNow += dt * +$('speed').value; if (tNow > run.frames[run.frames.length - 1].t) tNow = 0; }
    drawFrame();
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }
  requestAnimationFrame(loop);
}

export function setActive(on) { active = on; if (on) resize(); }
export async function initViewer(meta) {
  apiMeta = meta;
  await refreshRuns();
  fillSelect($('rpSite'), Object.keys(X.sites).map((k) => [k, `${X.sites[k].name} (${X.sites[k].type})`]), state.site);
  fillSelect($('rpDrone'), Object.entries(X.drones).map(([k, d]) => [k, d.name]), state.drone);
  fillSelect($('rpRadio'), RADIO_KEYS.map((r) => [r, `${RADIO[r].name} (${RADIO[r].kind})`]), state.radio);
  for (const id of ['rpSite', 'rpDrone', 'rpRadio']) $(id).onchange = loadReplay;
  $('runSelect').onchange = () => { replayNote = '<b>Saved run</b> (not one of the replays above).<br>'; loadRun($('runSelect').value); };
  $('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; };
  $('timeline').oninput = (e) => { tNow = +e.target.value; };
  $('showCoverage').onchange = (e) => { if (coverageMesh) coverageMesh.visible = e.target.checked; };
  $('showAllTowers').onchange = buildTowers;
  $('showBeams').onchange = (e) => { beamGroup.visible = e.target.checked; };
  if (apiMeta) initForm();
  else { $('runForm').querySelectorAll('input,select,button').forEach((e) => (e.disabled = true)); $('runStatus').textContent = 'Start serve.py to run new simulations.'; }
  const q = new URLSearchParams(location.search);
  pinned = !!runsIndex.find((r) => r.id === q.get('run')); // a run named in the link wins on first open
  if (pinned) { $('runSelect').value = q.get('run'); await loadRun(q.get('run')); }
  else if (replays) await loadReplay();
  else if (runsIndex.length) { await loadRun(runsIndex.find((r) => r.id === 'seed-m210')?.id || runsIndex[0].id); $('runSelect').value = run.id; }
  if (q.get('t')) { tNow = +q.get('t'); playing = false; $('play').textContent = 'Play'; }
  requestAnimationFrame(loop);
}
export function showRunFor(siteKeyWanted) {
  if (pinned) { pinned = false; return; }
  // Follow the facility, drone and radio picked in the other tabs.
  if (!replays) return;
  const want = [siteKeyWanted, state.drone, state.radio];
  if (['rpSite', 'rpDrone', 'rpRadio'].every((id, i) => $(id).value === want[i]) && run?.id?.startsWith('replay-')) return;
  $('rpSite').value = want[0]; $('rpDrone').value = want[1]; $('rpRadio').value = want[2];
  loadReplay();
}
