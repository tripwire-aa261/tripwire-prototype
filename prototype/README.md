# Tripwire Twin: prototype v0.4

A signal-level digital twin of a passive LTE radar at **three real Georgia facilities**: Hays State Prison
(rural), Hancock State Prison (remote) and Fulton County Jail (dense urban).
It generates the LTE reference signals defined in the standard, propagates them over real terrain and
buildings, adds drone, bird and clutter echoes, and runs the processing chain the product would run:
direct-signal cancellation, range-Doppler maps, CFAR detection, multistatic location and tracking.
The model is calibrated against the only published LTE450 drone-detection field trials (Fraunhofer FKIE).

The viewer has three tabs:
- **Overview** (for people outside the technical work): what a facility gets, which design suits which site
  (under today's interference assumption and the optimistic one, side by side), cost against today's options,
  and what is shown vs still assumed.
- **Simulation**: set the customer's requirements (protected distance around the fence, drone height, area
  covered, time tracked, position accuracy, update rate); see which sensor designs meet them and the cheapest;
  how results change with more sensors; what moves the result (sensitivity); and a 3D replay of full simulations.
- **Financials**: hardware, installation, labour and maintenance per facility, with every assumption editable
  (saved in your browser) and a reset button; pricing per facility by coverage tier.

Earlier versions stay reachable from the page footer: v0.3 (archived in `web/archive/v0.3/`, which also plays the
v0.2 runs) and v0.1 (`v0.1/`).

## Run it

```
cd prototype
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # first time only
.venv/bin/python serve.py                                             # then open http://localhost:8000
```

The Overview, Simulation and Financials tabs read precomputed results (`web/data/explore.json`). The 3D replay
in the Simulation tab can run a new full simulation (2–7 minutes on a laptop, up to 4 CPU cores). The 3D library
loads from a CDN, so you need internet.

On Windows, use `.venv\Scripts\python` instead of `.venv/bin/python`.

| Command | What it does |
|---|---|
| `.venv/bin/python -m twin.explore` | precompute the requirements explorer for all three sites (~40 min, 4 cores) |
| `.venv/bin/python -m twin.run hays --set drone=m210 --set n_listeners=8 --id my-run` | full simulation at a site (`hays`, `hancock`, `fulton`) |
| `.venv/bin/python -m twin.sweep --drone m210 --id m210` | coverage + scored flights + cost vs node count for the standard designs (~1.5 min) |
| `.venv/bin/python -m twin.cost` | print the cost model and write `web/runs/cost_model.json` |
| `.venv/bin/python -m twin.calibrate` | re-fit the calibration to the Fraunhofer trials (~1 min) |
| `.venv/bin/python -m twin.run --relocate` | re-run location/tracking/metrics on saved runs (seconds) |
| `.venv/bin/python -m pytest -q` | 26 physics, antenna, cost and processing tests |
| `.venv/bin/python tools/fetch_site.py --osm-way <id> --id <name> --name "<Facility>"` | fetch another facility (OSM + USGS) |
| `.venv/bin/python tools/fetch_towers.py --site <name>` | real towers near it (FCC; OpenCelliD if a key is set) |

API key (optional): put `OPENCELLID_API_KEY=...` in `prototype/.env` or `aa261/.env.local`. Never commit it.

## What is real, what is assumed

| Real data / standard | Source |
|---|---|
| Facility outline, 162 buildings | OpenStreetMap (ODbL) |
| Terrain (valley at 201 m, Taylor Ridge to 531 m) | USGS 3DEP |
| 12 tower positions and heights | FCC Antenna Structure Registration |
| Which carriers use each tower | OpenCelliD (194 LTE cells; weak evidence) |
| LTE reference signals | 3GPP TS 36.211 (Gold sequence, QPSK, every 6th subcarrier) |
| Terrain/building diffraction | ITU-R P.526 Bullington method |
| Sector antenna pattern | 3GPP TR 36.814 |
| Processing chain, calibration and check data | Demissie & Steffes, IET Radar Sonar Navig. 2025 (LTE450, Fraunhofer) |

