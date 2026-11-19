"""Broadcast signals as a second illuminator (v0.6): US digital TV (ATSC, 6 MHz) and FM radio (200 kHz).

Same physics as the LTE model, at link-budget level (an analytic coverage estimate, like coverage.py; no full signal
replay yet):
  echo   P_e = EIRP + g(tx->drone) + 10 log10(4 pi sigma / lambda^2) + g(drone->rx) + G_rx - L_lumped      (Willis)
  noise  thermal (k T0 F B) + ADC quantisation of the direct signal (6.02 b + 1.76 - backoff below it)
         + direct-path cancellation residue (dpi_residual_db below it, calibrated on the LTE trial)
  SNR after processing = P_e - noise + 10 log10(B * CIT) - Hann taper loss; detection by Albersheim (Pd 0.9).
What differs from LTE:
  * far fewer co-channel neighbours: US TV channels are allotted so that stations sharing a channel are far apart, so
    the dense same-frequency neighbours that limit cell signals do not arise. Weaker distant co-channel stations do
    exist (Barott & Himed, IEEE Radar Conf 2015), and ATSC 3.0 single-frequency networks add some on purpose; both
    are covered here only through the residual floor below (ASSUMPTION, to measure at Seed);
  * residual floor: measured ATSC passive radar cancels the direct signal and clutter by 30-45 dB in practice, leaving
    a floor 6-20 dB above thermal noise (Garry, Baker & Smith, IEEE TGRS 55(7), 2017). We hold the floor at least
    20 dB above thermal (the pessimistic end);
  * the whole channel is the reference, rebuilt by demodulating the signal, as in the published DVB-T trials
    (ATSC 1.0 is single-carrier 8VSB; reconstruction quality equal to DVB-T is an ASSUMPTION);
  * range resolution c/B: 50 m for TV, 1.5 km for FM (FM can warn but cannot place a drone to 25 m);
  * small drones are weak at FM wavelengths (3 m): Rayleigh roll-off in rcs_at().
SIMPLIFICATIONS (stated in the output): transmitters radiate their licensed ERP toward the site (no vertical pattern);
receive gain 8 dBi toward the drone (UHF/VHF-high panel) or 2 dBi (FM dipole), 0 dBi toward the transmitter;
terrain beyond the site's terrain tile is taken flat at the tile edge.
"""
from __future__ import annotations

import json
from dataclasses import dataclass

import numpy as np

from .config import DRONES, Params
from .coverage import ACC_SCALE, HANN_LOSS_DB, HEIGHT_PRIOR_M, albersheim_db
from .geo import C
from .rf import FOUR_PI, K_B, T0, adc_sqnr_db, db, path_gain_db, rcs_at, undb


@dataclass
class Broadcast:
    call: str
    kind: str  # tv | fm
    freq_hz: float
    bw_hz: float
    eirp_dbw: float
    pos: np.ndarray
    distance_km: float

    @property
    def range_bin_m(self) -> float:
        return C / self.bw_hz


def load_broadcast(site, max_km=(80.0, 60.0)) -> list[Broadcast]:
    path = site.folder / "broadcast.json"
    if not path.exists():
        return []
    out = []
    for t in json.loads(path.read_text())["transmitters"]:
        lim = max_km[0] if t["kind"] == "tv" else max_km[1]
        if t["distance_km"] > lim or t["erp_kw"] <= 0:
            continue
        eirp = 10 * np.log10(t["erp_kw"] * 1e3) + 2.15  # ERP is referenced to a dipole: EIRP = ERP + 2.15 dB (STANDARD)
        z = t["rcamsl_m"] or (float(site.ground(t["x"], t["y"])) + 150.0)
        out.append(Broadcast(t["call"], t["kind"], t["freq_hz"], t["bw_hz"], eirp, np.array([t["x"], t["y"], z]), t["distance_km"]))
    return out


RESIDUAL_OVER_THERMAL_DB = 20.0  # measured ATSC residual floor 6-20 dB above thermal (Garry et al. 2017); pessimistic end
RX_GAIN = {"tv": 8.0, "fm": 2.0}  # ASSUMPTION: panel toward the drone (UHF/VHF high), dipole for FM


def pair_snr(site, p: Params, tx: Broadcast, rx_pos, pts, drone, extra_loss_db: float | None = None) -> np.ndarray:
    extra_loss_db = TV_EXTRA_LOSS_DB if extra_loss_db is None else extra_loss_db
    lam = C / tx.freq_hz
    rcs = rcs_at(drone.rcs_m2, drone.size_m, tx.freq_hz)
    g_t, _ = path_gain_db(site, tx.pos[None, :], pts, tx.freq_hz, p.ground_gamma)
    g_r, _ = path_gain_db(site, np.atleast_2d(rx_pos), pts, tx.freq_hz, p.ground_gamma)
    pe = tx.eirp_dbw + g_t + 10 * np.log10(FOUR_PI * rcs / lam ** 2) + g_r + RX_GAIN[tx.kind] - p.resolved_loss_db()
    gd, _ = path_gain_db(site, tx.pos[None, :], np.atleast_2d(rx_pos), tx.freq_hz, p.ground_gamma)
    direct = tx.eirp_dbw + float(gd[0])  # 0 dBi toward the transmitter
    thermal = 10 * np.log10(K_B * T0 * tx.bw_hz) + p.nf_db
    n = db(undb(thermal) + undb(direct - adc_sqnr_db(p.adc_bits, p.adc_backoff_db)) + undb(direct - p.resolved_dpi_db()))
    n = np.maximum(n, thermal + RESIDUAL_OVER_THERMAL_DB)
    return pe - n + 10 * np.log10(tx.bw_hz * p.cit_s) - HANN_LOSS_DB - extra_loss_db


