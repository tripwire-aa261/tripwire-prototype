"""v1.0 platform explorer: which build and how many sensors each site needs, with cell towers alone or cell + digital TV,
and what that costs from the platform parts list (platform_bom.py). Writes platform/data/explore.json.

    python -m twin.explore_v1                 all sites (~1 h on 4 cores)
    python -m twin.explore_v1 --site robins   one site, merged into the existing file
    python -m twin.explore_v1 --maps          add any missing coverage maps (every sensor count, ~1 h)

Same design-point method as twin/explore.py (coverage, accuracy and scored flights from the link budget, fused over
cell and TV pairs by multiband.py), on a smaller grid: drone height 60 m (the default requirement), interference removal
20/30/40 dB (cell only; TV is unaffected), sensor counts suited to each product.
"""
from __future__ import annotations

import datetime as dt
import json
import sys
import time
from pathlib import Path

import numpy as np

from .config import DRONES
from .explore import DEFAULT_REQ, RADII, _map, _point, _pool, site_info
from .platform_bom import seed_sensor, sensor

ROOT = Path(__file__).resolve().parent.parent
import os  # noqa: E402
OUT = Path(os.environ["TRIPWIRE_EXPLORE_OUT"]) if os.environ.get("TRIPWIRE_EXPLORE_OUT") else ROOT / "platform" / "data" / "explore.json"

# Which product each site shows (scenarios.SITE_IDS must know the key).
SITES = {
    "hays": "site", "hancock": "site", "fulton": "site", "clemson": "site",
    "robins": "large", "poe": "large", "event": "kit",
}
NODES = {"site": [4, 6, 8, 12], "large": [8, 12, 16, 20, 24], "kit": [4, 6, 8]}
DRONE_KEYS = ["m210", "mavic"]
INTERFERENCE = [20, 30, 40]
HEIGHT = 60
# Builds: v0.5 design keys from explore.DESIGNS plus the signals used.
BUILDS = {
    "platform": dict(label="Platform sensor: cell + digital TV", design="ring8_enh_hist", signals="cell+tv", hw="platform"),
    "platform_cell": dict(label="Platform sensor, cell towers only (if TV does not work)", design="ring8_enh_hist", signals="cell", hw="platform"),
    "seed": dict(label="Seed sensor (bladeRF boards): cell + digital TV", design="ring4_enh_hist", signals="cell+tv", hw="seed"),
}


def jobs_for(site):
    prod = SITES[site]
    return [(site, d, b["design"], HEIGHT, i, n, {"signals": b["signals"]}) for d in DRONE_KEYS for b in BUILDS.values()
            for i in INTERFERENCE for n in NODES[prod]]


def _build_of(r):
    sig = r.get("extra", {}).get("signals", "cell")
    for k, b in BUILDS.items():
        if b["design"] == r["k"][2] and b["signals"] == sig:
            return k
    return None


def recommend(results, site, drone, interf, req=DEFAULT_REQ):
    """Per build: the fewest sensors that meet the default requirements (area, time tracked, accuracy, detection
    range) at the default protected distance; if none, the count covering the most area."""
    ri = RADII.index(req["radius_m"])
    out = {}
    for bk in BUILDS:
        rows = sorted([r for r in results if r["k"][0] == site and r["k"][1] == drone and r["k"][4] == interf and _build_of(r) == bk],
                      key=lambda r: r["k"][5])
        ok = [r for r in rows if r["cov"][ri] >= req["coverage_pct"] and r["trk"][ri] >= req["tracked_pct"]
              and r["acc"][ri] is not None and r["acc"][ri] <= req["accuracy_m"] and r["det50"] >= req["detection_m"]]
        pick = ok[0] if ok else (max(rows, key=lambda r: (r["cov"][ri], r["trk"][ri], -r["k"][5])) if rows else None)
        if pick:
            out[bk] = {"n": pick["k"][5], "meets": bool(ok), "cov": pick["cov"][ri], "trk": pick["trk"][ri], "acc": pick["acc"][ri],
                       "det50": pick["det50"]}
    return out


