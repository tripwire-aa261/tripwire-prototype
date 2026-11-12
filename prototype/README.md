# Tripwire Twin: prototype v0.4.2

A signal-level digital twin of a passive LTE radar at **three real Georgia facilities**: Hays State Prison
(rural), Hancock State Prison (remote) and Fulton County Jail (dense urban).
It generates the LTE reference signals defined in the standard, propagates them over real terrain and
buildings, adds drone, bird and clutter echoes, and runs the processing chain the product would run:
direct-signal cancellation, range-Doppler maps, CFAR detection, multistatic location and tracking.
The model is calibrated against the only published LTE450 drone-detection field trials (Fraunhofer FKIE).

**v0.4.2 (Nov 12):** the customer chooses by **radio**: bladeRF or B210 (off-the-shelf, Seed) or our custom
receiver (Series A). Each radio has one fixed sensor build (`BUILDS` in `twin/explore.py`): bladeRF/B210 = 2 boards,
4 all-round antennas, whole-signal processing, microphone; custom = 1 board, 8 antennas, microphone. bladeRF and B210
perform the same in the model (12-bit, 2 channels per board) and differ only in price. The **Overview** has two
sliders (area covered, time tracked) and recommends the cheapest radio and sensor count, with our cost and a
suggested price (cost + margin); interference removal is no longer a setting there. Instead the page states whether
today's processing (20 dB) is enough and, if not, which unproven level (30 or 40 dB) the answer needs, in a
today / 30 / 40 dB table. The **Simulation** tab replaces the option table with a radio + number-of-sensors picker
(other antenna setups can still be explored), plots protection and the customer's cost against the number of
sensors per radio, and picks the 3D replay by facility, drone and radio (12 precomputed full simulations at the
recommended sensor count, `tools/make_replays.py`). **Financials** chooses the radio only.

