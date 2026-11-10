import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  ILLUMINATORS, DRONES, DEFAULTS, makeConfig, evaluateGrid, evaluatePoint, detectionReach,
  trackAvailability, transmitters, placeListeners, distToRect, THRESHOLD_DB,
} from './physics.js';
import { economics, ECON_DEFAULTS, ECON_INPUTS } from './economics.js';
import { SITE, FLIGHT_WAYPOINTS } from './site.js';
import { PHYSICS_ROWS, ECON_ROWS } from './assumptions.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const PARAM_KEYS = ['illumId', 'droneId', 'listeners', 'rxGainDbi', 'altitudeM', 'tIntS', 'cancelDb'];
const params = Object.fromEntries(PARAM_KEYS.map((k) => [k, DEFAULTS[k]]));
const econ = { ...ECON_DEFAULTS };
const DRONE_DRAW_SCALE = 20; // drone drawn larger than life so it is visible from far away
const SIM_SPEED = 4; // flight plays at 4x real time
const DRONE_SPEED = 15; // m/s, ASSUMPTION

const $ = (id) => document.getElementById(id);
const usd = (x) => (Math.abs(x) >= 1e6 ? `$${(x / 1e6).toFixed(1)}M` : `$${Math.round(x).toLocaleString('en-US')}`);
const pct = (x) => `${x.toFixed(0)}%`;
const m = (x) => (x == null ? '—' : x >= 1000 ? `${(x / 1000).toFixed(2)} km` : `${x.toFixed(0)} m`);

// Model coords (x east, y north, z up) -> three.js (x right, y up, z towards viewer).
const w = (x, y, z = 0) => new THREE.Vector3(x, z, -y);

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
const view = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
view.appendChild(renderer.domElement);
const labels = new CSS2DRenderer();
labels.domElement.style.position = 'absolute';
labels.domElement.style.inset = '0';
labels.domElement.style.pointerEvents = 'none';
view.appendChild(labels.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1016);
scene.fog = new THREE.Fog(0x0b1016, 3500, 7000);
const camera = new THREE.PerspectiveCamera(45, 1, 1, 20000);
camera.position.set(-1300, 1500, 1900);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.maxPolarAngle = Math.PI / 2.05;
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xbcd7ff, 0x1a2430, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(-800, 1500, 600);
scene.add(sun);

// Ground and grid
const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshLambertMaterial({ color: 0x1b2620 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const grid = new THREE.GridHelper(8000, 80, 0x2a3a33, 0x22302a);
grid.position.y = 0.2;
scene.add(grid);

function label(text, cls = '') {
  const el = document.createElement('div');
  el.className = `label3d ${cls}`;
  el.textContent = text;
  return new CSS2DObject(el);
}

// Site: yard, buildings, fence, protected zone outline
const siteGroup = new THREE.Group();
scene.add(siteGroup);
{
  const y = SITE.yard;
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(y.w, y.d), new THREE.MeshLambertMaterial({ color: 0x3b4a3f }));
  yard.rotation.x = -Math.PI / 2;
  yard.position.copy(w(y.x, y.y, 0.4));
  siteGroup.add(yard);
  const colors = { housing: 0x8a94a3, admin: 0x9aa7b5, services: 0x7d8794, tower: 0xb0b8c2 };
  for (const b of SITE.buildings) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), new THREE.MeshLambertMaterial({ color: colors[b.kind] }));
    mesh.position.copy(w(b.x, b.y, b.h / 2));
    siteGroup.add(mesh);
  }
  const f = SITE.fence;
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  for (const [x, yy, len, rot] of [
    [f.cx, f.cy + f.hh, 2 * f.hw, 0], [f.cx, f.cy - f.hh, 2 * f.hw, 0],
    [f.cx + f.hw, f.cy, 2 * f.hh, Math.PI / 2], [f.cx - f.hw, f.cy, 2 * f.hh, Math.PI / 2],
  ]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, 5), fenceMat);
    wall.position.copy(w(x, yy, 2.5));
    wall.rotation.y = rot;
    siteGroup.add(wall);
  }
  // Protected zone: fence + buffer, a rounded rectangle.
  const pts = [];
  const B = SITE.bufferM;
  const corners = [[f.hw, f.hh, 0], [-f.hw, f.hh, 90], [-f.hw, -f.hh, 180], [f.hw, -f.hh, 270]];
  for (const [cx, cy, a0] of corners) {
    for (let a = a0; a <= a0 + 90; a += 5) {
      const r = (a * Math.PI) / 180;
      pts.push(w(f.cx + cx + B * Math.cos(r), f.cy + cy + B * Math.sin(r), 1));
    }
  }
  pts.push(pts[0].clone());
  const zone = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xe2e8f0, dashSize: 12, gapSize: 8 }));
  zone.computeLineDistances();
  siteGroup.add(zone);
  const zl = label('Protected zone (fence + 150 m)');
  zl.position.copy(w(f.cx, f.cy - f.hh - B, 4));
  siteGroup.add(zl);
}

