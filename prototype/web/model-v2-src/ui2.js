<script>
const LEAD = 'Tripwire listens to signals already in the air (cell towers, digital TV and radio) and hears the echoes of drones, so it emits nothing and gives no signal away to anyone looking for it. The same receivers also find GPS jammers and spoofers, and cue heat cameras for a visual check. We sell to government buyers (state corrections, police, military bases, the border) as a full service or as sensors for the companies that already hold their contracts. Prisons and stadiums (Hays, Clemson) are where we prove it.';
const usd = (v) => '$' + Math.round(v).toLocaleString('en-US');
const int = (v) => Math.round(v).toLocaleString('en-US');
const k$ = (v) => '$' + v + 'k';
const pct = (v) => v + '%';
const when = (v) => (v >= T ? 'never' : qLabel(v));
const money = (x) => { const v = Math.abs(x) / 1e6; return (x < 0 ? '−$' : '$') + (v >= 10 ? Math.round(v) : v.toFixed(1)) + 'M'; };
const $ = (id) => document.getElementById(id);

const GROUPS = [
  { title: 'Prices', plain: 'what each customer pays', fields: [
    ['sitePrice', 'Prison or jail site: installation', 0, 60000, 2500, usd, 'Per Hays-size site. Unchanged from Draft 5.'],
    ['siteSub', 'Prison or jail site: per year', 0, 60000, 2500, usd, 'Software, 24/7 alerts, evidence records, upkeep.'],
    ['camAttach', 'Sites that add a heat camera', 0, 100, 5, pct, 'Option: $40k + $5k a year. Camera costs us $32,138 (Axis bispectral PTZ, dealer price).'],
    ['largePrice', 'Base or port of entry: installation', 100, 3000, 50, k$, 'Decision: $3M over 5 years with upkeep, against ~$6M per CBP port-of-entry site (CBP FY2027 budget). About 4x a prison perimeter.'],
    ['largeSub', 'Base or port of entry: per year', 50, 800, 25, k$, 'ASSUMPTION.'],
    ['kitPrice', 'Mobile kit for police: price', 100, 2000, 25, k$, 'Decision: $1.2M over 5 years with support, against ~$2.1M per Dedrone kit over 5 years (Cobb County, 2026).'],
    ['kitSub', 'Mobile kit: support per year', 0, 300, 5, k$, 'ASSUMPTION.'],
    ['oemPrice', 'Sensor sold to an integrator', 4000, 30000, 500, usd, 'ASSUMPTION. Our cost is ~$1,600-1,800.'],
    ['oemLicense', 'Integrator software, per sensor per year', 0, 10000, 250, usd, 'ASSUMPTION.'],
    ['gnssAddon', 'GPS jamming monitor, add-on per site per year', 0, 60000, 1000, usd, 'ASSUMPTION; simple detectors list at $1,242-2,539 (NavtechGPS).'],
    ['gnssNetPrice', 'GPS monitoring network for a base or airport, per year', 0, 300, 10, k$, 'ASSUMPTION. FAA held an industry day in Oct 2026 on buying this as a service.'],
  ] },
  { title: 'Selling', plain: 'how fast customers sign', fields: [
    ['repsAddA', 'Salespeople hired per year after Series A', 0, 24, 1, int, 'Plus one for every $3M of new contract value a year. Each gets half a sales engineer.'],
    ['contractQ', 'Buying off existing contracts, from', 4, T, 1, when, 'A GSA Schedule listing and cooperative contracts (OMNIA, Sourcewell, NASPO) let agencies buy without their own tender: one quarter saved on every sale (ASSUMPTION; ~$60k a year to hold). Georgia bought RF detection this way (GPS Press).'],
    ['refGain', 'More wins once Hays and Clemson are references', 0, 100, 5, pct, 'From 2029 (ASSUMPTION).'],
    ['winsDoc', 'State corrections departments won per seller a year', 0, 3, 0.25, (v) => v, 'A department buys for ~23 prisons, installing 4 a quarter (ASSUMPTION).'],
    ['winsJail', 'Large jails won per seller a year', 0, 8, 0.5, (v) => v, 'ASSUMPTION.'],
    ['winsKit', 'Police departments won per seller a year', 0, 10, 0.5, (v) => v, 'FEMA grant money is spent Dec 2026 - Dec 2029 (FY2027 NOFO).'],
    ['afterGrant', 'Police demand left after the FEMA money ends', 0, 100, 5, pct, 'No FEMA counter-drone money after FY2027 was found.'],
    ['winsDod', 'Military installations won per seller a year', 0, 6, 0.25, (v) => v, 'Through primes on Domestic Shield contracts ($4.15B ceilings, <1% ordered) or DIU.'],
    ['winsCbp', 'Border awards (5 sites each) per seller a year', 0, 2, 0.25, (v) => v, 'Through DHS counter-UAS contract holders.'],
    ['winsStad', 'Stadiums won per seller a year', 0, 10, 0.5, (v) => v, 'Only once 40 dB works (Clemson needs 30 dB).'],
    ['renewal', 'Sites renewing at the end of each 5-year term', 50, 100, 5, pct, 'ASSUMPTION.'],
    ['oemUnits', 'Sensors an integrator buys in its first year', 0, 1000, 25, int, 'ASSUMPTION; one new integrator a year, volumes up 25% a year, at most 3,000 sensors a year.'],
    ['gnssAttach', 'Sites that add GPS jamming monitoring', 0, 100, 5, pct, 'ASSUMPTION.'],
    ['gnssNetsPerYear', 'New GPS monitoring networks a year', 0, 10, 1, int, 'ASSUMPTION; first ones at test ranges and bases.'],
  ] },
  { title: 'Technology', plain: 'what has to work, and when', fields: [
    ['tvQ', 'Digital TV and radio signals in our processing', 4, T, 1, when, 'Published: small DJI drones detected 1.6-5 km away on DVB-T (Leonardo, 2020). Prototype v0.6: TV covers all four of our sites in a link-budget estimate (no neighbor-channel interference). Until then a site works only where cell towers suit us (ASSUMPTION: date).'],
    ['q40', '40 dB interference removal works', 4, T, 1, when, 'Cell towers only: until then (or until TV signals work) a third of sites work (one of three simulated sites); stadiums need one of the two.'],
    ['workable', 'Sites that work before 40 dB', 0, 100, 5, pct, 'Prototype: Hays works at 20 dB, Hancock and Fulton do not.'],
    ['ownQ', 'Our own receiver ships', 4, T, 1, when, 'Sensor $1,601 instead of $1,825 and 4 per site instead of 6 (prototype). Design $400k.'],
    ['gnssFrom', 'GPS monitoring on sale', 4, T, 1, when, 'Needs a holdover clock per site (~$1,000, ASSUMPTION) and $300k of development.'],
    ['hwCost', 'Sensor hardware cost', 50, 200, 5, pct, '% of the prototype parts list.'],
  ] },
  { title: 'Government funding and rounds', plain: 'where the money comes from', fields: [
    ['sbir1', 'Chance of an SBIR Phase I ($335,937)', 0, 100, 10, pct, 'Award cap from Oct 16 2026 (sbir.gov).'],
    ['sbir2', 'Chance of an SBIR Phase II ($2,239,578)', 0, 100, 10, pct, 'Award cap (sbir.gov).'],
    ['diu', 'Chance of a DIU prototype award (~$3.8M)', 0, 100, 10, pct, 'Average DIU prototype agreement, FY2016-23 (GAO-25-106856).'],
    ['faa', 'FAA national GPS monitoring program, $M a year', 0, 30, 1, (v) => '$' + v + 'M', 'Scenario only, not in the plan (FAA industry day Oct 2026).'],
    ['r1', 'Seed round', 0, 15, 0.5, (v) => '$' + v + 'M', '2027 Q3.'],
    ['r2', 'Series A', 0, 40, 1, (v) => '$' + v + 'M', '2028 Q4. Sized to the worst scenario (prices 30% lower) plus a buffer.'],
  ] },
].map((g) => ({ ...g, fields: g.fields.map((f) => ({ key: f[0], label: f[1], min: f[2], max: f[3], step: f[4], fmt: f[5], hint: f[6] })) }));

