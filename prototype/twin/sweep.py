"""Coverage and cost versus number of nodes, for several node designs: the "how many sensors, what does
it cost, which coverage tier" chart.

    .venv/bin/python -m twin.sweep --drone m210 --id m210            # all standard designs
    .venv/bin/python -m twin.sweep --drone mavic --designs omni8,omni8_full --id mavic

For each design and node count: share of the protected zone located (coverage map), and scored flights
(fast estimate, flights.py). Writes web/runs/sweeps/<id>.json and web/runs/sweeps/index.json.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import multiprocessing as mp
import os
from concurrent.futures import ProcessPoolExecutor
from dataclasses import replace
from pathlib import Path

import numpy as np

from .antenna import zone_samples
from .config import Params
from .cost import RADIOS, facility_economics, node_cost
from .coverage import acoustic_count, albersheim_db, pair_snr_db
from .flights import scored_flights

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "runs" / "sweeps"
NODE_COUNTS = [3, 4, 5, 6, 8, 10, 12, 16]
TIERS = [80, 90, 95]  # coverage tiers (team decision: 80 % corrections baseline, higher tiers priced up)

# Shared settings for every design (the v0.2 "upgraded" processing: 0.8 s integration, 12-bit).
BASE = dict(cit_s=0.8, adc_bits=12, bird=False, network_load=0.3)

DESIGNS = {
    "v02_iso": dict(label="v0.2 model: 4 x 10 dBi toward every direction (optimistic)", stage="reference",
                    radio="b210", p=dict(antenna="iso", rx_elements=4, rx_gain_dbi=10.0)),
    "patch1": dict(label="1 patch", stage="Seed", radio="bladerf", p=dict(antenna="patch", rx_elements=1)),
    "patch2_fan": dict(label="2 patches, fanned (2 faces)", stage="Seed", radio="bladerf",
                       p=dict(antenna="patch", rx_elements=2, faces=2)),
    "patch4_2x2": dict(label="4 patches: 2 faces x 2", stage="Seed", radio="bladerf",
                       p=dict(antenna="patch", rx_elements=4, faces=2)),
    "omni4": dict(label="4 omnis, circular array", stage="Seed", radio="bladerf",
                  p=dict(antenna="omni", rx_elements=4)),
    "patch2_fan_full": dict(label="2 patches, fanned + full-signal processing", stage="Seed", radio="bladerf",
                            p=dict(antenna="patch", rx_elements=2, faces=2, processing="full")),
    "omni4_full": dict(label="4 omnis + full-signal processing", stage="Seed", radio="bladerf",
                       p=dict(antenna="omni", rx_elements=4, processing="full")),
    "omni4_full_mic": dict(label="4 omnis + full signal + microphones", stage="Seed", radio="bladerf",
                           p=dict(antenna="omni", rx_elements=4, processing="full", mic_range_m=100.0)),
    "omni8": dict(label="8 omnis, circular array", stage="Series A", radio="custom",
                  p=dict(antenna="omni", rx_elements=8)),
    "patch8_2x4": dict(label="8 patches: 2 faces x 4", stage="Series A", radio="custom",
                       p=dict(antenna="patch", rx_elements=8, faces=2)),
    "omni8_crsall": dict(label="8 omnis + all reference signals", stage="Series A", radio="custom",
                         p=dict(antenna="omni", rx_elements=8, processing="crs_all")),
    "omni8_full": dict(label="8 omnis + full-signal processing", stage="Series A", radio="custom",
                       p=dict(antenna="omni", rx_elements=8, processing="full")),
    "omni8_full_mic": dict(label="8 omnis + full signal + microphones", stage="Series A", radio="custom",
                           p=dict(antenna="omni", rx_elements=8, processing="full", mic_range_m=100.0)),
    "patch8_full": dict(label="8 patches (2 x 4) + full-signal processing", stage="Series A", radio="custom",
                        p=dict(antenna="patch", rx_elements=8, faces=2, processing="full")),
}
STANDARD = ["v02_iso", "patch1", "patch2_fan", "patch4_2x2", "omni4", "omni8", "patch8_2x4",
            "patch2_fan_full", "omni4_full", "omni4_full_mic", "omni8_full"]


def zone_coverage(scene, step_m=40.0) -> dict:
    p = scene.params
    zs = zone_samples(scene.site, p.zone_buffer_m, p.altitude_agl_m, step_m)
    thr = albersheim_db(0.9, p.pfa)
    cnt = np.zeros(len(zs), dtype=int)
    for pair in scene.pairs:
        cnt += pair_snr_db(scene, pair, zs) >= thr
    mic = acoustic_count(scene, zs)
    located = (cnt >= 3) | (mic >= 2)
    return {"located_pct": round(float(100 * located.mean()), 1),
            "detected_pct": round(float(100 * ((cnt >= 1) | (mic >= 1)).mean()), 1)}


def _point(args):
    pdict, n, flights = args
    from .scenarios import site_scene
    p = replace(Params.from_dict(pdict), n_listeners=n)
    sc = site_scene("hays", p)
    out = {"n": n, **zone_coverage(sc)}
    if flights:
        out["flights"] = scored_flights(sc, flights)
    return out


def design_params(key: str, drone: str, extra: dict | None = None) -> Params:
    d = DESIGNS[key]
    return Params.from_dict({**BASE, **d["p"], "drone": drone, **(extra or {})})


def costs_for(p: Params) -> dict:
    return {r: node_cost(p.rx_elements, p.antenna, r, p.processing, p.mic_range_m > 0)["total"] for r in RADIOS}


def sweep(designs: dict, drone: str, run_id: str, node_counts=NODE_COUNTS, flights: int = 40, workers=None,
          progress=None, extra: dict | None = None) -> dict:
    jobs, meta = [], []
    for key, d in designs.items():
        p = Params.from_dict({**BASE, **d["p"], "drone": drone, **(extra or {})})
        meta.append((key, d, p))
        jobs += [(p.to_dict(), n, flights) for n in node_counts]
    workers = workers or min(4, os.cpu_count() or 1)
    blas = ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS", "VECLIB_MAXIMUM_THREADS")
    saved = {k: os.environ.get(k) for k in blas}
    os.environ.update({k: "1" for k in blas})
    results = []
    try:
        with ProcessPoolExecutor(max_workers=workers, mp_context=mp.get_context("spawn")) as ex:
            for k, r in enumerate(ex.map(_point, jobs)):
                results.append(r)
                if progress:
                    progress(k + 1, len(jobs))
    finally:
        for k, v in saved.items():
            os.environ.pop(k, None) if v is None else os.environ.__setitem__(k, v)
    out_designs = []
    for i, (key, d, p) in enumerate(meta):
        pts = results[i * len(node_counts):(i + 1) * len(node_counts)]
        costs = costs_for(p)
        for pt in pts:
            pt["economics"] = facility_economics(pt["n"], costs[d["radio"]])
        min_nodes = {str(t): next((pt["n"] for pt in pts if pt["located_pct"] >= t), None) for t in TIERS}
        out_designs.append({"id": key, "label": d["label"], "stage": d["stage"], "radio": d["radio"],
                            "params": {k: getattr(p, k) for k in ("antenna", "rx_elements", "faces", "rx_gain_dbi",
                                                                  "processing", "mic_range_m", "cit_s", "adc_bits")},
                            "node_cost_usd": costs, "points": pts, "min_nodes": min_nodes})
    doc = {"id": run_id, "drone": drone, "created": dt.datetime.now().isoformat(timespec="seconds"),
           "node_counts": node_counts, "tiers": TIERS, "flights_per_point": flights, "base": {**BASE, **(extra or {})},
           "designs": out_designs,
           "notes": "Located = 3+ tower-node pairs over the detection threshold (coverage map, drone at 60 m). "
                    "Scored flights = fast estimate over random contraband flights (flights.py). "
                    "Costs: parts per node (cost.py); facility billed as ceil(nodes/3) zones."}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{run_id}.json").write_text(json.dumps(doc, indent=1))
    _index()
    return doc


def _index():
    items = []
    for f in sorted(OUT.glob("*.json")):
        if f.name == "index.json":
            continue
        d = json.loads(f.read_text())
        items.append({"id": d["id"], "drone": d["drone"], "created": d["created"], "designs": len(d["designs"])})
    items.sort(key=lambda x: x["created"], reverse=True)
    (OUT / "index.json").write_text(json.dumps({"sweeps": items}, indent=1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--drone", default="m210")
    ap.add_argument("--designs", default=",".join(STANDARD))
    ap.add_argument("--id")
    ap.add_argument("--flights", type=int, default=40)
    ap.add_argument("--set", action="append", default=[], help="extra parameter for every design, e.g. network_load=0.6")
    a = ap.parse_args()
    keys = a.designs.split(",")
    extra = dict(kv.split("=", 1) for kv in a.set)
    doc = sweep({k: DESIGNS[k] for k in keys}, a.drone, a.id or f"sweep-{a.drone}", flights=a.flights,
                progress=lambda k, n: print(f"\r  {k}/{n}", end="", flush=True), extra=extra)
    print()
    for d in doc["designs"]:
        print(f"{d['label'][:48]:48s} ${d['node_cost_usd'][d['radio']]:>7,.0f}/node ({d['radio']})  "
              + "  ".join(f"{pt['n']}:{pt['located_pct']:.0f}%/{pt.get('flights', {}).get('mean_pct', 0):.0f}"
                          for pt in d["points"]) + f"   tiers {d['min_nodes']}")


if __name__ == "__main__":
    main()
