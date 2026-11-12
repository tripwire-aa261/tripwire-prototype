"""Precompute the 3D replays the Simulation tab picks with three dropdowns: prison x drone x radio.

    .venv/bin/python tools/make_replays.py            (~12 full simulations, roughly 30-60 min on 4 cores)
    .venv/bin/python tools/make_replays.py --plan     (print the plan only)

bladeRF and B210 sensors share a replay: in the model they are the same radio (12-bit, 2 channels per
board) and differ only in price. Each replay uses the radio's fixed sensor build (see web/src/data.js BUILD)
and the number of sensors the twin recommends for that prison and drone at the default targets: the
lowest interference-removal level at which some sensor count reaches them, and the fewest sensors there.
If no level reaches them, the replay shows the best option at the optimistic level (most area covered).
Writes web/runs/replay-<site>-<drone>-<ots|custom>.{json,bin} and web/runs/replays.json (the manifest).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from twin.config import Params  # noqa: E402
from twin.explore import BASE, DEFAULT_REQ, DESIGNS, RADII  # noqa: E402

EXPLORE = ROOT / "web" / "data" / "explore.json"
RUNS = ROOT / "web" / "runs"
BUILDS = {"ots": "ring4_enh_mic", "custom": "ring8_enh_mic"}  # off-the-shelf (bladeRF or B210), custom receiver
TARGET = {"area_pct": DEFAULT_REQ["coverage_pct"], "tracked_pct": DEFAULT_REQ["tracked_pct"]}


def plan() -> list[dict]:
    x = json.loads(EXPLORE.read_text())
    ri, h = RADII.index(DEFAULT_REQ["radius_m"]), DEFAULT_REQ["height_m"]
    res = {tuple(r["k"]): r for r in x["results"]}
    out = []
    for site in x["sites"]:
        for drone in x["drones"]:
            for b, design in BUILDS.items():
                pick = None
                for interf in x["axes"]["interference"]:
                    for n in x["axes"]["nodes"]:
                        r = res[(site, drone, design, h, interf, n)]
                        if r["cov"][ri] >= TARGET["area_pct"] and r["trk"][ri] >= TARGET["tracked_pct"]:
                            pick = (interf, n, True)
                            break
                    if pick:
                        break
                if not pick:
                    top = x["axes"]["interference"][-1]
                    n = max(x["axes"]["nodes"], key=lambda n: (res[(site, drone, design, h, top, n)]["cov"][ri],
                                                               res[(site, drone, design, h, top, n)]["trk"][ri], -n))
                    pick = (top, n, False)
                interf, n, meets = pick
                r = res[(site, drone, design, h, interf, n)]
                out.append({"id": f"replay-{site}-{drone}-{b}", "site": site, "drone": drone, "build": b, "design": design,
                            "n": n, "interference_db": interf, "meets": meets,
                            "expected": {"area_pct": r["cov"][ri], "tracked_pct": r["trk"][ri], "caught_pct": r["caught"]}})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--only", help="comma-separated replay ids to (re)run")
    a = ap.parse_args()
    items = plan()
    for it in items:
        print(f"{it['id']:34} {it['n']:2} sensors at {it['interference_db']} dB  meets={it['meets']}  expected {it['expected']}")
    prev = {}
    if (RUNS / "replays.json").exists():  # keep the metrics of replays not re-run this time (same plan)
        prev = {r["id"]: r for r in json.loads((RUNS / "replays.json").read_text())["replays"]}
    for it in items:
        old = prev.get(it["id"])
        if old and "metrics" in old and (old["n"], old["interference_db"]) == (it["n"], it["interference_db"]):
            it["metrics"] = old["metrics"]
    manifest = {"targets": TARGET, "radius_m": DEFAULT_REQ["radius_m"], "height_m": DEFAULT_REQ["height_m"], "replays": items}
    if a.plan:
        return
    from twin.run import run
    todo = [it for it in items if not a.only or it["id"] in a.only.split(",")]
    for k, it in enumerate(todo):
        p = Params.from_dict({**BASE, **DESIGNS[it["design"]]["p"], "drone": it["drone"], "bird": True,
                              "altitude_agl_m": DEFAULT_REQ["height_m"], "cochannel_suppression_db": it["interference_db"],
                              "n_listeners": it["n"], "zone_buffer_m": DEFAULT_REQ["radius_m"]})
        print(f"[{k + 1}/{len(todo)}] {it['id']}", flush=True)
        doc = run(it["site"], p, it["id"], progress=lambda i, n: print(f"\r  frame {i}/{n}", end="", flush=True))
        print(f"\n  done in {doc['runtime_s']} s: {doc['metrics'].get('track_availability_pct')}% tracked", flush=True)
        it["metrics"] = doc["metrics"]
        (RUNS / "replays.json").write_text(json.dumps(manifest, indent=1))
    (RUNS / "replays.json").write_text(json.dumps(manifest, indent=1))


if __name__ == "__main__":
    main()
