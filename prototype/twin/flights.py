"""Scored flights (fast estimate): many random contraband flights scored with the link budget instead of
the full signal simulation, so a design can be judged on track availability, the Series A metric.

Per frame and tower-node pair, the drone is detected with a probability set by its expected SNR
(Albersheim's equation inverted, non-fluctuating target), and never inside the zero-Doppler notch (a
hovering drone is cancelled with the direct signal). Detections are drawn at random (several draws per
flight). A frame is "located" with 3+ detecting pairs from 2+ nodes, or when microphones on 2+ nodes hear
it. Tracks follow the full simulation's tracker rules: confirmed after 2 located frames out of 3, kept
through up to 2 missed frames, and counted as "tracked" once held 3 frames in a row. Microphone hold
(ASSUMPTION): a track also survives a missed frame while at least one node's microphone hears the drone.
Track availability = tracked frames / frames inside fence + buffer.

This is an estimate (no false alarms, no position errors): the full simulation is the check on it.
"""
from __future__ import annotations

import numpy as np

from .config import Params
from .coverage import acoustic_count, albersheim_db, pair_snr_db
from .geo import distance_to_polygon
from .rf import bistatic_doppler
from .scene import Trajectory

NOTCH_HZ = 6.0  # CFAR zero-Doppler mask (processing.cfar_detect)
SUSTAIN = 3  # frames a track must be held to count (run.score)
MAX_MISSES = 2  # tracker deletes a track at the 3rd consecutive miss (locate.Tracker)
DRAWS = 16
# FIT: losses of the full chain that the link budget leaves out (CFAR loss, targets between range-Doppler
# cells, the locator's consistency checks). 5 dB minimises the error against 7 full-simulation runs of the
# demo flight (RMS 6 points of track availability, worst 10). All 7 share one flight path: a limited check.
CHAIN_LOSS_DB = 5.0


def pd_from_snr(snr_db, pfa):
    """Albersheim's equation (single pulse) solved for Pd. Within about 0.2 dB for 0.1 < Pd < 0.9."""
    a = np.log(0.62 / pfa)
    z = np.asarray(snr_db) / (6.2 + 4.54 / np.sqrt(1.44))
    b = (10 ** z - a) / (1.7 + 0.12 * a)
    return 1.0 / (1.0 + np.exp(-np.clip(b, -50, 50)))


def random_flights(site, p: Params, n: int, seed: int = 1, agl: float | None = None) -> list[Trajectory]:
    """In from a random direction ~1.1 km out, hover over a random drop point inside the fence, out in
    another random direction (ASSUMPTIONS: heights 30-90 m unless agl is given, speeds 8-15 m/s,
    hover 0-2x hover_s)."""
    rng = np.random.default_rng(seed)
    fence = np.asarray(site.fence)
    lo, hi = fence.min(axis=0), fence.max(axis=0)
    out = []
    while len(out) < n:
        drop = lo + rng.random(2) * (hi - lo)
        if not bool(site.in_zone(drop[0], drop[1], 0.0)):
            continue
        a_in, a_out = rng.random() * 2 * np.pi, rng.random() * 2 * np.pi
        start = drop + 1100 * np.array([np.sin(a_in), np.cos(a_in)])
        end = drop + 1000 * np.array([np.sin(a_out), np.cos(a_out)])
        h = float(rng.uniform(30, 90)) if agl is None else float(agl)
        out.append(Trajectory(np.array([start, drop, end]), float(rng.uniform(8, 15)), h,
                              hover_at=1, hover_s=float(rng.uniform(0, 2) * p.hover_s)))
    return out


