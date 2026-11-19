"""Expected-SNR coverage map: where over the site a drone would be detected / located.

Uses the same link budget and noise floor as the signal simulator, but evaluates the expected SNR
after processing analytically instead of simulating noise, so it can sweep a whole grid quickly.
"""
from __future__ import annotations

import numpy as np

from .multiband import all_pairs, is_tv, tv_snr_db
from .rf import echo_power_re_dbw, rcs_at
from .scene import face_gains

HANN_LOSS_DB = 2 * 1.76  # Hann tapers in range and Doppler (processing loss)


def albersheim_db(pd: float, pfa: float, n: int = 1) -> float:
    a = np.log(0.62 / pfa)
    b = np.log(pd / (1 - pd))
    return -5 * np.log10(n) + (6.2 + 4.54 / np.sqrt(n + 0.44)) * np.log10(a + 0.12 * a * b + 1.7 * b)


def pair_snr_db(scene, pair, pts, drone=None):
    """Expected SNR after processing at each point for one pair, on the node's best face. TV pairs (v1.0,
    multiband.py) use the TV link budget in broadcast.py."""
    p, site = scene.params, scene.site
    drone = drone or next(t for t in scene.targets if t.kind == "drone")
    if is_tv(pair):
        return tv_snr_db(scene, pair, pts, drone)
    rcs = rcs_at(drone.rcs_m2, drone.size_m, pair.ill.carrier.freq_hz)
    pw, _, _ = echo_power_re_dbw(site, pair.ill, pair.rx.pos, pts, rcs, 0.0, p.ground_gamma, scene.loss_db)
    g = face_gains(p, pair.rx, pts)  # (E, N)
    snr_faces = pw[None, :] + g - pair.noise_re_dbw[:, None]
    return snr_faces.max(axis=0) + 10 * np.log10(pair.ill.carrier.n_re) + 10 * np.log10(scene.L) - HANN_LOSS_DB


# FIT: scales the ideal range accuracy to what the full chain achieves (range cells, interpolation,
# tracker). 4.5 = median ratio of full-simulation track error to this model over 5 demo runs
# (spread 1.8x-9x; the worst was a run where tracks strayed to the bird): treat accuracy as rough.
ACC_SCALE = 4.5
HEIGHT_PRIOR_M = 30.0  # the locator searches heights 30-120 m: a loose height prior (ASSUMPTION)


def position_error_m(scene, pts, snrs, thr, scale=None):
    """Expected horizontal position error (1-sigma, m) at each point from the pairs that detect it.

    Each detecting pair measures the bistatic range Rt + Rr with error ~ range cell / sqrt(2 SNR) (the
    standard radar range-accuracy form). Combined over pairs through the geometry (Fisher information of
    the range gradients), plus a loose height prior. NaN where fewer than 3 pairs detect."""
    k = ACC_SCALE if scale is None else scale
    n = len(pts)
    J = np.zeros((n, 3, 3))
    cnt = np.zeros(n, dtype=int)
    tv = np.zeros(n, dtype=bool)
    for pair, snr in zip(all_pairs(scene), snrs):
        det = snr >= thr
        if not det.any():
            continue
        if is_tv(pair):
            tv |= det
        ut = pts - pair.ill.pos
        ur = pts - pair.rx.pos
        u = ut / np.linalg.norm(ut, axis=1, keepdims=True) + ur / np.linalg.norm(ur, axis=1, keepdims=True)
        sigma = k * pair.ill.carrier.range_bin_m / np.sqrt(2 * 10 ** (np.minimum(snr, 40) / 10))
        w = np.where(det, 1.0 / sigma ** 2, 0.0)
        J += w[:, None, None] * u[:, :, None] * u[:, None, :]
        cnt += det
    J[:, 2, 2] += 1.0 / HEIGHT_PRIOR_M ** 2
    J += np.eye(3)[None] * 1e-9
    inv = np.linalg.inv(J)
    var = np.maximum(inv[:, 0, 0] + inv[:, 1, 1], 0)
    if tv.any():  # broadcast.ERROR_FLOOR_M where a TV pair contributes (same rule as the v0.6 TV estimate)
        from .broadcast import ERROR_FLOOR_M
        var = var + np.where(tv, ERROR_FLOOR_M ** 2, 0.0)
    err = np.sqrt(var)
    return np.where(cnt >= 3, err, np.nan)


def acoustic_count(scene, pts):
    """How many nodes' microphones hear a drone at each point (0 when microphones are off)."""
    r = scene.params.mic_range_m
    if r <= 0:
        return np.zeros(len(pts), dtype=int)
    lis = np.array([l.pos for l in scene.listeners])
    d = np.linalg.norm(pts[:, None, :] - lis[None, :, :], axis=2)
    return (d <= r).sum(axis=1)


def coverage_grid(scene, half_m=1500.0, step_m=50.0, pd=0.9, min_pairs=3):
    """State per grid point: 0 not seen, 1 detected (1+ pair), 2 located (3+ pairs, or heard by 2+
    microphones when fitted). Zone percentages are over fence + buffer."""
    p, site = scene.params, scene.site
    xs = np.arange(-half_m, half_m + 1e-6, step_m)
    X, Y = np.meshgrid(xs, xs)
    Z = site.ground(X, Y) + p.altitude_agl_m
    pts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], axis=1)
    thr = albersheim_db(pd, p.pfa)
    count = np.zeros(len(pts), dtype=int)
    best = np.full(len(pts), -99.0)
    for pair in all_pairs(scene):
        snr = pair_snr_db(scene, pair, pts)
        count += snr >= thr
        best = np.maximum(best, snr)
    mic = acoustic_count(scene, pts)
    located = (count >= min_pairs) | (mic >= 2)
    state = np.where(located, 2, np.where((count >= 1) | (mic >= 1), 1, 0)).reshape(X.shape)
    zone = site.in_zone(X, Y, p.zone_buffer_m)
    return {
        "x0": float(xs[0]), "y0": float(xs[0]), "step_m": step_m, "n": len(xs),
        "state": state.astype(np.uint8), "count": count.reshape(X.shape).astype(np.uint8),
        "best_snr_db": best.reshape(X.shape), "threshold_db": float(thr),
        "zone_located_pct": float(100 * np.mean(state[zone] == 2)),
        "zone_radar_located_pct": float(100 * np.mean((count.reshape(X.shape) >= min_pairs)[zone])),
        "zone_detected_pct": float(100 * np.mean(state[zone] >= 1)),
    }
