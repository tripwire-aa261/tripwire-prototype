# GNSS jamming and spoofing monitoring: research notes (2026-11-18)

Gathered by a research subagent. Numbers marked (summary) came from a search summary, not the full page: open the URL before citing. (agg) = market-research aggregator or vendor blog.

## Scale of the problem
- OPSGROUP: spoofed flights about 1,500 a day by Sep 2024, up from about 300 in Q1/Q2 2024 (950 participants). https://ops.group/dashboard/wp-content/uploads/2024/09/GPS-Spoofing-Final-Report-OPSGROUP-WG-OG24.pdf
- EASA/IATA (Jun 2025): GPS signal-loss events up 220% 2021-2024 (IATA FDX). https://www.iata.org/en/pressroom/2025-releases/2025-06-18-01/
- IATA risk assessment: over 1 million GPS signal-loss instances across ~24.6 million flights, Aug 2021-Jun 2025. https://ic.iata.org/sites/default/files/iata_sih_document_attachment/IATA%20Safety%20Risk%20Assessment%20-%20GNSS%20Interference%20V5.pdf
- FAA GNSS Interference Resource Guide v1.1 (Mar 2026), citing IATA: GNSS loss per 1,000 flights up 65% in H1 2024 vs 2023. https://www.faa.gov/about/office_org/headquarters_offices/avs/offices/afx/afs/afs400/afs410/GNSS/GPS_GNSS_Interference_Resource_Guide.pdf
- Baltic: Lithuania "hundreds of GNSS interferences every week", ~20x 2024 (secondary). https://www.heise.de/en/news/Study-GPS-interference-in-the-Baltic-Sea-becoming-more-complex-and-stronger-11105103.html
- Gdynia Maritime Univ./GPSPatron: shipboard GNSS availability 83.5% late Jun-Jul 2025; one ~30 h spoofing episode. https://gpspatron.com/gnss-interference-in-the-baltic-sea-a-collaborative-study-by-gpspatron-and-gdynia-maritime-university/
- Finnair suspended Tartu flights Apr-May 2024 over jamming. https://www.pbs.org/newshour/world/what-to-know-about-russias-gps-jamming-of-a-european-officials-plane
- US: Denver Jan 2022 ~33 h of interference near the airport; FCC found and shut the source. https://rntfnd.org/2023/01/12/dhs-report-on-denver-jamming-more-questions-than-answers-gps-world/ ; Dallas Oct 2022 source never found. https://rntfnd.org/wp-content/uploads/LE-RNTFND-Disruption-at-DEN-and-DFW-in-2022-FINAL29052024_PRINT.pdf ; Newark: truck driver's privacy jammer disrupted the GBAS landing system, FCC proposed $31,875. https://www.fcc.gov/document/32k-penalty-proposed-use-gps-jammer-individual ; >70 federal safety reports on jamming near White Sands over ~10 years (KOB-TV). https://www.kob.com/new-mexico/4-investigates-feds-ignored-a-decade-of-warnings-that-gps-jamming-could-cause-a-crash/
- NIST/RTI (2019): GPS loss would cost the US about $1B per day. https://www.nist.gov/news-events/news/2019/10/economic-benefits-global-positioning-system-us-private-sector-study
- Not found: official FAA annual counts of US interference reports; quantified timing harm to telecom/power/finance 2024-2026 (only vendor blogs).

## Who buys
- **FAA**: Industry Day "Aviation Spectrum Interference Detection", Oct 13-15 2026: detect, identify, geolocate and alert on RF interference, jamming and spoofing across the NAS with distributed sensors; considering buying it as a service (no commitment). https://www.federalregister.gov/documents/2026/09/30/2026-19986/industry-day-aviation-spectrum-interference-detection-solution ; https://sam.gov/workspace/contract/opp/d62d0987495f4afba55a071142cc6a1f/view ; https://avweb.com/aviation-news/faa-explores-interference-detection-system/
- GAO-26-108439 (Sep 2026): FAA has no 24/7 real-time jamming/spoofing monitoring; investigates after reports; 9 recommendations, DOT concurred. https://www.gao.gov/assets/gao-26-108439.pdf
- IEEE Spectrum: tracing a source takes "a few days to a month or more"; competitors Spire, HawkEye 360, Dimetor; ground sensing near airports seen as the practical gap-filler. https://spectrum.ieee.org/faa-aviation-airwaves
- DHS S&T / CISA: guidance and tools (Resilient PNT framework, PNT Integrity Library), not procurement. https://www.dhs.gov/science-and-technology/pnt-program ; https://www.cisa.gov/topics/risk-management/positioning-navigation-and-timing
- Defense: a European MoD multi-year contract with HawkEye 360 worth up to $75M for air-defense and GPS interference monitoring services. https://thedefensepost.com/2026/03/03/hawkeye360-europe-electronic-warfare/
- Not found: dedicated US programs for ports, stadiums, police, utilities.

