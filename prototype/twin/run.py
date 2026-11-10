"""Run a scenario end to end and write results for the web viewer.

    .venv/bin/python -m twin.run hays [--set drone=mini --set n_listeners=8 ...] [--id my-run]

Outputs web/runs/<id>.json (geometry, detections, fixes, tracks, metrics, coverage) and
web/runs/<id>.bin (range-Doppler maps, uint8), and updates web/runs/index.json.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import multiprocessing as mp
import os
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

from .channel import synthesize
from .config import ASSUMPTION_TABLE, DRONES, PARAM_SOURCES, Params
from .coverage import coverage_grid
from .locate import Locator, PairMeas, Tracker
from .processing import process
from .scenarios import SCENARIOS, SITE_IDS
from .scene import antenna_of
from .cost import RADIOS, ZONE, facility_economics, node_cost

ROOT = Path(__file__).resolve().parent.parent
RUNS = ROOT / "web" / "runs"
RD_MAX_RANGE = 1800.0
RD_MAX_DOPPLER = 150.0
RD_DB_LO, RD_DB_HI = -3.0, 27.0

_SCENE = None


def _init(scenario: str, pdict: dict):
    global _SCENE
    _SCENE = SCENARIOS[scenario](Params.from_dict(pdict))


def _frame(args):
    fi, t = args
    sc = _SCENE
    p = sc.params
    out_pairs, truth_pairs, rds = [], [], {}
    for pi, pair in enumerate(sc.pairs):
        rng = np.random.default_rng([p.seed, fi, pi])
        Y, truth = synthesize(sc, pair, t, rng)
        rd, dets = process(Y, pair.ill.carrier.re_freqs(0), p.dpc_rank, p.max_range_m, p.pfa)
        out_pairs.append(dets)
        truth_pairs.append(truth)
        rds[pi] = rd
    # Range-Doppler map to show for each listener: its pair with the strongest drone echo.
    crops, chosen = [], []
    for li, lis in enumerate(sc.listeners):
        idx = [pi for pi, pr in enumerate(sc.pairs) if pr.rx is lis]
        best = max(idx, key=lambda pi: next(x["echo_snr_re_db"] for x in truth_pairs[pi] if x["kind"] == "drone"))
        rd = rds[best]
        rm = rd.ranges <= RD_MAX_RANGE
        dm = np.abs(rd.dopplers) <= RD_MAX_DOPPLER
        sub = rd.power[np.ix_(rm, dm)]
        sub = sub[:, : sub.shape[1] // 2 * 2].reshape(sub.shape[0], -1, 2).max(axis=2)  # 2:1 Doppler max-pool
        q = np.clip((10 * np.log10(np.maximum(sub, 1e-6)) - RD_DB_LO) / (RD_DB_HI - RD_DB_LO), 0, 1)
        crops.append((q * 255).astype(np.uint8))
        chosen.append(best)
    rd0 = rds[0]
    axes = {"range": [float(rd0.ranges[0]), float(rd0.ranges[1] - rd0.ranges[0]), int((rd0.ranges <= RD_MAX_RANGE).sum())],
            "doppler": [float(rd0.dopplers[np.abs(rd0.dopplers) <= RD_MAX_DOPPLER][0]),
                        float(2 * (rd0.dopplers[1] - rd0.dopplers[0])), crops[0].shape[1]]}
    return fi, t, out_pairs, truth_pairs, crops, chosen, axes


def run(scenario: str = "hays", params: Params | None = None, run_id: str | None = None, workers: int | None = None,
        progress=None) -> dict:
    p = params or Params()
    t_start = time.time()
    scene = SCENARIOS[scenario](p)
    drone = next(t for t in scene.targets if t.kind == "drone")
    times = np.arange(0, drone.traj.duration, p.frame_dt_s)
    workers = workers or min(4, os.cpu_count() or 1)
    results = [None] * len(times)
    # One BLAS thread per worker: otherwise every process starts one thread per core and they fight.
    # Fresh ("spawn") workers so the setting applies before numpy loads.
    blas_vars = ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS", "VECLIB_MAXIMUM_THREADS")
    saved = {k: os.environ.get(k) for k in blas_vars}
    os.environ.update({k: "1" for k in blas_vars})
    try:
        with ProcessPoolExecutor(max_workers=workers, mp_context=mp.get_context("spawn"),
                                 initializer=_init, initargs=(scenario, p.to_dict())) as ex:
            for k, res in enumerate(ex.map(_frame, list(enumerate(times)), chunksize=2)):
                results[res[0]] = res
                if progress:
                    progress(k + 1, len(times))
    finally:
        for k, v in saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    # --- localisation and tracking (sequential) ---
    site = scene.site
    loc = Locator(site)
    trk = Tracker()
    frames, rd_blobs = [], []
    for fi, t, pairs_dets, truth_pairs, crops, chosen, axes in results:
        meas = [PairMeas(pr.ill.pos, pr.rx.pos, 299792458.0 / pr.ill.carrier.freq_hz,
                         pr.ill.carrier.range_bin_m, pairs_dets[pi], pi) for pi, pr in enumerate(scene.pairs)]
        fixes = loc.locate(meas)
        confirmed = trk.step(fixes, p.frame_dt_s, float(t))
        truth = {x["kind"]: x for x in truth_pairs[0]}
        # Which pairs truly detected the drone (detection within one range cell and 4 Hz of truth).
        hits = []
        for pi, dets in enumerate(pairs_dets):
            d = next(x for x in truth_pairs[pi] if x["kind"] == "drone")
            res = scene.pairs[pi].ill.carrier.range_bin_m
            hits.append(any(abs(z.range_m - d["range"]) < res and abs(z.doppler_hz - d["doppler"]) < 4 for z in dets))
        frames.append({
            "t": round(float(t), 2),
            "truth": {k: {"pos": np.round(v["pos"], 1).tolist(), "vel": np.round(v["vel"], 2).tolist()} for k, v in truth.items()},
            "pair_truth": [[round(next(x["range"] for x in tp if x["kind"] == "drone"), 1),
                            round(next(x["doppler"] for x in tp if x["kind"] == "drone"), 2),
                            round(next(x["echo_snr_re_db"] for x in tp if x["kind"] == "drone") + 10 * np.log10(
                                scene.pairs[pi].ill.carrier.n_re * scene.L) - 3.52, 1)] for pi, tp in enumerate(truth_pairs)],
            "dets": [[[round(z.range_m, 1), round(z.doppler_hz, 2), round(z.snr_db, 1), round(z.microdoppler_db, 1)]
                      for z in dets] for dets in pairs_dets],
            "drone_hits": [int(h) for h in hits],
            "fixes": [{"pos": np.round(f.pos, 1).tolist(), "vel": np.round(f.vel, 2).tolist(), "n_pairs": f.n_pairs,
                       "resid_m": round(f.residual_m, 1)} for f in fixes],
            "tracks": [{"id": tr.id, "pos": np.round(tr.x[:3], 1).tolist(), "vel": np.round(tr.x[3:], 2).tolist(),
                        "label": tr.label} for tr in confirmed],
            "rd_pairs": chosen,
        })
        rd_blobs.extend(crops)
    metrics = score(site, p, [l.pos for l in scene.listeners], frames)
    # Face each pair used most while the drone was in view (fan-mode nodes have several).
    face_use = np.zeros((len(scene.pairs), max(pr.n_faces for pr in scene.pairs)), dtype=int)
    for r in results:
        for pi, tp in enumerate(r[3]):
            face_use[pi, next(x["face"] for x in tp if x["kind"] == "drone")] += 1
    main_face = face_use.argmax(axis=1)
    cov = coverage_grid(scene)
    run_id = run_id or f"{scenario}-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}"
    RUNS.mkdir(parents=True, exist_ok=True)
    blob = np.concatenate([c.ravel() for c in rd_blobs])
    (RUNS / f"{run_id}.bin").write_bytes(blob.tobytes())
    doc = {
        "id": run_id, "scenario": scenario, "created": dt.datetime.now().isoformat(timespec="seconds"),
        "runtime_s": round(time.time() - t_start, 1),
        "params": p.to_dict(), "lumped_loss_db": scene.loss_db,
        "param_sources": PARAM_SOURCES, "assumptions": ASSUMPTION_TABLE,
        "drone_model": DRONES[p.drone].__dict__,
        "site": {"id": SITE_IDS.get(scenario), "key": scenario, "name": site.name},
        "illuminators": [{"id": i.id, "label": i.label, "operator": i.operator, "freq_mhz": i.carrier.freq_hz / 1e6,
                          "pos": np.round(i.pos, 1).tolist(), "azimuth_deg": round(i.azimuth_deg, 1),
                          "range_bin_m": round(i.carrier.range_bin_m, 1)} for i in scene.illuminators],
        "listeners": [{"id": l.id, "pos": np.round(l.pos, 1).tolist(), "antenna": antenna_of(p, l).to_dict()}
                      for l in scene.listeners],
        "pairs": [{"ill": scene.illuminators.index(pr.ill), "rx": scene.listeners.index(pr.rx),
                   "noise": {k: round(v, 1) for k, v in pr.noise_parts[main_face[pi]].items()},
                   "face": int(main_face[pi]), "dnr_db": round(float(pr.dnr_db[main_face[pi]]), 1)}
                  for pi, pr in enumerate(scene.pairs)],
        "rd": {"axes": results[0][6], "db_range": [RD_DB_LO, RD_DB_HI], "per_frame": len(scene.listeners)},
        "frames": frames, "metrics": metrics, "economics": economics(p),
        "coverage": {**{k: v for k, v in cov.items() if k not in ("state", "count", "best_snr_db")},
                     "state": cov["state"].ravel().tolist(), "count": cov["count"].ravel().tolist()},
    }
    (RUNS / f"{run_id}.json").write_text(json.dumps(doc, separators=(",", ":")))
    _update_index(doc)
    return doc


# Runs made before iteration 3 have no antenna fields: they used the isotropic v0.2 model.
DEFAULTS_V02 = {"antenna": "iso", "faces": 1, "pointing": "inward", "processing": "crs_p0", "mic_range_m": 0.0}

SUSTAIN_FRAMES = 3  # a track must hold the drone this many frames in a row to count
NEAR_M = 60.0  # a track within this horizontal distance of the drone is "on" it


def score(site, p: Params, listener_pos, frames) -> dict:
    """Metrics against the memo release gates. Works from saved frames, so runs can be re-scored."""
    listeners = np.asarray(listener_pos, dtype=float)
    in_zone = tracked = located = 0
    errs, first_track_dist = [], None
    streak, streak_start = {}, {}  # track id -> consecutive frames on the drone, distance when it began
    drone_ids, bird_ids, all_ids = set(), set(), set()
    pair_hits = np.zeros(len(frames[0]["drone_hits"]))
    for f in frames:
        d = np.array(f["truth"]["drone"]["pos"])
        bird = np.array(f["truth"]["bird"]["pos"]) if "bird" in f["truth"] else None
        pair_hits += np.array(f["drone_hits"])
        dist = float(np.min(np.linalg.norm(listeners - d, axis=1)))
        on = set()
        for tr in f["tracks"]:
            all_ids.add(tr["id"])
            h = np.linalg.norm(np.array(tr["pos"][:2]) - d[:2])
            if h < NEAR_M:
                on.add(tr["id"])
            if h < 100:
                drone_ids.add(tr["id"])
            elif bird is not None and np.linalg.norm(np.array(tr["pos"][:2]) - bird[:2]) < 100:
                bird_ids.add(tr["id"])
        for tid in list(streak):
            if tid not in on:
                streak.pop(tid)
                streak_start.pop(tid)
        for tid in on:
            if tid not in streak:
                streak[tid], streak_start[tid] = 0, dist
            streak[tid] += 1
            if streak[tid] >= SUSTAIN_FRAMES and first_track_dist is None:
                first_track_dist = streak_start[tid]
        sustained = any(streak[t] >= SUSTAIN_FRAMES for t in on)
        if any(np.linalg.norm(np.array(fx["pos"][:2]) - d[:2]) < NEAR_M for fx in f["fixes"]):
            located += 1
        if bool(site.in_zone(d[0], d[1], p.zone_buffer_m)):
            in_zone += 1
            if sustained:
                tracked += 1
                errs.append(min(np.linalg.norm(np.array(tr["pos"]) - d) for tr in f["tracks"] if tr["id"] in on))
    n = len(frames)
    avail = 100 * tracked / max(in_zone, 1)
    return {
        "frames": n, "frames_in_zone": in_zone,
        "track_availability_pct": round(avail, 1),
        "located_pct_all_frames": round(100 * located / n, 1),
        "first_track_distance_m": None if first_track_dist is None else round(first_track_dist),
        "median_error_m": None if not errs else round(float(np.median(errs)), 1),
        "pair_pd_pct": [round(100 * h / n, 1) for h in pair_hits],
        "false_tracks": len(all_ids - drone_ids - bird_ids),
        "bird_tracks": len(bird_ids),
        "gate_reach_pass": first_track_dist is not None and first_track_dist >= 150,
        "gate_track_pass": avail >= 90,
        "rules": f"tracked = same confirmed track within {NEAR_M:.0f} m of the drone for >= {SUSTAIN_FRAMES} "
                 f"consecutive frames; availability counted while the drone is inside fence + {p.zone_buffer_m:.0f} m",
    }


def economics(p: Params) -> dict:
    """Parts cost per node for each radio option, and facility economics at data-package prices."""
    out = {"zone": ZONE, "radios": {}}
    for r, info in RADIOS.items():
        nc = node_cost(p.rx_elements, p.antenna, r, p.processing, p.mic_range_m > 0)
        out["radios"][r] = {"name": info["name"], "stage": info["stage"], "node": nc,
                            "facility": facility_economics(p.n_listeners, nc["total"])}
    return out


def relocate(d: dict, site) -> dict:
    """Re-run localisation and tracking on a saved run's detections (no signal re-simulation)."""
    from .processing import Detection
    p = Params.from_dict(d["params"])
    loc, trk = Locator(site), Tracker()
    ills, lis = d["illuminators"], d["listeners"]
    for f in d["frames"]:
        meas = []
        for pi, pr in enumerate(d["pairs"]):
            ill = ills[pr["ill"]]
            dets = [Detection(r, nu, snr, md, 0, 0) for r, nu, snr, md in f["dets"][pi]]
            meas.append(PairMeas(np.array(ill["pos"]), np.array(lis[pr["rx"]]["pos"]), 299792458.0 / (ill["freq_mhz"] * 1e6),
                                 ill["range_bin_m"], dets, pi))
        fixes = loc.locate(meas)
        confirmed = trk.step(fixes, p.frame_dt_s, f["t"])
        f["fixes"] = [{"pos": np.round(x.pos, 1).tolist(), "vel": np.round(x.vel, 2).tolist(), "n_pairs": x.n_pairs,
                       "resid_m": round(x.residual_m, 1)} for x in fixes]
        f["tracks"] = [{"id": tr.id, "pos": np.round(tr.x[:3], 1).tolist(), "vel": np.round(tr.x[3:], 2).tolist(),
                        "label": tr.label} for tr in confirmed]
    return d


