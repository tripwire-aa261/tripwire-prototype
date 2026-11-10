// Financials tab: one facility's economics for the selected design and sensor count, with every cost and
// price assumption editable (saved in this browser), and the three facilities side by side.
import { $, esc, usd, pct, X, state, facility, outcome, meets, radiosFor, defaultRadio, rankDesigns, fillSelect, saveFin, resetFin, onChange, emit } from './data.js';
import { benchBars } from './overview.js';

// Editable inputs: [key, label, unit, step]. Grouped as they appear on the page.
const GROUPS = [
  ['Hardware per sensor', 'Parts for one sensor box. Radios: B210 price from the data package [1]; bladeRF from the Nuand listing; the rest ASSUMPTIONS.', [
    ['radio_bladerf', 'bladeRF 2.0 micro xA4 (2 channels)', '$', 10], ['radio_b210', 'USRP B210 (2 channels)', '$', 10],
    ['custom_board', 'Custom 8-channel receiver (Series A, at 1,000 units)', '$', 10], ['gnss', 'GNSS timing', '$', 10],
    ['clock', 'Clock distribution (2+ radio boards)', '$', 10], ['computer', 'Edge computer', '$', 10],
    ['computer_per4', 'Extra computer per 4 more channels', '$', 10], ['full_factor', 'Computer multiplier for enhanced processing', '×', 0.1],
    ['ant_omni', 'Omni antenna', '$', 5], ['ant_patch', 'Patch antenna', '$', 5], ['enclosure', 'Enclosure, power supply, mast hardware', '$', 10],
    ['mic', 'Microphone unit', '$', 10]]],
  ['Installation', 'One-time, per sensor unless noted. Defaults add up to the data package\'s $6,000 per 3 sensors, plus a site set-up.', [
    ['tech_hours', 'Technician hours per sensor', 'h', 1], ['labour_rate', 'Labour rate', '$/h', 5],
    ['mounting', 'Mounting and cabling per sensor', '$', 10], ['site_works', 'Site works per sensor (pole, power, network); 0 = customer provides', '$', 50],
    ['site_setup', 'Site set-up per facility (radio survey, calibration, software)', '$', 100]]],
  ['Maintenance', 'Per sensor per year. Defaults add up to about the data package\'s $5,000 per 3 sensors.', [
    ['visits', 'Service visits per year', '#', 1], ['visit_hours', 'Hours per visit per sensor', 'h', 1],
    ['spares_pct', 'Spares, % of hardware per year', '%', 1], ['connectivity_mo', 'Network connection per month', '$', 5],
    ['software_yr', 'Cloud, software and monitoring per year', '$', 10]]],
  ['Pricing (per facility)', 'Install price from the data package. Yearly price by coverage tier: 80% = data package; 90% and 95% are ASSUMPTIONS anchored on the AirSight range ($9,071-42,143/yr) [4].', [
    ['install_price', 'Installation price', '$', 1000], ['tier80', 'Subscription, 80% coverage tier', '$/yr', 500],
    ['tier90', 'Subscription, 90% coverage tier', '$/yr', 500], ['tier95', 'Subscription, 95% coverage tier', '$/yr', 500],
    ['years', 'Contract length', 'yrs', 1]]],
];

function inputs() {
  $('fnInputs').innerHTML = GROUPS.map(([title, note, fields]) => `<div class="panel-card"><h3>${esc(title)}</h3><p class="note small">${esc(note)}</p>
    ${fields.map(([k, l, u, st]) => `<label class="num"><span>${esc(l)}</span><span class="unit">${esc(u)}</span><input type="number" step="${st}" min="0" data-k="${k}" value="${state.fin[k]}"/></label>`).join('')}</div>`).join('');
  $('fnInputs').querySelectorAll('input').forEach((el) => (el.oninput = () => {
    const v = parseFloat(el.value);
    if (!isFinite(v)) return;
    state.fin[el.dataset.k] = v; saveFin(); emit('fin-input');
  }));
}

function controls() {
  fillSelect($('fnSite'), Object.keys(X.sites).map((k) => [k, `${X.sites[k].name} (${X.sites[k].type})`]), state.site);
  fillSelect($('fnDesign'), Object.entries(X.designs).map(([k, d]) => [k, d.label]), state.design);
  if (!state.radio || !radiosFor(state.design).includes(state.radio)) state.radio = defaultRadio(state.design);
  fillSelect($('fnRadio'), radiosFor(state.design).map((r) => [r, X.radios[r].name]), state.radio);
  $('fnN').value = state.n;
  $('fnTier').value = state.tier;
  const nn = X.axes.nodes.reduce((p, c) => (Math.abs(c - state.n) < Math.abs(p - state.n) ? c : p));
  const o = outcome(state.site, state.drone, state.design, state.req.height_m, state.interf, nn, state.req.radius_m);
  const ok = meets(o, state.req).ok;
  $('fnFrom').innerHTML = `Design and sensor count follow your choice in the Simulation tab; change them here to test other options. ` +
    (ok ? `This design meets the requirements at ${esc(X.sites[state.site].name)}.` : `<span class="bad">This design does not meet the requirements at ${esc(X.sites[state.site].name)}</span> (${pct(o?.cov)} covered, ${pct(o?.trk)} tracked with ${nn} sensors).`);
}

