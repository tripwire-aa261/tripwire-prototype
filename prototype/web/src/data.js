// Shared state and lookups over web/data/explore.json (written by `python -m twin.explore`), plus the
// editable cost model. Every tab reads and writes the same `state`; `onChange` re-renders listeners.

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const usd = (x) => (x == null || !isFinite(x) ? '—' : (x < 0 ? '−' : '') + (Math.abs(x) >= 1e6 ? `$${(Math.abs(x) / 1e6).toFixed(2)}M` : `$${Math.round(Math.abs(x)).toLocaleString('en-US')}`));
export const pct = (x) => (x == null || !isFinite(x) ? '—' : `${Math.round(x)}%`);
export const meters = (x) => (x == null || !isFinite(x) ? '—' : `${Math.round(x)} m`);

export let X = null; // explore.json
export let COSTS = null; // runs/cost_model.json
export const state = {
  site: 'hays', drone: 'm210', interf: 20,
  req: null, // { radius_m, height_m }: what the customer wants protected
  radio: 'bladerf', n: null, // selected setup (Simulation picker / Financials): which radio, how many sensors
  build: 'ring4_enh_mic', // antenna setup of an off-the-shelf sensor (the Simulation tab can explore others)
  targets: null, // { area, tracked }: the Overview sliders (what the customer wants)
  fin: null, // editable financial inputs
};
const listeners = [];
export const onChange = (fn) => listeners.push(fn);
export function emit(source) { for (const fn of listeners) fn(source); }

const LS_KEY = 'tripwire-fin-v04.2'; // bumped when defaults change (Nov 11: parts list; price = cost + margin)
export function finDefaults() {
  const f = X.finance, n = COSTS.node, a = COSTS.antennas;
  return {
    radio_b210: COSTS.radios.b210.usd, radio_bladerf: COSTS.radios.bladerf.usd,
    custom_board: Math.round(X.designs.ring8_enh_mic.node_cost.custom.items.receiver),
    gnss: n.gnss_usd, clock: n.clock_dist_usd, computer: n.compute_usd, computer_per4: n.compute_per_extra_4ch_usd,
    full_factor: n.compute_full_signal_factor, enclosure: n.enclosure_usd, mic: n.mic_usd,
    ant_omni: a.omni.price_usd, ant_patch: a.patch.price_usd, ant_lpda: a.lpda.price_usd, ant_yagi: a.yagi.price_usd,
    tech_hours: f.install.tech_hours_per_sensor, labour_rate: f.install.labour_rate_usd_per_h, mounting: f.install.mounting_cabling_usd,
    site_works: f.install.site_works_usd, site_setup: f.install.site_setup_usd,
    visits: f.maintenance.visits_per_year, visit_hours: f.maintenance.hours_per_visit_per_sensor, spares_pct: f.maintenance.spares_pct_of_hardware,
    connectivity_mo: f.maintenance.connectivity_usd_per_month, software_yr: f.maintenance.software_usd_per_year,
    margin_upfront: COSTS.finance.pricing.margin_upfront_pct ?? 40, margin_yearly: COSTS.finance.pricing.margin_yearly_pct ?? 72,
    years: f.pricing.years,
  };
}
export function loadFin() {
  const d = finDefaults();
  try { const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (s) return { ...d, ...s }; } catch { /* storage unavailable */ }
  return d;
}
export function saveFin() { try { localStorage.setItem(LS_KEY, JSON.stringify(state.fin)); } catch { /* ignore */ } }
export function resetFin() { state.fin = finDefaults(); try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } }

export async function loadData() {
  [X, COSTS] = await Promise.all([
    fetch('data/explore.json', { cache: 'no-store' }).then((r) => r.json()),
    fetch('runs/cost_model.json', { cache: 'no-store' }).then((r) => r.json()),
  ]);
  state.req = defaultReq();
  state.targets = defaultTargets();
  state.interf = X.default_req.interference_db;
  state.fin = loadFin();
  indexResults();
}
export const defaultTargets = () => ({ area: X.default_req.coverage_pct, tracked: X.default_req.tracked_pct });
export function defaultReq() {
  const d = X.default_req;
  return { radius_m: d.radius_m, height_m: d.height_m };
}

