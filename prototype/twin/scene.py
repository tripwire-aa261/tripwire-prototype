"""Scene construction: illuminators from real towers, listeners on the real fence, clutter, targets."""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

import numpy as np

from .antenna import AUTO_STEP_DEG, AUTO_SWING_DEG, NodeAntenna, inward_azimuth, node_antenna, zone_samples
from .config import BANDS, BIRD, DEFAULT_OPERATOR, DRONES, Params, processing_gain_db
from .geo import C, polygon_perimeter_points
from .lte import SLOT_S, Carrier
from .rf import (Illuminator, Listener, bistatic_doppler, bistatic_range, db, direct_power_re_dbw,
                 echo_power_re_dbw, quantisation_re_dbw, rcs_at, re_power_dbw, sector_gain_db,
                 thermal_re_dbw, undb)


def _hash_unit(s: str) -> float:
    """Deterministic number in [0, 1) from a string (stable across runs and machines)."""
    return int(hashlib.sha256(s.encode()).hexdigest()[:8], 16) / 2 ** 32


class FlatSite:
    """Flat, open ground for reproducing field trials (no buildings, no terrain)."""

    name = "flat field"
    fence = np.array([[-50.0, -50], [50, -50], [50, 50], [-50, 50], [-50, -50]])
    buildings: list = []
    towers: list = []

    def ground(self, x, y):
        return np.zeros(np.broadcast(np.asarray(x), np.asarray(y)).shape)

    surface = ground

    def in_zone(self, x, y, buffer_m):
        return np.ones(np.broadcast(np.asarray(x), np.asarray(y)).shape, dtype=bool)


# ---------------------------------------------------------------------------
# Illuminators and listeners
# ---------------------------------------------------------------------------
def candidate_illuminators(site, p: Params) -> list[Illuminator]:
    """One illuminator per (tower, carrier). Sector azimuth: the facility lies within +/-60 degrees of
    a sector boresight; the exact offset is unknown, so it is drawn deterministically per tower (ASSUMPTION)."""
    out = []
    for t in site.towers:
        if not t.get("likely_cellular") or t["distance_m"] > p.max_tower_km * 1000:
            continue
        ground = float(site.ground(t["x"], t["y"]))
        h = (t["height_agl_m"] or 30.0) * p.antenna_height_fraction
        pos = np.array([t["x"], t["y"], ground + h])
        bearing_to_site = np.degrees(np.arctan2(-t["x"], -t["y"])) % 360
        for op in (t.get("carriers") or [DEFAULT_OPERATOR]):
            band = BANDS.get(op)
            if band is None:
                continue
            u = _hash_unit(f"{t['id']}:{op}")
            carrier = Carrier(band["freq_hz"], band["bw_mhz"], cell_id=int(u * 504))
            out.append(Illuminator(
                id=f"{t['id']}:{op}", label=f"{op} @ {t['owner'][:22]} ({t['distance_m'] / 1000:.1f} km)",
                operator=op, carrier=carrier, pos=pos, eirp_dbw=p.eirp_dbw,
                azimuth_deg=(bearing_to_site + (u - 0.5) * 120) % 360, downtilt_deg=p.downtilt_deg, tower=t))
    return out


