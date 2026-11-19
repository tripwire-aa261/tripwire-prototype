"""Precompute everything the viewer's Overview, Simulation and Financials tabs need to answer
"which sensor design meets the customer's requirements at each site, and what does it cost".

    .venv/bin/python -m twin.explore            (~100 min on 4 cores, 4 sites; writes web/data/explore.json)
    .venv/bin/python -m twin.explore --maps     (~8 min: recommendations and coverage maps only)
    .venv/bin/python -m twin.explore --site clemson   (one site only, merged into the existing file)

Grid: 3 real sites x 2 drones x 8 sensor designs x 3 drone heights x 3 interference-removal levels x
node counts. For each point, at several zone radii (distance protected around the fence):
  area covered  share of the zone where 3+ tower-sensor pairs detect the drone (coverage map)
  accuracy      median expected position error over the covered area (coverage.position_error_m)
  time tracked  scored-flight track availability (flights.py), flights at that height
  warning       median distance outside the fence when a flight is first tracked
Costs are computed in the browser from the per-sensor hardware cost and the editable financial inputs.
"""
from __future__ import annotations

import datetime as dt
import json
import multiprocessing as mp
import os
import time
from concurrent.futures import ProcessPoolExecutor
from dataclasses import replace
from pathlib import Path

import numpy as np

from .antenna import ANTENNAS, zone_samples
from .config import DRONES, Params
from .cost import FINANCE, RADIOS, facility_costs, node_cost
from .coverage import acoustic_count, albersheim_db, coverage_grid, pair_snr_db, position_error_m
from .flights import scored_flights
from .scenarios import SITE_PARAMS
from .geo import distance_to_polygon
from .multiband import all_pairs

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "data" / "explore.json"

SITES = ["hays", "hancock", "fulton", "clemson"]
DRONE_KEYS = ["m210", "mavic"]
HEIGHTS = [30, 60, 120]
INTERFERENCE = [20, 30, 40]  # dB of neighbor-cell interference removed (cochannel_suppression_db)
NODES = [3, 4, 6, 8, 12, 16]
RADII = [50, 100, 150, 200, 300]
FLIGHTS = 20
BASE = dict(cit_s=0.8, adc_bits=12, bird=False, network_load=0.3)
DEFAULT_REQ = {"radius_m": 150, "height_m": 60, "coverage_pct": 90, "tracked_pct": 80, "accuracy_m": 25, "detection_m": 300,
               "update_s": 2.0, "interference_db": 20}

DESIGNS = {
    "basic": dict(label="1 antenna, standard processing", short="1 antenna · standard",
                  radio="bladerf", p=dict(antenna="patch", rx_elements=1, processing="crs_p0")),
    "ring4": dict(label="4-antenna ring, standard processing", short="4 antennas · standard",
                  radio="bladerf", p=dict(antenna="omni", rx_elements=4, processing="crs_p0")),
    "fan2_enh": dict(label="2 antennas, enhanced processing", short="2 antennas · enhanced",
                     radio="bladerf", p=dict(antenna="patch", rx_elements=2, faces=2, processing="full")),
    "ring4_enh": dict(label="4-antenna ring, enhanced processing", short="4 antennas · enhanced",
                      radio="bladerf", p=dict(antenna="omni", rx_elements=4, processing="full")),
    "ring4_enh_mic": dict(label="4-antenna ring, enhanced processing + microphone", short="4 antennas · enhanced · mic",
                          radio="bladerf", p=dict(antenna="omni", rx_elements=4, processing="full", mic_range_m=100.0)),
    "ring8_enh_mic": dict(label="8-antenna ring, enhanced processing + microphone (custom receiver)",
                          short="8 antennas · enhanced · mic", radio="custom",
                          p=dict(antenna="omni", rx_elements=8, processing="full", mic_range_m=100.0)),
    # v0.4.3: the hover is held in software by background history (twin/hover.py) instead of a microphone.
    "ring4_enh_hist": dict(label="4-antenna ring, enhanced processing, hover by background history",
                           short="4 antennas · enhanced · history", radio="bladerf",
                           p=dict(antenna="omni", rx_elements=4, processing="full", hover_history=True)),
    "ring8_enh_hist": dict(label="8-antenna ring, enhanced processing, hover by background history",
                           short="8 antennas · enhanced · history", radio="custom",
                           p=dict(antenna="omni", rx_elements=8, processing="full", hover_history=True)),
}