def rescore_all(relocalise: bool = False):
    """Recompute metrics for every saved run (after a scoring change)."""
    from .geo import Site
    from .scenarios import SITES
    for f in RUNS.glob("*.json"):
        if f.name in ("index.json", "calibration.json"):
            continue
        d = json.loads(f.read_text())
        if "frames" not in d:
            continue
        site = Site(SITES / SITE_IDS.get(d.get("scenario", "hays"), "hays-state-prison"))
        if relocalise:
            d = relocate(d, site)
        pp = Params.from_dict({**DEFAULTS_V02, **d["params"]})
        d["metrics"] = score(site, pp, [l["pos"] for l in d["listeners"]], d["frames"])
        d["economics"] = economics(pp)
        f.write_text(json.dumps(d, separators=(",", ":")))
        print(f"{d['id']}: {json.dumps({k: v for k, v in d['metrics'].items() if k not in ('pair_pd_pct', 'rules')})}")
    _update_index()


def _update_index(doc=None):
    """Rebuild web/runs/index.json from the run files present (newest first)."""
    runs = []
    for f in RUNS.glob("*.json"):
        if f.name in ("index.json", "calibration.json"):
            continue
        try:
            d = json.loads(f.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        if "frames" not in d:
            continue
        p = d["params"]
        runs.append({"id": d["id"], "scenario": d["scenario"], "created": d["created"], "drone": p["drone"],
                     "params": {k: p.get(k, DEFAULTS_V02.get(k)) for k in (
                         "n_listeners", "rx_elements", "rx_gain_dbi", "cit_s", "adc_bits", "altitude_agl_m",
                         "network_load", "max_illuminators", "antenna", "faces", "pointing", "processing",
                         "mic_range_m")},
                     "zone_located_pct": d["coverage"]["zone_located_pct"], "metrics": d["metrics"]})
    runs.sort(key=lambda r: r["created"], reverse=True)
    (RUNS / "index.json").write_text(json.dumps({"runs": runs}, indent=1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scenario", nargs="?", default="hays", choices=sorted(SCENARIOS))
    ap.add_argument("--set", action="append", default=[], help="parameter override, e.g. --set drone=mini")
    ap.add_argument("--id")
    ap.add_argument("--workers", type=int)
    ap.add_argument("--rescore", action="store_true", help="recompute metrics of saved runs and exit")
    ap.add_argument("--relocate", action="store_true", help="re-run localisation + tracking + metrics on saved runs")
    a = ap.parse_args()
    if a.rescore or a.relocate:
        return rescore_all(relocalise=a.relocate)
    overrides = dict(kv.split("=", 1) for kv in a.set)
    p = Params.from_dict(overrides)
    doc = run(a.scenario, p, a.id, a.workers,
              progress=lambda k, n: print(f"\r  frame {k}/{n}", end="", flush=True))
    print(f"\nwrote web/runs/{doc['id']}.json in {doc['runtime_s']} s")
    print(json.dumps(doc["metrics"], indent=1))


if __name__ == "__main__":
    main()
