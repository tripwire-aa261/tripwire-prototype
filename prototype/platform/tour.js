// A guided tour of the prototype: one spotlight and one card per step, across the tabs.
let api = null, steps = [], at = -1, box = null, card = null;

export function initTour(a) {
  api = a;
  steps = [
    { tab: 'home', sel: '#hmHeroText', title: 'Tripwire in one line', text: 'Receive-only sensors hear drone echoes in cell-tower and digital TV signals that are already in the air. Nothing is transmitted.' },
    { tab: 'home', sel: '#hmStats', title: 'The headline numbers', text: 'From the simulated demo flight at Hays State Prison and the financial model v2 price. Each tab shows where they come from.' },
    { tab: 'home', sel: '#hmExplorer', title: 'Seven real sites', text: 'Pick a site to see how many sensors it needs and how much of the zone they cover. Outlines, buildings, terrain and towers are real public data.' },
    { tab: 'sites', sel: '#stMap', title: 'Coverage, any choice', text: 'Change the drone, interference removal, build and sensor count above the map: green is where the drone is located, amber only detected.' },
    { tab: 'sites', sel: '#stChecks', title: 'Does it meet the requirements?', text: 'Each check turns green or red: zone covered, time tracked, accuracy and warning distance.' },
    { tab: 'sim', sel: '#tab-sim .ctlbar', title: 'Fly a drone in', text: 'Choose the site, drone, signals and flight. Every frame is 1.5 s of the twin’s detection model.', before: () => api.openSim({ site: 'hays', i: 0 }) },
    { tab: 'sim', sel: '#smPlay', title: 'Play the flight', text: 'Blue lines are sensors hearing the drone in a cell echo, purple in a TV echo. The green dot is Tripwire’s track.', before: () => api.openSim({ site: 'hays', i: 60, play: true }) },
    { tab: 'sim', sel: '#smView', title: 'Switch to 3D', text: 'The same flight over the site’s real terrain, buildings and towers. Drag to orbit; the camera follows the drone until you do.' },
    { tab: 'sim', sel: '#smNow', title: 'When the track drops', text: 'A particle filter keeps a possible region (orange) from the last fix. No echo over covered ground rules out a moving drone there, so a hovering drone stays inside a small region.', before: () => api.openSim({ site: 'hays', lost: true }) },
    { tab: 'sim', sel: '#smEvents', title: 'What happens, second by second', text: 'Click any event to jump to it.' },
    { tab: 'sensor', sel: '#snBanks', title: 'One sensor, three receive banks', text: 'Cell, digital TV and GPS. Every part is priced from a distributor page or labeled ASSUMPTION.' },
    { tab: 'products', sel: '#prTable', title: 'Every product, costed', text: 'Our cost from the parts list and the twin’s sensor counts, the plan price, and the cheapest comparable system we found.' },
    { tab: 'gnss', sel: '#gnMap', title: 'GPS jammer locator', text: 'The same sensors place a 10 mW car jammer. Colors show the position error across the site.' },
    { tab: 'timeline', sel: '#tlEvents', title: 'A drop, second by second', text: 'The Hays contraband drop from the full signal replay, and real cases at each kind of site. That is the tour.' },
  ];
  box = document.createElement('div'); box.className = 'tour-spot';
  card = document.createElement('div'); card.className = 'tour-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'polite');
  document.body.append(box, card);
  window.addEventListener('resize', () => at >= 0 && place());
  window.addEventListener('scroll', () => at >= 0 && place(), { passive: true });
  window.addEventListener('keydown', (e) => {
    if (at < 0) return;
    if (e.key === 'Escape') end(); else if (e.key === 'ArrowRight') go(at + 1); else if (e.key === 'ArrowLeft') go(at - 1);
  });
}

export function startTour() { go(0); }

function end() { at = -1; box.classList.remove('on'); card.classList.remove('on'); api.pause && api.pause(); }

async function go(n) {
  if (n < 0) return;
  if (n >= steps.length) { end(); return; }
  at = n;
  const s = steps[n];
  api.show(s.tab);
  if (s.before) await s.before();
  const el = document.querySelector(s.sel);
  if (!el) { go(n + 1); return; }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  card.innerHTML = `<small>${n + 1} / ${steps.length}</small><h4>${s.title}</h4><p>${s.text}</p>
    <div class="tour-dots">${steps.map((_, k) => `<i class="${k === n ? 'on' : ''}"></i>`).join('')}</div>
    <div class="tour-btns"><button class="pill ghost" data-a="end">Skip</button><span></span>${n ? '<button class="pill ghost" data-a="back">Back</button>' : ''}<button class="pill" data-a="next">${n === steps.length - 1 ? 'Finish' : 'Next →'}</button></div>`;
  card.querySelector('[data-a=end]').onclick = end;
  card.querySelector('[data-a=next]').onclick = () => go(n + 1);
  const bk = card.querySelector('[data-a=back]'); if (bk) bk.onclick = () => go(n - 1);
  box.classList.add('on'); card.classList.add('on');
  place();
  setTimeout(place, 450);  // after the smooth scroll
}

function place() {
  if (at < 0) return;
  const el = document.querySelector(steps[at].sel); if (!el) return;
  const r = el.getBoundingClientRect(), pad = 8;
  Object.assign(box.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px` });
  const cw = Math.min(360, window.innerWidth - 32), ch = card.offsetHeight || 200;
  let top = r.bottom + 16, left = Math.min(Math.max(16, r.left), window.innerWidth - cw - 16);
  if (top + ch > window.innerHeight - 16) top = r.top - ch - 16;
  if (top < 16) { top = Math.max(16, Math.min(window.innerHeight - ch - 16, r.top + 16)); left = Math.min(window.innerWidth - cw - 16, r.right + 16); if (left + cw > window.innerWidth - 16) left = 16; }
  Object.assign(card.style, { top: `${top}px`, left: `${left}px`, width: `${cw}px` });
}
