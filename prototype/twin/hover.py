"""Hover hold by background history (cued change detection), the software alternative to a microphone.

The normal chain removes everything that does not move (direct signal and static clutter) and ignores the
zero-Doppler band, so a hovering drone is lost. Here each tower-sensor pair keeps a learned model of its
quiet scene (the echo strength of every distance bin over hours of history). When a held track stops, the
pairs listen longer at that spot and look for a new, steady echo that the history does not explain.

Per pair, at the drone's distance bin (bistatic range cell) and zero Doppler:
  D  drone echo per resource element (twin/rf.py link budget)
  B  static background in that cell: ground clutter on a grid (sigma0 = -20 dB, the twin's ASSUMPTION)
     plus buildings as point reflectors (the twin's RCS rule), after beamforming toward the drone
     (background from other directions on the same ellipse falls by about the array gain, ASSUMPTION ideal)
  N  the pair's noise per RE (thermal, quantisation, direct-signal residue, neighbor cells)
  s  background stability (Params.background_stability_db, ASSUMPTION): what is left of B after the
     learned history is subtracted. -40 dB = each echo steady to about 1 % in strength (0.6 deg in phase).
  SINR = D G / (N + B s G),  G = REs x slots in the listening time (grows during the hover, up to
  hover_dwell_s). A hovering drone and the static background are both steady, so listening longer raises
  both; only the noise falls behind, which is why stability, not noise, usually decides.
Study of the numbers behind this: tools/hover_feasibility.py.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np

from .coverage import HANN_LOSS_DB
from .rf import echo_power_re_dbw, rcs_at
from .scene import antenna_of, face_gains
from .lte import SLOT_S

SIGMA0 = 0.01  # ground clutter reflectivity, -20 dB (same ASSUMPTION as scene._clutter)
GRID_M, EXTENT_M = 30.0, 3000.0
CACHE = Path(__file__).resolve().parent.parent / "data" / "cache" / "hover"
BIN_M = 1.0  # profile resolution: far finer than a range cell (~33 m)
_MEM: dict = {}
_MEM_MAX = 192  # profiles kept in memory per process (~30 KB each); the rest stay on disk


def _background_points(site):
    key = id(site)
    if key in _MEM:
        return _MEM[key]
    xs = np.arange(-EXTENT_M, EXTENT_M, GRID_M)
    X, Y = (a.ravel() for a in np.meshgrid(xs, xs))
    pts = np.stack([X, Y, site.ground(X, Y) + 1.0], axis=1)
    rcs = np.full(len(pts), SIGMA0 * GRID_M ** 2)
    from .scene import building_reflectors
    bp, br = building_reflectors(site)
    if bp:
        pts, rcs = np.vstack([pts, np.array(bp)]), np.concatenate([rcs, np.array(br)])
    _MEM[key] = (pts, rcs)
    return pts, rcs


def _profile(scene, pair, face):
    """Static background power per RE against bistatic range for one pair and face, as a cumulative table on
    a 1 m grid (start range, cumulative power), so the power in any range cell is a difference of two
    lookups. Cached on disk; a bounded number kept in memory."""
    p, site = scene.params, scene.site
    ant = antenna_of(p, pair.rx)
    sig = json.dumps([site.folder.name, pair.ill.id, pair.ill.carrier.freq_hz,
                      np.round(pair.ill.pos, 1).tolist(), np.round(pair.rx.pos, 1).tolist(), p.antenna, p.rx_elements,
                      p.faces, face, round(float(ant.faces[face]), 2), p.ground_gamma, round(scene.loss_db, 2),
                      GRID_M, EXTENT_M, SIGMA0, BIN_M, "v2"], default=str)
    h = hashlib.sha1(sig.encode()).hexdigest()[:16]
    if h in _MEM:
        return _MEM[h]
    f = CACHE / f"{h}.npz"
    if f.exists():
        z = np.load(f)
        out = (float(z["r0"]), z["c"])
    else:
        pts, rcs = _background_points(site)
        pw, rt, rr = echo_power_re_dbw(site, pair.ill, pair.rx.pos, pts, rcs, 0.0, p.ground_gamma, scene.loss_db)
        pw = 10 ** ((pw + face_gains(p, pair.rx, pts)[face]) / 10)
        rb = np.linalg.norm(pts - pair.ill.pos, axis=1) + np.linalg.norm(pts - pair.rx.pos, axis=1)
        r0 = float(np.floor(rb.min()))
        hist = np.bincount(((rb - r0) / BIN_M).astype(np.int64), weights=pw)
        out = (r0, np.concatenate([[0.0], np.cumsum(hist)]).astype(np.float64))
        CACHE.mkdir(parents=True, exist_ok=True)
        tmp = CACHE / f"{h}.{np.random.randint(1e9)}.tmp.npz"
        np.savez_compressed(tmp, r0=out[0], c=out[1])
        try:
            tmp.replace(f)
        except OSError:  # Windows/OneDrive: another worker wrote or holds the same entry; the cache is optional
            tmp.unlink(missing_ok=True)
    if len(_MEM) >= _MEM_MAX:
        _MEM.pop(next(iter(_MEM)))
    _MEM[h] = out
    return out


def hover_sinr_db(scene, pair, pts, listen_s, drone=None):
    """SINR (dB) of a hovering drone at pts for one pair after subtracting the learned background.
    listen_s: listening time per point (scalar or array)."""
    p, site = scene.params, scene.site
    pts = np.atleast_2d(pts)
    drone = drone or next(t for t in scene.targets if t.kind == "drone")
    c = pair.ill.carrier
    e = int(np.argmin(pair.noise_re_dbw)) if pair.n_faces == 1 else None
    rcs = rcs_at(drone.rcs_m2, drone.size_m, c.freq_hz)
    D0, _, _ = echo_power_re_dbw(site, pair.ill, pair.rx.pos, pts, rcs, 0.0, p.ground_gamma, scene.loss_db)
    g = face_gains(p, pair.rx, pts)  # (E, N)
    faces = [e] if e is not None else list(range(pair.n_faces))
    rb_d = np.linalg.norm(pts - pair.ill.pos, axis=1) + np.linalg.norm(pts - pair.rx.pos, axis=1)
    G = c.n_re * np.maximum(np.asarray(listen_s, dtype=float) / SLOT_S, 1.0) * 10 ** (-HANN_LOSS_DB / 10)
    s = 10 ** (p.background_stability_db / 10)
    M = 10 ** (antenna_of(p, pair.rx).array_gain_db / 10)
    best = np.full(len(pts), -np.inf)
    for f in faces:
        r0, cs = _profile(scene, pair, f)
        idx = lambda r: np.clip(np.round((r - r0) / BIN_M).astype(np.int64), 0, len(cs) - 1)  # noqa: E731
        B = (cs[idx(rb_d + c.range_bin_m / 2)] - cs[idx(rb_d - c.range_bin_m / 2)]) / M
        D = 10 ** ((D0 + g[f]) / 10)
        N = 10 ** (pair.noise_re_dbw[f] / 10)
        best = np.maximum(best, 10 * np.log10(D * G / (N + B * s * G)))
    return best
