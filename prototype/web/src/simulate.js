// Simulation tab: the customer says what to protect and which interference scenario to assume; they pick a
// radio and a number of sensors (and, to explore, another antenna setup for off-the-shelf radios) and see the
// protection and price. Charts: protection and cost against the number of sensors, one line per radio.
// All from precomputed explore.json; costs in the browser.
import { $, esc, usd, pct, meters, X, state, defaultReq, fillSelect, INTERF_LABEL, onChange, emit,
  DESIGN, RADIO, RADIO_KEYS, fixedBuild, designFor, OTS_BUILDS, setup, recommendAt, radioOption, nearestN, outcome, facility } from './data.js';
import { info } from './help.js';

export const RCOL = { bladerf: '#38bdf8', b210: '#a78bfa', custom: '#fb923c' };
const METRIC = {
  caught: { name: 'Drones caught', fmt: pct, max: 100 },
  cov: { name: 'Area covered', fmt: pct, max: 100 },
  trk: { name: 'Time tracked', fmt: pct, max: 100 },
  acc: { name: 'Position accuracy', fmt: (v) => (v == null ? '—' : `${Math.round(v)} m`), max: 60 },
  cost: { name: 'Customer total', fmt: usd },
};
const buildText = (k) => `${DESIGN[k].name}: ${DESIGN[k].spec.replace(/ · (off-the-shelf|our own) radio/, '')}`;
const ots = (r) => r !== 'custom';

function syncControls() {
  const r = state.req, radii = X.axes.radii;
  $('rqSite').value = state.site; $('rqDrone').value = state.drone; $('rqInterf').value = String(state.interf);
  $('rqRadius').value = radii.indexOf(r.radius_m); $('rqRadius').parentElement.querySelector('output').textContent = `${r.radius_m} m`;
  $('rqHeight').value = String(r.height_m);
  $('spRadio').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.r === state.radio)));
  $('spN').value = X.axes.nodes.indexOf(nearestN(state.n)); $('spNOut').textContent = `${nearestN(state.n)} sensors`;
  if (ots(state.radio)) {
    fillSelect($('spBuild'), OTS_BUILDS().map((k) => [k, `${buildText(k)}${k === fixedBuild('bladerf') ? ' (standard)' : ''}`]), state.build);
    $('spBuild').disabled = false;
  } else {
    fillSelect($('spBuild'), [[fixedBuild('custom'), `${buildText(fixedBuild('custom'))} (fixed)`]]);
    $('spBuild').disabled = true;
  }
}

const cur = () => setup(state.site, state.drone, state.interf, state.radio, nearestN(state.n), state.req, designFor(state.radio));

function picker() {
  const x = cur(), t = state.targets;
  const card = (k, h, v, s, cls = '') => `<div class="kpi ${cls}"><small>${k} ${info(h)}</small><b>${v}</b><span>${s}</span></div>`;
  if (!x) { $('spKpis').innerHTML = ''; return; }
  const o = x.o, f = x.fin;
  $('spKpis').innerHTML = [
    card('Area covered', 'area', pct(o.cov), `target ${t.area}%`, o.cov >= t.area ? 'ok' : 'bad'),
    card('Time tracked', 'tracked', pct(o.trk), `target ${t.tracked}%`, o.trk >= t.tracked ? 'ok' : 'bad'),
    card('Drones caught', 'caught', pct(o.caught), 'before they reach the fence'),
    card('Accuracy', 'accuracy', o.acc == null ? '—' : `~${Math.round(o.acc)} m`, `early warning ${meters(o.warn)}`),
    card('Customer pays', 'price', `${usd(f.price)}`, `+ ${usd(f.sub)}/yr · ${usd(x.total)} over ${state.fin.years} yrs`),
  ].join('');
  const { rec } = recommendAt(state.site, state.drone, state.interf, t, state.req);
  const isRec = rec && rec.radio === state.radio && rec.n === x.n && designFor(state.radio) === rec.design;
  let html = rec
    ? `Recommended here (cheapest that covers ${t.area}% and tracks ${t.tracked}%, with ${state.interf} dB removal): <b>${esc(radioOption(rec.radio, rec.n))}</b>, ${usd(rec.fin.price)} + ${usd(rec.fin.sub)}/yr. ${isRec ? '<span class="badge">this one</span>' : '<button class="ghost small" id="spUse">Use it</button>'}`
    : `<span class="bad">No radio and sensor count meets ${t.area}% area and ${t.tracked}% tracked with ${state.interf} dB of interference removal.</span> ${state.interf < X.axes.interference.at(-1) ? 'Try a higher interference-removal level (unproven), or ' : 'Try '}a smaller protected distance, or lower the targets on the Overview.`;
  if (state.radio === 'b210') {
    const d = facility(designFor('b210'), x.n, 'b210').node.total - facility(designFor('bladerf'), x.n, 'bladerf').node.total;
    html += `<br><span class="small">The B210 performs like the bladeRF in the model (both 12-bit, 2 channels per board); it adds ${usd(d)} per sensor.</span>`;
  }
  if (state.radio === 'custom') html += '<br><span class="small">The custom receiver is a Series A product (parts list in Financials).</span>';
  $('spRec').innerHTML = html;
  if ($('spUse')) $('spUse').onclick = () => { state.radio = rec.radio; state.n = rec.n; if (ots(rec.radio)) state.build = rec.design; emit('sim-select'); };
}

