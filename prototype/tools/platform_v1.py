"""Platform prototype v1.0 data: products (cost from the parts list and the twin's sensor counts, price from financial
model v2, benchmark), the GPS jammer locator at three sites, and the incident timeline.

Run after twin/platform_bom.py and twin/explore_v1.py:
    python -m tools.platform_v1
Writes platform/data/products.json, gnss.json, timeline.json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from twin import gnss_jam  # noqa: E402
from twin.config import Params  # noqa: E402
from twin.explore import BASE, DESIGNS, SITE_PARAMS  # noqa: E402
from twin.platform_bom import CAMERA, PRODUCTS, product, seed_sensor, sensor  # noqa: E402
from twin.scenarios import load_site  # noqa: E402
from twin.scene import place_listeners  # noqa: E402

DATA = ROOT / "platform" / "data"
EXPLORE = DATA / "explore.json"

# Financial model v2 plan prices (prototype/web/model-v2-src/model2.js DEFAULTS; team decisions, Draft Report 6).
PRICES = {
    "site": (25000, 25000), "site_cam": (25000 + 40000, 25000 + 5000), "large": (1000000, 400000), "kit": (600000, 120000),
    "oem": (12000, 3000), "gnss_addon": (0, 20000), "gnss_net": (0, 100000),
}
BENCH = {
    "site": ("Axon/Dedrone RF kit $57,915 for hardware and installation, no software (OMNIA Partners price list); AirSight subscriptions $9,071-42,143 a year",
             "https://www.omniapartners.com/suppliers-files/A-D/Axon/Contract_Documents/3544-21-4615/3544-21-4615_Axon_Pricing__AM13__2026_03_19.pdf"),
    "site_cam": ("The camera alone: Axis Q8752-E Mk II at $32,138 dealer price", CAMERA["url"]),
    "large": ("CBP plans about $6M per port-of-entry counter-drone site (CBP FY2027 budget)",
              "https://www.dhs.gov/sites/default/files/2026-04/26_0403_ocfo_fy27-budget-customs-and-border-protection.pdf"),
    "kit": ("Cobb County, GA: about $8.3M for four Dedrone kits with 5 years of support, ~$2.1M each (Police1)",
            "https://www.police1.com/police-grant-center/ga-police-to-spend-9-7m-on-drones-other-safety-items-for-world-cup-thanks-to-dhs-grant"),
    "oem": ("Sold to integrators inside their own counter-drone contracts; no public unit price found", ""),
    "gnss_addon": ("Stand-alone GPS jammer detectors $1,242-2,539 each (NavtechGPS); they detect but do not locate",
                   "https://www.navtechgps.com/departments/gps-jammer-detectors/"),
    "gnss_net": ("Stand-alone GPS jammer detectors $1,242-2,539 each (NavtechGPS); they detect but do not locate",
                 "https://www.navtechgps.com/departments/gps-jammer-detectors/"),
}
WHAT = {
    "site": "Sensors on the perimeter of a prison, jail or stadium, 24/7 alerts to the control room and phones, track records as evidence, upkeep.",
    "site_cam": "The site plus one bispectral heat camera that our track points at the drone, so staff see it before they move.",
    "large": "A military flightline, port of entry or border sector: many times a prison perimeter, with two heat cameras.",
    "kit": "Eight sensors on tripods with batteries and radio links, a heat camera and a rugged laptop: set up for an event or an operation in about an hour.",
    "oem": "Our sensor and software sold to the companies that already hold government counter-drone contracts; they install it.",
    "gnss_addon": "GPS jamming and spoofing monitoring at a site we already protect: the GPS bank is in every platform sensor, so it is software.",
    "gnss_net": "A stand-alone GPS monitoring network: 8 platform sensors spread over a wider area (an airport or a port), sold yearly.",
}


def rec_n(ex, site, build="platform", drone="mavic", interf=20):
    r = ex["recommended"].get(f"{site}|{drone}|{interf}", {}).get(build)
    return r["n"] if r else None


def products_doc(ex):
    s_usd, seed_usd = sensor(1000)["total_usd"], seed_sensor()["total_usd"]
    counts = {"site": rec_n(ex, "hays"), "site_cam": rec_n(ex, "hays"), "large": max(filter(None, [rec_n(ex, "robins"), rec_n(ex, "poe")]), default=16),
              "kit": rec_n(ex, "event") or 6, "oem": 1}
    notes = {
        "site": f"Sensor count: the twin's fewest platform sensors for a 0.9 kg drone at Hays State Prison ({counts['site']}).",
        "site_cam": f"Sensor count as the site ({counts['site']}); camera mount and cabling $1,500 (ASSUMPTION); camera upkeep 5% of its price a year (ASSUMPTION).",
        "large": f"Sensor count: the larger of the twin's counts for a 0.9 kg drone at the Robins flightline ({rec_n(ex, 'robins')}) and the Pharr-Reynosa port ({rec_n(ex, 'poe')}).",
        "kit": f"Sensor count: the twin's count for a 0.9 kg drone at Centennial Olympic Park ({counts['kit']}).",
        "oem": "One sensor plus packaging and test ($500, ASSUMPTION); the integrator installs and supports it.",
    }
    out = []
    for key in ["site", "site_cam", "large", "kit", "oem"]:
        c = product(key, s_usd, counts[key])
        pu, py = PRICES[key]
        margin = 100 * (1 - (c["upfront_usd"] + 5 * c["yearly_usd"]) / (pu + 5 * py))
        out.append({"key": key, "name": PRODUCTS[key]["name"], "who": PRODUCTS[key]["who"], "what": WHAT[key], "sensors": counts[key],
                    "cost": {"upfront": c["upfront_usd"], "yearly": c["yearly_usd"]}, "lines": c["lines"],
                    "price_upfront": pu, "price_yearly": py, "price_text": f"${pu:,.0f} + ${py:,.0f}/yr",
                    "margin_pct": round(margin, 1), "benchmark": BENCH[key][0], "benchmark_url": BENCH[key][1], "sensors_note": notes[key],
                    "extras": {"site": "installation and an on-site hub", "site_cam": "installation, hub and a heat camera",
                               "large": "installation, hub and two heat cameras", "kit": "field kit and a heat camera", "oem": "packaging"}[key]})
    # GPS monitoring: add-on (software on sensors already there) and a stand-alone network of 8 sensors.
    net = product("site", s_usd, 8)
    out.append({"key": "gnss_addon", "name": "GPS monitoring add-on", "who": "Sites we already protect", "what": WHAT["gnss_addon"], "sensors": None,
                "cost": {"upfront": 0.0, "yearly": 600.0}, "lines": [{"item": "Software on the GPS bank already in each sensor; alert handling and evidence reports", "usd": 600.0}],
                "price_upfront": 0, "price_yearly": PRICES["gnss_addon"][1], "price_text": "$20,000/yr", "margin_pct": round(100 * (1 - 600 / 20000), 1),
                "benchmark": BENCH["gnss_addon"][0], "benchmark_url": BENCH["gnss_addon"][1], "sensors_note": "Yearly cost: cloud and alert handling, ASSUMPTION.", "extras": ""})
    out.append({"key": "gnss_net", "name": "GPS monitoring network", "who": "Airports, ports, the FAA", "what": WHAT["gnss_net"], "sensors": 8,
                "cost": {"upfront": net["upfront_usd"], "yearly": net["yearly_usd"]}, "lines": net["lines"],
                "price_upfront": 0, "price_yearly": PRICES["gnss_net"][1], "price_text": "$100,000/yr",
                "margin_pct": round(100 * (1 - (net["upfront_usd"] + 5 * net["yearly_usd"]) / (5 * PRICES["gnss_net"][1])), 1),
                "benchmark": BENCH["gnss_net"][0], "benchmark_url": BENCH["gnss_net"][1], "sensors_note": "Installed like a site with 8 sensors.", "extras": ""})
    cost_by_n = {}
    for prod, ns in ex["nodes"].items():
        key = prod
        cost_by_n[key] = {hw: {str(n): {"upfront": product(key, u, n)["upfront_usd"], "yearly": product(key, u, n)["yearly_usd"]} for n in ns}
                          for hw, u in (("platform", s_usd), ("seed", seed_usd))}
    return {"products": out, "cost_by_n": cost_by_n, "prices_source": "financial model v2 plan prices (prototype/web/model-v2-src/model2.js)"}


def sensors_for(key, n):
    site = load_site(key)
    p = Params.from_dict({**BASE, **DESIGNS["ring8_enh_hist"]["p"], "n_listeners": n, "zone_buffer_m": 150, **SITE_PARAMS.get(key, {})})
    return site, np.array([l.pos for l in place_listeners(site, p)])


GNSS_SITES = {"robins": "Robins flightline", "poe": "Pharr-Reynosa port", "hays": "Hays"}


def gnss_doc(ex):
    rng = np.random.default_rng(11)
    out = {"assumptions": ("Today: oven crystal ~50 ns while jammed, detection at 10 dB jammer-to-noise, bearings 3 degrees from the "
                           "4-element array. Software upgrades: clocks kept in step by the TV and cell signals (5 ns), correlation "
                           "detection down to 10 dB below the noise, bearing calibration to 1 degree. Premium: chip-scale atomic clock "
                           "~5 ns. All ASSUMPTIONS (twin/gnss_jam.py), measured at Seed. Method as the Baltic TDOA network "
                           "(GPS Solutions 2026); the DTU trial tracked a 10 mW car jammer (NAVIGATION 2026)."),
           "setups": list(gnss_jam.SETUPS), "sites": {}}
    names = {0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW"}
    for key, short in GNSS_SITES.items():
        n = rec_n(ex, key) or 8
        site, s = sensors_for(key, n)
        fence = np.asarray(site.fence)
        c = fence[:-1].mean(axis=0)
        rmax = float(np.max(np.linalg.norm(fence[:, :2] - c, axis=1)))
        g0 = float(np.mean([site.ground(x, y) for x, y in s[:, :2]]))
        spots = []
        for d, label, az in ((300, "car on a road 300 m outside", 135), (1000, "1 km outside", 37), (2000, "2 km outside", 307)):
            xy = c + (rmax + d) * np.array([np.sin(np.radians(az)), np.cos(np.radians(az))])
            dz = float(site.ground(*xy)) - g0
            terr = f", {abs(round(dz))} m below the sensors" if dz < -10 else (f", {round(dz)} m above the sensors" if dz > 10 else "")
            spots.append((f"{label} ({names[min(names, key=lambda a: min(abs(a - az), 360 - abs(a - az)))]}{terr})", xy))
        cases = []
        for setup, (clock, thr, bdeg) in gnss_jam.SETUPS.items():
            for power in (10, 30):
                for mode in ("tdoa", "tdoa+aoa"):
                    for name, xy in spots:
                        r = gnss_jam.trial(site, s, xy, power, gnss_jam.CLOCKS_NS[clock], rng, mode=mode, bearing_deg=bdeg, detect_db=thr)
                        cases.append({"where": name, "power_dbm": power, "clock": setup, "mode": mode, **r})
        half = float(np.ceil((rmax + 1500) / 150) * 150)
        maps = {}
        for setup, (clock, thr, bdeg) in gnss_jam.SETUPS.items():
            maps[setup] = gnss_jam.jammer_map(site, s, 10, gnss_jam.CLOCKS_NS[clock], half_m=half, step_m=max(150.0, round(2 * half / 24 / 50) * 50),
                                              bearing_deg=bdeg, detect_db=thr)
        out["sites"][key] = {"name": site.name, "short": short, "sensors": np.round(s[:, :2], 1).tolist(),
                             "fence": np.round(fence, 1).tolist(), "cases": cases, "maps": maps}
        print("gnss", key, n, "sensors", [(c_["where"][:12], c_["clock"], c_["power_dbm"], c_["error_m"], c_["fail_pct"]) for c_ in cases if c_["mode"] == "tdoa+aoa"])
    return out


def timeline_doc():
    v06 = json.loads((ROOT / "web" / "runs" / "platform_v06.json").read_text().replace("recognisable", "recognizable"))
    w = v06["walkthrough"]
    cases = [dict(c, url="") for c in w["cases"]]
    cases[0]["url"] = "https://www.wrdw.com/2026/11/13/man-gets-federal-prison-time-flying-drone-onto-sc-prison-yard/"
    cases[1]["url"] = "https://gdc.georgia.gov/contraband-report/2025-10-01/contraband-arrests-multiple-state-prisons"
    cases += [
        {"where": "Centennial Olympic Park, Atlanta, June 2026", "url": "https://www.cbsnews.com/atlanta/news/fbi-seizes-76-drones-caught-flying-near-atlanta-fifa-mens-world-cup-events-agency-says/",
         "what": "During the World Cup the FAA closed the airspace over downtown Atlanta; by June 29 the FBI had seized 76 drones, and one pilot was charged for flying over the Centennial Park fan festival on June 15 (CBS News, 30 Jun 2026).",
         "lesson": "Event security needs a kit it can set up for a few weeks and then move: the mobile kit."},
        {"where": "Reynosa, across from the Pharr port of entry, October 2025", "url": "https://smallwarsjournal.com/2026/01/06/los-metros-faction-of-the-cartel-del-golfo-cdg-arsenal-of-explosives-ieds-kamikaze-and-other-drones-and-counter-drone-systems-seized-in-reynosa-tamaulipas/",
         "what": "Mexican forces seized 18 drones, 151 explosive objects and 3 drone jammers from a Gulf Cartel cell (Small Wars Journal, 6 Jan 2026). Pharr handled 705,786 northbound trucks in FY 2024-25 (City of Pharr).",
         "lesson": "Ports of entry face drones and jammers together: the same sensors watch for both."},
    ]
    return {"walkthrough": w, "cases": cases}


def main():
    ex = json.loads(EXPLORE.read_text())
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "products.json").write_text(json.dumps(products_doc(ex), indent=1))
    (DATA / "timeline.json").write_text(json.dumps(timeline_doc(), indent=1))
    (DATA / "gnss.json").write_text(json.dumps(gnss_doc(ex), separators=(",", ":")))
    for p in json.loads((DATA / "products.json").read_text())["products"]:
        print(p["key"], p["sensors"], p["cost"], p["price_text"], p["margin_pct"])


if __name__ == "__main__":
    main()
