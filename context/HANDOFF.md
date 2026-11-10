# Handoff: current state

Last updated 2026-11-10 by Nimalan. History is in `context/SESSION_LOG.md`.

## Current state

- **Digital twin v0.4** in `prototype/` (start with `prototype/README.md`): `.venv/bin/python serve.py`, then http://localhost:8000.
  - Overview tab (outsiders), Simulation tab (customer requirements in, cheapest design out, sensitivity, 3D replay), Financials tab (editable hardware, installation, labour, maintenance, pricing).
  - Three real facilities: Hays State Prison (rural), Hancock State Prison (remote), Fulton County Jail (dense urban).
  - Physics: LTE reference signals, terrain and building diffraction, Fraunhofer LTE450 processing chain, tracking; calibrated to the LTE450 trial. 33 tests (`python -m pytest -q`).
  - Earlier versions: `prototype/web/archive/v0.3/` (also plays the v0.2 runs) and `prototype/v0.1/`.
- `Iterations.docx`: one short entry per build (what did not work, what changed), risks, key assumptions, pitch points.
- `Your Seed Pitch Data Package and Prototype.pdf`: the team's draft data package; the twin uses its prices and costs.
- Planning docs from 2026-11-01 (feedback requests v1/v2, proposal) are unchanged.
- GitHub repo: https://github.com/tripwire-aa261/tripwire-prototype (main).

## Decisions in force

- **Seed = off-the-shelf hardware** (bladeRF xA4 $540, B210 fallback; 12-bit or better). Custom multichannel receiver = Series A. Reason: the Seed gate needs recordings and a costed plan with supplier quotes.
- **5 kg drone first; Mavic class at Series A.** Reason: the Mavic needs 12+ sensors even at the best site.
- **Price per facility by coverage tier**, not per 3-node zone. Costs scale with the real sensor count.
- **Customer requirements drive the design:** protected distance, drone height, area covered, time tracked, accuracy, update rate.
- **Uncertain numbers are labeled ASSUMPTION and editable** in the viewer; every number cited or labeled.
- **No secrets or papers in git:** keys go in `prototype/.env` or `.env.local` (ignored); the LTE450 paper PDF is ignored.
- **Software-only prototype** for the course; no GPUs; no Starlink (from 2026-11-01).

## In progress

- Nothing assigned. Prototype owners per the data package: Nimalan and Sid.

## Next steps

1. Plan the Seed recordings: at least one dense urban site, several hours of the day; measure neighbor-cell interference and test removal (decode-and-subtract, adaptive cancellation, array nulls) offline.
2. Twin: add always-on neighbor interference, an hourly network-busyness profile, the radio's one-window carrier limit, and array nulling.
3. Supplier quotes for a 3-sensor Seed kit (bladeRF, antennas, computer, enclosure).
4. Legal review of full-signal processing (it demodulates downlink data symbols, never decrypts content).
5. Independent validation against arXiv 2412.20788.

## Open questions

- Can processing remove ~40 dB of neighbor-cell interference? It decides whether remote and city sites work.
- Do contraband drops happen mostly at night (when city interference is lowest)? Ask design partners.
- Is a software-only prototype acceptable to the teaching team? (asked in feedback request v2)
