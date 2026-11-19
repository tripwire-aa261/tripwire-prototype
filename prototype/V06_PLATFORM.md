# Prototype v0.6 (pivot): platform additions

Branch `pivot-v1`. Run order: `python -m tools.fetch_broadcast` (FCC TV/FM transmitters per site), `python -m tools.broadcast_study`, `python -m tools.platform_demo`. Results: `web/runs/broadcast_study.json`, `web/runs/platform_v06.json`; shown in the viewer's **Platform (v0.6)** tab. Tests: `tests/test_v06.py` (48 tests pass in total).

## 1. Which signal works where (`twin/broadcast.py`)

US digital TV (ATSC, 6 MHz) and FM (200 kHz) as illuminators next to LTE, with the FCC's licensed transmitters (MEASURED, FCC TV/FM Query, fetched 2026-11-18). Same calibrated echo loss and direct-signal cancellation as the LTE model, plus a noise floor held at least 20 dB above thermal (measured ATSC passive radar leaves 6-20 dB: Garry, Baker & Smith, IEEE TGRS 55(7), 2017); a link-budget estimate, not a full signal replay. US TV channels are allotted so that stations sharing a channel are far apart, so TV has far fewer same-frequency neighbours than LTE; some remain (Barott & Himed, IEEE Radar Conf 2015) and ATSC 3.0 single-frequency networks add more. No drone has yet been detected with US digital TV in published work; the evidence is DVB-T, DVB-T2 and DTMB trials in Europe and China (0.2-5 km bistatic). Research notes: `context/research/tv_passive_radar.md`.

**Conservative check:** in the geometry of the published DVB-T drone trial (Martelli et al. 2020: 570 MHz, 50 kW at 22.5 km, Phantom/Mavic detected to 5 km bistatic range), this model detects a Mavic-class drone only to ~0.5 km bistatic range. No extra gain is added.

Zone located (fence + 150 m, drone at 60 m, our own 8-channel receiver):

| Site | Drone | Sensors | Cell 20 dB | Cell 40 dB | Digital TV | FM (detect only) |
|---|---|---|---|---|---|---|
| Hays State Prison | m210 | 6 | 100.0% | 100.0% | 100.0% (~9.1 m) | 100.0% |
| Hays State Prison | mavic | 6 | 79.2% | 87.2% | 98.7% (~20.6 m) | 7.7% |
| Hays State Prison | m210 | 12 | 100.0% | 100.0% | 100.0% (~6.6 m) | 100.0% |
| Hays State Prison | mavic | 12 | 92.0% | 95.6% | 100.0% (~14.1 m) | 16.7% |
| Hancock State Prison | m210 | 6 | 0.0% | 98.8% | 78.0% (~24.7 m) | 98.1% |
| Hancock State Prison | mavic | 6 | 0.0% | 15.0% | 0.0% (~None m) | 0.0% |
| Hancock State Prison | m210 | 12 | 0.8% | 100.0% | 87.4% (~17.6 m) | 100.0% |
| Hancock State Prison | mavic | 12 | 0.0% | 66.7% | 0.0% (~None m) | 0.0% |
| Fulton County Jail | m210 | 6 | 2.1% | 100.0% | 100.0% (~5.1 m) | 100.0% |
| Fulton County Jail | mavic | 6 | 0.0% | 75.2% | 100.0% (~5.3 m) | 85.4% |
| Fulton County Jail | m210 | 12 | 3.5% | 100.0% | 100.0% (~5.0 m) | 100.0% |
| Fulton County Jail | mavic | 12 | 0.0% | 92.2% | 100.0% (~5.1 m) | 94.4% |
| Clemson Memorial Stadium | m210 | 6 | 79.7% | 100.0% | 100.0% (~6.7 m) | 100.0% |
| Clemson Memorial Stadium | mavic | 6 | 51.4% | 97.3% | 100.0% (~17.6 m) | 84.4% |
| Clemson Memorial Stadium | m210 | 12 | 83.8% | 100.0% | 100.0% (~5.8 m) | 100.0% |
| Clemson Memorial Stadium | mavic | 12 | 40.5% | 100.0% | 100.0% (~12.6 m) | 95.8% |

Not modeled yet (Seed measurements): receiver overload next to megawatt transmitters (Fulton is 6 km from an 869 kW station), ATSC 1.0 reference rebuild quality, terrain shadowing beyond the site tile. FM resolves range to ~1.5 km: warning only.

## 2. GPS jammer locator (`twin/gnss_jam.py`)

