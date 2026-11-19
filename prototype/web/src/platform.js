// v0.6 Platform tab: which signal works where, the GPS jammer locator, heat-camera ranges and the contraband-drop walkthrough.
// Data: runs/platform_v06.json (tools/broadcast_study.py, tools/platform_demo.py).
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => (v === null || v === undefined ? '–' : `${Math.round(v)}%`);
const SITE_NAMES = { hays: 'Hays State Prison', hancock: 'Hancock State Prison', fulton: 'Fulton County Jail', clemson: 'Clemson Memorial Stadium' };
const DRONE_NAMES = { mavic: '0.9 kg (Mavic class)', m210: '5 kg (Matrice 210 class)' };
const st = { drone: 'mavic', n: 6, gSite: 'hays', gN: 6, gClock: 'csac' };
let D = null;

function seg(host, items, get, set) {
  host.innerHTML = items.map(([v, l]) => `<button class="ghost small${get() === v ? ' on' : ''}" data-v="${v}">${esc(l)}</button>`).join(' ');
  host.querySelectorAll('button').forEach((b) => (b.onclick = () => { set(isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v); render(); }));
}

function renderSignals() {
  seg($('plDrone'), [['mavic', DRONE_NAMES.mavic], ['m210', DRONE_NAMES.m210]], () => st.drone, (v) => (st.drone = v));
  seg($('plN'), [[6, '6 sensors'], [12, '12 sensors']], () => st.n, (v) => (st.n = v));
  const rows = Object.entries(D.broadcast.sites).map(([k, s]) => {
    const c = s.cases.find((x) => x.drone === st.drone && x.sensors === st.n) || {};
    const tv = c.tv || {}, fm = c.fm || {};
    const best = (tv.located_pct || 0) >= 90 ? 'TV' : ((c.cell_20db || {}).located_pct || 0) >= 90 ? 'Cell' : 'Needs 40 dB or TV';
    return `<tr><td class="l"><b>${esc(SITE_NAMES[k])}</b><br><span class="note small">${esc(s.type)} · ${s.tv_count} TV, ${s.fm_count} FM transmitters</span></td>
      <td>${pct((c.cell_20db || {}).located_pct)}</td><td>${pct((c.cell_40db || {}).located_pct)}</td>
      <td><b>${pct(tv.located_pct)}</b>${tv.median_error_m ? `<br><span class="note small">~${Math.round(tv.median_error_m)} m</span>` : ''}</td>
      <td>${pct(fm.detected_pct)}<br><span class="note small">warning only</span></td><td>${best}</td></tr>`;
  }).join('');
  $('plSignals').innerHTML = `<thead><tr><th class="l">Site</th><th>Cell towers, 20 dB (today)</th><th>Cell towers, 40 dB</th><th>Digital TV</th><th>FM radio</th><th>Best signal</th></tr></thead><tbody>${rows}</tbody>`;
  const cal = D.broadcast.calibration;
  $('plSignalsNote').innerHTML = `Share of the protected zone (fence + 150 m, drone at 60 m) where the drone is <b>located</b> (seen by 3 or more transmitter-sensor pairs), with our own 8-channel receiver. Cell towers: the twin's full design-point model. Digital TV and FM: a link-budget estimate with the FCC's licensed transmitters around each site, the same calibrated losses, a noise floor held 20 dB above thermal (measured ATSC passive radar: 6-20 dB, Garry et al. 2017) and a ${D.broadcast.error_floor_m} m error floor. US TV channels are allotted so that stations sharing a channel are far apart, so TV has far fewer same-frequency neighbors than cell towers (some remain: Barott &amp; Himed 2015). <b>No drone has yet been detected with US digital TV in published work;</b> the evidence is European and Chinese DVB-T and DTMB trials (0.2-5 km). <b>Not modeled yet:</b> receiver overload next to megawatt transmitters (Fulton is 6 km from an 869 kW station), hovering drones in the zero-Doppler clutter notch, and ATSC reference rebuild quality: Seed measurements. FM resolves range only to about 1.5 km, so it can warn but not place a drone.`;
  void cal;
}

