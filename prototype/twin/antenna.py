"""Receive antennas on a listener node: element types, beam patterns, and how a node's elements are
pointed and combined.

Gain and coverage trade against each other: a rough rule is G ~ 30,000 / (horizontal beamwidth x
vertical beamwidth), beamwidths in degrees (Balanis, Antenna Theory, 4th ed., directivity
approximations). One antenna cannot have both high gain and wide coverage.

A node's M elements are split into F faces pointing different ways (they tile an arc), with M/F
elements per face combined coherently in software (digital beamforming):
  F = M  fan: each element on its own; the drone is seen by one face, so gain = one element's gain.
  F = 1  array: all elements face one way; toward the drone element pattern + 10 log10(M), but only
         inside the element's own beam.
  omni elements always form one face: a circular array, element gain + 10 log10(M) in every direction.
"iso" keeps the v0.2 behavior (rx_gain_dbi toward every direction) for calibration and old runs.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class AntennaType:
    id: str
    name: str
    gain_dbi: float
    az_bw_deg: float  # horizontal half-power beamwidth (360 = omnidirectional)
    el_bw_deg: float  # vertical half-power beamwidth
    front_to_back_db: float  # attenuation floor behind and far off to the side
    price_usd: float  # ASSUMPTION: typical retail, one unit; replace with Seed supplier quotes
    size: str  # at ~700 MHz (wavelength ~0.41 m)


# ASSUMPTION: typical datasheet values for 600-800 MHz LTE antennas (gain, beamwidths, front-to-back)
# and typical one-off retail prices. Consistent with G ~ 30,000 / (az_bw x el_bw).
ANTENNAS = {
    "omni": AntennaType("omni", "Omni (dipole / collinear)", 2.0, 360.0, 78.0, 0.0, 40.0, "~0.2-0.5 m whip"),
    "lpda": AntennaType("lpda", "Log-periodic", 7.0, 70.0, 80.0, 18.0, 90.0, "~0.5 m, covers all three carriers' bands"),
    "patch": AntennaType("patch", "Patch / flat panel", 8.0, 70.0, 65.0, 20.0, 80.0, "~0.3-0.4 m square, mounts flat on a pole"),
    "yagi": AntennaType("yagi", "Yagi", 11.0, 50.0, 55.0, 18.0, 70.0, "~0.5-1 m boom"),
}
UPTILT_DEG = 5.0  # ASSUMPTION: tilt beams slightly up (drones are above, ground clutter below)
AUTO_SWING_DEG = 90.0  # auto pointing may turn a node this far from facing inward
AUTO_STEP_DEG = 15.0


def pattern_db(ant: AntennaType, boresight_az: float, origin: np.ndarray, pts: np.ndarray,
               tilt_deg: float = UPTILT_DEG) -> np.ndarray:
    """Gain (dBi) of one element toward each point. Parabolic main lobe with a floor, the same form as
    the 3GPP TR 36.814 sector pattern used for the towers."""
    pts = np.atleast_2d(pts)
    d = pts - origin
    el = np.degrees(np.arctan2(d[:, 2], np.hypot(d[:, 0], d[:, 1])))
    if ant.az_bw_deg >= 360:
        a_v = -np.minimum(12 * (el / ant.el_bw_deg) ** 2, 15.0)  # omni: vertical pattern only
        return ant.gain_dbi + a_v
    az = np.degrees(np.arctan2(d[:, 0], d[:, 1]))
    phi = (az - boresight_az + 180) % 360 - 180
    a_h = -np.minimum(12 * (phi / ant.az_bw_deg) ** 2, ant.front_to_back_db)
    a_v = -np.minimum(12 * ((el - tilt_deg) / ant.el_bw_deg) ** 2, ant.front_to_back_db)
    return ant.gain_dbi - np.minimum(-(a_h + a_v), ant.front_to_back_db)


def face_azimuths(boresight: float, ant: AntennaType, faces: int) -> list[float]:
    """Pointing of each separately processed channel group ("face") of a node. Neighboring faces meet at
    their half-power edges (ASSUMPTION), or share the circle evenly if that would overlap."""
    if faces <= 1 or ant.az_bw_deg >= 360:
        return [boresight % 360]
    step = min(ant.az_bw_deg, 360.0 / faces)
    return [(boresight + (i - (faces - 1) / 2) * step) % 360 for i in range(faces)]


@dataclass
class NodeAntenna:
    """What one listener node receives with: element type, each face's pointing, and the coherent
    array gain of the elements behind each face."""
    kind: str  # antenna type id, or "iso"
    faces: list  # boresight azimuth of each face
    array_gain_db: float
    iso_gain_dbi: float = 0.0  # only for kind == "iso"
    elements: int = 1

    def gain_db(self, face: int, origin: np.ndarray, pts: np.ndarray) -> np.ndarray:
        """Element gain toward pts for one face (array gain is applied to the noise, as in v0.2)."""
        if self.kind == "iso":
            return np.full(len(np.atleast_2d(pts)), self.iso_gain_dbi)
        return pattern_db(ANTENNAS[self.kind], self.faces[face], origin, pts)

    def to_dict(self) -> dict:
        d = {"kind": self.kind, "faces": [round(f, 1) for f in self.faces], "array_gain_db": round(self.array_gain_db, 2),
             "elements": self.elements}
        if self.kind in ANTENNAS:
            a = ANTENNAS[self.kind]
            d.update(gain_dbi=a.gain_dbi, az_bw_deg=a.az_bw_deg, el_bw_deg=a.el_bw_deg)
        else:
            d.update(gain_dbi=self.iso_gain_dbi, az_bw_deg=360.0, el_bw_deg=180.0)
        return d


def layout(p) -> tuple[int, int]:
    """(faces, elements per face). Elements are split evenly over the faces."""
    m = max(int(p.rx_elements), 1)
    faces = 1 if p.antenna in ("iso", "omni") else int(np.clip(p.faces, 1, m))
    return faces, max(m // faces, 1)


def node_antenna(p, boresight: float) -> NodeAntenna:
    m = max(int(p.rx_elements), 1)
    if p.antenna == "iso":
        return NodeAntenna("iso", [0.0], 10 * np.log10(m), p.rx_gain_dbi, m)
    faces, per = layout(p)
    return NodeAntenna(p.antenna, face_azimuths(boresight, ANTENNAS[p.antenna], faces), 10 * np.log10(per), 0.0, m)


def inward_azimuth(site, pos: np.ndarray) -> float:
    """Bearing from a fence node toward the middle of the facility (clockwise from north)."""
    c = np.asarray(site.fence)[:-1].mean(axis=0)
    return float(np.degrees(np.arctan2(c[0] - pos[0], c[1] - pos[1])) % 360)


def zone_samples(site, buffer_m: float, agl: float, step_m: float = 60.0) -> np.ndarray:
    """Points over the protected zone at drone height, for scoring a pointing choice."""
    f = np.asarray(site.fence)
    lo, hi = f.min(axis=0) - buffer_m, f.max(axis=0) + buffer_m
    xs, ys = np.arange(lo[0], hi[0], step_m), np.arange(lo[1], hi[1], step_m)
    X, Y = np.meshgrid(xs, ys)
    keep = np.asarray(site.in_zone(X, Y, buffer_m))
    X, Y = X[keep], Y[keep]
    return np.stack([X, Y, site.ground(X, Y) + agl], axis=1)
