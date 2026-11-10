import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { initSweep } from './sweep.js';

const $ = (id) => document.getElementById(id);
const SITE_DIR = '../../../data/sites/hays-state-prison/';
const RUN_DIR = '../../runs/';
const DEFAULT_RUN = 'seed-m210';
const usd = (x) => (Math.abs(x) >= 1e6 ? `$${(x / 1e6).toFixed(1)}M` : `$${Math.round(x).toLocaleString('en-US')}`);
const fmtM = (x) => (x == null ? '—' : x >= 1000 ? `${(x / 1000).toFixed(2)} km` : `${Math.round(x)} m`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let site, towersDoc, elev0 = 0, gridC, gridF;
let run = null, rdBlob = null, calibration = null, apiMeta = null, runsIndex = [];
let tNow = 0, playing = true, rdListener = 0, econRadio = null;

// ---------------------------------------------------------------------------
// Terrain helpers
// ---------------------------------------------------------------------------
async function loadGrid(meta) {
  const buf = await (await fetch(SITE_DIR + meta.file)).arrayBuffer();
  const raw = new Int16Array(buf);
  const z = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) z[i] = raw[i] / 10;
  return { z, nx: meta.nx, ny: meta.ny, x0: meta.x0, y0: meta.y0, step: meta.step_m };
}
function bilinear(g, x, y) {
  const fx = Math.min(Math.max((x - g.x0) / g.step, 0), g.nx - 1.001);
  const fy = Math.min(Math.max((y - g.y0) / g.step, 0), g.ny - 1.001);
  const j = Math.floor(fx), i = Math.floor(fy), tx = fx - j, ty = fy - i;
  const a = g.z[i * g.nx + j], b = g.z[i * g.nx + j + 1], c = g.z[(i + 1) * g.nx + j], d = g.z[(i + 1) * g.nx + j + 1];
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}
function inside(g, x, y) {
  return x >= g.x0 && y >= g.y0 && x <= g.x0 + g.step * (g.nx - 1) && y <= g.y0 + g.step * (g.ny - 1);
}
function ground(x, y) { return inside(gridF, x, y) ? bilinear(gridF, x, y) : bilinear(gridC, x, y); }
// Model coords (x east, y north, z above sea level) -> three.js (x, up, -north), relative to the site.
const w = (x, y, z) => new THREE.Vector3(x, z - elev0, -y);

function distToPolygon(px, py, poly) {
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

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
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
  for (let i = 0; i < ny - 1; i++) for (let j = 0; j < nx - 1; j++) {
    const a = i * nx + j, b = a + 1, d = a + nx, e = d + 1;
    idx.push(a, b, d, b, e, d); // counter-clockwise seen from above, so faces point up
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
}

const towerGroup = new THREE.Group(), runGroup = new THREE.Group(), dyn = new THREE.Group(), beamGroup = new THREE.Group();
scene.add(towerGroup, runGroup, dyn);
let coverageMesh = null;

function buildSite() {
  scene.add(terrainMesh(gridC, 2, 3));
  scene.add(terrainMesh(gridF, 1, 0));
  const fence = site.fence.map(([x, y]) => w(x, y, ground(x, y) + 3));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fence), new THREE.LineBasicMaterial({ color: 0xe2e8f0 })));
  // Protected zone outline (fence + 150 m), traced on a polar sweep.
  const zone = [];
  for (let a = 0; a <= 360; a += 3) {
    const r0 = Math.cos((a * Math.PI) / 180), r1 = Math.sin((a * Math.PI) / 180);
    let lo = 0, hi = 1500;
    for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; (distToPolygon(m * r0, m * r1, site.fence) <= 150 ? (lo = m) : (hi = m)); }
    zone.push(w(lo * r0, lo * r1, ground(lo * r0, lo * r1) + 4));
  }
  const zl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(zone), new THREE.LineDashedMaterial({ color: 0xe2e8f0, dashSize: 14, gapSize: 10 }));
  zl.computeLineDistances();
  scene.add(zl);
  const mat = new THREE.MeshLambertMaterial({ color: 0x9aa5b4 });
  for (const b of site.buildings) {
    const pts = b.poly.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: b.height_m, bevelEnabled: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    const [cx, cy] = b.poly[0];
    m.position.y = ground(cx, cy) - elev0;
    scene.add(m);
  }
  const lab = label(`${site.name} (OpenStreetMap footprint)`);
  lab.position.copy(w(0, Math.max(...site.fence.map((p) => p[1])) + 40, ground(0, 0) + 40));
  scene.add(lab);
}

