// Simulation tab: customer requirements in, designs that meet them out, plus the sensors chart and the
// sensitivity ("what moves the result") chart. All from precomputed explore.json; costs in the browser.
import { $, esc, usd, pct, meters, X, state, outcome, meets, facility, defaultRadio, defaultReq, rankDesigns, fillSelect, INTERF_LABEL, onChange, emit } from './data.js';

const COL = { basic: '#e69f00', ring4: '#cc79a7', fan2_enh: '#a3e635', ring4_enh: '#22d3ee', ring4_enh_mic: '#38bdf8', ring8_enh_mic: '#fb923c' };
const METRIC = {
  cov: { name: 'Area covered', unit: '%', fmt: pct, req: () => state.req.coverage_pct, better: 'high', max: 100 },
  trk: { name: 'Time tracked', unit: '%', fmt: pct, req: () => state.req.tracked_pct, better: 'high', max: 100 },
  acc: { name: 'Position accuracy', unit: 'm', fmt: (v) => (v == null ? '—' : `${Math.round(v)} m`), req: () => state.req.accuracy_m, better: 'low', max: 60 },
  cost: { name: 'Upfront cost', unit: '$', fmt: usd, better: 'low' },
};

function syncControls() {
  const r = state.req, radii = X.axes.radii;
  $('rqSite').value = state.site; $('rqDrone').value = state.drone; $('rqInterf').value = String(state.interf);
  $('rqRadius').value = radii.indexOf(r.radius_m); $('rqRadius').parentElement.querySelector('output').textContent = `${r.radius_m} m`;
  $('rqHeight').value = String(r.height_m);
  $('rqCov').value = String(r.coverage_pct);
  $('rqTrk').value = r.tracked_pct; $('rqTrk').parentElement.querySelector('output').textContent = `${r.tracked_pct}%`;
  $('rqAcc').value = r.accuracy_m; $('rqAcc').parentElement.querySelector('output').textContent = `${r.accuracy_m} m`;
  $('rqUpd').value = r.update_s; $('rqUpd').parentElement.querySelector('output').textContent = `${(+r.update_s).toFixed(1)} s`;
  $('rqNote').textContent = `Position updates come every ${X.update_interval_s} s with the current processing (0.8 s integration); a faster update rate needs shorter integration, which costs sensitivity.`;
}

let ranked = [];
function designsTable() {
  ranked = rankDesigns(state.site, state.drone);
  if (!state.design) {
    const top = ranked[0];
    state.design = top.design; state.n = top.ok ? top.n : X.axes.nodes.at(-1);
  }
  const R = state.req;
  const rows = ranked.map((r, i) => {
    const d = X.designs[r.design], sel = r.design === state.design ? 'on' : '';
    if (!r.ok) {
      const b = r.best, why = meets(b, R).fails.join(', ');
      return `<tr class="${sel} dim" data-d="${r.design}" data-n="${X.axes.nodes.at(-1)}"><td><i class="sw" style="background:${COL[r.design]}"></i>${esc(d.label)}</td>
        <td colspan="6" class="note">Not met even with ${X.axes.nodes.at(-1)} sensors (falls short on ${esc(why)}): best ${pct(b?.cov)} area, ${pct(b?.trk)} tracked</td><td>—</td></tr>`;
    }
    const o = r.o, f = r.fin;
    return `<tr class="${sel}" data-d="${r.design}" data-n="${r.n}"><td><i class="sw" style="background:${COL[r.design]}"></i>${esc(d.label)}${i === 0 ? ' <span class="badge">cheapest</span>' : ''}</td>
      <td><b>${r.n}</b></td><td>${pct(o.cov)}</td><td>${pct(o.trk)}</td><td>${o.acc == null ? '—' : '~' + Math.round(o.acc) + ' m'}</td><td>${meters(o.warn)}</td>
      <td>${usd(f.upfront)}</td><td>${usd(f.yearly)}/yr</td></tr>`;
  }).join('');
  const hint = ranked.some((r) => r.ok) ? '' : `<tr><td colspan="8" class="hintrow">No design meets these requirements at ${esc(X.sites[state.site].name)}. ${state.interf < X.axes.interference.at(-1) ? 'Try the optimistic interference-removal scenario (what the Seed recordings will test), or ' : 'Try '}a smaller protected distance or lower targets.</td></tr>`;
  $('dsTable').innerHTML = hint + `<tr><th>Sensor design</th><th>Sensors needed</th><th>Area covered</th><th>Time tracked</th><th>Accuracy</th><th>Early warning</th><th>Our upfront cost</th><th>Our running cost</th></tr>${rows}`;
  $('dsTable').querySelectorAll('tr[data-d]').forEach((tr) => (tr.onclick = () => { state.design = tr.dataset.d; state.n = +tr.dataset.n; emit('sim-select'); }));
}