const SCENARIOS = [
  ['Plan', 'The plan as written: every assumption at its starting value.', {}],
  ['Stuck at 20 dB', 'Interference removal never improves and TV signals never work: only a third of sites can be protected, and no stadiums.', { q40: 99, tvQ: 99 }],
  ['Government slow', 'Bases and the border buy half as fast, and police buy only a quarter as much once the FEMA money ends.', { winsDod: 1, winsCbp: 0.25, afterGrant: 25 }],
  ['No integrator sales', 'No company buys our sensors for its own contracts.', { oemUnits: 0 }],
  ['Prices 30% lower', 'Competitors force every price down by 30%.', { sitePrice: 17500, siteSub: 17500, largePrice: 700, largeSub: 280, kitPrice: 420, kitSub: 84, oemPrice: 8400, oemLicense: 2100 }],
  ['Hire faster', '22 salespeople a year after Series A instead of 18.', { repsAddA: 22 }],
  ['No faster selling', 'No contract vehicles and no reference effect: every sale takes its full cycle.', { contractQ: 99, refGain: 0 }],
  ['FAA GPS program', 'We win a national FAA interference-monitoring service worth $10M a year from 2030.', { faa: 10 }],
];
const state = { a: { ...DEFAULTS }, preset: 'Plan' };
const sum = (arr, s, e) => { let v = 0; for (let i = s; i < e; i++) v += arr[i]; return v; };

