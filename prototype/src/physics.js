// Tripwire physics model. Pure functions, no DOM, so it runs in the browser and in `node --test`.
// Units: SI throughout; values ending in Db/Dbw/Dbi are decibels.
// Coordinates: x = east, y = north, z = up, metres, origin at the site centre.
//
// Every constant below is either from a cited source or labelled ASSUMPTION.
// The same tags are listed for the UI in assumptions.js.

export const C = 299792458; // speed of light, m/s
export const K_B = 1.380649e-23; // Boltzmann constant, J/K
export const T0 = 290; // standard noise temperature, K

export const db = (x) => 10 * Math.log10(x);
export const fromDb = (x) => Math.pow(10, x / 10);
const log10 = Math.log10;
const FOUR_PI_CUBED_DB = 30 * log10(4 * Math.PI);

// ---------------------------------------------------------------------------
// Signals already in the air ("illuminators").
// Bearings are degrees clockwise from north; distances are from the site centre.
// ---------------------------------------------------------------------------
export const ILLUMINATORS = {
  lte: {
    id: 'lte',
    name: 'LTE cell downlink (700 MHz)',
    short: 'LTE',
    freqHz: 739e6, // band 12/17 downlink centre (3GPP TS 36.101 band plan)
    bwHz: 10e6, // one 10 MHz LTE carrier (a standard LTE channel width)
    eirpDbw: 29, // ASSUMPTION: ~59 dBm EIRP per sector
    sector: true,
    tiltDeg: 6, // ASSUMPTION: electrical downtilt
    beamwidthDeg: 10, // vertical 3 dB beamwidth, 3GPP TR 36.814 Table A.2.1.1-2
    slaDb: 20, // vertical side-lobe floor, 3GPP TR 36.814
    towerHeightM: 35, // ASSUMPTION
    // ASSUMPTION: three macro sites nearby, each with a sector facing the facility.
    towers: [
      { label: 'Cell site A', bearingDeg: 300, distM: 1800 },
      { label: 'Cell site B', bearingDeg: 45, distM: 2300 },
      { label: 'Cell site C', bearingDeg: 170, distM: 2000 },
    ],
  },
  fm: {
    id: 'fm',
    name: 'FM radio (98 MHz)',
    short: 'FM',
    freqHz: 98.1e6,
    bwHz: 100e3, // ASSUMPTION: usable bandwidth depends on programme content
    eirpDbw: 49.2, // ASSUMPTION: 50 kW ERP (+2.15 dB ERP to EIRP)
    sector: false,
    towerHeightM: 150, // ASSUMPTION
    towers: [{ label: 'FM station', bearingDeg: 250, distM: 15000 }],
  },
  dtv: {
    id: 'dtv',
    name: 'Digital TV, ATSC (UHF)',
    short: 'DTV',
    freqHz: 575e6,
    bwHz: 5.38e6, // ATSC 1.0 occupied bandwidth in a 6 MHz channel (ATSC A/53)
    eirpDbw: 59.2, // ASSUMPTION: 500 kW ERP
    sector: false,
    towerHeightM: 300, // ASSUMPTION
    towers: [{ label: 'TV station', bearingDeg: 20, distM: 25000 }],
  },
  dvbs2: {
    id: 'dvbs2',
    name: 'Satellite TV, DVB-S2 (12 GHz)',
    short: 'Sat TV',
    freqHz: 12.45e9, // DBS downlink band 12.2-12.7 GHz (US)
    bwHz: 27e6, // ASSUMPTION: transponder bandwidth
    eirpDbw: 52, // ASSUMPTION: typical DBS beam-centre EIRP
    sector: false,
    satellite: true,
    rangeM: 37500e3, // ASSUMPTION: slant range to a geostationary satellite
    azimuthDeg: 200, // ASSUMPTION
    elevationDeg: 40, // ASSUMPTION
    towers: [{ label: 'GEO satellite' }],
  },
};

