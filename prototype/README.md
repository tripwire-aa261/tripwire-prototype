# Tripwire Twin: prototype v0.1

A first, quick iteration of the twin + trade-space evaluator from the v2 plan. One demo site in 3D, a
physics model of passive detection, and the unit economics, all updating live as you change the design.

## Run it

```
cd prototype
python3 -m http.server 8080 --bind 127.0.0.1
```

Then open http://localhost:8080. You need an internet connection, because the 3D library (three.js 0.160.0)
loads from a CDN. There is no build step and no API key.

Tests: `node --test` from this folder (Node 18 or later).

## What it does

- **3D twin.** A fictional prison with buildings, fence, listener boxes on the fence, and the nearby transmitters.
  A drone flies an intrusion path. Listeners that hear it draw a line to it, and red dots show the noisy
  position estimates while it is tracked.
- **Coverage map.** Green = located (at least 3 transmitter–listener pairs hear it), amber = detected only,
  red = a gap inside the protected zone (fence + 150 m).
- **Release gates from the memo.** Detection at ≥150 m from the nearest listener, and ≥90% track availability.
- **Economics.** Kit cost, margin, customer cost over 5 years compared with the memo's $40k radar panel and
  $104k incumbent package, and recurring revenue at the memo's 400-site target. Every input can be edited in the UI.
- **Sensitivity ("where should engineering money go?").** Changes one design choice at a time and ranks them
  by effect on coverage.

## The model, briefly (`src/physics.js`)

- Bistatic radar equation for each transmitter → drone → listener pair.
- Noise = receiver thermal noise + the direct transmitter signal left over after cancellation. That leftover
  usually dominates, which is why the cancellation slider matters so much.
- Processing gain = bandwidth × integration time.
- LTE sectors use the 3GPP TR 36.814 vertical antenna pattern. Drones flying above the beam get less signal.
- Drone RCS drops sharply at FM wavelengths (Rayleigh region), which is why FM barely sees small drones.
- Detection threshold from Albersheim's equation (Pd 0.9, Pfa 1e-6 → 13.1 dB).
- **Calibration:** one lumped loss is set so that a reference LTE450 geometry detects a Mavic-class drone at
  500 m, matching the Fraunhofer LTE450 trial (memo ref [10]). The reference geometry is an assumption.
  Replace it with the paper's numbers.

Every number is cited or labelled ASSUMPTION; the "Sources & assumptions" button lists them all.

## Known limits of v0.1 (next steps)

- Site, tower positions and broadcast stations are made up. Next: a real facility footprint from
  OpenStreetMap, plus real towers (OpenCelliD needs a free API key; the FCC antenna registry does not).
- Satellite TV is modelled as backscatter only, so it never detects. Forward scatter (drone between satellite
  and listener) is not modelled yet.
- Buildings do not block or reflect signals. No multipath, no birds, and no simulated waveforms or
  range-Doppler processing yet. This is a link-budget model, not the full signal twin.
- The sensitivity chart saturates when coverage is already 100%.
- The national site survey (all 8,495 facilities) is not started.