def place_listeners(site, p: Params, cands: list | None = None) -> list[Listener]:
    """Nodes spread evenly along the fence, on poles (p.mount = "pole") or on the structure ("structure", e.g.
    stadium stands; "mixed" alternates). Each faces the middle of the facility, or with
    pointing = "auto" is turned (up to +/-90 deg) to maximise its own detections over the zone."""
    pts = polygon_perimeter_points(site.fence, p.n_listeners)
    c = np.asarray(site.fence)[:-1].mean(axis=0)
    out = []
    zs = zone_samples(site, p.zone_buffer_m, p.altitude_agl_m) if p.pointing == "auto" and cands else None
    for i, (x, y) in enumerate(pts):
        u = np.array([x, y]) - c
        u = u / max(float(np.hypot(*u)), 1e-9)  # outward, away from the middle
        mode = p.mount if p.mount != "mixed" else ("structure" if i % 2 == 0 else "pole")
        if mode == "structure":  # on top of the building at the perimeter (stadium stands)
            x, y = np.array([x, y]) - u * p.structure_inset_m
            zz = float(site.surface(x, y)) + p.roof_mast_m
        else:
            x, y = np.array([x, y]) + u * p.setback_m
            zz = float(site.ground(x, y)) + p.mast_m
        pos = np.array([x, y, zz])
        az = inward_azimuth(site, pos)
        if zs is not None and p.antenna not in ("iso", "omni"):
            az = _auto_azimuth(site, p, pos, az, cands, zs)
        out.append(Listener(f"L{i + 1}", pos, node_antenna(p, az)))
    return out


def _auto_azimuth(site, p: Params, pos, base_az, cands, zs) -> float:
    """Pointing that maximises sum over zone points of min(cells detecting it, 3) for this node alone.
    Trades gain toward the zone against keeping strong towers behind the antenna."""
    from .coverage import HANN_LOSS_DB, albersheim_db
    m = DRONES[p.drone]
    thr = albersheim_db(0.9, p.pfa)
    L = int(round(p.cit_s / SLOT_S))
    loss = p.resolved_loss_db()
    tower_pos = np.array([c.pos for c in cands])
    D0 = np.array([float(direct_power_re_dbw(site, c, pos, 0.0, p.ground_gamma)[0]) for c in cands])
    pw0 = np.array([echo_power_re_dbw(site, c, pos, zs, rcs_at(m.rcs_m2, m.size_m, c.carrier.freq_hz), 0.0,
                                      p.ground_gamma, loss)[0] + 10 * np.log10(c.carrier.n_re * L) - HANN_LOSS_DB
                    for c in cands])  # (C, N) echo before antenna gain and noise
    best, best_s = base_az, -1.0
    for off in np.arange(-AUTO_SWING_DEG, AUTO_SWING_DEG + 1e-6, AUTO_STEP_DEG):
        ant = node_antenna(p, base_az + off)
        noise = _node_noise(p, cands, D0, ant, pos, tower_pos)  # [face][cand] dicts
        g = np.array([ant.gain_db(e, pos, zs) for e in range(len(ant.faces))])  # (E, N)
        n = np.array([[nb["total"] for nb in face] for face in noise])  # (E, C)
        snr = (pw0[None, :, :] + g[:, None, :] - n[:, :, None]).max(axis=0)  # (C, N)
        s = np.minimum((snr >= thr).sum(axis=0), 3).sum() + 1e-3 * np.mean(snr.max(axis=0))
        if s > best_s:
            best, best_s = base_az + off, s
    return float(best % 360)


def antenna_of(p: Params, rx: Listener) -> NodeAntenna:
    """A listener's antenna; listeners built by hand (field trials) use the v0.2 isotropic gain."""
    if rx.antenna is not None:
        return rx.antenna
    return NodeAntenna("iso", [0.0], 10 * np.log10(max(p.rx_elements, 1)), p.rx_gain_dbi)