// Shared axes for the two charts against the number of sensors.
function frame(ymax, ystep, yfmt, ytitle) {
  const W = 480, H = 300, ml = 62, mr = 14, mt = 14, mb = 46, pw = W - ml - mr, ph = H - mt - mb;
  const ns = X.axes.nodes, x0 = ns[0], x1 = ns.at(-1);
  const Xp = (n) => ml + ((n - x0) / (x1 - x0)) * pw, Yp = (v) => mt + ph - (Math.min(v ?? 0, ymax) / ymax) * ph;
  let g = '';
  for (let v = 0; v <= ymax + 1e-9; v += ystep) { g += `<line class="grid" x1="${ml}" x2="${ml + pw}" y1="${Yp(v)}" y2="${Yp(v)}"/><text x="${ml - 6}" y="${Yp(v) + 4}" text-anchor="end">${yfmt(v)}</text>`; }
  for (const n of ns) g += `<line class="grid" x1="${Xp(n)}" x2="${Xp(n)}" y1="${mt}" y2="${mt + ph}"/><text x="${Xp(n)}" y="${H - 26}" text-anchor="middle">${n}</text>`;
  g += `<text class="axis" x="${ml + pw / 2}" y="${H - 6}" text-anchor="middle">number of sensors on the fence</text>`;
  g += `<text class="axis" transform="translate(14 ${mt + ph / 2}) rotate(-90)" text-anchor="middle">${ytitle}</text>`;
  return { g, Xp, Yp, ml, pw };
}

function nodesChart() {
  const key = $('chMetric').value, Mt = METRIC[key], t = state.targets;
  const { g: g0, Xp, Yp, ml, pw } = frame(100, 20, (v) => `${v}%`, Mt.name.toLowerCase());
  let g = g0;
  const target = key === 'cov' ? t.area : key === 'trk' ? t.tracked : null;
  if (target != null) g += `<line class="tier" stroke="#fbbf24" x1="${ml}" x2="${ml + pw}" y1="${Yp(target)}" y2="${Yp(target)}"/><text class="target" x="${ml + 4}" y="${Yp(target) - 5}">target ${target}%</text>`;
  const lines = [
    { id: 'ots', radio: ots(state.radio) ? state.radio : 'bladerf', design: designFor('bladerf'), col: RCOL.bladerf,
      name: `Off-the-shelf: bladeRF or B210${state.build !== fixedBuild('bladerf') ? ` (${DESIGN[state.build].name} setup)` : ''}` },
    { id: 'custom', radio: 'custom', design: fixedBuild('custom'), col: RCOL.custom, name: 'Custom receiver (Series A)' },
  ];
  for (const L of lines) {
    const pts = X.axes.nodes.map((n) => setup(state.site, state.drone, state.interf, L.radio, n, state.req, L.design)).filter(Boolean);
    g += `<polyline fill="none" stroke="${L.col}" stroke-width="2.2" points="${pts.map((x) => `${Xp(x.n)},${Yp(x.o[key])}`).join(' ')}"/>`;
    for (const x of pts) {
      const on = (L.id === 'custom') === (state.radio === 'custom') && x.n === nearestN(state.n);
      g += `<circle cx="${Xp(x.n)}" cy="${Yp(x.o[key])}" r="${on ? 7.5 : 4.5}" fill="${L.col}" stroke="${on ? '#fff' : 'none'}" stroke-width="2" data-r="${L.radio}" data-n="${x.n}" data-v="${Math.round(x.o[key] ?? 0)}" style="cursor:pointer"/>`;
    }
  }
  $('chNodes').innerHTML = g;
  $('chLegend').innerHTML = lines.map((L) => `<span><i class="dot" style="background:${L.col}"></i>${esc(L.name)}</span>`).join('');
  $('chNodes').querySelectorAll('circle[data-r]').forEach((el) => {
    el.onmouseenter = () => { $('chTip').innerHTML = `<b>${esc(radioOption(el.dataset.r, +el.dataset.n))}</b>: ${el.dataset.v}% ${Mt.name.toLowerCase()}. Click to pick it.`; };
    el.onclick = () => { state.radio = el.dataset.r; state.n = +el.dataset.n; emit('sim-select'); };
  });
}

