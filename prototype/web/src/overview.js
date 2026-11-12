// Overview tab: the customer says how much area they want covered and how much of the time a drone must be
// tracked (two sliders); the twin recommends the radio and number of sensors, what it costs us and what we
// would charge. Interference removal is not a setting here: the page says which level each answer needs.
import { $, esc, usd, pct, X, state, defaultReq, defaultTargets, fillSelect, INTERF_SHORT, onChange, emit, targetsText, competitors,
  RADIO, RADIO_KEYS, recommendOverall, radioOption } from './data.js';
import { info } from './help.js';
import { distToPolygon } from './viewer3d.js';
import { mountRequirements } from './requirements.js';

const REQ = () => defaultReq(); // the Overview always uses the default protected distance and height
const accShort = (x) => (x?.o.acc == null ? 'no fix' : `~${Math.round(x.o.acc)} m`);
const accTxt = (x) => (x?.o.acc == null ? '' : `, accuracy ~${Math.round(x.o.acc)} m`);
const usdk = (v) => (v >= 1e6 ? usd(v) : `$${Math.round(v / 1000)}k`);
let pick = null; // a cell clicked in the "what it takes" table: { interf, radio }

// What the Overview shows: the clicked cell, else today's answer, else the first level that works, else the best tried.
function headline() {
  const R = recommendOverall(state.site, state.drone, state.targets, REQ());
  if (pick) {
    const lv = R.levels.find((l) => l.interf === pick.interf), pr = lv.per[pick.radio];
    return { R, lv, x: pr.ok ?? pr.best, meets: !!pr.ok, picked: true };
  }
  if (R.first) return { R, lv: R.first, x: R.first.rec, meets: true };
  const lv = R.levels.at(-1), best = RADIO_KEYS.map((r) => lv.per[r].best).filter(Boolean)
    .reduce((b, x) => (!b || x.o.cov > b.o.cov || (x.o.cov === b.o.cov && x.total < b.total) ? x : b), null);
  return { R, lv, x: best, meets: false };
}

