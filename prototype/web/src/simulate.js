// Trade space simulator tab: the customer says what to protect and which interference scenario to assume; they pick a
// radio and a number of sensors (and, to explore, another antenna setup for off-the-shelf radios) and see the
// protection and price. Charts: protection and cost against the number of sensors, one line per radio.
// All from precomputed explore.json; costs in the browser.
import { $, esc, usd, pct, meters, X, state, defaultReq, fillSelect, INTERF_LABEL, onChange, emit,
  DESIGN, RADIO, RADIO_KEYS, fixedBuild, designFor, OTS_BUILDS, BUILDS_FOR, setup, recommendAt, radioOption, nearestN, outcome, facility, targetsText } from './data.js';
import { info } from './help.js';
import { weakDirections, edgeWord } from './data.js';

// Detection range card: the typical drone (the requirement), with the 8-in-10 figure and weak directions.
function detCard(o, t, card) {
  const weak = weakDirections(o, Math.max(t.detection || 0, 300));
  const sub = `${t.detection ? `target ${t.detection} m · ` : ''}8 in 10: ${o.det80 == null ? '—' : `${Math.round(o.det80)} m`}${weak.length ? ` · late from ${weak.join(', ')}` : ''}`;
  return card('Detection range', 'detection', `${Math.round(o.det ?? 0)} m`, sub, !t.detection ? '' : (o.det ?? 0) >= t.detection ? 'ok' : 'bad');
}

export const RCOL = { bladerf: '#38bdf8', b210: '#a78bfa', custom: '#fb923c' };
const METRIC = {
  caught: { name: 'Drones caught', fmt: pct, max: 100 },
  cov: { name: 'Area covered', fmt: pct, max: 100 },
  trk: { name: 'Time tracked', fmt: pct, max: 100 },
  acc: { name: 'Tracking accuracy', fmt: (v) => (v == null ? '—' : `${Math.round(v)} m`), max: 60, lowBetter: true },
  cost: { name: 'Customer total', fmt: usd, lowBetter: true },
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
  const fixed = fixedBuild(state.radio);
  fillSelect($('spBuild'), [fixed, ...BUILDS_FOR(state.radio).filter((k) => k !== fixed)]
    .map((k) => [k, `${buildText(k)}${k === fixed ? ' (standard)' : ''}`]), designFor(state.radio));
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
    card('Drones caught', 'caught', pct(o.caught), `before they reach the ${edgeWord()}`),
    card('Tracking accuracy', 'accuracy', o.acc == null ? '—' : `~${Math.round(o.acc)} m`, `target within ${t.accuracy} m`, o.acc != null && o.acc <= t.accuracy ? 'ok' : 'bad'),
    detCard(o, t, card),
    card('Customer pays', 'price', `${usd(f.price)}`, `+ ${usd(f.sub)}/yr · ${usd(x.total)} over ${state.fin.years} yrs`),
  ].join('');
  const { rec } = recommendAt(state.site, state.drone, state.interf, t, state.req);
  const isRec = rec && rec.radio === state.radio && rec.n === x.n && designFor(state.radio) === rec.design;
  let html = rec
    ? `Recommended here (cheapest that meets ${targetsText(t)}, with ${state.interf} dB removal): <b>${esc(radioOption(rec.radio, rec.n))}</b>, ${usd(rec.fin.price)} + ${usd(rec.fin.sub)}/yr. ${isRec ? '<span class="badge">this one</span>' : '<button class="ghost small" id="spUse">Use it</button>'}`
    : `<span class="bad">No radio and sensor count meets ${targetsText(t)} with ${state.interf} dB of interference removal.</span> ${state.interf < X.axes.interference.at(-1) ? 'Try a higher interference-removal level (unproven), or ' : 'Try '}a smaller protected distance, or lower the targets on the Overview.`;
  if (state.radio === 'b210') {
    const d = facility(designFor('b210'), x.n, 'b210').node.total - facility(designFor('bladerf'), x.n, 'bladerf').node.total;
    html += `<br><span class="small">The B210 performs like the bladeRF in the model (both 12-bit, 2 channels per board); it adds ${usd(d)} per sensor.</span>`;
  }
  if (state.radio === 'custom') html += '<br><span class="small">The custom receiver is a Series A product (parts list in Financials explorer).</span>';
  $('spRec').innerHTML = html;
  if ($('spUse')) $('spUse').onclick = () => { state.radio = rec.radio; state.n = rec.n; state.build = null; emit('sim-select'); };
}

