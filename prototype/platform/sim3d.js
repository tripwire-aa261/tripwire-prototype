// 3D view for the flight simulator: real terrain, buildings and registered towers (data/sites/<id>/, as the v0.5.1
// twin's 3D viewer), with the simulator's drone, echoes and track from data/flights.json. Loaded only when the
// 3D view is chosen, so the rest of the app works without WebGL or the three.js CDN.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const SITES_DIR = '../data/sites/';
const SENSOR_H = 6;        // sensors on ~6 m poles (decision in force)
let host, renderer, labels, scene, camera, controls, followBtn;
let siteId = null, siteDoc = null, gridC = null, gridF = null, elev0 = 0, centre = [0, 0], follow = true, loading = null;
const siteG = new THREE.Group(), txG = new THREE.Group(), dyn = new THREE.Group();

// ------------------------------------------------------------------ terrain
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
const inGrid = (g, x, y) => x >= g.x0 && y >= g.y0 && x <= g.x0 + g.step * (g.nx - 1) && y <= g.y0 + g.step * (g.ny - 1);
const ground = (x, y) => (inGrid(gridF, x, y) ? bilinear(gridF, x, y) : bilinear(gridC, x, y));
const w = (x, y, z) => new THREE.Vector3(x, z - elev0, -y);   // site metres (x east, y north, z elevation) -> scene