// ---------------------------------------------------------------------------
// Drones. RCS values are ASSUMPTIONS at microwave frequencies; published
// measurements of small quadcopters span roughly 0.001-0.1 m^2.
// sizeM = largest dimension, used for the low-frequency (Rayleigh) roll-off.
// ---------------------------------------------------------------------------
export const DRONES = {
  mini: { id: 'mini', name: 'Mini (<250 g)', sizeM: 0.25, rcsM2: 0.005 },
  mavic: { id: 'mavic', name: 'Mavic-class (memo target)', sizeM: 0.35, rcsM2: 0.02 },
  phantom: { id: 'phantom', name: 'Phantom-class', sizeM: 0.45, rcsM2: 0.05 },
  heavy: { id: 'heavy', name: 'Heavy-lift (1.2 m)', sizeM: 1.2, rcsM2: 0.3 },
};

// Detection threshold from Albersheim's equation (single pulse, steady target).
export function albersheimSnrDb(pd, pfa, n = 1) {
  const A = Math.log(0.62 / pfa);
  const B = Math.log(pd / (1 - pd));
  return -5 * log10(n) + (6.2 + 4.54 / Math.sqrt(n + 0.44)) * log10(A + 0.12 * A * B + 1.7 * B);
}
export const PD = 0.9; // ASSUMPTION: required probability of detection
export const PFA = 1e-6; // ASSUMPTION: false-alarm probability per range-Doppler cell
export const THRESHOLD_DB = albersheimSnrDb(PD, PFA);

// Default receiver/processing settings, used as slider defaults.
export const DEFAULTS = {
  illumId: 'lte',
  droneId: 'mavic',
  listeners: 6,
  rxGainDbi: 5, // ASSUMPTION: modest directional surveillance antenna
  nfDb: 6, // ASSUMPTION: typical SDR noise figure
  tIntS: 0.1, // ASSUMPTION: coherent integration time (a manoeuvring drone limits it)
  cancelDb: 55, // ASSUMPTION: direct-path and clutter cancellation
  altitudeM: 60,
  listenerHeightM: 6, // ASSUMPTION: mast height
};

export const TRACK_MIN_PAIRS = 3; // ASSUMPTION: >=3 transmitter-listener pairs for a 3D fix
export const GDOP = 1.5; // ASSUMPTION: geometric dilution of precision

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function transmitters(illum) {
  if (illum.satellite) {
    const az = (illum.azimuthDeg * Math.PI) / 180;
    const el = (illum.elevationDeg * Math.PI) / 180;
    return [{ sat: true, label: illum.towers[0].label, dir: { x: Math.sin(az) * Math.cos(el), y: Math.cos(az) * Math.cos(el), z: Math.sin(el) } }];
  }
  return illum.towers.map((t) => {
    const b = (t.bearingDeg * Math.PI) / 180;
    return { label: t.label, distM: t.distM, x: t.distM * Math.sin(b), y: t.distM * Math.cos(b), z: illum.towerHeightM };
  });
}

// Vertical antenna pattern of a cell sector, 3GPP TR 36.814: -min(12((el+tilt)/bw)^2, SLA).
// Azimuth is assumed to point at the site (optimistic; labelled in the UI).
export function txPatternDb(illum, tx, p) {
  if (!illum.sector) return 0;
  const el = (Math.atan2(p.z - tx.z, Math.hypot(p.x - tx.x, p.y - tx.y)) * 180) / Math.PI;
  return -Math.min(12 * ((el + illum.tiltDeg) / illum.beamwidthDeg) ** 2, illum.slaDb);
}

// Drone RCS at a given frequency. Below ka = 1 (drone small next to the wavelength)
// RCS falls as (ka)^4 (Rayleigh region). ASSUMPTION: simple two-regime model.
export function rcsAt(drone, freqHz) {
  const ka = ((2 * Math.PI * freqHz) / C) * (drone.sizeM / 2);
  return ka >= 1 ? drone.rcsM2 : drone.rcsM2 * ka ** 4;
}