// Shared axes for the two charts against the number of sensors.
function frame(ymax, ystep, yfmt, ytitle) {
  const W = 480, H = 300, ml = 62, mr = 14, mt = 14, mb = 46, pw = W - ml - mr, ph = H - mt - mb;
  const ns = X.axes.nodes, x0 = ns[0], x1 = ns.at(-1);
  const Xp = (n) => ml + ((n - x0) / (x1 - x0)) * pw, Yp = (v) => mt + ph - (Math.min(v ?? 0, ymax) / ymax) * ph;
  let g = '';
  for (let v = 0; v <= ymax + 1e-9; v += ystep) { g += `<line class="grid" x1="${ml}" x2="${ml + pw}" y1="${Yp(v)}" y2="${Yp(v)}"/><text x="${ml - 6}" y="${Yp(v) + 4}" text-anchor="end">${yfmt(v)}</text>`; }
  for (const n of ns) g += `<line class="grid" x1="${Xp(n)}" x2="${Xp(n)}" y1="${mt}" y2="${mt + ph}"/><text x="${Xp(n)}" y="${H - 26}" text-anchor="middle">${n}</text>`;
  g += `<text class="axis" x="${ml + pw / 2}" y="${H - 6}" text-anchor="middle">number of sensors around the ${edgeWord()}</text>`;
  g += `<text class="axis" transform="translate(14 ${mt + ph / 2}) rotate(-90)" text-anchor="middle">${ytitle}</text>`;
  return { g, Xp, Yp, ml, pw };
}

function nodesChart() {
  const key = $('chMetric').value, Mt = METRIC[key], t = state.targets;
  const { g: g0, Xp, Yp, ml, pw } = frame(100, 20, (v) => `${v}%`, Mt.name.toLowerCase());
  let g = g0;
  const target = key === 'cov' ? t.area : key === 'trk' ? t.tracked : null;
  if (target != null) g += `<line class="tier" stroke="#fbbf24" x1="${ml}" x2="${ml + pw}" y1="${Yp(target)}" y2="${Yp(target)}"/><text class="target" x="${ml + 4}" y="${Yp(target) - 5}">target ${target}%</text>`;
  const odes = designFor('bladerf'), cdes = designFor('custom');
  const lines = [
    { id: 'ots', radio: ots(state.radio) ? state.radio : 'bladerf', design: odes, col: RCOL.bladerf,
      name: `Off-the-shelf: bladeRF or B210${odes !== fixedBuild('bladerf') ? ` (${DESIGN[odes].name} setup)` : ''}` },
    { id: 'custom', radio: 'custom', design: cdes, col: RCOL.custom, name: `Custom receiver (Series A)${cdes !== fixedBuild('custom') ? ` (${DESIGN[cdes].name} setup)` : ''}` },
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
  $('tzBase').textContent = `around ${radioOption(b.radio, b.n)} at ${X.sites[b.site].name}`;
  const inputs = [
    ['Radio', RADIO_KEYS, (v) => ({ radio: v }), (v) => RADIO[v].name],
    ['Sensor setup', BUILDS_FOR(b.radio), (v) => ({ build: v }), (v) => DESIGN[v].name],
    ['Number of sensors', X.axes.nodes, (v) => ({ n: v }), (v) => `${v} sensors`],
    ['Drone', Object.keys(X.drones), (v) => ({ drone: v }), (v) => (v === 'm210' ? '5 kg drone' : 'Mavic')],
    ['Facility', Object.keys(X.sites), (v) => ({ site: v }), (v) => X.sites[v].type],
    ['Drone height', X.axes.heights, (v) => ({ height: v }), (v) => `${v} m up`],
    ['Interference removal', X.axes.interference, (v) => ({ interf: v }), (v) => `${v} dB`],
    ['Protected distance', X.axes.radii, (v) => ({ radius: v }), (v) => `${v} m`],
  ];
  const all = inputs.map(([name, vals, set, lab]) => {
    const pts = vals.map((v) => [lab(v), valueOf(key, { ...b, ...set(v) })]).filter(([, v]) => v != null);
    if (!pts.length) return null;
    const lo = pts.reduce((a, c) => (c[1] < a[1] ? c : a)), hi = pts.reduce((a, c) => (c[1] > a[1] ? c : a));
    return { name, lo, hi, span: hi[1] - lo[1] };
  }).filter(Boolean).sort((a, c) => c.span - a.span);
  const rows = $('tzAll').checked ? all : all.slice(0, 4);
  // Plain-language reading of the chart: the biggest bar, the smallest, and the picked setup.
  const worst = (r) => (Mt.lowBetter ? r.hi : r.lo), best = (r) => (Mt.lowBetter ? r.lo : r.hi);
  const top = all[0], low = all.at(-1), nm = Mt.name.toLowerCase();
  $('tzRead').innerHTML = top
    ? `<b>${esc(top.name)}</b> matters most here: with everything else as picked, ${esc(nm)} goes from <b>${Mt.fmt(worst(top)[1])}</b> (${esc(worst(top)[0])}) to <b>${Mt.fmt(best(top)[1])}</b> (${esc(best(top)[0])}).` +
      (all.length > 1 ? (low.span < 1e-9 ? ` <b>${esc(low.name)}</b> makes no difference here.` : ` <b>${esc(low.name)}</b> matters least (${Mt.fmt(low.lo[1])} to ${Mt.fmt(low.hi[1])}).`) : '') +
      ` Your setup: <b>${Mt.fmt(base)}</b>.${Mt.lowBetter ? ' Lower is better for this result.' : ''}`
    : '';
  const ml = 190, mr = 170, mt = 8, rowH = 38, W = 1000, H = mt + rows.length * rowH + 28;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const vmax = Mt.max && key !== 'acc' ? Mt.max : Math.max(...all.map((r) => r.hi[1]), base ?? 0) * 1.05 || 1;
  const Xp = (v) => ml + (Math.min(v, vmax) / vmax) * (W - ml - mr);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = (vmax * k) / 4; g += `<line class="grid" x1="${Xp(v)}" x2="${Xp(v)}" y1="${mt}" y2="${H - 24}"/><text x="${Xp(v)}" y="${H - 8}" text-anchor="middle">${Mt.fmt(v)}</text>`; }
  rows.forEach((r, i) => {
    const y = mt + i * rowH + 8, h = rowH - 16, x0 = Xp(r.lo[1]), x1 = Xp(r.hi[1]), ty = y + h / 2 + 4;
    g += `<text x="${ml - 10}" y="${ty}" text-anchor="end" class="axis">${esc(r.name)}</text>`;
    g += `<rect x="${x0}" y="${y}" width="${Math.max(3, x1 - x0)}" height="${h}" rx="4" fill="#38bdf8" opacity=".8"><title>${esc(r.name)}: ${Mt.fmt(r.lo[1])} (${esc(r.lo[0])}) to ${Mt.fmt(r.hi[1])} (${esc(r.hi[0])})</title></rect>`;
    // End labels sit outside the bar: low end on the left (if room), high end on the right.
    const lab = (t, x, anchor) => `<text x="${x}" y="${ty}" text-anchor="${anchor}" class="lab">${esc(t)}</text>`;
    if (x1 - x0 < 4) g += lab(`all ${Mt.fmt(r.hi[1])}`, x1 + 6, 'start');
    else if (x0 - ml > r.lo[0].length * 6.5 + 8) g += lab(r.lo[0], x0 - 6, 'end') + lab(r.hi[0], x1 + 6, 'start');
    else if (x1 - x0 > r.lo[0].length * 6.5 + 10) g += `<text x="${x0 + 5}" y="${ty}" class="inbar">${esc(r.lo[0])}</text>` + lab(r.hi[0], x1 + 6, 'start');
    else g += lab(`${r.lo[0]} – ${r.hi[0]}`, x1 + 6, 'start');
  });
  if (base != null) g += `<line x1="${Xp(base)}" x2="${Xp(base)}" y1="${mt}" y2="${H - 24}" stroke="#fbbf24" stroke-width="2.5"/>`;
  svg.innerHTML = g;
}