function terrainMesh(g, stride, drop) {
  const nx = Math.floor((g.nx - 1) / stride) + 1, ny = Math.floor((g.ny - 1) / stride) + 1;
  const pos = new Float32Array(nx * ny * 3), col = new Float32Array(nx * ny * 3);
  const lo = new THREE.Color(0x24412d), mid = new THREE.Color(0x4a5c3c), hi = new THREE.Color(0x857f62), c = new THREE.Color();
  for (let i = 0; i < ny; i++) for (let j = 0; j < nx; j++) {
    const k = i * nx + j, z = g.z[(i * stride) * g.nx + j * stride];
    pos.set([g.x0 + j * stride * g.step, z - elev0 - drop, -(g.y0 + i * stride * g.step)], k * 3);
    const t = Math.min(Math.max((z - elev0 + 40) / 220, 0), 1);
    c.copy(lo).lerp(mid, Math.min(t * 2, 1)).lerp(hi, Math.max(t * 2 - 1, 0));
    col.set([c.r, c.g, c.b], k * 3);
  }
  const idx = [];
  for (let i = 0; i < ny - 1; i++) for (let j = 0; j < nx - 1; j++) { const a = i * nx + j, b = a + 1, d = a + nx, e = d + 1; idx.push(a, b, d, b, e, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
}
function label(text, cls = '') {
  const el = document.createElement('div'); el.className = `label3d ${cls}`; el.textContent = text;
  return new CSS2DObject(el);
}
function disposeGroup(g) {
  g.traverse((o) => { o.geometry?.dispose?.(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose?.()); if (o.isCSS2DObject) o.element.remove(); });
  g.clear();
}

// ------------------------------------------------------------------ scene
export function init(el) {
  if (renderer) return;
  host = el;
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  labels = new CSS2DRenderer();
  Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  host.appendChild(labels.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e151d);
  scene.fog = new THREE.Fog(0x0e151d, 4500, 14000);
  camera = new THREE.PerspectiveCamera(45, 1, 2, 60000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2.08;
  controls.addEventListener('start', () => { follow = false; followBtn.classList.remove('on'); });
  scene.add(new THREE.HemisphereLight(0xdbeaff, 0x26323f, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(-3000, 4000, 2000); scene.add(sun);
  scene.add(siteG, txG, dyn);
  followBtn = document.createElement('button');
  followBtn.className = 'follow3d on'; followBtn.textContent = 'Follow drone';
  followBtn.onclick = () => { follow = !follow; followBtn.classList.toggle('on', follow); };
  host.appendChild(followBtn);
  const resize = () => { const W = host.clientWidth, H = W; if (!W) return; host.style.height = H + 'px'; renderer.setSize(W, H); labels.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(host); resize();
  const loop = () => { requestAnimationFrame(loop); if (!host.offsetParent) return; controls.update(); renderer.render(scene, camera); labels.render(scene, camera); };
  loop();
}

// Site: terrain, buildings, fence, the simulator's towers, TV stations by direction and sensors.
export function setSite(id, g, sig) {
  const key = `${id}|${sig}|${g.n}`;
  if (loading && loading.key === key) return loading.p;
  const prev = loading ? loading.p.catch(() => {}) : Promise.resolve();   // one site build at a time
  const p = prev.then(async () => {
    const dir = `${SITES_DIR}${id}/`;
    if (siteId !== id) {
      const [s, towers] = await Promise.all([fetch(dir + 'site.json').then((r) => r.json()), fetch(dir + 'towers.json').then((r) => r.json()).catch(() => ({ towers: [] }))]);
      siteDoc = { ...s, towers: towers.towers || [] };
      elev0 = s.origin.elev_m;
      [gridC, gridF] = await Promise.all([loadGrid(dir, s.terrain.coarse), loadGrid(dir, s.terrain.fine)]);
      siteId = id;
      disposeGroup(siteG);
      siteG.add(terrainMesh(gridC, 2, 3), terrainMesh(gridF, 1, 0));
      const fence = s.fence;
      centre = [fence.reduce((a, q) => a + q[0], 0) / fence.length, fence.reduce((a, q) => a + q[1], 0) / fence.length];
      // fence as a glowing ribbon, 4 m high
      const pts = [], idx = [];
      fence.forEach(([x, y], k) => { const z = ground(x, y); pts.push(w(x, y, z + 0.5), w(x, y, z + 4.5)); if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k); });
      const fg = new THREE.BufferGeometry().setFromPoints(pts); fg.setIndex(idx);
      siteG.add(new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })));
      siteG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fence.map(([x, y]) => w(x, y, ground(x, y) + 4.5))), new THREE.LineBasicMaterial({ color: 0xf8fafc })));
      const mat = new THREE.MeshLambertMaterial({ color: 0x8f9bab });
      for (const b of s.buildings || []) {
        const shape = new THREE.Shape(b.poly.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)));
        for (const h of b.holes || []) shape.holes.push(new THREE.Path(h.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y))));
        const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: b.height_m, bevelEnabled: false }), mat);
        m.rotation.x = -Math.PI / 2; m.position.y = ground(b.poly[0][0], b.poly[0][1]) - elev0;
        siteG.add(m);
      }
      const lab = label(s.name);
      lab.position.copy(w(centre[0], Math.max(...fence.map((q) => q[1])) + 60, ground(centre[0], centre[1]) + 60));
      siteG.add(lab);
      controls.target.copy(w(centre[0], centre[1], ground(centre[0], centre[1])));
      camera.position.copy(w(centre[0] + 600, centre[1] - 900, ground(centre[0], centre[1]) + 550));
      follow = true; followBtn.classList.add('on');
    }
    // towers, TV stations and sensors for this build
    disposeGroup(txG);
    const towerMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 });
    g.towers.forEach(([x, y]) => {
      const t = siteDoc.towers.reduce((best, q) => { const d = Math.hypot(q.x - x, q.y - y); return d < best.d ? { d, q } : best; }, { d: 80, q: null }).q;
      const h = t?.height_agl_m || 40, z = ground(x, y);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(3, 8, h, 6), towerMat); mast.position.copy(w(x, y, z + h / 2)); txG.add(mast);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 8), new THREE.MeshBasicMaterial({ color: 0x7dd3fc })); tip.position.copy(w(x, y, z + h + 6)); txG.add(tip);
      const l = label(`cell tower · ${(Math.hypot(x - centre[0], y - centre[1]) / 1000).toFixed(1)} km`, 'rx'); l.position.copy(w(x, y, z + h + 40)); txG.add(l);
    });
    if (sig.includes('tv')) {
      const z0 = ground(centre[0], centre[1]);
      g.tv.forEach((t) => {   // tens of km away: shown by direction, 2.6 km out and 250 m up
        const a = (t.bearing_deg * Math.PI) / 180, x = centre[0] + 2600 * Math.sin(a), y = centre[1] + 2600 * Math.cos(a);
        const s = new THREE.Mesh(new THREE.SphereGeometry(28, 16, 12), new THREE.MeshBasicMaterial({ color: 0xc4b5fd })); s.position.copy(w(x, y, z0 + 250)); txG.add(s);
        const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([w(x, y, z0 + 250), w(centre[0], centre[1], z0 + 60)]),
          new THREE.LineDashedMaterial({ color: 0xc4b5fd, dashSize: 40, gapSize: 30, transparent: true, opacity: 0.5 }));
        ln.computeLineDistances(); txG.add(ln);
        const l = label(`TV ${t.call} · ${Math.round(t.distance_km)} km this way`, 'tx'); l.position.copy(w(x, y, z0 + 310)); txG.add(l);
      });
    }
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    g.sensors.forEach(([x, y]) => {
      const z = ground(x, y);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, SENSOR_H, 6), poleMat); pole.position.copy(w(x, y, z + SENSOR_H / 2)); txG.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), new THREE.MeshBasicMaterial({ color: 0x38bdf8 })); head.position.copy(w(x, y, z + SENSOR_H + 3)); txG.add(head);
    });
  });
  loading = { key, p };
  return p;
}

