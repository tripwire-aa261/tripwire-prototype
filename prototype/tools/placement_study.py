"""Where should a stadium's sensors go: on poles around it, on the stands, or alternating?

Runs the explorer's fast estimate (coverage, time tracked, accuracy, detection range; twin/explore.py) at the
stadium for each mounting option x fixed build x interference removal x sensor count, 5 kg drone at 60 m.

    .venv/bin/python tools/placement_study.py [--site clemson]      (~7 min on 4 cores)

Writes web/runs/placement_study.json and prints the fewest sensors meeting the default requirements, with the area
covered inside the stadium outline (bowl + stands) and in the 150 m strip around it reported separately.
Mountings (twin/config.py): pole = 6 m mast, setback_m outside the stands (SITE_PARAMS); structure = on top of
the stands (building height from site.json, an ASSUMPTION for the stadium) + roof_mast_m; mixed = alternating.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from twin.explore import BUILDS, DEFAULT_REQ, RADII, RECOMMEND, _point, _pool  # noqa: E402
from twin.scenarios import SITE_PARAMS, load_site  # noqa: E402

MOUNTS = ["pole", "structure", "mixed"]
NODES = [3, 4, 6, 8, 12, 16]
INTERFERENCE = [20, 30, 40]
OUT = ROOT / "web" / "runs" / "placement_study.json"


def _bowl(args):
    """Area covered inside the stadium outline (the bowl and stands) and in the strip around it, separately."""
    import numpy as np
    from twin.antenna import zone_samples
    from twin.coverage import albersheim_db, pair_snr_db
    from twin.explore import _params
    from twin.geo import points_in_polygon
    from twin.scenarios import site_scene
    site, drone, de, h, i, n, extra = args
    p = _params(site, drone, de, h, i, n, extra)
    sc = site_scene(site, p, site_params=False)
    zs = zone_samples(sc.site, DEFAULT_REQ["radius_m"], h, 20.0)
    inside = points_in_polygon(zs[:, 0], zs[:, 1], np.asarray(sc.site.fence))
    thr = albersheim_db(0.9, p.pfa)
    ok = np.sum([pair_snr_db(sc, pr, zs) >= thr for pr in sc.pairs], axis=0) >= 3
    return round(float(100 * ok[inside].mean()), 1), round(float(100 * ok[~inside].mean()), 1)


def meets(r):
    ri = RADII.index(DEFAULT_REQ["radius_m"])
    acc = r["acc"][ri]
    return (r["cov"][ri] >= RECOMMEND["area_pct"] and r["trk"][ri] >= RECOMMEND["tracked_pct"]
            and acc is not None and acc <= RECOMMEND["accuracy_m"] and r["det50"] >= RECOMMEND["detection_m"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default="clemson")
    a = ap.parse_args()
    t0 = time.time()
    builds = sorted(set(BUILDS.values()))
    jobs = [(a.site, "m210", de, DEFAULT_REQ["height_m"], i, n, {"mount": m})
            for m in MOUNTS for de in builds for i in INTERFERENCE for n in NODES]
    res = _pool(_point, jobs, "placement")
    bowl = _pool(_bowl, jobs, "bowl")
    ri = RADII.index(DEFAULT_REQ["radius_m"])
    rows, best = [], {}
    for r, (b_in, b_out) in zip(res, bowl):
        site, drone, de, h, i, n = r["k"]
        m = r["extra"]["mount"]
        ok = meets(r)
        rows.append({"mount": m, "design": de, "interference_db": i, "sensors": n, "area_pct": r["cov"][ri],
                     "tracked_pct": r["trk"][ri], "inside_pct": b_in, "around_pct": b_out, "accuracy_m": r["acc"][ri], "caught_pct": r["caught"],
                     "detect50_m": r["det50"], "detect80_m": r["det80"], "meets": ok})
        if ok:
            k = f"{m}|{de}|{i}"
            best[k] = min(best.get(k, 99), n)
    s = load_site(a.site)
    stands = sorted([b for b in s.buildings if b.get("holes")], key=lambda b: -b.get("area_m2", 0))  # largest = stadium
    doc = {"created": dt.datetime.now().isoformat(timespec="seconds"), "site": a.site, "site_params": SITE_PARAMS.get(a.site, {}),
           "stands_height_m": stands[0]["height_m"] if stands else None,
           "stands_height_source": stands[0]["height_source"] if stands else None,
           "requirements": {**RECOMMEND, "radius_m": DEFAULT_REQ["radius_m"], "height_m": DEFAULT_REQ["height_m"]},
           "fewest_sensors": best, "rows": rows}
    OUT.write_text(json.dumps(doc, indent=1))
    print(f"wrote {OUT} in {(time.time() - t0) / 60:.1f} min")
    for de in builds:
        for i in INTERFERENCE:
            line = [f"{m}: {best.get(f'{m}|{de}|{i}', '-')}" for m in MOUNTS]
            print(f"  {de:15s} {i} dB  fewest sensors  " + "  ".join(line))
    for row in rows:
        if row["interference_db"] == 20:
            print(f"  {row['mount']:9s} {row['design']:15s} {row['sensors']:2d}: area {row['area_pct']:5.1f} (inside {row['inside_pct']:5.1f}, around {row['around_pct']:5.1f})  tracked {row['tracked_pct']:5.1f}"
                  f"  acc {row['accuracy_m']}  typical {row['detect50_m']:.0f} m  8in10 {row['detect80_m']:.0f} m")


if __name__ == "__main__":
    main()
