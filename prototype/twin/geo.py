"""Site geometry: local coordinates, terrain, buildings, and terrain/building diffraction.

Coordinates: x = east, y = north, z = height above sea level (NAVD88), metres. Origin = facility centroid.
Diffraction: ITU-R P.526-15 section 4.5.1 (Bullington method), effective Earth radius factor k = 4/3.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np

EARTH_RADIUS_M = 6371e3
K_FACTOR = 4.0 / 3.0  # standard atmosphere effective Earth radius factor (ITU-R P.453/P.526)
C = 299792458.0


# ---------------------------------------------------------------------------
# Local tangent-plane frame (accurate to a few metres over ~20 km)
# ---------------------------------------------------------------------------
class LocalFrame:
    def __init__(self, lat0: float, lon0: float):
        self.lat0, self.lon0 = lat0, lon0
        p = math.radians(lat0)
        # WGS84 metres per degree (standard series expansion).
        self.m_per_deg_lat = 111132.92 - 559.82 * math.cos(2 * p) + 1.175 * math.cos(4 * p)
        self.m_per_deg_lon = 111412.84 * math.cos(p) - 93.5 * math.cos(3 * p)

    def to_xy(self, lat, lon):
        return ((np.asarray(lon) - self.lon0) * self.m_per_deg_lon,
                (np.asarray(lat) - self.lat0) * self.m_per_deg_lat)

    def to_latlon(self, x, y):
        return (self.lat0 + np.asarray(y) / self.m_per_deg_lat,
                self.lon0 + np.asarray(x) / self.m_per_deg_lon)


# ---------------------------------------------------------------------------
# Polygons
# ---------------------------------------------------------------------------
def points_in_polygon(px, py, poly) -> np.ndarray:
    """Even-odd ray casting, vectorised over points."""
    px = np.asarray(px, dtype=float)
    py = np.asarray(py, dtype=float)
    inside = np.zeros(px.shape, dtype=bool)
    xs, ys = poly[:, 0], poly[:, 1]
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi, xj, yj = xs[i], ys[i], xs[j], ys[j]
        cond = (yi > py) != (yj > py)
        with np.errstate(divide="ignore", invalid="ignore"):
            xint = (xj - xi) * (py - yi) / (yj - yi + 1e-300) + xi
        inside ^= cond & (px < xint)
        j = i
    return inside


def distance_to_polygon(px, py, poly) -> np.ndarray:
    """Distance from points to a polygon (0 inside). Accepts scalars or arrays."""
    shape = np.broadcast(np.asarray(px), np.asarray(py)).shape
    px = np.atleast_1d(np.asarray(px, dtype=float)).ravel()
    py = np.atleast_1d(np.asarray(py, dtype=float)).ravel()
    best = np.full(px.shape, np.inf)
    for (x1, y1), (x2, y2) in zip(poly[:-1], poly[1:]):
        dx, dy = x2 - x1, y2 - y1
        L2 = dx * dx + dy * dy or 1e-12
        t = np.clip(((px - x1) * dx + (py - y1) * dy) / L2, 0, 1)
        best = np.minimum(best, np.hypot(px - (x1 + t * dx), py - (y1 + t * dy)))
    best[points_in_polygon(px, py, poly)] = 0.0
    return best.reshape(shape)


def polygon_perimeter_points(poly, n) -> np.ndarray:
    """n points evenly spaced along a closed polygon outline."""
    seg = np.hypot(np.diff(poly[:, 0]), np.diff(poly[:, 1]))
    cum = np.concatenate([[0], np.cumsum(seg)])
    s = np.linspace(0, cum[-1], n, endpoint=False)
    idx = np.searchsorted(cum, s, side="right") - 1
    t = (s - cum[idx]) / np.maximum(seg[idx], 1e-9)
    return poly[idx] + (poly[idx + 1] - poly[idx]) * t[:, None]


# ---------------------------------------------------------------------------
# Grids
# ---------------------------------------------------------------------------
@dataclass
class Grid:
    z: np.ndarray  # (ny, nx), row 0 = south
    x0: float
    y0: float
    step: float

    @property
    def x1(self):
        return self.x0 + self.step * (self.z.shape[1] - 1)

    @property
    def y1(self):
        return self.y0 + self.step * (self.z.shape[0] - 1)

    def contains(self, x, y):
        return (x >= self.x0) & (x <= self.x1) & (y >= self.y0) & (y <= self.y1)

    def bilinear(self, x, y):
        fx = np.clip((np.asarray(x) - self.x0) / self.step, 0, self.z.shape[1] - 1.0001)
        fy = np.clip((np.asarray(y) - self.y0) / self.step, 0, self.z.shape[0] - 1.0001)
        j, i = fx.astype(int), fy.astype(int)
        tx, ty = fx - j, fy - i
        z = self.z
        return (z[i, j] * (1 - tx) * (1 - ty) + z[i, j + 1] * tx * (1 - ty)
                + z[i + 1, j] * (1 - tx) * ty + z[i + 1, j + 1] * tx * ty)

    def nearest(self, x, y):
        j = np.clip(np.rint((np.asarray(x) - self.x0) / self.step).astype(int), 0, self.z.shape[1] - 1)
        i = np.clip(np.rint((np.asarray(y) - self.y0) / self.step).astype(int), 0, self.z.shape[0] - 1)
        return self.z[i, j]


def _read_grid(folder: Path, meta: dict) -> Grid:
    raw = np.fromfile(folder / meta["file"], dtype="<i2").astype(np.float32) / 10.0
    return Grid(raw.reshape(meta["ny"], meta["nx"]), meta["x0"], meta["y0"], meta["step_m"])


# ---------------------------------------------------------------------------
# Site
# ---------------------------------------------------------------------------
class Site:
    def __init__(self, folder: str | Path):
        self.folder = Path(folder)
        self.meta = json.loads((self.folder / "site.json").read_text())
        o = self.meta["origin"]
        self.frame = LocalFrame(o["lat"], o["lon"])
        self.name = self.meta["name"]
        self.fence = np.array(self.meta["fence"], dtype=float)
        self.buildings = self.meta["buildings"]
        self.coarse = _read_grid(self.folder, self.meta["terrain"]["coarse"])
        self.fine = _read_grid(self.folder, self.meta["terrain"]["fine"])
        self.bldg = self._rasterise_buildings()
        towers_path = self.folder / "towers.json"
        self.towers = json.loads(towers_path.read_text())["towers"] if towers_path.exists() else []

    def _rasterise_buildings(self) -> Grid:
        """Building heights on the fine terrain grid (0 where no building)."""
        g = self.fine
        h = np.zeros_like(g.z)
        ny, nx = h.shape
        for b in self.buildings:
            poly = np.array(b["poly"])
            j0 = max(int((poly[:, 0].min() - g.x0) / g.step) - 1, 0)
            j1 = min(int((poly[:, 0].max() - g.x0) / g.step) + 2, nx)
            i0 = max(int((poly[:, 1].min() - g.y0) / g.step) - 1, 0)
            i1 = min(int((poly[:, 1].max() - g.y0) / g.step) + 2, ny)
            if j1 <= j0 or i1 <= i0:
                continue
            X, Y = np.meshgrid(g.x0 + g.step * np.arange(j0, j1), g.y0 + g.step * np.arange(i0, i1))
            m = points_in_polygon(X, Y, poly)
            h[i0:i1, j0:j1] = np.where(m, np.maximum(h[i0:i1, j0:j1], b["height_m"]), h[i0:i1, j0:j1])
        return Grid(h, g.x0, g.y0, g.step)

    # Terrain height (no buildings), metres above sea level.
    def ground(self, x, y):
        x = np.asarray(x, dtype=float)
        y = np.asarray(y, dtype=float)
        z = self.coarse.bilinear(x, y)
        inside = self.fine.contains(x, y)
        if np.any(inside):
            z = np.where(inside, self.fine.bilinear(x, y), z)
        return z

    # Terrain + buildings, used for blocking/diffraction.
    def surface(self, x, y):
        x = np.asarray(x, dtype=float)
        y = np.asarray(y, dtype=float)
        z = self.ground(x, y)
        inside = self.bldg.contains(x, y)
        if np.any(inside):
            z = z + np.where(inside, self.bldg.nearest(x, y), 0.0)
        return z

    def in_zone(self, x, y, buffer_m):
        return distance_to_polygon(x, y, self.fence) <= buffer_m


# ---------------------------------------------------------------------------
# Propagation over terrain
# ---------------------------------------------------------------------------
def knife_edge_j(nu):
    """ITU-R P.526 eq. 31: single knife-edge loss J(nu) in dB (0 for nu <= -0.78)."""
    nu = np.asarray(nu, dtype=float)
    out = 6.9 + 20 * np.log10(np.sqrt((nu - 0.1) ** 2 + 1) + nu - 0.1)
    return np.where(nu > -0.78, out, 0.0)


def bullington_loss_db(surface_fn, a, b, freq_hz, n_samples=64):
    """Diffraction loss (dB) between point sets a and b, shape (M, 3), via the Bullington method.

    surface_fn(x, y) returns terrain+building height above sea level. Heights in a/b are above
    sea level. Implements ITU-R P.526-15 eqs. 47-55 in SI units, vectorised over M paths.
    Also returns the uncorrected knife-edge part Luc (0 means clear line of sight).
    """
    a = np.atleast_2d(np.asarray(a, dtype=float))
    b = np.atleast_2d(np.asarray(b, dtype=float))
    lam = C / freq_hz
    d = np.maximum(np.hypot(b[:, 0] - a[:, 0], b[:, 1] - a[:, 1]), 1.0)  # (M,)
    t = np.linspace(0, 1, n_samples)[1:-1]  # interior points
    xs = a[:, 0:1] + (b[:, 0:1] - a[:, 0:1]) * t
    ys = a[:, 1:2] + (b[:, 1:2] - a[:, 1:2]) * t
    h = surface_fn(xs, ys)  # (M, n)
    di = d[:, None] * t
    dd = d[:, None] - di
    bulge = di * dd / (2 * K_FACTOR * EARTH_RADIUS_M)
    he = h + bulge
    hts, hrs = a[:, 2:3], b[:, 2:3]
    stim = np.max((he - hts) / di, axis=1)
    str_ = (b[:, 2] - a[:, 2]) / d
    los = stim < str_
    # Case 1: line of sight -> highest diffraction parameter of any point.
    hob = he - (hts * dd + hrs * di) / d[:, None]
    nu_max = np.max(hob * np.sqrt(2 * d[:, None] / (lam * di * dd)), axis=1)
    # Case 2: obstructed -> Bullington point.
    srim = np.max((he - hrs) / dd, axis=1)
    db = (b[:, 2] - a[:, 2] + srim * d) / np.maximum(stim + srim, 1e-12)
    db = np.clip(db, 1.0, d - 1.0)
    nu_b = ((a[:, 2] + stim * db - (a[:, 2] * (d - db) + b[:, 2] * db) / d)
            * np.sqrt(2 * d / (lam * np.maximum(db * (d - db), 1e-6))))  # safe when the points nearly coincide
    luc = np.where(los, knife_edge_j(nu_max), knife_edge_j(nu_b))
    loss = luc + (1 - np.exp(-luc / 6)) * (10 + 0.02 * d / 1000)
    return loss, luc


def two_ray_gain_db(h1_agl, h2_agl, d, freq_hz, gamma_mag):
    """Flat-earth ground reflection factor |1 + G e^{-j k Delta}|^2 in dB (horizontal pol, G ~ -|G|)."""
    lam = C / freq_hz
    h1 = np.maximum(np.asarray(h1_agl, dtype=float), 0.5)
    h2 = np.maximum(np.asarray(h2_agl, dtype=float), 0.5)
    delta = 2 * h1 * h2 / np.maximum(np.asarray(d, dtype=float), 1.0)
    f = 1 - gamma_mag * np.exp(-1j * 2 * np.pi * delta / lam)
    return 20 * np.log10(np.maximum(np.abs(f), 1e-3))