function buildTowers() {
  towerGroup.clear();
  const used = new Map();
  for (const ill of run?.illuminators || []) {
    const tid = ill.id.split(':')[0];
    used.set(tid, [...(used.get(tid) || []), ill.operator]);
  }
  for (const t of towersDoc.towers) {
    const on = used.has(t.id);
    if (!on && !$('showAllTowers').checked) continue;
    const g = ground(t.x, t.y), h = t.height_agl_m || 30;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(4, 9, h, 6), new THREE.MeshLambertMaterial({ color: on ? 0xa78bfa : 0x475569 }));
    mast.position.copy(w(t.x, t.y, g + h / 2));
    towerGroup.add(mast);
    const l = label(`${on ? used.get(t.id).join('+') + ' · ' : ''}${t.owner.slice(0, 24)} · ${(t.distance_m / 1000).toFixed(1)} km · ${Math.round(h)} m`, on ? 'tx' : 'txdim');
    l.position.copy(w(t.x, t.y, g + h + 25));
    towerGroup.add(l);
  }
}

// Drone & bird models (drawn larger than life so they are visible).
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
const droneLabel = label('drone (truth, drawn 14× size)'), birdLabel = label('bird');
const dropLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x64748b }));
const pairLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 }));
const fixPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xfacc15, size: 16, sizeAttenuation: true }));
const trkGroup = new THREE.Group();
dyn.add(drone, bird, droneLabel, birdLabel, dropLine, pairLines, fixPts, trkGroup);

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------
async function loadRun(id) {
  run = await (await fetch(`${RUN_DIR}${id}.json`, { cache: 'no-store' })).json();
  rdBlob = new Uint8Array(await (await fetch(`${RUN_DIR}${id}.bin`, { cache: 'no-store' })).arrayBuffer());
  runGroup.clear();
  beamGroup.clear();
  buildTowers();
  // Listeners
  for (const l of run.listeners) {
    const [x, y, z] = l.pos;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 18, 8), new THREE.MeshLambertMaterial({ color: 0x38bdf8 }));
    mast.position.copy(w(x, y, z - 9 + 9));
    const box = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 10), new THREE.MeshLambertMaterial({ color: 0x38bdf8, emissive: 0x0c4a6e }));
    box.position.copy(w(x, y, z + 9));
    const lab = label(l.id, 'rx');
    lab.position.copy(w(x, y, z + 26));
    runGroup.add(mast, box, lab);
    beamGroup.add(...beams(l));
  }
  beamGroup.visible = $('showBeams').checked;
  runGroup.add(beamGroup);
  // Truth paths
  for (const kind of ['drone', 'bird']) {
    if (!run.frames[0].truth[kind]) continue;
    const pts = run.frames.map((f) => w(...f.truth[kind].pos));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: kind === 'drone' ? 0xcbd5e1 : 0x64748b, dashSize: 10, gapSize: 8 }));
    line.computeLineDistances();
    runGroup.add(line);
  }
  buildCoverage();
  // Timeline
  const last = run.frames[run.frames.length - 1].t;
  $('timeline').max = last;
  tNow = 0;
  // Tabs for range-Doppler listeners
  rdListener = Math.min(rdListener, run.listeners.length - 1);
  $('rdTabs').innerHTML = run.listeners.map((l, i) => `<button data-i="${i}" class="${i === rdListener ? 'on' : ''}">${l.id}</button>`).join('');
  $('rdTabs').querySelectorAll('button').forEach((b) => (b.onclick = () => { rdListener = +b.dataset.i; $('rdTabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); drawFrame(true); }));
  showMetrics();
  drawCompare();
  const p = run.params;
  const proc = { crs_p0: 'reference signals, port 0', crs_all: 'all reference signals', full: 'full-signal processing' }[p.processing || 'crs_p0'];
  $('runSummary').innerHTML = `${esc(run.drone_model.name)} at ${p.altitude_agl_m} m · ${p.n_listeners} nodes, each ${esc(antennaText(p, run.listeners[0]))} · ${esc(proc)} · ${p.cit_s} s integration · ${p.adc_bits}-bit ADC${p.mic_range_m ? ` · microphones ${p.mic_range_m} m` : ''} · ${run.illuminators.length} LTE cells · network load ${p.network_load} · computed in ${run.runtime_s} s`;
  fillParamTable();
}

// Half-power beam of each face of a node, drawn as a flat translucent fan (omni: a ring).
const BEAM_R = 320;
function beams(l) {
  const a = l.antenna || { kind: 'iso', faces: [0], az_bw_deg: 360 };
  const [x, y, z] = l.pos, out = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: a.az_bw_deg >= 360 ? 0.07 : 0.16, side: THREE.DoubleSide, depthWrite: false });
  for (const az of a.faces) {
    const half = Math.min(a.az_bw_deg, 360) / 2, pts = [new THREE.Vector3(0, 0, 0)];
    for (let d = -half; d <= half + 1e-6; d += Math.max(2, half / 20)) {
      const r = ((az + d) * Math.PI) / 180;
      pts.push(new THREE.Vector3(BEAM_R * Math.sin(r), 0, -BEAM_R * Math.cos(r)));
    }
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
const ANT_NAMES = { iso: 'v0.2 model (gain toward every direction)', omni: 'omni', lpda: 'log-periodic', patch: 'patch', yagi: 'Yagi' };
function antennaText(p, l) {
  const a = l?.antenna;
  if (!a || a.kind === 'iso') return `${p.rx_elements} element(s) of ${p.rx_gain_dbi} dBi toward every direction (v0.2 model)`;
  const per = Math.max(1, Math.floor(a.elements / a.faces.length));
  const lay = a.kind === 'omni' ? `${a.elements} omnis in a circular array` : a.faces.length === 1 ? `${a.elements} × ${ANT_NAMES[a.kind]} in one array` : `${a.faces.length} faces × ${per} ${ANT_NAMES[a.kind]}`;
  return `${lay} (${a.gain_dbi} dBi, ${a.az_bw_deg >= 360 ? 'all-round' : a.az_bw_deg + '°'} each, +${a.array_gain_db.toFixed(1)} dB array gain), pointing ${p.pointing ?? 'inward'}`;
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

function setGate(el, pass, text) {
  el.classList.toggle('pass', pass);
  el.classList.toggle('fail', !pass);
  el.querySelector('span').textContent = `${pass ? 'PASS' : 'FAIL'} · ${text}`;
}

function showMetrics() {
  const m = run.metrics;
  setGate($('gateTrack'), m.gate_track_pass, `${m.track_availability_pct}%`);
  setGate($('gateReach'), m.gate_reach_pass, m.first_track_distance_m == null ? 'never tracked' : fmtM(m.first_track_distance_m));
  $('mZone').textContent = `${run.coverage.zone_located_pct.toFixed(0)}%`;
  $('mErr').textContent = m.median_error_m == null ? '—' : fmtM(m.median_error_m);
  $('mLoc').textContent = `${m.located_pct_all_frames}%`;
  $('mFalse').textContent = `${m.false_tracks} / ${m.bird_tracks}`;
  showEconomics();
}

function showEconomics() {
  const E = run.economics;
  if (!E) { $('eItems').textContent = 'This run predates the cost model: run python -m twin.run --rescore.'; return; }
  const radios = Object.keys(E.radios);
  if (!econRadio || !E.radios[econRadio]) econRadio = run.params.antenna === 'iso' || !run.params.antenna ? 'b210' : 'bladerf';
  $('radioTabs').innerHTML = radios.map((r) => `<button data-r="${r}" class="${r === econRadio ? 'on' : ''}">${esc(E.radios[r].name)} <span class="note">${esc(E.radios[r].stage)}</span></button>`).join('');
  $('radioTabs').querySelectorAll('button').forEach((b) => (b.onclick = () => { econRadio = b.dataset.r; showEconomics(); }));
  const R = E.radios[econRadio], F = R.facility, Z = E.zone;
  setGate($('gateHw'), F.hardware_gate_pass, usd(F.hardware_per_zone));
  setGate($('gateMargin'), F.install_margin >= Z.install_margin_target, `${Math.round(100 * F.install_margin)}%`);
  $('eNode').textContent = usd(R.node.total);
  $('eFac').textContent = usd(F.hardware_facility);
  $('eZones').textContent = `${F.zones} × ${usd(Z.install_price_usd)}`;
  $('eCust').textContent = usd(F.customer_5yr);
  const names = { receiver: 'radios', gnss_timing: 'GNSS timing', clock_distribution: 'clock distribution', computer: 'computer', antennas: 'antennas', enclosure_power_mast: 'enclosure, power, mast', microphones: 'microphones' };
  $('eItems').innerHTML = `Per node: ${Object.entries(R.node.items).map(([k, v]) => `${names[k] || k} ${usd(v)}`).join(' · ')}. ` +
    `Prices from the Seed data package: ${usd(Z.install_price_usd)} per zone installed + ${usd(Z.subscription_usd_per_year)}/yr; a zone = ${Z.nodes_per_zone} nodes, so this facility is billed ${F.zones} zone(s). ` +
    `Customer ${Z.years}-yr cost is ${F.vs_incumbent}× the memo's ~${usd(Z.incumbent_usd)} incumbent package. Sources: Sources & assumptions.`;
}

function drawCompare() {
  const rows = runsIndex.map((r) => {
    const m = r.metrics, p = r.params || {};
    const ant = !p.antenna || p.antenna === 'iso' ? 'v0.2 model' : `${p.rx_elements}× ${p.antenna}${p.faces > 1 ? `, ${p.faces} faces` : ''}`;
    const proc = p.processing === 'full' ? ' · full signal' : p.processing === 'crs_all' ? ' · all CRS' : '';
    return `<tr data-id="${esc(r.id)}" class="${run && r.id === run.id ? 'on' : ''}"><td>${esc(r.id)}<br><span class="note">${esc(r.drone)} · ${p.n_listeners} nodes · ${esc(ant)}${proc}${p.mic_range_m ? ' · mics' : ''}</span></td>
      <td>${m.track_availability_pct}%</td><td>${r.zone_located_pct == null ? '—' : r.zone_located_pct.toFixed(0) + '%'}</td><td>${m.false_tracks}</td></tr>`;
  }).join('');
  $('cmp').innerHTML = `<tr><th>Run</th><th>Track avail.</th><th>Zone located</th><th>False trk</th></tr>${rows}`;
  $('cmp').querySelectorAll('tr[data-id]').forEach((tr) => (tr.onclick = () => { $('runSelect').value = tr.dataset.id; loadRun(tr.dataset.id); }));
}

// ---------------------------------------------------------------------------
// Per-frame drawing
// ---------------------------------------------------------------------------
function frameAt(t) {
  const f = run.frames, dt = run.params.frame_dt_s;
  const i = Math.min(Math.floor(t / dt), f.length - 1);
  return { i, a: f[i], b: f[Math.min(i + 1, f.length - 1)], u: Math.min(Math.max((t - f[i].t) / dt, 0), 1) };
}
const lerp3 = (p, q, u) => p.map((v, k) => v + (q[k] - v) * u);
let lastFrameIdx = -1;

function drawFrame(force = false) {
  if (!run) return;
  const { i, a, b, u } = frameAt(tNow);
  const dp = lerp3(a.truth.drone.pos, b.truth.drone.pos, u);
  const pos = w(...dp);
  drone.position.copy(pos);
  drone.children.forEach((c, k) => { if (k) c.rotation.y += 0.8; });
  droneLabel.position.copy(pos).add(new THREE.Vector3(0, 22, 0));
  dropLine.geometry.setFromPoints([pos, w(dp[0], dp[1], ground(dp[0], dp[1]))]);
  if (a.truth.bird) {
    const bp = lerp3(a.truth.bird.pos, b.truth.bird.pos, u);
    bird.position.copy(w(...bp));
    birdLabel.position.copy(w(...bp)).add(new THREE.Vector3(0, 16, 0));
    bird.visible = birdLabel.visible = true;
  } else bird.visible = birdLabel.visible = false;
  $('timeline').value = tNow;
  $('timeLabel').textContent = `t = ${tNow.toFixed(1)} s of ${run.frames[run.frames.length - 1].t.toFixed(0)} s · frame ${i + 1}/${run.frames.length}`;
  if (i === lastFrameIdx && !force) return;
  lastFrameIdx = i;
  // Lines from listeners that detect the drone on at least one cell in this frame.
  const seg = [];
  const heard = new Set(a.drone_hits.map((h, pi) => (h ? run.pairs[pi].rx : -1)).filter((x) => x >= 0));
  for (const li of heard) seg.push(w(...run.listeners[li].pos).add(new THREE.Vector3(0, 9, 0)), w(...a.truth.drone.pos));
  pairLines.geometry.setFromPoints(seg);
  fixPts.geometry.setFromPoints(a.fixes.map((f) => w(...f.pos)));
  // Tracks (trail = this track's history up to now)
  trkGroup.clear();
  for (const tr of a.tracks) {
    const hist = run.frames.slice(0, i + 1).flatMap((f) => f.tracks.filter((x) => x.id === tr.id).map((x) => w(...x.pos)));
    if (hist.length > 1) trkGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hist), new THREE.LineBasicMaterial({ color: 0xfb7185 })));
    const s = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfb7185 }));
    s.position.copy(w(...tr.pos));
    const l = label(`track ${tr.id} · ${tr.label}`, 'trk');
    l.position.copy(w(...tr.pos)).add(new THREE.Vector3(0, 20, 0));
    trkGroup.add(s, l);
  }
  // HUD
  const d = a.truth.drone.pos;
  const nearTrack = a.tracks.some((tr) => Math.hypot(tr.pos[0] - d[0], tr.pos[1] - d[1]) < 60);
  const nearFix = a.fixes.some((f) => Math.hypot(f.pos[0] - d[0], f.pos[1] - d[1]) < 60);
  const nHits = a.drone_hits.reduce((s, h) => s + h, 0);
  const state = nearTrack ? ['TRACKED', 'trk'] : nearFix ? ['LOCATED', 'trk'] : nHits ? ['DETECTED', 'det'] : ['NOT SEEN', 'lost'];
  $('hudState').className = `pill ${state[1]}`;
  $('hudState').textContent = state[0];
  const nearest = Math.min(...run.listeners.map((l) => Math.hypot(l.pos[0] - d[0], l.pos[1] - d[1], l.pos[2] - d[2])));
  const hover = Math.hypot(...a.truth.drone.vel) < 0.1;
  $('hudDetail').textContent = `${nHits}/${run.pairs.length} cell-node pairs detect the drone · ${a.fixes.length} fix(es) · ${a.tracks.length} track(s) · nearest node ${fmtM(nearest)}${hover ? ' · HOVERING (zero Doppler: cancelled with the direct signal)' : ''}`;
  drawRD(i);
}