function drawJamMap() {
  const key = `${st.gSite}|${st.gN}|10|${st.gClock}`, m = D.gnss.maps[key], cv = $('plJamMap');
  if (!m || !cv) return;
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, n = m.n, cell = Math.min(W, H) / n, span = m.step_m * n;
  const px = (x) => ((x - m.x0 + m.step_m / 2) / span) * n * cell, py = (y) => H - ((y - m.x0 + m.step_m / 2) / span) * n * cell;
  ctx.clearRect(0, 0, W, H);
  const col = (e) => (e === null ? '#E2DED6' : e <= 25 ? '#2E6B45' : e <= 100 ? '#7FA88A' : e <= 300 ? '#D9C79A' : '#D9480F');
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.fillStyle = col(m.error_m[i][j]); ctx.fillRect(j * cell, H - (i + 1) * cell, cell - 1, cell - 1); }
  ctx.strokeStyle = '#141517'; ctx.lineWidth = 2; ctx.beginPath();
  m.fence.forEach(([x, y], k) => (k ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y)))); ctx.stroke();
  ctx.fillStyle = '#141517'; m.sensors.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(px(x), py(y), 4, 0, 7); ctx.fill(); });
}

function renderGnss() {
  seg($('plGSite'), [['hays', 'Hays'], ['fulton', 'Fulton']], () => st.gSite, (v) => (st.gSite = v));
  seg($('plGN'), [[6, '6 sensors'], [12, '12 sensors']], () => st.gN, (v) => (st.gN = v));
  seg($('plGClock'), [['csac', 'Chip-scale atomic clock'], ['ocxo', 'Oven crystal clock']], () => st.gClock, (v) => (st.gClock = v));
  drawJamMap();
  const cs = D.gnss.cases.filter((c) => c.site === st.gSite && c.sensors === st.gN && c.clock === st.gClock);
  const where = [...new Set(cs.map((c) => c.where))];
  $('plGnssTable').innerHTML = `<thead><tr><th class="l">Jammer</th><th>Power</th><th>Sensors that hear it</th><th>Time differences only</th><th>+ bearings</th></tr></thead><tbody>` +
    where.flatMap((w) => [10, 30].map((p) => {
      const a = cs.find((c) => c.where === w && c.power_dbm === p && c.mode === 'tdoa') || {}, b = cs.find((c) => c.where === w && c.power_dbm === p && c.mode === 'tdoa+aoa') || {};
      const f = (r) => (r.error_m === null || r.error_m === undefined ? 'cannot place' : `${Math.round(r.error_m)} m${r.fail_pct ? ` (${Math.round(r.fail_pct)}% fail)` : ''}`);
      return `<tr><td class="l">${esc(w)}</td><td>${p === 10 ? '10 mW (car jammer)' : '1 W'}</td><td>${a.detected ?? '–'}</td><td>${f(a)}</td><td><b>${f(b)}</b></td></tr>`;
    })).join('') + '</tbody>';
}

function renderThermal() {
  const r = D.thermal.ranges;
  $('plThermal').innerHTML = `<thead><tr><th class="l">Drone · lens</th><th>Detect</th><th>Recognise</th><th>Identify</th></tr></thead><tbody>` +
    Object.entries(r).map(([k, v]) => { const [d, c] = k.split('|'); return `<tr><td class="l">${esc(DRONE_NAMES[d])} · ${esc(c)}</td><td>${v.detect} m</td><td>${v.recognise} m</td><td>${v.identify} m</td></tr>`; }).join('') + '</tbody>';
}

function renderWalk() {
  const w = D.walkthrough;
  $('plWalkHead').innerHTML = `${esc(w.site)} · ${esc(w.drone)} at ${w.speed_mps} m/s · our own receiver, 4 sensors, today's 20 dB · the twin's full signal replay (${esc(w.replay)}): tracked ${w.metrics.track_availability_pct}% of the time inside the zone, ${w.metrics.median_error_m} m median error. <b>${w.warning_before_fence_s} s of warning before the drone crosses the fence.</b>`;
  $('plWalk').innerHTML = w.events.map((e) => `<li class="ev ${e.kind}"><span class="t">${Math.round(e.t)} s</span><span class="who">${esc(e.who)}</span><span>${esc(e.what)}</span></li>`).join('');
  $('plCases').innerHTML = w.cases.map((c) => `<div class="panel-card"><h3>${esc(c.where)}</h3><p class="note">${esc(c.what)}</p><p><b>${esc(c.lesson)}</b></p></div>`).join('');
}

function render() { if (!D) return; renderSignals(); renderGnss(); renderThermal(); renderWalk(); }

export async function initPlatform() {
  try { D = await (await fetch('runs/platform_v06.json')).json(); } catch { D = null; }
  if (!D) { const t = $('tab-platform'); if (t) t.querySelector('.page').innerHTML = '<p class="note">Run tools/broadcast_study.py and tools/platform_demo.py to create runs/platform_v06.json.</p>'; return; }
  render();
}