// Coverage map texture (rebuilt on every parameter change)
let coverageTex = null;
const coverageMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
);
coverageMesh.rotation.x = -Math.PI / 2;
coverageMesh.position.y = 0.8;
coverageMesh.renderOrder = 1;
scene.add(coverageMesh);

// Transmitters and listeners (rebuilt on change)
const txGroup = new THREE.Group();
const rxGroup = new THREE.Group();
scene.add(txGroup, rxGroup);
const TX_DRAW_MAX = 2600; // far stations are drawn at this distance, labelled with the true one

function txDrawPos(tx) {
  if (tx.sat) return w(tx.dir.x * 2400, tx.dir.y * 2400, tx.dir.z * 2400);
  const k = Math.min(1, TX_DRAW_MAX / tx.distM);
  return w(tx.x * k, tx.y * k, 0);
}

function buildTransmitters(illum) {
  txGroup.clear();
  for (const tx of transmitters(illum)) {
    const p = txDrawPos(tx);
    if (tx.sat) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([w(0, 0, 0), p]), new THREE.LineDashedMaterial({ color: 0xa78bfa, dashSize: 40, gapSize: 30 }));
      line.computeLineDistances();
      txGroup.add(line);
      const sat = new THREE.Mesh(new THREE.BoxGeometry(60, 30, 30), new THREE.MeshLambertMaterial({ color: 0xa78bfa }));
      sat.position.copy(p);
      txGroup.add(sat);
      const l = label(`${tx.label} · 37,500 km`, 'tx');
      l.position.copy(p).add(new THREE.Vector3(0, 60, 0));
      txGroup.add(l);
      continue;
    }
    const h = Math.max(illum.towerHeightM, 35) * 2; // drawn 2x tall for visibility
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(3, 8, h, 6), new THREE.MeshLambertMaterial({ color: 0xa78bfa }));
    mast.position.copy(p).add(new THREE.Vector3(0, h / 2, 0));
    txGroup.add(mast);
    const far = tx.distM > TX_DRAW_MAX ? ` · ${(tx.distM / 1000).toFixed(0)} km away` : '';
    const l = label(`${tx.label}${far}`, 'tx');
    l.position.copy(p).add(new THREE.Vector3(0, h + 20, 0));
    txGroup.add(l);
  }
}

let listenerPts = [];
function buildListeners(n) {
  rxGroup.clear();
  listenerPts = placeListeners(SITE.fence, n);
  for (const l of listenerPts) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, l.z * 3, 8), new THREE.MeshLambertMaterial({ color: 0x38bdf8 }));
    mast.position.copy(w(l.x, l.y, (l.z * 3) / 2));
    const box = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 8), new THREE.MeshLambertMaterial({ color: 0x38bdf8, emissive: 0x0c4a6e }));
    box.position.copy(w(l.x, l.y, l.z * 3));
    const lab = label(l.label, 'rx');
    lab.position.copy(w(l.x, l.y, l.z * 3 + 14));
    rxGroup.add(mast, box, lab);
  }
}

