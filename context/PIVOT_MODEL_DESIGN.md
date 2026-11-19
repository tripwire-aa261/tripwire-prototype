# Financial model v2 (pivot): proposed design, for Sid's review

Status: PROPOSAL (2026-11-18). Nothing built yet. Sources are in `context/research/`; every price below is marked as a benchmark (cited) or an ASSUMPTION (ours).

## 1. What changes from the submitted model

| Submitted model (main) | Model v2 (pivot) |
|---|---|
| One product: $25k + $25k/yr per Hays-size facility | Five revenue lines (below), priced by customer type |
| Every customer = 6 facilities, 9-month sale | Each customer type has its own count, sites per customer, sales cycle and channel (VC feedback) |
| 4 rounds, $25.25M, $100M/yr in 2039 | Raise in the $10-30M band; test both targets at year 5 |
| Salespeople added at a fixed 5 a year (linear growth) | Hiring follows bookings; new salespeople ramp up; wins slow as each segment fills (S-curve) |
| 5% of facilities lost evenly, renew forever | Contracts run their term; a renewal rate applies at the end of each term |
| $175k loaded per hire | BLS Atlanta means x 1.46 (ECEC benefits share), by role |
| No government R&D money | SBIR / DIU prototype funding as non-dilutive income, with a probability |

## 2. Revenue lines

| Line | What the customer gets | Price (proposal) | Basis |
|---|---|---|---|
| **A. Tripwire Site** (end-to-end service) | Sensors on the perimeter using the best local signals (cell, TV, FM), software, 24/7 alerts, evidence-grade track records, Remote ID receiver included; heat camera optional | Prisons and large jails: $25k install + $25k/yr per Hays-size site (unchanged, VC liked it). Heat camera option: +$40k install + $5k/yr. | Draft 5 pricing; Axis bispectral PTZ $32,138 (dealer) |
| **A2. Tripwire Site, large perimeter** | Same, for bases, ports of entry, power and water sites | Priced by protected area: about $0.5M install + $0.25M/yr per installation (ASSUMPTION) | Below benchmarks: CBP port sensors ~$6M per site; Cobb County ~$2.1M per Dedrone kit over 5 years |
| **B. Tripwire Mobile kit** | Deployable kit (6 sensors on tripods/trailer, heat camera, laptop) for police and event security | $350k + $75k/yr support (ASSUMPTION) | FEMA-funded city/county buys of $0.3-2M; Dedrone tactical kit ~$2.1M/5 yr incl. mitigation |
| **C. Sensors for integrators** | Our sensor and software license sold to primes and integrators (e.g., Domestic Shield IDIQ holders) | $12k per sensor + $3k/yr software per sensor (ASSUMPTION; our cost ~$1.6-1.8k) | $4.15B Domestic Shield ceilings, <1% obligated |
| **D. GPS jamming and spoofing monitoring** | Detects interference and locates the source; evidence for FCC/FAA/police | Add-on $20k/site/yr; standalone airport/base network $100k/yr (ASSUMPTIONS, midpoints of researched ranges) | FAA industry day (Oct 2026) on buying detection as a service; GAO-26-108439 |
| **E. Government R&D funding** | SBIR Phase I/II, DIU prototype agreements | Phase I $336k, Phase II $2.24M (caps); DIU OT ~$3.8M average | sbir.gov; GAO-25-106856 |

## 3. Customer types (answers the "sites per customer" question)

| Type | Buyers | Sites per buyer | Sales cycle | Channel | Starts |
|---|---|---|---|---|---|
| State corrections departments | ~50 (1,155 state-run facilities) | Georgia 34, SC 21; ~23 average | 12 months, then rollout ~4 sites/quarter (ASSUMPTION) | Direct | 2028 (after the Hays pilot) |
| Large county jails | 150 jurisdictions holding 1,000+ | 1-3 | 9 months (ASSUMPTION) | Direct | 2028 |
| City/county police (FEMA money) | FEMA subrecipients; $250M FY2027 money, spent Dec 2026-Dec 2029 | 1-2 mobile kits | 3-9 months | Direct, via state agencies | 2027 Q3, only to 2029 unless budgets continue |
| DoD installations | 100+ with drone detections in 2024 | 1 per installation, several per service | 18 months | Subcontract to IDIQ primes, DIU/SBIR | 2029 |
| DHS / CBP | Ports of entry (25 southern), tower sites (PWAAS goal 58) | many per award | 24 months | Through primes/IDIQ holders | 2030 |
| FAA GPS monitoring | 1 program | national | 18-24 months | Prime or as-a-service | scenario, not plan (to decide) |
| Stadiums | ~200 | 1 | 9 months | Integrators | proof site (Clemson) |

## 4. Funding (proposal)

- Pre-seed $0.25M (2027 Q1), Seed $5M (2027 Q3), Series A $20M (2028 Q4): $25.25M total, inside the $10-30M band; no Series B in the plan.
- Results to show: peak cash need; when it pays its own way; sales in 2031 (year 5) and 2032; value at a 2031 sale at 4.5x and 9x sales (exit reading); whether sales reach $100-200M a year by 2031-2032 (sales reading); each round's multiple.

## 5. Team and costs

- Ashlynn (US Air Force) leads government and defense business from Seed.
- Wages: BLS May 2025 Atlanta means x 1.46: electronics engineer $146,380 -> ~$214k; software $135,870 -> ~$198k; sales engineer $109,310 -> ~$160k; plus founders' $120k (below market, stated).
- New fixed costs: ITAR registration ($3,000/yr first tier), commodity jurisdiction request, facility security clearance work (ASSUMPTION), CMMC/NIST 800-171 compliance for DoD work (ASSUMPTION), DHS data-sharing API.
- Hardware: own receiver earlier (pulled forward with the bigger Series A); holdover oscillator per sensor for GPS monitoring (ASSUMPTION ~$300-1,500).

## 6. Scenarios

- Plan; Interference removal stuck at 20 dB (only moderate-tower sites; TV/FM help unproven); No government after FEMA (DoD/CBP slip 2 years); FAA GPS program won; ITAR blocks allied sales; Price pressure (-30%).

## 7. Open decisions for Sid

1. Prices for the large-perimeter site, mobile kit and integrator sensor (above) or other anchors?
2. Raise structure: two priced rounds (Seed $5M, A $20M) or one larger Seed?
3. FAA GPS monitoring: in the plan or a scenario?