# ---------------------------------------------------------------------------
# Targets
# ---------------------------------------------------------------------------
@dataclass
class Trajectory:
    """Piecewise-linear path in x/y at a fixed height above ground, with an optional hover."""
    waypoints: np.ndarray  # (n, 2)
    speed: float
    agl: float
    hover_at: int = -1  # waypoint index to hover at (-1: none)
    hover_s: float = 0.0
    loop: bool = False

    def __post_init__(self):
        self.waypoints = np.asarray(self.waypoints, dtype=float)
        segs, t = [], 0.0  # (t0, t1, p0, p1)
        for i in range(len(self.waypoints) - 1):
            p0, p1 = self.waypoints[i], self.waypoints[i + 1]
            if i == self.hover_at and self.hover_s > 0:
                segs.append((t, t + self.hover_s, p0, p0))
                t += self.hover_s
            dt = np.linalg.norm(p1 - p0) / self.speed
            segs.append((t, t + dt, p0, p1))
            t += dt
        self._segs = segs

    @property
    def duration(self):
        return self._segs[-1][1]

    def xy_v(self, t):
        t = t % self.duration if self.loop else float(np.clip(t, 0, self.duration))
        for t0, t1, p0, p1 in self._segs:
            if t <= t1:
                break
        span = t1 - t0
        f = (t - t0) / span if span > 0 else 0.0
        v = (p1 - p0) / span if span > 0 else np.zeros(2)
        return p0 + f * (p1 - p0), v

    def state(self, site, t, dt=0.5):
        xy, v = self.xy_v(t)
        z = float(site.ground(xy[0], xy[1])) + self.agl
        if np.allclose(v, 0):
            return np.array([xy[0], xy[1], z]), np.zeros(3)
        xy2 = xy + v * dt
        vz = (float(site.ground(xy2[0], xy2[1])) + self.agl - z) / dt
        return np.array([xy[0], xy[1], z]), np.array([v[0], v[1], vz])


@dataclass
class Target:
    kind: str  # "drone" or "bird"
    traj: Trajectory
    rcs_m2: float
    size_m: float
    model: object = None


# ---------------------------------------------------------------------------
# Scene: everything that stays fixed during a run
# ---------------------------------------------------------------------------
@dataclass
class Pair:
    """One illuminator-listener pair. A node with fan-mode antennas has several separately processed
    faces; every per-face quantity has a leading face axis (length 1 otherwise)."""
    ill: Illuminator
    rx: Listener
    noise_re_dbw: np.ndarray  # (E,) noise per RE after array and processing gain
    noise_parts: list  # (E,) dicts: thermal, quantisation, residue, cochannel, direct
    static_vec: np.ndarray  # (E, K) direct path + static clutter, normalised to noise
    veg_delays: np.ndarray
    veg_amps: np.ndarray  # (E, P) complex, normalised
    veg_dopplers: np.ndarray  # (P, 3)
    veg_phases: np.ndarray  # (P, 3)
    dnr_db: np.ndarray  # (E,) direct-path-to-noise ratio per RE

    @property
    def n_faces(self):
        return len(self.noise_re_dbw)


@dataclass
class Scene:
    site: object
    params: Params
    loss_db: float
    illuminators: list
    all_illuminators: list
    listeners: list
    targets: list
    pairs: list = field(default_factory=list)
    clutter_pts: np.ndarray | None = None
    clutter_rcs: np.ndarray | None = None
    clutter_moving: np.ndarray | None = None

    @property
    def L(self):  # slow-time samples per CIT (one CRS symbol per slot)
        return int(round(self.params.cit_s / SLOT_S))


RING_REFLECTORS = 12  # a ring-shaped building (stadium stands around a field) is spread over this many points
RING_MIN_AREA_M2 = 20000.0  # only stadium-sized rings; courtyard buildings keep the one-point rule


def building_reflectors(site):
    """Static building echoes as point reflectors: (points (N, 3), rcs (N,)). One point per building at its
    centre, 70 % up (RCS = 0.1 m2 per m2 of footprint, 5-300 m2, ASSUMPTION: walls/roofs). A stadium-sized building
    with holes (stands around a field) gets RING_REFLECTORS points around the middle of the ring instead, each 300 m2
    (ASSUMPTION), so its echo is not placed over the open field."""
    pts, rcs = [], []
    for b in site.buildings:
        poly = np.array(b["poly"])
        if b.get("holes") and b.get("area_m2", 0) >= RING_MIN_AREA_M2:
            inner = np.array(max(b["holes"], key=len))
            for q in polygon_perimeter_points(poly, RING_REFLECTORS):
                k = np.argmin(np.hypot(inner[:, 0] - q[0], inner[:, 1] - q[1]))
                cx, cy = (q + inner[k]) / 2
                pts.append([cx, cy, float(site.ground(cx, cy)) + b["height_m"] * 0.7])
                rcs.append(300.0)
            continue
        cx, cy = poly[:-1].mean(axis=0)
        pts.append([cx, cy, float(site.ground(cx, cy)) + b["height_m"] * 0.7])
        rcs.append(np.clip(0.1 * b.get("area_m2", 100), 5, 300))  # ASSUMPTION: walls/roofs
    return pts, rcs