// ---------------------------------------------------------------------------
// Bistatic SNR for one transmitter -> drone -> listener pair, after processing.
// Bistatic radar equation (Willis, "Bistatic Radar"):
//   S = EIRP * G_r * lambda^2 * sigma / ((4 pi)^3 Rt^2 Rr^2)
// Noise = thermal + residual direct-path signal left after cancellation.
// Processing gain = B * T_int (coherent integration). Lumped losses are calibrated.
// ---------------------------------------------------------------------------
export function pairSnrDb(cfg, tx, rx, tgt) {
  const { illum } = cfg;
  const lam = C / illum.freqHz;
  const lamDb = 20 * log10(lam);
  const Rt = tx.sat ? illum.rangeM : dist3(tx, tgt);
  const Rr = Math.max(dist3(rx, tgt), 1);
  const L = tx.sat ? illum.rangeM : Math.max(dist3(tx, rx), 1);
  const sigma = rcsAt(cfg.drone, illum.freqHz);

  const signal =
    illum.eirpDbw + txPatternDb(illum, tx, tgt) + cfg.rxGainDbi + lamDb + db(sigma) -
    FOUR_PI_CUBED_DB - 20 * log10(Rt) - 20 * log10(Rr);
  const thermal = db(K_B * T0) + cfg.nfDb + db(illum.bwHz);
  const direct = illum.eirpDbw + txPatternDb(illum, tx, rx) + cfg.rxGainDbi - 20 * log10((4 * Math.PI * L) / lam);
  const noise = db(fromDb(thermal) + fromDb(direct - cfg.cancelDb));
  return signal - noise + db(illum.bwHz * cfg.tIntS) - cfg.lossDb;
}

// ---------------------------------------------------------------------------
// Calibration: one lumped loss (processing, clutter, fluctuation, hardware) chosen so
// that a reference LTE450 geometry detects a Mavic-class drone at ~500 m, matching
// the Fraunhofer LTE450 field trial (Demissie & Steffes 2025, memo ref [10]).
// ASSUMPTION: the reference geometry and power below approximate that trial;
// replace them with the paper's Sections 3-4 values.
// ---------------------------------------------------------------------------
export const CALIBRATION = {
  targetRangeM: 500,
  baselineM: 1000,
  altitudeM: 50,
  // ASSUMPTION: receiver settings of the reference trial.
  rx: { rxGainDbi: 5, nfDb: 6, tIntS: 0.25, cancelDb: 60, listenerHeightM: 6 },
  illum: {
    id: 'lte450', name: 'LTE450 reference', freqHz: 465e6, bwHz: 5e6, eirpDbw: 29,
    sector: true, tiltDeg: 6, beamwidthDeg: 10, slaDb: 20, towerHeightM: 35,
  },
};

export function calibrationLossDb() {
  const k = CALIBRATION;
  const cfg = { ...k.rx, illum: k.illum, drone: DRONES.mavic, lossDb: 0 };
  const tx = { x: -k.baselineM, y: 0, z: k.illum.towerHeightM };
  const rx = { x: 0, y: 0, z: k.rx.listenerHeightM };
  const tgt = { x: 0, y: Math.sqrt(k.targetRangeM ** 2 - (k.altitudeM - rx.z) ** 2), z: k.altitudeM };
  return pairSnrDb(cfg, tx, rx, tgt) - THRESHOLD_DB;
}
export const LOSS_DB = calibrationLossDb();

// ---------------------------------------------------------------------------
// Site helpers
// ---------------------------------------------------------------------------
export function distToRect(x, y, r) {
  const dx = Math.max(Math.abs(x - r.cx) - r.hw, 0);
  const dy = Math.max(Math.abs(y - r.cy) - r.hh, 0);
  return Math.hypot(dx, dy);
}

// Spread n listeners evenly along the fence, starting at a corner.
export function placeListeners(fence, n, heightM = DEFAULTS.listenerHeightM) {
  const { cx, cy, hw, hh } = fence;
  const per = 4 * (hw + hh);
  const pts = [];
  for (let i = 0; i < n; i++) {
    let s = (i / n) * per;
    let x, y;
    if (s < 2 * hw) { x = cx - hw + s; y = cy + hh; }
    else if ((s -= 2 * hw) < 2 * hh) { x = cx + hw; y = cy + hh - s; }
    else if ((s -= 2 * hh) < 2 * hw) { x = cx + hw - s; y = cy - hh; }
    else { s -= 2 * hw; x = cx - hw; y = cy - hh + s; }
    pts.push({ x, y, z: heightM, label: `L${i + 1}` });
  }
  return pts;
}

// Build the full config object from user parameters.
export function makeConfig(params) {
  const p = { ...DEFAULTS, ...params };
  return { ...p, illum: ILLUMINATORS[p.illumId], drone: DRONES[p.droneId], lossDb: LOSS_DB };
}

