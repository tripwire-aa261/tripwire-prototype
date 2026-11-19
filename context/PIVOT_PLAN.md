# Pivot plan (branch `pivot-v1`)

Started 2026-11-18 by Sid. Draft Report 5, the v0.5.1 twin and the current financial model on `main` stay as submitted; everything here is a fresh version.

## Why

Course instructors (Nov 2026): the current plan is not venture scale. It raises about $25M over four rounds and reaches $100M of sales a year only in 2039 (year 13). Their target: raise **$10-30M** and reach **$100-200M within about 5 years**. We model both readings:

- **Exit reading:** the company is worth or sells for $100-200M within ~5 years of the raise (needs roughly $15-45M of sales a year by year 5 at 4.5-9x sales).
- **Sales reading:** $100-200M of sales a year within ~5 years (needs large government programs).

## Decisions (Sid, 2026-11-18)

1. **Tripwire becomes a passive sensing platform**, not a prison drone detector:
   - drones first (cell-tower passive radar, as today);
   - **more signal sources**: FM radio, digital TV, satellite TV / LEO satellites, chosen per site for range and coverage;
   - **heat cameras** cued by our tracks where a visual confirmation is needed;
   - **GPS/GNSS jamming and spoofing monitoring** on the same radios (detect and locate the jammer).
2. **Two ways to buy:** the end-to-end service (subscription) and **selling sensors and software** to integrators and other vendors.
3. **Beyond interception** (no takedown): evidence-grade track records for prosecution, alert feeds into existing systems, event-day airspace reports.
4. **Customers: government first, several early contracts in parallel:** start with states using FEMA counter-drone grant money, then DHS/CBP border and DoD via DIU/SBIR. Prisons and stadiums (Hays, Clemson) stay as **proof sites** and one paying segment.
5. **Team:** Ashlynn (US Air Force) leads government and defense business.
6. **Not now:** the drone traffic / airspace map as a product.
7. **Draft Report 6:** same assignment sections as Draft 5, new content, plus a section answering every point of the VC feedback below.
8. **Where:** this branch; new Google Doc tab "Draft Report 6" (built first as a separate Claude doc). Prototype work at medium depth: link-budget models for new signal sources at our four sites, a GPS-jammer locator demo, heat-camera cueing, and a contraband-drop walkthrough.

## VC feedback on the data package (to answer in Draft 6)

- Strength: calibrated digital twin; pricing set against the alternatives.
- What happens in the minutes after an alert? Who acts, and how?
- Who signs first: a state prison system or a county jail? (one named early buyer)
- Why pay for passive radar when Remote ID receivers are cheap?
- Six sites per customer, but most sites are county jails, one per county. Model by customer type (at two sites per customer the plan stays below $100M).
- Headline result is at 20 dB and 5 kg; milestones call for 0.9 kg. Add the case where interference removal stops at 20 dB, and a 0.9 kg result.
- The pre-seed demo needs real-time work planned for Seed hires. Match the demo to today's team.
- $175k loaded vs the $204k BLS rate: can we hire at that rate? Use US market rates.
- Series B ($9M) smaller than Series A ($12M) at $187M pre-money on $1.7M of sales: one line on what drives each.
- Add a worked example: a drone drops contraband over a prison wall; show how Tripwire catches it.

## Milestones (check in with Sid after each)

1. **Done 2026-11-18.** Research brief (`context/research/`): buyers, contract sizes and timelines; GNSS monitoring market and prices; sensing ranges and heat cameras; answers to the VC questions.
2. **Built 2026-11-18, for Sid's review.** Financial model v2 (`prototype/web/financial-model-v2.html`, sources in `prototype/web/model-v2-src/`; design in `context/PIVOT_MODEL_DESIGN.md`): by customer type and contract; service and sensor-sales lines; GNSS product; raise and 5-year targets (both readings); 20 dB case.
3. Prototype v0.6 on this branch: new signal sources, GPS-jammer locator, heat-camera cueing, contraband-drop walkthrough, 0.9 kg results.
4. Draft Report 6 (Claude doc, then Google tab), product prototype tab v2.

## Target (Sid, 2026-11-18)

$100M of sales a year by year 5 (2031) or earlier, raising $10-30M. Model v2 now shows this target first; what a sale would be worth is shown second.

## Model v2 results at plan settings (updated 2026-11-18)

Changes after Sid's review: 16 salespeople hired a year after Series A; two selling routes switched on from 2029 (contract vehicles save one quarter per sale; pilot references add 25% more wins per seller); large-perimeter sites priced at $1M + $0.4M/yr ($3M over 5 years vs ~$6M per CBP port site) and mobile kits at $600k + $120k/yr ($1.2M over 5 years vs ~$2.1M per Dedrone kit); Series A sized to need at $12M.

- Raises $17.25M (pre-seed $0.25M 2027 Q1, Seed $5M 2027 Q3, Series A $12M 2028 Q4); peak cash need $7.6M; at least $7.6M in the bank after Series A in every scenario; pays its own way 2029 Q3.
- Sales $21.7M (2029), $54.7M (2030), **$114.4M in 2031 (year 5)**; $100M a year reached 2031 Q4. 2031 mix: mobile kits $44.4M, bases and ports $39.9M, prison/jail/stadium sites $14.2M, integrator sensors $9.4M, heat cameras $3.4M, GPS monitoring $3.0M.
- By the end of 2031: 15.6 state corrections departments (233 prisons), 62 large jails (116 sites), 77 police departments (116 kits), 37 military installations, 42 stadiums.
- A sale at the end of 2031: $573M (4.5x sales) to $1,088M (9x); Seed 20.5x / 38.9x, Series A 7.9x / 15.0x; founders keep 62%. 298 people (191 in sales).
- Scenarios (2031 sales; $100M a year): stuck at 20 dB $106M, 2031 Q4 (but 2032 falls to $99M as the workable sites run out); government slow $71.5M, 2032 Q3; no integrator sales $105M, 2031 Q4; prices 30% lower $74.9M, 2032 Q3 (needs $9.6M); hire faster (20/yr) $132M, 2031 Q3; no faster selling $76.9M, 2032 Q2; FAA program $124M, 2031 Q3.
- Honest caveats: the plan is aggressive. It signs about a third of US state corrections departments and a third of the 100 military installations with drone detections by 2031, and police keep buying kits after the FEMA money ends (50% of the grant-era pace). The downside cases reach $100M a year in 2032 instead.
