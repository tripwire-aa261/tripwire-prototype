// Plain-language help: a (?) button next to every setting and result. It opens on hover, tap or keyboard
// focus and says what the item is, what it changes, and where the number comes from.
// Vocabulary used everywhere in the viewer: a SENSOR is one box on a pole on the fence; a sensor TYPE is
// what is inside the box (antennas, processing, microphone, radio). "8 sensors" and "8 antennas per sensor"
// are different things.

export const HELP = {
  // ------------------------------------------------------------------ the facility and the scenario
  facility: ['Facility', 'One of three real Georgia facilities, with its real fence outline, buildings, terrain and registered cell towers.',
    'Which towers are nearby and how far away they are, which decides how much signal and how much interference the sensors get.', 'OpenStreetMap, USGS terrain, FCC tower register'],
  drone: ['Drone', '5 kg drone: the size used in the Fraunhofer field trial (DJI Matrice 210 class). Mavic class: a small consumer drone (under 1 kg) that reflects about a tenth as much signal.',
    'Smaller drones are much harder to see: they need more sensors or better sensor types.', 'Radar size 0.1 vs 0.01 m² (ASSUMPTION; only the ratio matters after calibration)'],
  interference: ['Interference removal', 'Neighboring cell towers that use the same frequency drown out the weak drone echo. The processing removes part of that interference.',
    '20 dB is today\'s assumption. 40 dB needs rebuilding and subtracting each neighbor\'s signal, which is plausible but not yet measured. This one number decides whether the remote and city sites work at all.', 'ASSUMPTION: to be measured on the Seed recordings'],
  radius: ['Protected distance around the fence', 'How far outside the fence drones must be watched. The protected area is the facility plus this strip around it.',
    'A wider strip gives guards earlier warning but is more area to cover, so it needs more sensors.', 'Customer choice (the memo\'s release gate uses 150 m)'],
  height: ['Drone height', 'How high the incoming drone flies above the ground.',
    'Higher drones are farther from the sensors on the fence and harder to cover; very low drones can hide behind buildings.', 'Customer choice; 60 m by default'],
  // ------------------------------------------------------------------ results
  caught: ['Drones caught', 'Share of simulated contraband flights (20 random flights in from any direction, a drop inside, out again) that are tracked before the drone crosses the fence.',
    'The headline protection number: "catches 9 in 10 drones" means guards are warned before 9 of 10 drones reach the fence.', 'Simulated (scored flights on the calibrated model)'],
  area: ['Area covered', 'Share of the protected area where a drone\'s position can be fixed: at least 3 tower-to-sensor paths see it, or 2 microphones hear it.',
    'Where there is no coverage a drone can pass unseen. Gaps usually sit far from the sensors or behind buildings.', 'Simulated (calibrated link budget)'],
  tracked: ['Time tracked', 'Share of a drone\'s time inside the protected area during which the system holds a continuous track on it, averaged over 20 simulated flights.',
    'Gaps happen mostly while a drone hovers over the drop point: a still drone has no Doppler shift and radar alone loses it; the microphone covers that.', 'Simulated (scored flights)'],
  accuracy: ['Position accuracy', 'Typical error of the drone\'s reported position (median over the covered area).',
    'Guards need to know roughly where to look; about 25 m is enough to send someone. More sensors and towers make it better.', 'Simulated; rough (within about 2× of the full simulation)'],
  warning: ['Early warning', 'How far outside the fence a drone usually is when it is first tracked.',
    'More warning distance means more time to respond before the drop.', 'Simulated (scored flights, median)'],
  update: ['Position update', 'How often the drone\'s position is refreshed: every 1.5 s, from 0.8 s of listening per update.',
    'Faster updates would need shorter listening, which loses sensitivity.', 'Model setting'],
  // ------------------------------------------------------------------ the design
  sensors: ['Number of sensors', 'How many sensor boxes are mounted on poles, spaced evenly along the fence. Each sensor contains its own antennas (see Sensor type).',
    'More sensors cover more area and track better, at more hardware, installation and upkeep cost. Benefits level off.', 'Design choice'],
  sensortype: ['Sensor type', 'What is inside each sensor box: how many antennas and which kind, how the signal is processed, whether it has a microphone, and which radio it uses. It is not the number of sensors.',
    'Better sensor types see farther, so a facility needs fewer of them, but each one costs more.', 'Design choice; prices in Financials'],
  omni: ['All-round antenna', 'An antenna that hears equally in every direction. Several in one sensor are combined in software, which works like a stronger antenna pointing every way at once.',
    'More all-round antennas per sensor: about 6 dB extra with 4, 9 dB with 8.', 'Typical datasheet values (ASSUMPTION)'],
  patch: ['Panel antenna', 'A flat antenna that is stronger (about 8 dBi) but only hears over about 70°, where it points.',
    'Good where only one direction matters; leaves gaps behind it.', 'Typical datasheet values (ASSUMPTION)'],
  processing: ['Whole-signal vs beacon-only processing', 'Beacon-only uses the small, fixed "reference" part of the cell signal that phones lock onto. Whole-signal decodes the entire signal and uses all of it to find echoes.',
    'Whole-signal is software only and adds about 12 dB of sensitivity at a typical network load. It is the biggest single improvement in the model.', 'ASSUMPTION (ideal gain); must be measured on recordings'],
  microphone: ['Microphone', 'A small microphone array on the sensor that hears a drone within about 100 m.',
    'Keeps the track while the drone hovers, when radar alone loses it.', 'ASSUMPTION: 100 m hearing range'],
  radio: ['Radio', 'The receiver inside each sensor box, and with it the sensor\'s build. bladeRF or B210 (off-the-shelf, Seed): 2 boards, 4 all-round antennas and a microphone. Custom receiver (our own, Series A): 1 board, 8 all-round antennas and a microphone.',
    'The custom sensor hears fainter echoes (8 antennas instead of 4), so fewer sensors cover the same area. bladeRF and B210 perform the same in the model; the B210 costs more.', 'Nuand listing; data package ref [1]; custom parts list in Financials'],
  radio_bladerf: ['bladeRF 2.0 micro', 'Off-the-shelf 12-bit radio board, 2 antenna channels, $540. A sensor uses 2 boards for its 4 antennas.',
    'The cheapest way to build sensors now. What the Seed kit uses.', 'Nuand shop listing, Nov 2026 (confirm with a quote)'],
  radio_b210: ['USRP B210', 'Off-the-shelf 12-bit radio board from Ettus, 2 antenna channels, $2,387. The fallback if bladeRF supply or software falls short.',
    'Same performance as the bladeRF in the model, so the same number of sensors; only the price is higher.', 'Data package ref [1]'],
  radio_custom: ['Custom receiver', 'Our own 8-channel radio on one board (Series A), about $1,040 at 1,000 boards. A sensor uses 1 board and 8 antennas.',
    'More antennas per sensor for less money per antenna: fewer sensors for the same coverage once we build it at volume.', 'Bottom-up parts list (Financials), partly ASSUMPTION'],
  build: ['Antenna setup', 'What is inside an off-the-shelf sensor: how many antennas and which kind, how the signal is processed, and whether there is a microphone. "Standard" is the build the Overview and Financials use. The custom receiver has one fixed setup.',
    'Cheaper setups cost less per sensor but see less far, so you need more of them. Explore them here; the recommendation always uses the standard build.', 'Design choice; prices in Financials'],
  target_area: ['Area covered the customer wants', 'The share of the protected area (the facility plus 150 m around the fence) where a drone must be locatable.',
    'Higher targets need more sensors or a better radio, and may need interference removal that is not yet proven.', 'Customer choice; 90% by default'],
  target_tracked: ['Time tracked the customer wants', 'The share of a drone\'s time inside the protected area during which the system must hold a continuous track.',
    'Hovering drones are the hard part; the microphone helps. Higher targets need more sensors.', 'Customer choice; 80% by default'],
  recommended: ['Recommended setup', 'The cheapest radio and number of sensors that meets both targets, at the lowest level of interference removal that makes it possible.',
    'If today\'s processing (20 dB) is not enough, the page says which level would be needed: that is what the Seed recordings must prove.', 'Simulated outcomes + Financials costs'],
  levels: ['Today vs 30 vs 40 dB', 'Each row assumes a level of interference removal. 20 dB is what we count on today; 30 and 40 dB need extra processing (rebuilding and subtracting each neighbor tower\'s signal) that is plausible but unproven.',
    'Rural sites usually work today. Remote and city sites need 30 to 40 dB: that is the technology risk to retire first.', 'ASSUMPTION: to be measured on the Seed recordings'],
  bynodes: ['Protection vs number of sensors', 'How the chosen outcome grows as sensors are added along the fence, for off-the-shelf radios (bladeRF or B210, same line) and our custom receiver.',
    'Where a line crosses the target is the fewest sensors that meet it. Lines flatten out: past that point more sensors add cost, not protection.', 'Simulated (calibrated model)'],
  // ------------------------------------------------------------------ money
  price: ['What the customer pays', 'Our cost plus a margin: an installation price and a yearly subscription. This is the price we would suggest charging.',
    'Change the margins in Financials. Defaults reproduce the data package\'s planning prices.', 'ASSUMPTION: 40% margin on installation, 72% on the subscription'],
  total: ['Customer total', 'Installation price plus the subscription over the whole contract (5 years by default).',
    'The number to compare options and today\'s alternatives on.', 'Computed from the Financials inputs'],
  upfront: ['Our upfront cost', 'What it costs us to build and install the system: sensor hardware, installation labor, mounting and site set-up.',
    'Not the price. The price adds a margin on top.', 'Financials inputs (cited where possible, else ASSUMPTION)'],
  running: ['Our running cost', 'What the system costs us each year: service visits, spare parts, network connection, cloud software.',
    'Covered by the subscription.', 'Financials inputs (ASSUMPTIONS)'],
  margin: ['Margin', 'Share of the price left after our cost. 40% on a $50,000 installation means our cost is $30,000.',
    'Higher margins raise the price of every option on the menu.', 'ASSUMPTION; editable'],
  menu: ['Protection menu', 'Every combination of sensor type and number of sensors, costed. Options that cost more but protect less than another option are hidden; what is left are the sensible choices at each price.',
    'Pick a row by how much protection is worth to you. "Recommended" is the cheapest option that catches at least 9 in 10 drones and covers at least 90% of the area.', 'Simulated outcomes + Financials costs'],
  // ------------------------------------------------------------------ 3D simulation settings
  load: ['Network busyness', 'Share of the cell network\'s capacity in use. Busier networks send more signal, which helps whole-signal processing but also raises interference from neighbors.',
    'Interference is lowest at night. 30% is the default.', 'ASSUMPTION'],
  cit: ['Listening time per update', 'How long each sensor listens before reporting (integration time).',
    'Longer listening is more sensitive but blurs fast drones and slows updates.', 'Model setting (paper used about 1 s)'],
  bits: ['Receiver bits', 'How finely the radio measures the signal. The direct tower signal is millions of times stronger than the echo, so coarse radios cannot hear both.',
    '8-bit radios fail in the model; 12 bits or more is needed.', 'Model; datasheets'],
  towers: ['Cell towers used per sensor', 'How many nearby cell towers each sensor listens to.',
    'More towers give more viewing angles and better positions, at more processing.', 'Model setting'],
  pointing: ['Antenna pointing', 'For panel antennas: face the facility, or turn each to the direction that gives the most coverage.',
    'Pointing away from strong towers also reduces interference.', 'Model setting'],
};