function buildInputs() {
  const host = $('inputs');
  GROUPS.forEach((g, gi) => {
    const d = document.createElement('details'); d.open = gi < 2 || window.innerWidth > 900;
    d.innerHTML = '<summary><h3>' + g.title + ' <span>· ' + g.plain + '</span></h3></summary>';
    const box = document.createElement('div'); box.className = 'fields';
    g.fields.forEach((f) => {
      const w = document.createElement('div'); w.className = 'field'; w.id = 'f-' + f.key;
      w.innerHTML = '<div class="row"><label for="in-' + f.key + '">' + f.label + '</label><output id="out-' + f.key + '"></output></div>' +
        '<input type="range" id="in-' + f.key + '" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '">' + (f.hint ? '<span class="hint">' + f.hint + '</span>' : '');
      box.appendChild(w);
      w.querySelector('input').addEventListener('input', (e) => { state.a[f.key] = Number(e.target.value); state.preset = null; render(); });
    });
    d.appendChild(box); host.appendChild(d);
  });
  SCENARIOS.forEach((s) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = s[0];
    b.addEventListener('click', () => { state.a = { ...DEFAULTS, ...s[2] }; state.preset = s[0]; render(); });
    $('presets').appendChild(b);
  });
  $('lead').textContent = LEAD;
  const a = DEFAULTS;
  $('lineCards').innerHTML = [
    ['Tripwire Site', 'Prisons, jails and stadiums: sensors on the perimeter, 24/7 alerts, evidence-grade track records, Remote ID receiver included.', usd(a.sitePrice) + ' + ' + usd(a.siteSub) + ' a year'],
    ['Heat-camera option', 'A camera our tracks point at, so staff see the drone before they move.', usd(a.camPrice) + ' + ' + usd(a.camSub) + ' a year'],
    ['Large-perimeter site', 'Military installations, ports of entry and border sites: about 4x a prison, two heat cameras.', '$' + a.largePrice + 'k + $' + a.largeSub + 'k a year'],
    ['Mobile kit', 'Six sensors, a heat camera and a laptop on tripods for police and events, paid from FEMA grant money.', '$' + a.kitPrice + 'k + $' + a.kitSub + 'k a year'],
    ['Sensors for integrators', 'Our sensor and software sold to the companies that hold government counter-drone contracts.', usd(a.oemPrice) + ' + ' + usd(a.oemLicense) + ' a year per sensor'],
    ['GPS jamming and spoofing monitoring', 'The same receivers find the jammer and record evidence for the FCC, FAA or police.', usd(a.gnssAddon) + ' a year per site; $' + a.gnssNetPrice + 'k a year per network'],
  ].map((l) => '<div><b>' + l[0] + '</b><span>' + l[1] + '</span><code>' + l[2] + '</code></div>').join('');
  $('srcList').innerHTML = [
    'Costs per sensor, installation and upkeep: Tripwire digital twin v0.5.1 (Tripwire_Assumptions_and_Figures.md, sections 2-5 and 8).',
    'Pay: BLS OEWS May 2025, Atlanta means (electronics engineers $146,380, software developers $135,870, sales engineers $109,310) x 1.46 (BLS ECEC Jun 2026: benefits 31.7% of compensation in professional services). Founders $120k (decision, below market).',
    'FEMA C-UAS grant FY2027 NOFO: $250M to 56 state agencies, spent Dec 2026 - Dec 2029; passive radar named; tracks shared with DHS.',
    'Military demand: 350 drone detections over 100 installations in 2024 (NORTHCOM, Senate testimony, Feb 2025). Domestic Shield counter-UAS contracts: $4.15B ceilings, about $50M ordered (Sep 2026).',
    'Border: CBP FY2027 counter-UAS request $87.1M, incl. $80.0M for ports of entry; PWAAS goal 58 sites.',
    'Buyers: 1,155 state-run prisons (BJS 2019); 150 jail jurisdictions with 1,000+ people (BJS Census of Jails 2019).',
    'SBIR caps from Oct 16 2026: $335,937 and $2,239,578 (sbir.gov). DIU prototype agreements average ~$3.8M (GAO-25-106856).',
    'Valuations: median pre-money Seed $18.3M, Series A $60.3M (PitchBook-NVCA Venture Monitor Q3 2026). Sale at 4.5x sales (DroneShield, BlueHalo) or 9x (Motorola-Silvus).',
  ].map((s) => '<li>' + s + '</li>').join('');
  $('asmList').innerHTML = [
    'Every price except the prison site, and every win rate, is our estimate (sliders on the left).',
    'Sales cycles: corrections 12 months, jails 9, police 6, bases 18, border 24 months.',
    'Salespeople: the founders and Ashlynn sell first; after Series A we hire 18 a year, spread through the year, plus one per $3M of new contract value, split 25% corrections, 15% jails, 20% police, 25% bases, 5% border, 10% stadiums. A new seller takes 2 quarters to ramp.',
    'Engineers: 10 after Series A plus one per $2.5M of yearly sales; field staff one per 40 sites; admin one per 8 staff.',
    'Compliance from 2029: $150k a year for ITAR registration, CMMC / NIST 800-171 and facility clearance work.',
    'Contracts run 5 years; 90% of sites renew at the end of each term.',
    'From 2029: contract vehicles save one quarter on every sale, and pilot references add 25% more wins per salesperson.',
  ].map((s) => '<li>' + s + '</li>').join('');
  $('notList').innerHTML = [
    'Taking down drones: detection only, no jamming or takeover.',
    'An airspace or drone-traffic data product.',
    'Sales abroad: export rules first (passive radar using cell signals below 2 GHz is likely on the US Munitions List, Category XI).',
    'Satellite and Starlink signals: still research, not in the product.',
  ].map((s) => '<li>' + s + '</li>').join('');
}
function syncInputs() {
  GROUPS.forEach((g) => g.fields.forEach((f) => { const v = state.a[f.key]; $('in-' + f.key).value = Math.min(f.max, v); $('out-' + f.key).textContent = f.fmt(v); $('f-' + f.key).classList.toggle('changed', v !== DEFAULTS[f.key]); }));
  document.querySelectorAll('#presets button').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === state.preset)));
  const cur = SCENARIOS.find((s) => s[0] === state.preset);
  $('presetDesc').textContent = cur ? cur[0] + ': ' + cur[1] : 'Your own settings: one or more sliders moved from the plan.';
}