Assumptions (all listed in the viewer under **Sources & assumptions**, and in `Iterations.docx` in the project
folder): sector azimuths and EIRP, the exact LTE channel each carrier uses, drone and bird radar cross-sections,
network load, co-channel suppression, building heights (7 m), trial geometry details that are only in the
paper's figures, antenna datasheet values and prices, the ideal gain of arrays and of full-signal processing,
microphone range, and the custom-receiver parts list. Radio prices: USRP B210 $2,387 (data package ref [1]),
bladeRF 2.0 micro xA4 $540 (Nuand shop listing, Nov 2026).

## How the physics works (`twin/`)

1. **`lte.py`**: CRS sequence and resource-element mapping (TS 36.211 §6.10, §7.2). A test checks the
   simulator's frequency-domain model against a full OFDM symbol, delayed and Doppler-shifted sample by sample.
2. **`geo.py`, `rf.py`**: every path (tower to drone, drone to node, tower to node, clutter) gets free-space
   loss + Bullington diffraction over the real terrain and buildings + ground reflection when clear.
   Echo power is the bistatic radar equation. The noise floor per node is thermal + ADC quantisation (driven
   by the strong direct signals) + cancellation residue + co-channel leakage from neighboring cells.
3. **`scene.py`, `channel.py`**: builds the received CRS matrix (subcarriers × 0.5 ms slots) with the
   direct path, static and wind-blown clutter, the drone (body + spinning rotor blades) and a bird (wing beats).
4. **`processing.py`**: SVD direct-path removal (paper eq. 13), range compression, Doppler FFT, 2D CA-CFAR,
   rotor micro-Doppler test.
5. **`locate.py`**: grid search over bistatic-range ellipsoids, Gauss-Newton refinement, velocity from
   Dopplers (fixes needing > 40 m/s or with inconsistent Dopplers are rejected), Kalman tracker.
6. **`calibrate.py`**: fits two unknowns (lumped echo loss, cancellation depth) so the simulator reproduces
   the paper's Fig. 11 (1600 m max range at Pfa 1e-4) and Table 1 (Pd 75–96 %). Both trials are used for
   fitting, so this is not yet an independent validation (next: arXiv 2412.20788).
7. **`coverage.py`**: the same link budget evaluated analytically over a grid (the coverage map).
8. **`antenna.py`**: element patterns (gain, beamwidths, front-to-back; same form as the 3GPP tower pattern),
   faces × elements per face, inward or auto pointing. The pattern applies separately to the drone echo, the
   clutter and each tower's direct signal, so pointing away from towers lowers the noise. `antenna=iso` keeps the
   v0.2 model (gain toward every direction), still used for the Fraunhofer calibration where antennas faced the drone.
9. **`flights.py`**: scored flights (fast estimate): 40 random contraband flights per design and node count. Each
   tower-node pair detects with a probability set by its expected SNR (none inside the zero-Doppler notch), and
   tracks follow the full tracker's rules (confirm 2 of 3, coast through 2 misses, count after 3 frames). One
   fitted offset (5 dB of losses the link budget leaves out) matches 7 full-simulation runs to 6 points RMS
   (worst 10). All 7 runs share one flight path, so treat it as a design-comparison tool.
10. **`cost.py`, `sweep.py`**: node parts cost (B210, bladeRF, or a custom receiver with a volume curve), zone
   economics from the data package, and the node-count sweep behind the Coverage vs cost chart.

## Findings so far (calibrated model; numbers from `web/runs/sweeps/` and the demo runs)

**v0.4, three facilities** (default requirements: drones 60 m up, 150 m around the fence, 90 % of the area
covered, tracked 80 % of the time, within 25 m; 5 kg drone):

- **The type of site decides the architecture, through one assumption: how much interference from neighboring
  cells on the same carrier the processing removes.** At today's assumption (20 dB) only Hays can be covered
  (4 sensors, 8-antenna rings with enhanced processing and microphones, ~$25,900 upfront). At Hancock (remote,
  towers 4+ km away) and Fulton County Jail (city, 52 towers within 5 km), neighboring cells swamp the echoes and
  no design meets the requirements even with 16 sensors.
