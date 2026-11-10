"""Passive radar processing chain (the code that would run on real receivers).

1. Direct-path and static-clutter removal: subtract the dominant singular component(s) of the CRS
   matrix (Demissie & Steffes 2025, eq. 13).
2. Range compression: matched transform over the CRS subcarriers (exact frequencies, so the LTE DC
   gap is handled), with a Hann taper for range sidelobes.
3. Doppler processing: FFT over slots with a Hann taper.
4. Detection: 2D cell-averaging CFAR, local-maximum peak picking, sub-bin interpolation.
5. Micro-Doppler feature for drone-versus-bird classification.

Power maps are normalised so the noise has mean 1 (values are SNR).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .geo import C
from .lte import SLOT_S


def dpc_svd(Y: np.ndarray, rank: int = 1) -> np.ndarray:
    if rank <= 0:
        return Y
    U, s, Vh = np.linalg.svd(Y, full_matrices=False)
    return Y - (U[:, :rank] * s[:rank]) @ Vh[:rank]


@dataclass
class RDMap:
    power: np.ndarray  # (n_range, n_doppler), noise mean ~ 1
    ranges: np.ndarray  # bistatic range of each row, m
    dopplers: np.ndarray  # Hz
    range_bin_m: float  # resolution (not grid spacing)


def range_doppler(Y: np.ndarray, fk: np.ndarray, max_range_m: float, oversample: int = 2) -> RDMap:
    K, L = Y.shape
    span = fk.max() - fk.min()
    res = C / span
    ranges = np.arange(0, max_range_m, res / oversample)
    wk = np.hanning(K + 2)[1:-1]
    wl = np.hanning(L + 2)[1:-1]
    W = np.exp(2j * np.pi * np.outer(ranges / C, fk)) * wk  # (R, K)
    Z = np.fft.fftshift(np.fft.fft((W @ Y) * wl, axis=1), axes=1)
    noise_gain = np.sum(wk ** 2) * np.sum(wl ** 2)
    P = (np.abs(Z) ** 2) / noise_gain
    dop = np.fft.fftshift(np.fft.fftfreq(L, SLOT_S))
    return RDMap(P, ranges, dop, res)


def _box_sum(P: np.ndarray, hr: int, hd: int) -> np.ndarray:
    """Sum over a (2hr+1) x (2hd+1) box: reflect in range, wrap in Doppler."""
    Pp = np.pad(P, ((hr, hr), (0, 0)), mode="reflect")
    Pp = np.pad(Pp, ((0, 0), (hd, hd)), mode="wrap")
    S = np.zeros((Pp.shape[0] + 1, Pp.shape[1] + 1))
    S[1:, 1:] = Pp.cumsum(0).cumsum(1)
    R, D = P.shape
    return (S[2 * hr + 1:2 * hr + 1 + R, 2 * hd + 1:2 * hd + 1 + D] - S[:R, 2 * hd + 1:2 * hd + 1 + D]
            - S[2 * hr + 1:2 * hr + 1 + R, :D] + S[:R, :D])


@dataclass
class Detection:
    range_m: float
    doppler_hz: float
    snr_db: float
    microdoppler_db: float
    ri: int
    di: int


def cfar_detect(rd: RDMap, pfa: float, guard=(2, 3), train=(6, 10), notch_hz: float = 6.0,
                min_range_m: float = 30.0, max_dets: int = 25) -> tuple[list[Detection], np.ndarray]:
    """Cell-averaging CFAR. The zero-Doppler band (direct-path residue, wind-blown trees) is masked out
    of the training cells, otherwise targets at low Doppler see an inflated noise estimate."""
    P = rd.power
    masked = np.abs(rd.dopplers) <= notch_hz
    Pt = P.copy()
    Pt[:, masked] = np.median(P[:, ~masked], axis=1, keepdims=True)
    gr, gd = guard
    tr, td = train
    outer = _box_sum(Pt, gr + tr, gd + td)
    inner = _box_sum(Pt, gr, gd)
    n = (2 * (gr + tr) + 1) * (2 * (gd + td) + 1) - (2 * gr + 1) * (2 * gd + 1)
    noise = (outer - inner) / n
    alpha = n * (pfa ** (-1.0 / n) - 1)
    hit = P > alpha * noise
    hit &= ~masked[None, :]
    hit &= (rd.ranges >= min_range_m)[:, None]
    # Local maxima only (3 x 3).
    Pw = np.pad(P, 1, mode="edge")
    neigh = np.max(np.stack([Pw[1 + i:1 + i + P.shape[0], 1 + j:1 + j + P.shape[1]]
                             for i in (-1, 0, 1) for j in (-1, 0, 1) if (i, j) != (0, 0)]), axis=0)
    hit &= P >= neigh
    ri, di = np.nonzero(hit)
    if len(ri) > max_dets:
        keep = np.argsort(P[ri, di] / noise[ri, di])[::-1][:max_dets]
        ri, di = ri[keep], di[keep]
    dets = []
    dr = rd.ranges[1] - rd.ranges[0]
    dd = rd.dopplers[1] - rd.dopplers[0]
    for r, d in zip(ri, di):
        # Parabolic interpolation on the log power.
        def interp(a, b, c):
            den = a - 2 * b + c
            return 0.5 * (a - c) / den if den < 0 else 0.0
        lp = np.log(np.maximum(P, 1e-30))
        orr = interp(lp[r - 1, d], lp[r, d], lp[r + 1, d]) if 0 < r < P.shape[0] - 1 else 0.0
        od = interp(lp[r, d - 1], lp[r, d], lp[r, (d + 1) % P.shape[1]]) if d > 0 else 0.0
        dets.append(Detection(float(rd.ranges[r] + orr * dr), float(rd.dopplers[d] + od * dd),
                              float(10 * np.log10(P[r, d] / noise[r, d])), microdoppler_db(rd, r, d, noise[r, d]),
                              int(r), int(d)))
    return dets, noise


def microdoppler_db(rd: RDMap, r: int, d: int, noise: float, band=(40.0, 600.0)) -> float:
    """Rotor-blade evidence: excess energy in the band 40-600 Hz either side of the detection, at its
    range, as a z-score of the noise (dB of the z-score; > ~6 dB means clear rotor modulation).

    Rotor blades spread energy hundreds of Hz around the body Doppler; a bird's wings move slowly and
    add almost nothing there. A weak drone's blades can sit below the noise, so "no rotor signature"
    means "not shown to be a drone", not "bird".
    """
    off = np.abs(rd.dopplers - rd.dopplers[d])
    m = (off >= band[0]) & (off <= band[1]) & (np.abs(rd.dopplers) > 6.0)
    n = int(m.sum())
    if n == 0:
        return -99.0
    z = (rd.power[r, m].sum() - n * noise) / (np.sqrt(n) * noise)
    return float(10 * np.log10(max(z, 1e-3)))


def process(Y: np.ndarray, fk: np.ndarray, rank: int, max_range_m: float, pfa: float):
    rd = range_doppler(dpc_svd(Y, rank), fk, max_range_m)
    dets, noise = cfar_detect(rd, pfa)
    return rd, dets
