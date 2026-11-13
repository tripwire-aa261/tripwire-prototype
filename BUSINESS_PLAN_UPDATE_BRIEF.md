# Brief: updating the business plan from the prototype

For a new Claude Code session (any computer) whose job is to bring the business plan and its financials in line with the
prototype. Written 2026-11-12 at twin v0.5.1.

> **NEW since v0.4.5 (2026-11-12, twin v0.5 and v0.5.1). If you already updated the plan from v0.4.5, add only
> these:**
>
> 1. **A second customer type, stadiums** (Clemson Memorial Stadium, SC). Figures: `Tripwire_Assumptions_and_Figures.md`
>    section 8 (rows marked **NEW**) and section 12 (*Stadium: where to put the sensors*). Not possible at 20 dB of
>    interference removal; 30 dB: 8 custom-receiver or 12 bladeRF sensors; 40 dB: 6 of either. Price at cost + 40%:
>    $33,147 + $5,467/yr (8 custom, 30 dB) to $26,110 + $4,601/yr (6 custom, 40 dB).
> 2. **Stadium positioning:** the bowl layer that also sees drones emitting nothing, sold next to an RF detector (the FAA
>    stadium restriction reaches 3 nautical miles and security wants the pilot's location; RF detectors cover both).
>    Stadium prices and buying process are untested.
> 3. **Do not claim drone-vs-bird classification yet:** the twin cannot tell them apart (v0.5.1 finding); it is a Seed
>    measurement.
> 4. **Unchanged:** every price, cost, margin and prison result from v0.4.5.
>
> The **WHAT'S NEW** block at the top of `Tripwire_Assumptions_and_Figures.md` has the full list.

## 1. Set up

```
git clone https://github.com/tripwire-aa261/tripwire-prototype.git
cd tripwire-prototype
```

- Put the business plan document(s) you are updating into this folder (or tell Claude where they are). They are not in
  the repo.
- Optional, to look at the prototype: `cd prototype`, then `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
  (Windows: `.venv\Scripts\pip`), then `.venv/bin/python serve.py` and open http://localhost:8000. It needs internet for
  the 3D library.
- Not in git on purpose: the LTE450 paper PDF and any API keys. The business plan does not need either.

## 2. Read in this order

1. `Tripwire_Assumptions_and_Figures.md`: **the source of truth for every number** (costs, prices, margins, company
   costs, per-facility results, competitor figures, technical assumptions, sources). Each figure is tagged CITED,
   MEASURED, FIT, STANDARD, ASSUMPTION or DECISION.
2. `context/HANDOFF.md`: current state, decisions in force, open questions.
3. `prototype/README.md`: what the twin does and the findings per version (v0.5.1 at the top).
4. `Iterations.docx`: one short entry per build (what did not work, what changed), lessons for the product, risks, key
   assumptions.
5. Background only: `Your Seed Pitch Data Package and Prototype.pdf` (the team's earlier planning numbers),
   `Big Idea Investment Memo v2.pdf` (the Seed memo).

## 3. Rules for the update

- **Do not type numbers into the plan from memory or from older documents.** Take them from
  `Tripwire_Assumptions_and_Figures.md`. If the plan needs a number that is not there, add it to the twin
  (`prototype/twin/cost.py`) and regenerate: `cd prototype && .venv/bin/python tools/build_assumptions_doc.py`.
- Keep the tags: anything ASSUMPTION in the source stays labeled as an assumption in the plan. Investors and graders
  will check.
- Where the plan disagrees with the prototype, the prototype wins unless the team decides otherwise; record the decision
  in `context/HANDOFF.md`.
- US spelling. Run `/handoff` before every commit (the repo's hook enforces it).

## 4. What changed since the Seed data package (headline)

| | Data package | Prototype v0.5.1 |
|---|---|---|
| Hardware per 3 sensors | $24,000 | ~$5,500 (standard bladeRF sensor $1,825) |
| Deployment per 3 sensors | $6,000 | ~$1,530 + $3,000 per facility (set-up + on-site hub) |
| Maintenance per 3 sensors per year | $5,000 | ~$2,000 |
| Margins | 40% install / 72% subscription | 40% / 40% (team decision) |
| Custom receiver design cost | not separate | $400k one-time company cost (Series A), not in any unit price |
| Pricing unit | per 3-node zone | per facility, sized to the sensors it needs |

Exact figures and their basis: sections 2-10 of the assumptions file.

## 5. Points the business plan must carry

- **Seed = off-the-shelf radios (bladeRF), Series A = our own 8-channel receiver** ($642 per board at 1,000 boards).
- **Compute:** an edge GPU board in each sensor + one on-site hub per facility; one internet line per facility.
- **Hover:** held in software (background history) instead of a microphone; depends on background stability (-30 dB or
  better), to be measured at Seed.
- **Pricing:** cost + 40% is the floor. At the floor a facility earns ~$3-4k/yr gross profit, so ~250-330 facilities
  would be needed to cover a $1M/yr company (ASSUMPTION); at the data package's prices ($50,000 + $18,000/yr) it is
  ~45. Recommend a fixed yearly subscription per facility, priced from value and below today's options, with an all-in
  (nothing upfront) option. Not per-alert. Price levels to test with design partners.
- **Competitors, one facility:** radar-based system ~$162k-851k over 5 years; one Robin IRIS radar $396k (confirm);
  RF-only Dedrone $57,915 hardware + installation.
- **Technology risk to retire first:** interference removal. Today's assumption (20 dB) works only at the moderate-tower
  site (Hays); the sparse-tower (Hancock) and dense-tower (Fulton) sites need 30-40 dB, unproven.
- **Customer requirements** the plan can quote: 90% of the area within 150 m of the fence covered, a drone tracked 80%
  of the time, located within 25 m, and the typical incoming drone first tracked at least 300 m outside the fence
  (DECISION: defaults; section 11 of the assumptions file). At Hays the typical drone is picked up ~440-500 m out, but
  drones from one direction (south-southwest) only ~50-300 m out, so do not promise a range for every drone.
- **NEW. Stadiums (Clemson Memorial Stadium):** sensors alternate between the top of the stands and poles outside
  (poles alone cannot see into the bowl). Needs 30 dB of interference removal (8 custom or 12 bladeRF sensors) or 40 dB
  (6 of either); not possible at 20 dB. The FAA's 3-nautical-mile stadium restriction and the need to find the pilot are
  better served by RF detectors, so position Tripwire as the bowl layer that also sees drones emitting nothing. The
  stadium's own cell antennas, game-day load and the crowd are not modeled (assumptions file, section 12).
- **NEW. Drone vs bird:** the twin cannot yet tell them apart (the rotor score separates nothing), so do not claim
  classification; the replays often track the bird. Fix and measurement planned (assumptions file, section 13).
- **Known model optimism:** full simulations track less than the fast estimate at Hancock and Fulton; treat those sensor
  counts as minimums.

## 6. Starter prompt for the new session

> Read `BUSINESS_PLAN_UPDATE_BRIEF.md`, then `Tripwire_Assumptions_and_Figures.md` and `context/HANDOFF.md`. I want to
> update our business plan document `<file name>` so every cost, price, margin, market comparison and technical claim
> matches the prototype. First list every number and claim in the plan that differs from the assumptions file (old value,
> new value, source section), and anything the plan states that the prototype does not support. Ask me before changing
> pricing strategy or anything tagged DECISION. Then make the changes.
