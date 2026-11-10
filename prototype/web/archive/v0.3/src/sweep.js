// Coverage vs number of nodes (and cost) for several node designs: reads web/runs/sweeps/*.json,
// written by `python -m twin.sweep` or by the "Sweep your own design" form (POST /api/sweep).

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const usd = (x) => (x == null ? '—' : `$${Math.round(x).toLocaleString('en-US')}`);
const DIR = '../../runs/sweeps/';
// Colorblind-safe categorical palette (Okabe-Ito order, plus extras).
const COLORS = ['#56b4e9', '#e69f00', '#009e73', '#f0e442', '#cc79a7', '#d55e00', '#0072b2', '#a3e635', '#f472b6', '#94a3b8', '#fb923c', '#22d3ee'];
const FIXED = { v02_iso: '#94a3b8', patch1: '#e69f00', patch2_fan: '#d55e00', patch4_2x2: '#f0e442', omni4: '#cc79a7',
  omni8: '#0072b2', patch8_2x4: '#56b4e9', patch2_fan_full: '#a3e635', omni4_full: '#22d3ee', omni4_full_mic: '#38bdf8',
  omni8_full: '#fb923c', omni8_full_mic: '#f472b6', omni8_crsall: '#818cf8', patch8_full: '#facc15' };
const colorOf = (d, k) => FIXED[d.id] || COLORS[k % COLORS.length];
const TIER_COLORS = { 80: '#34d399', 90: '#fbbf24', 95: '#f87171' };
const ZONE = { nodes: 3, install: 50000, sub: 18000, hw: 24000, deploy: 6000, years: 5, incumbent: 104000 };

let docs = [], current = null, hidden = new Set(), hover = null;
// Shown by default: the story line. The rest are one click away in the table.
const DEFAULT_HIDDEN = new Set(['patch2_fan', 'omni8', 'patch8_2x4', 'omni4_full', 'omni8_crsall', 'patch8_full']);

function metricOf(pt, metric) { return metric === 'flights' ? pt.flights?.mean_pct ?? null : pt.located_pct; }

function facility(n, nodeUsd) {
  const zones = Math.ceil(n / ZONE.nodes), hwZone = nodeUsd * ZONE.nodes;
  return { zones, hwZone, hwFac: nodeUsd * n, margin: (ZONE.install - hwZone - ZONE.deploy) / ZONE.install,
    customer: zones * (ZONE.install + ZONE.years * ZONE.sub) };
}

function nodeUsd(d) {
  const r = $('swRadio').value;
  return d.node_cost_usd[r === 'design' ? d.radio : r];
}

