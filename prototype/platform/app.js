// Tripwire platform prototype v1.0. Data: data/explore.json (twin/explore_v1.py), data/bom.json (twin/platform_bom.py),
// data/products.json, data/gnss.json, data/timeline.json (tools/platform_v1.py), data/flights.json (tools/flight_demo_v1.py).
import { zonesFor } from './searchzone.js';
import { renderHome } from './home.js';
import { initTour, startTour } from './tour.js';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const usd = (v) => (v === null || v === undefined ? '–' : v >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e4 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v).toLocaleString('en-US')}`);
const usd2 = (v) => `$${(+v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v) => (v === null || v === undefined ? '–' : `${Math.round(v)}%`);
const link = (u, t) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>` : esc(t));
const LINKS = {
  model: 'https://tripwire-aa261.github.io/tripwire-prototype/prototype/web/financial-model-v2.html',
  twin: 'https://tripwire-cyan.vercel.app',
  repo: 'https://github.com/tripwire-aa261/tripwire-prototype/tree/pivot-v1',
};
const SITE_ORDER = ['hays', 'hancock', 'fulton', 'clemson', 'robins', 'poe', 'event'];
const PRODUCT_NAMES = { site: 'Tripwire Site', large: 'Large-perimeter site', kit: 'Mobile kit' };
const DRONES = { mavic: '0.9 kg drone', m210: '5 kg drone' };
let E, B, P, G, T;
const st = { site: 'hays', drone: 'mavic', interf: 20, build: 'platform', n: null, gSite: 'robins', gClock: 'ocxo' };

async function load(name) { const r = await fetch(`data/${name}.json`); if (!r.ok) throw new Error(name); return r.json(); }

function seg(host, label, items, get, set) {
  host.innerHTML = `<span class="lab">${esc(label)}</span>` + items.map(([v, l]) => `<button class="${String(get()) === String(v) ? 'on' : ''}" data-v="${esc(v)}">${esc(l)}</button>`).join('');
  host.querySelectorAll('button').forEach((b) => (b.onclick = () => { set(b.dataset.v); renderAll(); }));
}

function rec(site, drone, interf) { return (E.recommended || {})[`${site}|${drone}|${interf}`] || {}; }
function row(site, drone, build, interf, n) {
  const b = E.builds[build];
  return E.results.find((r) => r.k[0] === site && r.k[1] === drone && r.k[2] === b.design && r.k[4] === +interf && r.k[5] === +n && (r.extra?.signals || 'cell') === b.signals);
}
const RI = () => E.radii.indexOf(E.default_req.radius_m);

// ---------------------------------------------------------------- Platform
function renderPlatform() {
  const s = B.sensor;
  $('pfKpis').innerHTML = [
    ['Sites simulated', '7', 'prisons, a jail, a stadium, a flightline, a port of entry, a city park'],
    ['Signals per sensor', '3 banks', '8 cell, 4 digital TV, 4 GPS channels'],
    ['Platform sensor cost', usd(s.total_usd), `at 1,000 units; v0.5 cell-only sensor ${usd(B.v05_sensor_usd)}`],
    ['Products', '5', 'site, large perimeter, mobile kit, sensor for integrators, GPS monitoring'],
  ].map(([a, b, c]) => `<div class="kpi"><small>${esc(a)}</small><b>${esc(b)}</b><span>${esc(c)}</span></div>`).join('');
  // Cell towers alone: the lowest interference removal at which the fewest sensors meet the requirements.
  const cellNeed = (k, d) => {
    for (const i of E.interference) { const c = rec(k, d, i).platform_cell; if (c && c.meets) return `${i === 20 ? '<span class="ok">today</span>' : `needs ${i} dB`} · ${c.n} sensors`; }
    const c = rec(k, d, E.interference[E.interference.length - 1]).platform_cell || {};
    return `<span class="bad">not met</span> even at 40 dB · best ${pct(c.cov)} covered with ${c.n}`;
  };
  const rows = SITE_ORDER.filter((k) => E.sites[k]).map((k) => {
    const s = E.sites[k], a = rec(k, 'mavic', 20).platform || {};
    const tv = a.n ? `${a.meets ? '<span class="ok">today</span>' : '<span class="bad">not met</span>'} · ${a.n} sensors · ${pct(a.cov)} covered` : '–';
    return `<tr><td class="l"><b>${esc(s.name)}</b><br><span class="note small">${esc(s.place)} · ${esc(s.type)} · ${s.fence_area_ha} ha</span></td><td class="l">${esc(PRODUCT_NAMES[s.product])}</td>
      <td class="l">${cellNeed(k, 'm210')}</td><td class="l">${cellNeed(k, 'mavic')}</td><td class="l">${tv}</td></tr>`;
  }).join('');
  $('pfSites').innerHTML = `<thead><tr><th class="l">Site</th><th class="l">Product</th><th class="l">Cell towers only<br>5 kg drone</th><th class="l">Cell towers only<br>0.9 kg drone</th><th class="l">Cell + digital TV<br>0.9 kg drone</th></tr></thead><tbody>${rows}</tbody>`;
  $('pfChanged').innerHTML = [
    '<b>A sensor that can hear the new signals.</b> The v0.5 sensor cut off above 850 MHz, so it could use neither digital TV (470-608 MHz) nor GPS (1,575 MHz). The platform sensor has three receive banks; see Sensor &amp; parts.',
    '<b>Digital TV in the twin\'s own simulation.</b> TV transmitter-sensor pairs now count toward coverage, accuracy and scored flights together with the cell pairs, instead of a separate estimate.',
    '<b>Three new sites for the products that bring most sales:</b> a military flightline and a port of entry (large-perimeter product) and a park during an event (mobile kit).',
    '<b>A flight simulator:</b> contraband flights at every site, frame by frame, with the sensors that hear the drone, the track and the alerts, for cell towers alone or cell + TV.',
    '<b>Every product costed from parts:</b> sensor counts from the twin, prices from financial model v2, benchmarks from published contracts.',
  ].map((x) => `<li>${x}</li>`).join('');
  $('pfReal').innerHTML = [
    '<b>Real data:</b> site outlines and buildings (OpenStreetMap), terrain (USGS 3DEP), cell towers (FCC antenna registrations), licensed TV and FM transmitters (FCC TV/FM Query), part prices (distributor pages, Nov 2026).',
    '<b>Simulated:</b> every drone echo, detection, track and jammer fix, and all business figures from 2027 on.',
    '<b>Assumed:</b> 20 dB of interference removal today; TV processing as good as the published European trials; TV noise floor 20 dB above thermal; the other values labeled ASSUMPTION in the parts list and the twin.',
    '<b>Not modeled yet:</b> receiver overload next to megawatt TV stations, hovering drones on TV, the bird-versus-drone classifier, Mexican TV and cell towers at the border site.',
  ].map((x) => `<li>${x}</li>`).join('');
}

// ---------------------------------------------------------------- Sites
function drawMap(m, site, cv = $('stMap')) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  if (!m) { ctx.fillStyle = '#8396a8'; ctx.font = '14px sans-serif'; ctx.fillText('No coverage map for this choice yet.', 14, 30); return; }
  const span = m.step * m.n, sc = Math.min(W, H) / span;
  const px = (x) => (x - m.x0 + m.step / 2) * sc, py = (y) => H - (y - m.y0 + m.step / 2) * sc;
  const col = { 0: '#1b2530', 1: '#8a6d1f', 2: '#2f8f6a' };
  for (let i = 0; i < m.n; i++) for (let j = 0; j < m.n; j++) {
    ctx.fillStyle = col[m.state[i * m.n + j]] || '#1b2530';
    ctx.fillRect(j * m.step * sc, H - (i + 1) * m.step * sc, m.step * sc + 0.5, m.step * sc + 0.5);
  }
  const fence = site.fence;
  ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 2; ctx.beginPath();
  fence.forEach(([x, y], k) => (k ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y)))); ctx.stroke();
  ctx.fillStyle = '#38bdf8'; ctx.strokeStyle = '#04121c'; ctx.lineWidth = 1.5;
  m.sensors.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(px(x), py(y), 5, 0, 7); ctx.fill(); ctx.stroke(); });
  ctx.fillStyle = '#dbe5ee'; ctx.font = '12px sans-serif';
  const bar = 500 * sc; ctx.fillRect(14, H - 18, bar, 3); ctx.fillText('500 m', 14, H - 24);
}

function renderSites() {
  const sites = SITE_ORDER.filter((k) => E.sites[k]);
  seg($('stSite'), 'Site', sites.map((k) => [k, E.sites[k].name.replace(' State Prison', '').replace(' Memorial Stadium', '').replace(' County Jail', ' Jail')]), () => st.site, (v) => { st.site = v; st.n = null; });
  seg($('stDrone'), 'Drone', Object.entries(DRONES), () => st.drone, (v) => { st.drone = v; st.n = null; });
  seg($('stInterf'), 'Interference removal', E.interference.map((i) => [i, `${i} dB${i === 20 ? ' (today)' : ''}`]), () => st.interf, (v) => { st.interf = +v; st.n = null; });
  seg($('stBuild'), 'Build', Object.entries(E.builds).map(([k, b]) => [k, { platform: 'Cell + TV', platform_cell: 'Cell only', seed: 'Seed sensor' }[k]]), () => st.build, (v) => { st.build = v; st.n = null; });
  const s = E.sites[st.site], prod = s.product, r = rec(st.site, st.drone, st.interf)[st.build] || {};
  if (st.n === null) st.n = r.n || E.nodes[prod][0];
  seg($('stN'), 'Sensors', E.nodes[prod].map((n) => [n, `${n}${n === r.n ? ' ★' : ''}`]), () => st.n, (v) => { st.n = +v; });
  const x = row(st.site, st.drone, st.build, st.interf, st.n) || { cov: [], trk: [], acc: [] }, ri = RI(), req = E.default_req;
  const b = E.builds[st.build];
  const m = E.maps.find((mm) => mm.k[0] === st.site && mm.k[1] === st.drone && mm.k[2] === b.design && mm.k[4] === st.interf && mm.k[5] === st.n && (mm.signals || 'cell') === b.signals);
  drawMap(m, s);
  $('stMapTitle').textContent = `Coverage, ${DRONES[st.drone]} at 60 m, ${st.n} sensors, ${b.label.toLowerCase()}`;
  $('stMapNote').innerHTML = m ? `Located = 3 or more transmitter-sensor pairs (cell towers${b.signals.includes('tv') ? ' and TV stations' : ''}) detect the drone. ★ = fewest sensors that meet the requirements.` : '';
  $('stHead').textContent = `${s.name} · ${PRODUCT_NAMES[prod]}`;
  $('stFacts').innerHTML = `${esc(s.place)} · ${esc(s.type)} · outline ${s.fence_area_ha} ha · ${s.towers_5km} cell towers within 5 km · nearest ${s.nearest_tower_km} km${SITE_NOTES[st.site] ? ' · ' + SITE_NOTES[st.site] : ''}`;
  const chk = (label, v, ok, unit, need) => `<div class="check ${ok ? 'pass' : 'fail'}"><small>${esc(label)}</small><b>${v === null || v === undefined ? '–' : esc(v)}${unit}</b><span class="${need === null ? '' : ok ? 'ok' : 'bad'}">${need === null ? 'no requirement set' : (ok ? 'meets ' : 'misses ') + esc(need)}</span></div>`;
  const cov = x.cov[ri], trk = x.trk[ri], acc = x.acc[ri], det = x.det50;
  $('stChecks').innerHTML = chk('Zone covered', cov === undefined ? null : Math.round(cov), cov >= req.coverage_pct, '%', `${req.coverage_pct}%`) +
    chk('Time tracked', trk === undefined ? null : Math.round(trk), trk >= req.tracked_pct, '%', `${req.tracked_pct}%`) +
    chk('Position accuracy', acc === null || acc === undefined ? null : Math.round(acc), acc !== null && acc !== undefined && acc <= req.accuracy_m, ' m', `${req.accuracy_m} m`) +
    chk('Typical warning distance', det === undefined ? null : Math.round(det), det >= req.detection_m, ' m', `${req.detection_m} m before the fence`) +
    chk('Drones caught before the fence', x.caught === undefined ? null : Math.round(x.caught), true, '%', null);
  const hw = b.hw, c = (P.cost_by_n[prod] || {})[hw]?.[st.n];
  const pr = P.products.find((p) => p.key === prod);
  $('stCost').innerHTML = c ? [
    ['Our cost upfront', usd(c.upfront)], ['Our cost per year', usd(c.yearly)], ['Price (model v2)', `${usd(pr.price_upfront)} + ${usd(pr.price_yearly)}/yr`],
    ['Gross margin over 5 years', pct(100 * (1 - (c.upfront + 5 * c.yearly) / (pr.price_upfront + 5 * pr.price_yearly)))],
  ].map(([a, v]) => `<div class="card"><small>${esc(a)}</small><b>${esc(v)}</b></div>`).join('') : '';
  $('stCostNote').innerHTML = `${hw === 'seed' ? 'Seed sensor' : 'Platform sensor'} ${usd(E.sensor_usd[hw])} each, plus ${esc(pr.extras)}. Parts in Sensor &amp; parts; product build-up in Products &amp; cost.`;
  const tv = s.tv_used || [];
  $('stSignals').innerHTML = `<b>Cell towers:</b> the strongest ${6} cells of ${s.towers_10km} towers within 10 km (FCC). ` +
    (b.signals.includes('tv') ? `<b class="tvc">Digital TV:</b> ${tv.map((t) => `${esc(t.call)} (${t.freq_mhz} MHz, ${t.erp_kw} kW, ${t.distance_km} km)`).join(', ') || 'none licensed within 80 km'}. TV is a link-budget estimate inside the twin, conservative against the published DVB-T drone trials (Martelli et al. 2020); no drone has yet been detected with US digital TV in published work.` : '<b>Digital TV off</b> in this build.');
}
const SITE_NOTES = {
  robins: 'protected area: the main flightline apron (the whole base is 27.9 km around)',
  poe: 'protected area: 250 m around the port building (OpenStreetMap has no outline of the inspection compound; ASSUMPTION) · Mexican towers and TV stations are not in FCC data',
  event: 'sensors on 4 m tripod masts for the event',
  fulton: '6 km from an 869 kW TV station: receiver overload not modeled',
};

// ---------------------------------------------------------------- Sensor
function bomRows(lines, cols) { return lines.map(cols).join(''); }
function renderSensor() {
  const s = B.sensor, b = s.board;
  $('snLead').innerHTML = `One receive-only box per pole or tripod: <b>${usd(s.total_usd)}</b> at 1,000 units (${usd(B.sensor_by_qty['100'])} at 100, ${usd(B.sensor_by_qty['10000'])} at 10,000). The v0.5 sensor (${usd(B.v05_sensor_usd)}) heard cell bands only. Each transceiver chip's two channels share one oscillator, so each chip is locked to one band: 8 chips for 16 channels.`;
  const fe = b.front_end_by_bank;
  $('snBanks').innerHTML = [
    ['cell', 'Cell bank · 8 channels', '617-960 MHz, the 8-antenna ring. Echoes of the cell towers around the site: the proven base.', `front end ${usd2(fe.cell)}`],
    ['tv', 'TV bank · 4 channels', '470-600 MHz, horizontally polarized TV antennas. Echoes of licensed digital TV stations: the upgrade measured at Seed.', `front end ${usd2(fe.tv)}`],
    ['gps', 'GPS bank · 4 channels', 'L1 1,575 MHz on a 4-element patch array. Finds GPS jammers by time difference and bearing.', `front end ${usd2(fe.gps)}`],
    ['core', 'Shared core', 'FPGA, timing-grade GPS receiver, holdover oven crystal, edge computer that turns each antenna into range-Doppler maps.', 'hub on site tracks, classifies, alerts'],
  ].map(([k, h, p, c]) => `<div class="bank ${k}"><h3>${esc(h)}</h3><p>${esc(p)}</p><p class="small">${esc(c)}</p></div>`).join('');
  $('snBoardHint').textContent = `at ${b.qty.toLocaleString('en-US')} boards`;
  $('snBoard').innerHTML = `<thead><tr><th class="l">Item</th><th class="l">Part</th><th>Count</th><th>Unit</th><th>Line</th><th class="l">Source</th></tr></thead><tbody>` +
    bomRows(b.lines, (l) => `<tr><td class="l">${esc(l.item)}</td><td class="l">${esc(l.part)}</td><td>${l.count}</td><td>${usd2(l.unit_at_qty)}</td><td>${usd2(l.line_usd)}</td><td class="src">${link(l.url, l.source)}</td></tr>`) +
    `<tr><td class="l">Assembly (JLCPCB rates)</td><td></td><td></td><td></td><td>${usd2(b.assembly_usd)}</td><td class="src">${link(B.assembly.url, B.assembly.source)}</td></tr>` +
    `<tr><td class="l">Test and phase calibration</td><td></td><td></td><td></td><td>${usd2(b.test_usd)}</td><td class="src">ASSUMPTION</td></tr>` +
    `<tr class="total"><td class="l">Board</td><td></td><td></td><td></td><td>${usd2(b.total_usd)}</td><td class="src">Board by quantity: ${Object.entries(B.board_by_qty).map(([q, v]) => `${(+q).toLocaleString('en-US')}: ${usd(v)}`).join(' · ')}</td></tr></tbody>`;
  $('snBoardNote').innerHTML = `Prices are moved from their quoted quantity to the build quantity by the v0.5 volume curve (7% cheaper per doubling, never below half; ASSUMPTION). One-time design and certification of the board: ${usd(B.nre_usd)} (ASSUMPTION), a company cost in the financial model, not in the board price.`;
  $('snSensor').innerHTML = `<thead><tr><th class="l">Item</th><th class="l">Part</th><th>Count</th><th>Line</th><th class="l">Source</th></tr></thead><tbody>` +
    bomRows(s.lines, (l) => `<tr><td class="l">${esc(l.item)}</td><td class="l">${esc(l.part)}</td><td>${l.n}</td><td>${usd2(l.line_usd)}</td><td class="src">${link(l.url, l.source)}</td></tr>`) +
    `<tr class="total"><td class="l">Platform sensor</td><td></td><td></td><td>${usd2(s.total_usd)}</td><td class="src"></td></tr></tbody>`;
  $('snSensorNote').innerHTML = `Premium option: ${esc(B.csac.part)} for longer holdover while GPS is jammed, ${usd(B.csac.usd)} (${link(B.csac.url, B.csac.source)}). The GPS monitoring results use the oven crystal by default.`;
  const sd = B.seed_sensor;
  $('snSeed').innerHTML = `<thead><tr><th class="l">Item</th><th>Count</th><th>Line</th><th class="l">Source</th></tr></thead><tbody>` +
    bomRows(sd.lines, (l) => `<tr><td class="l">${esc(l.item)}</td><td>${l.n}</td><td>${usd2(l.line_usd)}</td><td class="src">${esc(l.source)}</td></tr>`) +
    `<tr class="total"><td class="l">Seed sensor</td><td></td><td>${usd2(sd.total_usd)}</td><td class="src"></td></tr></tbody>`;
  $('snOpen').innerHTML = [
    'The TV filter (Mini-Circuits BFTC-500+) stops at 600 MHz, so TV channels 35-36 are clipped; no catalog 470-608 MHz part was found.',
    'Nothing off the shelf separates TV channel 36 (608 MHz) from T-Mobile Band 71 (617 MHz): separate antennas and digital channel selection are the plan.',
    'The FPGA must take 8 transceivers: the larger part is not priced yet ($100 added as an assumption).',
    'One edge computer for 16 channels (about 1.4 times the 8-channel load) is unproven: benchmark at Seed; the next step up costs $999.',
    'The 4-element GPS array needs phase calibration; 3 degrees of bearing accuracy is an assumption.',
  ].map((x) => `<li>${esc(x)}</li>`).join('');
}

