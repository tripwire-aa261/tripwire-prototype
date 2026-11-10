// Run with: node --test   (from the prototype folder)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  albersheimSnrDb, pairSnrDb, makeConfig, transmitters, placeListeners, rcsAt, DRONES, ILLUMINATORS,
  CALIBRATION, LOSS_DB, THRESHOLD_DB, evaluateGrid, detectionReach, distToRect, DEFAULTS,
} from '../src/physics.js';
import { economics, ECON_DEFAULTS } from '../src/economics.js';
import { SITE } from '../src/site.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test("Albersheim threshold for Pd 0.9, Pfa 1e-6 is about 13.1 dB", () => {
  near(albersheimSnrDb(0.9, 1e-6), 13.1, 0.1, 'threshold');
});

test('echo SNR falls 6 dB per doubling of drone-to-listener distance (noise held fixed)', () => {
  const cfg = makeConfig({ illumId: 'dtv' });
  const [tx] = transmitters(cfg.illum);
  const rx = { x: 0, y: 0, z: 6 };
  const a = pairSnrDb(cfg, tx, rx, { x: 0, y: 200, z: 6 });
  const b = pairSnrDb(cfg, tx, rx, { x: 0, y: 400, z: 6 });
  near(a - b, 6.02, 0.3, 'Rr^-2 scaling');
});

test('doubling integration time adds 3 dB', () => {
  const [tx] = transmitters(ILLUMINATORS.dtv);
  const rx = { x: 0, y: 0, z: 6 }, tgt = { x: 100, y: 200, z: 60 };
  const a = pairSnrDb(makeConfig({ illumId: 'dtv', tIntS: 0.1 }), tx, rx, tgt);
  const b = pairSnrDb(makeConfig({ illumId: 'dtv', tIntS: 0.2 }), tx, rx, tgt);
  near(b - a, 3.01, 0.01, 'integration gain');
});

test('calibration: reference geometry sits exactly at threshold at 500 m', () => {
  const k = CALIBRATION;
  const cfg = { ...k.rx, illum: k.illum, drone: DRONES.mavic, lossDb: LOSS_DB };
  const tx = { x: -k.baselineM, y: 0, z: k.illum.towerHeightM };
  const rx = { x: 0, y: 0, z: k.rx.listenerHeightM };
  const tgt = { x: 0, y: Math.sqrt(500 ** 2 - (k.altitudeM - rx.z) ** 2), z: k.altitudeM };
  near(pairSnrDb(cfg, tx, rx, tgt), THRESHOLD_DB, 1e-9, 'calibrated SNR');
  assert.ok(LOSS_DB > 0 && LOSS_DB < 40, `lumped loss is plausible: ${LOSS_DB}`);
});

test('RCS drops in the Rayleigh region (FM) but not at microwave (LTE)', () => {
  assert.equal(rcsAt(DRONES.mavic, ILLUMINATORS.lte.freqHz), DRONES.mavic.rcsM2);
  assert.ok(rcsAt(DRONES.mavic, ILLUMINATORS.fm.freqHz) < DRONES.mavic.rcsM2 / 10);
});

test('listeners are evenly placed on the fence', () => {
  const pts = placeListeners(SITE.fence, 6);
  assert.equal(pts.length, 6);
  for (const p of pts) near(distToRect(p.x, p.y, SITE.fence), 0, 1e-9, 'on fence');
  for (const p of pts) assert.ok(Math.abs(Math.abs(p.x) - SITE.fence.hw) < 1e-9 || Math.abs(Math.abs(p.y) - SITE.fence.hh) < 1e-9);
});

test('more listeners and bigger drones never reduce coverage', () => {
  const g = (o) => evaluateGrid(makeConfig(o), SITE, { stepM: 40 }).trackedPct;
  assert.ok(g({ listeners: 8 }) >= g({ listeners: 4 }));
  assert.ok(g({ droneId: 'phantom' }) >= g({ droneId: 'mini' }));
});

test('default design (LTE, Mavic-class) meets the memo 150 m gate', () => {
  const r = detectionReach(makeConfig({}), SITE);
  assert.ok(r.minM >= 150, `worst-direction reach ${r.minM}`);
  assert.equal(DEFAULTS.illumId, 'lte');
});

test('economics: memo SAM method reproduces ~$88M/yr', () => {
  const e = economics(6, 5, ECON_DEFAULTS);
  near(e.memoSamPerYear / 1e6, 88.4, 0.5, 'memo SAM $M/yr');
  near(e.samSites, 4247.5, 0.01, 'suitable sites');
  assert.ok(e.kitCost > 0 && e.hwMarginPct < 100);
});
