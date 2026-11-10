"""Calibrate the twin against the Fraunhofer LTE450 field trials, then check it on a second trial.

    .venv/bin/python -m twin.calibrate

Calibration (Demissie & Steffes 2025, section 4, Fig. 11): a Matrice 210 flies away from a single
surveillance channel near an LTE450 base station. The paper plots the maximum power in the cell under
test against bistatic range, estimates thresholds for Pfa = 1e-2, 1e-3, 1e-4 from reference cells,
fits a line through the peaks of the multipath oscillation, and reads off a maximum range of about
1600 m at Pfa = 1e-4. We run the same measurement on simulated signals and choose the one unknown,
the lumped loss, so our fitted line crosses the 1e-4 threshold at 1600 m.

Check (Table 1): two eNodeBs ~10 km away, 4-element array, drone at 30 m in 10 m/s loops; detection
probability 75-96 % at Pfa = 0.008 with detections gated around the GPS truth. We run that scenario
with the calibrated loss and compare. This second trial was not used to fit anything.
"""
from __future__ import annotations

import datetime as dt
import json
from dataclasses import replace

import numpy as np

from .channel import synthesize
from .config import CAL_PATH
from .processing import dpc_svd, range_doppler
from .scenarios import fraunhofer_cal_scene, fraunhofer_params, fraunhofer_val_scene

TARGET_RANGE_M = 1600.0  # CITED: Fig. 11, Pfa = 1e-4
PAPER_PD = {"flight 1, BS1": 79.7, "flight 1, BS2": 81.1, "flight 2, BS1": 96.4, "flight 2, BS2": 75.0}  # CITED: Table 1


def _cut_and_reference(scene, t, rng):
    pair = scene.pairs[0]
    Y, truth = synthesize(scene, pair, t, rng)
    rd = range_doppler(dpc_svd(Y, scene.params.dpc_rank), pair.ill.carrier.re_freqs(0), scene.params.max_range_m)
    d = truth[0]
    ri = int(np.argmin(np.abs(rd.ranges - d["range"])))
    di = int(np.argmin(np.abs(rd.dopplers - d["doppler"])))
    cut = rd.power[max(ri - 2, 0):ri + 3, max(di - 2, 0):di + 3]
    ref = rd.power[:, (rd.dopplers > 100) & (rd.dopplers < 400)]  # no target, no zero-Doppler residue
    return d["range"], float(cut.max()), ref.ravel()


def figure11(p, n_frames=100, seed=11):
    scene = fraunhofer_cal_scene(p)
    traj = scene.targets[0].traj
    rng = np.random.default_rng(seed)
    ts = np.linspace(5, traj.duration - 1, n_frames)
    rs, cut, refs = [], [], []
    for t in ts:
        r, c, ref = _cut_and_reference(scene, t, rng)
        rs.append(r)
        cut.append(c)
        refs.append(ref[rng.choice(len(ref), 4000, replace=False)])
    refs = np.concatenate(refs)
    rs, cut_db = np.array(rs), 10 * np.log10(np.array(cut))
    thr = {f"{pfa:g}": float(10 * np.log10(np.quantile(refs, 1 - pfa))) for pfa in (1e-2, 1e-3, 1e-4)}
    # Peaks of the multipath oscillation, then a straight line in log-log (as in the paper).
    sel = (rs > 250) & (rs < 3200)
    peaks = [i for i in np.nonzero(sel)[0]
             if cut_db[i] == cut_db[max(i - 4, 0):i + 5].max()]
    A = np.vstack([np.ones(len(peaks)), np.log10(rs[peaks])]).T
    coef, *_ = np.linalg.lstsq(A, cut_db[peaks], rcond=None)
    r_max = 10 ** ((thr["0.0001"] - coef[0]) / coef[1])
    return {"bistatic_range_m": np.round(rs, 1).tolist(), "cut_db": np.round(cut_db, 2).tolist(),
            "thresholds_db": thr, "fit": {"intercept_db": float(coef[0]), "slope_db_per_decade": float(coef[1])},
            "peaks": [int(i) for i in peaks], "max_range_m": float(r_max), "n_reference_cells": int(len(refs))}