// Plain-language sensor types (what is inside one sensor box). The twin's design keys stay the same.
export const DESIGN = {
  basic: { name: 'Entry', spec: '1 panel antenna · beacon-only processing · off-the-shelf radio', stage: 'Seed' },
  ring4: { name: 'Basic', spec: '4 all-round antennas · beacon-only processing · off-the-shelf radio', stage: 'Seed' },
  fan2_enh: { name: 'Panel pair', spec: '2 panel antennas facing opposite ways · whole-signal processing · off-the-shelf radio', stage: 'Seed' },
  ring4_enh: { name: 'Standard, no microphone', spec: '4 all-round antennas · whole-signal processing · off-the-shelf radio', stage: 'Seed' },
  ring4_enh_mic: { name: 'Standard', spec: '4 all-round antennas · whole-signal processing · microphone · off-the-shelf radio', stage: 'Seed' },  // fixed build: bladeRF, B210
  ring8_enh_mic: { name: 'Custom', spec: '8 all-round antennas · whole-signal processing · microphone · our own radio', stage: 'Series A' },
};
// Radios: each comes with one fixed sensor build (explore.py BUILDS). bladeRF and B210 are the same radio in
// the model (12-bit, 2 channels per board); the B210 only costs more.
export const RADIO_KEYS = ['bladerf', 'b210', 'custom'];
export const RADIO = {
  bladerf: { name: 'bladeRF', long: 'bladeRF 2.0 micro', kind: 'off-the-shelf', stage: 'Seed',
    build: '2 bladeRF boards, 4 all-round antennas, microphone' },
  b210: { name: 'B210', long: 'USRP B210', kind: 'off-the-shelf', stage: 'Seed',
    build: '2 B210 boards, 4 all-round antennas, microphone' },
  custom: { name: 'Custom receiver', long: 'our own 8-channel receiver', kind: 'custom', stage: 'Series A',
    build: '1 custom board, 8 all-round antennas, microphone' },
};
export const fixedBuild = (radio) => (X.builds ?? { bladerf: 'ring4_enh_mic', b210: 'ring4_enh_mic', custom: 'ring8_enh_mic' })[radio];
// The design the selected radio uses: the custom receiver has one build; off-the-shelf radios use state.build.
export const designFor = (radio, build = state.build) => (radio === 'custom' ? fixedBuild('custom') : build || fixedBuild(radio));
export const OTS_BUILDS = () => Object.keys(X.designs).filter((k) => X.designs[k].radio !== 'custom');
export const radioOption = (radio, n) => `${n} × ${RADIO[radio].name} sensors`;
export const nearestN = (n) => X.axes.nodes.reduce((p, c) => (Math.abs(c - n) < Math.abs(p - n) ? c : p));

export const designName = (k) => `${DESIGN[k]?.name ?? k} sensor`;
export const designSpec = (k) => `${DESIGN[k]?.spec ?? ''}${DESIGN[k]?.stage === 'Series A' ? ' (from Series A)' : ''}`;
export const option = (k, n) => `${n} × ${designName(k)}`;

let IDX = new Map();
function indexResults() { IDX = new Map(X.results.map((r) => [r.k.join('|'), r])); }
export function lookup(site, drone, design, height, interf, n) { return IDX.get([site, drone, design, height, interf, n].join('|')); }

// Outcome of one design point at the current zone radius.
export function outcome(site, drone, design, height, interf, n, radius) {
  const r = lookup(site, drone, design, height, interf, n);
  if (!r) return null;
  const i = X.axes.radii.indexOf(radius);
  return { cov: r.cov[i], acc: r.acc[i], trk: r.trk[i], warn: r.warn, caught: r.caught ?? null, n };
}


