# Handoff: current state

Last updated 2026-11-12 by Nimalan. History is in `context/SESSION_LOG.md`.

## Current state

- **Digital twin v0.4.4** in `prototype/` (start with `prototype/README.md`): `.venv/bin/python serve.py`, then http://localhost:8000. Vercel static deploy config in `prototype/vercel.json` + `.vercelignore` (not deployed; leaves out `web/runs/*.bin` for Hobby's 100 MB cap).
  - Tabs: **Overview** (a "What the customer wants" block: drone, area covered, time tracked, tracking accuracy; recommended radio + sensor count, coverage map, our cost and suggested price, today / 30 / 40 dB table, like-for-like competitor comparison), **Trade space simulator**, **3D signal simulation** (12 precomputed replays + track-error chart), **Financials** (sensor count follows the requirements; re-priced inputs; three pricing models; Company panel with NRE and break-even).
  - Sites by tower density: Hancock (sparse towers), Hays (moderate towers, default), Fulton County Jail (dense towers).
- **For the business plan:** `Tripwire_Assumptions_and_Figures.md` (repo root) has every assumption and figure, generated from the twin by `prototype/tools/build_assumptions_doc.py`. `BUSINESS_PLAN_UPDATE_BRIEF.md` tells a new session how to use it.
- Results (5 kg drone; 90 % area, 80 % tracked, 25 m): Hays works today (4 custom or 6 bladeRF sensors); Hancock needs 40 dB interference removal; Fulton needs 30 dB (12 custom) or 40 dB (4 bladeRF).
- Data: `web/data/explore.json` (2026-11-12, `python -m twin.explore`, ~55 min; `--maps` ~6 min); 12 replays (`tools/make_replays.py`); hover and pole-height study `web/runs/hover_feasibility.json` (`tools/hover_feasibility.py`). 38 tests.
- `Iterations.docx`: entries up to 8 (v0.4.4), lessons, risks, assumptions; generator `prototype/tools/build_iterations_doc.js`.
- Earlier versions: v0.4 = `8588fac`, v0.4.2 = `95a92ce`; `prototype/web/archive/v0.3/`; `prototype/v0.1/`.
- GitHub repo: https://github.com/tripwire-aa261/tripwire-prototype (main).

## Decisions in force

- **Seed = off-the-shelf radios** (bladeRF; B210 fallback); our own 8-channel receiver at Series A. Reason: prove the technology with buyable parts.
- **One fixed sensor build per radio**, hover held in software by **background history** (no microphone). Reason: matches or beats the microphone wherever the radar works; saves hardware. Microphone builds stay explorable.
- **Costs come from the twin**, priced from listings where possible (`twin/cost.py` is the single source; the viewer and the assumptions doc read it). Reason: numbers must be traceable.
- **Margins 40 % / 40 %; cost + margin is the price floor**; value-based pricing recommended (fixed yearly subscription per facility, all-in option; not per-alert). Reason: at the floor a facility earns ~$3-4k/yr, too little to run the company.
- **Custom receiver NRE ($400k) is a company cost**, not in any unit price. Reason: prices must not move with the board count.
- **Compute:** edge GPU board per sensor + one on-site hub per facility.
- **Customer requirements** (drone, area, time tracked, 25 m accuracy) drive the recommendation and the sensor count in Financials.
- **Interference removal stays out of the Overview**; it says which level an answer needs.
- **Competitor comparison is like for like per facility**; competitors' upkeep is left out (not public), the conservative direction for us.
- **Plain language** ("sensor", never "node"); every number cited or labeled ASSUMPTION; no secrets or papers in git.
- **Low poles (~6 m)**: taller poles see more interference in dense areas and blur drone vs person.
- Commits go straight to main when there are no conflicts (Nimalan's call).

## In progress

- Nimalan: updating the business plan from `Tripwire_Assumptions_and_Figures.md` (separate document, not in the repo).

## Next steps

1. Business plan: follow `BUSINESS_PLAN_UPDATE_BRIEF.md`; settle the value-based price level and the company running cost.
2. Seed tests that decide the product: interference removal (30-40 dB?), background stability (-30 dB or better), two-board bladeRF phase lock, Jetson processing capacity.
3. Supplier quotes for the Seed kit (~$6k of hardware) and an installer quote; bottom-up NRE estimate.
4. Recalibrate the fast estimate at Hancock and Fulton against full simulations; add background history to the full simulation.
5. Deploy to Vercel; sensor placement search along the fence.

## Open questions

- Can processing remove 30-40 dB of neighbor-cell interference? It decides Hancock and Fulton.
- Is the quiet background steady to -30 dB or better (wind, vehicles, radio drift)?
- What will prisons pay, and do they buy from capital or service budgets? Procurement anchors to verify (search summaries only): Correctional Service Canada CA$6M for 6 prisons (2019); Tennessee DOC $1.7M request (Feb 2026). Ask design partners.
- Robin IRIS $396k price was seen only in a search result; confirm.
- Is a software-only prototype acceptable to the teaching team?