// Drone and flight path
const drone = new THREE.Group();
{
  const s = DRONE_DRAW_SCALE;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18 * s, 0.07 * s, 0.18 * s), new THREE.MeshLambertMaterial({ color: 0xf8fafc }));
  drone.add(body);
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02 * s, 0.02 * s, 0.25 * s), new THREE.MeshLambertMaterial({ color: 0x94a3b8 }));
    arm.position.set(dx * 0.06 * s, 0, dz * 0.06 * s);
    arm.rotation.y = Math.atan2(dx, dz);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.08 * s, 0.005 * s, 16), new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.5 }));
    rotor.position.set(dx * 0.12 * s, 0.04 * s, dz * 0.12 * s);
    drone.add(arm, rotor);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(10, 13, 32), new THREE.MeshBasicMaterial({ color: 0xf8fafc, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  drone.add(ring);
}
scene.add(drone);
const droneLabel = label('drone (drawn 20× size)');
scene.add(droneLabel);
const dropLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x64748b }));
scene.add(dropLine);
const pairLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 }));
scene.add(pairLines);

let curve, pathLine, pathLen, pathSamples;
function buildPath() {
  curve = new THREE.CatmullRomCurve3(FLIGHT_WAYPOINTS.map(([x, y]) => new THREE.Vector3(x, y, 0)));
  pathLen = curve.getLength();
  pathSamples = curve.getSpacedPoints(Math.round(pathLen / 5)).map((v) => ({ x: v.x, y: v.y }));
  if (pathLine) scene.remove(pathLine);
  const pts = pathSamples.map((p) => w(p.x, p.y, params.altitudeM));
  pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x94a3b8, dashSize: 10, gapSize: 10, transparent: true, opacity: 0.6 }));
  pathLine.computeLineDistances();
  scene.add(pathLine);
}

// Track estimates: noisy positions where the drone is tracked
const MAX_TRACK = 4000;
const trackGeom = new THREE.BufferGeometry();
trackGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TRACK * 3), 3));
trackGeom.setDrawRange(0, 0);
const trackPts = new THREE.Points(trackGeom, new THREE.PointsMaterial({ color: 0xf87171, size: 7, sizeAttenuation: true }));
scene.add(trackPts);
let trackCount = 0;

// ---------------------------------------------------------------------------
// Model evaluation and UI
// ---------------------------------------------------------------------------
let cfg, txs;

function paintCoverage(g) {
  const { n, state } = g;
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    const y = -g.halfM + (j + 0.5) * g.stepM;
    for (let i = 0; i < n; i++) {
      const x = -g.halfM + (i + 0.5) * g.stepM;
      const k = j * n + i, o = k * 4;
      const inZone = distToRect(x, y, SITE.fence) <= SITE.bufferM;
      if (state[k] === 2) data.set([52, 211, 153, inZone ? 150 : 70], o);
      else if (state[k] === 1) data.set([251, 191, 36, inZone ? 140 : 60], o);
      else if (inZone) data.set([248, 113, 113, 120], o);
    }
  }
  if (coverageTex) coverageTex.dispose();
  coverageTex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  coverageTex.magFilter = THREE.LinearFilter;
  coverageTex.needsUpdate = true;
  coverageMesh.material.map = coverageTex;
  coverageMesh.material.needsUpdate = true;
  coverageMesh.scale.set(2 * g.halfM, 2 * g.halfM, 1);
}

function setGate(el, pass, text) {
  el.classList.toggle('pass', pass);
  el.classList.toggle('fail', !pass);
  el.querySelector('span').textContent = `${pass ? 'PASS' : 'FAIL'} · ${text}`;
}