def validation(loss_db, dpi_db, loops=2, frame_dt=1.0, seed=21):
    p = fraunhofer_params(lumped_loss_db=loss_db, dpi_residual_db=dpi_db, rx_gain_dbi=10.0)  # ASSUMPTION: Yagis ~10 dBi
    scene, p = fraunhofer_val_scene(p)
    traj = scene.targets[0].traj
    rng = np.random.default_rng(seed)
    out = {}
    for pi, pair in enumerate(scene.pairs):
        cuts, refs, rerr = [], [], []
        for t in np.arange(0, loops * traj.duration, frame_dt):
            Y, truth = synthesize(scene, pair, t, rng)
            rd = range_doppler(dpc_svd(Y, p.dpc_rank), pair.ill.carrier.re_freqs(0), p.max_range_m)
            d = truth[0]
            ri = int(np.argmin(np.abs(rd.ranges - d["range"])))
            di = int(np.argmin(np.abs(rd.dopplers - d["doppler"])))
            win = rd.power[max(ri - 2, 0):ri + 3, max(di - 3, 0):di + 4]
            cuts.append(win.max())
            k = np.unravel_index(win.argmax(), win.shape)
            rerr.append(rd.ranges[max(ri - 2, 0) + k[0]] - d["range"])
            ref = rd.power[:, (rd.dopplers > 100) & (rd.dopplers < 400)].ravel()
            refs.append(ref[rng.choice(len(ref), 2000, replace=False)])
        thr = np.quantile(np.concatenate(refs), 1 - 0.008)  # CITED: Pfa = 0.008 in Table 1
        det = np.array(cuts) > thr
        e = np.array(rerr)[det]
        out[pair.ill.label] = {"pd_pct": round(100 * float(det.mean()), 1),
                               "range_error_m": [round(float(e.mean()), 1), round(float(e.std()), 1)] if len(e) else None,
                               "frames": int(len(det))}
    return out


def solve_loss(base, target=TARGET_RANGE_M, tol_m=25.0, iters=8, verbose=True):
    """Secant search on the lumped loss so the simulated Fig. 11 max range equals the paper's."""
    f0 = figure11(replace(base, lumped_loss_db=0.0))
    fit_at_target = f0["fit"]["intercept_db"] + f0["fit"]["slope_db_per_decade"] * np.log10(target)
    xs = [float(fit_at_target - f0["thresholds_db"]["0.0001"])]
    fs = [figure11(replace(base, lumped_loss_db=xs[0]))]
    xs.append(xs[0] + 30 * np.log10(fs[0]["max_range_m"] / target))
    fs.append(figure11(replace(base, lumped_loss_db=xs[1])))
    for _ in range(iters):
        g = [np.log10(f["max_range_m"] / target) for f in fs[-2:]]
        if abs(fs[-1]["max_range_m"] - target) < tol_m or g[1] == g[0]:
            break
        x = xs[-1] - g[1] * (xs[-1] - xs[-2]) / (g[1] - g[0])
        xs.append(float(np.clip(x, xs[-1] - 10, xs[-1] + 10)))
        fs.append(figure11(replace(base, lumped_loss_db=xs[-1])))
    if verbose:
        print(f"    loss {xs[-1]:.2f} dB -> max range {fs[-1]['max_range_m']:.0f} m after {len(xs)} tries")
    return xs[-1], f0, fs[-1]


TARGET_PD = float(np.mean(list(PAPER_PD.values())))  # ~83 %