function costChart() {
  const Y = state.fin.years;
  const series = RADIO_KEYS.map((r) => ({ r, pts: X.axes.nodes.map((n) => ({ n, v: facility(designFor(r), n, r).customer5 })) }));
  const vmax = Math.max(...series.flatMap((s) => s.pts.map((p) => p.v))) * 1.05;
  const step = vmax > 2e6 ? 5e5 : vmax > 1e6 ? 2.5e5 : vmax > 4e5 ? 1e5 : 5e4, ymax = Math.ceil(vmax / step) * step;
  const { g: g0, Xp, Yp } = frame(ymax, step, (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(v % 1e6 ? 2 : 0)}M` : `$${Math.round(v / 1000)}k`), `customer total, ${Y} years`);
  let g = g0;
  for (const s of series) {
    g += `<polyline fill="none" stroke="${RCOL[s.r]}" stroke-width="2.2" ${s.r === 'b210' ? 'stroke-dasharray="6 4"' : ''} points="${s.pts.map((p) => `${Xp(p.n)},${Yp(p.v)}`).join(' ')}"/>`;
    for (const p of s.pts) {
      const on = s.r === state.radio && p.n === nearestN(state.n);
      g += `<circle cx="${Xp(p.n)}" cy="${Yp(p.v)}" r="${on ? 7 : 3.5}" fill="${RCOL[s.r]}" stroke="${on ? '#fff' : 'none'}" stroke-width="2"><title>${esc(radioOption(s.r, p.n))}: ${usd(p.v)}</title></circle>`;
    }
  }
  $('chCost').innerHTML = g;
  $('chCostLegend').innerHTML = RADIO_KEYS.map((r) => `<span><i class="dot" style="background:${RCOL[r]}"></i>${esc(RADIO[r].name)}${r === 'custom' ? ' (Series A)' : ''}</span>`).join('');
}

function valueOf(key, p) {
  const design = designFor(p.radio, p.build);
  if (key === 'cost') return facility(design, p.n, p.radio).customer5;
  return outcome(p.site, p.drone, design, p.height, p.interf, nearestN(p.n), p.radius)?.[key] ?? null;
}

function tornado() {
  const key = $('tzMetric').value, Mt = METRIC[key], svg = $('tornado'), R = state.req;
  const b = { site: state.site, drone: state.drone, radio: state.radio, build: state.build, height: R.height_m, interf: state.interf, n: nearestN(state.n), radius: R.radius_m };
  const base = valueOf(key, b);
  $('tzBase').textContent = `around: ${radioOption(b.radio, b.n)}`;
  const inputs = [
    ['Radio', RADIO_KEYS, (v) => ({ radio: v }), (v) => RADIO[v].name],
    ...(ots(b.radio) ? [['Antenna setup', OTS_BUILDS(), (v) => ({ build: v }), (v) => DESIGN[v].name]] : []),
    ['Number of sensors', X.axes.nodes, (v) => ({ n: v }), (v) => `${v}`],
    ['Drone', Object.keys(X.drones), (v) => ({ drone: v }), (v) => (v === 'm210' ? '5 kg' : 'Mavic')],
    ['Facility', Object.keys(X.sites), (v) => ({ site: v }), (v) => X.sites[v].type],
    ['Drone height', X.axes.heights, (v) => ({ height: v }), (v) => `${v} m`],
    ['Interference removal', X.axes.interference, (v) => ({ interf: v }), (v) => `${v} dB`],
    ['Protected distance', X.axes.radii, (v) => ({ radius: v }), (v) => `${v} m`],
  ];
  const rows = inputs.map(([name, vals, set, lab]) => {
    const pts = vals.map((v) => [lab(v), valueOf(key, { ...b, ...set(v) })]).filter(([, v]) => v != null);
    if (!pts.length) return null;
    const lo = pts.reduce((a, c) => (c[1] < a[1] ? c : a)), hi = pts.reduce((a, c) => (c[1] > a[1] ? c : a));
    return { name, lo, hi, span: hi[1] - lo[1] };
  }).filter(Boolean).sort((a, c) => c.span - a.span);
  const W = 640, H = 330, ml = 150, mr = 20, mt = 10, rowH = (H - mt - 28) / rows.length;
  const vmax = key === 'cost' ? Math.max(...rows.map((r) => r.hi[1])) * 1.05 : Mt.max;
  const Xp = (v) => ml + (Math.min(v, vmax) / vmax) * (W - ml - mr);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = (vmax * k) / 4; g += `<line class="grid" x1="${Xp(v)}" x2="${Xp(v)}" y1="${mt}" y2="${H - 24}"/><text x="${Xp(v)}" y="${H - 8}" text-anchor="middle">${Mt.fmt(v)}</text>`; }
  rows.forEach((r, i) => {
    const y = mt + i * rowH + rowH * 0.2, h = rowH * 0.6;
    g += `<text x="${ml - 8}" y="${y + h / 2 + 4}" text-anchor="end">${esc(r.name)}</text>`;
    g += `<rect x="${Xp(r.lo[1])}" y="${y}" width="${Math.max(2, Xp(r.hi[1]) - Xp(r.lo[1]))}" height="${h}" rx="3" fill="#38bdf8" opacity=".75"><title>${esc(r.name)}: ${Mt.fmt(r.lo[1])} (${esc(r.lo[0])}) to ${Mt.fmt(r.hi[1])} (${esc(r.hi[0])})</title></rect>`;
    const tw = (t) => t.length * 5.6, x0 = Xp(r.lo[1]), x1 = Xp(r.hi[1]), ty = y + h / 2 + 4;
    const loIn = x0 - 4 - tw(r.lo[0]) < ml, hiIn = x1 + 4 + tw(r.hi[0]) > W - 2;
    if (hiIn && !loIn && x1 - x0 < tw(r.hi[0]) + 8) {
      g += `<text x="${x0 - 4}" y="${ty}" text-anchor="end" class="lab">${esc(r.lo[0])} – ${esc(r.hi[0])}</text>`;
    } else if (loIn && hiIn && x1 - x0 < tw(r.lo[0]) + tw(r.hi[0]) + 12) {
      g += `<text x="${(x0 + x1) / 2}" y="${ty}" text-anchor="middle" class="inbar">${esc(r.lo[0])} → ${esc(r.hi[0])}</text>`;
    } else {
      g += loIn ? `<text x="${x0 + 4}" y="${ty}" class="inbar">${esc(r.lo[0])}</text>` : `<text x="${x0 - 4}" y="${ty}" text-anchor="end" class="lab">${esc(r.lo[0])}</text>`;
      g += hiIn ? `<text x="${x1 - 4}" y="${ty}" text-anchor="end" class="inbar">${esc(r.hi[0])}</text>` : `<text x="${x1 + 4}" y="${ty}" class="lab">${esc(r.hi[0])}</text>`;
    }
  });
  if (base != null) g += `<line x1="${Xp(base)}" x2="${Xp(base)}" y1="${mt}" y2="${H - 24}" stroke="#fbbf24" stroke-width="2"/>`;
  svg.innerHTML = g;
}

// Start (and restart after a change of facility or scenario) on the recommended setup, else the standard bladeRF one.
export function pickRecommended() {
  const { rec } = recommendAt(state.site, state.drone, state.interf, state.targets, state.req);
  state.radio = rec?.radio ?? 'bladerf'; state.n = rec?.n ?? 8; state.build = fixedBuild('bladerf');
}

function render(source) {
  if (source === 'overview' || source === 'req' || source === 'targets') pickRecommended();
  syncControls();
  picker();
  nodesChart();
  costChart();
  tornado();
}

export function initSimulate() {
  fillSelect($('rqSite'), Object.keys(X.sites).map((k) => [k, `${X.sites[k].name} (${X.sites[k].type})`]));
  fillSelect($('rqDrone'), Object.entries(X.drones).map(([k, d]) => [k, d.name]));
  fillSelect($('rqHeight'), X.axes.heights.map((h) => [h, `${h} m`]));
  fillSelect($('rqInterf'), X.axes.interference.map((i) => [i, INTERF_LABEL[i]]));
  $('spRadio').innerHTML = RADIO_KEYS.map((r) => `<button type="button" role="radio" data-r="${r}"><b>${esc(RADIO[r].name)}</b><small>${RADIO[r].kind} · ${RADIO[r].stage}</small></button>`).join('');
  $('spRadio').querySelectorAll('button').forEach((b) => (b.onclick = () => { state.radio = b.dataset.r; emit('sim-select'); }));
  $('spN').oninput = () => { state.n = X.axes.nodes[+$('spN').value]; emit('sim-select'); };
  $('spBuild').onchange = () => { if (ots(state.radio)) state.build = $('spBuild').value; emit('sim-select'); };
  const set = (fn) => () => { fn(); emit('req'); };
  $('rqSite').onchange = set(() => (state.site = $('rqSite').value));
  $('rqDrone').onchange = set(() => (state.drone = $('rqDrone').value));
  $('rqInterf').onchange = set(() => (state.interf = +$('rqInterf').value));
  $('rqRadius').oninput = set(() => (state.req.radius_m = X.axes.radii[+$('rqRadius').value]));
  $('rqHeight').onchange = set(() => (state.req.height_m = +$('rqHeight').value));
  $('rqReset').onclick = set(() => { state.req = defaultReq(); state.interf = X.default_req.interference_db; });
  $('tzMetric').onchange = tornado;
  $('chMetric').onchange = nodesChart;
  pickRecommended();
  onChange(render);
  render();
}