function recompute() {
  cfg = makeConfig(params);
  txs = transmitters(cfg.illum);
  buildTransmitters(cfg.illum);
  buildListeners(cfg.listeners);
  buildPath();

  const g = evaluateGrid(cfg, SITE, { halfM: 800, stepM: 16 });
  paintCoverage(g);
  const reach = detectionReach(cfg, SITE);
  const avail = trackAvailability(cfg, SITE, pathSamples);

  $('mReachMin').textContent = m(reach.minM);
  $('mReachMed').textContent = m(reach.medianM);
  $('mTracked').textContent = pct(g.trackedPct);
  $('mDetected').textContent = pct(g.detectedPct);
  $('mAvail').textContent = pct(avail.pct);
  $('mAcc').textContent = avail.medianAccM == null ? '—' : m(avail.medianAccM);
  setGate($('gateReach'), reach.minM >= 150, `worst ${m(reach.minM)}`);
  setGate($('gateTrack'), avail.pct >= 90, pct(avail.pct));

  updateEconomics();
  scheduleTornado();
  restartFlight();
}

function updateEconomics() {
  const e = economics(params.listeners, params.rxGainDbi, econ);
  $('eKitCost').textContent = usd(e.kitCost);
  $('eMargin').textContent = pct(e.hwMarginPct);
  $('eUpfront').textContent = usd(e.customerUpfront);
  $('eYearsLabel').textContent = `Customer total, ${econ.years} yr`;
  $('eTotal').textContent = usd(e.customerTotal);
  $('eTargetArr').textContent = usd(e.targetArr) + '/yr';
  $('eSamArr').textContent = usd(e.samArr) + '/yr';
  const max = Math.max(econ.incumbentUsd, e.customerTotal, econ.radarPanelUsd);
  const bars = [
    ['Tripwire upfront', e.customerUpfront, 'var(--accent)'],
    [`Tripwire ${econ.years}-yr total`, e.customerTotal, 'var(--accent)'],
    ['1 radar panel', econ.radarPanelUsd, '#64748b'],
    ['Incumbent package', econ.incumbentUsd, '#64748b'],
  ];
  $('compare').innerHTML = bars.map(([n, v, c]) =>
    `<div class="bar"><span>${n}</span><div class="track"><div class="fill" style="width:${(100 * v) / max}%;background:${c}"></div><span class="val">${usd(v)}</span></div></div>`,
  ).join('');
}

// Sensitivity ("tornado"): change one choice at a time, see zone tracked %.
let tornadoTimer = null;
function scheduleTornado() {
  clearTimeout(tornadoTimer);
  tornadoTimer = setTimeout(drawTornado, 250);
}
function drawTornado() {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const ids = Object.keys(DRONES);
  const di = ids.indexOf(params.droneId);
  const variants = [
    ['Listener count', { listeners: clamp(params.listeners - 2, 3, 12) }, { listeners: clamp(params.listeners + 2, 3, 12) }, '±2'],
    ['Antenna gain', { rxGainDbi: clamp(params.rxGainDbi - 5, 0, 15) }, { rxGainDbi: clamp(params.rxGainDbi + 5, 0, 15) }, '±5 dB'],
    ['Integration time', { tIntS: params.tIntS / 2 }, { tIntS: params.tIntS * 2 }, '÷2 / ×2'],
    ['Cancellation', { cancelDb: params.cancelDb - 10 }, { cancelDb: params.cancelDb + 10 }, '±10 dB'],
    ['Noise figure', { nfDb: DEFAULTS.nfDb + 3 }, { nfDb: DEFAULTS.nfDb - 3 }, '±3 dB'],
    ['Drone size', { droneId: ids[Math.max(di - 1, 0)] }, { droneId: ids[Math.min(di + 1, ids.length - 1)] }, 'one class'],
    ['Altitude', { altitudeM: clamp(params.altitudeM + 40, 20, 150) }, { altitudeM: clamp(params.altitudeM - 40, 20, 150) }, '±40 m'],
  ];
  const opts = { halfM: 800, stepM: 40 };
  const base = evaluateGrid(makeConfig(params), SITE, opts).trackedPct;
  const rows = variants.map(([name, lo, hi, step]) => ({
    name, step,
    lo: evaluateGrid(makeConfig({ ...params, ...lo }), SITE, opts).trackedPct,
    hi: evaluateGrid(makeConfig({ ...params, ...hi }), SITE, opts).trackedPct,
  })).sort((a, b) => Math.abs(b.hi - b.lo) - Math.abs(a.hi - a.lo));
  $('tornado').innerHTML = rows.map((r) => {
    const worse = Math.min(r.lo, r.hi, base), better = Math.max(r.lo, r.hi, base);
    return `<div class="t-row"><span class="t-name">${r.name} <small>(${r.step})</small></span>
      <div class="t-track">
        <div class="t-neg" style="left:${worse}%;width:${base - worse}%"></div>
        <div class="t-pos" style="left:${base}%;width:${better - base}%"></div>
        <div class="t-mid" style="left:${base}%"></div>
      </div><span class="t-range">${worse.toFixed(0)}–${better.toFixed(0)}%</span></div>`;
  }).join('') + `<p class="note" style="font-size:11px">Center line = current design (${base.toFixed(0)}% of protected zone tracked). Red = worse, green = better.</p>`;
}