def _clutter(site, p: Params, rng):
    pts, rcs = building_reflectors(site)
    nb = len(pts)
    n = 60
    r = 2500 * np.sqrt(rng.random(n))
    a = rng.random(n) * 2 * np.pi
    x, y = r * np.sin(a), r * np.cos(a)
    for xx, yy in zip(x, y):
        pts.append([xx, yy, float(site.ground(xx, yy)) + 3])
        rcs.append(0.01 * 2500)  # sigma0 = -20 dB over a 50 m x 50 m patch (ASSUMPTION)
    pts, rcs = np.array(pts), np.array(rcs)
    moving = np.zeros(len(pts), dtype=bool)
    moving[nb:] = rng.random(len(pts) - nb) < p.vegetation_fraction  # wind-blown trees
    return pts, rcs, moving


def noise_budget(site, p: Params, cands, lis):
    """Per (candidate illuminator, listener): direct power and noise per RE (dBW).

    Noise = thermal
          + ADC quantisation (all same-band signals load the ADC)
          + cancellation residue: real direct-path removal is imperfect; what is left behaves like
            noise sitting dpi_residual_db below the direct signal (calibrated)
          + co-channel leakage: neighbouring cells on the same carrier put their data on this cell's
            CRS positions; scales with network load, reduced by co-channel suppression (ASSUMPTIONS).

    Each face of a node is its own receiver channel: the direct signals it sees depend on where its
    antenna points (the back of the antenna attenuates towers behind it). Array gain and processing
    gain then lower every term (ASSUMPTION: ideal).
    """
    tower_pos = np.array([c.pos for c in cands])
    out = {}
    for k, l in enumerate(lis):
        D0 = np.array([float(direct_power_re_dbw(site, c, l.pos, 0.0, p.ground_gamma)[0]) for c in cands])
        for e, face in enumerate(_node_noise(p, cands, D0, antenna_of(p, l), l.pos, tower_pos)):
            for i, nb in enumerate(face):
                out.setdefault((i, k), []).append(nb)
    return out


def _node_noise(p: Params, cands, D0, ant: NodeAntenna, pos, tower_pos) -> list:
    """Noise budget of one node: [face][candidate] -> dict of terms (dBW per RE). D0: direct power of
    each candidate at the node before the receive antenna."""
    n_th = thermal_re_dbw(p.nf_db)
    s_dpi = p.resolved_dpi_db()
    g_proc = processing_gain_db(p.processing, p.network_load)
    freqs = np.array([c.carrier.freq_hz for c in cands])
    out = []
    for e in range(len(ant.faces)):
        D = D0 + ant.gain_db(e, pos, tower_pos)
        face = []
        for i, c in enumerate(cands):
            same = np.nonzero(freqs == c.carrier.freq_hz)[0]
            total_in = db(np.sum(undb(D[same]) * np.array([cands[j].carrier.n_subcarriers for j in same])))
            n_q = quantisation_re_dbw(total_in, p.adc_bits, p.adc_backoff_db, c.carrier.fs)
            load = (np.sum(undb(D[same])) - undb(D[i])) * p.network_load
            n_cc = (db(load) - p.cochannel_suppression_db) if load > 0 else -400.0
            n_dpi = D[i] - s_dpi
            n_re = db(undb(n_th) + undb(n_q) + undb(n_cc) + undb(n_dpi)) - ant.array_gain_db - g_proc
            face.append({"thermal": float(n_th), "quantisation": float(n_q), "residue": float(n_dpi),
                         "cochannel": float(n_cc), "direct": float(D[i]), "total": float(n_re)})
        out.append(face)
    return out


