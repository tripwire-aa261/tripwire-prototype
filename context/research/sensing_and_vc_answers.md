# Sensing evidence and answers to the VC questions: research notes (2026-11-18)

Gathered by a research subagent. [P] primary/peer-reviewed, [G] government, [V] vendor claim, [N] news, [L] low quality. Some numbers were read from PDFs, the BLS API or search snippets because pages blocked fetching. Open the URL before citing.

## A1. Passive radar against small drones, by signal source
- **LTE (Fraunhofer FKIE, LTE450, 2025)** [P]: DJI M210 (~5 kg, ~88 cm) detected surely at ~500 m bistatic single-channel, out to ~1,600 m at Pfa 1e-4; multichannel with eNodeBs 9.6 and 10.8 km away, drone at 30 m, detected for most of the path. Authors: operational need is detection within at least 1 km. https://ietresearch.onlinelibrary.wiley.com/doi/full/10.1049/rsn2.70092 (PDF https://publica-rest.fraunhofer.de/server/api/core/bitstreams/7eda759d-5477-4a8e-b6e8-a0377bc4a7c5/content). This is our twin's calibration trial.
- **5G**: Lodz Univ. of Technology 2022, DJI M600 Pro at ~3.44 GHz, first 5G passive-radar drone detection; range not extracted. [P] https://www.mdpi.com/2072-4292/14/23/6146 ; NIST 2025 base-station-as-radar simulation: ~16% detection at 25 m dense urban. [P] https://arxiv.org/html/2505.24763v1
- **DVB-T (Sapienza/Leonardo AULOS, 2020)** [P]: 570 MHz, 50 kW transmitter 22.5 km away; DJI Phantom 4 Pro and Mavic Pro detected from 1.6 to 5 km bistatic; Mavic 100% over 50 scans at short range. https://iris.uniroma1.it/retrieve/handle/11573/1390033/1416621/Martelli_Post-print_DVB-T-based_2020.pdf
- **DTMB**: Phantom 4 to 2.25 km (emitters 7.5 km). **DVB-T2**: Phantom 3, F450 at 750-900 m (emitter 49.2 km). **DVB-T, Parrot AR.Drone (15 cm)**: 250 m bistatic, 100 kW emitter 45 km away. https://publications.sto.nato.int/publications/STO%20Meeting%20Proceedings/STO-MP-MSG-SET-183/MP-MSG-SET-183-13.pdf **DAB+**: Skywalker X-8 to 1.2 km (36% detection); **DAB**: DJI S900 to 2.6 km, F550 to 750 m. (From the Fraunhofer 2025 review.) Caveat: vertically polarized DVB-T reflects weakly off carbon rotors.
- **FM**: no peer-reviewed small-drone experiment found; ~3 m wavelength judged poor for quadcopters. Thales Ground Alerter 100 (FM + DVB-T) claims drone alerts, no range. [V] https://www.btsl-india.co.in/assets/upload/PassiveRadar.pdf
- **DVB-S**: forward-scatter feasibility on a quadcopter (2020), no range. [P] https://www.mdpi.com/2072-4292/12/18/3075 ; https://ieeexplore.ieee.org/document/9114795
- **Starlink/LEO**: Wuhan 2024 forward-scatter Phantom 4 Pro with rotor signature (press only, range not found) [N] https://www.theregister.com/2024/09/17/china_starlink_stealth/ ; peer-reviewed LEO work is on imaging/suitability, not drones [P] https://ietresearch.onlinelibrary.wiley.com/doi/full/10.1049/rsn2.12446 . Treat as R&D.
- **Commercial**: Hensoldt TwInvis FAA demo 2023 was air traffic, not drones [V] https://www.hensoldt.net/news/twinvis-passive-radar-faa-demonstration ; Silentium Defence MAVERICK M8 (FM/UHF) marketed for counter-drone, vendor claims small drones at 3-7 km, trialled at Trident Spectre 2024 (USSOCOM) [V] https://www.nationaldefensemagazine.org/articles/2023/3/28/passive-radar-can-give-soldiers-stealth-in-urban-battlegrounds ; https://silentiumdefense.com/mission/counter-uas/