// ---------------------------------------------------------------------------
// Flight animation
// ---------------------------------------------------------------------------
let playing = true, flightS = 0, lastT = performance.now(), lastTrackS = -1e9;
function restartFlight() {
  flightS = 0;
  trackCount = 0;
  trackGeom.setDrawRange(0, 0);
}

function gauss() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

function stepFlight(dt) {
  if (!curve) return;
  if (playing) flightS += DRONE_SPEED * SIM_SPEED * dt;
  if (flightS > pathLen) restartFlight();
  const p2 = curve.getPointAt(Math.min(flightS / pathLen, 1));
  const tgt = { x: p2.x, y: p2.y, z: params.altitudeM };
  const pos = w(tgt.x, tgt.y, tgt.z);
  drone.position.copy(pos);
  for (const c of drone.children) if (c.geometry?.type === 'CylinderGeometry') c.rotation.y += 0.9;
  droneLabel.position.copy(pos).add(new THREE.Vector3(0, 18, 0));
  dropLine.geometry.setFromPoints([pos, w(tgt.x, tgt.y, 0)]);

  const r = evaluatePoint(cfg, txs, listenerPts, tgt);
  // Lines from each listener that hears the drone on at least one transmitter.
  const seg = [];
  for (const rx of listenerPts) {
    const heard = txs.some((tx) => {
      const s = evaluatePoint({ ...cfg }, [tx], [rx], tgt).bestSnrDb;
      return s >= THRESHOLD_DB;
    });
    if (heard) seg.push(w(rx.x, rx.y, rx.z * 3), pos);
  }
  pairLines.geometry.setFromPoints(seg);

  const hud = $('hudState');
  hud.className = `pill ${r.state === 2 ? 'trk' : r.state === 1 ? 'det' : 'lost'}`;
  hud.textContent = r.state === 2 ? 'TRACKED' : r.state === 1 ? 'DETECTED' : 'NOT SEEN';
  const nearest = Math.min(...listenerPts.map((l) => Math.hypot(l.x - tgt.x, l.y - tgt.y, l.z - tgt.z)));
  $('hudDetail').textContent =
    `${r.pairs} pairs above threshold · best SNR ${r.bestSnrDb.toFixed(1)} dB · ${m(nearest)} to nearest listener` +
    (r.accM ? ` · ±${m(r.accM)}` : '') + ` · ${SIM_SPEED}× speed`;

  // Drop a noisy position estimate 4 times a second (simulated time) while tracked.
  if (r.state === 2 && flightS - lastTrackS > DRONE_SPEED * 0.25 && trackCount < MAX_TRACK) {
    lastTrackS = flightS;
    const e = r.accM;
    const attr = trackGeom.attributes.position;
    const est = w(tgt.x + gauss() * e, tgt.y + gauss() * e, tgt.z + gauss() * e * 0.5);
    attr.setXYZ(trackCount++, est.x, est.y, est.z);
    attr.needsUpdate = true;
    trackGeom.setDrawRange(0, trackCount);
  }
  if (flightS < lastTrackS) lastTrackS = -1e9;
}