**v0.4.1 (Nov 11):** plain language throughout (a *sensor* is one box on a pole; a *sensor type* is what is inside
it), a (?) explanation on every setting and result (hover, tap or keyboard; text in `web/src/help.js`), and a
**protection menu**: the customer says what to protect and picks an option by price instead of typing targets.
Each option shows *drones caught* (share of simulated contraband flights tracked before the drone crosses the
fence, new in `twin/flights.py`) and *area covered*. Options that cost more and protect less than another are
hidden. Price = our cost + margin (40 % / 72 %, ASSUMPTION reproducing the data package's planning prices).
"Recommended" = cheapest option catching 90 % and covering 90 % (ASSUMPTION thresholds, `twin/explore.py`).
Sensors are still spaced evenly on the fence; choosing the best spots is the next step.

The viewer has three tabs:
- **Overview** (for people outside the technical work): set how much area must be covered and how much of the
  time a drone must be tracked; see the recommended radio and sensor count, its coverage map, our cost and the
  suggested price, what it takes at today's vs higher interference removal, which setup suits which site, and
  cost against today's options.
- **Simulation**: say what to protect (facility, drone, protected distance, drone height) and the interference
  scenario; pick a radio and a number of sensors (and, to explore, another antenna setup); protection and cost
  against the number of sensors per radio; what moves the result (sensitivity); and a 3D replay chosen by
  facility, drone and radio.
- **Financials**: hardware, installation, labor and maintenance per facility for the chosen radio and sensor count,
  with every assumption editable (saved in your browser) and a reset button; price = cost + editable margins; the
  sourced custom-receiver parts list.

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
| `.venv/bin/python -m twin.explore --maps` | recompute only the recommendations and the Overview's coverage maps (~6 min) |
| `.venv/bin/python tools/make_replays.py` | the 12 precomputed 3D replays (facility x drone x radio; ~45 min) |
| `.venv/bin/python -m twin.run hays --set drone=m210 --set n_listeners=8 --id my-run` | full simulation at a site (`hays`, `hancock`, `fulton`) |
| `.venv/bin/python -m twin.sweep --drone m210 --id m210` | coverage + scored flights + cost vs node count for the standard designs (~1.5 min) |
| `.venv/bin/python -m twin.cost` | print the cost model and write `web/runs/cost_model.json` |
| `.venv/bin/python -m twin.calibrate` | re-fit the calibration to the Fraunhofer trials (~1 min) |
| `.venv/bin/python -m twin.run --relocate` | re-run location/tracking/metrics on saved runs (seconds) |
| `.venv/bin/python -m pytest -q` | 37 physics, antenna, cost, flight, pricing and recommendation tests |
| `.venv/bin/python tools/fetch_site.py --osm-way <id> --id <name> --name "<Facility>"` | fetch another facility (OSM + USGS) |
| `.venv/bin/python tools/fetch_towers.py --site <name>` | real towers near it (FCC; OpenCelliD if a key is set) |

**Web deploy (Vercel):** from `prototype/`, run `vercel` (preview link) and then `vercel --prod`. It serves the viewer
as static files (`vercel.json` redirects `/` to `/web/`); what is left out is in `.vercelignore`. The Hobby plan
caps a CLI upload at 100 MB, so the range-Doppler files (`web/runs/*.bin`, ~250 MB) stay local: every replay still
plays on the web, and only the raw radar view under "Technical details" needs `serve.py`. Running new simulations
also needs `serve.py` (the form disables itself on the web).

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

**Custom 8-channel receiver (Series A):** costed from a parts list in `twin/cost.py` (`CUSTOM_BOM`), shown with a
link per line in the Financials tab. Four 2-channel LMS7002M transceivers, an Artix-7 FPGA streaming over PCIe to the
edge computer, GNSS-disciplined 40 MHz reference, LNA + filter + balun + calibration switch per input. 11 of 16 part
lines are distributor prices (DigiKey, Mini-Circuits, Nov 2026), covering ~$540 of the ~$610 of parts at 1,000 boards;
assembly uses JLCPCB's published rates. Board fabrication, regulators, passives, shields, the PCIe cable, test and the
$400k design cost are ASSUMPTIONS. Result: ~$1,040 per board at 1,000 (~$4,800 at 100, ~$570 at 10,000). Known gaps:
the cheap balun stops at 698 MHz (T-Mobile B71 needs a wideband one), and the FPGA has a 52-week lead time.

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

**v0.4.2, recommendation by radio** (5 kg drone, 60 m up, 150 m around the fence; targets 90 % of the area
covered and 80 % of the time tracked, the slider defaults; fixed build per radio):

- **Hays works today (20 dB).** Cheapest: 4 custom-receiver sensors, $39,600 + $24,200/yr (our cost $23,700 +
  $6,800/yr). With off-the-shelf radios (what Seed can build): 6 bladeRF sensors, $55,100 + $35,800/yr. Four
  custom sensors beat six bladeRF ones because one 8-channel board ($1,042 at 1,000) replaces two bladeRF boards
  plus clock sharing and covers more ground.
- **Hancock is not possible today:** at 20 dB the best is 36 % of the area and 62 % tracked. It needs 40 dB of
  removal (unproven): then 6 bladeRF sensors meet both targets.
- **Fulton is not possible today:** at 20 dB the best is 55 % / 78 %. With 30 dB, 12 custom sensors meet the targets
  ($110,400 + $72,500/yr; off-the-shelf radios cannot); with 40 dB, 4 bladeRF sensors do.
- **B210 never wins:** same performance as the bladeRF, $3,694 more per sensor (2 boards at $2,387 instead of $540).
- **Full simulations (the 12 replays) check the fast estimate.** 5 kg drone: Hays 87 % tracked in both replays (fast
  estimate 84-88 %), Hancock at 40 dB 82-89 % (82-91 %), Fulton 81 % with 12 custom sensors at 30 dB (87 %) but only
  62.5 % with 4 bladeRF sensors at 40 dB (87 %). Mavic: 76-79 % at Hays, but 36-47 % at Hancock and 44-78 % at Fulton
  against 74-88 % estimated. The fast estimate is optimistic at the remote and city sites, more so with few sensors
  or a small drone; treat those recommendations as lower bounds on the sensor count.

**v0.4.1, protection menu** (5 kg drone, 60 m up, 150 m around the fence; recommended = cheapest catching 90 % and
covering 90 %):

- **Hays:** 6 Standard sensors without microphones catch 92 % of drones (99 % of the area) for $54,000 + $35,600/yr;
  cheaper options exist down to 3 sensors at 35-65 % caught. With 40 dB interference removal, 4 Panel-pair sensors suffice.
- **The microphone does not change "drones caught"**: it holds the track during the hover inside the fence, which
  raises time tracked, not the chance of catching the drone before it crosses. The menu therefore often picks the
  version without one; whether guards need the hover track is a question for design partners.
- **Hancock and Fulton at 20 dB:** 16 sensors catch 84 % and 97 % of drones but cover only 36 % and 55 % of the area:
  drones are usually seen somewhere on their approach, but there are large blind areas near the fence. Showing both
  numbers matters. At 40 dB, 3 Long-range sensors (Hancock) and 4 Standard sensors (Fulton) reach the recommended level.
- "Drones caught" comes from 20 scored flights per point, so it moves in steps of about 5 %.

**v0.4, three facilities** (default requirements: drones 60 m up, 150 m around the fence, 90 % of the area
covered, tracked 80 % of the time, within 25 m; 5 kg drone):

- **The type of site decides the architecture, through one assumption: how much interference from neighboring
  cells on the same carrier the processing removes.** At today's assumption (20 dB) only Hays can be covered
  (4 sensors, 8-antenna rings with enhanced processing and microphones, ~$23,700 upfront with the sourced custom-receiver price). At Hancock (remote,
  towers 4+ km away) and Fulton County Jail (city, 52 towers within 5 km), neighboring cells swamp the echoes and
  no design meets the requirements even with 16 sensors.
- **If the processing removes 40 dB** (rebuilding and subtracting each neighbor cell's signal; plausible, unmeasured),
  all three work: Hays 3 sensors (~$18,400 upfront), Hancock 6 sensors (~$33,000), Fulton 4 sensors (~$22,900).
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
- **Off-the-shelf hardware is affordable at Seed.** Costs are estimated by the twin from the sensors a site needs,
  not set as a target in advance. A 4-omni node with a bladeRF xA4 ($540) costs ~$3,000 in parts: ~$9,300 per
  3 sensors, leaving ~70 % of the $50,000 installation price after hardware and deployment. (The data package's
  $24,000 per 3 sensors was a planning figure from before the twin.) With B210s the same node is ~$6,800
  (~$20,400 per 3 sensors). A custom receiver is not needed for cost at Seed; it matters for 8+
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