// ------------------------------------------------------------------ the flight, frame by frame
const droneObj = (() => {
  const gr = new THREE.Group(), s = 30, mat = new THREE.MeshBasicMaterial({ color: 0xfb7185 });
  gr.add(new THREE.Mesh(new THREE.BoxGeometry(0.35 * s, 0.14 * s, 0.35 * s), mat));
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.05 * s, 0.06 * s), mat); arm.rotation.y = Math.atan2(dz, dx); arm.position.set(dx * 0.17 * s, 0, dz * 0.17 * s); gr.add(arm);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 0.02 * s, 20), new THREE.MeshBasicMaterial({ color: 0xfecdd3, transparent: true, opacity: 0.55 }));
    r.position.set(dx * 0.34 * s, 0.07 * s, dz * 0.34 * s); gr.add(r);
  }
  const halo = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.15, depthWrite: false }));
  gr.add(halo);
  return gr;
})();
const droneLabel = label('drone', 'dr');
const dropLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xfb7185, dashSize: 6, gapSize: 6, transparent: true, opacity: 0.6 }));
const pathLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.4 }));
const cellLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 }));
const tvLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.9 }));
const locPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 10, vertexColors: true, sizeAttenuation: true }));
const trkBall = new THREE.Group();   // the track: a solid marker and a ring the size of the expected error
trkBall.add(new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0x34d399 })));
const trkRing = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, k) => new THREE.Vector3(Math.cos(k / 64 * 2 * Math.PI), 0, Math.sin(k / 64 * 2 * Math.PI)))), new THREE.LineBasicMaterial({ color: 0x34d399 }));
trkBall.add(trkRing);
const trkLabel = label('Tripwire track', 'trk');
dyn.add(droneObj, droneLabel, dropLine, pathLine, cellLines, tvLines, locPts, trkBall, trkLabel);

export function update({ g, geo, run, i, height }) {
  if (!gridF || !run) { dyn.visible = false; return; }
  dyn.visible = true;
  const H = height || 60, at = (x, y, dz = H) => w(x, y, ground(x, y) + dz);
  const [dx, dy] = geo.xy[i], dp = at(dx, dy);
  droneObj.position.copy(dp);
  if (i + 1 < geo.xy.length) droneObj.rotation.y = Math.atan2(-(geo.xy[i + 1][1] - dy), geo.xy[i + 1][0] - dx);
  droneLabel.position.copy(dp.clone().add(new THREE.Vector3(0, 34, 0)));
  droneLabel.element.textContent = geo.inside[i] ? 'drone · over the site' : `drone · ${geo.fence_m[i].toLocaleString('en-US')} m to the fence`;
  dropLine.geometry.setFromPoints([dp, at(dx, dy, 0)]); dropLine.computeLineDistances();
  pathLine.geometry.setFromPoints(geo.xy.slice(0, i + 1).map(([x, y]) => at(x, y)));
  const c = [], t = [];
  g.sensors.forEach(([x, y], j) => {
    const head = at(x, y, SENSOR_H + 3);
    if ((run.cell[i] >> j) & 1) c.push(head, dp);
    if ((run.tv[i] >> j) & 1) t.push(head, dp);
  });
  cellLines.geometry.setFromPoints(c); tvLines.geometry.setFromPoints(t);
  const pts = [], cols = [], green = new THREE.Color(0x34d399), amber = new THREE.Color(0xfbbf24);
  for (let k = Math.max(0, i - 80); k <= i; k++) {
    if (!run.loc[k]) continue;
    pts.push(at(run.est[k][0], run.est[k][1])); const cc = run.trk[k] ? green : amber; cols.push(cc.r, cc.g, cc.b);
  }
  locPts.geometry.setFromPoints(pts); locPts.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  trkBall.visible = trkLabel.visible = !!run.trk[i];
  if (run.trk[i]) {
    const e = at(run.est[i][0], run.est[i][1]), r = Math.max(12, run.err[i]);
    trkBall.position.copy(e); trkRing.scale.set(r, 1, r);
    trkLabel.position.copy(e.clone().add(new THREE.Vector3(0, r + 26, 0)));
    trkLabel.element.textContent = `Tripwire track · ±${Math.round(run.err[i])} m`;
  }
  if (follow) {   // keep the site and the drone in view
    const tgt = at((dx + centre[0]) / 2, (dy + centre[1]) / 2, 0);
    const shift = tgt.clone().sub(controls.target).multiplyScalar(0.15);
    controls.target.add(shift); camera.position.add(shift);
    const dist = Math.hypot(dx - centre[0], dy - centre[1]), want = Math.max(650, dist * 0.95 + 380);
    const off = camera.position.clone().sub(controls.target), len = off.length();
    camera.position.copy(controls.target.clone().add(off.multiplyScalar(1 + (want / len - 1) * 0.08)));
  }
}