const Y5 = yr(2031) + 3;   // 2031 Q4
function renderTargets(m) {
  const r45 = investorReturns(m, state.a, Y5, 4.5), r9 = investorReturns(m, state.a, Y5, 9);
  const pill = (ok, txt) => '<span class="pill ' + (ok ? 'good' : 'crit') + '">' + (ok ? '✓' : '✕') + ' ' + txt + '</span>';
  const exitOk = r45.price >= 100e6;
  $('tgtExit').innerHTML = '<h3>What a sale would be worth at the end of year 5</h3><span class="big">' + money(r45.price) + ' to ' + money(r9.price) + '</span>' +
    '<p class="small muted">A sale at the end of 2031 at 4.5x to 9x the last four quarters of sales (' + money(m.ttm[Y5]) + '), plus cash in the bank.</p>' + pill(exitOk, exitOk ? 'above $100M' : 'below $100M');
  const y5 = m.ttm[Y5], ok2 = y5 >= 100e6;
  $('tgtSales').innerHTML = '<h3>The target: $100M of sales a year by year 5</h3><span class="big">' + money(y5) + ' a year</span>' +
    '<p class="small muted">Sales in 2031. ' + (m.q100 !== null ? '$100M a year is reached in ' + qLabel(m.q100) + ' (year ' + (Math.floor(m.q100 / 4) + 1) + ').' : '$100M a year is not reached by 2034.') + '</p>' + pill(ok2, ok2 ? 'met' : 'not met');
}
function renderKpis(m) {
  const raised = m.raised;
  const tiles = [
    ['Cash needed from investors', money(m.peakNeed), 'peak, ' + qLabel(m.qPeak) + '; the plan raises ' + money(raised)],
    ['Pays its own way', m.qCfp === null ? 'not by 2034' : qLabel(m.qCfp), 'first of four quarters in a row with more cash in than out'],
    ['Sales in year 5 (2031)', money(sum(m.totalRev, yr(2031), yr(2032))), 'and ' + money(sum(m.totalRev, yr(2032), yr(2033))) + ' in 2032'],
    ['Gross margin 2031', Math.round(100 * sum(m.gross, yr(2031), yr(2032)) / Math.max(1, sum(m.totalRev, yr(2031), yr(2032)))) + '%', 'left from each $1 of sales after direct costs'],
    ['People at the end of 2031', int(m.heads[Y5]), int(m.hSales[Y5]) + ' in sales, ' + int(m.hEng[Y5]) + ' engineers'],
    ['Lowest cash', money(m.minCash), qLabel(m.qMin)],
  ];
  $('kpis').innerHTML = tiles.map((t) => '<div class="kpi"><span class="label">' + t[0] + '</span><span class="value">' + t[1] + '</span><span class="sub">' + t[2] + '</span></div>').join('');
}

