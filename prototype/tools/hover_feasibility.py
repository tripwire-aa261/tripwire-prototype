"""Preliminary study: can a hovering drone be held by comparing each sensor's echo pattern with a learned
history of the quiet scene (background model), instead of a microphone? Plus basic pole-height effects.

    .venv/bin/python tools/hover_feasibility.py            (~3 min; prints tables, writes web/runs/hover_feasibility.json)

Not part of the twin yet. Uses the twin's own scenes and link budget (twin/rf.py, twin/scene.py).

Method, per tower-sensor pair and per hover point inside the fence (drone 60 m up):
  D  drone echo per resource element (bistatic radar equation, terrain and buildings, twin/rf.py)
  B  static background in the same bistatic range cell and the zero-Doppler cell: ground clutter on a
     20 m grid out to 3 km (sigma0 = -20 dB, the twin's ASSUMPTION) plus buildings as point reflectors
     (the twin's RCS rule). A hovering drone and the static background are both coherent, so listening
     longer raises both equally; only the noise falls behind.
  N  the twin's noise per RE for that pair (thermal, quantisation, direct-signal residue, neighbor cells),
     after array and processing gain
  After subtracting the learned background, what is left of it is B x s, where s = background stability
  (ASSUMPTION, the unknown this study scans: -20 to -60 dB). Beamforming the sensor's antennas toward the
  drone rejects background arriving from other directions on the same ellipse by about the array gain
  (ASSUMPTION: ideal sidelobes).
  Detected on a pair when  D G / (N + B s G / M) >= threshold (Pd 0.9, the twin's false-alarm rate),
  G = REs x slots in the hover dwell (4.8 s), M = array gain. Located when 3+ pairs detect (as the twin).
Outputs: the stability each hover point needs (3rd-best pair), the share of hover points located at each
stability, and with perfect subtraction (noise-limited bound).

Pole height (6, 15, 25 m): coverage of a moving drone (the twin's normal model), the hover result above,
and how well height can be told apart: vertical position error of a hovering drone, and how far apart in
bistatic range a drone 60 m up and a person directly beneath it are (in range cells).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from twin.antenna import zone_samples  # noqa: E402
from twin.config import Params  # noqa: E402
from twin.coverage import HANN_LOSS_DB, ACC_SCALE, albersheim_db, pair_snr_db  # noqa: E402
from twin.explore import BASE, DESIGNS  # noqa: E402
from twin.geo import distance_to_polygon  # noqa: E402
from twin.rf import echo_power_re_dbw, rcs_at  # noqa: E402
from twin.scenarios import site_scene  # noqa: E402
from twin.scene import SLOT_S, antenna_of, face_gains  # noqa: E402

SIGMA0 = 0.01          # ground clutter reflectivity, -20 dB (the twin's ASSUMPTION in scene._clutter)
GRID_M, EXTENT_M = 20.0, 3000.0
HOVER_S = 4.8          # hover dwell (6 normal updates); ASSUMPTION
DRONE_AGL, PERSON_AGL = 60.0, 1.7
STABILITY_DB = [-20, -30, -40, -50, -60]
MASTS = [6.0, 15.0, 25.0]
CASES = [  # recommended setups (v0.4.2) at the interference level each needs
    ("hays", "ring4_enh_mic", 6, 20), ("hancock", "ring4_enh_mic", 6, 40),
    ("fulton", "ring4_enh_mic", 4, 40), ("fulton", "ring8_enh_mic", 12, 30),
]
db = lambda x: 10 * np.log10(np.maximum(x, 1e-300))  # noqa: E731
undb = lambda x: 10 ** (np.asarray(x) / 10)  # noqa: E731


def background(sc):
    """Static clutter points and RCS: dense ground grid + buildings."""
    s = sc.site
    xs = np.arange(-EXTENT_M, EXTENT_M, GRID_M)
    X, Y = (a.ravel() for a in np.meshgrid(xs, xs))
    g = np.stack([X, Y, s.ground(X, Y) + 1.0], axis=1)
    rg = np.full(len(g), SIGMA0 * GRID_M ** 2)
    bp, br = [], []
    for b in s.buildings:
        poly = np.array(b["poly"])
        cx, cy = poly[:-1].mean(axis=0)
        bp.append([cx, cy, float(s.ground(cx, cy)) + b["height_m"] * 0.7])
        br.append(np.clip(0.1 * b.get("area_m2", 100), 5, 300))
    if bp:
        g, rg = np.vstack([g, np.array(bp)]), np.concatenate([rg, np.array(br)])
    return g, rg


def bistatic(ill_pos, rx_pos, pts):
    return np.linalg.norm(pts - ill_pos, axis=1) + np.linalg.norm(pts - rx_pos, axis=1)


def study(site, design, n, interf, mast):
    p = Params.from_dict({**BASE, **DESIGNS[design]["p"], "drone": "m210", "n_listeners": n, "bird": False,
                          "cochannel_suppression_db": interf, "mast_m": mast, "altitude_agl_m": DRONE_AGL})
    sc = site_scene(site, p)
    drone = next(t for t in sc.targets if t.kind == "drone")
    thr = undb(albersheim_db(0.9, p.pfa))
    hp = zone_samples(sc.site, 0.0, DRONE_AGL, 30.0)             # hover points inside the fence
    person = hp.copy(); person[:, 2] = sc.site.ground(hp[:, 0], hp[:, 1]) + PERSON_AGL
    cp, cr = background(sc)
    L = int(round(HOVER_S / SLOT_S))
    smax, sinr40, units, dR, bd = [], [], [], [], []
    for pr in sc.pairs:
        c = pr.ill.carrier
        G = c.n_re * L * undb(-HANN_LOSS_DB)
        M = undb(antenna_of(p, pr.rx).array_gain_db)
        rcs = rcs_at(drone.rcs_m2, drone.size_m, c.freq_hz)
        D, _, _ = echo_power_re_dbw(sc.site, pr.ill, pr.rx.pos, hp, rcs, 0.0, p.ground_gamma, sc.loss_db)
        e = int(np.argmin(pr.noise_re_dbw))
        D = undb(D + face_gains(p, pr.rx, hp)[e])
        Bc, _, _ = echo_power_re_dbw(sc.site, pr.ill, pr.rx.pos, cp, cr, 0.0, p.ground_gamma, sc.loss_db)
        Bc = undb(Bc + face_gains(p, pr.rx, cp)[e])
        rb_c, rb_d = bistatic(pr.ill.pos, pr.rx.pos, cp), bistatic(pr.ill.pos, pr.rx.pos, hp)
        order = np.argsort(rb_c); rs, cs = rb_c[order], np.concatenate([[0.0], np.cumsum(Bc[order])])
        lo, hi = np.searchsorted(rs, rb_d - c.range_bin_m / 2), np.searchsorted(rs, rb_d + c.range_bin_m / 2)
        B = (cs[hi] - cs[lo]) / M                                  # background in the drone's cell, after beamforming
        N = undb(pr.noise_re_dbw[e])
        # Largest stability s (linear) at which this pair still detects: D G / (N + B s G) >= thr.
        with np.errstate(divide="ignore", invalid="ignore"):
            smax.append(np.where(D * G / N >= thr, (D * G / thr - N) / np.maximum(B * G, 1e-300), 0.0))
        sinr40.append(D * G / (N + B * undb(-40) * G))
        bd.append(db(B) - db(D))
        u = (hp - pr.ill.pos) / np.linalg.norm(hp - pr.ill.pos, axis=1)[:, None] + \
            (hp - pr.rx.pos) / np.linalg.norm(hp - pr.rx.pos, axis=1)[:, None]
        units.append(u)
        dR.append(np.abs(rb_d - bistatic(pr.ill.pos, pr.rx.pos, person)) / c.range_bin_m)
    smax, sinr40, units, dR = np.array(smax), np.array(sinr40), np.array(units), np.array(dR)
    third = -np.sort(-smax, axis=0)[2]                              # 3rd-best pair per hover point
    need_db = np.where(third > 0, db(third), -np.inf)              # worst stability still OK; -inf = never (noise)
    located = {s: float(100 * np.mean(third >= undb(s))) for s in STABILITY_DB}
    # Vertical error of a hovering drone (Fisher information over detecting pairs, s = -40 dB, no height prior).
    det = sinr40 >= thr
    bin_m = sc.pairs[0].ill.carrier.range_bin_m
    sig = ACC_SCALE * bin_m / np.sqrt(2 * np.minimum(sinr40, undb(40)))
    J = np.einsum("pn,pni,pnj->nij", np.where(det, 1 / sig ** 2, 0.0), units, units) + np.eye(3) * 1e-9
    ok = det.sum(axis=0) >= 3
    sz = np.sqrt(np.linalg.inv(J)[:, 2, 2])[ok] if ok.any() else np.array([np.nan])
    # Moving-drone coverage in the normal model (fence + 150 m), the twin's rule (3+ pairs).
    zs = zone_samples(sc.site, 150.0, DRONE_AGL, 40.0)
    cnt = np.sum([pair_snr_db(sc, pr, zs) >= albersheim_db(0.9, p.pfa) for pr in sc.pairs], axis=0)
    return {
        "site": site, "design": design, "sensors": n, "interference_db": interf, "mast_m": mast,
        "hover_points": int(len(hp)), "pairs": len(sc.pairs), "range_cell_m": round(float(bin_m), 1),
        "moving_located_pct": round(float(100 * np.mean(cnt >= 3)), 1),
        "hover_noise_limited_pct": round(float(100 * np.mean(third > 0)), 1),
        "hover_located_pct": {str(s): round(v, 1) for s, v in located.items()},
        # Stability at which half / 90 % of hover points are located (more negative = harder).
        "stability_needed_db": {"half": round(float(np.median(need_db)), 1), "p90": round(float(np.percentile(need_db, 10)), 1)},
        "background_over_drone_db_median": round(float(np.median(np.array(bd))), 1),
        "height_sigma_m_median": round(float(np.nanmedian(sz)), 1),
        "drone_vs_person_cells_median": round(float(np.median(dR)), 2),
        "pairs_separating_drone_from_person_pct": round(float(100 * np.mean(dR >= 1.0)), 1),
    }


def main():
    out = []
    for site, design, n, interf in CASES:
        for mast in MASTS:
            r = study(site, design, n, interf, mast)
            out.append(r)
            h = r["hover_located_pct"]
            print(f"{site:8} {design[:6]:7} {n:2} @{interf} dB mast {mast:4.0f} m | moving {r['moving_located_pct']:5.1f}% | "
                  f"hover located: perfect {r['hover_noise_limited_pct']:5.1f}%  " +
                  "  ".join(f"{s}dB {h[str(s)]:5.1f}%" for s in STABILITY_DB) +
                  f" | bg/drone {r['background_over_drone_db_median']} dB | needs {r['stability_needed_db']['half']} dB (90%: {r['stability_needed_db']['p90']}) | "
                  f"height err {r['height_sigma_m_median']} m | drone-person {r['drone_vs_person_cells_median']} cells", flush=True)
    (ROOT / "web" / "runs" / "hover_feasibility.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
