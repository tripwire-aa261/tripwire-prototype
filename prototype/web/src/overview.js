// Overview tab: outcome-first story for investors and graders, using the default customer requirements.
import { $, esc, usd, pct, meters, X, state, outcome, meets, facility, defaultRadio, defaultReq, fillSelect, INTERF_LABEL, onChange, emit } from './data.js';
import { distToPolygon } from './viewer3d.js';

const REQ = () => defaultReq(); // the Overview always uses the default requirements

function rec(site, drone, interf) {
  return X.recommended[`${site}|${drone}|${interf}`];
}

function drawMap() {
  const site = X.sites[state.site], r = rec(state.site, state.drone, state.interf);
  const m = X.maps.find((x) => x.k[0] === state.site && x.k[1] === state.drone && x.k[2] === r.design && x.k[4] === state.interf && x.k[5] === r.n);
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

function kpis() {
  const req = REQ(), r = rec(state.site, state.drone, state.interf), d = X.designs[r.design];
  const o = outcome(state.site, state.drone, r.design, req.height_m, state.interf, r.n, req.radius_m);
  const ok = meets(o, req).ok, f = facility(r.design, r.n, defaultRadio(r.design), String(req.coverage_pct));
  $('ovReqHint').textContent = `${X.drones[state.drone].name}, ${req.height_m} m up`;
  const card = (k, v, s, cls = '') => `<div class="kpi ${cls}"><small>${k}</small><b>${v}</b><span>${s}</span></div>`;
  $('ovKpis').innerHTML = [
    card('Area covered', pct(o.cov), `within ${req.radius_m} m of the fence`, o.cov >= req.coverage_pct ? 'ok' : 'bad'),
    card('Time tracked', pct(o.trk), 'of a drone\'s time inside the zone', o.trk >= req.tracked_pct ? 'ok' : 'bad'),
    card('Position accuracy', o.acc == null ? '—' : `~${Math.round(o.acc)} m`, `updated every ${X.update_interval_s} s`, o.acc != null && o.acc <= req.accuracy_m ? 'ok' : 'bad'),
    card('Early warning', o.warn == null ? '—' : meters(o.warn), 'outside the fence when first tracked'),
    card('Customer price', `${usd(f.price)} + ${usd(f.sub)}/yr`, `${req.coverage_pct}% coverage tier`),
    card('Our upfront cost', usd(f.upfront), `${r.n} sensors installed`),
  ].join('');
  $('ovDesign').innerHTML = ok
    ? `<b>Design:</b> ${r.n} sensors (${esc(d.label.toLowerCase())}). The cheapest design that meets the default requirements here.`
    : `<b>No design meets the default requirements here</b> under this interference assumption. Shown: the best one tried (${r.n} sensors, ${esc(d.label.toLowerCase())}). Try the optimistic interference setting to see what measuring it could unlock.`;
}

function sitesTable() {
  // Side by side: today's interference assumption vs the optimistic (unproven) one.
  const req = REQ(), tier = String(req.coverage_pct), levels = [X.axes.interference[0], X.axes.interference.at(-1)];
  const cell = (k, lv) => {
    const r = rec(k, state.drone, lv), d = X.designs[r.design];
    const o = outcome(k, state.drone, r.design, req.height_m, lv, r.n, req.radius_m), f = facility(r.design, r.n, defaultRadio(r.design), tier);
    if (!r.meets) return `<td class="split"><span class="bad">No design meets the requirements</span><br><span class="note">best: ${pct(o.cov)} covered with ${r.n} sensors</span></td><td>—</td>`;
    return `<td class="split"><b>${r.n} sensors</b> · ${esc(d.short)}<br><span class="note">${pct(o.cov)} covered · ${pct(o.trk)} tracked · ~${Math.round(o.acc)} m</span></td><td>${usd(f.upfront)}</td>`;
  };
  const rows = Object.keys(X.sites).map((k) => {
    const s = X.sites[k];
    return `<tr class="${k === state.site ? 'on' : ''}" data-k="${k}"><td><b>${esc(s.name)}</b><br><span class="note">${esc(s.type)} · ${s.towers_5km} towers within 5 km, nearest ${s.nearest_tower_km} km</span></td>${cell(k, levels[0])}${cell(k, levels[1])}</tr>`;
  }).join('');
  $('ovSitesTable').innerHTML = `<tr><th rowspan="2">Facility</th><th colspan="2" class="grp">Today's assumption: ${levels[0]} dB interference removal</th><th colspan="2" class="grp">If enhanced processing removes ${levels[1]} dB (unproven)</th></tr>
    <tr><th class="split">Cheapest design that works</th><th>Our upfront cost</th><th class="split">Cheapest design that works</th><th>Our upfront cost</th></tr>${rows}`;
  $('ovSitesTable').querySelectorAll('tr[data-k]').forEach((tr) => (tr.onclick = () => { state.site = tr.dataset.k; emit('overview'); }));
}

export function benchBars(el, customer5, years) {
  const b = X.finance.benchmarks;
  const items = [
    ['Tripwire: install + subscription', customer5, 'var(--accent)'],
    ['Axon: hardware + installation only [3]', b.axon_hardware_install_usd, '#64748b'],
    [`AirSight: ${years} yrs, low tier [4]`, years * b.airsight_subscription_low_usd, '#64748b'],
    [`AirSight: ${years} yrs, top tier [4]`, years * b.airsight_subscription_high_usd, '#64748b'],
  ];
  const max = Math.max(...items.map((x) => x[1]));
  el.innerHTML = items.map(([n, v, c]) => `<div class="bar"><span>${n}</span><div class="track"><div class="fill" style="width:${(100 * v) / max}%;background:${c}"></div><span class="val">${usd(v)}</span></div></div>`).join('');
}

function render() {
  $('ovSites').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === state.site));
  $('ovDrone').value = state.drone;
  $('ovInterf').value = String(state.interf);
  drawMap(); kpis(); sitesTable();
  const req = REQ(), r = rec(state.site, state.drone, state.interf);
  const f = facility(r.design, r.n, defaultRadio(r.design), String(req.coverage_pct));
  benchBars($('ovBench'), f.customer5, state.fin.years);
}

export function initOverview() {
  $('ovSites').innerHTML = Object.keys(X.sites).map((k) => `<button data-k="${k}"><b>${esc(X.sites[k].name)}</b><span>${esc(X.sites[k].type)}</span></button>`).join('');
  $('ovSites').querySelectorAll('button').forEach((b) => (b.onclick = () => { state.site = b.dataset.k; emit('overview'); }));
  fillSelect($('ovDrone'), Object.entries(X.drones).map(([k, d]) => [k, d.name]), state.drone);
  fillSelect($('ovInterf'), X.axes.interference.map((i) => [i, INTERF_LABEL[i]]), state.interf);
  $('ovDrone').onchange = () => { state.drone = $('ovDrone').value; emit('overview'); };
  $('ovInterf').onchange = () => { state.interf = +$('ovInterf').value; emit('overview'); };
  onChange(render);
  render();
}
