"""Received CRS resource elements for one illuminator-listener pair over one coherent integration.

Model (Demissie & Steffes 2025, eqs. 7-8, after inverse filtering by the known CRS symbols):
    Y[k, l] = sum_p  gamma_p(l) * exp(-j 2 pi f_k tau_p)  +  noise
k indexes the CRS subcarriers (frequency f_k), l the slots (one CRS symbol per 0.5 ms slot).
gamma_p(l) carries each path's Doppler and micro-Doppler. Everything is normalised so the noise
(thermal + ADC quantisation + co-channel leakage) has unit variance per RE.

Valid under the paper's assumptions A1-A3 (no range migration within the CIT); the time-domain
test in tests/test_lte.py checks this against full OFDM synthesis and demodulation.
"""
from __future__ import annotations

import numpy as np

from .lte import SLOT_S
from .scene import Pair, Scene, best_face, target_paths


def synthesize(scene: Scene, pair: Pair, t_mid: float, rng) -> tuple[np.ndarray, list]:
    L = scene.L
    fk = pair.ill.carrier.re_freqs(0)
    K = len(fk)
    # Fan-mode nodes: use the face that sees the drone best (SIMPLIFICATION: equivalent to detecting on
    # every face and keeping the best, without counting the extra false-alarm opportunities).
    drone = next((tg for tg in scene.targets if tg.kind == "drone"), None)
    e = best_face(scene, pair, drone.traj.state(scene.site, t_mid)[0]) if drone is not None else 0
    # Direct path and static clutter: constant over slow time (rank one).
    Y = np.outer(pair.static_vec[e], np.ones(L, dtype=complex))
    # Wind-blown vegetation: each patch is three sub-scatterers with small random Dopplers.
    if len(pair.veg_delays):
        tl = (np.arange(L) - L / 2) * SLOT_S
        steer = np.exp(-2j * np.pi * np.outer(fk, pair.veg_delays))  # (K, P)
        slow = np.exp(1j * (2 * np.pi * pair.veg_dopplers[:, :, None] * tl + pair.veg_phases[:, :, None])).sum(1) / np.sqrt(3)
        Y += steer @ (pair.veg_amps[e][:, None] * slow)
    # Drone and bird, including rotor-blade and wing micro-Doppler.
    delays, rows, truth = target_paths(scene, pair, t_mid, rng, e)
    if len(delays):
        Y += np.exp(-2j * np.pi * np.outer(fk, delays)) @ rows
    Y += (rng.standard_normal((K, L)) + 1j * rng.standard_normal((K, L))) / np.sqrt(2)
    return Y, truth