/* ---------- charts (same drawing code as model v1) ---------- */
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent, text) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; }
function niceTicks(lo, hi, n) { const span = hi - lo || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))); const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw); const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v / step) * step); return out; }
const axisMoney = (v) => (v < 0 ? '−' : '') + '$' + (Math.abs(v) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'M';
function frame(host, end, lo, hi, H) {
  const W = Math.max(280, host.clientWidth), L = 56, R = 10, Tp = 26, B = 24;
  host.innerHTML = '';
  const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img' }, host);
  const bw = (W - L - R) / end, x = (i) => L + (i + 0.5) * bw;
  const ticks = niceTicks(lo, hi, 4); lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
  const y = (v) => Tp + (H - Tp - B) * (1 - (v - lo) / (hi - lo));
  ticks.forEach((v) => { el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: v === 0 ? 'var(--faint)' : 'var(--line)', 'stroke-width': 1 }, svg); el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, svg, axisMoney(v)); });
  for (let i = 0; i < end; i += 4) { el('text', { x: L + i * bw + 2, y: H - 6, 'text-anchor': 'start' }, svg, String(START_YEAR + i / 4)); el('line', { x1: L + i * bw, x2: L + i * bw, y1: H - B, y2: H - B + 4, stroke: 'var(--edge)' }, svg); }
  ROUNDS.forEach((r) => { if (r.q <= 0 || r.q >= end || !(state.a[r.key] > 0)) return; const rx = L + r.q * bw; el('line', { x1: rx, x2: rx, y1: Tp, y2: H - B, stroke: 'var(--faint)', 'stroke-dasharray': '4 3' }, svg); el('text', { x: rx + 3, y: Tp + 11, class: 'round' }, svg, r.name); });
  const y5x = L + (Y5 + 1) * bw; el('line', { x1: y5x, x2: y5x, y1: Tp, y2: H - B, stroke: 'var(--signal)', 'stroke-dasharray': '2 3' }, svg); el('text', { x: y5x - 4, y: Tp - 8, 'text-anchor': 'end', class: 'mark' }, svg, 'Year 5 ends');
  return { svg, W, H, L, R, Tp, B, bw, x, y, lo, hi };
}
function hover(host, f, end, rows) {
  const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; host.appendChild(tip);
  const cross = el('line', { y1: f.Tp, y2: f.H - f.B, stroke: 'var(--ink)', 'stroke-width': 1, visibility: 'hidden' }, f.svg);
  const hit = el('rect', { x: f.L, y: 0, width: f.W - f.L - f.R, height: f.H, fill: 'transparent' }, f.svg);
  const show = (ev) => { const box = f.svg.getBoundingClientRect(), px = (ev.clientX - box.left) * (f.W / box.width); const i = Math.max(0, Math.min(end - 1, Math.floor((px - f.L) / f.bw)));
    cross.setAttribute('x1', f.x(i)); cross.setAttribute('x2', f.x(i)); cross.setAttribute('visibility', 'visible');
    tip.innerHTML = '<b>' + qLabel(i) + '</b>' + rows(i).map((r) => '<div><span>' + r[0] + '</span><span>' + r[1] + '</span></div>').join(''); tip.hidden = false;
    const left = f.x(i) * (box.width / f.W) + 12, tw = tip.offsetWidth; tip.style.left = (left + tw > box.width ? Math.max(0, left - tw - 24) : left) + 'px'; tip.style.top = '8px'; };
  hit.addEventListener('pointermove', show); hit.addEventListener('pointerdown', show); hit.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
}
const LINES = [['site', 'Prison, jail and stadium sites', '#2F3136'], ['cam', 'Heat cameras', '#4E5056'], ['large', 'Bases and ports of entry', '#7A776F'], ['kit', 'Mobile kits for police', '#A29E96'],
  ['oem', 'Sensors for integrators', '#C7C2B8'], ['gnss', 'GPS jamming monitoring', 'url(#revChart-hi)'], ['rnd', 'SBIR and DIU funding', '#E2DED6'], ['faa', 'FAA program (scenario)', 'var(--signal)']];