Sensors also listen on GPS L1; the jammer is located by time difference of arrival, optionally with bearings from the 8-antenna rings (2 deg after calibration, from the DTU trial's 0.5-1 deg). Clocks while jammed: OCXO ~50 ns, chip-scale atomic clock ~5 ns (ASSUMPTIONS). Hays, 6 sensors:

| Jammer | Power | Clock | Method | Sensors that hear it | Median error (m) | Fail |
|---|---|---|---|---|---|---|
| car on a road 300 m from the fence | 10 dBm | ocxo | tdoa | 3 | 396.4 | 0.0% |
| 1 km away | 10 dBm | ocxo | tdoa | 2 | cannot place | 100.0% |
| 2 km away | 10 dBm | ocxo | tdoa | 0 | cannot place | 100.0% |
| car on a road 300 m from the fence | 10 dBm | ocxo | tdoa+aoa | 3 | 19.2 | 0.0% |
| 1 km away | 10 dBm | ocxo | tdoa+aoa | 2 | 147.7 | 11.0% |
| 2 km away | 10 dBm | ocxo | tdoa+aoa | 0 | cannot place | 100.0% |
| car on a road 300 m from the fence | 10 dBm | csac | tdoa | 3 | 395.1 | 0.0% |
| 1 km away | 10 dBm | csac | tdoa | 2 | cannot place | 100.0% |
| 2 km away | 10 dBm | csac | tdoa | 0 | cannot place | 100.0% |
| car on a road 300 m from the fence | 10 dBm | csac | tdoa+aoa | 3 | 8.3 | 0.0% |
| 1 km away | 10 dBm | csac | tdoa+aoa | 2 | 173.2 | 12.0% |
| 2 km away | 10 dBm | csac | tdoa+aoa | 0 | cannot place | 100.0% |
| car on a road 300 m from the fence | 30 dBm | ocxo | tdoa | 6 | 74.0 | 4.0% |
| 1 km away | 30 dBm | ocxo | tdoa | 6 | 273.7 | 46.0% |
| 2 km away | 30 dBm | ocxo | tdoa | 2 | cannot place | 100.0% |
| car on a road 300 m from the fence | 30 dBm | ocxo | tdoa+aoa | 6 | 16.8 | 0.0% |
| 1 km away | 30 dBm | ocxo | tdoa+aoa | 6 | 79.8 | 0.0% |
| 2 km away | 30 dBm | ocxo | tdoa+aoa | 2 | 232.8 | 45.0% |
| car on a road 300 m from the fence | 30 dBm | csac | tdoa | 6 | 8.5 | 0.0% |
| 1 km away | 30 dBm | csac | tdoa | 6 | 64.2 | 0.0% |
| 2 km away | 30 dBm | csac | tdoa | 2 | cannot place | 100.0% |
| car on a road 300 m from the fence | 30 dBm | csac | tdoa+aoa | 6 | 7.5 | 0.0% |
| 1 km away | 30 dBm | csac | tdoa+aoa | 6 | 44.4 | 0.0% |
| 2 km away | 30 dBm | csac | tdoa+aoa | 2 | 234.4 | 51.0% |

Lessons: time differences alone fail when the jammer is outside a small ring of sensors; bearings fix it (10 mW car jammer 300 m out: ~396 m to 8-19 m). The clock matters for TDOA (CSAC vs OCXO). Beyond ~2 km too few perimeter sensors hear a 1 W jammer: standalone GPS networks need sensors spread wider (as the Baltic network does).

## 3. Heat-camera cueing (`twin/thermal.py`)

Johnson criteria (STANDARD), 640-pixel 12 um uncooled camera (ASSUMPTION), upper bounds:

| Drone | 35 mm detect / recognise / identify | 100 mm detect / recognise / identify |
|---|---|---|
| 0.9 kg (Mavic class) | 739 / 185 / 92 m | 2111 / 528 / 264 m |
| 5 kg (Matrice 210 class) | 1711 / 428 / 214 m | 4889 / 1222 / 611 m |

## 4. Contraband drop at Hays, minute by minute (`tools/platform_demo.py`)

From the twin's full signal replay `replay-hays-m210-custom` (Matrice 210 (5 kg, the Fraunhofer trial drone), 4 own-receiver sensors, 20 dB): tracked 86.8% of the time in the zone, 11.8 m median error; **40.5 s of warning before the fence**.

- 42 s, Tripwire: First track, 596 m from the drop point. Alert to the control room and the response team's phones.
- 44 s, Tripwire: Heat camera on the fence turns to the track (2.14 s at 60 deg/s); drone 746 m away.
- 72 s, Control room: Drone recognisable on the heat camera at 416 m (Johnson criteria, 35 mm lens).
- 82 s, Drone: Crosses the fence line.
- 92 s, Drone: Hovers 6 s over the drop point and releases the package.
- 92 s, Response team: Already moving to the drop point it was sent to at the first alert; recovers the package (South Carolina uses a pre-selected facility team; SCDC via Facilities Dive).
- 160 s, Tripwire: Track followed back out of the zone; its heading and the inbound track are kept as evidence and point the sheriff's K-9 team to where the pilot launched (the Georgia DOC pattern: staff alert the sheriff and K-9, who search and arrest).

## 5. 0.9 kg drone (VC question)

Already in the twin's design points (`web/data/explore.json`): at Hays a 0.9 kg drone needs 12 of our own sensors at today's 20 dB (vs 4 for the 5 kg drone); Fulton and Clemson need 40 dB with 12 and 8 sensors; Hancock does not meet the targets with cell towers even at 40 dB. With digital TV (estimate above) Hays, Fulton and Clemson are covered for both drones with 6 sensors; Hancock, 62-79 km from its TV transmitters, is not covered for a 0.9 kg drone.
