// Financials tab: one facility's economics for the selected radio and sensor count, with every cost and
// price assumption editable (saved in this browser), and the three facilities side by side.
import { $, esc, usd, pct, X, COSTS, state, facility, fillSelect, saveFin, resetFin, onChange, emit,
  DESIGN, RADIO, RADIO_KEYS, designFor, fixedBuild, setup, recommendAt, radioOption, nearestN, meets } from './data.js';
import { benchBars } from './overview.js';
import { HELP, info } from './help.js';

// Editable inputs: [key, label, unit, step]. Grouped as they appear on the page.
const GROUPS = [
  ['Hardware per sensor', 'Parts for one sensor box. Radios: B210 price from the data package [1]; bladeRF from the Nuand listing; custom board from the parts list below; the rest ASSUMPTIONS.', [
    ['radio_bladerf', 'bladeRF 2.0 micro xA4 radio (2 antenna channels)', '$', 10, 'Off-the-shelf radio for the Seed stage. One board serves 2 antennas, so a 4-antenna sensor needs 2. Nuand listing, Nov 2026.'],
    ['radio_b210', 'USRP B210 radio (2 antenna channels)', '$', 10, 'More expensive off-the-shelf alternative to the bladeRF. Data package ref [1].'],
    ['custom_board', 'Our own 8-channel radio (Series A, at 1,000 units)', '$', 10, 'One board serves all 8 antennas of a custom-receiver sensor. Costed from the sourced parts list at the bottom of this page.'],
    ['gnss', 'GPS timing module (off-the-shelf builds)', '$', 10, 'Keeps the radio\'s clock steady and time-stamps each update. ASSUMPTION.'],
    ['clock', 'Clock sharing between radio boards', '$', 10, 'Needed when a sensor has 2 or more radio boards, so their antennas stay in step. ASSUMPTION.'],
    ['computer', 'Computer in each sensor', '$', 10, 'Runs the signal processing on site (no raw data leaves the sensor). ASSUMPTION.'],
    ['computer_per4', 'Extra computer per 4 more antennas', '$', 10, 'More antennas mean more data to process. ASSUMPTION.'],
    ['full_factor', 'Computer multiplier for whole-signal processing', '×', 0.1, 'Whole-signal processing decodes the full cell signal and needs a faster computer. ASSUMPTION: about 2×.'],
    ['ant_omni', 'All-round antenna, each', '$', 5, 'Typical retail price (ASSUMPTION until supplier quotes).'],
    ['ant_patch', 'Panel antenna, each', '$', 5, 'Typical retail price (ASSUMPTION until supplier quotes).'],
    ['enclosure', 'Enclosure, power supply, mast hardware', '$', 10, 'Weatherproof box, power and mounting for one sensor. ASSUMPTION.'],
    ['mic', 'Microphone unit', '$', 10, 'Small microphone array that keeps the track while a drone hovers. ASSUMPTION.']]],
  ['Installation', 'One-time, per sensor unless noted. Defaults add up to the data package\'s $6,000 per 3 sensors, plus a site set-up.', [
    ['tech_hours', 'Technician hours per sensor', 'h', 1, 'Two technicians for a day: mount, cable, align, test. ASSUMPTION.'],
    ['labour_rate', 'Labor rate', '$/h', 5, 'Loaded hourly cost of a field technician. ASSUMPTION.'],
    ['mounting', 'Mounting and cabling per sensor', '$', 10, 'Brackets, cable and surge protection. ASSUMPTION.'],
    ['site_works', 'Pole, power and network per sensor', '$', 50, '0 means the customer provides them, as in the data package.'],
    ['site_setup', 'Site set-up per facility', '$', 100, 'Radio survey of the towers, calibration and software set-up, once per facility. ASSUMPTION.']]],
  ['Maintenance', 'Per sensor per year. Defaults add up to about the data package\'s $5,000 per 3 sensors.', [
    ['visits', 'Service visits per year', '#', 1, 'Routine inspection and cleaning. ASSUMPTION.'],
    ['visit_hours', 'Hours per visit per sensor', 'h', 1, 'ASSUMPTION.'],
    ['spares_pct', 'Spare parts, % of hardware per year', '%', 1, 'Replacement parts over the life of the system. ASSUMPTION.'],
    ['connectivity_mo', 'Network connection per month', '$', 5, 'Cellular data plan that sends tracks to the control room. ASSUMPTION.'],
    ['software_yr', 'Cloud, software and monitoring per year', '$', 10, 'Updates and health monitoring. Alerts do not depend on the cloud. ASSUMPTION.']]],
  ['Pricing: our cost plus margin', 'What the customer pays for any option on the menu. Default margins reproduce the data package\'s planning prices ($50,000 installation on $30,000 of cost; $18,000/yr on $5,000/yr).', [
    ['margin_upfront', 'Margin on installation', '%', 1, 'Share of the installation price left after our upfront cost. ASSUMPTION: 40%.'],
    ['margin_yearly', 'Margin on the subscription', '%', 1, 'Share of the yearly subscription left after our running cost. ASSUMPTION: 72%.'],
    ['years', 'Contract length', 'yrs', 1, 'Years of subscription in the customer\'s total; the memo uses five.']]],
];
for (const [, , fields] of GROUPS) for (const [k, l, , , t] of fields) HELP[`fin_${k}`] = [l, t, 'Every cost and price on this page, and the price of every option on the Simulation menu.', 'Editable; saved in this browser'];

