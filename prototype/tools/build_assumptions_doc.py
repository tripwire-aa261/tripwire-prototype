"""Write Tripwire_Assumptions_and_Figures.md (repo root): every assumption and figure behind the prototype,
for keeping the business plan and its financials consistent with the twin.

    .venv/bin/python tools/build_assumptions_doc.py

All numbers are read from the twin's own code and results (twin/cost.py, twin/config.py, twin/antenna.py,
twin/calibration.json, web/data/explore.json, web/runs/replays.json, web/runs/hover_feasibility.json), so
re-running this after any change keeps the document in step. The narrative text (why each number) is here.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from twin import cost as C  # noqa: E402
from twin.antenna import ANTENNAS  # noqa: E402
from twin.config import DRONES, PARAM_SOURCES, Params, processing_gain_db  # noqa: E402
from twin.explore import BASE, DEFAULT_REQ, DESIGNS, RADII  # noqa: E402
from twin.scenarios import SITE_LABELS  # noqa: E402

OUT = ROOT.parent / "Tripwire_Assumptions_and_Figures.md"
X = json.loads((ROOT / "web" / "data" / "explore.json").read_text())
BUILDS = X.get("builds", {"bladerf": "ring4_enh_mic", "b210": "ring4_enh_mic", "custom": "ring8_enh_mic"})
F, N, Z = C.FINANCE, C.NODE, C.ZONE
Y = F["pricing"]["years"]
OVERHEAD = 1_000_000.0  # ASSUMPTION (same default as the viewer's Financials tab)


def usd(v, d=0):
    return "—" if v is None else f"${v:,.{d}f}"


def table(head, rows):
    out = ["| " + " | ".join(head) + " |", "|" + "|".join("---" for _ in head) + "|"]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def node(design, radio):
    p = Params.from_dict({**BASE, **DESIGNS[design]["p"]})
    return C.node_cost(p.rx_elements, p.antenna, radio, p.processing, p.mic_range_m > 0)


def priced(n, node_usd, model):
    fc = C.facility_costs(n, node_usd)
    if model == "set":
        price, sub = Z["install_price_usd"], Z["subscription_usd_per_year"]
    else:
        f = {**F, "pricing": {**F["pricing"], "model": model}}
        cp = C.customer_price(fc["upfront"], fc["yearly"], f)
        price, sub = cp["price"], cp["sub"]
    rev, cost5 = price + Y * sub, fc["upfront"] + Y * fc["yearly"]
    return {**fc, "price": price, "sub": sub, "revenue": rev, "cost5": cost5, "gp": rev - cost5,
            "gm": (rev - cost5) / rev if rev else 0.0}


# ----------------------------------------------------------------------------------------- recommendations
RES = {tuple(r["k"]): r for r in X["results"]}
RI = RADII.index(DEFAULT_REQ["radius_m"])
TGT = (DEFAULT_REQ["coverage_pct"], DEFAULT_REQ["tracked_pct"], DEFAULT_REQ["accuracy_m"], DEFAULT_REQ.get("detection_m", 0))


def best_for(site, drone, interf, radio):
    de = BUILDS[radio]
    nc = node(de, radio)["total"]
    ok = []
    for n in X["axes"]["nodes"]:
        r = RES.get((site, drone, de, DEFAULT_REQ["height_m"], interf, n))
        if r and r["cov"][RI] >= TGT[0] and r["trk"][RI] >= TGT[1] and r["acc"][RI] is not None and r["acc"][RI] <= TGT[2] \
                and r.get("det50", r.get("warn") or 0) >= TGT[3]:
            ok.append((priced(n, nc, "install_sub")["cost5"], n, r))
    if not ok:
        rs = [RES.get((site, drone, de, DEFAULT_REQ["height_m"], interf, n)) for n in X["axes"]["nodes"]]
        r = max((x for x in rs if x), key=lambda x: (x["cov"][RI], x["trk"][RI]))
        return {"meets": False, "n": r["k"][5], "r": r}
    _, n, r = min(ok, key=lambda t: t[0])
    return {"meets": True, "n": n, "r": r, "node": nc}


def main():
    L = []
    w = L.append
    today = dt.date.today().isoformat()
    w(f"# Tripwire: assumptions and figures behind the prototype\n")
    w(f"Generated {today} from the digital twin by `prototype/tools/build_assumptions_doc.py`. Do not edit the numbers by "
      "hand: change them in the twin (mostly `prototype/twin/cost.py`) and re-run the script, so the business plan, the "
      "viewer and this file stay consistent. Tags: **CITED** (published source, linked), **MEASURED** (fetched data), "
      "**FIT** (calibrated to a trial), **STANDARD** (specification), **ASSUMPTION** (our estimate, to replace with "
      "quotes or measurements), **DECISION** (team choice).\n")
    w("Contents: 1 Product and architecture · 2 Hardware per sensor · 3 Custom receiver parts list · 4 Installation · "
      "5 Running costs · 6 Pricing · 7 Company-level costs · 8 What each facility needs and earns · 9 Seed kit · "
      "10 Changes from the Seed data package · 11 Technical assumptions behind the performance · 12 Results that "
      "check the model · 13 Open items · 14 Sources\n")

    # 1
    w("## 1. Product and architecture\n")
    w("- **What is sold:** receive-only sensors on the facility fence that detect drone echoes of signals cell towers already "
      "transmit, plus one on-site hub, installation and a yearly service. Nothing is transmitted, so no license is needed.")
    w("- **Sensor:** one box on a pole. Antennas, radio boards, an edge computer, a GPS module for time stamps, power and "
      "surge protection. The customer provides the pole, power and network at each sensor (as in the Seed data package).")
    w("- **Radios (one fixed build each, DECISION Nov 12):**")
    for r, de in BUILDS.items():
        w(f"  - {C.RADIOS[r]['name']} ({C.RADIOS[r]['stage']}): design `{de}`, {DESIGNS[de]['label']}.")
    w("  bladeRF and B210 perform the same in the model (12-bit, 2 channels per board); the B210 only costs more.")
    w("- **Hover:** a hovering drone has no Doppler shift and the normal processing drops it. The standard builds hold it in "
      "software by *background history* (each sensor learns its quiet scene and looks for a new steady echo where a track "
      "stopped; DECISION Nov 12, `twin/hover.py`). Microphone builds remain as the hardware alternative.")
    w("- **Compute architecture (Nov 12):** raw samples are too much to send off the pole (4 channels x 15.36 MS/s x "
      "32 bit = ~2 Gbit/s), so each sensor runs the per-antenna processing on an edge GPU board (demodulation, rebuilding "
      "the tower signal, range-Doppler maps) and sends compact maps (a few Mbit/s, ASSUMPTION) to **one hub per facility**. "
      "The hub tracks, classifies (drone, bird, person, flight mode), keeps the background history and raises alerts; it "
      "keeps working without the internet. One internet line per facility carries alerts, health data and updates.")
    w("- **Where alerts go:** the facility's control room (on site); a cloud service for dashboards and remote monitoring.\n")

    # 2
    w("## 2. Hardware per sensor\n")
    builds = [("Standard, bladeRF", BUILDS["bladerf"], "bladerf"), ("Standard, B210", BUILDS["b210"], "b210"),
              ("Custom receiver", BUILDS["custom"], "custom"), ("Standard + microphone, bladeRF", "ring4_enh_mic", "bladerf"),
              ("Custom + microphone", "ring8_enh_mic", "custom")]
    keys = ["receiver", "gnss_timing", "clock_distribution", "computer", "antennas", "enclosure_power_mast",
            "surge_protection", "microphones"]
    names = {"receiver": "Radio board(s)", "gnss_timing": "GPS module", "clock_distribution": "Shared clock (2 boards)",
             "computer": "Edge computer", "antennas": "Antennas", "enclosure_power_mast": "Enclosure, power, bracket",
             "surge_protection": "Lightning arrestors", "microphones": "Microphone unit"}
    nc = {b[0]: node(b[1], b[2]) for b in builds}
    w(table(["Item"] + [b[0] for b in builds],
            [[names[k]] + [usd(nc[b[0]]["items"].get(k), 2) if k in nc[b[0]]["items"] else "—" for b in builds] for k in keys]
            + [["**Total per sensor**"] + [f"**{usd(nc[b[0]]['total'])}**" for b in builds]]))
    w("")
    w("Line by line:\n")
    for r in ("bladerf", "b210"):
        w(f"- **{C.RADIOS[r]['name']}:** {usd(C.RADIOS[r]['usd'])} per board, {C.RADIOS[r]['channels']} channels, "
          f"{C.RADIOS[r]['bits']}-bit. {C.RADIOS[r]['source']}. A 4-antenna sensor needs 2 boards.")
    w(f"- **Custom receiver:** {usd(C.custom_board_usd(8, C.CUSTOM['planning_qty']), 2)} per 8-channel board at the "
      f"{C.CUSTOM['planning_qty']:,}-board planning volume: parts + assembly + test, *without* the design cost (section 3, 7).")
    w(f"- **Edge computer:** {usd(N['compute_usd'])}, NVIDIA Jetson Orin Nano Super developer kit list price (CITED [5]). "
      "ASSUMPTION: enough for whole-signal processing of 4 to 8 channels (our estimate: tens of GFLOP/s); benchmark at Seed. "
      "Replaced an ASSUMPTION of $800 (two $400 computers). A Raspberry Pi 5 8 GB now lists at about $175-195 after memory "
      "price rises (CITED [6]) with less compute, so it is not cheaper.")
    w(f"- **GPS module:** {usd(N['gnss_usd'], 2)}, u-blox NEO-F10N (CITED, DigiKey; same part as the custom parts list). "
      "Only time stamps are needed: each tower-sensor pair measures the echo delay against its own direct tower signal, so a "
      "disciplined oscillator (the old $150 ASSUMPTION) is not (ASSUMPTION).")
    w(f"- **Shared clock for 2 boards:** {usd(N['clock_dist_usd'])} (ASSUMPTION): one 38.4 MHz oscillator ($2.11) and a clock "
      "buffer ($3.11), both priced in the custom parts list, plus an adapter board and U.FL cables (~$25). Replaced $350. "
      "**Risk:** phase-locking two bladeRF 2.0 micro boards is not a documented feature (Nuand forum, CITED [7]); test at Seed.")
    for k in ("omni", "patch"):
        a = ANTENNAS[k]
        w(f"- **{a.name} antenna:** {usd(a.price_usd)} each (ASSUMPTION, typical retail; no reliable cheaper listing found), "
          f"{a.gain_dbi:g} dBi, {a.az_bw_deg:g} deg beam.")
    w(f"- **Enclosure, power, bracket:** {usd(N['enclosure_usd'])} (ASSUMPTION, typical listings): NEMA 4X polycarbonate box "
      "~$70, 60 W DIN power supply ~$35, pole bracket ~$40, Ethernet surge protector ~$20, internal cables ~$25. Replaced $450.")
    w(f"- **Lightning arrestor:** {usd(N['surge_per_antenna_usd'])} per antenna cable (ASSUMPTION, generic N-type).")
    w(f"- **Microphone unit (microphone builds only):** {usd(N['mic_usd'])}: 4 x Infineon IM69D130 MEMS microphones at $2.87 "
      "(CITED [8]) + small board and acoustic vents (~$13, ASSUMPTION). Replaced $100.\n")

    # 3
    b = C.custom_board_breakdown(8, C.CUSTOM["planning_qty"])
    w("## 3. Custom 8-channel receiver: parts list (Series A)\n")
    w("Architecture (ASSUMPTION): four 2-channel LMS7002M transceivers on one GNSS-disciplined 40 MHz reference, an Artix-7 "
      "FPGA that merges the channels and streams them over PCIe to the edge computer, and a switched noise source to "
      "calibrate the phase between channels. Prices are distributor prices at the quantity quoted, moved to the planning "
      f"volume with a volume curve of x{C.CUSTOM['learning_per_doubling']} per doubling, never below "
      f"{C.CUSTOM['volume_floor']:.0%} of the quote (ASSUMPTION).\n")
    w(table(["Item", "Part", "Count", "Quoted (qty)", f"Unit at {C.CUSTOM['planning_qty']:,}", "Line", "Source"],
            [[ln["item"], ln["part"], ln["count"], f"{usd(ln['usd'], 2)} ({ln['basis_qty']:,})", usd(ln["unit_at_qty"], 2),
              usd(ln["line_usd"], 2), (f"[{ln['source']}]({ln['url']})" if ln.get("url") else ln["source"]).replace("|", "/")]
             for ln in b["lines"]]))
    cited = [ln for ln in b["lines"] if ln["source"].startswith("CITED")]
    w("")
    w(f"- Parts {usd(b['parts_usd'], 2)} ({len(cited)} of {len(b['lines'])} lines cited, covering "
      f"{usd(sum(ln['line_usd'] for ln in cited), 2)}); SMT assembly and X-ray {usd(b['assembly_usd'], 2)} "
      f"({C.ASSEMBLY['source']}); test and phase calibration {usd(b['test_usd'], 2)} (ASSUMPTION).")
    w(f"- **Per board: {usd(b['total_usd'], 2)}** at {C.CUSTOM['planning_qty']:,} boards; "
      f"{usd(C.custom_board_usd(8, 100), 2)} at 100; {usd(C.custom_board_usd(8, 10000), 2)} at 10,000 (parts volume only).")
    w(f"- **Design cost (NRE): {usd(C.CUSTOM['nre_usd'])} one-time** (ASSUMPTION): engineering, 2-3 prototype rounds, test "
      "equipment, FCC Part 15 and safety/outdoor testing. Kept **out of the board price** (DECISION Nov 12): it is a company "
      "cost paid from Series A funds and recovered from gross profit across facilities (section 7), so the board count does "
      "not change any price. It is the least supported number in this section; cost it bottom-up (engineer-months x rate, "
      "prototype rounds, a certification lab quote).\n")

    # 4
    i = F["install"]
    per_sensor_inst = i["tech_hours_per_sensor"] * i["labour_rate_usd_per_h"] + i["mounting_cabling_usd"] + i["site_works_usd"]
    w("## 4. Installation (one-time)\n")
    w(table(["Item", "Value", "Basis"], [
        ["Technician hours per sensor", f"{i['tech_hours_per_sensor']} h", "ASSUMPTION: 2 technicians x 3 h; factory-configured sensor on an existing pole (was 16 h)"],
        ["Labor rate (loaded)", f"{usd(i['labour_rate_usd_per_h'])}/h", "BLS median $28.88/h for security and fire alarm system installers (OEWS May 2025, SOC 49-2098; CITED [9]), about doubled for benefits, payroll taxes, overhead, vehicle and travel time (ASSUMPTION multiplier ~2.1). Was $95/h"],
        ["Mounting and cabling per sensor", usd(i["mounting_cabling_usd"]), "ASSUMPTION: outdoor Ethernet run, conduit fittings, connectors (was $480)"],
        ["Pole, power, network per sensor", usd(i["site_works_usd"]), "Customer provides (Seed data package)"],
        ["**Per sensor**", f"**{usd(per_sensor_inst)}**", "was $2,000"],
        ["Site set-up per facility", usd(i["site_setup_usd"]), "ASSUMPTION: radio survey of the towers, calibration, software set-up"],
        ["On-site hub per facility", usd(i["hub_usd"]), f"{C.HUB['source']}"],
    ]))
    w("")

    # 5
    m = F["maintenance"]
    ex_node = nc["Standard, bladeRF"]["total"]
    per_sensor_yr = (m["visits_per_year"] * m["hours_per_visit_per_sensor"] * i["labour_rate_usd_per_h"]
                     + m["spares_pct_of_hardware"] / 100 * ex_node + 12 * m["connectivity_usd_per_month"] + m["software_usd_per_year"])
    w("## 5. Running costs (per year)\n")
    w(table(["Item", "Value", "Basis"], [
        ["Service visits", f"{m['visits_per_year']} per year, {m['hours_per_visit_per_sensor']} h per sensor", "ASSUMPTION: health is monitored remotely; one inspection and cleaning visit (was 8 h)"],
        ["Spare parts", f"{m['spares_pct_of_hardware']:g}% of hardware", "ASSUMPTION: solid-state electronics (was 10%)"],
        ["Network per sensor", f"{usd(m['connectivity_usd_per_month'])}/month", "Sensors reach the hub over the facility network (was a $25/month cellular plan each)"],
        ["Software per sensor", f"{usd(m['software_usd_per_year'])}/yr", "ASSUMPTION: updates and monitoring (was $300)"],
        ["Internet line per facility", f"{usd(m['backhaul_usd_per_month'])}/month", "ASSUMPTION: one business line from the hub"],
        ["Cloud per facility", f"{usd(m['cloud_usd_per_year'])}/yr", "ASSUMPTION: hosting, alert delivery, dashboards"],
        [f"**Example: standard bladeRF sensor ({usd(ex_node)} hardware)**", f"**{usd(per_sensor_yr)}/yr per sensor + "
         f"{usd(12 * m['backhaul_usd_per_month'] + m['cloud_usd_per_year'])}/yr per facility**", "was about $1,600/yr per sensor"],
    ]))
    w("")

    # 6
    pr = F["pricing"]
    w("## 6. Pricing\n")
    w(f"- **Margins: {pr['margin_upfront_pct']:g}% on installation and {pr['margin_yearly_pct']:g}% on the subscription** "
      "(DECISION Nov 12; was 40% / 72%, which reproduced the data package's planning prices). Margin = share of the price left "
      "after our cost: price = cost / (1 - margin).")
    w(f"- **Contract length:** {Y} years (memo).")
    w("- **Three pricing models** (the viewer's Financials tab has all three):")
    w("  1. *Cost + margin, installation + subscription* (default): installation price = upfront cost / 0.6; subscription = "
      "running cost / 0.6. This is the **floor**: the lowest price that keeps a 40% margin on every facility.")
    w(f"  2. *Cost + margin, all-in yearly fee*: nothing upfront; yearly fee = (upfront cost repaid over the contract at "
      f"{pr['cost_of_capital_pct']:g}%/yr cost of capital, ASSUMPTION + running cost) / 0.6. Fits an operating budget; we "
      "carry the hardware and wait longer to be repaid.")
    w(f"  3. *Value-based*: our own price per facility, defaulting to the data package's planning prices: "
      f"{usd(Z['install_price_usd'])} installation + {usd(Z['subscription_usd_per_year'])}/yr (CITED, Seed data package).")
    b2 = F["benchmarks"]
    w(f"- **Today's alternatives (CITED, data package):** Axon hardware + installation {usd(b2['axon_hardware_install_usd'])} [3]; "
      f"AirSight subscription {usd(b2['airsight_subscription_low_usd'])}-{usd(b2['airsight_subscription_high_usd'])}/yr [4] "
      f"({usd(Y * b2['airsight_subscription_low_usd'])}-{usd(Y * b2['airsight_subscription_high_usd'])} over {Y} years).")
    lo_up = b2["radar_n_lo"] * b2["radar_usd_lo"] * (1 + b2["radar_install_pct_lo"] / 100)
    hi_up = b2["radar_n_hi"] * b2["radar_usd_hi"] * (1 + b2["radar_install_pct_hi"] / 100)
    w("- **Like-for-like comparison: a customer's cost for one facility over the contract** (shown in the viewer's "
      "\"Compared with today's options\"):")
    w(f"  - *Radar-based system* (e.g. AirSight): {b2['radar_n_lo']}-{b2['radar_n_hi']} compact radars (ASSUMPTION; each "
      f"sees ~{b2['radar_fov_deg']:g} deg, CITED Echodyne EchoGuard [12]) x {usd(b2['radar_usd_lo'])}-{usd(b2['radar_usd_hi'])} "
      f"each, hardware only (CITED AirSight radar guide, (c) 2026 [13]) x (1 + {b2['radar_install_pct_lo']:g}-{b2['radar_install_pct_hi']:g}% "
      f"installation, survey, calibration, training and integration, CITED AirSight cost guide [14]) = {usd(lo_up)}-{usd(hi_up)} upfront, + {Y} x the AirSight "
      f"packages = **{usd(lo_up + Y * b2['airsight_subscription_low_usd'])}-{usd(hi_up + Y * b2['airsight_subscription_high_usd'])}**.")
    w(f"  - *One Robin IRIS 360 deg radar alone:* {usd(b2['robin_iris_usd'])} (Dedrone price list on OMNIA Partners, AM9, "
      "2025-02-04 [15]: seen in a search result; the file is no longer public, so confirm). The same list showed RF-160/RF-360 "
      "sensors at $14,850 and RF-560 at $29,700.")
    w(f"  - *RF-only Dedrone (Axon):* {usd(b2['axon_hardware_install_usd'])}, hardware + installation, no software (data package ref [3]).")
    rb = best_for("hays", "m210", 20, "bladerf")
    if rb["meets"]:
        a, s_ = priced(rb["n"], rb["node"], "install_sub"), priced(rb["n"], rb["node"], "set")
        w(f"  - *Tripwire at Hays* ({rb['n']} bladeRF sensors): {usd(a['revenue'])} at cost + 40%; {usd(s_['revenue'])} at the "
          "data package's prices.")
    w("- **Recommendation (reasoning, to test with design partners):** a fixed yearly subscription per facility, priced from "
      "value and anchored below the alternatives, with cost + 40% as the floor; offer the all-in fee for agencies that buy "
      "services more easily than equipment. Not on-demand or per-alert: protection must be on all the time, a per-alert bill "
      "rises exactly when the facility is under attack, and false alarms would become billing disputes. Per-use add-ons fit "
      "(evidence packages for prosecutions, short deployments for events).\n")

    # 7
    w("## 7. Company-level costs\n")
    w(f"- **Custom receiver design cost (NRE):** {usd(C.CUSTOM['nre_usd'])} one-time, Series A (ASSUMPTION; section 3).")
    w(f"- **Company running cost:** {usd(OVERHEAD)}/yr (ASSUMPTION: team, office, sales, insurance; editable in the viewer).")
    w("- **Gross profit per facility** = what the customer pays over the contract minus our upfront and running costs. "
      "Facilities needed to cover the company's running cost = running cost per year / gross profit per facility per year. "
      "Facilities to repay the NRE = NRE / gross profit per facility over the contract.\n")

    # 8
    w("## 8. What each facility needs and earns\n")
    w(f"Recommended setup = the radio and number of sensors with the lowest cost to us that covers {TGT[0]}% of the area "
      f"within {DEFAULT_REQ['radius_m']} m of the fence, tracks a drone {TGT[1]}% of the time, places it within "
      f"{TGT[2]} m and first tracks the typical incoming drone at least {TGT[3]} m outside the fence (DECISION: viewer "
      f"slider defaults), drones {DEFAULT_REQ['height_m']} m up, 5 kg drone. Results from `web/data/explore.json` "
      f"(created {X['created']}). Sensors spaced evenly on the fence.\n")
    rows = []
    for site in [k for k in ("hancock", "hays", "fulton") if k in X["sites"]]:  # sparse, moderate, dense towers
        for interf in X["axes"]["interference"]:
            for radio in ("bladerf", "custom"):
                rb = best_for(site, "m210", interf, radio)
                r = rb["r"]
                if not rb["meets"]:
                    rows.append([f"{X['sites'][site]['name']} ({SITE_LABELS[site]})", f"{interf} dB", C.RADIOS[radio]["name"], "not possible",
                                 f"best {r['cov'][RI]:.0f}% / {r['trk'][RI]:.0f}% ({rb['n']} sensors)", "", "", "", "", ""])
                    continue
                n, ndu = rb["n"], rb["node"]
                a, s = priced(n, ndu, "install_sub"), priced(n, ndu, "set")
                rows.append([f"{X['sites'][site]['name']} ({SITE_LABELS[site]})", f"{interf} dB", C.RADIOS[radio]["name"], n,
                             f"{r['cov'][RI]:.0f}% / {r['trk'][RI]:.0f}% / {r['caught']:.0f}% / {r['acc'][RI]:.0f} m / "
                             f"{r.get('det50', 0):.0f} m; {r.get('det80', 0):.0f} m",
                             f"{usd(a['upfront'])} + {usd(a['yearly'])}/yr", f"{usd(a['price'])} + {usd(a['sub'])}/yr",
                             f"{usd(a['gp'] / Y)} ({math.ceil(OVERHEAD / (a['gp'] / Y))})",
                             f"{usd(s['gp'] / Y)} ({math.ceil(OVERHEAD / (s['gp'] / Y))})", f"{s['gm']:.0%}"])
    w(table(["Facility", "Interference removal", "Radio", "Sensors", "Area / tracked / caught / accuracy / detection range (typical; 8 in 10)", "Our cost (upfront + yearly)",
             "Price at cost + 40%", "Gross profit/yr at cost + 40% (facilities to cover $1M/yr)",
             "Gross profit/yr at data-package prices (facilities)", "Gross margin at data-package prices"], rows))
    w("\n20 dB of interference removal is today's assumption; 30 and 40 dB are unproven (section 11). The custom receiver "
      "is a Series A product.\n")

    # 9
    seed_n = 3
    sb = nc["Standard, bladeRF"]["total"]
    w("## 9. Seed kit (recordings and first trial)\n")
    w(f"- 3 standard bladeRF sensors: {usd(seed_n * sb)} of hardware ({usd(sb)} each) + hub {usd(i['hub_usd'])} = "
      f"**{usd(seed_n * sb + i['hub_usd'])}** before supplier quotes; installation at the rates above "
      f"{usd(seed_n * per_sensor_inst + i['site_setup_usd'])}.")
    w("- Seed tests that decide the product: interference removal (20 vs 30-40 dB), whole-signal processing gain, background "
      "stability for the hover (-30 dB or better), two-board bladeRF phase lock, Jetson processing capacity.\n")

    # 10
    three = priced(3, sb, "install_sub")
    w("## 10. Changes from the Seed data package's planning figures\n")
    w(table(["Figure", "Data package", "Prototype now", "Why"], [
        ["Hardware per 3 sensors", usd(Z["hardware_target_usd"]), usd(3 * sb), "Parts priced bottom-up (section 2)"],
        ["Deployment per 3 sensors", usd(Z["deployment_usd"]), usd(3 * per_sensor_inst) + f" + {usd(i['site_setup_usd'] + i['hub_usd'])} per facility", "Labor and cabling re-estimated (section 4); hub added"],
        ["Maintenance per 3 sensors per year", usd(Z["maintenance_usd_per_year"]), usd(three["yearly"]), "Remote monitoring, one internet line per facility (section 5)"],
        ["Installation price", usd(Z["install_price_usd"]), f"cost + 40% = {usd(three['price'])} (3 sensors)", "Cost + margin floor; value-based model keeps $50,000"],
        ["Subscription per year", usd(Z["subscription_usd_per_year"]), f"cost + 40% = {usd(three['sub'])} (3 sensors)", "Same"],
        ["Margins", "40% install / 72% subscription (implied)", "40% / 40%", "DECISION Nov 12"],
        ["Pricing unit", "per 3-node zone", "per facility, sized to the sensors it needs", "Zones made Hays ~4x the incumbent (v0.3)"],
    ]))
    w("")

    # 11
    p = Params()
    w("## 11. Technical assumptions behind the performance\n")
    w(f"- **Calibration (FIT):** lumped loss {json.loads((ROOT / 'twin' / 'calibration.json').read_text())['lumped_loss_db']} dB "
      "and direct-signal cancellation depth fitted to the Fraunhofer LTE450 trials (Demissie & Steffes 2025, Fig. 11: 5 kg "
      "drone detected to ~1,600 m; Table 1: Pd ~83%). The only independent trial data used; no independent check yet.")
    w("- **Drones (ASSUMPTION radar sizes; only ratios matter after calibration):** " +
      "; ".join(f"{d.name}: {d.rcs_m2} m²" for d in DRONES.values()) + ".")
    w(f"- **Interference removal from neighboring cells on the same frequency:** 20 dB default (today's assumption), 30 and "
      "40 dB unproven. Decides whether the sparse-tower (Hancock) and dense-tower (Fulton) sites work at all.")
    w(f"- **Whole-signal processing gain:** +{processing_gain_db('full', 0.3):.1f} dB at 30% network load over the "
      "reference-only method (ideal gain, ASSUMPTION; STANDARD resource counts, TS 36.211).")
    w(f"- **Background stability (hover hold):** {p.background_stability_db:g} dB default (ASSUMPTION); needs about -30 to "
      f"-40 dB; listening up to {p.hover_dwell_s:g} s on a stopped track. Microphone range {DESIGNS['ring4_enh_mic']['p']['mic_range_m']:g} m (ASSUMPTION).")
    w(f"- **Fast estimate:** chain loss {5.0:g} dB (FIT to 7 full-simulation runs); 20 scored flights per design point.")
    w("- **Detection range:** distance outside the fence when the track that guards see begins (held for 3 updates), "
      "only before the drone crosses the fence; drones never tracked count as 0 m. The requirement uses the typical drone "
      "(median over 20 flights x 16 draws, DECISION Nov 12); the 8-in-10 figure is reported alongside. Flights start "
      "1,800 m from the drop point from random directions. At Hays drones arriving from the south-southwest (bearings "
      "~180-230 deg, along the line between the southern towers and the sensors) are picked up only ~50-300 m out even "
      "with 16 sensors, so the 8-in-10 range is much shorter than the typical one; sensor placement is the likely fix.")
    w(f"- **Processing:** listening time per update {BASE['cit_s']} s, one update every 1.5 s, 12-bit radios, network "
      f"{BASE['network_load']:.0%} busy (ASSUMPTION), false-alarm rate {p.pfa:g} per cell (ASSUMPTION).")
    w(f"- **Sensors:** {p.mast_m:g} m mast (ASSUMPTION; see section 12 for 15 and 25 m), evenly spaced on the fence.")
    w("- **Towers:** positions and heights MEASURED (FCC); sector directions, power and channels ASSUMPTION "
      "(EIRP 60 dBm, 4 deg downtilt).")
    cal = json.loads((ROOT / 'twin' / 'calibration.json').read_text())
    used = {**BASE, **DESIGNS[BUILDS["bladerf"]]["p"], "drone": "m210", "altitude_agl_m": DEFAULT_REQ["height_m"],
            "zone_buffer_m": DEFAULT_REQ["radius_m"], "cochannel_suppression_db": DEFAULT_REQ["interference_db"],
            "lumped_loss_db": cal["lumped_loss_db"], "dpi_residual_db": cal["dpi_residual_db"]}
    w("\nAll model parameters with their tags. *Code default* is the generic default in `twin/config.py`; *used* is what "
      "the explorer runs for the standard bladeRF build at the default targets (sensor count and interference level vary "
      "per design point):\n")
    w(table(["Parameter", "Code default", "Used", "Meaning", "Tag / source"],
            [[k, getattr(p, k, ""), used.get(k, getattr(p, k, "")), v[0], v[1]] for k, v in PARAM_SOURCES.items()]))
    w("")

    # 12
    w("## 12. Results that check the model\n")
    rp = ROOT / "web" / "runs" / "replays.json"
    if rp.exists():
        R = json.loads(rp.read_text())
        w("**Full signal simulations vs the fast estimate** (12 replays; microphone builds; time tracked):\n")
        w(table(["Replay", "Sensors", "Interference removal", "Fast estimate", "Full simulation"],
                [[r["id"].replace("replay-", ""), r["n"], f"{r['interference_db']} dB", f"{r['expected']['tracked_pct']:.0f}%",
                  f"{r.get('metrics', {}).get('track_availability_pct', float('nan')):.0f}%"] for r in R["replays"]]))
        w("\nThe fast estimate (used for every recommendation) is optimistic at the sparse- and dense-tower sites, more so with few "
          "sensors or the small drone: treat those sensor counts as lower bounds.\n")
    hp = ROOT / "web" / "runs" / "hover_feasibility.json"
    if hp.exists():
        H = json.loads(hp.read_text())
        w("**Hover hold and pole height** (`tools/hover_feasibility.py`; hover points located by background history at each "
          "stability; moving-drone coverage; vertical error of a hovering drone):\n")
        w(table(["Setup", "Pole", "Moving drone located", "Hover: -30 dB", "Hover: -40 dB", "Background vs drone", "Height error"],
                [[f"{h['site']} {h['sensors']} x {h['design'][:5]} @{h['interference_db']} dB", f"{h['mast_m']:g} m",
                  f"{h['moving_located_pct']:.0f}%", f"{h['hover_located_pct']['-30']:.0f}%", f"{h['hover_located_pct']['-40']:.0f}%",
                  f"{h['background_over_drone_db_median']:+.0f} dB", f"{h['height_sigma_m_median']:.0f} m"] for h in H]))
        w("\nTaller poles do not help: at the dense-tower site they see over the buildings into more interference, and they make it "
          "harder to tell a drone from a person beneath it. Keep sensors low (~6 m) unless a site survey says otherwise.\n")

    # 13
    w("## 13. Open items (replace assumptions with quotes or measurements)\n")
    for t in ["Supplier quotes for the Seed kit: bladeRF, antennas, enclosure, power, arrestors, Jetson, hub.",
              "Bottom-up NRE estimate for the custom receiver and a certification lab quote.",
              "Benchmark the Jetson on whole-signal processing of 4 and 8 channels.",
              "Show phase lock between two bladeRF micro boards (or choose a 4-channel coherent radio).",
              "Measure interference removal and background stability on Seed recordings (city site, several hours).",
              "Field installation time and loaded labor rate from an installer quote.",
              "Company running cost per year for the business plan (team, office, sales, insurance).",
              "Pricing: test value-based subscription levels and the all-in fee with design partners; how prisons buy (capital vs service budgets).",
              "Recalibrate the fast estimate at the sparse- and dense-tower sites against full simulations."]:
        w(f"- {t}")
    w("")

    # 14
    w("## 14. Sources\n")
    for k, s in [
        ("[1]", "Seed Pitch Data Package (team draft): USRP B210 price and planning prices — `Your Seed Pitch Data Package and Prototype.pdf`"),
        ("[2]", "Nuand bladeRF 2.0 micro xA4 listing — https://www.nuand.com/"),
        ("[3]", "Axon hardware + installation configuration — data package ref [3]"),
        ("[4]", "AirSight annual subscriptions — data package ref [4]"),
        ("[5]", "NVIDIA Jetson Orin Nano Super Developer Kit ($249) — https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/nano-super-developer-kit/"),
        ("[6]", "Raspberry Pi 5 and N100 mini PC prices, Oct 2026 — https://terminalbytes.com/raspberry-pi-5-vs-n100-mini-pc-2026/"),
        ("[7]", "Nuand forum, bladeRF micro phase coherency — https://nuand.com/forums/viewtopic.php?t=5004"),
        ("[8]", "DigiKey, Infineon IM69D130 — https://www.digikey.com/en/products/detail/infineon-technologies/IM69D130V01XTSA1/8030732"),
        ("[9]", "BLS OEWS, Security and Fire Alarm Systems Installers (49-2098) — https://www.bls.gov/oes/2023/may/oes492098.htm; May 2025 median $28.88/h as reported by https://nuecareer.com/careers/security-and-fire-alarm-systems-installer (confirm on the current BLS page)"),
        ("[10]", "Demissie & Steffes, Drone Detection With a LTE450-Based Passive Radar, IET Radar, Sonar & Navigation 19:e70092 (2025)"),
        ("[11]", "Custom receiver parts: DigiKey and Mini-Circuits listings linked in section 3; JLCPCB assembly prices — " + C.ASSEMBLY["url"]),
        ("[12]", "Echodyne EchoGuard, 120 deg x 80 deg field of view — https://www.echodyne.com/newsroom/what-is-a-low-swap-radar; hover detection ranges in https://www.trade.gov/sites/default/files/2024-08/ECHODYNE.pdf"),
        ("[13]", "AirSight drone detection radar guide (single FMCW unit $30K-$80K, hardware only; undated, (c) 2026) — https://www.airsight.com/blog/drone-detection-radar-guide"),
        ("[14]", "AirSight drone detection system cost guide (installation, survey, calibration, training, software and maintenance add 30-60% to hardware; undated, (c) 2026) — https://www.airsight.com/blog/drone-detection-system-cost"),
        ("[15]", "OMNIA Partners, Axon/Dedrone price list AM9 (2025-02-04), Robin Iris radar $396,000 — https://www.omniapartners.com/suppliers-files/A-D/Axon/Contract_Documents/3544-21-4615/3544-21-4615_AM9_Axon_2025_02_04.pdf (now redirects to a login; figure from a search-result snippet)"),
    ]:
        w(f"- {k} {s}")
    OUT.write_text("\n".join(L) + "\n")
    print(f"wrote {OUT} ({len(L)} lines)")


if __name__ == "__main__":
    main()