function nodesChart() {
  const key = $('chMetric').value, M = METRIC[key], svg = $('chNodes'), R = state.req;
  const W = 640, H = 330, ml = 46, mr = 16, mt = 14, mb = 40, pw = W - ml - mr, ph = H - mt - mb, ns = X.axes.nodes;
  const ymax = M.max;
  const Xp = (n) => ml + ((n - ns[0]) / (ns.at(-1) - ns[0])) * pw, Yp = (v) => mt + ph - (Math.min(v, ymax) / ymax) * ph;
  let g = '';
  for (let v = 0; v <= ymax; v += ymax / 5) g += `<line class="grid" x1="${ml}" x2="${ml + pw}" y1="${Yp(v)}" y2="${Yp(v)}"/><text x="${ml - 6}" y="${Yp(v) + 4}" text-anchor="end">${Math.round(v)}${M.unit === '%' ? '%' : ''}</text>`;
  for (const n of ns) g += `<text x="${Xp(n)}" y="${H - 22}" text-anchor="middle">${n}</text>`;
  g += `<text x="${ml + pw / 2}" y="${H - 4}" text-anchor="middle">sensors on the perimeter</text>`;
  const rv = M.req();
  g += `<line class="tier" stroke="#fbbf24" x1="${ml}" x2="${ml + pw}" y1="${Yp(rv)}" y2="${Yp(rv)}"/><text x="${ml + 4}" y="${Yp(rv) - 4}" style="fill:#fbbf24">requirement: ${M.fmt(rv)}${M.better === 'low' ? ' or better' : ''}</text>`;
  for (const d of Object.keys(X.designs)) {
    const pts = ns.map((n) => [n, outcome(state.site, state.drone, d, R.height_m, state.interf, n, R.radius_m)?.[key]]).filter(([, v]) => v != null);
    if (!pts.length) continue;
    const on = d === state.design;
    g += `<polyline fill="none" stroke="${COL[d]}" stroke-width="${on ? 3.2 : 1.6}" opacity="${on ? 1 : 0.55}" points="${pts.map(([n, v]) => `${Xp(n)},${Yp(v)}`).join(' ')}"/>`;
    for (const [n, v] of pts) g += `<circle cx="${Xp(n)}" cy="${Yp(v)}" r="${on ? 4 : 2.6}" fill="${COL[d]}" data-d="${d}" data-n="${n}"/>`;
  }
  svg.innerHTML = g;
  svg.querySelectorAll('circle').forEach((c) => (c.onmouseenter = () => {
    const d = c.dataset.d, n = +c.dataset.n, o = outcome(state.site, state.drone, d, R.height_m, state.interf, n, R.radius_m);
    const f = facility(d, n, defaultRadio(d), String(R.coverage_pct));
    $('chTip').innerHTML = `<b>${esc(X.designs[d].label)}</b>, ${n} sensors: ${pct(o.cov)} area covered, ${pct(o.trk)} tracked, accuracy ${o.acc == null ? '—' : '~' + Math.round(o.acc) + ' m'}; our upfront cost ${usd(f.upfront)}.`;
  }));
}

function valueOf(key, site, drone, design, height, interf, n, radius) {
  if (key === 'cost') return facility(design, n, defaultRadio(design), String(state.req.coverage_pct)).upfront;
  const nn = X.axes.nodes.reduce((p, c) => (Math.abs(c - n) < Math.abs(p - n) ? c : p)); // nearest computed count
  return outcome(site, drone, design, height, interf, nn, radius)?.[key] ?? null;
}

