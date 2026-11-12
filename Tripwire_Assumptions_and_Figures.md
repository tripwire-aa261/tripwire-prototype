# Tripwire: assumptions and figures behind the prototype

Generated 2026-11-12 from the digital twin by `prototype/tools/build_assumptions_doc.py`. Do not edit the numbers by hand: change them in the twin (mostly `prototype/twin/cost.py`) and re-run the script, so the business plan, the viewer and this file stay consistent. Tags: **CITED** (published source, linked), **MEASURED** (fetched data), **FIT** (calibrated to a trial), **STANDARD** (specification), **ASSUMPTION** (our estimate, to replace with quotes or measurements), **DECISION** (team choice).

Contents: 1 Product and architecture · 2 Hardware per sensor · 3 Custom receiver parts list · 4 Installation · 5 Running costs · 6 Pricing · 7 Company-level costs · 8 What each facility needs and earns · 9 Seed kit · 10 Changes from the Seed data package · 11 Technical assumptions behind the performance · 12 Results that check the model · 13 Open items · 14 Sources

## 1. Product and architecture

- **What is sold:** receive-only sensors on the facility fence that detect drone echoes of signals cell towers already transmit, plus one on-site hub, installation and a yearly service. Nothing is transmitted, so no license is needed.
- **Sensor:** one box on a pole. Antennas, radio boards, an edge computer, a GPS module for time stamps, power and surge protection. The customer provides the pole, power and network at each sensor (as in the Seed data package).
- **Radios (one fixed build each, DECISION Nov 12):**
  - bladeRF 2.0 micro xA4 (Seed): design `ring4_enh_hist`, 4-antenna ring, enhanced processing, hover by background history.
  - USRP B210 (Seed): design `ring4_enh_hist`, 4-antenna ring, enhanced processing, hover by background history.
  - Custom multichannel receiver (Series A): design `ring8_enh_hist`, 8-antenna ring, enhanced processing, hover by background history.
  bladeRF and B210 perform the same in the model (12-bit, 2 channels per board); the B210 only costs more.
- **Hover:** a hovering drone has no Doppler shift and the normal processing drops it. The standard builds hold it in software by *background history* (each sensor learns its quiet scene and looks for a new steady echo where a track stopped; DECISION Nov 12, `twin/hover.py`). Microphone builds remain as the hardware alternative.
- **Compute architecture (Nov 12):** raw samples are too much to send off the pole (4 channels x 15.36 MS/s x 32 bit = ~2 Gbit/s), so each sensor runs the per-antenna processing on an edge GPU board (demodulation, rebuilding the tower signal, range-Doppler maps) and sends compact maps (a few Mbit/s, ASSUMPTION) to **one hub per facility**. The hub tracks, classifies (drone, bird, person, flight mode), keeps the background history and raises alerts; it keeps working without the internet. One internet line per facility carries alerts, health data and updates.
- **Where alerts go:** the facility's control room (on site); a cloud service for dashboards and remote monitoring.

## 2. Hardware per sensor

| Item | Standard, bladeRF | Standard, B210 | Custom receiver | Standard + microphone, bladeRF | Custom + microphone |
|---|---|---|---|---|---|
| Radio board(s) | $1,080.00 | $4,774.00 | $642.00 | $1,080.00 | $642.00 |
| GPS module | $16.22 | $16.22 | — | $16.22 | — |
| Shared clock (2 boards) | $30.00 | $30.00 | — | $30.00 | — |
| Edge computer | $249.00 | $249.00 | $249.00 | $249.00 | $249.00 |
| Antennas | $160.00 | $160.00 | $320.00 | $160.00 | $320.00 |
| Enclosure, power, bracket | $190.00 | $190.00 | $190.00 | $190.00 | $190.00 |
| Lightning arrestors | $100.00 | $100.00 | $200.00 | $100.00 | $200.00 |
| Microphone unit | — | — | — | $25.00 | $25.00 |
| **Total per sensor** | **$1,825** | **$5,519** | **$1,601** | **$1,850** | **$1,626** |

Line by line:

- **bladeRF 2.0 micro xA4:** $540 per board, 2 channels, 12-bit. CITED: Nuand shop listing, Nov 2026 (confirm with a quote). A 4-antenna sensor needs 2 boards.
- **USRP B210:** $2,387 per board, 2 channels, 12-bit. CITED: Ettus board price, data package ref [1]. A 4-antenna sensor needs 2 boards.
- **Custom receiver:** $642.00 per 8-channel board at the 1,000-board planning volume: parts + assembly + test, *without* the design cost (section 3, 7).
- **Edge computer:** $249, NVIDIA Jetson Orin Nano Super developer kit list price (CITED [5]). ASSUMPTION: enough for whole-signal processing of 4 to 8 channels (our estimate: tens of GFLOP/s); benchmark at Seed. Replaced an ASSUMPTION of $800 (two $400 computers). A Raspberry Pi 5 8 GB now lists at about $175-195 after memory price rises (CITED [6]) with less compute, so it is not cheaper.
- **GPS module:** $16.22, u-blox NEO-F10N (CITED, DigiKey; same part as the custom parts list). Only time stamps are needed: each tower-sensor pair measures the echo delay against its own direct tower signal, so a disciplined oscillator (the old $150 ASSUMPTION) is not (ASSUMPTION).
- **Shared clock for 2 boards:** $30 (ASSUMPTION): one 38.4 MHz oscillator ($2.11) and a clock buffer ($3.11), both priced in the custom parts list, plus an adapter board and U.FL cables (~$25). Replaced $350. **Risk:** phase-locking two bladeRF 2.0 micro boards is not a documented feature (Nuand forum, CITED [7]); test at Seed.
- **Omni (dipole / collinear) antenna:** $40 each (ASSUMPTION, typical retail; no reliable cheaper listing found), 2 dBi, 360 deg beam.
- **Patch / flat panel antenna:** $80 each (ASSUMPTION, typical retail; no reliable cheaper listing found), 8 dBi, 70 deg beam.
- **Enclosure, power, bracket:** $190 (ASSUMPTION, typical listings): NEMA 4X polycarbonate box ~$70, 60 W DIN power supply ~$35, pole bracket ~$40, Ethernet surge protector ~$20, internal cables ~$25. Replaced $450.
- **Lightning arrestor:** $25 per antenna cable (ASSUMPTION, generic N-type).
- **Microphone unit (microphone builds only):** $25: 4 x Infineon IM69D130 MEMS microphones at $2.87 (CITED [8]) + small board and acoustic vents (~$13, ASSUMPTION). Replaced $100.

## 3. Custom 8-channel receiver: parts list (Series A)

Architecture (ASSUMPTION): four 2-channel LMS7002M transceivers on one GNSS-disciplined 40 MHz reference, an Artix-7 FPGA that merges the channels and streams them over PCIe to the edge computer, and a switched noise source to calibrate the phase between channels. Prices are distributor prices at the quantity quoted, moved to the planning volume with a volume curve of x0.93 per doubling, never below 50% of the quote (ASSUMPTION).