function render(source) {
  if (source !== 'fin-input') controls();
  const f = facility(state.design, state.n, state.radio, state.tier), Y = state.fin.years;
  const k = (t, v, s, cls = '') => `<div class="kpi ${cls}"><small>${t}</small><b>${v}</b><span>${s}</span></div>`;
  $('fnKpis').innerHTML = [
    k('Our upfront cost', usd(f.upfront), `${usd(f.hardware)} hardware + ${usd(f.install)} installation`),
    k('Customer pays upfront', usd(f.price), 'installation price'),
    k('Installation margin', `${Math.round(100 * f.installMargin)}%`, f.installMargin >= 0 ? 'installation price minus our upfront cost' : 'we lose money on installation', f.installMargin >= 0 ? 'ok' : 'bad'),
    k('Subscription', `${usd(f.sub)}/yr`, `${state.tier}% coverage tier`),
    k('Our running cost', `${usd(f.yearly)}/yr`, 'maintenance, spares, connection, software'),
    k('Recurring margin', `${Math.round(100 * f.recurringMargin)}%`, 'subscription minus running cost', f.recurringMargin >= 0 ? 'ok' : 'bad'),
    k(`${Y}-year profit`, usd(f.profit5), `per facility`, f.profit5 >= 0 ? 'ok' : 'bad'),
    k('Payback', f.paybackMonths === 0 ? 'at install' : isFinite(f.paybackMonths) ? `${Math.ceil(f.paybackMonths)} months` : 'never', 'months of subscription to recover upfront cost'),
  ].join('');
  // Five-year revenue vs cost, stacked.
  const rev = [['Installation price', f.price, '#38bdf8'], [`Subscription × ${Y}`, Y * f.sub, '#0ea5e9']];
  const cost = [['Hardware', f.hardware, '#fb923c'], ['Install labour', f.installParts.labour, '#f59e0b'], ['Mounting & cabling', f.installParts.mounting, '#fbbf24'],
    ['Site works', f.installParts.works, '#facc15'], ['Site set-up', f.installParts.setup, '#fde68a'], [`Service visits × ${Y}`, Y * f.yearlyParts.labour, '#f472b6'],
    [`Spares × ${Y}`, Y * f.yearlyParts.spares, '#e879f9'], [`Connection × ${Y}`, Y * f.yearlyParts.connectivity, '#c084fc'], [`Software × ${Y}`, Y * f.yearlyParts.software, '#a78bfa']];
  const max = Math.max(f.revenue5, f.cost5);
  const bar = (title, items, total) => `<div class="stack"><div class="st-head"><span>${title}</span><b>${usd(total)}</b></div><div class="st-bar">${items.filter((x) => x[1] > 0)
    .map(([n, v, c]) => `<i style="width:${(100 * v) / max}%;background:${c}" title="${esc(n)}: ${usd(v)}"></i>`).join('')}</div>
    <div class="st-leg">${items.filter((x) => x[1] > 0).map(([n, v, c]) => `<span><i style="background:${c}"></i>${esc(n)} ${usd(v)}</span>`).join('')}</div></div>`;
  $('fnStack').innerHTML = bar('Revenue', rev, f.revenue5) + bar('Our cost', cost, f.cost5) +
    `<p class="note small">Hardware per sensor: ${Object.entries(f.node.items).map(([n, v]) => `${n} ${usd(v)}`).join(' · ')} = ${usd(f.node.total)}.</p>`;
  benchBars($('fnBench'), f.customer5, Y);
  // Three facilities, each with its cheapest design meeting the requirements.
  const rows = Object.keys(X.sites).map((s) => {
    const r = rankDesigns(s, state.drone)[0];
    if (!r.ok) return `<tr><td><b>${esc(X.sites[s].name)}</b><br><span class="note">${esc(X.sites[s].type)}</span></td><td colspan="6" class="note">No design meets the requirements here (interference removal ${state.interf} dB).</td></tr>`;
    const g = facility(r.design, r.n, r.radio, state.tier);
    return `<tr class="${s === state.site ? 'on' : ''}"><td><b>${esc(X.sites[s].name)}</b><br><span class="note">${esc(X.sites[s].type)}</span></td><td>${esc(X.designs[r.design].short)}</td><td>${r.n}</td>
      <td>${usd(g.upfront)}</td><td>${usd(g.yearly)}/yr</td><td>${Math.round(100 * g.installMargin)}%</td><td>${usd(g.profit5)}</td></tr>`;
  }).join('');
  $('fnSites').innerHTML = `<tr><th>Facility</th><th>Design</th><th>Sensors</th><th>Our upfront cost</th><th>Running cost</th><th>Install margin</th><th>${Y}-yr profit</th></tr>${rows}`;
}

export function initFinance() {
  $('fnSite').onchange = () => { state.site = $('fnSite').value; state.design = null; emit('overview'); };
  $('fnDesign').onchange = () => { state.design = $('fnDesign').value; state.radio = defaultRadio(state.design); emit('fin'); };
  $('fnN').oninput = () => { const v = parseInt($('fnN').value, 10); if (v > 0) { state.n = v; emit('fin'); } };
  $('fnRadio').onchange = () => { state.radio = $('fnRadio').value; emit('fin'); };
  $('fnTier').onchange = () => { state.tier = $('fnTier').value; emit('fin'); };
  $('fnReset').onclick = () => { resetFin(); inputs(); emit('fin-input'); };
  inputs();
  onChange(render);
  render();
}