// Start (and restart after a change of facility or scenario) on the recommended setup, else the standard bladeRF one.
export function pickRecommended() {
  const { rec } = recommendAt(state.site, state.drone, state.interf, state.targets, state.req);
  state.radio = rec?.radio ?? 'bladerf'; state.n = rec?.n ?? 8; state.build = null;
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
  $('spRadio').querySelectorAll('button').forEach((b) => (b.onclick = () => { if ((b.dataset.r === 'custom') !== (state.radio === 'custom')) state.build = null; state.radio = b.dataset.r; emit('sim-select'); }));
  $('spN').oninput = () => { state.n = X.axes.nodes[+$('spN').value]; emit('sim-select'); };
  $('spBuild').onchange = () => { state.build = $('spBuild').value === fixedBuild(state.radio) ? null : $('spBuild').value; emit('sim-select'); };
  const set = (fn) => () => { fn(); emit('req'); };
  $('rqSite').onchange = set(() => (state.site = $('rqSite').value));
  $('rqDrone').onchange = set(() => (state.drone = $('rqDrone').value));
  $('rqInterf').onchange = set(() => (state.interf = +$('rqInterf').value));
  $('rqRadius').oninput = set(() => (state.req.radius_m = X.axes.radii[+$('rqRadius').value]));
  $('rqHeight').onchange = set(() => (state.req.height_m = +$('rqHeight').value));
  $('rqReset').onclick = set(() => { state.req = defaultReq(); state.interf = X.default_req.interference_db; });
  $('tzMetric').onchange = tornado;
  $('tzAll').onchange = tornado;
  $('chMetric').onchange = nodesChart;
  pickRecommended();
  onChange(render);
  render();
}