function inputs() {
  $('fnInputs').innerHTML = GROUPS.map(([title, note, fields]) => `<div class="panel-card"><h3>${esc(title)}</h3><p class="note small">${esc(note)}</p>
    ${fields.map(([k, l, u, st]) => `<label class="num"><span>${esc(l)} ${info(`fin_${k}`)}</span><span class="unit">${esc(u)}</span><input type="number" step="${st}" min="0" data-k="${k}" value="${state.fin[k]}"/></label>`).join('')}</div>`).join('');
  $('fnInputs').querySelectorAll('input').forEach((el) => (el.oninput = () => {
    const v = parseFloat(el.value);
    if (!isFinite(v)) return;
    state.fin[el.dataset.k] = v; saveFin(); emit('fin-input');
  }));
}

// The custom receiver's bill of materials (twin/cost.py CUSTOM_BOM), with a source for every line.
function bom() {
  const B = COSTS.custom_breakdown, q = (k) => B[k];
  const $2 = (v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const b = q('1000'), cited = b.lines.filter((l) => l.source.startsWith('CITED'));
  const src = (l) => (l.url ? `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.source)}</a>` : esc(l.source));
  const row = (label, v, s) => `<tr><td colspan="5">${label}</td><td>${v}</td><td class="split small">${s}</td></tr>`;
  $('fnBom').innerHTML = `<p class="note small">One receive-only board: four 2-channel LMS7002M transceivers on one GNSS-disciplined clock, an FPGA that streams
    the 8 channels over PCIe to the edge computer, and a switched noise source to calibrate the phase between channels (ASSUMPTION: architecture).
    Each price is a distributor price at the quantity shown; moving it to 1,000 boards uses the volume curve (x0.93 per doubling, ASSUMPTION).
    ${cited.length} of ${b.lines.length} part lines are cited, covering ${usd(cited.reduce((s, l) => s + l.line_usd, 0))} of the ${usd(b.parts_usd)} of parts.</p>
    <div class="scrollx"><table class="cmp bom"><tr><th>Item</th><th>Part</th><th>Count</th><th>Quoted price (qty)</th><th>Unit at 1,000</th><th>Line</th><th class="split">Source</th></tr>
    ${b.lines.map((l) => `<tr><td>${esc(l.item)}</td><td>${esc(l.part)}</td><td>${l.count}</td><td>${$2(l.usd)} (${l.basis_qty.toLocaleString('en-US')})</td>
      <td>${$2(l.unit_at_qty)}</td><td>${$2(l.line_usd)}</td><td class="split small">${src(l)}</td></tr>`).join('')}
    ${row('<b>Parts</b>', `<b>${$2(b.parts_usd)}</b>`, '')}
    ${row('SMT assembly and X-ray', $2(b.assembly_usd), `<a href="${esc(COSTS.custom_assembly.url)}" target="_blank" rel="noopener">${esc(COSTS.custom_assembly.source)}</a>`)}
    ${row('Test and phase calibration', $2(b.test_usd), 'ASSUMPTION')}
    ${row(`Design cost (NRE) ${usd(COSTS.custom.nre_usd)} spread over 1,000 boards`, $2(b.nre_per_board_usd), 'ASSUMPTION')}
    ${row('<b>Per board at 1,000</b>', `<b>${$2(b.total_usd)}</b>`, `At 100 boards: ${usd(q('100').total_usd)} · at 10,000: ${usd(q('10000').total_usd)}`)}</table></div>`;
}

function controls() {
  fillSelect($('fnSite'), Object.keys(X.sites).map((k) => [k, `${X.sites[k].name} (${X.sites[k].type})`]), state.site);
  fillSelect($('fnRadio'), RADIO_KEYS.map((r) => [r, `${RADIO[r].long} (${RADIO[r].kind}, ${RADIO[r].stage})`]), state.radio);
  $('fnN').value = state.n;
  const x = setup(state.site, state.drone, state.interf, state.radio, nearestN(state.n), state.req, designFor(state.radio));
  const o = x?.o, std = designFor(state.radio) === fixedBuild(state.radio);
  $('fnFrom').innerHTML = `Each sensor: ${esc(std ? RADIO[state.radio].build : `${DESIGN[designFor(state.radio)].spec} (the antenna setup picked in the Simulation tab)`)}. ` +
    `The setup follows your pick in the Simulation tab; change it here to test others. ` +
    `${esc(radioOption(state.radio, nearestN(state.n)))} at ${esc(X.sites[state.site].name)} (${state.interf} dB interference removal): ${pct(o?.cov)} of the area covered, ${pct(o?.trk)} time tracked` +
    (meets(o) ? '.' : ` <span class="bad">(below the targets of ${state.targets.area}% and ${state.targets.tracked}%)</span>.`);
}

function render(source) {
  if (source !== 'fin-input') controls();
  const f = facility(designFor(state.radio), state.n, state.radio), Y = state.fin.years;
  const k = (t, v, s, cls = '') => `<div class="kpi ${cls}"><small>${t}</small><b>${v}</b><span>${s}</span></div>`;
  $('fnKpis').innerHTML = [
    k('Our upfront cost', usd(f.upfront), `${usd(f.hardware)} hardware + ${usd(f.install)} installation`),
    k('Customer pays upfront', usd(f.price), `our upfront cost + ${state.fin.margin_upfront}% margin`),
    k('Installation margin', `${Math.round(100 * f.installMargin)}%`, f.installMargin >= 0 ? 'installation price minus our upfront cost' : 'we lose money on installation', f.installMargin >= 0 ? 'ok' : 'bad'),
    k('Subscription', `${usd(f.sub)}/yr`, `our running cost + ${state.fin.margin_yearly}% margin`),
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
  // Three facilities, each with its recommended option.
  const rows = Object.keys(X.sites).map((s) => {
    const r = recommendAt(s, state.drone, state.interf).rec;
    if (!r) return `<tr><td><b>${esc(X.sites[s].name)}</b><br><span class="note">${esc(X.sites[s].type)}</span></td><td colspan="6" class="note">No setup meets the targets here with ${state.interf} dB of interference removal.</td></tr>`;
    const g = r.fin;
    return `<tr class="${s === state.site ? 'on' : ''}"><td><b>${esc(X.sites[s].name)}</b><br><span class="note">${esc(X.sites[s].type)}</span></td><td>${esc(radioOption(r.radio, r.n))}</td>
      <td>${usd(g.price)}</td><td>${usd(g.sub)}/yr</td><td>${usd(g.upfront)}</td><td>${usd(g.yearly)}/yr</td><td>${usd(g.profit5)}</td></tr>`;
  }).join('');
  $('fnSitesNote').textContent = `Each facility with its recommended setup: the cheapest radio and number of sensors that covers ${state.targets.area}% of the area and tracks a drone ${state.targets.tracked}% of the time (targets from the Overview), for the drone, protected distance and interference setting chosen in the Simulation tab.`;
  $('fnSites').innerHTML = `<tr><th>Facility</th><th>Recommended setup</th><th>Customer pays upfront ${info('price')}</th><th>Subscription</th><th>Our upfront cost ${info('upfront')}</th><th>Our running cost ${info('running')}</th><th>${Y}-yr profit</th></tr>${rows}`;
}

export function initFinance() {
  $('fnSite').onchange = () => { state.site = $('fnSite').value; emit('overview'); };
  $('fnN').oninput = () => { const v = parseInt($('fnN').value, 10); if (v > 0) { state.n = v; emit('fin'); } };
  $('fnRadio').onchange = () => { state.radio = $('fnRadio').value; emit('fin'); };
  $('fnReset').onclick = () => { resetFin(); inputs(); emit('fin-input'); };
  inputs();
  bom();
  onChange(render);
  render();
}
