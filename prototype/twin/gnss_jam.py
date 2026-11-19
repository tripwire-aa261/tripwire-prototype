"""GPS jammer locator on the drone sensors (v0.6): detect a jammer and find it by time difference of arrival (TDOA).

Each perimeter sensor also listens on GPS L1 (1575.42 MHz). A jammer raises the noise floor at every sensor; the sensors
cross-correlate what they record and the differences in arrival time place the source (hyperbolic multilateration,
Gauss-Newton least squares; the method of the Baltic TDOA network, GPS Solutions 30:96, 2026).

Inputs and where they come from:
  * jammer: a car "privacy" jammer of 10 dBm (the DTU trial tracked one this weak, NAVIGATION 73(1), 2026) or a
    1 W (30 dBm) jammer, ~2 MHz wide around L1 (ASSUMPTION), 1.5 m above ground on a road;
  * propagation: the twin's terrain path model (free space + Bullington diffraction + ground reflection);
  * receiver: 3 dBi L1 patch, noise figure 2 dB with an LNA (ASSUMPTIONS), 10 ms correlation;
  * timing: the sensors' clocks are disciplined by GPS, which the jammer takes away. Each sensor then holds time on
    its own oscillator: an oven-controlled crystal (OCXO) drifts ~50 ns over a few minutes of jamming, a chip-scale
    atomic clock (CSAC) ~5 ns (ASSUMPTIONS, typical holdover figures). Clock error dominates; it is what we test.
  * TDOA noise per sensor pair: clock error (quadrature of both clocks) + correlation error 1 / (2 pi B_rms sqrt(2 SNR_eff))
    (STANDARD Cramer-Rao form), where SNR_eff = JNR x B x T.
Bearings: the v1.0 platform sensor has a 4-element GPS L1 patch array (twin/platform_bom.py), so each sensor can also
measure the direction the jamming comes from. The DTU trial got 0.5-1 deg precision from a 5-channel array, with up to
10 deg bias before calibration; we use 3 deg for 4 elements (ASSUMPTION, after calibration; v0.6 used 2 deg for the
8-antenna ring). Clock: the platform sensor holds time on an OCXO (the default product); a chip-scale atomic clock
is a premium option (~$5.5k). Mode "tdoa+aoa" fits both together (weighted Gauss-Newton), which fixes the poor geometry when the
jammer sits outside a small ring of sensors.
Detection: a sensor detects the jammer when its jammer-to-noise ratio is above 10 dB (ASSUMPTION; GPS receivers lose
lock around 20-30 dB of J/N, so detection comes well before harm).
"""
from __future__ import annotations

import numpy as np

from .geo import C
from .rf import K_B, T0, path_gain_db

L1_HZ = 1575.42e6
B_HZ = 2.0e6            # jammer bandwidth (ASSUMPTION)
B_RMS_HZ = B_HZ / np.sqrt(12)   # rms bandwidth of a flat spectrum (STANDARD)
T_INT_S = 0.010         # correlation time per fix (ASSUMPTION)
RX_GAIN_DBI = 3.0
NF_DB = 2.0
DETECT_JNR_DB = 10.0
BEARING_SIGMA_DEG = 3.0  # v1.0: 4-element L1 array (v0.6: 2.0)
FAIL_M = 500.0          # a fix worse than this counts as a failure (reported separately)
CLOCKS_NS = {"ocxo": 50.0, "csac": 5.0, "gps": 2.0}   # 1-sigma timing error per sensor while jammed (gps = not yet jammed)


def jnr_db(site, jam_xyz, sensors, power_dbm):
    g, _ = path_gain_db(site, np.atleast_2d(jam_xyz), sensors, L1_HZ, 0.7)
    p = power_dbm - 30 + g + RX_GAIN_DBI
    n = 10 * np.log10(K_B * T0 * B_HZ) + NF_DB
    return p - n