def recommendations(results):
    return {f"{s}|{d}|{i}": recommend(results, s, d, i) for s in SITES for d in DRONE_KEYS for i in INTERFERENCE
            if any(r["k"][0] == s for r in results)}


def map_jobs(site, recs=None):
    """Coverage maps for every build, drone, interference level and sensor count shown in the Sites tab."""
    return sorted({(site, d, b["design"], HEIGHT, i, n, b["signals"]) for d in DRONE_KEYS for b in BUILDS.values()
                   for i in INTERFERENCE for n in NODES[SITES[site]]})


def _map_sig(args):
    """explore._map with a signals override (cell + TV maps include the TV pairs)."""
    site, d, de, h, i, n, sig = args
    from . import explore
    from .config import Params
    orig = explore._params

    def patched(*a, **k):
        p = orig(*a, **k)
        return Params.from_dict({**p.to_dict(), "signals": sig})
    explore._params = patched
    try:
        m = _map((site, d, de, h, i, n))
    finally:
        explore._params = orig
    m["signals"] = sig
    return m


def tv_used(site, n=6):
    """The TV transmitters the platform sensor uses at a site (strongest echo over the facility)."""
    from .config import Params
    from .explore import _params
    from .multiband import add_tv_pairs
    from .scenarios import site_scene
    p = Params.from_dict({**_params(site, "mavic", "ring8_enh_hist", HEIGHT, 20, n).to_dict(), "signals": "cell"})
    sc = site_scene(site, p, site_params=False)
    use = add_tv_pairs(sc, 3)
    return [{"call": t.call, "freq_mhz": round(t.freq_hz / 1e6, 1), "distance_km": t.distance_km,
             "erp_kw": round(10 ** ((t.eirp_dbw - 2.15) / 10) / 1e3, 1)} for t in use]


def run(sites):
    t0 = time.time()
    doc = json.loads(OUT.read_text()) if OUT.exists() else {"results": [], "maps": [], "sites": {}}
    for s in sites:
        jobs = jobs_for(s)
        print(f"{s}: {len(jobs)} design points", flush=True)
        new = _pool(_point, jobs, f"{s} points")
        doc["results"] = [r for r in doc["results"] if r["k"][0] != s] + new
        recs = recommendations(doc["results"])
        doc["maps"] = [m for m in doc["maps"] if m["k"][0] != s] + _pool(_map_sig, map_jobs(s, recs), f"{s} maps")
        doc["sites"][s] = {**site_info(s), "product": SITES[s], "tv_used": tv_used(s)}
        doc["recommended"] = recommendations(doc["results"])
        save(doc, t0)
    return doc


def fill_maps(sites):
    """Add the coverage maps an existing explore.json is missing (no new design points)."""
    t0 = time.time()
    doc = json.loads(OUT.read_text())
    have = {tuple(m["k"]) + (m.get("signals", "cell"),) for m in doc["maps"]}
    for s in sites:
        todo = [j for j in map_jobs(s) if j not in have]
        print(f"{s}: {len(todo)} maps to add", flush=True)
        if todo:
            doc["maps"] += _pool(_map_sig, todo, f"{s} maps")
            save(doc, t0)
    return doc


def save(doc, t0):
    doc.update({
        "created": dt.datetime.now().isoformat(timespec="seconds"),
        "builds": BUILDS, "products_by_site": SITES, "nodes": NODES, "interference": INTERFERENCE, "height_m": HEIGHT,
        "radii": RADII, "default_req": DEFAULT_REQ,
        "drones": {k: {"name": DRONES[k].name, "rcs_m2": DRONES[k].rcs_m2} for k in DRONE_KEYS},
        "sensor_usd": {"platform": sensor(1000)["total_usd"], "seed": seed_sensor()["total_usd"]},
    })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB), {(time.time() - t0) / 60:.1f} min", flush=True)


def main():
    if "--maps" in sys.argv:
        return fill_maps([a for a in sys.argv[1:] if a in SITES] or list(SITES))
    if "--site" in sys.argv:
        return run([sys.argv[sys.argv.index("--site") + 1]])
    return run(list(SITES))


if __name__ == "__main__":
    main()