| Item | Part | Count | Quoted (qty) | Unit at 1,000 | Line | Source |
|---|---|---|---|---|---|---|
| RF transceiver (2 receive channels, 100 kHz-3.8 GHz, 12-bit) | Lime Microsystems LMS7002M | 4 | $127.82 (100) | $100.44 | $401.76 | [CITED: DigiKey, 100-unit tray price, Nov 2026](https://www.digikey.com/en/products/detail/lime-microsystems-ltd/LMS7002M/5012880) |
| FPGA (collects 4 transceivers, PCIe Gen2 to the computer) | AMD Artix-7 XC7A50T-1CSG325C | 1 | $99.56 (1) | $49.78 | $49.78 | [CITED: DigiKey, 1-unit price, Nov 2026 (52-week lead time)](https://www.digikey.com/en/products/result?keywords=XC7A50T-1CSG325C) |
| Low-noise amplifier (one per input, two more for the calibration noise source) | Mini-Circuits PSA4-5043+ (50 MHz-4 GHz, NF 0.75 dB) | 10 | $1.72 (1,000) | $1.72 | $17.20 | [CITED: Mini-Circuits price table, 1,000 units, Nov 2026](https://www.minicircuits.com/WebStore/dashboard.html?model=PSA4-5043%2B) |
| Band filter (rejects out-of-band strong signals) | Mini-Circuits LFCN-900+ low-pass, DC-850 MHz | 8 | $1.52 (1,000) | $1.52 | $12.16 | [CITED: Mini-Circuits price table, 1,000 units, Nov 2026](https://www.minicircuits.com/WebStore/dashboard.html?model=LFCN-900%2B) |
| Balun (single-ended antenna to differential transceiver input) | TDK HHM1944A4 (698-960 MHz) | 8 | $0.22 (1) | $0.11 | $0.88 | [CITED: DigiKey, 1-unit price ($0.094 at 10,000), Nov 2026. Does not cover T-Mobile B71 (617-652 MHz): a wideband balun such as Mini-Circuits TCM1-83X+ is $8.68 at 1,000](https://www.digikey.com/en/products/detail/tdk/HHM1944A4/15217744) |
| Calibration switch (antenna or noise source, per input) | Infineon BGS12WN6 SPDT, 50 MHz-9 GHz | 8 | $0.14 (1,000) | $0.14 | $1.12 | [CITED: DigiKey, 1,000-unit price, Nov 2026](https://www.digikey.com/en/products/detail/infineon-technologies/BGS12WN6E6327XTSA1/11500249) |
| Reference oscillator, GNSS-disciplined | Taitien TXEAACSANF-40.000000 VCTCXO, 40 MHz, +/-0.5 ppm | 1 | $2.11 (500) | $1.96 | $1.96 | [CITED: DigiKey, 500-unit price, Nov 2026](https://www.digikey.com/en/products/detail/taitien/TXEAACSANF-40-000000/6127601) |
| Clock fan-out (reference to 4 transceivers + FPGA) | TI CDCLVC1104PWR, 1:4 buffer | 2 | $3.11 (500) | $2.89 | $5.78 | [CITED: DigiKey, 500-unit price, Nov 2026](https://www.digikey.com/en/products/result?keywords=CDCLVC1104PWR) |
| GNSS receiver (frequency discipline, frame time stamps) | u-blox NEO-F10N-00B | 1 | $16.22 (1) | $8.11 | $8.11 | [CITED: DigiKey, 1-unit price, Nov 2026. ASSUMPTION: navigation grade is enough because each node measures echo delay against the tower's direct signal; timing grade (u-blox ZED-F9T-00B) is $163.60 at 250](https://www.digikey.com/en/products/detail/u-blox/NEO-F10N-00B/21363346) |
| Power management IC (4 outputs) | TI TPS65400RGZR | 1 | $4.66 (250) | $4.03 | $4.03 | [CITED: DigiKey, 250-unit price, Nov 2026](https://www.digikey.com/en/products/result?keywords=TPS65400RGZR) |
| Low-noise regulators for the RF and clock supplies | about 6 low-noise LDOs | 1 | $8.00 (1,000) | $8.00 | $8.00 | ASSUMPTION |
| RF connectors (antenna inputs + GNSS) | Amphenol RF 132134 SMA jack | 9 | $7.30 (1) | $3.65 | $32.85 | [CITED: DigiKey, 1-unit price, Nov 2026](https://www.digikey.com/en/products/detail/amphenol-rf/132134/1011907) |
| PCIe link to the edge computer (M.2 connector and cable) | M.2 / PCIe cable assembly | 1 | $15.00 (1,000) | $15.00 | $15.00 | ASSUMPTION |
| Passives, configuration flash, ESD protection, small ICs | about 400 parts | 1 | $25.00 (1,000) | $25.00 | $25.00 | ASSUMPTION |
| RF shield cans | one per transceiver + front end | 1 | $8.00 (1,000) | $8.00 | $8.00 | ASSUMPTION |
| Bare board: 8-layer, controlled impedance, about 120 x 100 mm | PCB fabrication | 1 | $20.00 (1,000) | $20.00 | $20.00 | [ASSUMPTION (needs a quote). Reference: a 6-layer 100 x 80 mm impedance board is about $8.50-9.50 at JLCPCB (AtlasPCB estimate, 2026)](https://www.atlaspcb.com/blog/jlcpcb-vs-custom-pcb-manufacturer-production-volume-cost-2026/) |

- Parts $611.63 (11 of 16 lines cited, covering $535.63); SMT assembly and X-ray $5.37 (CITED: JLCPCB assembly price page (Nov 2026); joint count ASSUMPTION); test and phase calibration $25.00 (ASSUMPTION).
- **Per board: $642.00** at 1,000 boards; $805.30 at 100; $530.62 at 10,000 (parts volume only).
- **Design cost (NRE): $400,000 one-time** (ASSUMPTION): engineering, 2-3 prototype rounds, test equipment, FCC Part 15 and safety/outdoor testing. Kept **out of the board price** (DECISION Nov 12): it is a company cost paid from Series A funds and recovered from gross profit across facilities (section 7), so the board count does not change any price. It is the least supported number in this section; cost it bottom-up (engineer-months x rate, prototype rounds, a certification lab quote).

## 4. Installation (one-time)

| Item | Value | Basis |
|---|---|---|
| Technician hours per sensor | 6 h | ASSUMPTION: 2 technicians x 3 h; factory-configured sensor on an existing pole (was 16 h) |
| Labor rate (loaded) | $60/h | BLS median $28.88/h for security and fire alarm system installers (OEWS May 2025, SOC 49-2098; CITED [9]), about doubled for benefits, payroll taxes, overhead, vehicle and travel time (ASSUMPTION multiplier ~2.1). Was $95/h |
| Mounting and cabling per sensor | $150 | ASSUMPTION: outdoor Ethernet run, conduit fittings, connectors (was $480) |
| Pole, power, network per sensor | $0 | Customer provides (Seed data package) |
| **Per sensor** | **$510** | was $2,000 |
| Site set-up per facility | $2,500 | ASSUMPTION: radio survey of the towers, calibration, software set-up |
| On-site hub per facility | $500 | N100 mini PC: terminalbytes.com/raspberry-pi-5-vs-n100-mini-pc-2026 (Oct 2026); UPS ASSUMPTION |

## 5. Running costs (per year)

| Item | Value | Basis |
|---|---|---|
| Service visits | 1 per year, 2 h per sensor | ASSUMPTION: health is monitored remotely; one inspection and cleaning visit (was 8 h) |
| Spare parts | 5% of hardware | ASSUMPTION: solid-state electronics (was 10%) |
| Network per sensor | $0/month | Sensors reach the hub over the facility network (was a $25/month cellular plan each) |
| Software per sensor | $60/yr | ASSUMPTION: updates and monitoring (was $300) |
| Internet line per facility | $50/month | ASSUMPTION: one business line from the hub |
| Cloud per facility | $600/yr | ASSUMPTION: hosting, alert delivery, dashboards |
| **Example: standard bladeRF sensor ($1,825 hardware)** | **$271/yr per sensor + $1,200/yr per facility** | was about $1,600/yr per sensor |

## 6. Pricing

- **Margins: 40% on installation and 40% on the subscription** (DECISION Nov 12; was 40% / 72%, which reproduced the data package's planning prices). Margin = share of the price left after our cost: price = cost / (1 - margin).
- **Contract length:** 5 years (memo).
- **Three pricing models** (the viewer's Financials tab has all three):
  1. *Cost + margin, installation + subscription* (default): installation price = upfront cost / 0.6; subscription = running cost / 0.6. This is the **floor**: the lowest price that keeps a 40% margin on every facility.
  2. *Cost + margin, all-in yearly fee*: nothing upfront; yearly fee = (upfront cost repaid over the contract at 10%/yr cost of capital, ASSUMPTION + running cost) / 0.6. Fits an operating budget; we carry the hardware and wait longer to be repaid.
  3. *Value-based*: our own price per facility, defaulting to the data package's planning prices: $50,000 installation + $18,000/yr (CITED, Seed data package).
- **Today's alternatives (CITED, data package):** Axon hardware + installation $57,915 [3]; AirSight subscription $9,071-$42,143/yr [4] ($45,355-$210,715 over 5 years).
- **Like-for-like comparison: a customer's cost for one facility over the contract** (shown in the viewer's "Compared with today's options"):
  - *Radar-based system* (e.g. AirSight): 3-5 compact radars (ASSUMPTION; each sees ~120 deg, CITED Echodyne EchoGuard [12]) x $30,000-$80,000 each, hardware only (CITED AirSight radar guide, (c) 2026 [13]) x (1 + 30-60% installation, survey, calibration, training and integration, CITED AirSight cost guide [14]) = $117,000-$640,000 upfront, + 5 x the AirSight packages = **$162,355-$850,715**.
  - *One Robin IRIS 360 deg radar alone:* $396,000 (Dedrone price list on OMNIA Partners, AM9, 2025-02-04 [15]: seen in a search result; the file is no longer public, so confirm). The same list showed RF-160/RF-360 sensors at $14,850 and RF-560 at $29,700.
  - *RF-only Dedrone (Axon):* $57,915, hardware + installation, no software (data package ref [3]).
  - *Tripwire at Hays* (6 bladeRF sensors): $51,915 at cost + 40%; $140,000 at the data package's prices.
- **Recommendation (reasoning, to test with design partners):** a fixed yearly subscription per facility, priced from value and anchored below the alternatives, with cost + 40% as the floor; offer the all-in fee for agencies that buy services more easily than equipment. Not on-demand or per-alert: protection must be on all the time, a per-alert bill rises exactly when the facility is under attack, and false alarms would become billing disputes. Per-use add-ons fit (evidence packages for prosecutions, short deployments for events).

## 7. Company-level costs

- **Custom receiver design cost (NRE):** $400,000 one-time, Series A (ASSUMPTION; section 3).
- **Company running cost:** $1,000,000/yr (ASSUMPTION: team, office, sales, insurance; editable in the viewer).
- **Gross profit per facility** = what the customer pays over the contract minus our upfront and running costs. Facilities needed to cover the company's running cost = running cost per year / gross profit per facility per year. Facilities to repay the NRE = NRE / gross profit per facility over the contract.

## 8. What each facility needs and earns

Recommended setup = the radio and number of sensors with the lowest cost to us that covers 90% of the area within 150 m of the fence, tracks a drone 80% of the time, places it within 25 m and first tracks the typical incoming drone at least 300 m outside the fence (DECISION: viewer slider defaults), drones 60 m up, 5 kg drone. Results from `web/data/explore.json` (created 2026-11-12T06:38:19). Sensors spaced evenly on the fence.

| Facility | Interference removal | Radio | Sensors | Area / tracked / caught / accuracy / detection range (typical; 8 in 10) | Our cost (upfront + yearly) | Price at cost + 40% | Gross profit/yr at cost + 40% (facilities to cover $1M/yr) | Gross profit/yr at data-package prices (facilities) | Gross margin at data-package prices |
|---|---|---|---|---|---|---|---|---|---|
| Hancock State Prison (sparse towers) | 20 dB | bladeRF 2.0 micro xA4 | not possible | best 0% / 7% (16 sensors) |  |  |  |  |  |
| Hancock State Prison (sparse towers) | 20 dB | Custom multichannel receiver | not possible | best 2% / 11% (16 sensors) |  |  |  |  |  |
| Hancock State Prison (sparse towers) | 30 dB | bladeRF 2.0 micro xA4 | not possible | best 50% / 55% (16 sensors) |  |  |  |  |  |
| Hancock State Prison (sparse towers) | 30 dB | Custom multichannel receiver | not possible | best 84% / 84% (16 sensors) |  |  |  |  |  |
| Hancock State Prison (sparse towers) | 40 dB | bladeRF 2.0 micro xA4 | 12 | 98% / 99% / 100% / 7 m / 1075 m; 550 m | $31,023 + $4,455/yr | $51,704 + $7,425/yr | $7,106 (141) | $17,340 (58) | 62% |
| Hancock State Prison (sparse towers) | 40 dB | Custom multichannel receiver | 6 | 99% / 95% / 97% / 8 m / 418 m; 274 m | $15,666 + $2,760/yr | $26,110 + $4,601/yr | $3,929 (255) | $22,106 (46) | 79% |
| Hays State Prison (moderate towers) | 20 dB | bladeRF 2.0 micro xA4 | 6 | 99% / 89% / 91% / 10 m / 442 m; 49 m | $17,011 + $2,828/yr | $28,352 + $4,713/yr | $4,153 (241) | $21,770 (46) | 78% |
| Hays State Prison (moderate towers) | 20 dB | Custom multichannel receiver | 4 | 100% / 85% / 89% / 11 m / 497 m; 31 m | $11,444 + $2,240/yr | $19,073 + $3,734/yr | $3,019 (332) | $23,471 (43) | 84% |
| Hays State Prison (moderate towers) | 30 dB | bladeRF 2.0 micro xA4 | 6 | 99% / 91% / 92% / 10 m / 442 m; 51 m | $17,011 + $2,828/yr | $28,352 + $4,713/yr | $4,153 (241) | $21,770 (46) | 78% |
| Hays State Prison (moderate towers) | 30 dB | Custom multichannel receiver | 4 | 100% / 87% / 90% / 11 m / 501 m; 33 m | $11,444 + $2,240/yr | $19,073 + $3,734/yr | $3,019 (332) | $23,471 (43) | 84% |
| Hays State Prison (moderate towers) | 40 dB | bladeRF 2.0 micro xA4 | 4 | 98% / 91% / 94% / 9 m / 313 m; 54 m | $12,341 + $2,285/yr | $20,568 + $3,808/yr | $3,169 (316) | $23,247 (44) | 83% |
| Hays State Prison (moderate towers) | 40 dB | Custom multichannel receiver | 3 | 100% / 91% / 93% / 8 m / 433 m; 47 m | $9,333 + $1,980/yr | $15,555 + $3,300/yr | $2,565 (390) | $24,153 (42) | 86% |
| Fulton County Jail (dense towers) | 20 dB | bladeRF 2.0 micro xA4 | not possible | best 13% / 20% (16 sensors) |  |  |  |  |  |
| Fulton County Jail (dense towers) | 20 dB | Custom multichannel receiver | not possible | best 33% / 36% (16 sensors) |  |  |  |  |  |
| Fulton County Jail (dense towers) | 30 dB | bladeRF 2.0 micro xA4 | not possible | best 80% / 75% (16 sensors) |  |  |  |  |  |
| Fulton County Jail (dense towers) | 30 dB | Custom multichannel receiver | 12 | 93% / 82% / 99% / 12 m / 1154 m; 502 m | $28,332 + $4,321/yr | $47,220 + $7,201/yr | $6,658 (151) | $18,013 (56) | 64% |
| Fulton County Jail (dense towers) | 40 dB | bladeRF 2.0 micro xA4 | 6 | 100% / 97% / 100% / 8 m / 395 m; 194 m | $17,011 + $2,828/yr | $28,352 + $4,713/yr | $4,153 (241) | $21,770 (46) | 78% |
| Fulton County Jail (dense towers) | 40 dB | Custom multichannel receiver | 4 | 100% / 96% / 99% / 5 m / 382 m; 206 m | $11,444 + $2,240/yr | $19,073 + $3,734/yr | $3,019 (332) | $23,471 (43) | 84% |

20 dB of interference removal is today's assumption; 30 and 40 dB are unproven (section 11). The custom receiver is a Series A product.

## 9. Seed kit (recordings and first trial)

- 3 standard bladeRF sensors: $5,476 of hardware ($1,825 each) + hub $500 = **$5,976** before supplier quotes; installation at the rates above $4,030.
- Seed tests that decide the product: interference removal (20 vs 30-40 dB), whole-signal processing gain, background stability for the hover (-30 dB or better), two-board bladeRF phase lock, Jetson processing capacity.

## 10. Changes from the Seed data package's planning figures

| Figure | Data package | Prototype now | Why |
|---|---|---|---|
| Hardware per 3 sensors | $24,000 | $5,476 | Parts priced bottom-up (section 2) |
| Deployment per 3 sensors | $6,000 | $1,530 + $3,000 per facility | Labor and cabling re-estimated (section 4); hub added |
| Maintenance per 3 sensors per year | $5,000 | $2,014 | Remote monitoring, one internet line per facility (section 5) |
| Installation price | $50,000 | cost + 40% = $16,676 (3 sensors) | Cost + margin floor; value-based model keeps $50,000 |
| Subscription per year | $18,000 | cost + 40% = $3,356 (3 sensors) | Same |
| Margins | 40% install / 72% subscription (implied) | 40% / 40% | DECISION Nov 12 |
| Pricing unit | per 3-node zone | per facility, sized to the sensors it needs | Zones made Hays ~4x the incumbent (v0.3) |

## 11. Technical assumptions behind the performance

- **Calibration (FIT):** lumped loss 28.12 dB and direct-signal cancellation depth fitted to the Fraunhofer LTE450 trials (Demissie & Steffes 2025, Fig. 11: 5 kg drone detected to ~1,600 m; Table 1: Pd ~83%). The only independent trial data used; no independent check yet.
- **Drones (ASSUMPTION radar sizes; only ratios matter after calibration):** Mini (<250 g, DJI Mini class): 0.003 m²; Mavic-class (0.9 kg): 0.01 m²; Matrice 210 (5 kg, the Fraunhofer trial drone): 0.1 m²; Heavy-lift (1.2 m, 10+ kg): 0.3 m².
- **Interference removal from neighboring cells on the same frequency:** 20 dB default (today's assumption), 30 and 40 dB unproven. Decides whether the sparse-tower (Hancock) and dense-tower (Fulton) sites work at all.
- **Whole-signal processing gain:** +11.9 dB at 30% network load over the reference-only method (ideal gain, ASSUMPTION; STANDARD resource counts, TS 36.211).
- **Background stability (hover hold):** -30 dB default (ASSUMPTION); needs about -30 to -40 dB; listening up to 4.8 s on a stopped track. Microphone range 100 m (ASSUMPTION).
- **Fast estimate:** chain loss 5 dB (FIT to 7 full-simulation runs); 20 scored flights per design point.
- **Detection range:** distance outside the fence when the track that guards see begins (held for 3 updates), only before the drone crosses the fence; drones never tracked count as 0 m. The requirement uses the typical drone (median over 20 flights x 16 draws, DECISION Nov 12); the 8-in-10 figure is reported alongside. Flights start 1,800 m from the drop point from random directions. At Hays drones arriving from the south-southwest (bearings ~180-230 deg, along the line between the southern towers and the sensors) are picked up only ~50-300 m out even with 16 sensors, so the 8-in-10 range is much shorter than the typical one; sensor placement is the likely fix.
- **Processing:** listening time per update 0.8 s, one update every 1.5 s, 12-bit radios, network 30% busy (ASSUMPTION), false-alarm rate 1e-06 per cell (ASSUMPTION).
- **Sensors:** 6 m mast (ASSUMPTION; see section 12 for 15 and 25 m), evenly spaced on the fence.
- **Towers:** positions and heights MEASURED (FCC); sector directions, power and channels ASSUMPTION (EIRP 60 dBm, 4 deg downtilt).

All model parameters with their tags. *Code default* is the generic default in `twin/config.py`; *used* is what the explorer runs for the standard bladeRF build at the default targets (sensor count and interference level vary per design point):

| Parameter | Code default | Used | Meaning | Tag / source |
|---|---|---|---|---|
| n_listeners | 6 | 6 | Listener nodes on the fence line | design choice |
| rx_gain_dbi | 5.0 | 5.0 | Antenna gain toward every direction (only for antenna = iso, the v0.2 model) | ASSUMPTION |
| rx_elements | 1 | 4 | Antenna elements per node | design choice; the Fraunhofer validation trial used 4 Yagis |
| antenna | patch | omni | Element type: gain, beamwidths, front-to-back (antenna.py) | ASSUMPTION: typical datasheet values |
| faces | 1 | 1 | Directions a node's elements are split over; elements per face are combined coherently (+10 log10 of elements per face) | design choice |
| pointing | inward | inward | inward: face the middle of the facility; auto: turn each node (up to 90 deg) to maximise detections over the zone | design choice |
| processing | crs_p0 | full | Which LTE resource elements are used (crs_p0 = Fraunhofer method) | crs_p0 CITED; gains of crs_all and full ASSUMPTION (TS 36.211 resource counts) |
| mic_range_m | 0.0 | 0.0 | Acoustic detection range per node (optional microphone) | ASSUMPTION |
| hover_history | False | True | Hold a stopped (hovering) track by background history: compare each distance bin with its learned quiet level | design choice (hover.py) |
| background_stability_db | -30.0 | -30.0 | Leftover of the static background after subtracting its learned history (-40 dB = echoes steady to ~1 %) | ASSUMPTION: to be measured on Seed recordings; tools/hover_feasibility.py |
| hover_dwell_s | 4.8 | 4.8 | Longest listening time on a stopped track | ASSUMPTION |
| nf_db | 6.0 | 6.0 | Receiver noise figure | ASSUMPTION (typical SDR front end) |
| adc_bits | 12 | 12 | ADC resolution | CITED: USRP B210 = 12 bit (Ettus); KrakenSDR/RTL = 8 bit |
| adc_backoff_db | 12.0 | 12.0 | ADC headroom for OFDM peaks | ASSUMPTION |
| mast_m | 6.0 | 6.0 | Listener mast height | ASSUMPTION |
| cit_s | 0.5 | 0.8 | Coherent integration time | CITED: 0.8 s in Demissie & Steffes 2025; default 0.5 s (ASSUMPTION, manoeuvring drone) |
| pfa | 1e-06 | 1e-06 | False-alarm probability per range-Doppler cell (CFAR) | ASSUMPTION |
| dpc_rank | 1 | 1 | Singular components removed (direct path + static clutter) | CITED: SVD method, Demissie & Steffes 2025 eq. 13 |
| max_illuminators | 6 | 6 | LTE cells processed per node | ASSUMPTION (receiver channel budget) |
| cochannel_suppression_db | 20.0 | 20 | Suppression of same-carrier neighbour cells (spatial + known-CRS cancellation) | ASSUMPTION |
| network_load | 0.3 | 0.3 | Share of LTE data resource elements in use (drives co-channel leakage) | ASSUMPTION |
| max_range_m | 3000.0 | 3000.0 | Largest bistatic range processed | below the 3.33 km CRS ambiguity (STANDARD) |
| eirp_dbw | 30.0 | 30.0 | LTE sector EIRP (10 MHz) | ASSUMPTION: 60 dBm (46 dBm + 15 dBi - 1 dB) |
| downtilt_deg | 4.0 | 4.0 | Sector downtilt | ASSUMPTION |
| antenna_height_fraction | 0.9 | 0.9 | Antenna height / structure height | ASSUMPTION; structure heights MEASURED (FCC ASR) |
| max_tower_km | 10.0 | 10.0 | Towers considered | MEASURED positions (FCC ASR) |
| drone | mavic | m210 | Drone model | see DRONES; RCS values ASSUMPTION |
| altitude_agl_m | 60.0 | 60 | Drone height above ground | scenario |
| speed_mps | 12.0 | 12.0 | Drone speed | scenario |
| hover_s | 6.0 | 6.0 | Hover time over the drop point | scenario |
| bird | True | False | Add a crow-sized bird | scenario |
| ground_gamma | 0.7 | 0.7 | Ground reflection coefficient magnitude | ASSUMPTION (rough ground, horizontal pol.) |
| vegetation_fraction | 0.3 | 0.3 | Share of clutter that moves (wind-blown trees) | ASSUMPTION |
| vegetation_spread_hz | 1.5 | 1.5 | Doppler spread of moving clutter | ASSUMPTION |
| zone_buffer_m | 150.0 | 150 | Protected zone = fence + buffer | CITED: memo release gate, 150 m |
| frame_dt_s | 1.5 | 1.5 | Time between processed frames | run setting |
| lumped_loss_db | None | 28.12 | Calibrated lumped loss (echo only) | fit to Demissie & Steffes 2025, Fig. 11 + Table 1 (calibration.json) |
| dpi_residual_db | None | 90.0 | Direct-signal cancellation depth: leftover sits this far below the direct signal | fit to Demissie & Steffes 2025, Fig. 11 + Table 1 (calibration.json) |

## 12. Results that check the model

**Full signal simulations vs the fast estimate** (12 replays; microphone builds; time tracked):

| Replay | Sensors | Interference removal | Fast estimate | Full simulation |
|---|---|---|---|---|
| hays-m210-ots | 6 | 20 dB | 88% | 87% |
| hays-m210-custom | 4 | 20 dB | 84% | 87% |
| hays-mavic-ots | 16 | 40 dB | 89% | 76% |
| hays-mavic-custom | 12 | 20 dB | 90% | 79% |
| hancock-m210-ots | 6 | 40 dB | 82% | 82% |
| hancock-m210-custom | 6 | 40 dB | 91% | 89% |
| hancock-mavic-ots | 16 | 40 dB | 74% | 36% |
| hancock-mavic-custom | 16 | 40 dB | 84% | 47% |
| fulton-m210-ots | 4 | 40 dB | 87% | 62% |
| fulton-m210-custom | 12 | 30 dB | 87% | 81% |
| fulton-mavic-ots | 16 | 40 dB | 88% | 44% |
| fulton-mavic-custom | 12 | 40 dB | 87% | 78% |

The fast estimate (used for every recommendation) is optimistic at the sparse- and dense-tower sites, more so with few sensors or the small drone: treat those sensor counts as lower bounds.

**Hover hold and pole height** (`tools/hover_feasibility.py`; hover points located by background history at each stability; moving-drone coverage; vertical error of a hovering drone):

| Setup | Pole | Moving drone located | Hover: -30 dB | Hover: -40 dB | Background vs drone | Height error |
|---|---|---|---|---|---|---|
| hays 6 x ring4 @20 dB | 6 m | 100% | 71% | 98% | +20 dB | 19 m |
| hays 6 x ring4 @20 dB | 15 m | 99% | 51% | 99% | +22 dB | 23 m |
| hays 6 x ring4 @20 dB | 25 m | 100% | 32% | 99% | +22 dB | 30 m |
| hancock 6 x ring4 @40 dB | 6 m | 92% | 93% | 100% | +23 dB | 14 m |
| hancock 6 x ring4 @40 dB | 15 m | 97% | 65% | 100% | +26 dB | 17 m |
| hancock 6 x ring4 @40 dB | 25 m | 88% | 59% | 100% | +25 dB | 21 m |
| fulton 4 x ring4 @40 dB | 6 m | 99% | 100% | 100% | +18 dB | 5 m |
| fulton 4 x ring4 @40 dB | 15 m | 50% | 80% | 100% | +22 dB | 10 m |
| fulton 4 x ring4 @40 dB | 25 m | 61% | 83% | 100% | +22 dB | 8 m |
| fulton 12 x ring8 @30 dB | 6 m | 92% | 100% | 100% | +17 dB | 5 m |
| fulton 12 x ring8 @30 dB | 15 m | 11% | 91% | 100% | +17 dB | 8 m |
| fulton 12 x ring8 @30 dB | 25 m | 17% | 94% | 97% | +19 dB | 7 m |

Taller poles do not help: at the dense-tower site they see over the buildings into more interference, and they make it harder to tell a drone from a person beneath it. Keep sensors low (~6 m) unless a site survey says otherwise.

## 13. Open items (replace assumptions with quotes or measurements)

- Supplier quotes for the Seed kit: bladeRF, antennas, enclosure, power, arrestors, Jetson, hub.
- Bottom-up NRE estimate for the custom receiver and a certification lab quote.
- Benchmark the Jetson on whole-signal processing of 4 and 8 channels.
- Show phase lock between two bladeRF micro boards (or choose a 4-channel coherent radio).
- Measure interference removal and background stability on Seed recordings (city site, several hours).
- Field installation time and loaded labor rate from an installer quote.
- Company running cost per year for the business plan (team, office, sales, insurance).
- Pricing: test value-based subscription levels and the all-in fee with design partners; how prisons buy (capital vs service budgets).
- Recalibrate the fast estimate at the sparse- and dense-tower sites against full simulations.

## 14. Sources

- [1] Seed Pitch Data Package (team draft): USRP B210 price and planning prices — `Your Seed Pitch Data Package and Prototype.pdf`
- [2] Nuand bladeRF 2.0 micro xA4 listing — https://www.nuand.com/
- [3] Axon hardware + installation configuration — data package ref [3]
- [4] AirSight annual subscriptions — data package ref [4]
- [5] NVIDIA Jetson Orin Nano Super Developer Kit ($249) — https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/nano-super-developer-kit/
- [6] Raspberry Pi 5 and N100 mini PC prices, Oct 2026 — https://terminalbytes.com/raspberry-pi-5-vs-n100-mini-pc-2026/
- [7] Nuand forum, bladeRF micro phase coherency — https://nuand.com/forums/viewtopic.php?t=5004
- [8] DigiKey, Infineon IM69D130 — https://www.digikey.com/en/products/detail/infineon-technologies/IM69D130V01XTSA1/8030732
- [9] BLS OEWS, Security and Fire Alarm Systems Installers (49-2098) — https://www.bls.gov/oes/2023/may/oes492098.htm; May 2025 median $28.88/h as reported by https://nuecareer.com/careers/security-and-fire-alarm-systems-installer (confirm on the current BLS page)
- [10] Demissie & Steffes, Drone Detection With a LTE450-Based Passive Radar, IET Radar, Sonar & Navigation 19:e70092 (2025)
- [11] Custom receiver parts: DigiKey and Mini-Circuits listings linked in section 3; JLCPCB assembly prices — https://jlcpcb.com/help/article/pcb-assembly-price
- [12] Echodyne EchoGuard, 120 deg x 80 deg field of view — https://www.echodyne.com/newsroom/what-is-a-low-swap-radar; hover detection ranges in https://www.trade.gov/sites/default/files/2024-08/ECHODYNE.pdf
- [13] AirSight drone detection radar guide (single FMCW unit $30K-$80K, hardware only; undated, (c) 2026) — https://www.airsight.com/blog/drone-detection-radar-guide
- [14] AirSight drone detection system cost guide (installation, survey, calibration, training, software and maintenance add 30-60% to hardware; undated, (c) 2026) — https://www.airsight.com/blog/drone-detection-system-cost
- [15] OMNIA Partners, Axon/Dedrone price list AM9 (2025-02-04), Robin Iris radar $396,000 — https://www.omniapartners.com/suppliers-files/A-D/Axon/Contract_Documents/3544-21-4615/3544-21-4615_AM9_Axon_2025_02_04.pdf (now redirects to a login; figure from a search-result snippet)