def face_gains(p: Params, rx: Listener, pts: np.ndarray) -> np.ndarray:
    """(E, N) receive gain of each face of a node toward each point."""
    ant = antenna_of(p, rx)
    return np.array([ant.gain_db(e, rx.pos, pts) for e in range(len(ant.faces))])


def best_face(scene, pair: Pair, pos: np.ndarray) -> int:
    """Face that sees a point best (highest gain over that face's noise)."""
    if pair.n_faces == 1:
        return 0
    g = face_gains(scene.params, pair.rx, pos[None, :])[:, 0]
    return int(np.argmax(g - pair.noise_re_dbw))


def build_scene(site, p: Params, targets: list[Target], illuminators: list | None = None,
                listeners: list | None = None) -> Scene:
    rng = np.random.default_rng(p.seed)
    loss = p.resolved_loss_db()
    cands = illuminators if illuminators is not None else candidate_illuminators(site, p)
    lis = listeners if listeners is not None else place_listeners(site, p, cands)
    budget = noise_budget(site, p, cands, lis)
    centre = np.array([0.0, 0.0, float(site.ground(0, 0)) + p.altitude_agl_m])
    if illuminators is None:
        # Rank cells by echo-to-noise from a target over the facility, at the median listener
        # (best face of each node).
        scores = []
        for i, ill in enumerate(cands):
            e = []
            for k, l in enumerate(lis):
                g = face_gains(p, l, centre[None, :])[:, 0]
                pw = echo_power_re_dbw(site, ill, l.pos, centre, 1.0, 0.0, p.ground_gamma, 0)[0][0]
                e.append(max(pw + g[f] - nb["total"] for f, nb in enumerate(budget[i, k])))
            scores.append(np.median(e))
        order = list(np.argsort(scores)[::-1][: p.max_illuminators])
    else:
        order = list(range(len(cands)))
    chosen = [cands[i] for i in order]
    scene = Scene(site, p, loss, chosen, cands, lis, targets)
    scene.clutter_pts, scene.clutter_rcs, scene.clutter_moving = _clutter(site, p, rng)

    cp, cr = scene.clutter_pts, scene.clutter_rcs
    st, mv = ~scene.clutter_moving, scene.clutter_moving
    for i in order:
        ill = cands[i]
        fk = ill.carrier.re_freqs(0)
        for k, rx in enumerate(lis):
            faces = budget[i, k]
            n_re = np.array([nb["total"] for nb in faces])
            pc0, _, _ = echo_power_re_dbw(site, ill, rx.pos, cp, cr, 0.0, p.ground_gamma, 0.0)
            gains = face_gains(p, rx, cp)  # (E, P) antenna gain toward each clutter point
            tau = bistatic_range(ill.pos, rx.pos, cp) / C
            phase = np.exp(2j * np.pi * rng.random(len(cp)))
            steer = np.exp(-2j * np.pi * np.outer(fk, tau[st]))
            statics, vegs = [], []
            for e, nb in enumerate(faces):
                # Direct path + static clutter, normalised to this face's noise.
                a_c = np.sqrt(undb(pc0 + gains[e] - n_re[e])) * phase
                statics.append(np.sqrt(undb(nb["direct"] - n_re[e])) * np.ones(len(fk), dtype=complex) + steer @ a_c[st])
                vegs.append(a_c[mv])
            scene.pairs.append(Pair(
                ill=ill, rx=rx, noise_re_dbw=n_re,
                noise_parts=[{kk: v for kk, v in nb.items() if kk != "total"} for nb in faces],
                static_vec=np.array(statics), veg_delays=tau[mv], veg_amps=np.array(vegs),
                veg_dopplers=rng.normal(0, p.vegetation_spread_hz, (mv.sum(), 3)),
                veg_phases=rng.random((mv.sum(), 3)) * 2 * np.pi,
                dnr_db=np.array([nb["direct"] for nb in faces]) - n_re))
    return scene


