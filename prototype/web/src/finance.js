// Financials tab: what the customer wants (the same five requirements as the Overview) sets the setup: the chosen
// radio (default: the recommended one) with the fewest sensors that meet the requirements. The number of sensors is
// not an input here. Every cost and price assumption is editable (saved in this browser); the three facilities
// are shown side by side.
import { $, esc, usd, pct, X, COSTS, state, facility, fillSelect, saveFin, resetFin, onChange, emit,
  RADIO, RADIO_KEYS, fixedBuild, radioOption, recommendOverall, defaultReq, targetsText } from './data.js';
import { mountRequirements } from './requirements.js';
import { benchBars } from './overview.js';
import { HELP, info } from './help.js';

// Editable inputs: [key, label, unit, step]. Grouped as they appear on the page.
const GROUPS = [
  ['Hardware per sensor', 'Parts for one sensor box, re-priced Nov 12 from current listings (CITED) or typical prices (ASSUMPTION until supplier quotes). Each sensor processes its own antennas on an edge GPU board and sends compact results to one hub per facility.', [
    ['radio_bladerf', 'bladeRF 2.0 micro xA4 radio (2 antenna channels)', '$', 10, 'Off-the-shelf radio for the Seed stage. One board serves 2 antennas, so a 4-antenna sensor needs 2. CITED: Nuand listing, Nov 2026.'],
    ['radio_b210', 'USRP B210 radio (2 antenna channels)', '$', 10, 'More expensive off-the-shelf alternative to the bladeRF. CITED: data package ref [1].'],
    ['custom_board', 'Our own 8-channel radio (Series A, per board)', '$', 10, 'Parts, assembly and test at a planning volume of 1,000 boards, from the sourced parts list at the bottom of this page. The design cost (NRE) is not in this price: it is a one-time company cost, shown below.'],
    ['computer', 'Edge computer in each sensor', '$', 10, 'NVIDIA Jetson Orin Nano Super, $249 list (CITED: NVIDIA). Does the signal processing on the pole, because raw samples (~2 Gbit/s) cannot be sent off it. Enough for whole-signal processing of 4 to 8 antennas: ASSUMPTION, to benchmark at Seed.'],
    ['gnss', 'GPS module for time stamps', '$', 1, 'u-blox NEO-F10N, $16.22 (CITED: DigiKey). Each pair measures delay against its own direct tower signal, so no expensive disciplined clock is needed (ASSUMPTION).'],
    ['clock', 'Shared clock for 2 radio boards', '$', 5, 'One 38.4 MHz reference fanned out to both bladeRF boards so their 4 antennas stay in step: oscillator + buffer (~$5, parts-list prices) + adapter and cables (ASSUMPTION). Two-board phase lock on the bladeRF micro is not documented: a Seed risk.'],
    ['ant_omni', 'All-round antenna, each', '$', 5, 'Outdoor 698-2700 MHz omni. Typical price (ASSUMPTION until supplier quotes).'],
    ['ant_patch', 'Panel antenna, each', '$', 5, 'Typical price (ASSUMPTION until supplier quotes).'],
    ['enclosure', 'Enclosure, power supply, bracket', '$', 5, 'NEMA 4X box ~$70, 60 W power supply ~$35, pole bracket ~$40, Ethernet surge protector ~$20, internal cables ~$25 (typical listings, ASSUMPTION).'],
    ['surge', 'Lightning arrestor per antenna', '$', 1, 'Generic N-type coaxial arrestor on each antenna cable (ASSUMPTION).'],
    ['mic', 'Microphone unit (microphone builds only)', '$', 1, '4 Infineon IM69D130 MEMS microphones at $2.87 (CITED: DigiKey) + small board and vents (ASSUMPTION). The standard builds hold the hover in software instead.']]],
  ['Installation', 'One-time. Per sensor unless noted. Assumes the customer provides poles, power and network at each sensor, as in the data package.', [
    ['tech_hours', 'Technician hours per sensor', 'h', 1, 'Two technicians for about 3 hours: mount a factory-configured sensor, connect, test. ASSUMPTION.'],
    ['labour_rate', 'Labor rate', '$/h', 5, 'BLS median for security and fire alarm system installers, $28.88/h (May 2025), about doubled for benefits, overhead and travel. ASSUMPTION.'],
    ['mounting', 'Mounting and cabling per sensor', '$', 10, 'Outdoor Ethernet run, conduit fittings, connectors. ASSUMPTION.'],
    ['site_works', 'Pole, power and network per sensor', '$', 50, '0 means the customer provides them, as in the data package.'],
    ['site_setup', 'Site set-up per facility', '$', 100, 'Radio survey of the towers, calibration and software set-up, once per facility. ASSUMPTION.'],
    ['hub', 'On-site hub per facility', '$', 10, 'Mini PC (~$349, CITED: TerminalBytes price check Oct 2026) + small UPS (ASSUMPTION). Tracks, classifies, keeps the background history and sends alerts; works without the internet.']]],
  ['Running costs per year', 'Health is monitored remotely, so visits are short.', [
    ['visits', 'Service visits per year', '#', 1, 'One inspection and cleaning visit. ASSUMPTION.'],
    ['visit_hours', 'Hours per visit per sensor', 'h', 1, 'ASSUMPTION.'],
    ['spares_pct', 'Spare parts, % of hardware per year', '%', 1, 'Solid-state electronics; a few percent fail per year. ASSUMPTION.'],
    ['connectivity_mo', 'Network per sensor per month', '$', 5, 'Sensors reach the hub over the facility network, so 0 by default.'],
    ['backhaul_mo', 'Internet line per facility per month', '$', 5, 'One business line from the hub for alerts and updates. ASSUMPTION.'],
    ['software_yr', 'Software updates per sensor per year', '$', 10, 'ASSUMPTION.'],
    ['cloud_yr', 'Cloud per facility per year', '$', 50, 'Hosting, alert delivery, dashboards. ASSUMPTION.']]],
  ['Pricing', 'What the customer pays. Cost + margin (both margins 40%, team decision Nov 12) is the floor; the value-based model sets our own price per facility.', [
    ['margin_upfront', 'Margin on installation', '%', 1, 'Share of the installation price left after our upfront cost.'],
    ['margin_yearly', 'Margin on the subscription', '%', 1, 'Share of the yearly fee left after our running cost (and, in the all-in model, the hardware repayment).'],
    ['set_install', 'Our own installation price (value-based model)', '$', 1000, 'Price per facility when we set it from the value to the customer, not from our cost. Default: the data package\'s planning price, $50,000.'],
    ['set_sub', 'Our own yearly subscription (value-based model)', '$', 500, 'Default: the data package\'s planning price, $18,000/yr (inside AirSight\'s $9,071-42,143/yr range, ref [4]).'],
    ['capital_pct', 'Cost of capital (all-in model)', '%/yr', 1, 'What it costs us to carry the hardware when the customer pays nothing upfront. ASSUMPTION: 10%.'],
    ['years', 'Contract length', 'yrs', 1, 'Years of subscription in the customer\'s total; the memo uses five.']]],
  ['Today\'s options: radar-based system (for the comparison)', 'Sets the radar-based system in "Customer\'s five-year cost vs today\'s options" here and on the Overview, so both sides are a whole facility over the same contract.', [
    ['cmp_radar_n_lo', 'Radars per prison, low case', '#', 1, 'A compact drone radar sees about 120° side to side (CITED: Echodyne EchoGuard), so 3 cover 360° from one point. Buildings and the far side of the fence still leave blind spots. ASSUMPTION.'],
    ['cmp_radar_n_hi', 'Radars per prison, high case', '#', 1, 'Extra radars to fill blind spots behind buildings and cover the whole fence line. ASSUMPTION.'],
    ['cmp_radar_lo', 'Price per radar, low', '$', 1000, 'Single compact FMCW drone radar, hardware only: $30,000-80,000 (CITED: AirSight radar guide, 2026).'],
    ['cmp_radar_hi', 'Price per radar, high', '$', 1000, 'Upper end of the same range (CITED: AirSight radar guide, 2026). A 360° Robin IRIS lists at $396,000 (Dedrone price list on OMNIA Partners, Feb 2025).'],
    ['cmp_install_lo', 'Installation, integration and training, low', '%', 5, 'Site survey, installation, calibration, integration and training on top of hardware: 30-60% (CITED: AirSight cost guide, 2026).'],
    ['cmp_install_hi', 'Installation, integration and training, high', '%', 5, 'Upper end of the same range (CITED: AirSight cost guide, 2026).']]],
  ['Company', 'Costs that are not per facility. They decide how many facilities the business needs, not the price of one.', [
    ['nre', 'Custom receiver design cost (one-time, Series A)', '$', 10000, 'Engineering, prototype rounds, test equipment and certification for our own receiver. ASSUMPTION. Not in the board price.'],
    ['overhead_yr', 'Company running cost per year', '$', 50000, 'Team, office, sales, insurance. ASSUMPTION.']]],
];
for (const [, , fields] of GROUPS) for (const [k, l, , , t] of fields) HELP[`fin_${k}`] = [l, t, 'Every cost and price on this page, and the price of every option in the Trade space simulator.', 'Editable; saved in this browser'];

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
    ${row('<b>Per board (1,000-board planning volume)</b>', `<b>${$2(b.total_usd)}</b>`, `At 100 boards: ${usd(q('100').total_usd)} · at 10,000: ${usd(q('10000').total_usd)} (parts volume only)`)}
    ${row(`Design cost (NRE): one-time company cost, not in the board price`, usd(COSTS.custom.nre_usd), 'ASSUMPTION; see Company above')}</table></div>`;
}

// Company view: costs that are not per facility (custom receiver NRE, running the company) and how many
// facilities pay for them. The NRE is never folded into a board or facility price.
function company(f) {
  const F = state.fin, Y = F.years, gpYear = f.profit5 / Y;
  const be = gpYear > 0 ? Math.ceil(F.overhead_yr / gpYear) : Infinity, nreN = f.profit5 > 0 ? Math.ceil(F.nre / f.profit5) : Infinity;
  $('fnCompany').innerHTML = `<div class="kpis wide">
    <div class="kpi"><small>Gross profit per facility per year ${info('fin_overhead_yr')}</small><b>${usd(gpYear)}</b><span>averaged over the ${Y}-year contract</span></div>
    <div class="kpi ${isFinite(be) ? '' : 'bad'}"><small>Facilities to cover the company's running cost</small><b>${isFinite(be) ? be : 'never'}</b><span>${usd(F.overhead_yr)}/yr ÷ gross profit per facility</span></div>
    <div class="kpi"><small>Custom receiver design cost ${info('fin_nre')}</small><b>${usd(F.nre)}</b><span>one-time, Series A; not in any price</span></div>
    <div class="kpi"><small>Facilities to repay it</small><b>${isFinite(nreN) ? nreN : 'never'}</b><span>contracts' gross profit ÷ design cost</span></div></div>
    <p class="note small">For the setup above. The design cost is paid once from Series A funds and recovered from gross profit across facilities, so building 100 or 1,000 boards does not change any price. Gross profit = what customers pay minus our upfront and running costs over the contract.</p>`;
}

let finRadio = ''; // '' = follow the recommended radio

// The setup Financials prices: the radio (chosen, or the recommended one) with the fewest sensors that meet the
// customer's requirements, at the lowest interference removal at which that radio can meet them. Same protected
// distance and drone height as the Overview.
function finSetup() {
  const R = recommendOverall(state.site, state.drone, state.targets, defaultReq());
  const radio = finRadio || R.first?.rec.radio || 'bladerf';
  const lv = R.levels.find((l) => l.per[radio].ok);
  const x = lv ? lv.per[radio].ok : R.levels.at(-1).per[radio].best;
  return { R, radio, lv: lv ?? R.levels.at(-1), x, meets: !!lv };
}

function controls(S) {
  fillSelect($('fnSite'), Object.keys(X.sites).map((k) => [k, `${X.sites[k].name} (${X.sites[k].type})`]), state.site);
  const recR = S.R.first?.rec.radio;
  fillSelect($('fnRadio'), [['', `Recommended${recR ? `: ${RADIO[recR].name}` : ''}`], ...RADIO_KEYS.map((r) => [r, `${RADIO[r].long} (${RADIO[r].kind}, ${RADIO[r].stage})`])], finRadio);
  fillSelect($('fnModel'), [['install_sub', 'Cost + margin: installation + subscription'], ['all_in', 'Cost + margin: all-in yearly fee (nothing upfront)'],
    ['set', 'Value-based: our own price per facility']], state.fin.model);
  const x = S.x, o = x?.o, today = S.lv.interf === X.axes.interference[0];
  $('fnN').textContent = x ? `${x.n} sensors` : '—';
  const lvl = today ? `with today's ${S.lv.interf} dB of interference removal` : `only with ${S.lv.interf} dB of interference removal (unproven)`;
  $('fnFrom').innerHTML = `Each sensor: ${esc(RADIO[S.radio].build)}. ` + (S.meets
    ? `<b>${esc(radioOption(S.radio, x.n))}</b> is the fewest ${esc(RADIO[S.radio].name)} sensors that meet ${esc(targetsText())} at ${esc(X.sites[state.site].name)}, ${esc(lvl)}: ${pct(o.cov)} area covered, ${pct(o.trk)} time tracked, ~${Math.round(o.acc)} m.`
    : `<span class="bad">No number of ${esc(RADIO[S.radio].name)} sensors meets ${esc(targetsText())} at ${esc(X.sites[state.site].name)}, even with 40 dB of interference removal.</span> Priced: the best tried, ${esc(radioOption(S.radio, x?.n))} (${pct(o?.cov)} area, ${pct(o?.trk)} tracked).`);
}