// Range-Doppler map
const LUT = (() => {
  const stops = [[0, 0, 4, 20], [0.25, 59, 15, 112], [0.5, 140, 41, 129], [0.75, 222, 73, 104], [1, 252, 253, 191]];
  const out = new Uint8Array(256 * 3);
  for (let v = 0; v < 256; v++) {
    const t = v / 255, k = stops.findIndex((s) => s[0] >= t), s1 = stops[Math.max(k, 1)], s0 = stops[Math.max(k, 1) - 1];
    const u = (t - s0[0]) / (s1[0] - s0[0]);
    for (let c = 0; c < 3; c++) out[v * 3 + c] = s0[c + 1] + (s1[c + 1] - s0[c + 1]) * u;
  }
  return out;
})();
const rdOff = document.createElement('canvas');

function drawRD(fi) {
  const ax = run.rd.axes, rows = ax.range[2], cols = ax.doppler[2];
  const off = (fi * run.rd.per_frame + rdListener) * rows * cols;
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
  const X = (nu) => ml + ((nu - d0) / (dmax - d0)) * pw, Y = (r) => 6 + ph - (r / rmax) * ph;
  ctx.fillStyle = '#8396a8'; ctx.font = '10px system-ui';
  for (const nu of [-150, -75, 0, 75, 150]) ctx.fillText(`${nu}`, X(nu) - 8, H - 8);
  for (const r of [0, 500, 1000, 1500]) ctx.fillText(`${r}`, 2, Y(r) + 3);
  ctx.fillText('Hz', W - 18, H - 8); ctx.save(); ctx.translate(10, 60); ctx.rotate(-Math.PI / 2); ctx.restore();
  const f = run.frames[fi], pi = f.rd_pairs[rdListener], pr = run.pairs[pi], ill = run.illuminators[pr.ill];
  const [tr, tnu, tsnr] = f.pair_truth[pi];
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  if (tr < rmax && Math.abs(tnu) < 150) { ctx.beginPath(); ctx.arc(X(tnu), Y(tr), 8, 0, 2 * Math.PI); ctx.stroke(); }
  ctx.strokeStyle = '#facc15';
  for (const [r, nu] of f.dets[pi]) if (r < rmax && Math.abs(nu) < 150) ctx.strokeRect(X(nu) - 4, Y(r) - 4, 8, 8);
  $('rdHint').textContent = `${run.listeners[pr.rx].id} × ${ill.operator}`;
  $('rdNote').innerHTML = `Pair: ${esc(run.listeners[pr.rx].id)} with ${esc(ill.label)}. Bistatic range (m, vertical) vs Doppler (Hz). White circle = drone truth (expected SNR ${tsnr.toFixed(1)} dB after processing); yellow squares = CFAR detections (${f.dets[pi].length}). Colour: ${run.rd.db_range[0]} to ${run.rd.db_range[1]} dB above noise.`;
  const n = pr.noise, parts = [['thermal', 'Thermal'], ['quantisation', 'ADC quantisation'], ['residue', 'Cancellation residue'], ['cochannel', 'Co-channel cells']];
  const top = Math.max(...parts.map(([k]) => n[k]));
  $('noiseBar').innerHTML = `<div class="note">Noise floor for this pair (dBW per resource element; widest = dominant):</div>` + parts.map(([k, name]) => {
    const v = n[k], width = Math.max(0, Math.min(100, ((v + 190) / (top + 190)) * 100));
    return `<div class="nb ${v === top ? 'dom' : ''}"><span>${name}</span><div><i style="width:${width}%"></i></div><span>${v < -300 ? 'none' : v.toFixed(0)}</span></div>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------
function fillParamTable() {
  const src = run.param_sources;
  $('srcTable').innerHTML = run.assumptions.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('');
  $('paramTable').innerHTML = Object.entries(run.params).filter(([k]) => src[k]).map(([k, v]) =>
    `<tr><td>${esc(src[k][0])}</td><td>${esc(v ?? (k === 'lumped_loss_db' ? run.lumped_loss_db.toFixed(1) + ' (calibrated)' : 'calibrated'))}</td><td>${esc(src[k][1])}</td></tr>`).join('');
  $('dataTable').innerHTML = [...site.sources, ...towersDoc.sources].map((s) => `<tr><td colspan="3">${esc(s)}</td></tr>`).join('');
}

function drawCalibration() {
  if (!calibration) { $('calBody').innerHTML = '<p class="note">calibration.json not found. Run <code>python -m twin.calibrate</code>.</p>'; return; }
  const c = calibration, v = c.validation;
  const simRows = Object.entries(v.simulated).map(([k, x]) => `<tr><td>${esc(k)}</td><td>${x.pd_pct}%</td><td>${x.range_error_m ? `${x.range_error_m[0]} ± ${x.range_error_m[1]} m` : '—'}</td></tr>`).join('');
  const paperRows = Object.entries(v.paper_table1_pd_pct).map(([k, x]) => `${esc(k)}: ${x}%`).join(' · ');
  $('calBody').innerHTML = `
    <div class="kv"><span>Lumped echo loss (fitted)</span><b>${c.lumped_loss_db.toFixed(1)} dB</b>
      <span>Direct-signal cancellation depth (fitted)</span><b>${c.dpi_residual_db.toFixed(0)} dB</b>
      <span>Fig. 11 max range at Pfa 1e-4: simulated / paper</span><b>${Math.round(c.figure11_calibrated.max_range_m)} m / ~1600 m</b></div>
    <h3>Table 1 trial (two eNodeBs ~10 km away, 4 Yagis, drone at 30 m)</h3>
    <table><tr><th>Simulated</th><th>Pd at Pfa 0.008</th><th>Range error</th></tr>${simRows}</table>
    <p class="note small">Paper: ${paperRows}; range error ${esc(v.paper_range_error_m)}.</p>
    <p class="note small"><b>Fit status:</b> ${esc(c.fit_status)}</p>
    <p class="note small">${esc(c.method)}</p>
    <h3>Fig. 11 reproduction (calibrated)</h3>`;
  const f = c.figure11_calibrated, cv = $('fig11'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height, ml = 44, mb = 28;
  ctx.fillStyle = '#18222d'; ctx.fillRect(0, 0, W, H);
  const lx = (r) => Math.log10(r), xmin = lx(200), xmax = lx(4000);
  const ys = f.cut_db, ymin = Math.min(...ys, ...Object.values(f.thresholds_db)) - 2, ymax = Math.max(...ys) + 2;
  const X = (r) => ml + ((lx(r) - xmin) / (xmax - xmin)) * (W - ml - 10), Y = (db) => H - mb - ((db - ymin) / (ymax - ymin)) * (H - mb - 10);
  ctx.fillStyle = '#8396a8'; ctx.font = '11px system-ui';
  for (const r of [300, 500, 1000, 2000, 3000]) { ctx.fillText(`${r} m`, X(r) - 14, H - 8); }
  for (let db = Math.ceil(ymin / 5) * 5; db < ymax; db += 5) ctx.fillText(`${db} dB`, 2, Y(db) + 4);
  const colors = { '0.01': '#64748b', '0.001': '#94a3b8', '0.0001': '#f87171' };
  for (const [k, v2] of Object.entries(f.thresholds_db)) {
    ctx.strokeStyle = colors[k]; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(X(200), Y(v2)); ctx.lineTo(X(4000), Y(v2)); ctx.stroke();
    ctx.fillStyle = colors[k]; ctx.fillText(`Pfa ${k}`, W - 80, Y(v2) - 3);
  }
  ctx.setLineDash([]);
  ctx.fillStyle = '#38bdf8';
  f.bistatic_range_m.forEach((r, i) => { if (r > 200) { ctx.beginPath(); ctx.arc(X(r), Y(ys[i]), 2.2, 0, 2 * Math.PI); ctx.fill(); } });
  ctx.strokeStyle = '#facc15'; ctx.beginPath();
  ctx.moveTo(X(250), Y(f.fit.intercept_db + f.fit.slope_db_per_decade * lx(250)));
  ctx.lineTo(X(3500), Y(f.fit.intercept_db + f.fit.slope_db_per_decade * lx(3500))); ctx.stroke();
  ctx.strokeStyle = '#34d399'; ctx.beginPath(); ctx.moveTo(X(1600), 8); ctx.lineTo(X(1600), H - mb); ctx.stroke();
  ctx.fillStyle = '#34d399'; ctx.fillText('paper: ~1600 m', X(1600) + 4, 20);
  ctx.fillStyle = '#facc15'; ctx.fillText('fit through multipath peaks', ml + 6, 20);
}

// ---------------------------------------------------------------------------
// New simulation form (needs serve.py)
// ---------------------------------------------------------------------------
const PRESETS = {
  seed: { n_listeners: 8, antenna: 'omni', rx_elements: 4, faces: 1, pointing: 'inward', processing: 'full', mic_range_m: 100, cit_s: 0.8, adc_bits: 12 },
  a: { n_listeners: 8, antenna: 'omni', rx_elements: 8, faces: 1, pointing: 'inward', processing: 'full', mic_range_m: 0, cit_s: 0.8, adc_bits: 12 },
  v02: { n_listeners: 8, antenna: 'iso', rx_elements: 4, faces: 1, rx_gain_dbi: 10, processing: 'crs_p0', mic_range_m: 0, cit_s: 0.8, adc_bits: 12 },
};
const fmt = { n_listeners: (v) => v, rx_gain_dbi: (v) => `${v} dBi`, cit_s: (v) => `${(+v).toFixed(1)} s`, altitude_agl_m: (v) => `${v} m`, network_load: (v) => `${Math.round(v * 100)}%`, max_illuminators: (v) => v, mic_range_m: (v) => (+v ? `${v} m` : 'none') };
function setForm(values) {
  const f = $('runForm');
  for (const [k, v] of Object.entries(values)) {
    const el = f.elements[k];
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    const out = el.parentElement.querySelector('output');
    if (out && fmt[k]) out.textContent = fmt[k](v);
  }
  $('gainRow').style.display = f.elements.antenna.value === 'iso' ? '' : 'none';
}
function initForm(defaults, drones, antennas, processing) {
  $('f_drone').innerHTML = Object.values(drones).map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  $('f_antenna').innerHTML = Object.entries(antennas).map(([k, a]) => `<option value="${k}">${esc(a.name)} · ${a.gain_dbi} dBi${a.az_bw_deg < 360 ? `, ${a.az_bw_deg}°` : ''}</option>`).join('') + '<option value="iso">v0.2 model: gain toward every direction</option>';
  $('f_processing').innerHTML = Object.entries(processing).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('');
  setForm({ ...defaults, ...PRESETS.seed });
  const f = $('runForm');
  f.querySelectorAll('input[type=range]').forEach((el) => el.addEventListener('input', () => setForm({ [el.name]: el.value })));
  f.elements.antenna.onchange = () => setForm({});
  $('presetSeed').onclick = () => setForm(PRESETS.seed);
  $('presetA').onclick = () => setForm(PRESETS.a);
  $('presetV02').onclick = () => setForm(PRESETS.v02);
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const params = {};
    for (const el of f.elements) {
      if (!el.name || el.name === 'id') continue;
      params[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    }
    $('runBtn').disabled = true;
    $('runStatus').textContent = 'starting…';
    const res = await fetch('/api/run', { method: 'POST', body: JSON.stringify({ params, id: f.elements.id.value }) });
    const body = await res.json();
    if (!res.ok) { $('runStatus').textContent = body.error; $('runBtn').disabled = false; return; }
    const bar = f.querySelector('.progress'); bar.hidden = false;
    const poll = setInterval(async () => {
      const j = await (await fetch(`/api/job/${body.job}`)).json();
      bar.firstElementChild.style.width = j.total ? `${(100 * j.done) / j.total}%` : '2%';
      $('runStatus').textContent = j.status === 'running' ? `simulating frame ${j.done}/${j.total || '…'} (all cell-node pairs, full signal chain)` : j.status;
      if (j.status !== 'running') {
        clearInterval(poll); $('runBtn').disabled = false; bar.hidden = true;
        if (j.status === 'finished') { await refreshRuns(); $('runSelect').value = j.run_id; await loadRun(j.run_id); $('runStatus').textContent = `finished: ${j.run_id}`; }
        else $('runStatus').textContent = `failed: ${j.error}`;
      }
    }, 1500);
  };
}

async function refreshRuns() {
  const idx = await (await fetch(`${RUN_DIR}index.json`, { cache: 'no-store' })).json();
  runsIndex = idx.runs.filter((r) => (r.scenario || 'hays') === 'hays');
  $('runSelect').innerHTML = runsIndex.map((r) => `<option value="${esc(r.id)}">${esc(r.id)}</option>`).join('');
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function resize() {
  const { clientWidth: wd, clientHeight: ht } = view;
  renderer.setSize(wd, ht); labels.setSize(wd, ht);
  camera.aspect = wd / ht; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);

let lastT = performance.now();
function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.1);
  lastT = t;
  if (run && playing) {
    tNow += dt * +$('speed').value;
    if (tNow > run.frames[run.frames.length - 1].t) tNow = 0;
  }
  drawFrame();
  controls.update();
  renderer.render(scene, camera);
  labels.render(scene, camera);
  requestAnimationFrame(loop);
}

async function boot() {
  site = await (await fetch(SITE_DIR + 'site.json')).json();
  towersDoc = await (await fetch(SITE_DIR + 'towers.json')).json();
  elev0 = site.origin.elev_m;
  [gridC, gridF] = await Promise.all([loadGrid(site.terrain.coarse), loadGrid(site.terrain.fine)]);
  $('siteName').textContent = `${site.name}, ${site.place} · real terrain (USGS 3DEP), buildings (OSM), ${towersDoc.towers.length} FCC-registered towers`;
  buildSite();
  try { apiMeta = await (await fetch('/api/meta')).json(); } catch { apiMeta = null; }
  try { calibration = apiMeta?.calibration || (await (await fetch(`${RUN_DIR}calibration.json`)).json()); } catch { calibration = null; }
  if (false) { initForm(apiMeta.defaults, apiMeta.drones, apiMeta.antennas, apiMeta.processing); }
  else { $('runForm').querySelectorAll('input,select,button').forEach((e) => (e.disabled = true)); $('liveHint').textContent = '(archived version: read-only)'; }
  await refreshRuns();
  $('runSelect').onchange = () => loadRun($('runSelect').value);
  $('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; };
  $('timeline').oninput = (e) => { tNow = +e.target.value; };
  $('showCoverage').onchange = (e) => { if (coverageMesh) coverageMesh.visible = e.target.checked; };
  $('showAllTowers').onchange = buildTowers;
  $('showBeams').onchange = (e) => { beamGroup.visible = e.target.checked; };
  initSweep(null);
  $('openCal').onclick = () => { drawCalibration(); $('calDlg').showModal(); };
  $('openSources').onclick = () => $('srcDlg').showModal();
  // ?run=<id>&t=<seconds> opens a specific run and moment (handy for sharing).
  const q = new URLSearchParams(location.search);
  const want = q.get('run') || DEFAULT_RUN;
  if (runsIndex.length) await loadRun(runsIndex.find((r) => r.id === want)?.id || runsIndex[0].id);
  if (run) $('runSelect').value = run.id;
  if (q.get('t')) { tNow = +q.get('t'); playing = false; $('play').textContent = 'Play'; }
  resize();
  requestAnimationFrame(loop);
}
boot();