def _params(site, drone, design, height, interf, n, extra=None) -> Params:
    """Design-point parameters: base + design + per-site settings (SITE_PARAMS) + any extra overrides."""
    d = DESIGNS[design]
    return Params.from_dict({**BASE, **d["p"], "drone": drone, "altitude_agl_m": height,
                             "cochannel_suppression_db": interf, "n_listeners": n, "zone_buffer_m": 150,
                             **SITE_PARAMS.get(site, {}), **(extra or {})})


def _point(args):
    """One design point. args = (site, drone, design, height, interference, sensors[, extra Params overrides])."""
    from .scenarios import site_scene
    site, drone, design, height, interf, n = args[:6]
    extra = args[6] if len(args) > 6 else None
    p = _params(site, drone, design, height, interf, n, extra)
    sc = site_scene(site, p, site_params=False)
    zs = zone_samples(sc.site, max(RADII), height, 40.0)
    dist = np.asarray(distance_to_polygon(zs[:, 0], zs[:, 1], sc.site.fence))
    thr = albersheim_db(0.9, p.pfa)
    snrs = [pair_snr_db(sc, pr, zs) for pr in all_pairs(sc)]
    cnt = np.sum([s >= thr for s in snrs], axis=0)
    mic = acoustic_count(sc, zs)
    located = (cnt >= 3) | (mic >= 2)
    err = position_error_m(sc, zs, snrs, thr)
    cov, acc = [], []
    for r in RADII:
        m = dist <= r
        cov.append(round(float(100 * located[m].mean()), 1))
        e = err[m & np.isfinite(err)]
        acc.append(round(float(np.median(e)), 1) if len(e) else None)
    fl = scored_flights(sc, FLIGHTS, agl=height, radii=RADII)
    return {"k": [site, drone, design, height, interf, n], **({"extra": extra} if extra else {}), "cov": cov, "acc": acc,
            "trk": [fl["by_radius"][r] for r in RADII], "warn": fl["warning_m"], "caught": fl["caught_pct"],
            "det80": fl["detect80_m"], "det50": fl["detect50_m"], "dirs": fl["detect_dirs"]}


def _map(args):
    """Coverage map snapshot for the Overview tab."""
    from .scenarios import site_scene
    site, drone, design, height, interf, n = args
    p = _params(site, drone, design, height, interf, n)
    sc = site_scene(site, p, site_params=False)
    c = np.asarray(sc.site.fence)[:-1].mean(axis=0)
    ext = float(np.max(np.abs(np.asarray(sc.site.fence) - c))) + 450
    half = float(np.ceil(ext / 25) * 25)
    g = coverage_grid(sc, half_m=half, step_m=25.0)
    # coverage_grid is centred on (0, 0) = site origin; record that for drawing.
    return {"k": list(args), "x0": g["x0"], "y0": g["y0"], "step": g["step_m"], "n": g["n"],
            "state": "".join(str(int(v)) for v in g["state"].ravel()),
            "sensors": [np.round(l.pos[:2], 1).tolist() for l in sc.listeners],
            "towers_used": sorted({i.id.split(":")[0] for i in sc.illuminators})}


def _pool(fn, jobs, label):
    blas = ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS", "VECLIB_MAXIMUM_THREADS")
    os.environ.update({k: "1" for k in blas})
    out, t0 = [], time.time()
    with ProcessPoolExecutor(max_workers=min(4, os.cpu_count() or 1), mp_context=mp.get_context("spawn")) as ex:
        for k, r in enumerate(ex.map(fn, jobs, chunksize=4)):
            out.append(r)
            if (k + 1) % 40 == 0 or k + 1 == len(jobs):
                el = time.time() - t0
                print(f"\r  {label}: {k + 1}/{len(jobs)}  ({el / 60:.1f} min, ~{el / (k + 1) * (len(jobs) - k - 1) / 60:.0f} min left)", end="", flush=True)
    print()
    return out


def node_costs() -> dict:
    out = {}
    for key, d in DESIGNS.items():
        p = Params.from_dict({**BASE, **d["p"]})
        radios = [d["radio"]] if d["radio"] == "custom" else ["bladerf", "b210"]
        out[key] = {r: node_cost(p.rx_elements, p.antenna, r, p.processing, p.mic_range_m > 0) for r in radios}
    return out