function drawMap(hd) {
  const site = X.sites[state.site], r = hd.x;
  const m = r && X.maps.find((x) => x.k[0] === state.site && x.k[1] === state.drone && x.k[2] === r.design && x.k[4] === hd.lv.interf && x.k[5] === r.n);
  const cv = $('ovMap'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.fillStyle = '#111a23'; ctx.fillRect(0, 0, W, H);
  if (!m) return;
  const span = m.step * m.n, s = Math.min(W, H) / span;
  const cx = m.x0 + span / 2, cy = m.y0 + span / 2;
  const P = (x, y) => [W / 2 + (x - cx) * s, H / 2 - (y - cy) * s];
  const R = REQ().radius_m;
  for (let i = 0; i < m.n; i++) for (let j = 0; j < m.n; j++) {
    const x = m.x0 + j * m.step, y = m.y0 + i * m.step, st = +m.state[i * m.n + j];
    const inZone = distToPolygon(x, y, site.fence) <= R;
    let col = null;
    if (st === 2) col = inZone ? 'rgba(52,211,153,.75)' : 'rgba(52,211,153,.25)';
    else if (inZone) col = 'rgba(248,113,113,.7)';
    if (!col) continue;
    const [px, py] = P(x - m.step / 2, y + m.step / 2);
    ctx.fillStyle = col; ctx.fillRect(px, py, m.step * s + 0.5, m.step * s + 0.5);
  }
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.beginPath();
  site.fence.forEach(([x, y], k) => { const [px, py] = P(x, y); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.stroke();
  ctx.fillStyle = '#38bdf8';
  for (const [x, y] of m.sensors) { const [px, py] = P(x, y); ctx.beginPath(); ctx.arc(px, py, 5, 0, 2 * Math.PI); ctx.fill(); }
  // Towers used: drawn at the map edge, pointing toward them, with their distance.
  ctx.font = '11px system-ui'; ctx.textAlign = 'center';
  const c = site.centre;
  for (const id of m.towers_used) {
    const t = site.towers.find((x) => x.id === id);
    if (!t) continue;
    const dx = t.x - c[0], dy = t.y - c[1], d = Math.hypot(dx, dy), ang = Math.atan2(dx, dy);
    let [px, py] = P(t.x, t.y);
    const inView = px > 14 && px < W - 14 && py > 14 && py < H - 14;
    if (!inView) { const rr = Math.min(W, H) / 2 - 18; px = W / 2 + rr * Math.sin(ang); py = H / 2 - rr * Math.cos(ang); }
    ctx.fillStyle = '#a78bfa'; ctx.beginPath(); ctx.moveTo(px, py - 8); ctx.lineTo(px - 6, py + 5); ctx.lineTo(px + 6, py + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c4b5fd'; ctx.fillText(`${(d / 1000).toFixed(1)} km${t.carriers.length ? ' · ' + t.carriers.join('/') : ''}`, px, py + 18);
  }
  ctx.textAlign = 'left'; ctx.fillStyle = '#8396a8';
  const bar = 200 * s; ctx.fillRect(16, H - 18, bar, 3); ctx.fillText('200 m', 16, H - 24);
  $('ovMapTitle').textContent = `${site.name}, ${site.place} · ${site.type}`;
}

function status(H) {
  const { R, lv, x } = H, t = state.targets, today = R.today;
  const bestToday = RADIO_KEYS.map((r) => today.per[r].best).filter(Boolean).reduce((b, y) => (!b || y.o.cov > b.o.cov ? y : b), null);
  let html;
  if (H.picked) html = `<div class="status ${H.meets ? (lv.interf === today.interf ? 'ok' : 'warn') : 'bad'}">Showing the cell you picked: ${esc(INTERF_SHORT[lv.interf])}, ${esc(RADIO[x.radio].name)}. <button class="link" id="ovUnpick">Back to the recommendation</button></div>`;
  else if (today.rec) html = `<div class="status ok"><b>Works with today's processing.</b> Meets ${targetsText(t)} with 20 dB of interference removal, which is today's assumption.</div>`;
  else if (R.first) html = `<div class="status warn"><b>Not possible with today's technology.</b> At 20 dB of interference removal the best is ${pct(bestToday?.o.cov)} area covered, ${pct(bestToday?.o.trk)} time tracked${accTxt(bestToday)}. It needs <b>${R.first.interf} dB</b> of removal, which the Seed recordings must prove. Shown: the setup at ${R.first.interf} dB.</div>`;
  else html = `<div class="status bad"><b>Not possible, even with 40 dB of interference removal.</b> The best tried covers ${pct(x?.o.cov)} of the area and tracks ${pct(x?.o.trk)} of the time${accTxt(x)}. Lower the targets, or see the Trade space simulator for other sensor setups.</div>`;
  let alt = '';
  if (x && x.radio === 'custom' && H.meets) {
    const ots = lv.per.bladerf.ok;
    alt = `The custom receiver is a Series A product. With off-the-shelf radios (Seed) at this level: ${ots ? `<b>${radioOption('bladerf', ots.n)}</b>, ${usd(ots.fin.price)} + ${usd(ots.fin.sub)}/yr` : 'the targets are not reachable'}.`;
  }
  $('ovAlt').innerHTML = alt;
  return html;
}

function kpis(H) {
  const req = REQ(), x = H.x;
  $('ovReqHint').textContent = `${X.drones[state.drone].name}, ${req.height_m} m up, ${req.radius_m} m around the fence`;
  $('ovStatus').innerHTML = status(H);
  if ($('ovUnpick')) $('ovUnpick').onclick = () => { pick = null; render(); };
  if (!x) { $('ovKpis').innerHTML = ''; $('ovPrice').innerHTML = ''; return; }
  const o = x.o, f = x.fin, t = state.targets;
  const card = (k, h, v, s, cls = '') => `<div class="kpi ${cls}"><small>${k} ${info(h)}</small><b>${v}</b><span>${s}</span></div>`;
  $('ovKpis').innerHTML = `<div class="setup-line"><b>${esc(radioOption(x.radio, x.n))}</b> <span class="badge ${RADIO[x.radio].stage === 'Seed' ? '' : 'alt'}">${RADIO[x.radio].stage}</span><br><span class="note small">Each sensor: ${esc(RADIO[x.radio].build)} ${info('history')}. Spaced evenly along the fence.</span></div>` + [
    card('Area covered', 'area', pct(o.cov), `target ${t.area}%`, o.cov >= t.area ? 'ok' : 'bad'),
    card('Time tracked', 'tracked', pct(o.trk), `target ${t.tracked}%`, o.trk >= t.tracked ? 'ok' : 'bad'),
    card('Drones caught', 'caught', pct(o.caught), 'tracked before they reach the fence'),
    card('Tracking accuracy', 'accuracy', o.acc == null ? '—' : `~${Math.round(o.acc)} m`, `target within ${t.accuracy} m`, o.acc != null && o.acc <= t.accuracy ? 'ok' : 'bad'),
  ].join('');
  const Y = state.fin.years, C = competitors(), lo = C.radar.lo, hi = C.radar.hi;
  const vsAir = f.customer5 < lo ? 'below' : f.customer5 > hi ? 'above' : 'within';
  $('ovPrice').innerHTML = `<small>Suggested price ${info('price')}</small>
    <b>${state.fin.model === 'all_in' ? `${usd(f.sub)}/yr, nothing upfront` : `${usd(f.price)} installation + ${usd(f.sub)}/yr`}</b>
    <span>Our cost ${usd(f.upfront)} upfront ${info('upfront')} + ${usd(f.yearly)}/yr ${info('running')}, plus a ${state.fin.margin_upfront === state.fin.margin_yearly ? `${state.fin.margin_yearly}%` : `${state.fin.margin_upfront}% / ${state.fin.margin_yearly}%`} margin (editable in Financials; pricing model ${info('pricing_model')}).
    The customer pays ${usd(f.customer5)} over ${Y} years, ${vsAir} a radar-based system over the same time (${usdk(lo)} to ${usdk(hi)} for ${state.fin.cmp_radar_n_lo}–${state.fin.cmp_radar_n_hi} radars, installation and software; see below). An RF-only system's hardware and installation alone is ${usdk(C.rf)} [3], and it cannot see drones that do not transmit.</span>`;
}

function cellHtml(lv, r, on) {
  const pr = lv.per[r];
  if (pr.ok) {
    const x = pr.ok;
    return `<td class="pick${on ? ' on' : ''}" data-i="${lv.interf}" data-r="${r}"><b>${x.n} sensors</b><br><span class="note">${pct(x.o.cov)} area · ${pct(x.o.trk)} tracked · ${accShort(x)}</span><br>${usdk(x.fin.price)} + ${usdk(x.fin.sub)}/yr</td>`;
  }
  const y = pr.best;
  return `<td class="pick no${on ? ' on' : ''}" data-i="${lv.interf}" data-r="${r}"><span class="bad">Not possible</span><br><span class="note">best ${pct(y?.o.cov)} area · ${pct(y?.o.trk)} tracked · ${accShort(y)} (${y?.n} sensors)</span></td>`;
}

function levelsTable(H) {
  const rows = H.R.levels.map((lv) => {
    const cheapest = lv.rec;
    const cells = RADIO_KEYS.map((r) => cellHtml(lv, r, H.lv.interf === lv.interf && H.x?.radio === r)).join('');
    return `<tr><td><b>${esc(INTERF_SHORT[lv.interf])}</b><br><span class="note">${lv.interf === X.axes.interference[0] ? "today's assumption" : 'not yet proven'}</span></td>${cells}
      <td>${cheapest ? `<b>${esc(radioOption(cheapest.radio, cheapest.n))}</b>` : '<span class="bad">none</span>'}</td></tr>`;
  }).join('');
  $('ovLevels').innerHTML = `<tr><th>Interference removal ${info('interference')}</th>${RADIO_KEYS.map((r) => `<th>${esc(RADIO[r].name)} ${info(`radio_${r}`)}<br><span class="note">${RADIO[r].kind}, ${RADIO[r].stage}</span></th>`).join('')}<th>Cheapest</th></tr>${rows}`;
  $('ovLevels').querySelectorAll('td.pick').forEach((td) => (td.onclick = () => { pick = { interf: +td.dataset.i, radio: td.dataset.r }; render(); }));
}

function sitesTable() {
  const t = state.targets, req = REQ();
  $('ovSitesNote').textContent = `The cheapest setup at each facility that covers ${t.area}% of the area within ${req.radius_m} m of the fence, tracks a drone ${t.tracked}% of the time and places it within ${t.accuracy} m (drones ${req.height_m} m up), at each level of interference removal.`;
  const rows = Object.keys(X.sites).map((k) => {
    const s = X.sites[k], R = recommendOverall(k, state.drone, t, req);
    const cells = R.levels.map((lv) => {
      if (lv.rec) return `<td><b>${esc(radioOption(lv.rec.radio, lv.rec.n))}</b><br><span class="note">${usd(lv.rec.fin.price)} + ${usd(lv.rec.fin.sub)}/yr</span></td>`;
      const best = RADIO_KEYS.map((r) => lv.per[r].best).filter(Boolean).reduce((b, y) => (!b || y.o.cov > b.o.cov ? y : b), null);
      return `<td><span class="bad">Not possible</span><br><span class="note">best ${pct(best?.o.cov)} area · ${pct(best?.o.trk)} tracked · ${accShort(best)}</span></td>`;
    }).join('');
    return `<tr class="${k === state.site ? 'on' : ''}" data-k="${k}"><td><b>${esc(s.name)}</b><br><span class="note">${esc(s.type)} · ${s.towers_5km} towers within 5 km, nearest ${s.nearest_tower_km} km</span></td>${cells}</tr>`;
  }).join('');
  $('ovSitesTable').innerHTML = `<tr><th>Facility ${info('facility')}</th>${X.axes.interference.map((i) => `<th>${esc(INTERF_SHORT[i])}${i === X.axes.interference[0] ? '' : '<br><span class="note">unproven</span>'}</th>`).join('')}</tr>${rows}`;
  $('ovSitesTable').querySelectorAll('tr[data-k]').forEach((tr) => (tr.onclick = () => { state.site = tr.dataset.k; pick = null; emit('overview'); }));
}

// Customer's total per facility against today's options, all over the same contract (apples to apples).
// Sources: AirSight radar guide and cost guide (2026), Echodyne EchoGuard (field of view), Dedrone/Axon price
// lists (data package ref [3]; OMNIA AM9), AirSight subscriptions (data package ref [4]). Range bars: low to high.
const SRC = {
  radar: 'https://www.airsight.com/blog/drone-detection-radar-guide',
  cost: 'https://www.airsight.com/blog/drone-detection-system-cost',
  fov: 'https://www.echodyne.com/newsroom/what-is-a-low-swap-radar',
};
const link = (u, t) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
export function benchBars(el, customer5, years) {
  const C = competitors(), F = state.fin, B = X.finance.benchmarks;
  const items = [
    ['Tripwire: installation + subscription', [customer5], 'var(--accent)', 'this setup; hardware upkeep included'],
    [`Radar-based system (e.g. AirSight): ${F.cmp_radar_n_lo}–${F.cmp_radar_n_hi} radars + installation + software`, [C.radar.lo, C.radar.hi], '#64748b',
      `${usdk(C.radar.upLo)}–${usdk(C.radar.upHi)} upfront + ${years} yrs of software [4]`],
    ['One 360° radar alone (Robin IRIS, Dedrone price list)', [C.iris], '#64748b', 'hardware only: no installation or software'],
    ['RF-only system (Dedrone by Axon): hardware + installation', [C.rf], '#475569', 'software not included [3]; cannot see drones that do not transmit'],
  ];
  const max = Math.max(...items.flatMap((x) => x[1]));
  el.innerHTML = items.map(([n, v, c, sub]) => {
    const val = v.length > 1 ? `${usdk(v[0])} – ${usdk(v[1])}` : usd(v[0]);
    const fill = v.length > 1
      ? `<div class="fill rng" style="left:${(100 * v[0]) / max}%;width:${(100 * (v[1] - v[0])) / max}%;background:${c}"></div>`
      : `<div class="fill" style="width:${(100 * v[0]) / max}%;background:${c}"></div>`;
    return `<div class="bar"><span>${esc(n)}<small>${esc(sub)}</small></span><div class="track">${fill}<span class="val">${val}</span></div></div>`;
  }).join('') + `<p class="note small">The first two bars are the customer's total for one facility over ${years} years; the last two are one-time costs only, so they are floors.
    <b>Radar-based system:</b> a compact drone radar costs ${usdk(F.cmp_radar_lo)}–${usdk(F.cmp_radar_hi)}, hardware only (${link(SRC.radar, 'AirSight radar guide')}).
    One sees about 120° side to side (${link(SRC.fov, 'Echodyne EchoGuard')}), so ${F.cmp_radar_n_lo} cover 360° from one point and ${F.cmp_radar_n_hi} also fill blind spots behind buildings and along the fence (ASSUMPTION).
    Installation, site survey, calibration and training add ${F.cmp_install_lo}–${F.cmp_install_hi}% (${link(SRC.cost, 'AirSight cost guide')}).
    Software: AirSight's yearly packages, ${usd(B.airsight_subscription_low_usd)}–${usd(B.airsight_subscription_high_usd)} [4].
    Competitors' hardware upkeep is not public and is left out, so their totals are on the low side.
    <b>Robin IRIS:</b> ${usd(C.iris)} per unit in Dedrone's price list on OMNIA Partners (Feb 2025 edition, seen in a search result; the file is no longer public).
    <b>RF-only:</b> data package ref [3]. The radar counts, prices and installation shares are editable in Financials.</p>`;
}

function render() {
  $('ovSites').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === state.site));
  const H = headline();
  drawMap(H); kpis(H); levelsTable(H); sitesTable();
  if (H.x) benchBars($('ovBench'), H.x.fin.customer5, state.fin.years);
}

export function initOverview() {
  $('ovSites').innerHTML = Object.keys(X.sites).map((k) => `<button data-k="${k}"><b>${esc(X.sites[k].name)}</b><span>${esc(X.sites[k].type)}</span></button>`).join('');
  $('ovSites').querySelectorAll('button').forEach((b) => (b.onclick = () => { state.site = b.dataset.k; pick = null; emit('overview'); }));
  mountRequirements('ovReq', 'change these four; the recommendation, map, price and tables below follow');
  onChange((src) => { if (src === 'targets' || src === 'overview') pick = null; render(); }); // a new requirement drops a clicked cell
  render();
}
