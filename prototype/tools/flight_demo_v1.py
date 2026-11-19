"""Flight simulator data for the platform app: drone flights into each site, frame by frame, with the detections,
located frames and tracks the twin's scored-flight method produces (twin/flights.simulate_flight, one random draw).

    python -m tools.flight_demo_v1        writes platform/data/flights.json (~5 min on 4 cores)

Per site: three contraband flights (in from 1.8 km, hover over a drop point inside the fence, out), each replayed with
the 0.9 kg and the 5 kg drone, cell + digital TV or cell towers only, at 20 dB (today) and 40 dB of interference
removal, all with the same sensors (the platform sensor's recommended count at 20 dB, 0.9 kg). The shown position is
the true position plus a random error of the size the twin expects there (coverage.position_error_m); the full signal
replays of the v0.5 twin are the check on this estimate.
"""
from __future__ import annotations

import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor
import multiprocessing as mp
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

OUT = ROOT / "platform" / "data" / "flights.json"
FLIGHTS, FLIGHT_SEED = 3, 7
DRONES = ["mavic", "m210"]
SIGNALS = ["cell+tv", "cell"]
INTERF = [20, 40]
DESIGN, HEIGHT = "ring8_enh_hist", 60


def _scene(site, drone, sig, interf, n):
    from twin.explore import _params
    from twin.scenarios import site_scene
    p = _params(site, drone, DESIGN, HEIGHT, interf, n, {"signals": sig})
    return site_scene(site, p, site_params=False)


def _bits(mask_rows):
    """(sensors, frames) bool -> one int bitmask per frame."""
    w = (1 << np.arange(mask_rows.shape[0]))[:, None]
    return (mask_rows * w).sum(axis=0).astype(int).tolist()


def _run(args):
    site, n, drone, sig, interf = args
    from twin.coverage import albersheim_db, pair_snr_db, position_error_m
    from twin.flights import random_flights, simulate_flight
    from twin.multiband import all_pairs, is_tv
    sc = _scene(site, drone, sig, interf, n)
    thr = albersheim_db(0.9, sc.params.pfa)
    pairs = all_pairs(sc)
    tv = np.array([is_tv(p) for p in pairs])
    rng = np.random.default_rng(11)
    out = []
    for k, tr in enumerate(random_flights(sc.site, sc.params, FLIGHTS, FLIGHT_SEED, agl=HEIGHT)):
        f = simulate_flight(sc, tr, draws=1, seed=100 + k)
        hits, node_of, pos = f["hits"][0], f["node_of"], f["pos"]  # (P, T)
        L = len(sc.listeners)
        cell_by = np.array([hits[(node_of == j) & ~tv].any(axis=0) for j in range(L)])
        tv_by = np.array([hits[(node_of == j) & tv].any(axis=0) for j in range(L)])
        err = position_error_m(sc, pos, [pair_snr_db(sc, p, pos) for p in pairs], thr)
        sig_m = np.where(np.isfinite(err), err, 40.0)
        est = pos[:, :2] + rng.normal(size=(len(pos), 2)) * sig_m[:, None] / np.sqrt(2)
        out.append({
            "cell": _bits(cell_by), "tv": _bits(tv_by),
            "n_cell": hits[~tv].sum(axis=0).astype(int).tolist(), "n_tv": hits[tv].sum(axis=0).astype(int).tolist(),
            "loc": f["located"][0].astype(int).tolist(), "trk": f["tracked"][0].astype(int).tolist(),
            "est": np.round(est, 1).tolist(), "err": np.round(sig_m, 1).tolist(),
        })
    return {"key": f"{site}|{drone}|{sig}|{interf}", "flights": out}


def _geometry(site, n):
    from twin.flights import random_flights
    from twin.geo import distance_to_polygon
    from twin.multiband import add_tv_pairs
    sc = _scene(site, "mavic", "cell", 20, n)
    fls = random_flights(sc.site, sc.params, FLIGHTS, FLIGHT_SEED, agl=HEIGHT)
    flights = []
    for tr in fls:
        ts = np.arange(0, tr.duration, sc.params.frame_dt_s)
        pos = np.array([tr.state(sc.site, t)[0] for t in ts])
        inside = np.asarray(sc.site.in_zone(pos[:, 0], pos[:, 1], 0.0))
        fence_d = np.asarray(distance_to_polygon(pos[:, 0], pos[:, 1], sc.site.fence))
        a = tr.waypoints[0] - tr.waypoints[1]
        flights.append({"t": np.round(ts, 2).tolist(), "xy": np.round(pos[:, :2], 1).tolist(), "inside": inside.astype(int).tolist(),
                        "fence_m": np.round(np.where(inside, 0, fence_d)).astype(int).tolist(), "speed_mps": round(tr.speed, 1),
                        "from_deg": int(round(float(np.degrees(np.arctan2(a[0], a[1]))))) % 360,
                        "drop": np.round(tr.waypoints[1], 1).tolist(), "hover_s": round(tr.hover_s, 1)})
    tvs = add_tv_pairs(sc, 3)
    c = np.asarray(sc.site.fence)[:-1].mean(axis=0)
    return {"n": n, "dt": sc.params.frame_dt_s, "sensors": [np.round(l.pos[:2], 1).tolist() for l in sc.listeners],
            "towers": sorted({(round(float(i.pos[0]), 1), round(float(i.pos[1]), 1)) for i in sc.illuminators}),
            "tv": [{"call": t.call, "bearing_deg": int(round(float(np.degrees(np.arctan2(t.pos[0] - c[0], t.pos[1] - c[1]))))) % 360,
                    "distance_km": t.distance_km} for t in tvs],
            "flights": flights}


def main():
    ex = json.loads((ROOT / "platform" / "data" / "explore.json").read_text())
    sites = list(ex["sites"])
    nmap = {s: ex["recommended"][f"{s}|mavic|20"]["platform"]["n"] for s in sites}
    doc = {"note": __doc__.split("\n\n")[0], "drones": DRONES, "signals": SIGNALS, "interference": INTERF, "height_m": HEIGHT,
           "sites": {s: _geometry(s, nmap[s]) for s in sites}, "runs": {}}
    jobs = [(s, nmap[s], d, g, i) for s in sites for d in DRONES for g in SIGNALS for i in INTERF]
    os.environ.update({k: "1" for k in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS")})
    with ProcessPoolExecutor(max_workers=min(4, os.cpu_count() or 1), mp_context=mp.get_context("spawn")) as pool:
        for k, r in enumerate(pool.map(_run, jobs)):
            doc["runs"][r["key"]] = r["flights"]
            print(f"\r  {k + 1}/{len(jobs)}", end="", flush=True)
    print()
    OUT.write_text(json.dumps(doc, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
