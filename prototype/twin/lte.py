"""LTE downlink numerology and cell-specific reference signals (CRS), 3GPP TS 36.211.

Only what passive radar needs: the CRS are known in advance from the cell ID, so the receiver can
"inverse filter" them without demodulating user data (Demissie & Steffes 2025, section 2).

Implemented (TS 36.211 v16):
  - 7.2   pseudo-random (Gold) sequence c(n), Nc = 1600
  - 6.10.1.1  CRS sequence r_{l,ns}(m) = (1 - 2c(2m) + j(1 - 2c(2m+1))) / sqrt(2)
  - 6.10.1.2  mapping to resource elements for antenna port 0, normal cyclic prefix
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

SCS_HZ = 15e3  # subcarrier spacing
N_RB_MAX = 110  # N_RB^{max,DL}
SYMBOLS_PER_SLOT = 7  # normal cyclic prefix
SLOT_S = 0.5e-3
# Channel bandwidth (MHz) -> (N_RB, FFT size, sample rate)
BANDWIDTHS = {1.4: (6, 128, 1.92e6), 3: (15, 256, 3.84e6), 5: (25, 512, 7.68e6),
              10: (50, 1024, 15.36e6), 15: (75, 1536, 23.04e6), 20: (100, 2048, 30.72e6)}


def gold_sequence(c_init: int, length: int) -> np.ndarray:
    """TS 36.211 section 7.2: length-31 Gold sequence, output c(0..length-1)."""
    nc = 1600
    total = length + nc
    x1 = np.zeros(total + 31, dtype=np.uint8)
    x2 = np.zeros(total + 31, dtype=np.uint8)
    x1[0] = 1
    for i in range(31):
        x2[i] = (c_init >> i) & 1
    for n in range(total):
        x1[n + 31] = x1[n + 3] ^ x1[n]
        x2[n + 31] = x2[n + 3] ^ x2[n + 2] ^ x2[n + 1] ^ x2[n]
    return (x1[nc:nc + length] ^ x2[nc:nc + length]).astype(np.uint8)


def crs_sequence(cell_id: int, ns: int, l: int) -> np.ndarray:
    """r_{l,ns}(m), m = 0 .. 2*N_RB_MAX - 1 (normal CP, so N_CP = 1)."""
    c_init = (1 << 10) * (7 * (ns + 1) + l + 1) * (2 * cell_id + 1) + 2 * cell_id + 1
    c = gold_sequence(c_init, 4 * N_RB_MAX).astype(np.float64)
    return ((1 - 2 * c[0::2]) + 1j * (1 - 2 * c[1::2])) / np.sqrt(2)


def crs_subcarriers(cell_id: int, n_rb: int, l: int) -> np.ndarray:
    """Subcarrier indices k (0 .. 12*n_rb - 1) carrying port-0 CRS in OFDM symbol l (0 or 4)."""
    v = 0 if l == 0 else 3
    v_shift = cell_id % 6
    m = np.arange(2 * n_rb)
    return 6 * m + (v + v_shift) % 6


def subcarrier_freqs(k: np.ndarray, n_rb: int) -> np.ndarray:
    """Baseband frequency (Hz) of subcarrier index k. The DC subcarrier is not used in LTE downlink."""
    half = 6 * n_rb
    k = np.asarray(k)
    return np.where(k < half, k - half, k - half + 1) * SCS_HZ


@dataclass
class Carrier:
    """One LTE carrier as seen by the passive radar."""
    freq_hz: float
    bw_mhz: float = 10
    cell_id: int = 0

    @property
    def n_rb(self) -> int:
        return BANDWIDTHS[self.bw_mhz][0]

    @property
    def n_fft(self) -> int:
        return BANDWIDTHS[self.bw_mhz][1]

    @property
    def fs(self) -> float:
        return BANDWIDTHS[self.bw_mhz][2]

    @property
    def n_subcarriers(self) -> int:
        return 12 * self.n_rb

    @property
    def n_re(self) -> int:
        """CRS resource elements per CRS symbol (port 0)."""
        return 2 * self.n_rb

    def re_freqs(self, l: int = 0) -> np.ndarray:
        return subcarrier_freqs(crs_subcarriers(self.cell_id, self.n_rb, l), self.n_rb)

    def re_symbols(self, ns: int, l: int = 0) -> np.ndarray:
        """CRS values on the used REs: r(m') with m' = m + N_RB_MAX - N_RB."""
        r = crs_sequence(self.cell_id, ns % 20, l)
        m = np.arange(self.n_re) + N_RB_MAX - self.n_rb
        return r[m]

    # Bistatic range resolution and ambiguity of CRS-only processing (comb of every 6th subcarrier).
    @property
    def range_bin_m(self) -> float:
        return 299792458.0 / (self.n_re * 6 * SCS_HZ)

    @property
    def unambiguous_range_m(self) -> float:
        return 299792458.0 / (6 * SCS_HZ)


def ofdm_symbol_time(carrier: Carrier, grid: np.ndarray, cp: int) -> np.ndarray:
    """Time-domain OFDM symbol with cyclic prefix from a full subcarrier grid (12*N_RB values)."""
    n = carrier.n_fft
    half = 6 * carrier.n_rb
    spec = np.zeros(n, dtype=complex)
    spec[1:half + 1] = grid[half:]  # positive frequencies (DC skipped)
    spec[n - half:] = grid[:half]  # negative frequencies
    x = np.fft.ifft(spec) * np.sqrt(n)
    return np.concatenate([x[-cp:], x])


def ofdm_demod(carrier: Carrier, x: np.ndarray, cp: int) -> np.ndarray:
    """Inverse of ofdm_symbol_time: returns the 12*N_RB subcarrier values."""
    n = carrier.n_fft
    half = 6 * carrier.n_rb
    spec = np.fft.fft(x[cp:cp + n]) / np.sqrt(n)
    return np.concatenate([spec[n - half:], spec[1:half + 1]])
