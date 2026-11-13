// Tripwire digital twin v0.5.1: tabs (Overview, Trade space simulator, 3D signal simulation, Financials) over shared state.
import { $, esc, X, state, loadData } from './data.js';
import { initOverview } from './overview.js';
import { initSimulate } from './simulate.js';
import { initFinance } from './finance.js';
import { initViewer, setActive, drawCalibration, showRunFor } from './viewer3d.js';
import { initHelp } from './help.js';

let calibration = null;

function showTab(name) {
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('section.tab').forEach((s) => s.classList.toggle('on', s.id === `tab-${name}`));
  setActive(name === 'signal');
  if (name === 'signal') showRunFor(state.site); // follow the facility, drone and radio picked elsewhere
  try { history.replaceState(null, '', `#${name}`); } catch { /* ignore */ }
}

async function boot() {
  initHelp();
  await loadData();
  let meta = null;
  try { meta = await (await fetch('/api/meta')).json(); } catch { meta = null; }
  try { calibration = meta?.calibration || (await (await fetch('runs/calibration.json')).json()); } catch { calibration = null; }
  initSimulate(); // picks the recommended setup first; Financials follows it
  initOverview();
  initFinance();
  await initViewer(meta);
  document.querySelectorAll('.tabbar button').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
  $('openSources').onclick = () => {
    $('srcNotes').innerHTML = `<h3>How the outcomes are computed</h3><ul>${Object.entries(X.notes).map(([k, v]) => `<li><b>${esc(k.replace('_', ' '))}:</b> ${esc(v)}</li>`).join('')}</ul>`;
    $('srcDlg').showModal();
  };
  $('openCal').onclick = () => { drawCalibration(calibration); $('calDlg').showModal(); };
  showTab((location.hash || '#overview').slice(1).replace(/[^a-z]/g, '') || 'overview');
}
boot();
