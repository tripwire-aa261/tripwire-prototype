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
  radio: 'bladerf', n: null, // selected setup (Trade space simulator picker): which radio, how many sensors
  build: null, // sensor setup explored in the Simulation tab (null = the radio's fixed build)
  targets: null, // { area, tracked }: the Overview sliders (what the customer wants)
  fin: null, // editable financial inputs
};
const listeners = [];
export const onChange = (fn) => listeners.push(fn);
export function emit(source) { for (const fn of listeners) fn(source); }

const LS_KEY = 'tripwire-fin-v04.4'; // bumped when defaults change (Nov 12: re-priced parts, hub, 40/40 margins, pricing models)
export function finDefaults() {
  const f = COSTS.finance, n = COSTS.node, a = COSTS.antennas; // single source: runs/cost_model.json (twin/cost.py)
  return {
    radio_b210: COSTS.radios.b210.usd, radio_bladerf: COSTS.radios.bladerf.usd,
    custom_board: Math.round(COSTS.custom_breakdown['1000'].total_usd), // parts + assembly + test, no NRE
    gnss: n.gnss_usd, clock: n.clock_dist_usd, computer: n.compute_usd, computer_per4: n.compute_per_extra_4ch_usd,
    full_factor: n.compute_full_signal_factor, enclosure: n.enclosure_usd, surge: n.surge_per_antenna_usd, mic: n.mic_usd,
    ant_omni: a.omni.price_usd, ant_patch: a.patch.price_usd, ant_lpda: a.lpda.price_usd, ant_yagi: a.yagi.price_usd,
    tech_hours: f.install.tech_hours_per_sensor, labour_rate: f.install.labour_rate_usd_per_h, mounting: f.install.mounting_cabling_usd,
    site_works: f.install.site_works_usd, site_setup: f.install.site_setup_usd, hub: f.install.hub_usd ?? 0,
    visits: f.maintenance.visits_per_year, visit_hours: f.maintenance.hours_per_visit_per_sensor, spares_pct: f.maintenance.spares_pct_of_hardware,
    connectivity_mo: f.maintenance.connectivity_usd_per_month, software_yr: f.maintenance.software_usd_per_year,
    backhaul_mo: f.maintenance.backhaul_usd_per_month ?? 0, cloud_yr: f.maintenance.cloud_usd_per_year ?? 0,
    margin_upfront: f.pricing.margin_upfront_pct, margin_yearly: f.pricing.margin_yearly_pct,
    model: f.pricing.model ?? 'install_sub', capital_pct: f.pricing.cost_of_capital_pct ?? 10, years: f.pricing.years,
    set_install: COSTS.zone.install_price_usd, set_sub: COSTS.zone.subscription_usd_per_year, // data package planning prices
    // Today's options, for an apples-to-apples comparison (Nov 12). Radar-based system per prison:
    // count of compact radars (ASSUMPTION: 120 deg sensors, so 3 for 360 deg from one point, 5 with blind spots
    // filled), price per radar and installation share (CITED: AirSight radar and cost guides, 2026).
    // Single source: twin/cost.py FINANCE['benchmarks'] (runs/cost_model.json); the literals are a fallback for an older file.
    cmp_radar_n_lo: CB().radar_n_lo ?? 3, cmp_radar_n_hi: CB().radar_n_hi ?? 5, cmp_radar_lo: CB().radar_usd_lo ?? 30000, cmp_radar_hi: CB().radar_usd_hi ?? 80000,
    cmp_install_lo: CB().radar_install_pct_lo ?? 30, cmp_install_hi: CB().radar_install_pct_hi ?? 60,
    nre: COSTS.custom.nre_usd, overhead_yr: 1000000, // ASSUMPTION: company running cost per year (team, office, sales)
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
  orderSites();
  state.req = defaultReq();
  state.targets = defaultTargets();
  state.interf = X.default_req.interference_db;
  state.fin = loadFin();
  indexResults();
}
// What the customer wants: area covered (%), time tracked (%) and tracking accuracy (median position error, m).
// Accuracy default 25 m = explore.json default_req.accuracy_m (ASSUMPTION: enough to send a guard).
// Sites are named by the cell towers around them, which is what decides the result (Nov 12 feedback; explore.json
// still carries the older rural / remote / dense urban labels from twin/scenarios.py). Shown in this order,
// fewest towers first; Hays (the middle one) is the default site (state.site).
const SITE_ORDER = ['hancock', 'hays', 'fulton'];
const SITE_TYPES = { hancock: 'sparse towers', hays: 'moderate towers', fulton: 'dense towers' };
function orderSites() {
  const keys = [...SITE_ORDER.filter((k) => X.sites[k]), ...Object.keys(X.sites).filter((k) => !SITE_ORDER.includes(k))];
  X.sites = Object.fromEntries(keys.map((k) => [k, { ...X.sites[k], type: SITE_TYPES[k] ?? X.sites[k].type }]));
}
// Detection range: how far outside the fence the typical incoming drone (half of them) is first tracked; 300 m default
// (default_req.detection_m, DECISION Nov 12). The 8-in-10 figure and weak directions are shown as information.
export const defaultTargets = () => ({ area: X.default_req.coverage_pct, tracked: X.default_req.tracked_pct, accuracy: X.default_req.accuracy_m ?? 25,
  detection: X.default_req.detection_m ?? 300 });
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
  ring4_enh_mic: { name: 'Standard + microphone', spec: '4 all-round antennas · whole-signal processing · microphone holds the hover · off-the-shelf radio', stage: 'Seed' },
  ring8_enh_mic: { name: 'Custom + microphone', spec: '8 all-round antennas · whole-signal processing · microphone holds the hover · our own radio', stage: 'Series A' },
  // Fixed builds since v0.4.3: the hover is held in software by background history (twin/hover.py).
  ring4_enh_hist: { name: 'Standard', spec: '4 all-round antennas · whole-signal processing · hover held by background history · off-the-shelf radio', stage: 'Seed' },
  ring8_enh_hist: { name: 'Custom', spec: '8 all-round antennas · whole-signal processing · hover held by background history · our own radio', stage: 'Series A' },
};
// Radios: each comes with one fixed sensor build (explore.py BUILDS). bladeRF and B210 are the same radio in
// the model (12-bit, 2 channels per board); the B210 only costs more.
export const RADIO_KEYS = ['bladerf', 'b210', 'custom'];
export const RADIO = {
  bladerf: { name: 'bladeRF', long: 'bladeRF 2.0 micro', kind: 'off-the-shelf', stage: 'Seed',
    build: '2 bladeRF boards, 4 all-round antennas; the hover is held in software (background history)' },
  b210: { name: 'B210', long: 'USRP B210', kind: 'off-the-shelf', stage: 'Seed',
    build: '2 B210 boards, 4 all-round antennas; the hover is held in software (background history)' },
  custom: { name: 'Custom receiver', long: 'our own 8-channel receiver', kind: 'custom', stage: 'Series A',
    build: '1 custom board, 8 all-round antennas; the hover is held in software (background history)' },
};
export const fixedBuild = (radio) => (X.builds ?? { bladerf: 'ring4_enh_hist', b210: 'ring4_enh_hist', custom: 'ring8_enh_hist' })[radio];
// The design a radio uses: the build explored in Simulation if it fits that radio, else the radio's fixed build.
export const isCustom = (k) => X.designs[k]?.radio === 'custom';
export const designFor = (radio, build = state.build) => (build && X.designs[build] && isCustom(build) === (radio === 'custom') ? build : fixedBuild(radio));
export const OTS_BUILDS = () => Object.keys(X.designs).filter((k) => !isCustom(k));
export const BUILDS_FOR = (radio) => Object.keys(X.designs).filter((k) => isCustom(k) === (radio === 'custom'));
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
  return { cov: r.cov[i], acc: r.acc[i], trk: r.trk[i], warn: r.warn, caught: r.caught ?? null, n,
    det: r.det50 ?? r.warn ?? 0, det80: r.det80 ?? null, dirs: r.dirs ?? [] };
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
  items.surge = m * (F.surge ?? 0);
  if (p.mic_range_m > 0) items.microphone = F.mic;
  return { items, total: Object.values(items).reduce((a, b) => a + b, 0) };
}
export function facility(design, n, radio, F = state.fin) {
  const nc = nodeCost(design, radio, F);
  const labour = n * F.tech_hours * F.labour_rate, mounting = n * F.mounting, works = n * F.site_works;
  const install = labour + mounting + works + F.site_setup + (F.hub ?? 0);
  const yr = {
    labour: n * F.visits * F.visit_hours * F.labour_rate, spares: n * (F.spares_pct / 100) * nc.total,
    connectivity: n * 12 * F.connectivity_mo + 12 * (F.backhaul_mo ?? 0), software: n * F.software_yr + (F.cloud_yr ?? 0),
  };
  const yearly = Object.values(yr).reduce((a, b) => a + b, 0);
  const hardware = n * nc.total, upfront = hardware + install, Y = F.years;
  // What the customer pays: our cost plus margin (editable). "all_in": nothing upfront; the yearly fee also repays
  // the upfront cost over the contract at the cost of capital.
  let price, sub;
  if (F.model === 'set') { // value-based: our own price per facility, whatever the setup costs us
    price = F.set_install; sub = F.set_sub;
  } else if (F.model === 'all_in') {
    const r = (F.capital_pct ?? 0) / 100, annuity = upfront * (r > 0 ? r / (1 - (1 + r) ** -Y) : 1 / Y);
    price = 0; sub = (annuity + yearly) / (1 - F.margin_yearly / 100);
  } else {
    price = upfront / (1 - F.margin_upfront / 100); sub = yearly / (1 - F.margin_yearly / 100);
  }
  const revenue5 = price + Y * sub, cost5 = upfront + Y * yearly;
  return {
    node: nc, hardware, install, installParts: { labour, mounting, works, setup: F.site_setup, hub: F.hub ?? 0 }, upfront,
    yearly, yearlyParts: yr, price, sub,
    installMargin: price > 0 ? (price - upfront) / price : null, recurringMargin: (sub - yearly) / sub,
    revenue5, cost5, profit5: revenue5 - cost5, grossMargin: (revenue5 - cost5) / revenue5,
    paybackMonths: upfront <= price ? 0 : (sub - yearly > 0 ? 12 * (upfront - price) / (sub - yearly) : Infinity),
    customer5: revenue5,
  };
}
// Today's options over the same contract as Tripwire (customer's total per facility). Radar-based system =
// radars x price x (1 + installation share) + the AirSight software subscription (data package ref [4]) for the
// contract. Competitors' hardware upkeep is not public and left out, so their totals are on the low side.
const CB = () => COSTS?.finance?.benchmarks ?? {}; // competitor benchmarks in runs/cost_model.json (twin/cost.py)
// Robin IRIS 360 deg radar: Dedrone (Axon) price list on OMNIA Partners, AM9 (Feb 2025); fallback if cost_model.json lacks it.
export const irisUsd = () => CB().robin_iris_usd ?? 396000;
export function competitors(F = state.fin) {
  const b = X.finance.benchmarks, Y = F.years;
  const lo = F.cmp_radar_n_lo * F.cmp_radar_lo * (1 + F.cmp_install_lo / 100), hi = F.cmp_radar_n_hi * F.cmp_radar_hi * (1 + F.cmp_install_hi / 100);
  return {
    radar: { lo: lo + Y * b.airsight_subscription_low_usd, hi: hi + Y * b.airsight_subscription_high_usd, upLo: lo, upHi: hi },
    rf: b.axon_hardware_install_usd, iris: irisUsd(),
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
export const meetsAcc = (o, t = state.targets) => !!o && o.acc != null && o.acc <= (t.accuracy ?? Infinity);
export const meetsDet = (o, t = state.targets) => !!o && (o.det ?? 0) >= (t.detection ?? 0);
export const meets = (o, t = state.targets) => !!o && o.cov >= t.area && (o.trk ?? 0) >= t.tracked && meetsAcc(o, t) && meetsDet(o, t);
// One line naming the targets, for notes and table captions.
export const targetsText = (t = state.targets) => `${t.area}% area covered, ${t.tracked}% time tracked, accuracy within ${t.accuracy} m${t.detection ? `, detection ${t.detection} m out` : ''}`;
// Compass directions from which drones are first tracked closer than the range asked for (per simulated flight).
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export function weakDirections(o, range) {
  if (!o?.dirs?.length || !range) return [];
  const bad = new Set(o.dirs.filter(([, m]) => m < range).map(([b]) => COMPASS[Math.round(b / 45) % 8]));
  return COMPASS.filter((c) => bad.has(c));
}

// For one radio: the fewest sensors that meet the targets (cheapest), and the best it can do (most area).
export function forRadio(site, drone, interf, radio, t = state.targets, req = state.req, design = fixedBuild(radio)) {
  const all = X.axes.nodes.map((n) => setup(site, drone, interf, radio, n, req, design)).filter(Boolean);
  const ok = all.filter((x) => meets(x.o, t)).sort((a, b) => a.fin.cost5 - b.fin.cost5)[0] ?? null; // cheapest for us
  const best = all.reduce((b, x) => (!b || x.o.cov > b.o.cov || (x.o.cov === b.o.cov && x.o.trk > b.o.trk) ? x : b), null);
  return { ok, best };
}
// Recommended setup at one interference level: the cheapest radio + sensor count that meets the targets.
export function recommendAt(site, drone, interf, t = state.targets, req = state.req) {
  const per = Object.fromEntries(RADIO_KEYS.map((r) => [r, forRadio(site, drone, interf, r, t, req)]));
  const oks = RADIO_KEYS.map((r) => per[r].ok).filter(Boolean).sort((a, b) => a.fin.cost5 - b.fin.cost5);
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