# Each radio comes with one fixed sensor build on the Overview and in Financials (the Simulation tab can
# explore the other builds). Since v0.4.3 the fixed builds hold the hover by background history (software)
# instead of a microphone (stability -30 dB, ASSUMPTION; twin/hover.py). bladeRF and B210 are the same radio in the model (12-bit, 2 channels per board);
# the B210 only costs more.
BUILDS = {"bladerf": "ring4_enh_hist", "b210": "ring4_enh_hist", "custom": "ring8_enh_hist"}

# The option the Overview recommends by default: the cheapest (customer's total over the contract) radio and
# sensor count that covers at least 90 % of the protected area and holds a track 80 % of the time (ASSUMPTION
# default targets; the Overview has sliders for both). If none does: the one covering the most area.
RECOMMEND = {"area_pct": float(DEFAULT_REQ["coverage_pct"]), "tracked_pct": float(DEFAULT_REQ["tracked_pct"]),
             "accuracy_m": float(DEFAULT_REQ["accuracy_m"]), "detection_m": float(DEFAULT_REQ["detection_m"])}


def recommend(results, costs, site, drone, interf, req=DEFAULT_REQ, target=RECOMMEND):
    """(design, radio, sensors, meets targets) at the default protected distance and height."""
    from .cost import customer_price
    ri = RADII.index(req["radius_m"])
    by_design = {}
    for radio, de in BUILDS.items():
        by_design.setdefault(de, []).append(radio)
    best, fallback = None, None
    for r in results:
        s, dr, de, h, i, n = r["k"]
        if (s, dr, h, i) != (site, drone, req["height_m"], interf) or de not in by_design:
            continue
        for radio in by_design[de]:
            fc = facility_costs(n, costs[de][radio]["total"])
            total = customer_price(fc["upfront"], fc["yearly"])["customer_total"]
            acc = r["acc"][ri]
            ok = (r["cov"][ri] >= target["area_pct"] and r["trk"][ri] >= target["tracked_pct"]
                  and acc is not None and acc <= target.get("accuracy_m", 1e9)
                  and r.get("det50", 0) >= target.get("detection_m", 0))
            if ok and (best is None or total < best[0]):
                best = (total, de, radio, n)
            score = (r["cov"][ri], r["trk"][ri], -total)
            if fallback is None or score > fallback[0]:
                fallback = (score, de, radio, n)
    pick = best or fallback
    return pick[1], pick[2], pick[3], best is not None


def map_jobs(sites=None):
    """Coverage maps for every fixed build x sensor count at the default height (the Overview draws any of them)."""
    return [(s, d, de, DEFAULT_REQ["height_m"], i, n) for s in (sites or SITES) for d in DRONE_KEYS
            for de in sorted(set(BUILDS.values())) for i in INTERFERENCE for n in NODES]


def site_info(key):
    from .scenarios import SITE_IDS, SITE_LABELS, fence_centre, load_site
    s = load_site(key)
    towers = json.loads((ROOT / "data" / "sites" / SITE_IDS[key] / "towers.json").read_text())["towers"]
    cell = [t for t in towers if t.get("likely_cellular")]
    return {"key": key, "id": SITE_IDS[key], "name": s.name, "place": s.meta.get("place", ""), "type": SITE_LABELS[key],
            "fence": np.round(np.asarray(s.fence), 1).tolist(), "centre": np.round(fence_centre(s), 1).tolist(),
            "fence_area_ha": round(s.meta["fence_area_m2"] / 1e4, 1), "buildings": len(s.buildings),
            "towers_5km": sum(t["distance_m"] <= 5000 for t in cell), "towers_10km": sum(t["distance_m"] <= 10000 for t in cell),
            "nearest_tower_km": round(min(t["distance_m"] for t in cell) / 1000, 1),
            "towers": [{"id": t["id"], "x": round(t["x"]), "y": round(t["y"]), "carriers": t.get("carriers") or []}
                       for t in cell if t["distance_m"] <= 6000]}


def recommendations(results, costs):
    recs = {}
    for s in SITES:
        for d in DRONE_KEYS:
            for i in INTERFERENCE:
                de, radio, n, ok = recommend(results, costs, s, d, i)
                recs[f"{s}|{d}|{i}"] = {"design": de, "radio": radio, "n": n, "meets": ok}
    return recs


