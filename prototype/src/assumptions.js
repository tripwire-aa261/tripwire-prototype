// The "Sources & assumptions" table shown in the UI. Keep in step with physics.js / economics.js.
import { THRESHOLD_DB, LOSS_DB, PD, PFA, ILLUMINATORS as I, DRONES as D, DEFAULTS, CALIBRATION, GDOP, TRACK_MIN_PAIRS } from './physics.js';
import { ECON_INPUTS } from './economics.js';

const f = (x, d = 1) => Number(x).toFixed(d);

export const PHYSICS_ROWS = [
  ['Bistatic radar equation', 'S = EIRP·Gr·λ²·σ / ((4π)³·Rt²·Rr²)', 'Standard (Willis, Bistatic Radar)'],
  ['Detection threshold', `${f(THRESHOLD_DB)} dB for Pd=${PD}, Pfa=${PFA}`, "Albersheim's equation; Pd and Pfa are ASSUMPTIONS"],
  ['Calibrated lumped loss', `${f(LOSS_DB)} dB`, `Set so a Mavic-class drone is detected at ${CALIBRATION.targetRangeM} m in a reference LTE450 geometry, matching the Fraunhofer LTE450 trial (memo ref [10]). Reference geometry and settings are ASSUMPTIONS; replace with the paper's values`],
  ['LTE carrier', `${f(I.lte.freqHz / 1e6, 0)} MHz, ${I.lte.bwHz / 1e6} MHz wide`, '3GPP band 12/17 downlink; 10 MHz is a standard LTE channel width'],
  ['LTE sector EIRP', `${f(I.lte.eirpDbw + 30, 0)} dBm`, 'ASSUMPTION'],
  ['LTE vertical pattern', `${I.lte.beamwidthDeg}° beamwidth, ${I.lte.slaDb} dB floor, ${I.lte.tiltDeg}° downtilt`, '3GPP TR 36.814 pattern; downtilt is an ASSUMPTION'],
  ['Cell-site positions', '3 sites, 1.8–2.3 km, one sector facing the facility each', 'ASSUMPTION (next: real towers from OpenCelliD or the FCC antenna registry)'],
  ['FM station', `50 kW ERP, ${I.fm.towers[0].distM / 1000} km away, ${I.fm.bwHz / 1e3} kHz usable bandwidth`, 'ASSUMPTION (next: FCC broadcast records)'],
  ['TV station', `500 kW ERP, ${I.dtv.towers[0].distM / 1000} km away, ${I.dtv.bwHz / 1e6} MHz (ATSC 1.0)`, 'Bandwidth from ATSC A/53; power and distance are ASSUMPTIONS'],
  ['Satellite TV', `${I.dvbs2.eirpDbw} dBW EIRP, ${I.dvbs2.bwHz / 1e6} MHz, ${I.dvbs2.elevationDeg}° elevation`, 'ASSUMPTION. Backscatter only; forward scatter is not modelled yet'],
  ...Object.values(D).map((d) => [`Drone RCS: ${d.name}`, `${d.rcsM2} m², ${d.sizeM} m across`, 'ASSUMPTION (published small-drone RCS spans ~0.001–0.1 m²)']),
  ['RCS at low frequency', 'σ × (ka)⁴ when ka < 1', 'Rayleigh-region scaling; two-regime model is an ASSUMPTION'],
  ['Receiver noise figure', `${DEFAULTS.nfDb} dB`, 'ASSUMPTION (typical SDR)'],
  ['Listener mast height', `${DEFAULTS.listenerHeightM} m`, 'ASSUMPTION'],
  ['Track rule', `≥${TRACK_MIN_PAIRS} transmitter–listener pairs above threshold`, 'ASSUMPTION (enough bistatic ranges for a 3D fix)'],
  ['Position error', `GDOP × (c/B) / √(2·SNR), GDOP = ${GDOP}`, 'Standard range-accuracy form; GDOP is an ASSUMPTION'],
  ['Release gate', '≥150 m from nearest receiver, ≥90% track availability', 'memo: technical release gates'],
  ['Demo site', 'Fictional prison layout', 'Illustration only (next: a real facility from OpenStreetMap)'],
];

export const ECON_ROWS = ECON_INPUTS.map(([, label, v, unit, src]) => [label, `${unit === '$' || unit === '$/yr' ? '$' + v.toLocaleString('en-US') + (unit === '$/yr' ? '/yr' : '') : v.toLocaleString('en-US') + (unit && unit !== '$/dBi' ? ' ' + unit : unit === '$/dBi' ? ' $/dBi' : '')}`, src]);