function drawRev(m) {
  const host = $('revChart'), end = T;
  let hi = 1e6, lo = 0; for (let i = 0; i < end; i++) { hi = Math.max(hi, m.totalRev[i], m.ocf[i]); lo = Math.min(lo, m.ocf[i]); }
  const f = frame(host, end, lo * 1.1, hi * 1.08, 300);
  const defs = el('defs', {}, f.svg), p = el('pattern', { id: 'revChart-hi', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 5, height: 5, fill: 'var(--surface)' }, p); el('rect', { width: 1.6, height: 5, fill: 'var(--ink)' }, p);
  const w = Math.max(1.5, f.bw - 2);
  for (let i = 0; i < end; i++) { let base = 0; LINES.forEach(([k, , col]) => { const v = m.rev[k][i]; if (v <= 0) return; const y1 = f.y(base + v), h = f.y(base) - y1; if (h > 0.3) el('rect', { x: f.x(i) - w / 2, y: y1, width: w, height: h, fill: col, stroke: k === 'gnss' ? 'var(--ink)' : 'none', 'stroke-width': 0.5 }, f.svg); base += v; }); }
  let d = ''; for (let i = 0; i < end; i++) d += (i ? 'L' : 'M') + f.x(i).toFixed(1) + ' ' + f.y(m.ocf[i]).toFixed(1);
  el('path', { d, fill: 'none', stroke: 'var(--surface)', 'stroke-width': 5 }, f.svg); el('path', { d, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2 }, f.svg);
  hover(host, f, end, (i) => LINES.filter(([k]) => m.rev[k][i] > 1e3).map(([k, n]) => [n, money(m.rev[k][i])]).concat([['Total sales', money(m.totalRev[i])], ['Cash in minus cash out', money(m.ocf[i])]]));
  $('revLegend').innerHTML = LINES.filter(([k]) => sum(m.rev[k], 0, T) > 0).map(([k, n, col], j) => '<span><i style="background:' + (k === 'gnss' ? 'repeating-linear-gradient(135deg,var(--ink) 0 1.2px,var(--surface) 1.2px 3.6px);outline:1px solid var(--ink);outline-offset:-1px' : col) + '"></i>' + n + '</span>').join('') + '<span><i class="ln"></i>Cash in minus cash out</span>';
}
function drawCash(m) {
  const host = $('cashChart'), c = m.cash, end = T;
  const f = frame(host, end, Math.min(0, ...c) * 1.08, Math.max(1e6, ...c) * 1.08, 260);
  let line = ''; c.forEach((v, i) => { line += (i ? 'L' : 'M') + f.x(i).toFixed(1) + ' ' + f.y(v).toFixed(1); });
  el('path', { d: line, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2 }, f.svg);
  ROUNDS.forEach((r) => { if (state.a[r.key] > 0) el('circle', { cx: f.x(r.q), cy: f.y(c[r.q]), r: 4.5, fill: 'var(--ink)', stroke: 'var(--surface)', 'stroke-width': 2 }, f.svg); });
  hover(host, f, end, (i) => [['Cash in the bank', money(c[i])], ['Cash in minus cash out', money(m.ocf[i])], ['Employees', int(m.heads[i])], ['Sites in service', int(m.sitesActive[i])], ['Mobile kits in service', int(m.kitsActive[i])]]);
  $('cashCaption').textContent = 'Rounds: ' + ROUNDS.filter((r) => state.a[r.key] > 0).map((r) => r.name + ' $' + state.a[r.key] + 'M (' + qLabel(r.q) + ')').join('; ');
}
function renderSegs(m) {
  const at = (s, q) => { const c = m.cohorts[s.key]; let won = 0, inst = 0; for (let k = 0; k <= q; k++) { won += c.won[k]; inst += c.installed[k]; } return [won, inst * (s.product === 'kit' ? 1 : 1)]; };
  const unit = (s) => (s.product === 'kit' ? 'kits' : s.product === 'large' ? 'installations' : 'sites');
  $('segTable').innerHTML = '<thead><tr><th class="l">Customer type</th><th>Buyers</th><th>Per buyer</th><th>Cycle</th><th>Signed by 2031</th><th>In service 2031</th><th>Signed by 2034</th><th>In service 2034</th></tr></thead><tbody>' +
    SEGMENTS.map((s) => { const a5 = at(s, Y5), a8 = at(s, T - 1); return '<tr><td class="l">' + s.name + '<br><span class="small muted">' + s.note + '</span></td><td>' + s.pool + '</td><td>' + s.sites + ' ' + unit(s) + '</td><td>' + s.cycle * 3 + ' mo</td><td>' + a5[0].toFixed(1) + '</td><td>' + int(a5[1]) + '</td><td>' + a8[0].toFixed(1) + '</td><td>' + int(a8[1]) + '</td></tr>'; }).join('') + '</tbody>';
}
function renderReturns(m) {
  const rows = [[4.5, 'Plan, 4.5x sales'], [9, 'Plan, 9x sales']].map(([mult, name]) => { const R = investorReturns(m, state.a, Y5, mult); return '<tr><td class="l">' + name + '</td><td>' + money(R.price) + '</td>' + R.rounds.map((r) => '<td class="' + (r.multiple < 1 ? 'neg' : '') + '">' + r.multiple.toFixed(1) + 'x</td>').join('') + '<td>' + Math.round(R.founders * 100) + '%</td></tr>'; }).join('');
  $('retTable').innerHTML = '<thead><tr><th class="l">Sale at the end of 2031</th><th>Price</th>' + ROUNDS.filter((r) => state.a[r.key] > 0).map((r) => '<th>' + r.name + '</th>').join('') + '<th>Founders keep</th></tr></thead><tbody>' + rows + '</tbody>';
  $('retNote').textContent = 'Each round buys at the US median pre-money for its stage (Seed $18.3M, Series A $60.3M, PitchBook-NVCA Q3 2026); pre-seed at a $5M cap (assumption). Price = 4.5x or 9x the four quarters of sales to 2031 Q4, plus cash. Early investors look for about 10x from a winner.';
}
function renderTable(m) {
  const cols = []; for (let y = 0; y < T / 4; y++) cols.push([y * 4, y * 4 + 4]);
  const mm = (v) => (Math.abs(v) < 5e3 ? '–' : (v < 0 ? '−' : '') + (Math.abs(v) / 1e6).toFixed(1));
  const flow = (n, arr, cls) => '<tr class="' + (cls || '') + '"><td>' + n + '</td>' + cols.map((c) => { const v = sum(arr, c[0], c[1]); return '<td class="' + (v < -5e3 ? 'neg' : '') + '">' + mm(v) + '</td>'; }).join('') + '</tr>';
  const stock = (n, arr, fmt, cls) => '<tr class="' + (cls || '') + '"><td>' + n + '</td>' + cols.map((c) => '<td>' + fmt(arr[c[1] - 1]) + '</td>').join('') + '</tr>';
  const sect = (n) => '<tr class="sect"><td colspan="' + (cols.length + 1) + '">' + n + '</td></tr>';
  $('table').innerHTML = '<table><thead><tr><th></th>' + cols.map((c) => '<th>' + (START_YEAR + c[0] / 4) + '</th>').join('') + '</tr></thead><tbody>' + [
    sect('Sales by product line'), ...LINES.filter(([k]) => sum(m.rev[k], 0, T) > 0).map(([k, n]) => flow(n, m.rev[k], 'sub')), flow('Total sales', m.totalRev, 'total'),
    sect('Costs'), flow('Hardware, installation, upkeep, integrator share', m.varCost), flow('Gross profit', m.gross, 'total'), flow('Salaries, overhead, development, compliance', m.fixed), flow('Operating profit', m.op, 'total'),
    sect('Cash'), flow('Cash in minus cash out', m.ocf), flow('Investment', m.fin), stock('Cash in the bank', m.cash, mm, 'total'),
    sect('People and sites'), stock('Employees', m.heads, int, 'total'), stock('Salespeople and sales engineers', m.hSales, int, 'sub'), stock('Engineers', m.hEng, int, 'sub'), stock('Field staff', m.hField, int, 'sub'), stock('Admin', m.hGA, int, 'sub'),
    stock('Prison, jail and stadium sites in service', m.sitesActive.map((v, i) => v - 4 * m.largeActive[i]), int), stock('Bases and ports in service', m.largeActive, int), stock('Mobile kits in service', m.kitsActive, int),
  ].join('') + '</tbody></table>';
}
function render() {
  syncInputs();
  const m = runModel(state.a);
  renderTargets(m); renderKpis(m); drawRev(m); drawCash(m); renderSegs(m); renderReturns(m); renderTable(m);
}
buildInputs(); render();
let rz; new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(render, 80); }).observe($('cashChart'));
</script>