def locate(sensors, toa, guess, sig_r_m=None, bearings=None, sig_b_rad=None, iters=20):
    """Weighted Gauss-Newton on TDOA to sensor 0 (range differences, m) and, if given, bearings (rad, from north).
    2D position at a known height; steps are limited to 500 m so a poor start cannot run away."""
    x = np.array(guess, dtype=float)
    for _ in range(iters):
        dxy = x - sensors[:, :2]
        d = np.maximum(np.linalg.norm(dxy, axis=1), 1.0)
        rows, res, w = [], [], []
        if toa is not None:
            u = dxy / d[:, None]
            rows.append(u[1:] - u[0]); res.append((toa[1:] - toa[0]) * C - (d[1:] - d[0]))
            w.append(np.full(len(d) - 1, 1.0 / (sig_r_m or 1.0)))
        if bearings is not None:
            az = np.arctan2(dxy[:, 0], dxy[:, 1])
            rows.append(np.stack([dxy[:, 1] / d ** 2, -dxy[:, 0] / d ** 2], axis=1))
            res.append((bearings - az + np.pi) % (2 * np.pi) - np.pi)
            w.append(np.full(len(d), 1.0 / sig_b_rad))
        J = np.vstack(rows) * np.concatenate(w)[:, None]
        r = np.concatenate(res) * np.concatenate(w)
        step, *_ = np.linalg.lstsq(J, r, rcond=None)
        n = np.linalg.norm(step)
        if n > 500:
            step *= 500 / n
        x = x + step
        if n < 0.05:
            break
    return x


def trial(site, sensors, jam_xy, power_dbm, clock_ns, rng, n_mc=100, mode="tdoa", bearing_deg=None):
    """Median horizontal error (m) of the fixes that work, the share that fail (> FAIL_M), and how many sensors detect the
    jammer. mode: "tdoa" or "tdoa+aoa"."""
    z = float(site.ground(jam_xy[0], jam_xy[1])) + 1.5
    jam = np.array([jam_xy[0], jam_xy[1], z])
    jnr = jnr_db(site, jam, sensors, power_dbm)
    det = jnr >= DETECT_JNR_DB
    need = 2 if mode == "tdoa+aoa" else 3
    if det.sum() < need:
        return {"detected": int(det.sum()), "error_m": None, "fail_pct": 100.0}
    s = sensors[det]
    true_t = np.linalg.norm(s - jam, axis=1) / C
    snr_eff = 10 ** (jnr[det] / 10) * B_HZ * T_INT_S
    sig_corr = 1.0 / (2 * np.pi * B_RMS_HZ * np.sqrt(2 * snr_eff))
    sig = np.sqrt((clock_ns * 1e-9) ** 2 + sig_corr ** 2)
    errs = []
    centre = s[:, :2].mean(axis=0)
    sig_r = float(np.sqrt(2) * np.median(sig) * C)
    true_b = np.arctan2(jam[0] - s[:, 0], jam[1] - s[:, 1])
    sb = np.radians(BEARING_SIGMA_DEG if bearing_deg is None else bearing_deg)
    for _ in range(n_mc):
        toa = true_t + rng.normal(0, sig)
        if mode == "tdoa+aoa":
            est = locate(s, toa, centre, sig_r, true_b + rng.normal(0, sb, len(s)), sb)
        else:
            est = locate(s, toa, centre, sig_r)
        errs.append(float(np.hypot(*(est - jam[:2]))))
    errs = np.array(errs)
    ok = errs <= FAIL_M
    return {"detected": int(det.sum()), "error_m": (round(float(np.median(errs[ok])), 1) if ok.any() else None),
            "fail_pct": round(100 * float(1 - ok.mean()), 1)}


def jammer_map(site, sensors, power_dbm, clock_ns, half_m=1500.0, step_m=150.0, seed=3, mode="tdoa+aoa", bearing_deg=None):
    """Median locating error for a jammer at each point of a grid around the site."""
    rng = np.random.default_rng(seed)
    xs = np.arange(-half_m, half_m + 1e-6, step_m)
    grid = []
    for y in xs:
        row = []
        for x in xs:
            r = trial(site, sensors, (x, y), power_dbm, clock_ns, rng, n_mc=30, mode=mode, bearing_deg=bearing_deg)
            row.append(r["error_m"])
        grid.append(row)
    return {"x0": float(xs[0]), "step_m": step_m, "n": len(xs), "error_m": grid}