// ---------------------------------------------------------------- Products
function renderProducts() {
  $('prTable').innerHTML = `<thead><tr><th class="l">Product</th><th class="l">For</th><th>Sensors</th><th>Our cost upfront</th><th>Our cost / yr</th><th>Price</th><th>5-yr gross margin</th><th class="l">Cheapest comparable</th></tr></thead><tbody>` +
    P.products.map((p) => `<tr><td class="l"><b>${esc(p.name)}</b></td><td class="l">${esc(p.who)}</td><td>${p.sensors ?? '–'}</td><td>${usd(p.cost.upfront)}</td><td>${usd(p.cost.yearly)}</td>
      <td>${esc(p.price_text)}</td><td>${p.margin_pct === null ? '–' : pct(p.margin_pct)}</td><td class="l small">${link(p.benchmark_url, p.benchmark)}</td></tr>`).join('') + '</tbody>';
  $('prCards').innerHTML = P.products.map((p) => `<div class="pcard"><h3>${esc(p.name)}</h3><p>${esc(p.what)}</p>
    <table>${(p.lines || []).map((l) => `<tr><td>${esc(l.item)}</td><td>${usd(l.usd)}</td></tr>`).join('')}
    <tr><td><b>Our cost upfront</b></td><td><b>${usd(p.cost.upfront)}</b></td></tr><tr><td>Upkeep per year</td><td>${usd(p.cost.yearly)}</td></tr></table>
    <p class="small">${esc(p.sensors_note || '')}</p></div>`).join('');
}

