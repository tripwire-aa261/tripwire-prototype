# Session log

One entry per Claude Code session, newest first. Written by the `/handoff` skill before each commit. The chat history from before this repo existed is in `Context_log.txt`.

## 2026-11-12 · Nimalan · Twin v0.4.1–v0.4.2: plain language, costed custom receiver, choose by radio

**Asked for:** A lessons section in `Iterations.docx` (tower density, antenna types, off-the-shelf receivers too expensive at many nodes → custom receiver at Series A); costs "estimated from this prototype rather than we set a target"; how to deploy on Vercel; a sourced parts list for the custom receiver; a twin that recommends configuration and lets people "choose how much coverage they want based on the cost"; less jargon ("8-antenna ring vs 8 nodes") with a (?) explanation on every parameter. Then: Overview sliders for coverage % and time tracked % with a recommended configuration, estimated cost and what to charge; interference removal parked under Simulation, with the Overview stating "this technology is not possible now until we get 30dB or 40dB removal"; coverage vs number of nodes graphs per receiver; a shorter picker; 3D replay chosen by prison, drone and radio (bladeRF, B210 or custom); Financials "straightforward, BladeRF, B210 or custom receiver". Finally: push to GitHub.
**Done:**
- `twin/cost.py`: custom 8-channel receiver bill of materials (16 lines, 11 priced from distributors) → ~$1,042/board at 1,000; `customer_price()` = cost + margin.
- `twin/flights.py`: "drones caught" (tracked before crossing the fence). `twin/explore.py`: fixed build per radio (`BUILDS`), recommendation by area + tracking targets, coverage maps for every radio × sensor count, `--maps` mode.
- Viewer v0.4.2 (`web/`): Overview sliders + recommended setup + suggested price + today/30/40 dB table; Simulation radio/sensor picker, protection-vs-sensors and cost-vs-sensors charts (light axis text), replay dropdowns; Financials radio-only; `web/src/help.js` tooltips.
- `tools/make_replays.py` + 12 replays in `web/runs/replay-*` (~190 MB, committed at Nimalan's request).
- `vercel.json`, `.vercelignore`; README and `Iterations.docx` (entries 5 and 6, lessons section) updated. 37 tests pass; UI checked in headless Chromium at 1280 and 390 px (no errors, no page overflow).
**Decided:**
- One fixed sensor build per radio on Overview/Financials; Simulation can still explore others ("Fixed build per radio. But in the simulation section, we can explore the different options").
- Recommendation = cheapest radio + sensor count meeting 90 % area and 80 % tracked (slider defaults, ASSUMPTION), at the lowest interference level that works. Rejected: a long Pareto option table.
- Price = our cost + margin (40 % / 72 %), replacing coverage-tier prices.
- Replays use the recommended sensor count per facility × drone × radio; bladeRF and B210 share one (same performance in the model).
- Push all 12 replays to git despite the size (Nimalan's choice over keeping them local).
**Left open:**
- Vercel deploy not run yet. Sensor placement is still even spacing (greedy fence placement proposed, not started).
- Custom-receiver parts: 5 of 16 lines and assembly/NRE are ASSUMPTIONS; the balun misses band 71.
- Interference removal (30–40 dB) and whole-signal gain remain unmeasured.
- The full-simulation replays track less than the fast estimate at Hancock and Fulton (e.g. Fulton, 4 bladeRF sensors at 40 dB: 62.5 % vs 87 %; Mavic replays there 36–47 % vs 74–88 %). The Overview's recommendations use the fast estimate; recalibrating it there is open.

## 2026-11-10 · Nimalan · Digital twin v0.2–v0.4: real physics, three Georgia facilities, customer requirements and financials

**Asked for:** Build the digital-twin prototype and iterate on it: "pull in the actual physics" at a real Georgia prison; match the Seed Pitch Data Package; coverage vs number of nodes with 80/90/95 % tiers; a receiver cost model; then split the site into Overview (for outsiders: "the outcome"), Simulation ("to play around") and Financials (installation, labour, maintenance), with customer requirements (zone radius, drone height, tracking accuracy and update rate) instead of the memo gates, costs based on the actual number of nodes, a sensitivity analysis, and v0.2/v0.3 kept in an archive tab. Keep `Iterations.docx` short: "a few bullet points or 1 line on what changed".
**Done:**
- `prototype/` rebuilt (v0.1 moved to `prototype/v0.1/`): Python signal-level twin (`twin/`), LTE reference signals, terrain/building diffraction, Fraunhofer processing chain, tracking, calibration to the LTE450 trial (Demissie & Steffes 2025), real antennas, processing modes, microphones, cost model, scored-flight estimate. 33 tests pass.
- Three real facilities from OSM/USGS/FCC/OpenCelliD: Hays State Prison (rural), Hancock State Prison (remote), Fulton County Jail (dense urban). Precomputed explorer `prototype/web/data/explore.json` (`python -m twin.explore`, ~30 min).
- Viewer v0.4 (`prototype/web/`, run `serve.py`): Overview, Simulation, Financials tabs; every financial assumption editable in the browser; v0.3 archived read-only at `web/archive/v0.3/`.
- `Iterations.docx`: short log per build; generator in `prototype/tools/build_iterations_doc.js`.
**Decided:**
- Seed plan uses off-the-shelf radios (bladeRF xA4 at $540, B210 fallback); a custom multichannel receiver is a Series A decision. Rejected: building our own receiver for Seed.
- First target is the 5 kg drone; Mavic class is a Series A milestone (needs 12+ sensors even at the best site).
- Price per facility by coverage tier ($50k install; $18k/$30k/$42k per year for 80/90/95 %, the last two assumptions), not per 3-node zone, which made Hays cost ~4× the incumbent.
- Uncertain values are labeled assumptions and editable on the page rather than debated.
- Overview shows today's interference assumption and the optimistic one side by side.
- The LTE450 paper PDF and all keys stay out of git (`.gitignore`). Commits go straight to main when there are no conflicts (Nimalan's call).
**Left open:**
- Biggest unknown: how much interference from neighboring cells on the same carrier the processing removes. At 20 dB (assumed) only Hays works; at 40 dB (unproven) all three do. Needs the Seed recordings, ideally at a city site and at several hours.
- Enhanced (full-signal) processing gain is assumed ideal; legal review needed because it demodulates downlink data symbols.
- Model gaps: idle networks still send always-on signals (night interference too optimistic); radios capture only one ~56 MHz window, which limits the carriers a sensor can use; the fast flight estimate was calibrated at Hays only and is optimistic at Fulton (87 % vs 62.5 % in the full simulation).
- Antenna, labour and maintenance prices are assumptions awaiting supplier quotes.

## 2026-11-01 · Siddarth · Remove remaining hardware-spec mentions from v2

**Asked for:** Remove feedback question 4 and the diagram's "Hardware spec" box. Siddarth briefly reversed this, then confirmed the removal.
**Done:** Both removed from the v2 doc. `Tripwire_Prototype_Feedback_Request_v2.docx` rebuilt; it now has 3 feedback questions.
**Decided:** v2 makes no mention of the hardware spec. It stays in the detailed proposal and the final deliverable.
**Left open:** Feedback question 1 still says "with hardware as the path to product", which is kept as written.

## 2026-11-01 · Siddarth · Drop "Path to a product" from the v2 feedback request

**Asked for:** Remove the path-to-product section from the feedback-request version.
**Done:** Deleted the section (hardware spec, engineering, testing, manufacturing, approvals, cost) from the v2 doc and rebuilt `Tripwire_Prototype_Feedback_Request_v2.docx`. The path-to-product content still exists in `Tripwire_Prototype_Proposal.docx` and in Decisions in force in HANDOFF.md.
**Decided:** The feedback request describes only the prototype; path to product is saved for the final deliverable.
**Left open:** Feedback question 4 still mentions "the hardware spec", and the diagram still has a "Hardware spec" box. Neither is explained in v2 any more. Siddarth to decide whether to keep them.

## 2026-11-01 · Siddarth · Trim the v2 feedback questions

**Asked for:** Remove the v2 feedback question asking the teaching team for datasets or Stanford contacts. Siddarth: "They will shoot back at us that we are supposed to find relevant profs working in this field... this is something we can do on our own."
**Done:** Deleted that question from the v2 doc and rebuilt `Tripwire_Prototype_Feedback_Request_v2.docx`, which now has 4 feedback questions. Finding faculty and datasets moved to Next steps in HANDOFF.md.
**Decided:** The team sources faculty contacts and datasets itself rather than asking the teaching team.
**Left open:** v2 still not sent to the teaching team.

## 2026-11-01 · Siddarth · Repo setup, prototype proposal, feedback request v1 and v2

**Asked for:**
- Set up this folder as a git repo shared with the team.
- Read the brief, memo, idea notes and chat log.
- Plan a prototype that impresses investors and meets the brief, and can extend to other industries and signal sources.
- Write a short, low-jargon doc asking the teaching team for feedback.
- Make every commit carry Claude chat context so teammates can continue.

**Done:**
- Created the private GitHub repo `sura2903/tripwire-prototype` and pushed it.
- Wrote a detailed proposal (`Tripwire_Prototype_Proposal.docx`), then two 2-page feedback requests (`..._Feedback_Request.docx` and `..._v2.docx`), each with a Claude Docs version.
- Added this handoff workflow: `CLAUDE.md`, the `/handoff` skill, and a commit hook in `.claude/settings.json`.

**Decided:**
- Dropped Starlink as a signal source because its format is proprietary. Using FM radio, digital TV and satellite TV (DVB-S2) instead.
- Dropped GPU-dependent ray tracing; the team has no GPUs.
- Owner column left blank (Siddarth cleared it in Word).
- Pivoted from a 3D digital-twin demo to a trade-space evaluator plus national site survey. Reasons: a simulation-only twin risks looking like a 20-minute rebuild, and building hardware is too risky. Hardware is the written path to product.
- Kept the detailed proposal at 3 pages rather than trimming it, at Siddarth's request.

**Left open:**
- v2 not yet sent to the teaching team.
- Go-to-market ideas for other industries were discussed in chat but not written into any doc:
  - channel partners (Anduril Lattice, Dedrone)
  - tower companies as hosts
  - a low-altitude airspace data feed
  - bird and bat monitoring for wind farms and airports
  - perimeter intrusion detection
  - remote sites
- The commit hook was tested by piping sample inputs, and on Siddarth's Windows machine. It is not yet confirmed on a teammate's Mac.
