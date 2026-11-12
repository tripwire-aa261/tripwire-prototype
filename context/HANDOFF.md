# Handoff: current state

Last updated 2026-11-12 by Nimalan. History is in `context/SESSION_LOG.md`.

## Current state

- **Digital twin v0.4.5** in `prototype/` (start with `prototype/README.md`): `.venv/bin/python serve.py`, then http://localhost:8000. Vercel static deploy config in `prototype/vercel.json` + `.vercelignore` (not deployed; leaves out `web/runs/*.bin` for Hobby's 100 MB cap).
  - Tabs: **Overview** ("What the customer wants": drone, area covered, time tracked, tracking accuracy, detection range; recommended radio + sensor count, coverage map, our cost and suggested price, today / 30 / 40 dB table, like-for-like competitor comparison), **Trade space simulator**, **3D signal simulation** (12 precomputed replays + track-error chart), **Financials** (sensor count follows the requirements; three pricing models; Company panel with NRE and break-even).
  - Sites by tower density: Hancock (sparse towers), Hays (moderate towers, default), Fulton County Jail (dense towers).
- **For the business plan:** `Tripwire_Assumptions_and_Figures.md` (repo root) has every assumption and figure, generated from the twin by `prototype/tools/build_assumptions_doc.py`. `BUSINESS_PLAN_UPDATE_BRIEF.md` tells a new session how to use it.
- Results (5 kg drone; 90 % area, 80 % tracked, 25 m, typical drone first tracked 300 m outside the fence): Hays works today (4 custom or 6 bladeRF sensors; typical drone picked up ~500 / ~440 m out); Hancock needs 40 dB interference removal (6 custom, or 12 bladeRF); Fulton needs 30 dB (12 custom) or 40 dB (4 custom, or 6 bladeRF).
- Detection range is uneven by direction: at Hays drones from the south-southwest are first tracked only ~50-300 m out even with 16 sensors, so the 8-in-10 range is ~30-50 m.
- Data: `web/data/explore.json` (2026-11-12, `python -m twin.explore`, ~78 min; `--maps` ~6 min); 12 replays (`tools/make_replays.py`); hover and pole-height study `web/runs/hover_feasibility.json` (`tools/hover_feasibility.py`). 38 tests.
- `Iterations.docx`: entries up to 9 (v0.4.5), lessons, risks, assumptions; generator `prototype/tools/build_iterations_doc.js`.
- Earlier versions: v0.4 = `8588fac`, v0.4.2 = `95a92ce`, v0.4.4 = `e7bf0ea`; `prototype/web/archive/v0.3/`; `prototype/v0.1/`.
- GitHub repo: https://github.com/tripwire-aa261/tripwire-prototype (main).

## Decisions in force

- **Seed = off-the-shelf radios** (bladeRF; B210 fallback); our own 8-channel receiver at Series A. Reason: prove the technology with buyable parts.
- **One fixed sensor build per radio**, hover held in software by **background history** (no microphone). Reason: matches or beats the microphone wherever the radar works; saves hardware. Microphone builds stay explorable.
- **Costs come from the twin**, priced from listings where possible (`twin/cost.py` is the single source). Reason: numbers must be traceable.
- **Margins 40 % / 40 %; cost + margin is the price floor**; value-based pricing recommended (fixed yearly subscription per facility, all-in option; not per-alert). Reason: at the floor a facility earns ~$3-4k/yr, too little to run the company.
- **Custom receiver NRE ($400k) is a company cost**, not in any unit price. Reason: prices must not move with the board count.
- **Compute:** edge GPU board per sensor + one on-site hub per facility.
- **Customer requirements** (drone, area, time tracked, 25 m accuracy, 300 m detection range) drive the recommendation and the sensor count in Financials. Detection range applies to the **typical** drone; 8 in 10 is shown, not required. Reason: no setup meets 8 in 10 at Hays (direction-dependent blind sector).
- **Interference removal stays out of the Overview**; it says which level an answer needs.
- **Competitor comparison is like for like per facility**; competitors' upkeep is left out (not public), the conservative direction for us.
- **Plain language** ("sensor", never "node"); every number cited or labeled ASSUMPTION; no secrets or papers in git.
- **Low poles (~6 m)** at prisons: taller poles see more interference in dense areas and blur drone vs person. Customer provides poles, power and network (not priced).
- Commits go straight to main when there are no conflicts (Nimalan's call).

## In progress

- Nimalan: updating the business plan from `Tripwire_Assumptions_and_Figures.md` (separate document, not in the repo).
- Next build (approved 2026-11-12): **Clemson Memorial Stadium (SC)** as a fourth, stadium-customer site. Compare sensors on 6 m poles vs on the stadium structure (rim/light towers) vs a mix, then add the winner to the explorer, maps, replays, viewer and docs. Defaults (ASSUMPTION): drones over the field at 30-120 m, 150 m buffer, 30 % network load with a game-day option.

## Next steps

1. Stadium site (above). Flag what the twin cannot model: in-stadium cell antennas (DAS), game-day load, crowd clutter; the FAA stadium restriction is 3 NM / 3,000 ft, beyond our range, and stadiums want the pilot's location (RF detectors do that, we do not).
2. `Iterations.docx`: fix stale receiver figures in the lessons (8-antenna sensor $10,553 B210 / $3,165 bladeRF / $1,601 custom; 12 sensors $127k / $38k / $19k), drop the microphone pitch point, add the new lessons (interference, hover, poles, detection range by direction, small drones, cost structure, pricing).
3. List tracker settings and pole assumptions in the model notes and the assumptions doc.
4. Business plan: follow `BUSINESS_PLAN_UPDATE_BRIEF.md`; settle the value-based price level and the company running cost.
5. Seed tests that decide the product: interference removal (30-40 dB?), background stability (-30 dB or better), two-board bladeRF phase lock, Jetson processing capacity.
6. Sensor placement search along the fence (fixes the weak direction at Hays); recalibrate the fast estimate at Hancock and Fulton against full simulations; supplier and installer quotes; deploy to Vercel.
7. Optional quick hardware demo: 3 ESP32s + phone hotspot (Espressif `csi_recv_router`), change detector vs background-history detector.

## Open questions

- Can processing remove 30-40 dB of neighbor-cell interference? It decides Hancock and Fulton.
- Is the quiet background steady to -30 dB or better (wind, vehicles, radio drift)?
- What will prisons (and stadiums) pay, and from capital or service budgets? Procurement anchors to verify (search summaries only): Correctional Service Canada CA$6M for 6 prisons (2019); Tennessee DOC $1.7M request (Feb 2026). Ask design partners.
- Robin IRIS $396k price was seen only in a search result; confirm.
- Do facilities have usable ~6 m poles where sensors need to go, and can sensors sit on the fence line?
- Is a software-only prototype acceptable to the teaching team?