// ---------------------------------------------------------------- GPS
function renderGnss() {
  const sites = Object.keys(G.sites);
  seg($('gnSite'), 'Site', sites.map((k) => [k, G.sites[k].short]), () => st.gSite, (v) => (st.gSite = v));
  seg($('gnClock'), 'Locator set-up', [['ocxo', 'Today: oven crystal'], ['sync', 'Clocks synced to TV and cell'], ['sync_cal', '+ bearings calibrated to 1°'], ['csac', 'Atomic clock (premium)']].filter((o) => G.sites[st.gSite].maps[o[0]]), () => st.gClock, (v) => (st.gClock = v));
  const g = G.sites[st.gSite], m = g.maps[st.gClock], cv = $('gnMap'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const n = m.n, cell = W / n, span = m.step_m * n;
  const px = (x) => ((x - m.x0 + m.step_m / 2) / span) * W, py = (y) => H - ((y - m.x0 + m.step_m / 2) / span) * H;
  const col = (e) => (e === null ? '#3a4552' : e <= 25 ? '#2E6B45' : e <= 100 ? '#7FA88A' : e <= 300 ? '#D9C79A' : '#D9480F');
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.fillStyle = col(m.error_m[i][j]); ctx.fillRect(j * cell, H - (i + 1) * cell, cell - 1, cell - 1); }
  ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 2; ctx.beginPath(); g.fence.forEach(([x, y], k) => (k ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y)))); ctx.stroke();
  ctx.fillStyle = '#38bdf8'; g.sensors.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(px(x), py(y), 4, 0, 7); ctx.fill(); });
  const f = (r) => (!r || r.error_m === null ? 'cannot place' : `${Math.round(r.error_m)} m${r.fail_pct ? ` (${Math.round(r.fail_pct)}% fail)` : ''}`);
  const cs = g.cases.filter((c) => c.clock === st.gClock);
  const where = [...new Set(cs.map((c) => c.where))];
  $('gnTable').innerHTML = `<thead><tr><th class="l">Jammer</th><th>Power</th><th>Sensors that hear it</th><th>Time differences only</th><th>+ bearings</th></tr></thead><tbody>` +
    where.flatMap((w) => [10, 30].map((p) => {
      const a = cs.find((c) => c.where === w && c.power_dbm === p && c.mode === 'tdoa'), b = cs.find((c) => c.where === w && c.power_dbm === p && c.mode === 'tdoa+aoa');
      return `<tr><td class="l">${esc(w)}</td><td>${p === 10 ? '10 mW (car jammer)' : '1 W'}</td><td>${a?.detected ?? '–'}</td><td>${f(a)}</td><td><b>${f(b)}</b></td></tr>`;
    })).join('') + '</tbody>';
  const SETUP_NOTE = { ocxo: 'Each sensor holds time on its oven crystal while GPS is jammed (about 50 ns of drift) and places a jammer only when it raises the noise by 10 dB.',
    sync: 'Software upgrade, no new parts: the sensors keep their clocks in step using the TV and cell signals they already receive (an L1 jammer does not touch them), and cross-correlate their GPS recordings, so a jammer 10 dB below the noise can still be placed.',
    sync_cal: 'As synced, plus each 4-element GPS array calibrated against known transmitters to 1 degree (the DTU trial reached 0.5-1 degree).',
    csac: 'Premium hardware: a chip-scale atomic clock in each sensor (about 5 ns while jammed), with the current processing.' };
  $('gnNote').innerHTML = `<b>${esc(SETUP_NOTE[st.gClock] || '')}</b> ${g.sensors.length} platform sensors at ${esc(g.name)}. ${esc(G.assumptions)}`;
}