def refresh_maps():
    """Recompute the recommendations and coverage maps only, keeping the design-point results (~5 min)."""
    t0 = time.time()
    doc = json.loads(OUT.read_text())
    costs = node_costs()
    doc["recommend"], doc["builds"] = RECOMMEND, BUILDS
    doc["recommended"] = recommendations(doc["results"], costs)
    doc["maps"] = _pool(_map, map_jobs(), "maps")
    OUT.write_text(json.dumps(doc, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB) in {(time.time() - t0) / 60:.1f} min")


def add_site(key):
    """Compute one site's design points and maps and merge them into the existing explore.json, keeping the other
    sites' results (the model is deterministic, so this equals a full run for that site)."""
    t0 = time.time()
    doc = json.loads(OUT.read_text())
    jobs = [(key, d, de, h, i, n) for d in DRONE_KEYS for de in DESIGNS for h in HEIGHTS for i in INTERFERENCE for n in NODES]
    print(f"{key}: {len(jobs)} design points")
    new = _pool(_point, jobs, "points")
    doc["results"] = [r for r in doc["results"] if r["k"][0] != key] + new
    doc["sites"] = {k: (site_info(k) if k == key else doc["sites"][k]) for k in SITES if k == key or k in doc["sites"]}
    doc["recommended"] = recommendations(doc["results"], node_costs())
    doc["maps"] = [m for m in doc["maps"] if m["k"][0] != key] + _pool(_map, map_jobs([key]), "maps")
    doc["site_params"] = SITE_PARAMS
    OUT.write_text(json.dumps(doc, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB) in {(time.time() - t0) / 60:.1f} min")


def main():
    import sys
    if "--maps" in sys.argv:
        return refresh_maps()
    if "--site" in sys.argv:
        return add_site(sys.argv[sys.argv.index("--site") + 1])
    t0 = time.time()
    jobs = [(s, d, de, h, i, n) for s in SITES for d in DRONE_KEYS for de in DESIGNS for h in HEIGHTS
            for i in INTERFERENCE for n in NODES]
    print(f"{len(jobs)} design points")
    results = _pool(_point, jobs, "points")
    costs = node_costs()
    recs = recommendations(results, costs)
    maps = _pool(_map, map_jobs(), "maps")
    doc = {
        "created": dt.datetime.now().isoformat(timespec="seconds"), "runtime_min": round((time.time() - t0) / 60, 1),
        "sites": {k: site_info(k) for k in SITES},
        "drones": {k: {"name": DRONES[k].name, "rcs_m2": DRONES[k].rcs_m2} for k in DRONE_KEYS},
        "designs": {k: {"label": d["label"], "short": d["short"], "radio": d["radio"], "params": d["p"],
                        "node_cost": costs[k]} for k, d in DESIGNS.items()},
        "antennas": {k: {"name": a.name, "gain_dbi": a.gain_dbi, "price_usd": a.price_usd} for k, a in ANTENNAS.items()},
        "radios": {k: {"name": r["name"], "usd": r["usd"], "stage": r["stage"], "source": r["source"]} for k, r in RADIOS.items()},
        "axes": {"heights": HEIGHTS, "interference": INTERFERENCE, "nodes": NODES, "radii": RADII},
        "site_params": SITE_PARAMS, "default_req": DEFAULT_REQ, "recommend": RECOMMEND, "builds": BUILDS, "update_interval_s": BASE["cit_s"] and 1.5,
        "finance": FINANCE, "results": results, "recommended": recs, "maps": maps,
        "notes": {
            "area_covered": "Share of the zone (fence + radius) where 3+ tower-sensor pairs detect the drone, or 2+ microphones hear it.",
            "accuracy": "Median expected position error over the covered area; rough (within ~2x of the full simulation).",
            "time_tracked": f"Scored-flight estimate: {FLIGHTS} random contraband flights at the chosen height, share of in-zone time with a held track.",
            "drones_caught": f"Scored-flight estimate: share of {FLIGHTS} random contraband flights at the chosen height that are tracked before the drone crosses the fence.",
            "detection_range": f"Scored-flight estimate: how far outside the fence an incoming drone is when its track begins (only tracks before it crosses; untracked = 0). det50 = typical drone (median over {FLIGHTS} flights x 16 draws; the customer requirement, DECISION Nov 12); det80 = met by 8 in 10 drones (information); dirs = [approach bearing, median range] per flight. Flights start {int(__import__('twin.flights', fromlist=['APPROACH_M']).APPROACH_M)} m from the drop point.",
            "interference": "dB of interference from neighboring cells on the same carrier that the processing removes: 20 = current assumption; 40 = rebuilding and subtracting neighbor cells (unproven).",
            "update": "One position update per processed frame: every 1.5 s (0.8 s integration).",
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB) in {(time.time() - t0) / 60:.1f} min")


if __name__ == "__main__":
    main()
