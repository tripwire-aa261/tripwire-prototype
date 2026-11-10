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
  req: null, // { radius_m, height_m, coverage_pct, tracked_pct, accuracy_m, update_s }
  design: null, n: null, // selected design (Simulation table / Financials)
  radio: null, tier: '90',
  fin: null, // editable financial inputs
};
const listeners = [];
export const onChange = (fn) => listeners.push(fn);
export function emit(source) { for (const fn of listeners) fn(source); }

const LS_KEY = 'tripwire-fin-v04';
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
    install_price: f.pricing.install_price_usd, tier80: f.pricing.tiers['80'], tier90: f.pricing.tiers['90'], tier95: f.pricing.tiers['95'],
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
  state.interf = X.default_req.interference_db;
  state.fin = loadFin();
  indexResults();
}
export function defaultReq() {
  const d = X.default_req;
  return { radius_m: d.radius_m, height_m: d.height_m, coverage_pct: d.coverage_pct, tracked_pct: d.tracked_pct, accuracy_m: d.accuracy_m, update_s: d.update_s };
}

let IDX = new Map();
function indexResults() { IDX = new Map(X.results.map((r) => [r.k.join('|'), r])); }
export function lookup(site, drone, design, height, interf, n) { return IDX.get([site, drone, design, height, interf, n].join('|')); }

// Outcome of one design point at the current zone radius.
export function outcome(site, drone, design, height, interf, n, radius) {
  const r = lookup(site, drone, design, height, interf, n);
  if (!r) return null;
  const i = X.axes.radii.indexOf(radius);
  return { cov: r.cov[i], acc: r.acc[i], trk: r.trk[i], warn: r.warn, n };
}

export function meets(o, req) {
  const fails = [];
  if (!o) return { ok: false, fails: ['no data'] };
  if (o.cov < req.coverage_pct) fails.push('area');
  if ((o.trk ?? 0) < req.tracked_pct) fails.push('time tracked');
  if (o.acc == null || o.acc > req.accuracy_m) fails.push('accuracy');
  if (X.update_interval_s > req.update_s) fails.push('update rate');
  return { ok: !fails.length, fails };
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
export function facility(design, n, radio, tier, F = state.fin) {
  const nc = nodeCost(design, radio, F);
  const labour = n * F.tech_hours * F.labour_rate, mounting = n * F.mounting, works = n * F.site_works;
  const install = labour + mounting + works + F.site_setup;
  const yr = {
    labour: n * F.visits * F.visit_hours * F.labour_rate, spares: n * (F.spares_pct / 100) * nc.total,
    connectivity: n * 12 * F.connectivity_mo, software: n * F.software_yr,
  };
  const yearly = Object.values(yr).reduce((a, b) => a + b, 0);
  const hardware = n * nc.total, upfront = hardware + install;
  const sub = F[`tier${tier}`], price = F.install_price;
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

// Cheapest node count for a design meeting the requirements (upfront cost).
export function cheapestN(site, drone, design, interf = state.interf, req = state.req) {
  for (const n of X.axes.nodes) {
    const o = outcome(site, drone, design, req.height_m, interf, n, req.radius_m);
    if (meets(o, req).ok) return { n, o };
  }
  return null;
}
export function bestReachable(site, drone, design, interf = state.interf, req = state.req) {
  const n = X.axes.nodes.at(-1);
  return outcome(site, drone, design, req.height_m, interf, n, req.radius_m);
}
export function rankDesigns(site, drone, interf = state.interf, req = state.req) {
  const tier = String(req.coverage_pct);
  return Object.keys(X.designs).map((d) => {
    const c = cheapestN(site, drone, d, interf, req);
    const radio = defaultRadio(d);
    if (!c) return { design: d, ok: false, best: bestReachable(site, drone, d, interf, req), radio };
    return { design: d, ok: true, n: c.n, o: c.o, radio, fin: facility(d, c.n, radio, tier) };
  }).sort((a, b) => (a.ok === b.ok ? (a.ok ? a.fin.upfront - b.fin.upfront : (b.best?.cov ?? 0) - (a.best?.cov ?? 0)) : a.ok ? -1 : 1));
}

export const SITE_TYPE = (k) => X.sites[k].type;
export const siteLabel = (k) => `${X.sites[k].name} (${X.sites[k].type})`;
export const INTERF_LABEL = { 20: 'Conservative: 20 dB (today\'s assumption)', 30: 'Moderate: 30 dB', 40: 'Optimistic: 40 dB (unproven)' };
export function fillSelect(el, items, value) {
  el.innerHTML = items.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  if (value != null) el.value = String(value);
}