function draw() {
  if (!current) return;
  const metric = $('swMetric').value, svg = $('swChart');
  const W = 760, H = 360, ml = 46, mr = 150, mt = 14, mb = 36, pw = W - ml - mr, ph = H - mt - mb;
  const ns = current.node_counts, nmax = Math.max(...ns), nmin = Math.min(...ns);
  const X = (n) => ml + ((n - nmin) / (nmax - nmin)) * pw, Y = (v) => mt + ph - (v / 100) * ph;
  let g = '';
  for (let v = 0; v <= 100; v += 20) g += `<line class="grid" x1="${ml}" x2="${ml + pw}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${ml - 8}" y="${Y(v) + 4}" text-anchor="end">${v}%</text>`;
  for (const n of ns) g += `<text x="${X(n)}" y="${H - 16}" text-anchor="middle">${n}</text>`;
  g += `<text x="${ml + pw / 2}" y="${H - 2}" text-anchor="middle">listener nodes on the perimeter</text>`;
  for (const t of current.tiers) g += `<line class="tier" stroke="${TIER_COLORS[t]}" x1="${ml}" x2="${ml + pw}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${ml + 4}" y="${Y(t) - 3}" style="fill:${TIER_COLORS[t]}">${t}% tier</text>`;
  const labels = [];
  current.designs.forEach((d, k) => {
    if (hidden.has(d.id)) return;
    const pts = d.points.map((p) => [p.n, metricOf(p, metric)]).filter(([, v]) => v != null);
    const dash = d.stage === 'Series A' ? '7 4' : d.stage === 'reference' ? '2 4' : 'none';
    const col = colorOf(d, k);
    const dim = hover && hover !== d.id ? ' dim' : '';
    g += `<polyline class="series${dim}" data-id="${d.id}" stroke="${col}" stroke-dasharray="${dash}" points="${pts.map(([n, v]) => `${X(n)},${Y(v)}`).join(' ')}"/>`;
    if (!dim) for (const [n, v] of pts) g += `<circle cx="${X(n)}" cy="${Y(v)}" r="3.2" fill="${col}" data-id="${d.id}" data-n="${n}"><title>${esc(d.label)} · ${n} nodes · ${v.toFixed(0)}%</title></circle>`;
    const [ln, lv] = pts[pts.length - 1] || [nmax, 0];
    if (!dim || hover === d.id) labels.push({ x: X(ln) + 6, y: Y(lv) + 4, col, text: d.label.length > 24 ? d.label.slice(0, 23) + '…' : d.label });
  });
  // Push end labels apart so they don't overlap (min 12 px), keeping their order.
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 12);
  const over = labels.length ? labels[labels.length - 1].y - (H - mb) : 0;
  if (over > 0) labels.forEach((l) => (l.y -= over));
  for (const l of labels) g += `<text x="${l.x}" y="${l.y}" style="fill:${l.col}">${esc(l.text)}</text>`;
  svg.innerHTML = g;
  svg.querySelectorAll('circle').forEach((c) => (c.onmouseenter = () => {
    const d = current.designs.find((x) => x.id === c.dataset.id), n = +c.dataset.n, pt = d.points.find((p) => p.n === n), f = facility(n, nodeUsd(d));
    $('swTip').innerHTML = `<b>${esc(d.label)}</b>, ${n} nodes: ${pt.located_pct}% of zone located, ${pt.detected_pct}% detected` +
      (pt.flights ? `; scored flights: track availability mean ${pt.flights.mean_pct}% (10th percentile ${pt.flights.p10_pct}%), ${pt.flights.share_flights_90_pct}% of flights ≥ 90%, hover ${pt.flights.hover_share_pct}% of in-zone time` : '') +
      `. Hardware ${usd(f.hwFac)} for the facility (${usd(f.hwZone)} per 3-node zone), billed ${f.zones} zone(s): customer ${usd(f.customer)} over ${ZONE.years} years.`;
  }));
  table(metric);
}

function table(metric) {
  const tiers = current.tiers;
  const head = `<tr><th>Design</th><th>Stage · radio</th><th>Parts / node</th><th>Per 3-node zone<br><span class="note">target ≤ $24k</span></th><th>Install margin<br><span class="note">target ≥ 40%</span></th>${tiers.map((t) => `<th>Nodes for ${t}%<br><span class="note">facility hardware</span></th>`).join('')}<th>Flights at 8 nodes<br><span class="note">mean / ≥90%</span></th></tr>`;
  const rows = current.designs.map((d, k) => {
    const nu = nodeUsd(d), f = facility(3, nu), r = $('swRadio').value === 'design' ? d.radio : $('swRadio').value;
    const cells = tiers.map((t) => {
      const pt = d.points.find((p) => (metricOf(p, metric) ?? -1) >= t);
      return pt ? `<td>${pt.n} <span class="note">${usd(nu * pt.n)}</span></td>` : `<td class="bad">> ${current.node_counts.at(-1)}</td>`;
    }).join('');
    const p8 = d.points.find((p) => p.n === 8)?.flights;
    return `<tr data-id="${d.id}" class="${hidden.has(d.id) ? 'dim' : ''}"><td><i class="sw" style="background:${colorOf(d, k)}"></i>${esc(d.label)}</td>
      <td>${esc(d.stage)} · ${esc(r)}</td><td>${usd(nu)}</td><td class="${f.hwZone <= ZONE.hw ? 'ok' : 'bad'}">${usd(f.hwZone)}</td>
      <td class="${f.margin >= 0.4 ? 'ok' : 'bad'}">${Math.round(100 * f.margin)}%</td>${cells}<td>${p8 ? `${p8.mean_pct}% / ${p8.share_flights_90_pct}%` : '—'}</td></tr>`;
  }).join('');
  $('swTable').innerHTML = head + rows;
  $('swTable').querySelectorAll('tr[data-id]').forEach((tr) => {
    tr.onclick = () => { hidden.has(tr.dataset.id) ? hidden.delete(tr.dataset.id) : hidden.add(tr.dataset.id); draw(); };
    tr.onmouseenter = () => { hover = tr.dataset.id; draw(); };
    tr.onmouseleave = () => { hover = null; draw(); };
  });
  $('swNotes').textContent = `${current.notes} Click a row to hide or show its line. Tiers count the first node number at or above the tier (${metric === 'flights' ? 'scored-flight track availability' : 'zone located'}). Scored flights: ${current.flights_per_point} random flights per point. Common settings: ${Object.entries(current.base).map(([k, v]) => `${k}=${v}`).join(', ')}.`;
}