// ---------------------------------------------------------------- Timeline
function renderTimeline() {
  const w = T.walkthrough;
  $('tlHead').innerHTML = `${esc(w.site)} · ${esc(w.drone)} at ${w.speed_mps} m/s · 4 sensors, cell towers at today's 20 dB · the twin's full signal replay: tracked ${w.metrics.track_availability_pct}% of the time inside the zone, ${w.metrics.median_error_m} m median error. <b>${w.warning_before_fence_s} s of warning before the drone crosses the fence.</b> The full replay is cell-only; with digital TV the same sensors would see the drone earlier (Sites tab).`;
  $('tlEvents').innerHTML = w.events.map((e) => `<li class="ev ${e.kind}"><span class="t">${Math.round(e.t)} s</span><span class="who">${esc(e.who)}</span><span>${esc(e.what)}</span></li>`).join('');
  $('tlCases').innerHTML = T.cases.map((c) => `<div class="pcard"><h3>${esc(c.where)}</h3><p>${esc(c.what)} ${c.url ? link(c.url, '(source)') : ''}</p><p><b>${esc(c.lesson)}</b></p></div>`).join('');
}


// ---------------------------------------------------------------- Flight simulator (data/flights.json, tools/flight_demo_v1.py)
let F = null;
const sim = { site: 'hays', drone: 'mavic', sig: 'cell+tv', interf: 20, fl: 0, i: 0, playing: false, speed: 4, last: 0, view: '2d' };
let S3 = null, S3fail = null;   // 3D view module (sim3d.js), loaded on first use