- **If the processing removes 40 dB** (rebuilding and subtracting each neighbor cell's signal; plausible, unmeasured),
  all three work: Hays 3 sensors (~$20,000 upfront), Hancock 6 sensors (~$33,000), Fulton 4 sensors (~$22,900).
- So interference removal is now the first thing the Seed recordings must measure, ahead of the enhanced-processing
  gain. Hays may also look better than it is: the crowd-sourced cell data puts Verizon on only one nearby tower.

**v0.3 findings (Hays only):**

- **v0.2 was optimistic about antennas.** It gave every antenna its gain toward every direction. With real patterns
  pointed at the facility, the v0.2 "upgraded" node (4 elements) locates the 5 kg drone over ~50 % of the zone
  instead of 97 % (8 nodes). Inward-facing nodes leave the 150 m buffer ring behind them weakly covered.
- **Reference-signal-only processing is not enough, even for the 5 kg drone.** No Seed design reaches the 80 %
  tier with port-0 CRS processing, even with 16 nodes.
- **Full-signal processing is the decisive lever, and it is software.** Using every occupied resource element
  (~+12 dB at 30 % network load) on Seed hardware: 4 omnis per node reach 89 % of the zone with 3 nodes and 95 %
  with 4. With microphones holding tracks through the hover, scored-flight track availability averages 93 % with
  8 nodes (89 % with 6; Series A gate: 90 %). The full simulation of the demo flight gives 86.8 % radar-only (its
  tracker does not use microphones yet). This rests on an ideal-gain ASSUMPTION that recorded captures must test.
- **Off-the-shelf hardware can meet the cost gate.** A 4-omni node with a bladeRF xA4 ($540) costs ~$3,000 in parts:
  ~$9,300 per 3-node zone against the $24,000 target, ~70 % installation margin against 40 %. With B210s the same
  node is ~$6,800 (~$20,400 per zone). A custom receiver is not needed for cost at Seed; it matters for 8+
  coherent channels (Series A).
- **Per-zone pricing breaks when a facility needs more than 3 nodes.** The data package bills $50k + $18k/yr per
  3-node zone. Hays at 8 nodes is billed as 3 zones: ~$420k over 5 years, ~4× the memo's ~$104k incumbent package,
  even though our hardware is cheap. Pricing per facility and coverage tier needs a look.
- **The hover is the limit on track availability.** Even with 100 % zone coverage, radar-only track availability
  levels off just under 90 % (scored flights): a hovering drone has zero Doppler and is cancelled with the direct
  signal. Microphones (or another hover sensor) are needed for margin above 90 %.
- **More sensitivity means birds get tracked too.** The Seed demo run tracks the bird twice; the Series A Mavic run
  tracks it 7 times and has 3 false tracks. Telling drones from birds becomes the gating problem for small drones.
- **The Mavic class remains a Series A problem.** Best case (8 omnis, full signal, microphones): 81 % of the zone
  with 6 nodes, 94 % with 12; scored-flight availability 88 % at 12 nodes, 92 % at 16. The full simulation of the
  demo flight (12 nodes, no microphones in its tracker) gives 78.9 % with first track at only 128 m.
- Earlier findings still hold: 8-bit receivers fail on dynamic range; co-channel interference dominates AT&T
  cells at Hays; drone-versus-bird classification by rotor signature needs much more SNR than detection.

## Known limits

- Single-bounce physics in the CRS domain (no range migration within a dwell).
- Arrays and full-signal processing are modeled as ideal gain on every noise term; real arrays lose some gain to
  channel mismatch, and full-signal reconstruction adds its own errors. Both must be measured on captures.
- Nodes with several faces: each frame uses the face that sees the drone best (no extra false alarms counted).
- Scored flights are a link-budget estimate (no noise, no tracker); the full simulation checks single flights.
- Sector azimuths, EIRP and channels at Hays are assumptions; real tower data would come from a site survey.
- Shorter, unregistered cell sites are missing (FCC only registers structures that need FAA notice).
- The 3D view shows truth, fixes, tracks and antenna beams; bistatic ellipses are not drawn yet.
- Not yet checked against an independent trial or recorded signals (SigMF input is the next step).