def main():
    print("Two-parameter calibration against both Fraunhofer trials.")
    print("For each cancellation depth: fit the lumped loss to Fig. 11, then predict Table 1 Pd.")
    rows = []
    for dpi in (50.0, 60.0, 70.0, 80.0, 90.0):
        base = fraunhofer_params(dpi_residual_db=dpi)
        loss, f0, f1 = solve_loss(base, verbose=False)
        v = validation(loss, dpi, loops=1)
        pd = float(np.mean([x["pd_pct"] for x in v.values()]))
        rows.append((dpi, loss, pd, f1["max_range_m"]))
        print(f"  depth {dpi:4.0f} dB -> loss {loss:5.1f} dB (Fig.11 range {f1['max_range_m']:.0f} m) -> Table 1 Pd {pd:5.1f} %")
    d = np.array(rows)
    # Interpolate the depth at which predicted Pd equals the paper's average (Pd rises with depth).
    order = np.argsort(d[:, 2])
    if d[:, 2].min() <= TARGET_PD <= d[:, 2].max():
        dpi = float(np.interp(TARGET_PD, d[order, 2], d[order, 0]))
        status = "matched"
    else:
        dpi = float(d[np.argmin(np.abs(d[:, 2] - TARGET_PD)), 0])
        status = (f"paper average {TARGET_PD:.0f} % not reachable: predicted Pd is {d[:, 2].min():.0f}-{d[:, 2].max():.0f} % "
                  f"for every depth from 50 to 90 dB, inside the paper's per-flight range (75-96 %) but at its "
                  f"optimistic end. The depth is weakly constrained; using the value closest to the average.")
    print(f"  chosen cancellation depth {dpi:.1f} dB ({status})")
    base = fraunhofer_params(dpi_residual_db=dpi)
    loss, f0, f1 = solve_loss(base)
    val = validation(loss, dpi)
    for k, v in val.items():
        print(f"  check {k}: Pd {v['pd_pct']} %  range error {v['range_error_m']} m")
    doc = {
        "lumped_loss_db": round(loss, 2),
        "dpi_residual_db": round(dpi, 1),
        "sweep": [{"dpi_residual_db": r[0], "lumped_loss_db": round(r[1], 2), "table1_pd_pct": round(r[2], 1),
                   "fig11_range_m": round(r[3])} for r in rows],
        "fit_status": status,
        "date": dt.date.today().isoformat(),
        "method": "Two unknowns fitted to two published results. (1) Lumped echo loss: the simulated Fig. 11 "
                  "measurement (max power in the cell under test vs bistatic range, linear fit through multipath "
                  "peaks) must cross the Pfa=1e-4 threshold at 1600 m. (2) Cancellation depth: the Table 1 scenario "
                  "must give the paper's average Pd (~83 % at Pfa 0.008). The loss absorbs unknown EIRP, RCS, "
                  "antenna and processing losses; the depth sets how much direct signal survives cancellation. "
                  "Both trials are used for fitting, so this is not an independent validation.",
        "source": "B. Demissie, C. Steffes, 'Drone Detection With a LTE450-Based Passive Radar', IET Radar, Sonar & "
                  "Navigation 19:e70092 (2025), doi:10.1049/rsn2.70092",
        "assumptions": ["Receiver 150 m from the eNodeB, tower 30 m, receiver 10 m, drone at 50 m flying radially",
                        "EIRP 61 dBm, receive antenna 7 dBi, NF 6 dB (absorbed by the fit)",
                        "Matrice 210 RCS 0.10 m^2 (absorbed by the fit; only RCS ratios matter downstream)",
                        "Table 1 scenario: base-station bearings 200/215 deg, loop radius 250 m centred 700 m away, "
                        "Yagi elements 10 dBi, idle LTE450 network (no co-channel data)"],
        "figure11_zero_loss": f0, "figure11_calibrated": f1,
        "validation": {"simulated": val, "paper_table1_pd_pct": PAPER_PD,
                       "paper_range_error_m": "0.9-10.4 mean, 8.8-15.7 std",
                       "note": "Table 1 was used to fit the cancellation depth, so agreement here is by construction."},
    }
    CAL_PATH.write_text(json.dumps(doc, indent=1))
    web_copy = CAL_PATH.parent.parent / "web" / "runs" / "calibration.json"
    web_copy.parent.mkdir(parents=True, exist_ok=True)
    web_copy.write_text(json.dumps(doc))
    print(f"wrote {CAL_PATH} (and a copy for the viewer)")


if __name__ == "__main__":
    main()
