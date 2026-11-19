# Session log

One entry per Claude Code session, newest first. Written by the `/handoff` skill before each commit. The chat history from before this repo existed is in `Context_log.txt`.

## 2026-11-13 · Sid · Next-step ideas noted; teammate comments on Draft 5 and the prototype tab

**Asked for:**
- Note as next steps: "sell our receivers to other customers, military customers, use off the shelf receiver for longer to save on development cost, drone capture, reinvesting money into other technologies, study of how many node facilities we need to be able to actually do traffic monitoring for a town" (now in HANDOFF Next steps 6).
- Address teammate comments in Draft 5 and the prototype tab, consistently across deliverables.

**Done in Draft 5 (12 comments):**
- Overview: the teammate's rewrite kept, now naming the other signal sources (FM radio, digital TV, satellite TV) and pointing to the funding table.
- The roadmap diagram became an editable table, "Funding stages at a glance", with one line per item. Figures checked against the model: Seed end 10 facilities, 4 customers, 6 people; Series A end about 50 facilities, 19 customers, about 34 people (was "38", which is the Series B figure).
- The funding table's evidence column became "Milestones before it closes", with separate technical, commercial and operational lines.
- Sales and cash-flow chart: retitled "pays its own way from 2034 and passes $100M of sales a year in 2039", and labels the 2039 bar ($101M of sales, $45M of cash flow).
- Investor timing now leads with the class figure, a sale 6 to 8 years after investing (AA261), with Kauffman and PitchBook as support; the "12 to 15" line is removed.
- New pricing overview: Tripwire costs more than the Axon RF kit ($57,915, no software), against our $150,000 over 5 years, but sees drones with no radio link; it is below the cheapest radar option and under a fifth of the most expensive.
- Funnel section:
  - proposals shown as 40.5, so every stage weighs $19.8M;
  - captions on every table;
  - an explanation that 43.5 customers in 2034 is consistent with sales: about 123 customers signed by end 2034, for about 740 facilities, 478 installed, giving $23.3M of sales.
- Kept teammates' direct edits in the tab: the Overview, the Georgia paragraphs, two headings, and the team names on separate lines.

**Done in the Product Prototype tab (4 comments):**
- The live link https://tripwire-cyan.vercel.app replaces the placeholders, and the recording placeholder is dropped.
- The "campus has poor cell coverage" reasoning is removed in both places.

**Done in the model:**
- The lead line names the other signal sources.
- The exit-date hint cites the class's 6 to 8 years.

Both Google tabs were re-pasted; their comment threads now show as detached.

## 2026-11-12 · Sid · Bill of materials highlighted

**Asked for:** "the prototype dashboard has an excellent BOM list which is used to calculate our unit price. I want to highlight that somewhere": reference it in the bottom-up cost estimate, and give it a special mention in the prototype tab.
**Done:**
- Draft 5, "Bottom up": costs come from the twin's bill of materials (Financials explorer). Every sensor part, the hub, installation and upkeep is priced line by line.
  - The own receiver has 16 parts lines: 11 are distributor prices with supplier links, covering $536 of $612 of parts; 5 are assumptions.
  - Board price $805 / $642 / $531 at 100 / 1,000 / 10,000 boards. The financial model uses the same list.
- Product Prototype tab: a "Worth a closer look: the bill of materials" paragraph and a screenshot of the parts list (`prototype_tab_images/bom_s.jpg`).
- The model's bottom-up table now has a note pointing to the bill of materials.
**Left open:** see Next steps in HANDOFF.

## 2026-11-12 · Sid · Abroad sales team, abroad labor rates and prices, board volume prices

**Asked for:**
- "give the abroad team its own sales";
- abroad labor rates "probably lower than US";
- price and costs "would definitely change" in Europe;
- "are you taking into account the economies of scale effect ... when we buy our hardware in bulk".

**Done:**
- Model v20, abroad:
  - Sites abroad are their own pool, sold only by salespeople abroad: 1 from 2035 Q1, then 1 more a year (ASSUMPTION, slider). US salespeople sell only US sites.
  - Field staff abroad grow with the facilities there (minimum 2).
  - Abroad staff cost $90k a head (slider): UK median pay plus 15% NI is about $74.5k at $1.3371/GBP (Federal Reserve H.10, Nov 6 2026), plus about 20% pension and benefits (ASSUMPTION).
  - Price abroad and install/upkeep cost abroad are sliders, both 100% of the US (ASSUMPTION, no European data).