function tornado() {
  const key = $('tzMetric').value, M = METRIC[key], svg = $('tornado'), R = state.req;
  const b = { site: state.site, drone: state.drone, design: state.design, height: R.height_m, interf: state.interf, n: state.n, radius: R.radius_m };
  const base = valueOf(key, b.site, b.drone, b.design, b.height, b.interf, b.n, b.radius);
  $('tzBase').textContent = `around: ${X.designs[b.design].short}, ${b.n} sensors`;
  const inputs = [
    ['Sensor design', Object.keys(X.designs), (v) => ({ design: v }), (v) => X.designs[v].short],
    ['Number of sensors', X.axes.nodes, (v) => ({ n: v }), (v) => `${v}`],
    ['Drone type', Object.keys(X.drones), (v) => ({ drone: v }), (v) => (v === 'm210' ? '5 kg' : 'Mavic')],
    ['Facility', Object.keys(X.sites), (v) => ({ site: v }), (v) => X.sites[v].type],
    ['Drone height', X.axes.heights, (v) => ({ height: v }), (v) => `${v} m`],
    ['Interference removal', X.axes.interference, (v) => ({ interf: v }), (v) => `${v} dB`],
    ['Protected distance', X.axes.radii, (v) => ({ radius: v }), (v) => `${v} m`],
  ];
  const rows = inputs.map(([name, vals, set, lab]) => {
    const pts = vals.map((v) => { const p = { ...b, ...set(v) }; return [lab(v), valueOf(key, p.site, p.drone, p.design, p.height, p.interf, p.n, p.radius)]; }).filter(([, v]) => v != null);
    if (!pts.length) return null;
    const lo = pts.reduce((a, c) => (c[1] < a[1] ? c : a)), hi = pts.reduce((a, c) => (c[1] > a[1] ? c : a));
    return { name, lo, hi, span: hi[1] - lo[1] };
  }).filter(Boolean).sort((a, c) => c.span - a.span);
  const W = 640, H = 330, ml = 150, mr = 20, mt = 10, rowH = (H - mt - 28) / rows.length;
  const vmax = key === 'cost' ? Math.max(...rows.map((r) => r.hi[1])) * 1.05 : M.max;
  const Xp = (v) => ml + (Math.min(v, vmax) / vmax) * (W - ml - mr);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = (vmax * k) / 4; g += `<line class="grid" x1="${Xp(v)}" x2="${Xp(v)}" y1="${mt}" y2="${H - 24}"/><text x="${Xp(v)}" y="${H - 8}" text-anchor="middle">${M.fmt(v)}</text>`; }
  rows.forEach((r, i) => {
    const y = mt + i * rowH + rowH * 0.2, h = rowH * 0.6;
    g += `<text x="${ml - 8}" y="${y + h / 2 + 4}" text-anchor="end">${esc(r.name)}</text>`;
    g += `<rect x="${Xp(r.lo[1])}" y="${y}" width="${Math.max(2, Xp(r.hi[1]) - Xp(r.lo[1]))}" height="${h}" rx="3" fill="#38bdf8" opacity=".75"><title>${esc(r.name)}: ${M.fmt(r.lo[1])} (${esc(r.lo[0])}) to ${M.fmt(r.hi[1])} (${esc(r.hi[0])})</title></rect>`;
    const tw = (t) => t.length * 5.6, x0 = Xp(r.lo[1]), x1 = Xp(r.hi[1]), ty = y + h / 2 + 4;
    const loIn = x0 - 4 - tw(r.lo[0]) < ml, hiIn = x1 + 4 + tw(r.hi[0]) > W - 2;
    if (hiIn && !loIn && x1 - x0 < tw(r.hi[0]) + 8) {
      // Narrow bar at the right edge: both labels to its left.
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

function render(source) {
  if (source === 'overview') state.design = null;
  syncControls();
  if (source !== 'sim-select') designsTable();
  else $('dsTable').querySelectorAll('tr[data-d]').forEach((tr) => tr.classList.toggle('on', tr.dataset.d === state.design));
  nodesChart();
  tornado();
}

export function initSimulate() {
  fillSelect($('rqSite'), Object.keys(X.sites).map((k) => [k, `${X.sites[k].name} (${X.sites[k].type})`]));
  fillSelect($('rqDrone'), Object.entries(X.drones).map(([k, d]) => [k, d.name]));
  fillSelect($('rqHeight'), X.axes.heights.map((h) => [h, `${h} m`]));
  fillSelect($('rqInterf'), X.axes.interference.map((i) => [i, INTERF_LABEL[i]]));
  const set = (fn) => () => { fn(); state.design = null; emit('req'); };
  $('rqSite').onchange = set(() => (state.site = $('rqSite').value));
  $('rqDrone').onchange = set(() => (state.drone = $('rqDrone').value));
  $('rqInterf').onchange = set(() => (state.interf = +$('rqInterf').value));
  $('rqRadius').oninput = set(() => (state.req.radius_m = X.axes.radii[+$('rqRadius').value]));
  $('rqHeight').onchange = set(() => (state.req.height_m = +$('rqHeight').value));
  $('rqCov').onchange = set(() => { state.req.coverage_pct = +$('rqCov').value; state.tier = $('rqCov').value; });
  $('rqTrk').oninput = set(() => (state.req.tracked_pct = +$('rqTrk').value));
  $('rqAcc').oninput = set(() => (state.req.accuracy_m = +$('rqAcc').value));
  $('rqUpd').oninput = set(() => (state.req.update_s = +$('rqUpd').value));
  $('rqReset').onclick = set(() => { state.req = defaultReq(); state.interf = X.default_req.interference_db; state.tier = String(state.req.coverage_pct); });
  $('chMetric').onchange = nodesChart;
  $('tzMetric').onchange = tornado;
  onChange(render);
  render();
}