async function show3d() {
  const box = $('sm3d');
  if (!S3 && !S3fail) {
    try { S3 = await import('./sim3d.js'); S3.init(box); }
    catch (e) { S3fail = e; box.innerHTML = '<div class="msg">The 3D view needs WebGL and the three.js library from unpkg.com, which did not load here. The map view has the same flight.</div>'; }
  }
  if (!S3) return;
  const { g } = simData();
  await S3.setSite(E.sites[sim.site].id, g, sim.sig);
  simDraw();
}
const SIG_NAMES = { 'cell+tv': 'Cell + TV', cell: 'Cell towers only' };

function simData() {
  const g = F.sites[sim.site], geo = g.flights[sim.fl], run = (F.runs[`${sim.site}|${sim.drone}|${sim.sig}|${sim.interf}`] || [])[sim.fl];
  return { g, geo, run };
}

function simEvents(geo, run) {
  const ev = [], T = geo.t.length;
  const fl = run.loc.indexOf(1), ft = run.trk.indexOf(1), cross = geo.inside.indexOf(1);
  let hov = -1;
  for (let k = 1; k < T; k++) if (geo.xy[k][0] === geo.xy[k - 1][0] && geo.xy[k][1] === geo.xy[k - 1][1]) { hov = k - 1; break; }
  const leave = cross < 0 ? -1 : geo.inside.lastIndexOf(1);
  ev.push({ k: 0, kind: 'drone', who: 'Drone', what: `Takes off ${geo.fence_m[0]} m from the fence, flying in from ${geo.from_deg}° at ${geo.speed_mps} m/s, 60 m up.` });
  if (fl >= 0) ev.push({ k: fl, kind: 'detect', who: 'Tripwire', what: `First located: ${run.n_cell[fl] + run.n_tv[fl]} transmitter-sensor pairs hear the drone, ${geo.inside[fl] ? 'inside the fence' : `${geo.fence_m[fl]} m from the fence`}.` });
  if (ft >= 0) {
    const before = cross > ft ? `, ${Math.round(geo.t[cross] - geo.t[ft])} s before the drone crosses the fence` : '';
    ev.push({ k: ft, kind: 'detect', who: 'Tripwire', what: geo.inside[ft] ? 'Track confirmed only after the drone is inside: alert to the control room.' : `Track confirmed ${geo.fence_m[ft]} m from the fence: alert to the control room and the response team${before}.` });
  }
  if (cross >= 0) ev.push({ k: cross, kind: 'drone', who: 'Drone', what: `Crosses the fence${run.trk[cross] ? ' (tracked)' : ' (not tracked)'}.` });
  if (hov >= 0 && geo.hover_s > 1) ev.push({ k: hov, kind: 'drone', who: 'Drone', what: `Hovers ${Math.round(geo.hover_s)} s over the drop point${run.trk[hov] ? ' (track held)' : ''}.` });
  if (ft >= 0) {
    for (let k = ft + 1; k < T; k++) {
      if (run.trk[k - 1] && !run.trk[k]) {
        const z = (sim.zones || [])[Math.min(k + 3, T - 1)], hov = z && !z.lost && z.hover > 0.5;
        ev.push({ k, kind: 'people', who: 'Tripwire', what: `Track lost ${geo.inside[k] ? 'inside the fence' : `${geo.fence_m[k]} m outside`}; a search region grows from the last fix${hov ? '. No echo over covered ground: most likely hovering, so the region stays tight' : ''}.` });
      }
      if (!run.trk[k - 1] && run.trk[k]) ev.push({ k, kind: 'detect', who: 'Tripwire', what: 'Track picked up again.' });
    }
  }
  if (leave >= 0 && leave < T - 1) ev.push({ k: leave + 1, kind: 'evidence', who: 'Drone', what: `Leaves over the fence${run.trk[leave + 1] ? '; the track follows it out, and its heading is kept as evidence' : ''}.` });
  if (ft < 0) ev.push({ k: T - 1, kind: 'people', who: 'Tripwire', what: 'Never tracked on this flight.' });
  return ev.sort((a, b) => a.k - b.k).slice(0, 16).map((e) => ({ ...e, t: Math.round(geo.t[e.k]) }));
}