- Model v20, scale and fixes:
  - Own board price falls with cumulative boards: $805 at 100, $642 at 1,000, $531 at 10,000 (prototype figures, section 3), interpolated on a log scale. Other parts keep their prices. Effect on the plan is about $0.1M.
  - Bug fix: integrators' share and contract fees are now paid in cash (they were a cost but not a cash outflow), which raises the cash the integrator and Faster sales cases need.
- Plan results:
  - $20.5M needed; pays its own way 2034 Q2; $100M/yr 2039 Q4 (was 2040 Q2), because US salespeople no longer spend time on sites abroad;
  - 2042 sales $171M, with about 255 facilities and 19 people abroad;
  - slower sales $87M, paying its own way in 2041 Q4; price war $53M; faster sales $12.8M, 2032 Q4.
- Draft 5:
  - The Western Europe paragraph is rewritten.
  - Two new assumption bullets: volume discounts on our board only; abroad is like the US except staff cost.
  - All changed figures updated, including the levers table and its text. References now cut cash the most.
  - Three charts re-published (axes widened) and the roadmap reads "$100M a year by 2039".
  - Both Google tabs re-pasted.

**Left open:**
- European prices, labor rates, shipping and import duties are not yet researched.
- Volume quotes for parts other than the board are missing.
- The twin's flat plan price.

## 2026-11-12 · Sid · Each site type billed at its own size; uniform-customer, defense and one-product assumptions

**Asked for:**
- "apply point 1": stop repricing every facility at the market-wide average size;
- state as assumptions, in the model's assumptions area and in Draft 5's assumptions section, that:
  - customers of a type are treated as identical (stadiums differ in sensors; big events would pay more);
  - defense applications are not included;
  - no products or services other than the subscription are included.

**Done:**
- Model v19 tracks facilities in service by type (prisons and jails including abroad, stadiums, airports and bases). Each quarter's sales are split by what each type still has unsold, and each facility keeps its type's size and price. New fixed value `coreSize` = 1.
- Plan results:
  - peak need $20.4M (was $18.6M); lowest cash $4.8M in 2034 Q1;
  - cash-flow positive 2034 Q2 (unchanged); $100M/yr 2040 Q2 (was Q3) at about 2,350 facilities and 540 customers, 214 people;
  - slower sales $100M; faster sales $10.8M, 2032 Q3;
  - Seed 4.0x / 7.7x on a 2034 sale; faster sales at 9x gives 15.1x.
- New "Not in the model" box under the model's assumptions, plus a line in "Left out".
- Draft 5: three new bullets in "Sources and assumptions"; every changed figure updated (text, yearly table, returns table, levers table). The three chart widgets were re-published with new rows and their images replaced in the Google tab.
- Product Prototype tab: model figures updated ($20.4M, 2040 Q2, $100M slower sales).
- Both Google tabs re-pasted and checked.

**Decided:** keep prisons at Hays size (1x) in the plan. Event and tier pricing is noted as an assumption to work on, not modeled.
**Left open:**
- More sites abroad still trade off against US airport sales, because sales capacity is shared; giving the abroad team its own sales would fix that.
- The twin's value-based price is still flat per facility.

## 2026-11-12 · Sid · ESP32 as next week's plan, market check rewritten, international and $1B

**Asked for:**
- "you can remove ESP32 test ... or you can mention it as a future plan (for next week)"
- why the plan "needs 8,400 customers"
- "would this company be able to reach billion dollars"
- whether international expansion would get us there "if we scale fast enough"
- rewrite the market check to "about 830 customers, half of all facilities that could buy"
- commit the ESP32 builder change

**Done:**
- Product Prototype tab: ESP32 is now "Next week: ESP32 Wi-Fi motion test" (code written, hardware delayed). The yellow placeholder is gone.
- The tab's builder is now in the repo: `prototype/tools/gdoc/build_prototype_tab.py`, with screenshots in `prototype_tab_images/` and `body_check.py`; see its README.
- Market check, rewritten in Draft 5 and in model v18 (funnel note): by 2042 the plan signs about 830 customers with 3,597 facilities in service, 50% of the 7,127 that could buy. That pool already includes stadiums, airports, bases and sites abroad. The 8,300 figure was leads (approaches), not customers.
- Model runs for the $1B and international questions (not in the doc yet):
  - Even at 100% of today's 7,127 facilities, sales cap near $270M/yr (my arithmetic, 1.5 average size).
  - At 9x sales, a $1B company comes in 2041 Q1 on the plan and 2038 Q2 with faster sales.
  - Abroad at 6,000 facilities, instead of 1,500, adds no sales by itself, because sales are limited by salespeople, not market. In the model, sales even dip slightly, because the average facility size is taken over the whole market.
  - Faster sales, with 6,000 abroad from Series B and 10 salespeople a year, gives $64M in 2034 and a $1B company at 9x in 2036 Q3.