def score_flight(scene, traj: Trajectory, dt: float | None = None, draws: int = DRAWS, seed: int = 0,
                 extra_loss_db: float | None = None, radii=None) -> dict:
    p, site = scene.params, scene.site
    dt = dt or p.frame_dt_s
    drone = next(t for t in scene.targets if t.kind == "drone")
    ts = np.arange(0, traj.duration, dt)
    st = [traj.state(site, t) for t in ts]
    pos = np.array([s[0] for s in st])
    vel = np.array([s[1] for s in st])
    lis_index = {id(l): k for k, l in enumerate(scene.listeners)}
    pd, node_of = [], []
    for pair in scene.pairs:
        snr = pair_snr_db(scene, pair, pos, drone) - (CHAIN_LOSS_DB if extra_loss_db is None else extra_loss_db)
        nu = bistatic_doppler(pair.ill.pos, pair.rx.pos, pos, vel, pair.ill.carrier.freq_hz)
        pd.append(np.where(np.abs(nu) > NOTCH_HZ, pd_from_snr(snr, p.pfa), 0.0))
        node_of.append(lis_index[id(pair.rx)])
    pd, node_of = np.array(pd), np.array(node_of)  # (P, T)
    rng = np.random.default_rng(seed)
    hits = rng.random((draws,) + pd.shape) < pd[None]  # (S, P, T)
    n_pairs = hits.sum(axis=1)
    nodes = np.zeros((draws, len(scene.listeners), len(ts)), dtype=bool)
    for k in range(len(scene.listeners)):
        nodes[:, k] = hits[:, node_of == k].any(axis=1)
    mic = acoustic_count(scene, pos)
    located = ((n_pairs >= 3) & (nodes.sum(axis=1) >= 2)) | (mic >= 2)[None]  # (S, T)
    # Tracker emulation, vectorised over draws.
    alive = np.zeros(draws, dtype=bool)
    held = np.zeros(draws, dtype=int)
    misses = np.zeros(draws, dtype=int)
    tracked = np.zeros((draws, len(ts)), dtype=bool)
    for k in range(len(ts)):
        recent = located[:, max(k - 2, 0):k + 1].sum(axis=1)
        start = ~alive & located[:, k] & (recent >= 2)
        alive |= start
        held = np.where(start, 1, held)
        miss = alive & ~located[:, k] & ~(mic[k] >= 1)
        misses = np.where(miss, misses + 1, np.where(alive, 0, misses))
        dead = alive & (misses > MAX_MISSES)
        alive &= ~dead
        held = np.where(alive & ~start, held + 1, np.where(alive, held, 0))
        misses = np.where(alive, misses, 0)
        tracked[:, k] = alive & (held >= SUSTAIN)
    zone = np.asarray(site.in_zone(pos[:, 0], pos[:, 1], p.zone_buffer_m))
    hover = np.linalg.norm(vel[:, :2], axis=1) < 0.1
    lpos = np.array([l.pos for l in scene.listeners])
    dist = np.min(np.linalg.norm(pos[:, None, :2] - lpos[None, :, :2], axis=2), axis=1)
    firsts = []
    for srow in tracked:
        idx = np.nonzero(srow)[0]
        firsts.append(float(dist[max(idx[0] - SUSTAIN + 1, 0)]) if len(idx) else np.nan)
    avail = 100 * tracked[:, zone].mean() if zone.any() else float("nan")
    by_r = {}
    for r in radii or []:
        zr = np.asarray(site.in_zone(pos[:, 0], pos[:, 1], r))
        by_r[r] = float(100 * tracked[:, zr].mean()) if zr.any() else float("nan")
    # Warning distance: how far outside the fence the drone was when first tracked (median over draws).
    fence_d = np.asarray(distance_to_polygon(pos[:, 0], pos[:, 1], site.fence)) if hasattr(site, "fence") else np.zeros(len(ts))
    warn = []
    for srow in tracked:
        idx = np.nonzero(srow)[0]
        warn.append(float(fence_d[max(idx[0] - SUSTAIN + 1, 0)]) if len(idx) else np.nan)
    return {"availability_pct": float(avail), "by_radius": by_r,
            "warning_m": None if np.all(np.isnan(warn)) else float(np.nanmedian(warn)),
            "first_track_m": None if np.all(np.isnan(firsts)) else float(np.nanmedian(firsts)),
            "frames_in_zone": int(zone.sum()),
            "hover_share_pct": float(100 * hover[zone].mean()) if zone.any() else 0.0}


def scored_flights(scene, n: int = 40, seed: int = 1, agl: float | None = None, radii=None) -> dict:
    res = [score_flight(scene, tr, seed=k, radii=radii)
           for k, tr in enumerate(random_flights(scene.site, scene.params, n, seed, agl))]
    av = np.array([r["availability_pct"] for r in res if np.isfinite(r["availability_pct"])])
    ft = [r["first_track_m"] for r in res]
    reach = np.array([f is not None and f >= 150 for f in ft])
    return {"n": len(res), "mean_pct": round(float(av.mean()), 1), "p10_pct": round(float(np.percentile(av, 10)), 1),
            "median_pct": round(float(np.median(av)), 1),
            "hover_share_pct": round(float(np.mean([r["hover_share_pct"] for r in res])), 1),
            "share_flights_90_pct": round(float(100 * np.mean(av >= 90)), 1),
            "share_reach_150m_pct": round(float(100 * reach.mean()), 1),
            "by_radius": {r: round(float(np.nanmean([x["by_radius"][r] for x in res])), 1) for r in (radii or [])},
            "warning_m": (None if all(x["warning_m"] is None for x in res) else
                          round(float(np.nanmedian([np.nan if x["warning_m"] is None else x["warning_m"] for x in res])), 0))}