## Products and prices
- Chronos (NavtechGPS US list): CTL3510-LOG L1 detector/recorder $1,242; CTL3520 handheld locator $2,539. https://www.navtechgps.com/departments/gps-jammer-detectors/
- GPSPatron airport design (quote only): ~4 GP-Probe TGE2 TDOA units (claimed 100-200 m inside the network), 20-40 DIN L1 sensors, GP-Cloud subscription, handheld units; one-month site assessment as a service. https://gpspatron.com/airport-gnss-interference-monitoring/
- Spirent GSS200D (now Keysight): probe + cloud, sold or leased, support contract needed; price not found. https://www.amtechs.co.jp/product/MS3102%20Issue%201-01%20GSS200D%20Detector.pdf
- Septentrio AIM+: in-receiver detection/mitigation, no localization. https://www.septentrio.com/en/learn-more/advanced-positioning-technology/aim-anti-spoofing-protection
- Dimetor NAVSentry: cell-tower GNSS receivers; ESA NAVISP partner. https://www.dimetor.com/dimetor-partners-with-esa-navisp-for-large-scale-gnss-interference-detection/

## Market size
- No credible estimate for detection/monitoring specifically. Closest: MarkNtel, US GNSS spoofing detection and prevention ~$0.33B (2026) to $0.47B (2032) (agg, scope includes prevention). https://www.marknteladvisors.com/research-library/us-gnss-spoofing-detection-prevention-market-report.html
- Anti-jamming estimates ($3.6-5.9B) count antennas: out of scope (agg). Size bottom-up instead (airports, ports, bases x price per site).

## Technical feasibility
- DTU, NAVIGATION 73(1) (2026), Jammertest 2023: one 5-channel KrakenSDR as a direction-finding array located a spoofer to 18 m from a moving vehicle; tracked a 10 dBm car jammer at ~112 m; bearing precision 0.5-1 deg, bias up to 10 deg (calibration matters). https://navi.ion.org/content/73/1/navi.735
- GPS Solutions 30:96 (2026): real-time TDOA network at 4 sites (Gdansk coast) locates jammers and spoofers in under 300 s; triggered by AGC and C/N0 drops; one antenna per site; accuracy set by geometry. https://link.springer.com/article/10.1007/s10291-026-02061-5
- Kaliningrad emitters triangulated to ~1 km. https://www.defensenews.com/global/europe/2025/07/02/researchers-home-in-on-origins-of-russias-baltic-gps-jamming/
- GRIFFIN hybrid AOA+TDOA: 1.39 m (3 sigma) on a 1 km^2 range. https://insidegnss.com/detecting-and-geolocating-jammers-and-spoofers-using-integrated-aoa-and-tdoa-measurements/
- Spoofing checks on SDRs: AGC/power, same-direction arrival of all satellites (multi-channel array), constellation/frequency cross-checks, Galileo OSNMA.
- Open source: GNSS-SDR https://gnss-sdr.org ; KrakenSDR DF https://github.com/krakenrf ; GPSJAM https://gpsjam.org

## Regulation
- Jammers banned to operate/market/sell/import (47 U.S.C. 302a(b), 333); federal agencies exempt; penalties up to $112,500 per violation (FCC page, 2014 figure). https://www.fcc.gov/general/jammer-enforcement
- No FCC rule found barring receive-only detection by private parties (confirm with counsel).
- Enforcement: complaint to FCC Enforcement Bureau, field direction finding, seizure, Notice of Apparent Liability (Newark precedent). https://insidegnss.com/fcc-fines-operator-of-gps-jammer-that-affected-newark-airport-gbas/
- Our role: evidence (location, time, recording) to FCC, FAA or police; no seizure.

## Implications (agent's estimates, NOT sourced)
- First customers: FAA as-a-service work (possibly with a prime); DoD test ranges and bases; airports with GBAS, ports and timing-dependent sites as an upsell to drone sites.
- Price: $15-40k per site per year as an add-on to a drone site; $60-150k per year for a standalone airport or base network. ASSUMPTIONS to validate.
- Extra hardware: L1/L2/L5 antennas, filters and LNAs; a holdover oscillator (OCXO or chip-scale atomic clock) because GPS-disciplined clocks lose sync under jamming, which TDOA needs. Software: AGC/C/N0 triggers, TDOA solver, AOA from multi-channel arrays, spoofing checks, dashboard and evidence logs.