function simDraw() {
  if (!F) return;
  const { g, geo, run } = simData(), cv = $('smMap'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  if (!run) { ctx.fillStyle = '#8396a8'; ctx.font = '14px sans-serif'; ctx.fillText('No flight for this choice.', 14, 30); return; }
  const fence = E.sites[sim.site].fence;
  const cx = fence.reduce((a, p) => a + p[0], 0) / fence.length, cy = fence.reduce((a, p) => a + p[1], 0) / fence.length;
  let half = 0;
  geo.xy.concat(fence).forEach(([x, y]) => (half = Math.max(half, Math.abs(x - cx), Math.abs(y - cy))));
  half = Math.ceil((half + 120) / 100) * 100;
  const sc = W / (2 * half), px = (x) => W / 2 + (x - cx) * sc, py = (y) => H / 2 - (y - cy) * sc;
  // Coverage map of the same build behind the flight.
  const m = E.maps.find((mm) => mm.k[0] === sim.site && mm.k[1] === sim.drone && mm.k[2] === 'ring8_enh_hist' && mm.k[4] === sim.interf && mm.k[5] === g.n && (mm.signals || 'cell') === sim.sig);
  if (m) {
    const col = { 1: 'rgba(138,109,31,.45)', 2: 'rgba(47,143,106,.45)' };
    for (let a = 0; a < m.n; a++) for (let b = 0; b < m.n; b++) {
      const v = m.state[a * m.n + b];
      if (!col[v]) continue;
      const x = m.x0 + b * m.step - m.step / 2, y = m.y0 + a * m.step - m.step / 2;
      ctx.fillStyle = col[v]; ctx.fillRect(px(x), py(y + m.step), m.step * sc + 0.5, m.step * sc + 0.5);
    }
  }
  ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 2; ctx.beginPath();
  fence.forEach(([x, y], k) => (k ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y)))); ctx.stroke();
  ctx.fillStyle = '#8396a8';
  g.towers.forEach(([x, y]) => {  // towers beyond the view are pinned to its edge as outlines
    let X = px(x), Y = py(y);
    const out = X < 8 || X > W - 8 || Y < 8 || Y > H - 8;
    X = Math.min(Math.max(X, 8), W - 8); Y = Math.min(Math.max(Y, 8), H - 8);
    ctx.beginPath(); ctx.moveTo(X, Y - 6); ctx.lineTo(X - 5, Y + 4); ctx.lineTo(X + 5, Y + 4); ctx.closePath();
    if (out) { ctx.strokeStyle = '#8396a8'; ctx.lineWidth = 1; ctx.stroke(); } else ctx.fill();
  });
  if (sim.sig.includes('tv')) {
    ctx.font = '11px sans-serif';
    const placed = [];
    [...g.tv].sort((a, b) => a.bearing_deg - b.bearing_deg).forEach((t) => {  // TV stations are tens of km away: shown by direction
      const a = (t.bearing_deg * Math.PI) / 180, r = W / 2 - 16, X = W / 2 + r * Math.sin(a), Y = H / 2 - r * Math.cos(a);
      ctx.fillStyle = '#c4b5fd'; ctx.beginPath(); ctx.arc(X, Y, 4, 0, 7); ctx.fill();
      const near = placed.filter((p) => Math.abs(p.X - X) < 120 && Math.abs(p.Y - Y) < 14 * (placed.length + 1)).length;
      const lx = Math.min(Math.max(X + 6, 4), W - 120), ly = Math.min(Math.max(Y + 4, 12) + 13 * near, H - 30);
      ctx.fillText(`${t.call} ${Math.round(t.distance_km)} km`, lx, ly); placed.push({ X, Y });
    });
  }
  const i = Math.min(sim.i, geo.t.length - 1), [dx, dy] = geo.xy[i];
  ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(248,113,113,.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
  geo.xy.forEach(([x, y], k) => (k ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y)))); ctx.stroke(); ctx.setLineDash([]);
  const zn = (sim.zones || [])[i];
  if (zn && !zn.lost) {  // where the drone can be after the track dropped (searchzone.js)
    zn.cells.forEach(([x, y, wt]) => { ctx.fillStyle = `rgba(251,146,60,${(0.18 + 0.6 * Math.sqrt(wt)).toFixed(2)})`; ctx.fillRect(px(x), py(y + zn.cell), zn.cell * sc + 0.5, zn.cell * sc + 0.5); });
  }
  for (let k = Math.max(0, i - 60); k <= i; k++) {  // Tripwire's position estimates (track trail)
    if (!run.loc[k]) continue;
    ctx.fillStyle = run.trk[k] ? 'rgba(52,211,153,.8)' : 'rgba(251,191,36,.75)';
    ctx.beginPath(); ctx.arc(px(run.est[k][0]), py(run.est[k][1]), k === i ? 5 : 2.2, 0, 7); ctx.fill();
  }
  g.sensors.forEach(([x, y], j) => {  // the echoes each sensor hears now
    const c = (run.cell[i] >> j) & 1, t = (run.tv[i] >> j) & 1;
    if (!c && !t) return;
    ctx.strokeStyle = c ? '#38bdf8' : '#c4b5fd'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px(x), py(y)); ctx.lineTo(px(dx), py(dy)); ctx.stroke();
    if (c && t) { ctx.strokeStyle = '#c4b5fd'; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]); }
  });
  ctx.fillStyle = '#38bdf8'; ctx.strokeStyle = '#04121c'; ctx.lineWidth = 1.5;
  g.sensors.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(px(x), py(y), 5, 0, 7); ctx.fill(); ctx.stroke(); });
  if (run.trk[i]) { ctx.strokeStyle = '#34d399'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px(run.est[i][0]), py(run.est[i][1]), Math.max(7, run.err[i] * sc), 0, 7); ctx.stroke(); }
  ctx.fillStyle = '#f87171'; ctx.beginPath(); ctx.arc(px(dx), py(dy), 5.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#dbe5ee'; ctx.font = '12px sans-serif';
  ctx.fillRect(14, H - 18, 500 * sc, 3); ctx.fillText('500 m', 14, H - 24);
  const heard = run.n_cell[i] + run.n_tv[i];
  const state = run.trk[i] ? ['Tracked', 'live'] : run.loc[i] ? ['Located', 'warnc'] : heard ? ['Heard, not located', 'warnc'] : ['Not seen', 'off'];
  $('smNow').innerHTML = [[state[0], 'Tripwire', state[1]], [geo.inside[i] ? 'inside the fence' : `${geo.fence_m[i]} m outside`, 'Drone', ''],
    [`${run.n_cell[i]} cell · ${run.n_tv[i]} TV`, 'Transmitter-sensor pairs that hear it', ''],
    zn && !zn.lost ? [`${zn.area_ha.toFixed(1)} ha`, `Possible region, ${Math.round(zn.frames * g.dt)} s after the track (drone ${zn.inside ? 'inside' : 'outside'} it)`, 'zonec']
      : zn && zn.lost ? ['lost', 'Over 45 s without a track: region dropped', 'off']
      : [run.loc[i] ? `${Math.round(run.err[i])} m` : '–', 'Expected position error', '']]
    .map(([b, sm, cl]) => `<div class="card ${cl}"><small>${esc(sm)}</small><b>${esc(b)}</b></div>`).join('');
  $('smClock').textContent = `${Math.round(geo.t[i])} s / ${Math.round(geo.t[geo.t.length - 1])} s`;
  $('smTime').value = i;
  if (sim.view === '3d' && S3) S3.update({ g, geo, run, i, height: F.height_m, zone: zn });
  document.querySelectorAll('#smEvents .ev').forEach((li) => li.classList.toggle('past', +li.dataset.k <= i));
}