async function loadIndex(select) {
  const idx = await (await fetch(`${DIR}index.json`, { cache: 'no-store' })).json();
  docs = idx.sweeps;
  const order = (s) => (s.id === 'm210' ? 0 : s.id === 'mavic' ? 1 : 2);
  docs.sort((a, b) => order(a) - order(b));
  $('swSel').innerHTML = docs.map((d) => `<option value="${esc(d.id)}">${esc(d.id === 'm210' ? 'Matrice 210 (5 kg): all designs' : d.id === 'mavic' ? 'Mavic class (0.9 kg): all designs' : d.id)}</option>`).join('');
  await loadSweep(select || docs[0]?.id);
}

async function loadSweep(id) {
  if (!id) return;
  current = await (await fetch(`${DIR}${id}.json`, { cache: 'no-store' })).json();
  $('swSel').value = id;
  hidden = new Set(current.designs.length > 5 ? current.designs.map((d) => d.id).filter((x) => DEFAULT_HIDDEN.has(x)) : []);
  draw();
}

export function initSweep(apiMeta) {
  $('openSweep').onclick = async () => { $('sweepDlg').showModal(); if (!current) await loadIndex(); else draw(); };
  $('swSel').onchange = () => loadSweep($('swSel').value);
  $('swMetric').onchange = draw;
  $('swRadio').onchange = draw;
  const f = $('swForm');
  if (!apiMeta) { f.querySelectorAll('input,select,button').forEach((e) => (e.disabled = true)); $('swStatus').textContent = 'archived version: read-only'; return; }
  $('swf_drone').innerHTML = Object.values(apiMeta.drones).map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  $('swf_antenna').innerHTML = Object.entries(apiMeta.antennas).map(([k, a]) => `<option value="${k}">${esc(a.name)}</option>`).join('');
  $('swf_processing').innerHTML = Object.entries(apiMeta.processing).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('');
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    const design = { antenna: v.antenna, rx_elements: +v.rx_elements, faces: +v.faces, processing: v.processing, mic_range_m: +v.mic_range_m };
    const label = v.label || `${design.rx_elements}× ${design.antenna}${design.faces > 1 ? `, ${design.faces} faces` : ''}, ${design.processing}${design.mic_range_m ? ', mics' : ''}`;
    $('swBtn').disabled = true;
    const res = await fetch('/api/sweep', { method: 'POST', body: JSON.stringify({ drone: v.drone, design, label, radio: v.radio }) });
    const body = await res.json();
    if (!res.ok) { $('swStatus').textContent = body.error; $('swBtn').disabled = false; return; }
    const poll = setInterval(async () => {
      const j = await (await fetch(`/api/job/${body.job}`)).json();
      $('swStatus').textContent = j.status === 'running' ? `node count ${j.done}/${j.total || '…'}` : j.status;
      if (j.status !== 'running') {
        clearInterval(poll); $('swBtn').disabled = false;
        if (j.status === 'finished') await loadIndex(j.run_id); else $('swStatus').textContent = `failed: ${j.error}`;
      }
    }, 1000);
  };
}
