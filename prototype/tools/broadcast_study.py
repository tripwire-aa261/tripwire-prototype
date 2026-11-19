"""Which signal works where (v0.6): cell towers vs digital TV vs FM at our four sites.

For each site and drone, with the same sensor positions as the cell-tower design (our own 8-channel receiver, 6 and 12
sensors, 60 m drone height, zone = fence + 150 m), compare:
  * cell towers at 20 dB and 40 dB of neighbor-cell interference removal: the twin's design-point results
    (web/data/explore.json, ring8_enh_hist), unchanged;
  * digital TV and FM: twin/broadcast.py link-budget estimate with the FCC transmitters around the site.
Writes web/runs/broadcast_study.json. Run: python -m tools.broadcast_study
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from twin.broadcast import ERROR_FLOOR_M, calibrate_tv, coverage, load_broadcast  # noqa: E402
from twin.config import Params  # noqa: E402
from twin.explore import BASE, DESIGNS, RADII, SITE_PARAMS  # noqa: E402
from twin.scenarios import SITE_IDS, SITE_LABELS, load_site  # noqa: E402
from twin.scene import place_listeners  # noqa: E402

OUT = ROOT / "web" / "runs" / "broadcast_study.json"
SITES = ["hays", "hancock", "fulton", "clemson"]
DRONES_ = ["m210", "mavic"]
NODES = [6, 12]


def lte_result(explore, site, drone, interf, n, design="ring8_enh_hist", height=60):
    ri = RADII.index(150)
    for r in explore["results"]:
        if r["k"] == [site, drone, design, height, interf, n]:
            return {"located_pct": r["cov"][ri], "tracked_pct": r["trk"][ri], "median_error_m": r["acc"][ri]}
    return None


def main():
    explore = json.loads((ROOT / "web" / "data" / "explore.json").read_text())
    out = {"method": __doc__.strip().splitlines()[0], "notes": [
        "TV and FM: analytic link budget with the twin's calibrated loss and direct-signal cancellation, and a noise floor at least 20 dB above thermal (measured ATSC passive radar: 6-20 dB, Garry et al. 2017). Far fewer co-channel neighbours than LTE, but some exist (Barott & Himed 2015); not modeled beyond that floor.",
        "No drone has yet been detected with US digital TV (ATSC) in published work; the evidence is DVB-T, DVB-T2 and DTMB trials in Europe and China (0.2-5 km bistatic). Hovering drones sit in the zero-Doppler clutter notch: a hovering multirotor was seen only through its rotor modulation (Poullin, NATO MP-SET-231, 2016).",
        "Cell towers: the twin's full design-point model (same sensors, same zone).",
        "Located = 3 or more transmitter-sensor pairs detect the drone. FM resolves range only to ~1.5 km, so it can warn but not place a drone.",
        "SIMPLIFICATIONS: licensed ERP toward the site; 8 dBi receive gain for TV, 2 dBi for FM; terrain beyond the site tile flat; 5 m error floor added.",
        "CONSERVATIVE: against the published DVB-T trial (Martelli 2020, detection to 5 km bistatic) this model reaches only ~0.5 km; we keep it that way.",
        "NOT MODELED: receiver blocking next to megawatt transmitters (Fulton is 6 km from a 869 kW station), ATSC 1.0 reference rebuild quality, terrain shadowing beyond the site tile."],
        "calibration": calibrate_tv(), "error_floor_m": ERROR_FLOOR_M, "sites": {}}
    for s in SITES:
        site = load_site(s)
        txs = load_broadcast(site)
        res = {"name": site.name, "type": SITE_LABELS[s], "tv_count": sum(t.kind == "tv" for t in txs),
               "fm_count": sum(t.kind == "fm" for t in txs), "cases": []}
        for n in NODES:
            p = Params.from_dict({**BASE, **DESIGNS["ring8_enh_hist"]["p"], "n_listeners": n, "altitude_agl_m": 60,
                                  "zone_buffer_m": 150, **SITE_PARAMS.get(s, {})})
            rx = [l.pos for l in place_listeners(site, p)]
            for d in DRONES_:
                case = {"sensors": n, "drone": d,
                        "cell_20db": lte_result(explore, s, d, 20, n), "cell_40db": lte_result(explore, s, d, 40, n)}
                for kind in ("tv", "fm"):
                    ks = [t for t in txs if t.kind == kind]
                    case[kind] = coverage(site, p, rx, ks, d) if ks else None
                res["cases"].append(case)
                tv = case["tv"] or {}
                print(f"{s:8s} n={n:2d} {d:5s}  cell20 {case['cell_20db']}  tv loc {tv.get('located_pct')}% err {tv.get('median_error_m')}  fm det {(case['fm'] or {}).get('detected_pct')}%")
        out["sites"][s] = res
    OUT.write_text(json.dumps(out, indent=1))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