## A2. Heat cameras
- Low-cost FLIR Lepton detected a Phantom 4 at only ~51 m on average (Univ. of Zagreb 2017). [P via snippet] https://www.sciencedirect.com/science/article/pii/S2352146517311043
- Theory: 0.5 m drone, 640-pixel cooled sensor, 100 mm lens ~3.3 km detection; identification ~1/4-1/5 of that. [L] https://obraz.in/defending-the-sky-in-six-pixels-the-physics-of-optical-counter-uas/
- Slew-to-cue: FLIR Ranger R8SS-3D radar (3 km) cues a Ranger HDC MR thermal camera; requirement 100% classification at 500 m (Sweden, 2022). [V] https://www.flir.com/en-ca/discover/security/teledyne-flir-helps-to-keep-airspace-surrounding-swedish-critical-infrastructure-free-of-drones/
- Price: Axis Q8752-E Mk II bispectral PTZ $32,138 at one dealer. [L] https://silarius.com/products/axis-communications-q8752-e-outdoor-ptz-network-bispectral-bullet-camera-35mm-thermal-lens-30-fps
- Hikvision/Hikmicro is on the FCC Covered List (NDAA §889 federal ban) [G] https://www.fcc.gov/supplychain/coveredlist (agent's knowledge; verify).

## B3. What happens after an alert
- SC: alerts to staff phones; a pre-selected facility team recovers the drop (sometimes the drone); officers cannot down drones. [N] https://www.facilitiesdive.com/news/prisons-battle-nightly-drone-drops-of-drugs-other-contraband/810430/
- Team scrambles "within seconds", drone gone "within minutes"; payloads grew from 4 lb at 45 mph to 25 lb at >75 mph (Fox, Dec 19 2025). [N] https://www.foxnews.com/us/us-prisons-battle-evolving-drone-technology-used-smuggle-contraband-inmates
- SCDC: 69 sightings (2019), 262 (2022), 358 (2023), 18 arrests (2023). [N] https://www.wyff4.com/article/drone-sightings-at-prisons-more-than-double/46298891 ; drops >=250 (2024), 254 (2025), Lee CI 49; officer vacancy 48%. [N] https://www.corrections1.com/drones/slaughtered-every-night-drone-drops-surge-across-s-c-prisons
- SCDC model: launch-point data + license-plate readers + drone forensics, shared with local police. [G] https://www.scstatehouse.gov/reports/aar2025/N040.pdf
- GDC: nearly 400 incidents in 2025 [N] (WSB-TV, cited in Draft 5); 362 civilians arrested in FY2025, many drone-related [N] https://georgiarecorder.com/briefs/contraband-is-entering-georgia-prisons-from-the-sky-as-drone-drops-rise-again-state-agency-says/ ; pattern: staff see the drone, notify the sheriff and GDC K-9, perimeter search, arrests [G] https://gdc.georgia.gov/contraband-report/2025-10-01/contraband-arrests-multiple-state-prisons
- SAFER SKIES (P.L. 119-60) covers state/local correctional agencies: Tier 1 detection, Tier 2 mitigation after FBI training; DOJ/DHS interim final rule effective Jul 1 2026. [G] https://www.federalregister.gov/documents/2026/07/06/2026-13609/counter-uas-authority-for-state-local-tribal-and-territorial-law-enforcement-and-correctional
- NIJ: Detect, then React (find the drop, intercept, identify the recipient, use flight data to find the pilot); "No one drone detection technology is a panacea." [G] https://nij.ojp.gov/topics/articles/addressing-contraband-prisons-and-jails-threat-drone-deliveries-grows
- UK: 1,712 drone incidents Apr 2024-Mar 2025 (+43%); £35M for steel grilles on 13,000 windows at 17 prisons, on top of £10M on counter-drone. [G] https://www.gov.uk/government/news/35-million-government-funding-boost-to-stop-drones-smuggling-contraband-into-prisons