function renderSim() {
  if (!F) { $('smTitle').textContent = 'Flight simulator data not built yet (python -m tools.flight_demo_v1)'; return; }
  const sites = SITE_ORDER.filter((k) => F.sites[k]);
  const reset = () => { sim.i = 0; };
  seg($('smView'), 'View', [['2d', 'Map'], ['3d', '3D terrain']], () => sim.view, (v) => { sim.view = v; });
  $('smMap').style.display = sim.view === '3d' ? 'none' : '';
  $('sm3d').style.display = sim.view === '3d' ? '' : 'none';
  if (sim.view === '3d') show3d();
  const short = (k) => E.sites[k].name.replace(' State Prison', '').replace(' Memorial Stadium', '').replace(' County Jail', ' Jail').replace(' flightline apron', '').replace(' Port of Entry', ' port');
  seg($('smSite'), 'Site', sites.map((k) => [k, short(k)]), () => sim.site, (v) => { sim.site = v; sim.fl = 0; reset(); });
  seg($('smDrone'), 'Drone', Object.entries(DRONES), () => sim.drone, (v) => { sim.drone = v; reset(); });
  seg($('smSig'), 'Signals', Object.entries(SIG_NAMES), () => sim.sig, (v) => { sim.sig = v; reset(); });
  seg($('smInterf'), 'Interference removal', F.interference.map((i) => [i, `${i} dB${i === 20 ? ' (today)' : ''}`]), () => sim.interf, (v) => { sim.interf = +v; reset(); });
  const g = F.sites[sim.site];
  seg($('smFlight'), 'Flight', g.flights.map((f, k) => [k, `${k + 1}: from ${f.from_deg}°`]), () => sim.fl, (v) => { sim.fl = +v; reset(); });
  seg($('smSpeed'), 'Speed', [[1, '1x'], [4, '4x'], [10, '10x']], () => sim.speed, (v) => { sim.speed = +v; });
  const { geo, run } = simData();
  sim.zones = run ? zonesFor(F, E, `${sim.site}|${sim.drone}|${sim.sig}|${sim.interf}`, sim.fl).zones : [];
  $('smTitle').textContent = `${E.sites[sim.site].name} · ${DRONES[sim.drone]} · ${SIG_NAMES[sim.sig].toLowerCase()} · ${sim.interf} dB · ${g.n} platform sensors`;
  $('smTime').max = geo.t.length - 1;
  if (run) {
    $('smEvents').innerHTML = simEvents(geo, run).map((e) => `<li class="ev ${e.kind}" data-k="${e.k}"><span class="t">${e.t} s</span><span class="who">${esc(e.who)}</span><span>${esc(e.what)}</span></li>`).join('');
    $('smEvents').querySelectorAll('.ev').forEach((li) => (li.onclick = () => { sim.i = +li.dataset.k; sim.playing = false; $('smPlay').textContent = 'Play'; simDraw(); }));
    const zone = geo.inside.map((v, k) => v || geo.fence_m[k] <= E.default_req.radius_m);
    const nz = zone.filter(Boolean).length, tz = zone.filter((v, k) => v && run.trk[k]).length;
    const ft = run.trk.indexOf(1), cross = geo.inside.indexOf(1), early = ft >= 0 && (cross < 0 || ft < cross);
    $('smSum').innerHTML = [[nz ? pct((100 * tz) / nz) : '–', 'Time tracked inside the zone (fence + 150 m)'],
      [early ? `${geo.fence_m[ft]} m` : 'none', 'Warning distance (track before the fence)'],
      [early && cross > ft ? `${Math.round(geo.t[cross] - geo.t[ft])} s` : '–', 'Warning time before the fence']]
      .map(([b, sm]) => `<div class="card"><small>${esc(sm)}</small><b>${esc(b)}</b></div>`).join('');
  }
  $('smNote').innerHTML = `${esc(F.note)} Each frame (${F.sites[sim.site].dt} s), every transmitter-sensor pair hears the drone with the probability the twin's link budget gives (one random draw); a frame is located when 3 or more pairs from 2 or more sensors hear it; a track is confirmed after 2 located frames out of 3 and dropped after 3 misses. The full 3D signal replays (cell towers) are in the ${link(LINKS.twin, 'v0.5 twin')}.`;
  simDraw();
}