# Check against a published DVB-T drone trial (calibrate_tv): Martelli et al. 2020 (Sapienza / Leonardo AULOS), 570 MHz,
# 50 kW, transmitter 22.5 km from the receiver; DJI Phantom 4 Pro and Mavic Pro detected from 1.6 up to 5 km bistatic range.
# With the loss calibrated on the LTE trial, this model detects a Mavic-class drone there only to ~0.5 km bistatic range,
# about 27 dB short of the trial. We keep the LTE calibration (no extra gain), so the TV results are CONSERVATIVE.
TV_EXTRA_LOSS_DB = 0.0
ERROR_FLOOR_M = 5.0  # ASSUMPTION: timing, multipath and geometry errors the analytic estimate leaves out (added in quadrature)


def calibrate_tv(p: Params | None = None, rb_max_m: float = 5000.0) -> dict:
    """Extra loss (dB) that puts the detection limit of a Mavic-class drone at rb_max_m bistatic range in the
    Martelli 2020 geometry (flat ground; transmitter 300 m above ground, 22.5 km away; receiver 10 m; drone 100 m;
    drone on a line at right angles to the baseline: the geometry is not published, so this is an ASSUMPTION)."""
    from .scene import FlatSite
    p = p or Params.from_dict({"cit_s": 0.8, "adc_bits": 12})
    site = FlatSite()
    tx = Broadcast("AULOS-cal", "tv", 570e6, 7.61e6, 10 * np.log10(50e3) + 2.15, np.array([22500.0, 0.0, 300.0]), 22.5)
    rx = np.array([0.0, 0.0, 10.0])
    drone = DRONES["mavic"]
    thr = albersheim_db(0.9, p.pfa)
    ys = np.linspace(200, 12000, 600)
    pts = np.stack([np.zeros_like(ys), ys, np.full_like(ys, 100.0)], axis=1)
    rt = np.linalg.norm(pts - tx.pos, axis=1); rr = np.linalg.norm(pts - rx, axis=1)
    rb = rt + rr - np.linalg.norm(tx.pos - rx)
    snr = pair_snr(site, p, tx, rx, pts, drone, extra_loss_db=0.0)
    k = int(np.argmin(np.abs(rb - rb_max_m)))
    extra = float(snr[k] - thr)
    return {"extra_loss_db": round(max(extra, 0.0), 1), "snr_at_limit_db": round(float(snr[k]), 1), "threshold_db": round(float(thr), 1),
            "drone_offset_m_at_limit": round(float(ys[k])), "source": "Martelli et al. 2020, DVB-T AULOS trial (1.6-5 km bistatic)"}


def coverage(site, p: Params, rx_positions, txs: list[Broadcast], drone_key: str, half_m=1000.0, step_m=50.0,
             max_tx: int = 6):
    """Zone percentages detected / located (3+ transmitter-sensor pairs) and median position error, using the
    max_tx transmitters with the strongest echo over the facility."""
    drone = DRONES[drone_key]
    xs = np.arange(-half_m, half_m + 1e-6, step_m)
    X, Y = np.meshgrid(xs, xs)
    zone = site.in_zone(X, Y, p.zone_buffer_m).ravel()
    Z = site.ground(X, Y) + p.altitude_agl_m
    pts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], axis=1)[zone]
    thr = albersheim_db(0.9, p.pfa)
    centre = np.array([[0.0, 0.0, float(site.ground(0, 0)) + p.altitude_agl_m]])
    ranked = sorted(txs, key=lambda t: -np.median([pair_snr(site, p, t, r, centre, drone)[0] for r in rx_positions]))
    use = ranked[:max_tx]
    n = len(pts)
    J = np.zeros((n, 3, 3)); cnt = np.zeros(n, dtype=int); best = np.full(n, -99.0)
    per_tx = []
    for tx in use:
        hit = np.zeros(n, dtype=bool)
        for r in rx_positions:
            snr = pair_snr(site, p, tx, r, pts, drone)
            det = snr >= thr
            hit |= det; cnt += det; best = np.maximum(best, snr)
            u = (pts - tx.pos) / np.linalg.norm(pts - tx.pos, axis=1, keepdims=True) + (pts - r) / np.linalg.norm(pts - r, axis=1, keepdims=True)
            sigma = ACC_SCALE * tx.range_bin_m / np.sqrt(2 * 10 ** (np.minimum(snr, 40) / 10))
            w = np.where(det, 1.0 / sigma ** 2, 0.0)
            J += w[:, None, None] * u[:, :, None] * u[:, None, :]
        per_tx.append({"call": tx.call, "kind": tx.kind, "freq_mhz": round(tx.freq_hz / 1e6, 1), "distance_km": tx.distance_km,
                       "erp_kw": round(10 ** ((tx.eirp_dbw - 2.15) / 10) / 1e3, 1), "zone_seen_pct": round(100 * hit.mean(), 1)})
    J[:, 2, 2] += 1.0 / HEIGHT_PRIOR_M ** 2
    J += np.eye(3)[None] * 1e-9
    inv = np.linalg.inv(J)
    err = np.sqrt(np.maximum(inv[:, 0, 0] + inv[:, 1, 1], 0) + ERROR_FLOOR_M ** 2)
    located = cnt >= 3
    return {"detected_pct": round(100 * float(np.mean(cnt >= 1)), 1), "located_pct": round(100 * float(np.mean(located)), 1),
            "median_error_m": (round(float(np.median(err[located])), 1) if located.any() else None),
            "best_snr_db": round(float(np.median(best)), 1), "transmitters": per_tx, "n_pts": int(n)}