def target_paths(scene: Scene, pair: Pair, t_mid: float, rng, face: int = 0):
    """Moving scatterers for one pair over one CIT, as received on one face of the node:
    delays (P,), and slow-time phasors (P, L)."""
    p, site = scene.params, scene.site
    L = scene.L
    tl = (np.arange(L) - L / 2) * SLOT_S  # slow time relative to frame centre
    lam = C / pair.ill.carrier.freq_hz
    delays, rows, truth = [], [], []
    for tg in scene.targets:
        pos, vel = tg.traj.state(site, t_mid)
        rcs = rcs_at(tg.rcs_m2, tg.size_m, pair.ill.carrier.freq_hz)
        g_rx = face_gains(p, pair.rx, pos[None, :])[face]
        pw, _, _ = echo_power_re_dbw(site, pair.ill, pair.rx.pos, pos, rcs, g_rx, p.ground_gamma, scene.loss_db)
        a = np.sqrt(undb(pw[0] - pair.noise_re_dbw[face]))
        tau = bistatic_range(pair.ill.pos, pair.rx.pos, pos) / C
        nu = bistatic_doppler(pair.ill.pos, pair.rx.pos, pos, vel, pair.ill.carrier.freq_hz)
        ut = (pos - pair.ill.pos) / np.linalg.norm(pos - pair.ill.pos)
        ur = (pos - pair.rx.pos) / np.linalg.norm(pos - pair.rx.pos)
        u = ut + ur  # path-length sensitivity to a small displacement of the scatterer
        phi0 = rng.random() * 2 * np.pi
        body = 2 * np.pi * nu * tl + phi0
        truth.append({"kind": tg.kind, "pos": pos, "vel": vel, "range": tau * C, "doppler": nu,
                      "echo_snr_re_db": float(pw[0] - pair.noise_re_dbw[face]), "face": face})
        if tg.kind == "drone":
            m = tg.model
            rows.append(a * np.exp(1j * body))
            delays.append(tau)
            ab = a * np.sqrt(m.blade_rcs_fraction / (m.rotors * m.blades))
            for r in range(m.rotors):
                spin = 1 if r % 2 == 0 else -1
                th0 = rng.random() * 2 * np.pi
                for b in range(m.blades):
                    ang = spin * 2 * np.pi * m.rotor_hz * tl + th0 + 2 * np.pi * b / m.blades
                    tip = m.rotor_radius_m * np.stack([np.cos(ang), np.sin(ang), np.zeros_like(ang)], axis=1)
                    rows.append(ab * np.exp(1j * (body - 2 * np.pi / lam * (tip @ u))))
                    delays.append(tau)
        else:  # bird: flapping modulates the echo and moves the wings up and down
            wb = BIRD.wingbeat_hz
            mod = 1 + 0.4 * np.sin(2 * np.pi * wb * tl + phi0)
            rows.append(a * mod * np.exp(1j * body))
            delays.append(tau)
            aw = a * np.sqrt(BIRD.wing_rcs_fraction / 2)
            for side in (-1, 1):
                z = 0.12 * np.sin(2 * np.pi * wb * tl)[:, None] * np.array([0.0, 0.0, 1.0])[None, :]
                rows.append(aw * np.exp(1j * (body - 2 * np.pi / lam * (z @ u) + side)))
                delays.append(tau)
    if not rows:
        return np.zeros(0), np.zeros((0, L), complex), truth
    return np.array(delays), np.array(rows), truth


# ---------------------------------------------------------------------------
# Scenario helpers
# ---------------------------------------------------------------------------
def drone_target(p: Params, traj: Trajectory) -> Target:
    m = DRONES[p.drone]
    return Target("drone", traj, m.rcs_m2, m.size_m, m)


def bird_target(traj: Trajectory) -> Target:
    return Target("bird", traj, BIRD.rcs_m2, BIRD.size_m, BIRD)