**Decided:** the market-expansion levers and the "Path to $1B" section wait for the user.
**Left open:**
- The model's facility-size averaging over the whole market, rather than over facilities sold.
- The prototype link and recording placeholders.

## 2026-11-12 · Sid · Product Prototype tab comments answered

**Asked for:** "now fix the prototype tab comments". The three comments were:
- the classifier note ("We can tell but we need to have classifier");
- "Replace this screenshot. We have renamed this to financials explorer";
- "We can use this adjust our profit margin and see how much revenue we can generate".

**Done:**
- No branch had the rename, so the twin's Financials tab is now "Financials explorer": the tab button, notes, help text and README.
- New headless-Edge screenshot of the renamed tab in the walkthrough.
- The 3D-simulation "Look for" now says that telling drones from birds needs a classifier (rotor signal plus flight path over a track). The prototype does not simulate it yet; it is a Seed task.
- The Financials explorer "Try" now covers changing margins and the pricing model to see price, 5-year revenue and gross profit.
- The Financials explorer "Look for" adds the plan price: $150,000 over 5 years, about $25,471/yr gross profit, 40 facilities cover $1M/yr.
- Product Prototype tab re-pasted; its 3 comment threads now show as detached.

**Left open:** prototype link and recording placeholders, the ESP32 test, and the Vercel deploy (teammate).

## 2026-11-12 · Sid · Twin value-based price set to the plan price

