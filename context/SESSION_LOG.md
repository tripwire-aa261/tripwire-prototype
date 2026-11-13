# Session log

One entry per Claude Code session, newest first. Written by the `/handoff` skill before each commit. The chat history from before this repo existed is in `Context_log.txt`.

## 2026-11-12 · Sid · Draft 5: assignment gaps filled, citations, model backlog

**Asked for:** check Draft 4 against the assignment brief, then "do all ten" gaps, fix the $25,471 wording, make a Draft 5, "Do not hallucinate any numbers", and "be more rigorous with your citations especially in text".
**Done:**
- Draft 5 (Claude doc https://claude.ai/artifact/HxtL3TWcyArFEYFmxv95tE, pasted into the Google Doc tab "Draft Report 5"): sales and operating cash flow chart 2027-2042; weighted backlog vs sales chart; products and path to $100M (about 2,460 facilities, about 570 customers); contracts and renewals; direct sales to prisons and integrators for stadiums; adoption barriers; commercial Seed tests; integration, manufacturing and vendor-risk sections; headcount at $100M (about 219). Inline source next to each number (prototype figures file with section, financial model, FCC tower register, BLS pages, or "assumption"/"plan"); source lines under tables.
- Financial model v11: weighted backlog (remaining contract value, churn-weighted) and its chart; sensor hardware cost slider (+-30% moves peak need $19.2M-$21.9M); gross-profit line rewritten; minus signs explained in the table.
- Product prototype tab: "From prototype to product" section (engineering challenges, testing, manufacturing, development cost about $4.1M from the model) inserted in place, keeping two teammate comments.
**Decided:**
- Partner economics: no published counter-drone margin found; cited the 37.5% average integrator gross margin on video surveillance projects (Security Sales & Integration, 2020) as the planning level; the model keeps stadium sales direct.
- Removed an unsourced "two hours' drive" claim; replaced "a third less" with BLS figures.
**Left open:**
- Teammate comments on the prototype tab's Overview heading ("what we can promise the customer"): heading and caption not yet reworded.
- Prototype link, recording and ESP32 test placeholders; Vercel deploy by a teammate.

## 2026-11-12 · Sid · Business plan Draft 4, financial model rebuild, Clemson and Atlanta decisions

**Asked for:** clean up the team Google Doc ("fully clean up everything with the new company plan, numbers from the prototype"), address all of Sid's comments, fill in the funding, hiring, regulatory, go-to-market and technical plans, and redo the financial model ("not super long", "should not feel AI written", "specific about the claims"). Later: switch the stadium after a tower survey, implement Sid's 23 comments on Draft 3 plus PR #2's stadium results, fix the Google Doc formatting, commit and merge.
**Done:**
- Google Doc tabs "Draft Report 3" (with Sid's comments) and "Draft Report 4" (current), written in the Claude doc https://claude.ai/artifact/HxtL3TWcyArFEYFmxv95tE and pasted with Draft Report 2's styling, a roadmap, cash chart and pricing chart as images.
- Financial model rebuilt per facility from the twin's costs (`prototype/web/financial-model.html`, also https://claude.ai/artifact/1AEzgXgBakzE4U8wNmUqwb v9): stadium segment, 12-sensor Clemson pilot ($77k fee), bladeRF vs own-receiver costs side by side, Atlanta salaries, regulatory lead at Series A; merged another session's drop-down layout.
- FCC tower survey (file in `prototype/data/raw/fcc/`, git-ignored): within 5 km, Clemson 10 structures, Sanford 21, Atlanta Motor Speedway 17, Truist Park 28, Bobby Dodd 47 (Hays 6, Fulton 53).
- Merged PR #2 (twin v0.5.1) into main.
**Decided:**
- Price $25,000 + $25,000/yr per facility, set against the own-receiver cost (Sid: "self developed cost estimates to be used after the seed round").
- Stadium = Clemson Memorial Stadium (fewest towers among large venues; no Georgia venue close to Hays); the twin then showed it needs 30 dB, so the pre-seed live demo is at Hays and Clemson gets recordings.
- Company in Atlanta (Sid chose it over Bay Area). Model hosted as an HTML file in the repo (artifact links need a claude.ai sign-in).
- No full-time regulatory hire until Series A; hourly counsel ~$80k/yr and Taras until then (Sid agreed; saves ~$0.4M).
- Replaced two unsourced competitor figures ("$40k/yr" and "$200k per SC prison") with South Carolina's $240k Dedrone purchase and AirSight's published ranges.
**Left open:**
- Draft 4's GitHub link to the model works only as source until the prototype is deployed.
- Georgia HB 1230 signing and the SAFER SKIES contractor question are unconfirmed.
- `Tripwire_Prototype_Feedback_Request_v2.docx`: local wording edits from 2026-11-04 (not this session) committed later at Sid's request to bring GitHub up to date.
- Later in the session: Google Doc "Product prototype" tab rewritten as a walkthrough (screenshots of the four twin tabs and the model, GPS test figures, lessons table); prototype link, recording and ESP32 test left as placeholders. Sid chose to have a teammate do the Vercel deploy.

## 2026-11-12 · Nimalan · Twin v0.5–v0.5.1: stadium site, sensors on the structure, bird display option

**Asked for:** "Clemson Memorial Stadium in South Carolina to know how it is like for stadium based customers ... We should place the nodes on top the stadium infrastructure itself. What do you think?" (then "commit and push first, then build the stadium"); version numbering (v0.5, then v0.5.1 for the bird change); "make the bird optional checkbox in the sim for now" after noticing the bird gets a track estimate; finally, update the handoff, the figures/financials md and the other docs with everything that changed, "and highlight it ... so that he can easily integrate it into his work".
**Done:**
- Site: `prototype/data/sites/clemson-memorial-stadium/` (OSM relation 4131933, stands with the field as a hole, USGS terrain; FCC + OpenCelliD towers: 9 likely cell towers within 5 km, nearest 2.1 km). `tools/fetch_site.py` reads multipolygon relations (`--osm-rel`, `--height`) and retries busy Overpass servers; `twin/geo.py` and the 3D view handle building holes; `scene.building_reflectors` spreads stadium-sized rings.
- Mounting: `Params.mount` (pole / structure / mixed), `setback_m`, `structure_inset_m`, `roof_mast_m`; per-site settings `scenarios.SITE_PARAMS` (stadium: mixed, 20 m setback, microphones off). `tools/placement_study.py` → `web/runs/placement_study.json`.
- Explorer: `python -m twin.explore --site clemson` merges one site (~17-25 min); stadium points, maps and 4 replays (`web/runs/replay-clemson-*`, ~88 MB; full simulation tracks 83-86 %). `make_replays.py` keeps earlier replays' metrics.
- Viewer v0.5.1: stadium chip and wording (`edgeWord`, `mountText` in `web/src/data.js`), help text, version badge; 3D **Bird** checkbox (hides the bird and its tracks; display only).
- Docs: highlighted **WHAT'S NEW** block and **NEW** markers in `Tripwire_Assumptions_and_Figures.md` (stadium rows, stadium study, tracker settings, pole assumptions, FAA source [16]); NEW block in `BUSINESS_PLAN_UPDATE_BRIEF.md`; README v0.5 / v0.5.1; `Iterations.docx` entries 10-11. 43 tests pass; all tabs checked headless at 1280 and 390 px (only the expected `/api/meta` 404 with a static server).
**Decided:**
- Stadium sensors alternate between the top of the stands and 6 m poles outside. Poles alone never see into the bowl (at most ~50-65 % of the inside covered); on the stands alone they see every tower and lose the area around the stadium below 40 dB. Rejected: stands only (the user's first idea) and poles only.
- Microphones off at the stadium (game-day crowd noise, ASSUMPTION). Stands 30 m tall (ASSUMPTION; no reliable published height).
- Stadium positioning: the bowl layer next to an RF detector (FAA 3 NM restriction and pilot location are RF-detector strengths).
- Bird checkbox is display only and on by default; the classifier fix was proposed, not built ("for now").
- Version numbers: v0.5 for the stadium, v0.5.1 for the bird option.
**Left open:**
- Drone-vs-bird classification does not work: rotor score above 6 dB on 37 % of drone, 33 % of bird and 65 % of false detections. Proposed fix: rotor evidence accumulated over a track + flight behavior, alerts only on drone-classified tracks, re-scoring the saved replays.
- Stadium: no bowl-specific area target (16 poles "meet" 90 % while a third of the bowl is blind); DAS, game-day load and crowd clutter not modeled; real stand height and mounting points unknown; stadium pricing untested.
- Still open from before: stale receiver figures in the `Iterations.docx` lessons; new lessons 4-16 not added.

## 2026-11-12 · Nimalan · Twin v0.4.5: detection range as a customer requirement

**Asked for:** "when the drone is first detected. Essentially the range. For example, 600m. Customer can also choose what is the drone detection range in the overview page." Also in this session (discussion only, nothing built): a check of the numbers in Nimalan's "What we learnt from the prototype" text, more lessons from the prototype, how to demo the idea with ESP32 WiFi boards (then with only 3 ESP32s and RFID tags), whether the tracking estimate uses filters, the sensor pole height, and adding Clemson Memorial Stadium (SC) as a stadium-customer site with sensors on the stadium structure (approved; next session's work).
**Done:**
- `twin/flights.py`: detection range = distance outside the fence where the first held track (3 updates) began, only before the drone crosses the fence; never tracked = 0 m. Scored flights now start 1,800 m out (was 1,100 m, which capped ranges at ~700 m). `twin/explore.py`: stores `det50` (typical drone), `det80` (8 in 10) and per-flight `[bearing, range]`; recommendation requires det50 >= `detection_m` (300 m default). Explorer re-run 2026-11-12 (~78 min).
- Viewer: fifth requirement slider "Detection range" (`web/src/requirements.js`), Detection range card on Overview and Trade space simulator (typical, 8 in 10, late directions), help text, 5-column requirements grid.
- `Tripwire_Assumptions_and_Figures.md` regenerated (detection column + note), `BUSINESS_PLAN_UPDATE_BRIEF.md` (v0.4.5, detection requirement), README v0.4.5, `Iterations.docx` entry 9. 38 tests pass; Overview/Simulation/Financials checked in headless Chromium at 1280 and 390 px with the new data (no errors, no overflow).
**Decided:**
- Detection range measured outside the fence; requirement on the typical (median) drone, 300 m default ("Typical drone, 300 m default"). Rejected: 8 in 10 as the requirement, because no setup at Hays meets it (drones from the south-southwest are first tracked only ~50-300 m out even with 16 sensors); 8 in 10 and the weak directions are shown as information.
- Result: cheapest recommendations unchanged (Hays 4 custom / 6 bladeRF; Hancock 40 dB 6 custom; Fulton 30 dB 12 custom, 40 dB 4 custom). bladeRF needs more at two sites: Fulton 40 dB 6 (was 4), Hancock 40 dB 12 (was 6).
- Advice given: ESP32 demo = phone hotspot as the "tower", 3 ESP32s running Espressif's `csi_recv_router`, a change detector vs a background-history detector to show the hover fix; RFID tags add little (ground-truth timing at most). Stadium: model sensors both on 6 m poles and on the stadium structure and let the twin decide.
**Left open:**
- Stale figures in the `Iterations.docx` lessons (off-the-shelf receiver costs: now $10,553 / $3,165 / $1,601 per 8-antenna sensor, 12 sensors $127k / $38k / $19k) and a pitch point that still mentions microphones; new lessons 4-16 discussed but not added.
- Tracker settings (Kalman q = 1.5 m/s², 15 m / 40 m noise, 4-sigma gate, 2-of-3 confirmation, 40 m merge) are only in `twin/locate.py`; not yet listed as assumptions. The fast estimate runs no Kalman filter (rules only, accuracy x4.5 FIT).
- Pole assumptions to state: customer provides 6 m poles, power and network; new poles are not priced; sensors sit exactly on the fence (no setback).
- Stadium site (Clemson Memorial Stadium): approved, not started. In-stadium cell antennas (DAS), game-day network load and crowd clutter are not modeled.

## 2026-11-12 · Nimalan · Twin v0.4.3–v0.4.4: hover in software, realistic costs, pricing models, business-plan inputs

Two Claude sessions worked in parallel and coordinated by message; this entry covers both.

**Asked for:** Replace the microphone with "reference history of baseline signals" for the hover ("only for the hover part and use the former approach for everything else"), after a preliminary feasibility computation and "basic pole height calcs"; "if this does not work then no problem, lets go back to earlier tech". Revise Financials "with more realistic costs" (e.g. a microphone "should not cost 100 dollar"; compute "too expensive"), both margins 40 %, the NRE "separately on top", not varying with the board count; advice on fixed subscription vs on-demand, "competitive while being sustainable". A markdown file with all assumptions and figures for updating the business plan, and everything needed to continue on another computer. Other session's asks: rename Simulation to "Trade space simulator", picker below the graphs, a simpler "what moves the result", a 3D tab with an error graph between ground truth and track, Financials repeating the customer requirements with no adjustable sensor count, highlighted customer parameters plus a tracking-accuracy target, sites renamed by tower density (Hays in the middle, default), and a fair, researched competitor comparison (Nimalan's figures: $20-70k per radar, 3-5 per prison).
**Done:**
- `twin/hover.py` + `hover_history` scoring in `twin/flights.py`; new fixed builds `ring4_enh_hist` / `ring8_enh_hist`; `tools/hover_feasibility.py` (hover and pole-height study). Explorer re-run 2026-11-12 (first attempt ran out of memory; profiles compacted).
- `twin/cost.py` re-priced (Jetson $249, GPS $16, clock $30, enclosure $190 + arrestors, mic $25, 6 h at $60/h install, hub $500, running costs per facility), margins 40/40, three pricing models, NRE separate, competitor benchmarks.
- Viewer: Financials pricing-model selector and Company panel; history builds. Other session: `web/src/requirements.js` (shared requirements block; `meets()` requires 25 m accuracy), derived sensor count in Financials, Trade space simulator layout and top-4 sensitivity chart, 3D signal simulation tab with track-error chart, site renames, competitor comparison (radar system ~$162k-851k over 5 years; Robin IRIS $396k; RF-only Dedrone $57,915).
- `Tripwire_Assumptions_and_Figures.md` + `tools/build_assumptions_doc.py`; `BUSINESS_PLAN_UPDATE_BRIEF.md`; README (v0.4.4), `Iterations.docx` (entries 7-8). 38 tests pass; all four tabs checked at 1280 and 390 px with no errors.
**Decided:**
- Keep background history as the standard hover hold: matches or beats the microphone where the radar works (Hays 88.9 % vs 88.3 % tracked); the microphone only helps where the radar fails. Rejected: going back to microphones.
- Edge GPU per sensor + on-site hub; raw samples cannot leave the pole. Rejected: per-sensor $800 computers or central raw processing.
- Cost + 40 % is the floor; recommend value-based fixed yearly subscription with an all-in option; not per-alert (protection must always be on; per-alert bills rise when attacked; billing disputes).
- Low poles (~6 m): 15-25 m poles cut Fulton coverage to 11-61 % and blur drone vs person.
- Other session: accuracy target 25 m (ASSUMPTION); 3-5 radars per prison is an ASSUMPTION from a ~120° field of view (Echodyne); competitors' upkeep left out (not public), the fair direction for us.
**Left open:**
- Background stability, interference removal, two-board bladeRF phase lock and Jetson capacity are unmeasured (Seed).
- Many costs are typical listings, not quotes; NRE ($400k) and company running cost ($1M/yr) are ASSUMPTIONS.
- Background history is not in the full signal simulation; the replays still use microphone builds.
- From the other session: confirm the Robin IRIS price from a current OMNIA/Dedrone list; verify procurement anchors (Correctional Service Canada CA$6M for 6 prisons, 2019; Tennessee DOC $1.7M request, Feb 2026; search summaries only); the 3D tab renders slowly in headless Chromium (software WebGL).

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
