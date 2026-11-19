# Digital TV as an illuminator: research notes (2026-11-18)

Gathered by a research subagent. Five sources read in full (marked); others from abstracts or snippets: open before citing exact figures.

## Bottom line
- No published drone detection with US digital TV (ATSC). TV-band passive radar has detected small DJI-class drones at ~0.2-5 km bistatic range with DVB-T, DVB-T2 and DTMB in Europe and China.
- "No co-channel neighbours" is wrong: co-channel ATSC sources exist (Barott & Himed 2015); ATSC 3.0 single-frequency networks add them on purpose. Fewer than LTE, not none.
- Measured ATSC direct-path/clutter cancellation: effective 30-45 dB, residual floor 6-20 dB above thermal (Garry, Baker & Smith 2017).

## ATSC-specific
- Barott & Engle, IEEE RadarConf 2014: single-antenna ATSC passive radar, reference rebuilt by remodulation, keystone formatting; aircraft only. https://ieeexplore.ieee.org/document/6875576
- Barott & Himed, IEEE RadarConf 2015, "Cochannel interference in ATSC passive radar" (simulation): up to ~10 significant co-channel sources per illuminator for a small airborne radar; remodulate the strongest, null the rest. https://ieeexplore.ieee.org/author/37543016900
- Garry, Baker & Smith, IEEE TGRS 55(7), 2017 (Ohio State MUTERA; full text via mirror https://www.fccdecastro.com.br/pdf/EDSSPR.pdf): rooftop, 580-680 MHz, horizontally polarised; pilot notched; least squares removed direct+clutter by up to 80 dB but noise floor dropped only ~35 dB; 30-45 dB effective expected; residual 6-20 dB above thermal; ideal LS ceiling ~64 dB; clutter to ~30 km bistatic; fixed coefficients degrade beyond ~100 ms CIT; FBLMS's Doppler notch hurts slow targets.
- Huang, IET RSN 2019 (array localisation, ATSC) https://ietresearch.onlinelibrary.wiley.com/doi/10.1049/iet-rsn.2018.5511 ; Alslaimy, Electronics Letters 2019 (CRB) https://ietresearch.onlinelibrary.wiley.com/doi/10.1049/el.2019.0011
- ATSC 3.0: nothing peer-reviewed. Hobbyist repo (low quality, n=1): 11 aircraft tracked off ATSC 3.0, 17-85 m range error vs ADS-B. https://github.com/Felbs/broadcast-radar

## DVB-T / DVB-T2 / DTMB against drones (mostly via the related-work summary of Demissie & Steffes 2025, full text read)
- Martelli, Colone, Cardinali, IET RSN 2020 (full text read): DVB-T 570/754 MHz, 50 kW EIRP at 22.5 km; Phantom 4 Pro and Mavic Pro detected continuously 1.6-5 km bistatic; ghosts from SFN. https://iris.uniroma1.it/retrieve/e3835325-a050-15e8-e053-a505fe0a3de9/Martelli_Post-print_DVB-T-based_2020.pdf
- Poullin (ONERA), NATO MP-SET-231-18, 2016 (full text read): detections to ~3 km; a hovering multirotor ~3 km NOT detected at zero Doppler, seen only via blade modulation ~100-150 Hz. https://publications.sto.nato.int/publications/STO%20Meeting%20Proceedings/STO-MP-SET-231/MP-SET-231-18.pdf
- Yuqi et al., IEEE RadarConf 2017: DTMB, emitters 7.5 km away, Phantom 4 to 2.25 km.
- Vorobev et al., SPSympo 2019: DVB-T2 660 MHz, 49.2 km, Phantom 3 / F450 at 750-900 m; rotor classification except plastic blades.
- Rzewuski et al., NATO MP-MSG-SET-183-13, 2021 (full text read): DVB-T 100 kW ~45 km, Parrot AR.Drone at 200 m bistatic; simulated drone RCS -60 to -20 dBsm. https://publications.sto.nato.int/publications/STO%20Meeting%20Proceedings/STO-MP-MSG-SET-183/MP-MSG-SET-183-13.pdf
- Multistatic track accuracy in metres for small drones with TV: not found. Comparable: Fraunhofer LTE450 range errors 0.9-10.4 m mean, azimuth 2.2-2.8 deg, Pd 75-96% at Pfa 0.008.

## Practical limits
- Hovering/slow drones fall in the zero-Doppler clutter notch (Poullin).
- Carbon blades visible in TV-band range-Doppler; plastic weaker (Vorobev).
- ~10 effective ADC bits for DVB-T detection (Harms et al., secondhand).
- Saturation within 10 km of a 1 MW station: not found anywhere.
- US ATSC is horizontally polarised: favourable (vertical DVB-T reflects weakly off carbon rotors, Demissie & Steffes).
- Elevation: OET-69 assumes 0.75 deg UHF beam tilt; a drone at 60 m 50 km from a 400 m tower sits ~0.5-0.6 deg below horizontal (agent's arithmetic): probably inside the beam. Risks: terrain shadowing in valleys, nulls near the main beam.
- Shared towers: several US stations on one tower give no geometric diversity among themselves.

## Systems
- Hensoldt TwInvis: aircraft only, no drone range published. https://www.hensoldt.net/products/twinvis-passive-radar-surveillance-of-noiseless-objects
- Silentium Defence MAVERICK M8: brochure claims small drones "up to 5 km", UHF, 7-element ring, 72 W; illuminator not named; tested at USSOCOM Trident Spectre 2024, no results published. https://www.silentiumdefence.com.au/wp-content/uploads/2023/09/Silentium-Defence-MAVERICK-M8-Technical-Brochure.pdf
- No independent drone-specific trial data found for any vendor.

## US context
- ATSC 3.0 reaches >76% of US households (ATSC, Jul 2026) https://www.atsc.org/nextgen-tv/deployments/ ; on air in Atlanta, Charleston SC, Greenville-Spartanburg, Myrtle Beach-Florence (TV Tech, Sep 2026) https://www.tvtechnology.com/news/atsc-30-deployments-where-and-when-will-nextgen-tv-be-available
- FCC 25-72 (Oct 2025) proposes ending mandatory ATSC 1.0 simulcast, no fixed shutoff date; NAB asked for 2028/2030; no final order confirmed. Design for both. https://docs.fcc.gov/public/attachments/FCC-25-72A1.pdf
- 2020 interagency advisory: systems that only sense reflected waves without decoding communications fall outside the wiretap-type statutes. https://www.dhs.gov/sites/default/files/publications/20_0817_ogc_interagency-legal-advisory-uas-detection-mitigation-technologies.pdf

## Seed measurements (agent's recommendation)
1. Record 8 channels of ATSC 1.0 and 3.0 at a Georgia/SC site: direct power and headroom, cancellation depth, residual floor over thermal vs LTE at the same site.
2. Cooperative 0.9-5 kg drone flights with GPS truth (hover, 5 and 15 m/s): Pd, false alarms, max range; hover via rotor modulation.
3. Survey co-channel/adjacent ATSC sources and SFN boosters; map shared towers.
4. Joint LTE + ATSC track fusion vs GPS, position error in metres.