function resize() {
  const { clientWidth: wd, clientHeight: ht } = view;
  renderer.setSize(wd, ht);
  labels.setSize(wd, ht);
  camera.aspect = wd / ht;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);

function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.1);
  lastT = t;
  stepFlight(dt);
  controls.update();
  renderer.render(scene, camera);
  labels.render(scene, camera);
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// Controls wiring
// ---------------------------------------------------------------------------
const fmt = {
  listeners: (v) => `${v}`,
  rxGainDbi: (v) => `${v} dBi`,
  altitudeM: (v) => `${v} m`,
  tIntS: (v) => `${(v * 1000).toFixed(0)} ms`,
  cancelDb: (v) => `${v} dB`,
};

function initControls() {
  $('siteName').textContent = `${SITE.name} · ${Object.keys(ILLUMINATORS).length} signal sources · no hardware, all simulated`;
  $('illumId').innerHTML = Object.values(ILLUMINATORS).map((i) => `<option value="${i.id}">${i.name}</option>`).join('');
  $('droneId').innerHTML = Object.values(DRONES).map((d) => `<option value="${d.id}">${d.name}</option>`).join('');
  let pending = null;
  const sync = () => {
    for (const k of PARAM_KEYS) {
      $(k).value = params[k];
      if (fmt[k]) $(`${k}Out`).textContent = fmt[k](params[k]);
    }
  };
  for (const k of PARAM_KEYS) {
    $(k).addEventListener('input', (ev) => {
      const v = ev.target.value;
      params[k] = k === 'illumId' || k === 'droneId' ? v : Number(v);
      if (fmt[k]) $(`${k}Out`).textContent = fmt[k](params[k]);
      $('busy').hidden = false;
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => { recompute(); $('busy').hidden = true; });
    });
  }
  $('reset').onclick = () => { for (const k of PARAM_KEYS) params[k] = DEFAULTS[k]; sync(); recompute(); };
  $('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; };
  $('restart').onclick = restartFlight;
  $('showCoverage').onchange = (ev) => { coverageMesh.visible = ev.target.checked; };
  sync();

  const row = (r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  $('physicsTable').innerHTML = PHYSICS_ROWS.map(row).join('');
  $('econTable').innerHTML = ECON_ROWS.map(row).join('');
  $('openSources').onclick = () => $('sourcesDlg').showModal();

  const drawEconForm = () => {
    $('econForm').innerHTML = ECON_INPUTS.map(([k, lab, , unit, src]) =>
      `<div class="erow"><label for="e_${k}" style="margin:0">${lab}${unit ? ` (${unit})` : ''}<small>${src}</small></label>
       <input type="number" id="e_${k}" value="${econ[k]}" step="any" /></div>`).join('');
    for (const [k] of ECON_INPUTS) {
      $(`e_${k}`).addEventListener('input', (ev) => {
        const v = Number(ev.target.value);
        if (Number.isFinite(v)) { econ[k] = v; updateEconomics(); }
      });
    }
  };
  $('openEcon').onclick = () => { drawEconForm(); $('econDlg').showModal(); };
  $('econReset').onclick = () => { Object.assign(econ, ECON_DEFAULTS); drawEconForm(); updateEconomics(); };
}

initControls();
resize();
recompute();
requestAnimationFrame(loop);
