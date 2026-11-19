# Government buyers: research notes (2026-11-18)

Gathered by a research subagent. [P] primary, [T] trade press, [A] aggregator (low quality). "calc" = arithmetic on cited figures. Open the URL before citing.

## FEMA Counter-UAS Grant Program
- $500M under Pub. L. 119-21 §90005(a): $250M FY2026, $250M FY2027. [P] https://www.fema.gov/grants/preparedness/counter-unmanned-aircraft-systems-grant-program
- FY2026 went to 11 World Cup host states + NCR (IB 549, Dec 30 2025): Texas $30,276,431; Florida $23,636,511; Georgia $20,284,936; California $34,591,628; DC/NCR $28,266,328; South Carolina not eligible. [P] https://www.fema.gov/sites/default/files/documents/fema_gpd_ib_549_cuas-award-announcement_122025.pdf
- FY2027 NOFO DHS-27-GPD-161-01-99: $250M to 56 state agencies; awards $760K-$25M; floor $3,325,000 per state; opened Oct 16 2026, **closed Nov 16 2026**; selection Dec 2, awards Dec 10 2026; performance Dec 10 2026 - Dec 9 2029; no pre-award costs. [P] https://www.fema.gov/sites/default/files/documents/fema_fy-2-27_c-uas_grant-program_nofo.pdf
- FY2027 allocations (table re-aligned by the agent; check the PDF): Texas $10,508,140; Florida $7,754,298; Georgia $5,347,213; South Carolina $3,895,891.
- NOFO: "DHS strongly encourages awardees to use this grant to procure active radar or **passive radar** capabilities"; radar ranked above RF-only. Detection not needing §124n authority (radar, EO/IR, acoustic, Remote ID) exempt from FBI NCUTC certification. Mitigation must be on the 6 CFR 124.7 list. Grant-funded detection must **share tracks and sensor metadata with DHS** (vendor agreements must allow it: we need an API). At least 97% passes to local/tribal governments. Scoring: 2 points for full implementation within 6 months, 1 within 12; complete within 36 months. [P] NOFO; fact sheet https://www.fema.gov/fact-sheet/notice-funding-opportunity-nofo-counter-unmanned-aircraft-systems-c-uas-grant-program
- FY2028+: none found; the $500M is one-time.

## Prices paid for detection
- Cobb County GA: ~$8.3M for four DedroneTactical kits + equipment/software, 5 years of equipment, training, maintenance, licensing (~$2.1M per kit, calc); DHS World Cup grant, Jun 2026. [T] https://www.police1.com/police-grant-center/ga-police-to-spend-9-7m-on-drones-other-safety-items-for-world-cup-thanks-to-dhs-grant
- NYPD $6.5M mitigation; detection on Dedrone. [T] https://dronexl.co/2026/05/27/nypd-counter-drone-unit-world-cup/
- Houston: up to $1,254,000 reimbursement to Harris County Sheriff for detection and mitigation. [T] https://dronexl.co/2026/11/06/houston-council-approves-counter-drone-grant-bid-consent-guardrails/
- Massachusetts ~$21.2M across State Police, Boston PD, Foxborough PD. [T] https://dronelife.com/2026/01/19/massachusetts-facing-hurdles-in-developing-world-cup-counter-uas/
- Echodyne: $35.3M State Dept INL radar contract (2025) [A] https://govtribe.com/award/federal-contract-award/definitive-contract-19aqmm25c1050 ; $250M JIATF-401 IDIQ ceiling, 36 months [P] https://www.echodyne.com/newsroom/echodyne-awarded-250-million-jiatf-401-counter-uas-contract
- DroneShield: JIATF-401 A$24.9M (A$19.3M initial) [P] https://yourir.info/resources/3308bfc2e9c8366b/announcements/dro.asx/2A1675058/DRO_US_Joint_Interagency_Task_Force_401_Contract.pdf ; US$500M IDIQ ceiling, no orders guaranteed [P] https://announcements.asx.com.au/asxpdf/20260930/pdf/074q0mk6kqjwz1.pdf
- Army FS-LIDS FY2025 request $26.4M procurement (six fixed sites). [T] https://defensescoop.com/2024/03/11/army-counter-drone-systems-funding-fiscal-2025/ ; CRS R48477 https://www.congress.gov/crs-product/R48477
- CBP PWAAS sensors $30.0M for 5 sites (~$6M per site, calc). [P] https://www.dhs.gov/sites/default/files/2026-04/26_0403_ocfo_fy27-budget-customs-and-border-protection.pdf
- Per-unit radar prices: not found.

## DHS / CBP
- Anduril Extended Range Sentry Towers: $363M, 1 year, 200+ towers (~$1.8M each, calc); awarded Dec 2025, announced Jun 2026; >40 delivered at ~15/month; task order on Anduril's SBIR Phase III IDIQ. [T] https://www.defensedaily.com/cbp-awards-anduril-363-million-for-extended-range-surveillance-towers/homeland-security/ ; [A] https://orangeslices.ai/anduril-scores-1-year-363m-sbir-phase-iii-autonomous-surveillance-towers-idiq-task-with-dhs-border-patrol/
- Anduril: pilot 2018, expansion 2019, program of record 2020 (~2 years). [T] https://www.technologyreview.com/2026/09/21/1144166/border-towers-surveillance-investigation/
- CBP FY2027 request: counter-UAS $87.1M ($80.0M procurement at ports of entry incl. 25 southern-border ports; RF detect-and-defeat, radars, cameras, COP software; $7.1M operations). PWAAS 3 sites operational, goal 58. Integrated Surveillance Towers +$12.7M. [P] CBP FY2027 budget justification (above)
- DHS counter-UAS IDIQ $1.5B / 5 years / 12 awardees; hardware/software track ~$1B to 7 firms incl. Dedrone and D-Fend; announced Aug 5 2026; ordering to Jul 31 2031. [T] https://insideunmannedsystems.com/dhs-awards-1-5-billion-counter-uas-contract-to-12-companies/

