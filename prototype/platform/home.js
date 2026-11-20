// Home: the scroll-through story of the platform. Every number here is read from the same data files as the tabs.
import { zonesFor } from './searchzone.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderHome(api) {
  const { E, B, P, T, F, usd } = api;
  const ORDER = api.SITE_ORDER.filter((k) => E.sites[k]);

  // ---- hero numbers: the Hays demo flight (0.9 kg drone, cell + TV, today's 20 dB), as in the video
  const g = F && F.sites.hays, run = F && (F.runs['hays|mavic|cell+tv|20'] || [])[0], geo = g && g.flights[0];
  let warnM = null, warnS = null;
  if (run) {
    const ft = run.trk.indexOf(1), cross = geo.inside.indexOf(1);
    if (ft >= 0 && cross > ft) { warnM = geo.fence_m[ft]; warnS = Math.round(geo.t[cross] - geo.t[ft]); }
  }
  const site = P.products.find((p) => p.key === 'site');
  $('hmStats').innerHTML = [
    [warnS !== null ? `${warnS} s` : '–', 'warning before the fence', 'simulated 0.9 kg drone at Hays State Prison'],
    [warnM !== null ? `${warnM} m` : '–', 'out when the track is confirmed', 'same flight, cell + digital TV'],
    ['0 W', 'transmitted', 'listens only: no radio license, no interference'],
    [site ? site.price_text.replace(' + ', ' + ') : '–', 'Tripwire Site price', 'financial model v2 plan price'],
  ].map(([b, s, n]) => `<div class="stat rv"><b>${esc(b)}</b><span>${esc(s)}</span><small>${esc(n)}</small></div>`).join('');

  // ---- the problem: real cases
  $('hmCases').innerHTML = T.cases.slice(0, 3).map((c) => `<article class="case rv"><small>${esc(c.where)}</small><p>${esc(c.what)}</p><b>${esc(c.lesson)}</b>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">Source</a>` : ''}</article>`).join('');

  // ---- how it works
  const s = B.sensor;
  $('hmSensorCost').textContent = usd(s.total_usd);

  // ---- site explorer
  const chips = $('hmSites');
  let cur = 'hays';
  const short = (k) => E.sites[k].name.replace(' State Prison', ' prison').replace(' Memorial Stadium', ' stadium').replace(' County Jail', ' jail').replace(' flightline apron', ' flightline').replace(' Port of Entry', ' port');
  const drawSite = () => {
    chips.innerHTML = ORDER.map((k) => `<button class="${k === cur ? 'on' : ''}" data-k="${k}">${esc(short(k))}</button>`).join('');
    chips.querySelectorAll('button').forEach((b) => (b.onclick = () => { cur = b.dataset.k; drawSite(); }));
    const st = E.sites[cur], a = api.rec(cur, 'mavic', 20).platform || {};
    const m = E.maps.find((mm) => mm.k[0] === cur && mm.k[1] === 'mavic' && mm.k[2] === 'ring8_enh_hist' && mm.k[4] === 20 && mm.k[5] === a.n && (mm.signals || 'cell') === 'cell+tv');
    api.drawMap(m, st, $('hmMap'));
    const prod = P.products.find((p) => p.key === st.product) || {};
    $('hmSiteInfo').innerHTML = `<small class="kicker">${esc(st.type)} · ${esc(st.place)}</small><h3>${esc(st.name)}</h3>
      <div class="big3"><div><b>${a.n ?? '–'}</b><span>sensors</span></div><div><b>${a.cov !== undefined ? Math.round(a.cov) + '%' : '–'}</b><span>of the zone located</span></div><div><b>${st.fence_area_ha}</b><span>hectares inside the fence</span></div></div>
      <p class="muted">${a.meets ? 'Meets the default requirements today' : 'Does not meet every default requirement today'} with cell + digital TV, for the 0.9 kg drone (90% of the zone covered, a track 80% of the time, 25 m accuracy, 300 m before the fence). Product: <b>${esc(prod.name || st.product)}</b>${prod.price_text ? `, ${esc(prod.price_text)}` : ''}.</p>
      <div class="row"><button class="pill" id="hmOpenSite">Open this site →</button><button class="pill ghost" id="hmFlySite">Fly a drone in →</button></div>`;
    $('hmOpenSite').onclick = () => api.openSite(cur);
    $('hmFlySite').onclick = () => api.openSim({ site: cur, play: true });
  };
  drawSite();

  // ---- lost track: replay the real search region at Hays around the hover
  lostDemo(api, g, geo, run);

  // ---- products
  $('hmProducts').innerHTML = P.products.map((p) => `<article class="prod rv"><small>${esc(p.who)}</small><h3>${esc(p.name)}</h3><b>${esc(p.price_text || '')}</b><p>${esc(p.what)}</p><span class="muted">Our cost ${usd(p.cost.upfront)} up front${p.cost.yearly ? ` + ${usd(p.cost.yearly)}/yr` : ''}${p.margin_pct ? ` · ${Math.round(p.margin_pct)}% margin` : ''}</span></article>`).join('');

  // ---- explore tiles
  document.querySelectorAll('[data-go]').forEach((el) => (el.onclick = () => api.show(el.dataset.go)));
  $('hmWatch').onclick = () => api.openSim({ site: 'hays', play: true });
  $('hmTour').onclick = () => api.tour();

  hero($('hmHero'));
  reveal();
}

function reveal() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  document.querySelectorAll('.rv').forEach((el) => io.observe(el));
}

// Illustration (not data): a tower broadcasts, the drone reflects, the sensors hear the echo and the web closes.
function hero(cv) {
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const size = () => { dpr = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
  size(); window.addEventListener('resize', size);
  const t0 = performance.now();
  const sens = [[0.55, 0.78], [0.86, 0.72], [0.74, 0.92], [0.95, 0.9]];
  const draw = (now) => {
    if (!cv.isConnected) return;
    if (cv.offsetParent === null) { requestAnimationFrame(draw); return; }   // tab hidden
    if (cv.clientWidth !== W || cv.clientHeight !== H) size();
    const t = (Math.max(0, now - t0) / 1000) % 12, u = t / 12;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const tx = W * 0.14, ty = H * 0.86;
    // broadcast rings from the tower
    for (let k = 0; k < 6; k++) {
      const r = ((t * 90 + k * 140) % 840);
      ctx.strokeStyle = `rgba(56,189,248,${0.22 * (1 - r / 840)})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(tx, ty, r * (W / 900), Math.PI * 1.05, Math.PI * 1.95 + 0.5); ctx.stroke();
    }
    // tower
    ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx - 14, ty + 40); ctx.lineTo(tx, ty - 30); ctx.lineTo(tx + 14, ty + 40);
    ctx.moveTo(tx - 9, ty + 14); ctx.lineTo(tx + 9, ty + 14); ctx.moveTo(tx - 5, ty - 4); ctx.lineTo(tx + 5, ty - 4); ctx.stroke();
    ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(tx, ty - 32, 4, 0, 7); ctx.fill();
    // drone path
    const dx = W * (1.05 - 0.55 * Math.min(1, u * 1.4)), dy = H * (0.25 + 0.12 * Math.sin(u * 6));
    const caught = u > 0.38;
    // echoes from the drone to the sensors
    sens.forEach(([sx, sy], j) => {
      const X = W * sx, Y = H * sy, on = caught && ((t * 2 + j) % 3 < 2.4);
      if (on) {
        const gr = ctx.createLinearGradient(dx, dy, X, Y); gr.addColorStop(0, 'rgba(52,211,153,.9)'); gr.addColorStop(1, 'rgba(52,211,153,.15)');
        ctx.strokeStyle = gr; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(X, Y); ctx.stroke();
      }
      ctx.fillStyle = on ? '#34d399' : '#38bdf8'; ctx.beginPath(); ctx.arc(X, Y, 5, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(56,189,248,.35)'; ctx.beginPath(); ctx.arc(X, Y, 9 + 3 * Math.sin(t * 3 + j), 0, 7); ctx.stroke();
    });
    // the web around the drone once located
    if (caught) {
      const a = Math.min(1, (u - 0.38) * 6);
      ctx.strokeStyle = `rgba(52,211,153,${0.55 * a})`; ctx.lineWidth = 1;
      for (let ring = 1; ring <= 3; ring++) {
        ctx.beginPath();
        for (let k = 0; k <= 8; k++) { const an = (k / 8) * Math.PI * 2 + t * 0.2, r = ring * 11 * a; const X = dx + r * Math.cos(an), Y = dy + r * Math.sin(an); k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
        ctx.stroke();
      }
      for (let k = 0; k < 8; k++) { const an = (k / 8) * Math.PI * 2 + t * 0.2; ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + 33 * a * Math.cos(an), dy + 33 * a * Math.sin(an)); ctx.stroke(); }
      ctx.fillStyle = 'rgba(52,211,153,.95)'; ctx.font = '600 12px Inter, system-ui, sans-serif';
      ctx.fillText('TRACKED', dx + 40, dy - 12);
    }
    // drone
    ctx.fillStyle = caught ? '#fbbf24' : '#f87171';
    ctx.beginPath(); ctx.arc(dx, dy, 5, 0, 7); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.5;
    [[-9, -6], [9, -6], [-9, 6], [9, 6]].forEach(([ox, oy]) => { ctx.beginPath(); ctx.ellipse(dx + ox, dy + oy, 4, 1.6, 0, 0, 7); ctx.stroke(); });
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

// The real search region from the Hays demo flight, looped around the longest lost-track stretch.
function lostDemo(api, g, geo, run) {
  const cv = $('hmLost'); if (!cv || !run) return;
  const zones = zonesFor(api.F, api.E, 'hays|mavic|cell+tv|20', 0).zones;
  // pick the stretch where the drone hovers with no track
  let k0 = zones.findIndex((z, k) => z && !z.lost && z.hover > 0.5 && k > 0 && geo.xy[k][0] === geo.xy[k - 1][0]);
  if (k0 < 0) k0 = zones.findIndex((z) => z && !z.lost);
  if (k0 < 0) return;
  while (k0 > 0 && zones[k0 - 1]) k0--;
  let k1 = k0; while (k1 + 1 < zones.length && zones[k1 + 1] && !zones[k1 + 1].lost) k1++;
  const a = Math.max(0, k0 - 6), b = Math.min(geo.t.length - 1, k1 + 4);
  const fence = api.E.sites.hays.fence;
  const cx = fence.reduce((s, p) => s + p[0], 0) / fence.length, cy = fence.reduce((s, p) => s + p[1], 0) / fence.length;
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, half = 420, sc = W / (2 * half);
  const px = (x) => W / 2 + (x - cx) * sc, py = (y) => H / 2 - (y - cy) * sc;
  let k = a, last = 0;
  $('hmLostWhen').textContent = `${Math.round(geo.t[k0])} s into the flight`;
  $('hmLostGo').onclick = () => api.openSim({ site: 'hays', i: k0 + 2 });
  const frame = (now) => {
    if (!cv.isConnected) return;
    requestAnimationFrame(frame);
    if (cv.offsetParent === null || now - last < 380) return;
    last = now; k = k >= b ? a : k + 1;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 2; ctx.beginPath(); fence.forEach(([x, y], j) => (j ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y)))); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#38bdf8'; g.sensors.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(px(x), py(y), 4, 0, 7); ctx.fill(); });
    const z = zones[k];
    if (z && !z.lost) z.cells.forEach(([x, y, w]) => { ctx.fillStyle = `rgba(251,146,60,${(0.2 + 0.6 * Math.sqrt(w)).toFixed(2)})`; ctx.fillRect(px(x), py(y + z.cell), z.cell * sc + 0.5, z.cell * sc + 0.5); });
    for (let j = Math.max(0, k - 25); j <= k; j++) if (run.trk[j]) { ctx.fillStyle = 'rgba(52,211,153,.8)'; ctx.beginPath(); ctx.arc(px(run.est[j][0]), py(run.est[j][1]), 2.4, 0, 7); ctx.fill(); }
    const [dx, dy] = geo.xy[k];
    ctx.fillStyle = '#f87171'; ctx.beginPath(); ctx.arc(px(dx), py(dy), 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#dbe5ee'; ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.fillText(run.trk[k] ? 'Tracked' : z && !z.lost ? `No track · region ${z.area_ha.toFixed(1)} ha · drone ${z.inside ? 'inside' : 'outside'}` : 'Located, track not confirmed', 12, 22);
    ctx.fillStyle = '#8396a8'; ctx.font = '12px Inter, system-ui, sans-serif'; ctx.fillText(`${Math.round(geo.t[k])} s`, 12, 40);
  };
  requestAnimationFrame(frame);
}