**Asked for:** "change it, if our new values are more realistic" (the twin's value-based price default).
**Done:**
- The twin's value-based pricing default is now the business plan's $25,000 + $25,000/yr. The new values are `FINANCE.pricing.set_install_usd` and `set_sub_usd` in `twin/cost.py`, used by `customer_price`, `web/src/data.js` and `tools/build_assumptions_doc.py`.
- Saved browser settings reset (`LS_KEY` tripwire-fin-v05.2). Hints, help text and README updated.
- Regenerated `web/runs/cost_model.json` and `Tripwire_Assumptions_and_Figures.md`. The figures doc notes the plan price is shown flat, while the plan charges larger sites by sensor count.
- 43 tests pass, run in a scratch venv with requirements.txt.
- Checked in the browser: the value-based view gives $25,471/yr gross profit per facility and 40 facilities to cover $1M/yr, matching Draft 5.
**Decided:** keep `ZONE` (the data package's $50,000 + $18,000) only for the archived v0.3 viewer and its test.
**Left open:** README's v0.4.x history still quotes the old prices as history (left as is).

## 2026-11-12 · Sid · Sales-speed levers in the model

**Asked for:** put the sales-speed mechanisms in the model, "keep levers off in the plan", and check this does not contradict the twin's Financials tab.
**Done:**
- Model v17 has three levers in the go-to-market group, all off in the plan, so plan results are unchanged:
  - Buy off an existing contract from a chosen quarter. It saves one quarter of the sale (assumption) and costs a 2% fee (assumption).
  - Customers won by integrators per year. The integrator keeps 37.5% of what those customers pay.
  - Extra wins per salesperson from pilot references, from 2029 Q1.
  - A new cost row, "Integrators' share and contract fees".
- "Faster sales" is now the three levers together (contract from 2029 Q1, 4 integrator wins a year, references +50%): $9.6M needed, pays its own way 2032 Q1, Seed 8.6x / 15.8x on a 2034 sale at 4.5x / 9x sales.
- Each lever alone, from the model: contracts $15.9M / 2033 Q4; integrators $12.5M / 2033 Q2 (margin 67%); references $13.7M / 2033 Q1.
- Draft 5:
  - Returns table and "How we shorten the sale" updated with a table of the levers.
  - Notes that Georgia's contract runs to April 2027.
  - Re-pasted into the Google tab.
**Decided:** levers stay off in the plan until Seed measures them.
**Left open:** the twin's Financials tab uses old prices: its value-based model defaults to $50,000 + $18,000/yr (`ZONE` in `twin/cost.py`), not the plan's $25,000 + $25,000/yr. Its default cost + margin view is not affected. Fixing it means changing `twin/cost.py`, the tests and the figures doc (Nimalan's area).

## 2026-11-12 · Sid · Investor returns, sales funnel, faster-sale routes

**Asked for:**
- "is your solution just adding a faster scenario ... arent VS expecting returns sooner? Think critically"
- the class pipeline format, from two whiteboard photos: stages Lead, Prospect, Negotiation, Signed; 10, 3, 2 and 1 deals over four quarters
- "do all three, funnel and returns first"
- a 50-word startup description, separate from the doc

**Done:**
- Model v16 adds two panels:
  - Sales funnel: leads, proposals and negotiations per year, at the class rates of 1 in 10, 1 in 3 and 1 in 2.
  - What investors get back: sliders for sale date, price multiple and valuation against the median.
    - Valuations are PitchBook-NVCA Q3 2026 medians: Seed $18.3M, A $60.3M, B $187.0M pre-money; pre-seed at a $5M cap (assumption).
- Draft 5 changes:
  - "What investors get back" replaces "Investor timeline and exit".
    - On the plan, a sale at the end of 2034 at 4.5x sales ($116M) returns Seed 4.1x; Series B loses money (0.6x).
    - Faster sales plus a 9x strategic price gives Seed 13.8x.
  - The class-format funnel (2031 snapshot, yearly table, first-deal quarters) replaces the earlier per-customer table.
    - The 20 leads come from 6 Southeast state prison systems (186 prisons) and 33 SEC/ACC stadiums.
    - Market check: about 8,300 leads by 2042 at 1 in 10, more than the 7,127 facilities.
  - New "How we shorten the sale":
    - Georgia bought RF detection through 34 purchase orders (about $13.7M, 22 prisons) from Convergint off a mandatory statewide contract.
    - Cooperative contracts: OMNIA, Sourcewell, NASPO.
    - Pilot references.
  - Re-pasted into the Google tab.

**Decided:**
- Exit by sale is the investor answer. The plan is honest that a year-8 sale does not pay 10x without faster sales and a strategic buyer.
- Series B is the weak round; aim for a strategic investor there.
- Exit multiples: 4.5x (DroneShield, AeroVironment-BlueHalo) and 9x (Motorola-Silvus). Dedrone's revenue was never disclosed.

**Left open:**
- "Georgia runs RF detection at 25 locations" is a GPS Press figure. The records show it was not a single purchase.
- The PitchBook 7-9 years to exit figure was seen only in a snippet.
- Prototype tab comments are still open.

## 2026-11-12 · Sid · Seven teammate comments on Draft 5, investor timeline, Europe costs

**Asked for:** look up the technical advisor ("the technical advisor advises on the technical stuff ... she is a prof"); "the cash in the bank graph goes up after 7 years, but usually vc cycles are less than 6. What is our solution"; then the seven new teammate comments on the Draft 5 tab.
**Done:**
- Model v15:
  - "Faster sales" scenario (3 wins per salesperson, 6-month cycle): cash-flow positive 2032 Q4, needs $11.9M.
  - Team abroad from the first quarter of sales there (2 field engineers + 1 salesperson at $175k) plus $25k CE marking.
  - Plan unchanged: $18.6M, 2034 Q2, 2040 Q3. Slower sales now needs $101M (was $95M), price war $60M (was $57M).
- Draft 5:
  - "Investor timeline and exit" (sale of the company, Axon-Dedrone precedent; sales speed decides the date; strategic investor).
  - the technical advisor listed as technical advisor (Stanford Assistant Professor of EE).
  - Comments answered:
    - Clemson paragraph explains RF detection (Alabama chose D-Fend) and why we complement it.
    - Europe costs priced: no BIS fee, ITAR $3,000/yr, CE EUR 8-25k, UK team about GBP 167k/yr.
    - 4x airport sensors justified by acreage: Hays 191 acres vs CHA 950, SAV 3,650, ATL 4,700.
    - New "Later: an airspace map" subsection (UTM/UAM ConOps, Part 108 NPRM, NASA low-altitude gap).
    - Yearly sales/backlog table plus a pipeline table in the course template. Both sites are "Target, not yet contacted" at 5%; backlog $0; weighted pipeline $6,600.
    - Integrators named: Vision Security Technologies, Convergint, Johnson Controls.
  - Kept a teammate's direct Google-tab edits to the team and regulatory paragraphs.
  - Re-pasted the tab; the 7 comment threads now show as detached.
- Product Prototype tab: only $95M changed to $101M (Find and replace), so its 3 open comments stay.
**Decided:**
- Venture answer: exit by acquisition plus proving sales speed at Seed, not a faster technology timeline (40 dB or receiver dates barely move cash-flow positive).
- Pipeline probabilities follow the course template's stages; no customer contacted yet (user confirmed).
**Left open:**
- Prototype tab comments: classifier note; replace the screenshot of the renamed "financials explorer" twin tab; profit-margin note.
- Empty bullet at the end of the Draft 5 tab.
- UK salary medians came via third-party ONS reproductions; the Hays 191 acres came from a search snippet of the GDC audit PDF.

## 2026-11-12 · Sid · Europe timing, ITAR, team names, teammate comments, round lines

**Asked for:** when to expand to Western Europe ("our business has to be at a sustainable scale to expand internationally") and whether airports are in the plan; why the facilities-per-customer slider tapers; the technical advisor plus Ashlynn, Adeline and Taras as "part time workers/advisors till seed"; funding-round boundaries on the model's charts; keep Google Doc, model and prototype tab in step.
**Done:**
- Model v13: sales abroad start slider (default 2035 Q1, was Series B); facilities lost to churn rejoin the pool that could buy (they were capped out forever, which made revenue fall when the market filled); Seed/Series A/Series B dashed lines on every time chart. Plan: peak need $18.6M (2034 Q1), cash-flow positive 2034 Q2, $100M/yr 2040 Q3.
- Draft 5: Western Europe section (HMPPS drone incidents, EURO 2028, World Cup 2030, EU policy, no evidence on adoption speed), airports section, export-control paragraph (ECCN 5A001.g; possible USML XI) and Commodity Jurisdiction milestone moved to 2028; five teammate comments answered (runway figures, price war defined, Big Idea Memo, FEMA and NSF SBIR sourced directly, who prisons and stadiums pay); airport error fixed (10 m vs 25 m is not "a tenth").
- Google Doc tabs Draft Report 5 and Product Prototype re-pasted (their comment threads now show as detached; text changed as asked).
**Decided:** Europe after cash-flow positive rather than at Series B or a new Series C (user's sustainability test).
**Left open:** export counsel to confirm ITAR vs EAR; an empty bullet may remain at the end of the Draft 5 tab.

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


## 2026-11-13 · Sid · Pre-submission check; repo public; why GPS/Wi-Fi prototypes

- Checked both Google tabs for unbacked claims: no video/recording promises left (all "recordings" are future Seed RF recordings); no yellow placeholders.
- Repo was private, so the doc's GitHub links 404'd for graders. Made it public at Sid's request (no secrets committed; only `.env.example`).
- Product Prototype tab: replaced the removed cell-coverage line with the real reason. Cell signals need a receiver we don't have, so the GPS (phone) and Wi-Fi (ESP32) prototypes show the receive-only idea with hardware we have. "node" became "sensor" (4 edits, applied in Google and in `build_prototype_tab.py`).
- Still for Sid: share the Claude artifact link publicly; delete the empty last bullet in both tabs.
- Draft 5 and Product Prototype tabs justified. Financial model published on GitHub Pages. An Apps Script (Sid's account, link addresses only) repointed 26 links from the private Claude artifact and the GitHub source view to the Pages URL.
- Number audit of Draft 5 and the Product Prototype tab against the financial model (GitHub Pages copy) and the prototype figures, after teammate comments. Most numbers match; discrepancies were listed for Sid. The 9-month sale and 6 facilities per customer are noted in the handoff as a later fix.
- Applied the audit fixes in Draft 5 with Find and replace (slower-sales wording, cash before Series B $5.8M / $0.47M a month, no-40 dB $83M, 2031 sales $2.3M, backlog end 2039, Series A hardware $0.8M, Seed end 2029 Q3, receiver ships in Series A, Series B new facilities, lowest point after Series B, floor = 40% margin, first sale after the pilots) and removed the course and lecture references. Product Prototype: same first-sale wording, also in `build_prototype_tab.py`. The pricing chart image still says "floor (our cost + 40%)".\n
- Draft 5: Motorola/Silvus citation added. Note on private energy sites vs data centers added to "Later customers" and the assumptions list, and as a bullet in the model's "Not in the model" box (`prototype/web/financial-model.html`, GitHub Pages and the artifact). The consistent fix is in the handoff's open questions. Addressed comments on Draft 5 and the prototype tab resolved.
- Draft 5 funnel: rates shown as percentages throughout (10%, 33%, 50%); "Average contract value" with the per-type values ($0.9M prison system, $1.35M stadium owner, $3.6M airport or base). Sid's funnel comments resolved. Handoff: linear-growth fix and the price-by-area idea added to open questions.
- Handoff: renewal-at-end-of-term fix added to open questions.
- Financial model: floor labels now read "40% margin on cost" (matching Draft 5); a PDF snapshot of the model was saved for the Canvas upload.\n
- Technical advisor no longer named in Draft 5, the financial model or the context files (Sid: meeting her next week). Older commits still contain the name.\n
- Energy-sites assumption reworded more clearly (Draft 5 and model): says plainly that counting refineries and nuclear plants but not data centers is not fully consistent.\n
- Product Prototype tab: an "All our links (no login needed)" box under the title (live prototype, financial model, repo, figures file, business plan). Added in Google Docs only; `build_prototype_tab.py` does not have it yet. Model snapshot PDF regenerated for Canvas.\n
- Model page: removed the last course references and the "1 in 3" format; the exit label now says year 8 for 2034 Q4, matching Draft 5.\n


## 2026-11-18 · Sid · Hard pivot started (branch pivot-v1)

- Instructors: not venture scale; aim for a $10-30M raise and $100-200M within ~5 years. Model both readings (exit value and sales a year).
- Decisions recorded in `context/PIVOT_PLAN.md`: passive sensing platform (drones, more signal sources, heat-camera cueing, GPS jamming/spoofing monitoring), service plus sensor sales, beyond-interception products, government first (FEMA-funded states, then DHS border and DIU), prisons and stadiums as proof sites, Ashlynn leads government and defense, Draft Report 6 in the same sections.
- VC feedback on the data package recorded there too, to answer in Draft 6.
- Research milestone done: `context/research/` (government buyers, GNSS monitoring, sensing and VC answers). Proposed model v2 design in `context/PIVOT_MODEL_DESIGN.md`, waiting for Sid's review.\n
- Financial model v2 built (`prototype/web/financial-model-v2.html`): six customer types, five revenue lines plus SBIR/DIU, hiring by plan and bookings, renewals at term end, BLS pay. Results recorded in `context/PIVOT_PLAN.md`; waiting for Sid's review.
- Model v2 revised to Sid's target ($100M of sales a year by year 5): 16 salespeople a year, contract vehicles and references from 2029, large sites $1M + $0.4M/yr, kits $600k + $120k/yr, Series A $12M. $114M in 2031; results and caveats in `context/PIVOT_PLAN.md`.
- Prototype v0.6 built on pivot-v1: FCC TV/FM transmitters per site (`tools/fetch_broadcast.py`), broadcast link budget (`twin/broadcast.py`, `tools/broadcast_study.py`), GPS jammer locator (`twin/gnss_jam.py`), heat-camera ranges (`twin/thermal.py`), contraband-drop walkthrough (`tools/platform_demo.py`), Platform tab (`web/src/platform.js`); 48 tests pass. Results in `prototype/V06_PLATFORM.md` and `context/PIVOT_PLAN.md`.
- TV research (`context/research/tv_passive_radar.md`): no drone yet detected with US TV; co-channel ATSC sources exist; measured residual floor 6-20 dB over thermal. Broadcast model now holds the floor 20 dB over thermal: TV covers Hays, Fulton, Clemson but not Hancock for 0.9 kg; model tvShare 75%. Five-year numbers unchanged.\n
- Draft Report 6 written as a Claude doc (https://claude.ai/artifact/1aNLoRiRcMLUh1odDKcmc6): overview, answers to the VC review, funding plan with charts, customers, products and pricing, pipeline and backlog, technical plan (cell base, TV upgrade with its evidence and Seed measurements, GPS locator, heat camera, contraband-drop timeline, phases), hiring, regulatory and export, sources. Model v2 final: 18 salespeople a year, $105.3M in 2031.
