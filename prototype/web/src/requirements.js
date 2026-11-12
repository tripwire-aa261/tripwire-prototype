// "What the customer wants": the four settings a customer chooses (drone, area covered, time tracked, tracking
// accuracy). The same block appears on the Overview and in Financials; both edit the shared state.targets.
import { $, esc, X, state, emit, onChange } from './data.js';
import { info } from './help.js';

const SLIDERS = [
  // [key, label, help, min, max, step, format]
  ['area', 'Area covered', 'target_area', 50, 100, 5, (v) => `${v}%`],
  ['tracked', 'Time tracked', 'target_tracked', 50, 100, 5, (v) => `${v}%`],
  ['accuracy', 'Tracking accuracy', 'target_accuracy', 5, 50, 5, (v) => `within ${v} m`],
];

export function mountRequirements(id, note) {
  const el = $(id), p = id;
  el.innerHTML = `<div class="req-head"><h2>What the customer wants</h2><span class="hint">${esc(note)}</span></div>
    <div class="req-grid">
      <label class="req"><span class="req-lab">Drone ${info('drone')}</span><select id="${p}Drone">${Object.entries(X.drones).map(([k, d]) => `<option value="${esc(k)}">${esc(d.name)}</option>`).join('')}</select></label>
      ${SLIDERS.map(([k, l, h, lo, hi, st]) => `<label class="req"><span class="req-lab">${l} ${info(h)}</span><output id="${p}_${k}_out"></output>
        <input type="range" id="${p}_${k}" min="${lo}" max="${hi}" step="${st}" /></label>`).join('')}
    </div>`;
  $(`${p}Drone`).onchange = () => { state.drone = $(`${p}Drone`).value; emit('overview'); };
  for (const [k] of SLIDERS) $(`${p}_${k}`).oninput = () => { state.targets[k] = +$(`${p}_${k}`).value; emit('targets'); };
  const sync = () => {
    $(`${p}Drone`).value = state.drone;
    for (const [k, , , , , , fmt] of SLIDERS) { $(`${p}_${k}`).value = state.targets[k]; $(`${p}_${k}_out`).textContent = fmt(state.targets[k]); }
  };
  onChange(sync);
  sync();
}