// ---------------------------------------------------------------- cost model (mirrors twin/cost.py)
export function radiosFor(design) { return X.designs[design].radio === 'custom' ? ['custom'] : ['bladerf', 'b210']; }
export function nodeCost(design, radio, F = state.fin) {
  const d = X.designs[design], p = d.params, m = Math.max(1, p.rx_elements || 1), items = {};
  if (radio === 'custom') items.radios = F.custom_board;
  else {
    const boards = Math.ceil(m / 2);
    items.radios = boards * (radio === 'b210' ? F.radio_b210 : F.radio_bladerf);
    items.timing = F.gnss;
    if (boards > 1) items.timing += F.clock;
  }
  items.computer = (F.computer + F.computer_per4 * Math.floor((m - 1) / 4)) * (p.processing === 'full' ? F.full_factor : 1);
  items.antennas = m * (F[`ant_${p.antenna}`] ?? 100);
  items.enclosure = F.enclosure;
  if (p.mic_range_m > 0) items.microphone = F.mic;
  return { items, total: Object.values(items).reduce((a, b) => a + b, 0) };
}
export function facility(design, n, radio, F = state.fin) {
  const nc = nodeCost(design, radio, F);
  const labour = n * F.tech_hours * F.labour_rate, mounting = n * F.mounting, works = n * F.site_works;
  const install = labour + mounting + works + F.site_setup;
  const yr = {
    labour: n * F.visits * F.visit_hours * F.labour_rate, spares: n * (F.spares_pct / 100) * nc.total,
    connectivity: n * 12 * F.connectivity_mo, software: n * F.software_yr,
  };
  const yearly = Object.values(yr).reduce((a, b) => a + b, 0);
  const hardware = n * nc.total, upfront = hardware + install;
  // What the customer pays: our cost plus margin (ASSUMPTION margins, editable).
  const price = upfront / (1 - F.margin_upfront / 100), sub = yearly / (1 - F.margin_yearly / 100);
  const Y = F.years;
  return {
    node: nc, hardware, install, installParts: { labour, mounting, works, setup: F.site_setup }, upfront,
    yearly, yearlyParts: yr, price, sub,
    installMargin: (price - upfront) / price, recurringMargin: (sub - yearly) / sub,
    revenue5: price + Y * sub, cost5: upfront + Y * yearly, profit5: price + Y * sub - upfront - Y * yearly,
    paybackMonths: upfront <= price ? 0 : (sub - yearly > 0 ? 12 * (upfront - price) / (sub - yearly) : Infinity),
    customer5: price + Y * sub,
  };
}
export function defaultRadio(design) { return radiosFor(design)[0]; }

// One setup: radio x number of sensors (with the radio's build), its outcome and what it costs.
export function setup(site, drone, interf, radio, n, req = state.req, design = fixedBuild(radio)) {
  const o = outcome(site, drone, design, req.height_m, interf, nearestN(n), req.radius_m);
  if (!o) return null;
  const fin = facility(design, n, radio);
  return { radio, design, n, o, fin, total: fin.customer5 };
}
export const meets = (o, t = state.targets) => !!o && o.cov >= t.area && (o.trk ?? 0) >= t.tracked;

// For one radio: the fewest sensors that meet the targets (cheapest), and the best it can do (most area).
export function forRadio(site, drone, interf, radio, t = state.targets, req = state.req, design = fixedBuild(radio)) {
  const all = X.axes.nodes.map((n) => setup(site, drone, interf, radio, n, req, design)).filter(Boolean);
  const ok = all.filter((x) => meets(x.o, t)).sort((a, b) => a.total - b.total)[0] ?? null;
  const best = all.reduce((b, x) => (!b || x.o.cov > b.o.cov || (x.o.cov === b.o.cov && x.o.trk > b.o.trk) ? x : b), null);
  return { ok, best };
}
// Recommended setup at one interference level: the cheapest radio + sensor count that meets the targets.
export function recommendAt(site, drone, interf, t = state.targets, req = state.req) {
  const per = Object.fromEntries(RADIO_KEYS.map((r) => [r, forRadio(site, drone, interf, r, t, req)]));
  const oks = RADIO_KEYS.map((r) => per[r].ok).filter(Boolean).sort((a, b) => a.total - b.total);
  return { rec: oks[0] ?? null, per };
}
// The Overview's answer: today's level if it works, else the first (unproven) level that does.
export function recommendOverall(site, drone, t = state.targets, req = defaultReq()) {
  const levels = X.axes.interference.map((i) => ({ interf: i, ...recommendAt(site, drone, i, t, req) }));
  const first = levels.find((l) => l.rec) ?? null;
  return { levels, first, today: levels[0] };
}
export function optionFor(site, drone, interf, req = state.req) { return recommendAt(site, drone, interf, state.targets, req).rec; }

export const SITE_TYPE = (k) => X.sites[k].type;
export const siteLabel = (k) => `${X.sites[k].name} (${X.sites[k].type})`;
export const INTERF_LABEL = { 20: 'Conservative: 20 dB (today\'s assumption)', 30: 'Moderate: 30 dB (unproven)', 40: 'Optimistic: 40 dB (unproven)' };
export const INTERF_SHORT = { 20: 'Today (20 dB)', 30: 'With 30 dB removal', 40: 'With 40 dB removal' };
export function fillSelect(el, items, value) {
  el.innerHTML = items.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  if (value != null) el.value = String(value);
}