## DIU
- CSO PROJ00656 "Counter UAS Sensing for Homeland and Mobile Defense": briefs due Feb 26 2026; Yuma demo spring 2026. LOE1 fixed homeland sites: detect all Group 1 UAS at >=2 km, **radar mandatory**, reject birds/clutter, integrate with government fire control. LOE2 mobile: low physical and spectral signature, **"preference for passive approaches"**, passive RF ~400 MHz-8 GHz, ISV/JLTV mounting. Award sizes not found. [T] https://www.defensenews.com/pentagon/2026/02/13/pentagon-wants-counter-drone-sensors-to-protect-us-infrastructure-and-fast/
- GAO-25-106856: 450 prototype agreements FY2016-23, ~$1.7B (~$3.8M each, calc); 85% exceeded 90 days, average ~172 days; prototypes 12-24 months; 51% of completed prototypes went to production. [P] https://files.gao.gov/reports/GAO-25-106856/index.html

## SBIR/STTR
- Caps from Oct 16 2026: Phase I $335,937; Phase II $2,239,578. [P] https://www.sbir.gov/about
- AFWERX Direct-to-Phase-II needs a prototype and an Air Force customer memo; D2P2 up to $1.25M; counter-UAS an FY2026 priority. [A] https://grantengine.com/afwerx-sbir-2026/ (verify on DSIP)
- Army xTechCounter Strike: up to $2.5M prizes; $50K to up to 15 finalists; winners up to $350K. [P] https://xtech.army.mil/competition/xtechcounterstrike/

## DoD counter-UAS budget
- FY2026 request $3.187B for C-UxS vs $2.247B enacted FY2025. [A] blog; primary overview not fetchable: https://comptroller.war.gov/Portals/45/Documents/defbudget/FY2026/FY2026_Budget_Request_Overview_Book.pdf
- FY2027 request $20.6B vs $3.9B enacted FY2026, ~$14.4B mandatory "Drone Dominance". [P via excerpt] https://comptroller.war.gov/Portals/45/Documents/defbudget/FY2027/FY2027_Budget_Request_Overview_Book.pdf
- House approps: JIATF-401 $1.4B incl. new $580M prototyping line. [P] https://docs.house.gov/meetings/AP/AP00/20260624/119414/HMKP-119-AP00-20260624-SD002.pdf ; Senate +$2B [P] https://www.appropriations.senate.gov/imo/media/doc/def_fy27_bill_summary.pdf
- JIATF-401 Domestic Shield IDIQs (Sep 29 2026): 10 awards, $4.15B combined ceilings (SRC, DroneShield $500M each; Echodyne $250M). [P] https://www.army.mil/article/295771/jiatf_401_advances_domestic_shield_with_counter_uas_contract_awards ; only ~$50M obligated so far, target up to $7B [T] https://defensescoop.com/2026/09/29/pentagon-task-force-army-announce-billions-in-counter-drone-tech-awards/

## Demand: incursions
- 2024: 350 detections over 100 installations; about half of sites lack 10 USC 130i authority (Gen. Guillot, SASC, Feb 13 2025). [P] https://www.armed-services.senate.gov/imo/media/doc/02-13-2025-full-transcript.pdf
- Mar 2026: a "spike" over the past year; ~a quarter of detected drones now defeated. [T] https://defensescoop.com/2026/03/19/drone-incursion-strategic-us-military-base/
- Barksdale AFB: waves of 12-15 drones, Mar 9-15 2026. [T] https://www.twz.com/news-features/u-s-battled-drone-incursions-over-key-bases-at-home-after-launch-of-epic-fury
- NORTHCOM deputy commander, Aug 2026: "We don't have the sensors." [T] https://www.twz.com/air/u-s-not-prepared-to-handle-drone-attack-from-inside-homeland-northcom-deputy-commander

## Export control
- USML XI(a)(3)(xxvii): bistatic/multistatic radar using >125 kHz bandwidth below 2 GHz to passively detect/track. LTE passive radar likely ITAR. [P] https://www.ecfr.gov/current/title-22/chapter-I/subchapter-M/part-121
- Otherwise EAR 5A001.g (PCL incl. cellular base stations), NS2, License Exception GBS eligible. [P] https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774
- File a commodity jurisdiction request early; >2 GHz signals (e.g., 5G 3.5 GHz) might fall outside the ITAR entry.

## Implications (agent's estimates, NOT sourced unless noted)
- FEMA: FY2027 window closed; money flows Dec 2026-Dec 2029; locals buy ~2027; first deals $0.3-2M per county/city through winning jurisdictions; no federal money after FY2027.
- CBP: integrator-led; sell through IDIQ holders; expect a $0.5-2M pilot after 12-24 months.
- DIU: prototype OT ~$3.8M average, ~6 months to award (GAO); current CSO closed; watch JIATF-401's $580M prototyping line.
- SBIR: Phase I <=$336K/~6 months; Phase II <=$2.24M/18-24 months; Phase III unlocks sole-source (Anduril precedent).
- Primes: near-term path is subcontracting sensors to Domestic Shield IDIQ holders.