function render(source) {
  const S = finSetup();
  if (source !== 'fin-input') controls(S);
  if (!S.x) return;
  const f = facility(fixedBuild(S.radio), S.x.n, S.radio), Y = state.fin.years;
  const k = (t, v, s, cls = '') => `<div class="kpi ${cls}"><small>${t}</small><b>${v}</b><span>${s}</span></div>`;
  const allIn = state.fin.model === 'all_in', setP = state.fin.model === 'set';
  $('fnKpis').innerHTML = [
    k('Our upfront cost', usd(f.upfront), `${usd(f.hardware)} hardware + ${usd(f.install)} installation`),
    allIn ? k('Customer pays upfront', '$0', 'all-in model: the yearly fee repays the hardware')
      : k('Customer pays upfront', usd(f.price), setP ? 'our own price (value-based)' : `our upfront cost + ${state.fin.margin_upfront}% margin`),
    k(allIn ? 'All-in yearly fee' : 'Subscription', `${usd(f.sub)}/yr`, allIn ? `hardware repayment + running cost + ${state.fin.margin_yearly}% margin`
      : setP ? 'our own price (value-based)' : `our running cost + ${state.fin.margin_yearly}% margin`),
    k('Our running cost', `${usd(f.yearly)}/yr`, 'upkeep, spares, internet, software'),
    k(`${Y}-year gross margin`, `${Math.round(100 * f.grossMargin)}%`, `${usd(f.profit5)} gross profit per facility`, f.grossMargin >= 0 ? 'ok' : 'bad'),
    k('Payback', f.paybackMonths === 0 ? 'at install' : isFinite(f.paybackMonths) ? `${Math.ceil(f.paybackMonths)} months` : 'never', 'months until this facility has repaid its upfront cost'),
    k('Customer\'s total', usd(f.customer5), `over ${Y} years`),
    k('Hardware per sensor', usd(f.node.total), Object.entries(f.node.items).map(([n2, v]) => `${n2} ${usd(v)}`).join(' · ')),
  ].join('');
  company(f);
  // Five-year revenue vs cost, stacked.
  const rev = [['Installation price', f.price, '#38bdf8'], [`Subscription × ${Y}`, Y * f.sub, '#0ea5e9']];
  const cost = [['Hardware', f.hardware, '#fb923c'], ['Install labour', f.installParts.labour, '#f59e0b'], ['Mounting & cabling', f.installParts.mounting, '#fbbf24'],
    ['Site works', f.installParts.works, '#facc15'], ['Site set-up', f.installParts.setup, '#fde68a'], ['Hub', f.installParts.hub, '#fef3c7'], [`Service visits × ${Y}`, Y * f.yearlyParts.labour, '#f472b6'],
    [`Spares × ${Y}`, Y * f.yearlyParts.spares, '#e879f9'], [`Internet × ${Y}`, Y * f.yearlyParts.connectivity, '#c084fc'], [`Software and cloud × ${Y}`, Y * f.yearlyParts.software, '#a78bfa']];
  const max = Math.max(f.revenue5, f.cost5);
  const bar = (title, items, total) => `<div class="stack"><div class="st-head"><span>${title}</span><b>${usd(total)}</b></div><div class="st-bar">${items.filter((x) => x[1] > 0)
    .map(([n, v, c]) => `<i style="width:${(100 * v) / max}%;background:${c}" title="${esc(n)}: ${usd(v)}"></i>`).join('')}</div>
    <div class="st-leg">${items.filter((x) => x[1] > 0).map(([n, v, c]) => `<span><i style="background:${c}"></i>${esc(n)} ${usd(v)}</span>`).join('')}</div></div>`;
  $('fnStack').innerHTML = bar('Revenue', rev, f.revenue5) + bar('Our cost', cost, f.cost5) +
    '';
  benchBars($('fnBench'), f.customer5, Y);
  // Three facilities, each with its recommended setup for the requirements above (as on the Overview).
  const rows = Object.keys(X.sites).map((s) => {
    const R = recommendOverall(s, state.drone, state.targets, defaultReq()), r = R.first?.rec;
    const head = `<td><b>${esc(X.sites[s].name)}</b><br><span class="note">${esc(X.sites[s].type)}</span></td>`;
    if (!r) return `<tr>${head}<td colspan="7" class="note">No setup meets the requirements here, even with 40 dB of interference removal.</td></tr>`;
    const g = r.fin, today = R.first.interf === X.axes.interference[0];
    return `<tr class="${s === state.site ? 'on' : ''}">${head}<td>${esc(radioOption(r.radio, r.n))}</td><td>${R.first.interf} dB${today ? '' : ' <span class="note">(unproven)</span>'}</td>
      <td>${usd(g.price)}</td><td>${usd(g.sub)}/yr</td><td>${usd(g.upfront)}</td><td>${usd(g.yearly)}/yr</td><td>${usd(g.profit5)}</td></tr>`;
  }).join('');
  $('fnSitesNote').textContent = `Each facility with its recommended setup: the cheapest radio and number of sensors that meets ${targetsText()} (the requirements above), at the lowest interference removal that makes it possible.`;
  $('fnSites').innerHTML = `<tr><th>Facility</th><th>Recommended setup</th><th>Interference removal needed ${info('interference')}</th><th>Customer pays upfront ${info('price')}</th><th>Subscription</th><th>Our upfront cost ${info('upfront')}</th><th>Our running cost ${info('running')}</th><th>${Y}-yr profit</th></tr>${rows}`;
}

export function initFinance() {
  $('fnSite').onchange = () => { state.site = $('fnSite').value; emit('overview'); };
  $('fnRadio').onchange = () => { finRadio = $('fnRadio').value; emit('fin'); };
  $('fnModel').onchange = () => { state.fin.model = $('fnModel').value; saveFin(); emit('fin-input'); };
  $('fnReset').onclick = () => { resetFin(); inputs(); emit('fin-input'); };
  mountRequirements('fnReq', 'the same five as on the Overview; they set the number of sensors priced below');
  inputs();
  bom();
  onChange(render);
  render();
}
