"""Link budget pieces shared by the signal simulator and the coverage map.

Powers are per LTE resource element (RE): the sector EIRP is shared equally over all 12*N_RB
subcarriers (equal energy per RE, ASSUMPTION). Noise is per 15 kHz subcarrier.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .geo import C, bullington_loss_db, two_ray_gain_db
from .lte import SCS_HZ, Carrier

K_B = 1.380649e-23
T0 = 290.0
FOUR_PI = 4 * np.pi


def db(x):
    return 10 * np.log10(np.maximum(x, 1e-300))


def undb(x):
    return 10 ** (np.asarray(x, dtype=float) / 10)


@dataclass
class Illuminator:
    id: str
    label: str
    operator: str
    carrier: Carrier
    pos: np.ndarray  # (3,) x, y, z above sea level
    eirp_dbw: float
    azimuth_deg: float  # sector boresight, clockwise from north
    downtilt_deg: float
    tower: dict = field(default_factory=dict)
    satellite: bool = False


@dataclass
class Listener:
    id: str
    pos: np.ndarray  # (3,)
    antenna: object = None  # antenna.NodeAntenna; None -> isotropic rx_gain_dbi (v0.2 behavior)


def sector_gain_db(ill: Illuminator, pts: np.ndarray) -> np.ndarray:
    """3GPP TR 36.814 sector pattern relative to boresight (peak gain is inside the EIRP)."""
    pts = np.atleast_2d(pts)
    d = pts - ill.pos
    az = np.degrees(np.arctan2(d[:, 0], d[:, 1]))
    phi = (az - ill.azimuth_deg + 180) % 360 - 180
    el = np.degrees(np.arctan2(d[:, 2], np.hypot(d[:, 0], d[:, 1])))
    a_h = -np.minimum(12 * (phi / 65.0) ** 2, 30.0)
    a_v = -np.minimum(12 * ((el + ill.downtilt_deg) / 10.0) ** 2, 20.0)
    return -np.minimum(-(a_h + a_v), 30.0)


def path_gain_db(site, a: np.ndarray, b: np.ndarray, freq_hz: float, gamma: float, n_samples: int = 48):
    """One-way propagation gain (negative dB): free space + terrain/building diffraction
    + ground reflection on clear paths. a, b: (M, 3) or broadcastable."""
    a = np.atleast_2d(a).astype(float)
    b = np.atleast_2d(b).astype(float)
    a, b = np.broadcast_arrays(a, b)
    lam = C / freq_hz
    d3 = np.maximum(np.linalg.norm(b - a, axis=1), 1.0)
    fspl = 20 * np.log10(FOUR_PI * d3 / lam)
    loss, luc = bullington_loss_db(site.surface, a, b, freq_hz, n_samples)
    g = -fspl - loss
    if gamma > 0:
        h1 = a[:, 2] - site.ground(a[:, 0], a[:, 1])
        h2 = b[:, 2] - site.ground(b[:, 0], b[:, 1])
        dh = np.hypot(b[:, 0] - a[:, 0], b[:, 1] - a[:, 1])
        tr = two_ray_gain_db(h1, h2, dh, freq_hz, gamma)
        g = g + np.where(luc < 1.0, tr, 0.0)  # reflection only when the path is clear
    return g, d3


def re_power_dbw(ill: Illuminator) -> float:
    return ill.eirp_dbw - 10 * np.log10(ill.carrier.n_subcarriers)


def direct_power_re_dbw(site, ill: Illuminator, rx: np.ndarray, rx_gain_dbi, gamma: float):
    """rx_gain_dbi: receive antenna gain toward the tower (scalar or per point)."""
    rx = np.atleast_2d(rx)
    g, _ = path_gain_db(site, ill.pos[None, :], rx, ill.carrier.freq_hz, gamma)
    return re_power_dbw(ill) + sector_gain_db(ill, rx) + g + rx_gain_dbi


def echo_power_re_dbw(site, ill: Illuminator, rx: np.ndarray, tgt: np.ndarray, rcs_m2, rx_gain_dbi,
                      gamma: float, loss_db: float):
    """Bistatic radar equation per RE (Willis): P = P_t G_t G_r lambda^2 sigma / ((4 pi)^3 Rt^2 Rr^2),
    written as two one-way path gains: P = EIRP * g_tx * (4 pi sigma / lambda^2) * g_rx * G_r.
    rx_gain_dbi: receive antenna gain toward each target point (scalar or array)."""
    tgt = np.atleast_2d(tgt)
    lam = C / ill.carrier.freq_hz
    g_t, rt = path_gain_db(site, ill.pos[None, :], tgt, ill.carrier.freq_hz, gamma)
    g_r, rr = path_gain_db(site, np.atleast_2d(rx), tgt, ill.carrier.freq_hz, gamma)
    scatter = 10 * np.log10(FOUR_PI * np.asarray(rcs_m2) / lam ** 2)
    p = re_power_dbw(ill) + sector_gain_db(ill, tgt) + g_t + scatter + g_r + rx_gain_dbi - loss_db
    return p, rt, rr


def thermal_re_dbw(nf_db: float) -> float:
    return 10 * np.log10(K_B * T0 * SCS_HZ) + nf_db


def adc_sqnr_db(bits: int, backoff_db: float) -> float:
    """Quantisation SNR of a full-scale sine is 6.02 b + 1.76 dB; OFDM needs headroom for its peaks."""
    return 6.02 * bits + 1.76 - backoff_db


def quantisation_re_dbw(total_in_dbw: float, bits: int, backoff_db: float, fs: float) -> float:
    """Quantisation noise is white over the sample rate fs; this is the share in one subcarrier."""
    return total_in_dbw - adc_sqnr_db(bits, backoff_db) + 10 * np.log10(SCS_HZ / fs)


def rcs_at(rcs_m2: float, size_m: float, freq_hz: float) -> float:
    """Rayleigh roll-off (ka)^4 when the target is small next to the wavelength."""
    ka = 2 * np.pi * freq_hz / C * size_m / 2
    return rcs_m2 if ka >= 1 else rcs_m2 * ka ** 4


def bistatic_range(tx, rx, p):
    return np.linalg.norm(p - tx, axis=-1) + np.linalg.norm(p - rx, axis=-1) - np.linalg.norm(rx - tx, axis=-1)


def bistatic_doppler(tx, rx, p, v, freq_hz):
    """nu = -(1/lambda) d/dt (Rt + Rr)."""
    lam = C / freq_hz
    ut = (p - tx) / np.linalg.norm(p - tx, axis=-1, keepdims=True)
    ur = (p - rx) / np.linalg.norm(p - rx, axis=-1, keepdims=True)
    return -np.sum((ut + ur) * v, axis=-1) / lam