function simTick(ts) {
  if (sim.playing && F) {
    const { geo } = simData();
    if (ts - sim.last >= (F.sites[sim.site].dt * 1000) / sim.speed) {
      sim.last = ts; sim.i++;
      if (sim.i >= geo.t.length) { sim.i = geo.t.length - 1; sim.playing = false; $('smPlay').textContent = 'Replay'; }
      simDraw();
    }
  }
  requestAnimationFrame(simTick);
}

function simInit() {
  $('smPlay').onclick = () => {
    if (!F) return;
    const { geo } = simData();
    if (sim.i >= geo.t.length - 1) sim.i = 0;
    sim.playing = !sim.playing; $('smPlay').textContent = sim.playing ? 'Pause' : 'Play';
  };
  $('smTime').oninput = (e) => { sim.i = +e.target.value; simDraw(); };
  requestAnimationFrame(simTick);
}

function renderAll() { renderSites(); renderGnss(); renderSim(); }

async function boot() {
  [E, B, P, G, T] = await Promise.all(['explore', 'bom', 'products', 'gnss', 'timeline'].map(load));
  F = await load('flights').catch(() => null);
  simInit();
  $('links').innerHTML = `${link(LINKS.model, 'Financial model v2')} · ${link(LINKS.twin, 'Cell-tower twin v0.5 (3D signal replays)')} · ${link(LINKS.repo, 'Code')}`;
  renderPlatform(); renderSensor(); renderProducts(); renderTimeline(); renderAll();
  document.querySelectorAll('.tabbar button').forEach((b) => (b.onclick = () => show(b.dataset.tab)));
  document.querySelectorAll('header [data-go]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); show('home'); }));
  const api = { E, B, P, T, F, usd, rec, drawMap, SITE_ORDER, show, openSite, openSim, tour: startTour, pause: () => { sim.playing = false; $('smPlay').textContent = 'Play'; } };
  initTour(api);
  $('tourBtn').onclick = startTour;
  if (F) renderHome(api);
  const h = location.hash.slice(1); if (h && $(`tab-${h}`)) show(h);
}

function show(t) {
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.tab').forEach((s) => s.classList.toggle('on', s.id === `tab-${t}`));
  history.replaceState(null, '', `#${t}`);
  if (t !== 'sim' && sim.playing) { sim.playing = false; $('smPlay').textContent = 'Play'; }
  if (t === 'sim' && sim.view === '3d') show3d();
  window.scrollTo({ top: 0 });
}
function openSite(k) { st.site = k; st.n = null; renderSites(); show('sites'); }
// Jump the flight simulator to a site (Hays demo settings), optionally to a frame, to the first lost-track hover, or playing.
function openSim({ site = 'hays', i = 0, play = false, lost = false } = {}) {
  Object.assign(sim, { site, fl: 0, drone: 'mavic', sig: 'cell+tv', interf: 20 });
  renderSim();
  if (lost) { const z = sim.zones.findIndex((zz) => zz && !zz.lost && zz.hover > 0.5); if (z >= 0) i = z + 2; }
  sim.i = i; sim.playing = play; $('smPlay').textContent = play ? 'Pause' : 'Play';
  show('sim'); simDraw();
}
boot().catch((e) => { document.querySelector('.page').innerHTML = `<p class="bad">Could not load the data (${esc(e.message)}). Run twin/platform_bom.py, twin/explore_v1.py and tools/platform_v1.py.</p>`; });