let tip = null, openFor = null, shownAt = 0;

export function info(key) {
  const h = HELP[key];
  if (!h) return '';
  return `<button type="button" class="info" data-help="${key}" aria-label="What is ${h[0]}?">?</button>`;
}

function show(btn) {
  const h = HELP[btn.dataset.help];
  if (!h) return;
  const [title, what, affects, src] = h;
  tip.innerHTML = `<b>${title}</b><p>${what}</p><p><span class="tl">What it changes:</span> ${affects}</p><p class="src">${src}</p>`;
  tip.hidden = false;
  const r = btn.getBoundingClientRect(), w = Math.min(320, innerWidth - 24);
  tip.style.width = `${w}px`;
  const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 12));
  const below = r.bottom + 8, th = tip.offsetHeight;
  const top = below + th > innerHeight - 8 && r.top - th - 8 > 8 ? r.top - th - 8 : below;
  tip.style.left = `${left}px`; tip.style.top = `${top}px`;
  if (openFor !== btn) shownAt = Date.now();
  openFor = btn; btn.setAttribute('aria-expanded', 'true');
}
function hide() {
  if (!tip) return;
  tip.hidden = true;
  if (openFor) openFor.setAttribute('aria-expanded', 'false');
  openFor = null;
}

export function initHelp() {
  tip = document.createElement('div');
  tip.id = 'helpTip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.appendChild(tip);
  // Static placeholders in the page: <span data-help="key"></span>
  document.querySelectorAll('span[data-help]').forEach((s) => { s.outerHTML = info(s.dataset.help); });
  const target = (e) => e.target.closest?.('button.info');
  document.addEventListener('pointerover', (e) => { const b = target(e); if (b && e.pointerType === 'mouse') show(b); });
  document.addEventListener('pointerout', (e) => { const b = target(e); if (b && e.pointerType === 'mouse' && b === openFor) hide(); });
  document.addEventListener('focusin', (e) => { const b = target(e); if (b) show(b); });
  document.addEventListener('focusout', (e) => { if (target(e)) hide(); });
  document.addEventListener('click', (e) => {
    const b = target(e);
    // A tap focuses the button (which opens it) and then clicks it: only a later tap on the same button closes it.
    if (b) { e.preventDefault(); e.stopPropagation(); if (openFor === b && e.pointerType !== 'mouse' && Date.now() - shownAt > 400) hide(); else show(b); return; }
    if (!e.target.closest?.('#helpTip')) hide();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  addEventListener('scroll', hide, true);
  addEventListener('resize', hide);
}