// Evaluate one drone position against every transmitter-listener pair.
// state: 0 = not seen, 1 = detected by >=1 pair, 2 = tracked (>= TRACK_MIN_PAIRS pairs).
export function evaluatePoint(cfg, txs, listeners, tgt) {
  const snrs = [];
  for (const tx of txs) for (const rx of listeners) snrs.push(pairSnrDb(cfg, tx, rx, tgt));
  snrs.sort((a, b) => b - a);
  const pairs = snrs.filter((s) => s >= THRESHOLD_DB).length;
  const state = pairs >= TRACK_MIN_PAIRS ? 2 : pairs >= 1 ? 1 : 0;
  // Position error: bistatic range resolution c/B, sharpened by SNR, scaled by GDOP.
  // Uses the weakest of the pairs needed for a fix.
  const used = snrs[Math.min(TRACK_MIN_PAIRS, snrs.length) - 1];
  const accM = state === 2 ? (GDOP * (C / cfg.illum.bwHz)) / Math.sqrt(2 * fromDb(used)) : null;
  return { state, pairs, bestSnrDb: snrs[0], accM };
}

// Coverage grid over a square around the site.
export function evaluateGrid(cfg, site, { halfM = 800, stepM = 16 } = {}) {
  const txs = transmitters(cfg.illum);
  const listeners = placeListeners(site.fence, cfg.listeners);
  const n = Math.round((2 * halfM) / stepM);
  const state = new Uint8Array(n * n);
  let zoneCells = 0, zoneTracked = 0, zoneDetected = 0;
  for (let j = 0; j < n; j++) {
    const y = -halfM + (j + 0.5) * stepM;
    for (let i = 0; i < n; i++) {
      const x = -halfM + (i + 0.5) * stepM;
      const r = evaluatePoint(cfg, txs, listeners, { x, y, z: cfg.altitudeM });
      state[j * n + i] = r.state;
      if (distToRect(x, y, site.fence) <= site.bufferM) {
        zoneCells++;
        if (r.state === 2) zoneTracked++;
        if (r.state >= 1) zoneDetected++;
      }
    }
  }
  return {
    n, halfM, stepM, state, listeners, txs,
    trackedPct: (100 * zoneTracked) / zoneCells,
    detectedPct: (100 * zoneDetected) / zoneCells,
  };
}

// How far out the system keeps detecting, measured from the nearest listener (memo gate:
// detect >= 150 m from the nearest receiver). Walk 72 rays outward from the fence line;
// a ray whose fence crossing is not detected scores 0 (a gap in the perimeter).
export function detectionReach(cfg, site, { rays = 72, stepM = 5, maxM = 2500 } = {}) {
  const txs = transmitters(cfg.illum);
  const listeners = placeListeners(site.fence, cfg.listeners);
  const reach = [];
  for (let k = 0; k < rays; k++) {
    const a = (2 * Math.PI * k) / rays;
    const c = Math.cos(a), s = Math.sin(a);
    const r0 = Math.min(site.fence.hw / Math.max(Math.abs(c), 1e-9), site.fence.hh / Math.max(Math.abs(s), 1e-9));
    let last = null;
    for (let r = r0; r <= maxM; r += stepM) {
      const p = { x: site.fence.cx + r * c, y: site.fence.cy + r * s, z: cfg.altitudeM };
      if (evaluatePoint(cfg, txs, listeners, p).state >= 1) last = p;
      else break;
    }
    reach.push(last ? Math.min(...listeners.map((l) => dist3(l, last))) : 0);
  }
  const sorted = [...reach].sort((a, b) => a - b);
  return { minM: sorted[0], medianM: sorted[Math.floor(sorted.length / 2)], rays: reach };
}

// Share of a flight path (inside the protected zone) during which the drone is tracked.
export function trackAvailability(cfg, site, pathPts) {
  const txs = transmitters(cfg.illum);
  const listeners = placeListeners(site.fence, cfg.listeners);
  let inZone = 0, tracked = 0;
  const accs = [];
  for (const p of pathPts) {
    if (distToRect(p.x, p.y, site.fence) > site.bufferM) continue;
    inZone++;
    const r = evaluatePoint(cfg, txs, listeners, { ...p, z: cfg.altitudeM });
    if (r.state === 2) { tracked++; accs.push(r.accM); }
  }
  accs.sort((a, b) => a - b);
  return {
    pct: inZone ? (100 * tracked) / inZone : 0,
    medianAccM: accs.length ? accs[Math.floor(accs.length / 2)] : null,
  };
}
