# Handoff: current state

Last updated 2026-11-12 by Nimalan. History is in `context/SESSION_LOG.md`.

## Current state

- **Digital twin v0.4.2** in `prototype/` (start with `prototype/README.md`): `.venv/bin/python serve.py`, then http://localhost:8000. Static deploy config for Vercel in `prototype/vercel.json` + `.vercelignore` (not deployed yet). The deploy leaves out `web/runs/*.bin` (Hobby's 100 MB CLI cap): replays play, the raw radar view and new simulations need `serve.py`.
  - **Overview** (outsiders): sliders for the area covered and time tracked the customer wants; the twin recommends the radio and number of sensors, shows our cost and a suggested price (cost + margin), and a today (20 dB) / 30 dB / 40 dB table saying which interference-removal level each answer needs.
  - **Simulation**: what to protect + interference scenario; radio buttons (bladeRF, B210, custom receiver) + sensor slider; other antenna setups can be explored; charts of protection and customer cost vs number of sensors per radio; sensitivity; 3D replay picked by facility, drone and radio.
  - **Financials**: radio + sensor count; every cost and margin editable; sourced parts list for the custom 8-channel receiver (~$1,042/board at 1,000).
  - A (?) tooltip on every setting and result (`web/src/help.js`).
- Precomputed data: `web/data/explore.json` (`python -m twin.explore`, ~40 min; `--maps` redoes only recommendations + coverage maps, ~6 min). 12 full-simulation replays `web/runs/replay-*` + `replays.json` (`tools/make_replays.py`, ~45 min, ~190 MB, committed).
- Three real facilities: Hays State Prison (rural), Hancock State Prison (remote), Fulton County Jail (dense urban). 37 tests (`python -m pytest -q`).
- Results at default targets (90 % area, 80 % tracked, 5 kg drone): Hays works today (4 custom or 6 bladeRF sensors); Hancock needs 40 dB removal; Fulton needs 30 dB (12 custom) or 40 dB (4 bladeRF).
- `Iterations.docx`: one short entry per build (latest: 6. v0.4.2), lessons for the product, risks, assumptions. Generator: `prototype/tools/build_iterations_doc.js`.
- Earlier versions: v0.4 = git commit `8588fac`; `prototype/web/archive/v0.3/`; `prototype/v0.1/`.
- GitHub repo: https://github.com/tripwire-aa261/tripwire-prototype (main).

## Decisions in force

- **Seed = off-the-shelf radios** (bladeRF xA4 $540; B210 fallback). Custom 8-channel receiver = Series A. Reason: Seed must prove the technology with buyable parts; the custom board only pays off at volume (~$4,800 at 100 units).
- **Each radio has one fixed sensor build** on Overview and Financials: bladeRF/B210 = 2 boards, 4 all-round antennas, microphone; custom = 1 board, 8 antennas, microphone. Simulation may explore other builds. Reason: outsiders choose a radio, not antenna details.
- **Interference removal stays out of the Overview**; the Overview says which level an answer needs. Reason: it is a technical unknown, not a customer choice.
- **Costs are estimated by the twin, not set as targets.** Price = our cost + margin (40 % installation, 72 % subscription; ASSUMPTION reproducing the data package prices; editable).
- **Plain language:** a "sensor" is one box on a pole; never "node" in the UI.
- **5 kg drone first; Mavic class at Series A.** Sensors evenly spaced on the fence line; only the three sites for now.
- **Every number cited or labeled ASSUMPTION**; no secrets or papers in git (keys in `prototype/.env` / `.env.local`).
- Commits go straight to main when there are no conflicts (Nimalan's call).

## In progress

- Nothing assigned. Prototype owners per the data package: Nimalan and Sid.

## Next steps

1. Deploy to Vercel from `prototype/` (`vercel`, then `vercel --prod`); check the link on a phone.
2. Choose sensor spots along the fence (greedy placement search) instead of even spacing; re-run the explorer.
3. Plan the Seed recordings: one dense urban site, several hours of the day; measure neighbor-cell interference and test removal (decode-and-subtract, adaptive cancellation, array nulls).
4. Twin: always-on neighbor interference, hourly network busyness, the radio's one-window carrier limit, array nulling.
5. Supplier quotes for a 3-sensor Seed kit; legal review of whole-signal processing; validation against arXiv 2412.20788.

## Open questions

- Can processing remove 30–40 dB of neighbor-cell interference? It decides Hancock and Fulton.
- The fast estimate is optimistic at Hancock and Fulton (full simulations track less; see README findings v0.4.2). Recalibrate it before quoting those sites.
- Do guards need the hover track (microphone), or is "caught before the fence" enough? Ask design partners.
- Do contraband drops happen mostly at night (lowest city interference)?
- Is a software-only prototype acceptable to the teaching team?
