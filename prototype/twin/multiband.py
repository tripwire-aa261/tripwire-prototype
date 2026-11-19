"""v1.0: the multi-band sensor in the twin's design-point simulation (coverage, accuracy, scored flights).

The sensor has a cell bank (the 8-antenna ring of v0.5) and, when Params.signals includes "tv", a UHF TV bank that
uses the strongest licensed digital TV transmitters around the site (FCC TV Query, data/sites/*/broadcast.json) as
extra illuminators. Each TV transmitter-sensor pair is scored with the TV link budget in broadcast.py and then
treated exactly like a cell pair: a point is located when 3+ pairs (cell, TV or both) from 2+ sensors detect the
drone, position error combines every detecting pair's range measurement, and scored flights apply the same
zero-Doppler notch and tracker rules.

The full signal replay (run.py) stays cell-only: TV pairs live in Scene.tv_pairs, apart from Scene.pairs.
ASSUMPTIONS: Params.tv_transmitters (3) TV channels processed per sensor (the TV bank's tuning plan fits them);
TV results keep broadcast.py's noise floor 20 dB above thermal and its 5 m error floor; co-channel suppression
(the interference axis) applies to cell only.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .geo import C


@dataclass
class TvCarrier:
    freq_hz: float
    bw_hz: float

    @property
    def range_bin_m(self) -> float:
        return C / self.bw_hz


@dataclass
class TvIlluminator:
    id: str
    name: str
    pos: np.ndarray
    carrier: TvCarrier
    broadcast: object  # broadcast.Broadcast


@dataclass
class TvPair:
    ill: TvIlluminator
    rx: object  # rf.Listener
    kind: str = "tv"


def all_pairs(scene) -> list:
    """Cell pairs first, then TV pairs (callers that slice by len(scene.pairs) rely on this order)."""
    return list(scene.pairs) + list(getattr(scene, "tv_pairs", []) or [])


def is_tv(pair) -> bool:
    return getattr(pair, "kind", "cell") == "tv"


def tv_snr_db(scene, pair: TvPair, pts, drone) -> np.ndarray:
    from .broadcast import pair_snr
    return pair_snr(scene.site, scene.params, pair.ill.broadcast, pair.rx.pos, np.atleast_2d(pts), drone)


def add_tv_pairs(scene, n_tx: int | None = None) -> list:
    """Pick the n_tx digital TV transmitters with the strongest drone echo over the facility (median over sensors)
    and add one pair per transmitter and sensor to scene.tv_pairs. Returns the transmitters used."""
    from .broadcast import load_broadcast, pair_snr
    p = scene.params
    n_tx = p.tv_transmitters if n_tx is None else n_tx
    txs = [t for t in load_broadcast(scene.site) if t.kind == "tv"]
    if not txs or n_tx <= 0:
        scene.tv_pairs = []
        return []
    drone = next(t for t in scene.targets if t.kind == "drone")
    centre = np.array([[0.0, 0.0, float(scene.site.ground(0, 0)) + p.altitude_agl_m]])
    score = [np.median([pair_snr(scene.site, p, t, l.pos, centre, drone)[0] for l in scene.listeners]) for t in txs]
    use = [txs[i] for i in np.argsort(score)[::-1][:n_tx]]
    ills = [TvIlluminator(f"tv:{t.call}", t.call, t.pos, TvCarrier(t.freq_hz, t.bw_hz), t) for t in use]
    scene.tv_pairs = [TvPair(ill, l) for ill in ills for l in scene.listeners]
    return use