## B4. Remote ID vs passive radar
- Remote ID required since Sep 16 2023; enforcement discretion ended Mar 16 2024. [G] https://www.federalregister.gov/documents/2023/09/15/2023-20074/enforcement-policy-regarding-operator-compliance-deadline-for-remote-identification-of-unmanned
- Exempt: recreational drones under 250 g; flights in FAA-recognized identification areas. [G] https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-89
- Receivers: free phone apps (OpenDroneID) https://github.com/opendroneid/receiver-android ; DroneScout ds230 €990 ex VAT [V] https://dronescout.co/product/dronescout-receiver/
- Criminal operators "the least likely to broadcast" (US Chamber of Commerce comments) https://www.uschamber.com/technology/comments-on-the-department-of-homeland-security-and-department-of-justice-interim-final-rule-counter-uas-authority-for-state-local-tribal-and-territorial-law-enforcement-and-correctional ; FAA 2026 proposed rule: restrictions won't deter operators "with malicious intent" [G] https://www.federalregister.gov/documents/2026/05/06/2026-08943/designation-restrict-the-operation-of-unmanned-aircraft-in-close-proximity-to-a-fixed-site-facility
- Prisons report "dark drones" emitting no RF [N] https://www.cnn.com/2026/05/03/us/drone-deliveries-contraband-prison-inmates
- ~62% of 7,459 FAA registrations reviewed appear to lack a Remote ID serial [L] https://jrupprechtlaw.com/remote-id-compliance-research/
- DJI dropped US geofencing Jan 13 2025 (No-Fly Zones now warnings). [N] https://dronedj.com/2025/01/14/dji-geofencing-no-fly-zone/
- Not found: measured share of contraband drones without Remote ID.

## B5. Sites per customer
- BJS 2019: 1,677 state and federal adult facilities; 1,155 state-operated (968 confinement + 187 community), 111 federal, 411 private. [G] https://bjs.ojp.gov/content/pub/pdf/csfacf19st.pdf
- Georgia GDC 34 state prisons (one page says 35), ~47,000 people [G]; SCDC 21 prisons [V].
- BJS Census of Jails 2019: 2,850 jurisdictions, 3,116 facilities; 52% (1,495) hold <100 people; 150 hold >=1,000; 50 largest hold 25% of inmates (LA 17,385; Harris 8,883; Maricopa 7,873; NYC 7,341); Georgia 150 jail jurisdictions, SC 45. [G] https://bjs.ojp.gov/media/65261/download
- Multi-site buys: SCDC Dedrone rollout (4 then 8 more); Tennessee DOC $1.7M request [N]; New Jersey DOC pilot at 2 prisons with potential statewide rollout [G] https://www.nj.gov/corrections/pdf/Grants/rfp/260519/Drone%20as%20First%20Responder%20RFP%20F05182026.pdf ; BOP logs launch points. Not found: a signed statewide all-prison award.

## B6. Loaded engineer cost
- BLS OEWS May 2025, Atlanta MSA annual mean [G, BLS API; re-check against the XLSX]: Electronics Engineers $146,380; Software Developers $135,870; Sales Engineers $109,310; Computer Hardware Engineers $114,280; Electrical Engineers not released (national mean $125,100).
- BLS ECEC Jun 2026: professional, scientific and technical services benefits 31.7% of compensation (1.46x wages); all private industry 30.0%. [G] https://www.bls.gov/news.release/ecec.t04.htm
- $204k = $146,380 x ~1.39; at 1.46x it is ~$214k. $175k at 1.46x implies ~$120k base.

## B7. Worked examples of drops
- Lieber Correctional, SC, Mar 14 2025: drone reported ~5 a.m.; package dropped and picked up by inmates shortly after 5 a.m.; Quinzell Robinson came out of nearby woods with a drone and a bag; flight data and phone GPS placed the launch point; 1 year and 1 day federal sentence (reported Nov 13 2026). Lesson: inmates reached the package before staff. [N] https://www.wrdw.com/2026/11/13/man-gets-federal-prison-time-flying-drone-onto-sc-prison-yard/ ; [G] https://www.justice.gov/usao-sc/pr/sumter-man-sentenced-federal-prison-after-flying-drone-over-south-carolina-prison
- Calhoun State Prison, GA, Sep 21 2025: staff saw a drone with a duffel bag; sheriff and K-9 called; 3 civilians caught that evening; 5 phones, 6,394 g tobacco, 1,222 g marijuana. [G] https://gdc.georgia.gov/contraband-report/2025-10-01/contraband-arrests-multiple-state-prisons
- Hays State Prison, Dec 2025: perimeter set up; a thermal drone tracked a suspect with a bag of 20+ phones and a Dremel. [N] https://coosavalleynews.com/2025/12/suspect-arrested-near-hays-state-prison-after-drone-assisted-search-uncovers-large-contraband-cache/
- Macon network (unsealed Jun 24 2026): 12 charged; 6 drones made at least 38 drops at 10 federal prisons; BOP launch-location data helped. [G] https://www.justice.gov/usao-mdga/pr/twelve-indicted-alleged-drone-smuggling-conspiracy-ten-prisons
- Not found: measured drop duration or staff response time.
