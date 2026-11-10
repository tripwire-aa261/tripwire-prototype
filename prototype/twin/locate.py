"""Multistatic localisation and tracking.

Each detection on an illuminator-listener pair says "the target lies on an ellipsoid with foci at the
tower and the listener" (constant bistatic range). Several pairs intersect at the target.

1. Grid search: count, at every candidate point (x, y, height above ground), how many pairs have a
   detection whose bistatic range matches within a gate. The best point needs >= 3 pairs.
2. Gauss-Newton refinement on the matched ranges (with a weak height prior: listeners near the ground
   see height poorly).
3. Velocity from the matched bistatic Dopplers by least squares. A real target's Dopplers on all pairs
   agree with one velocity at drone-like speed; coincidences of false alarms imply hundreds of m/s or
   inconsistent Dopplers, so such fixes are rejected. At least two different listeners are required.
4. Repeat on the leftover detections for further targets.
5. Constant-velocity Kalman tracker with M-of-N confirmation.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .geo import C


@dataclass
class PairMeas:
    tx: np.ndarray
    rx: np.ndarray
    lam: float
    range_res: float
    dets: list  # Detection objects
    pair_index: int


@dataclass
class Fix:
    pos: np.ndarray
    vel: np.ndarray
    n_pairs: int
    residual_m: float
    matched: list  # (pair_index, detection)
    microdoppler_db: float
    doppler_rms_hz: float = 0.0


MAX_SPEED_MPS = 40.0  # ASSUMPTION: faster than any small multirotor
MAX_DOPPLER_RMS_HZ = 4.0  # allowed Doppler misfit when >= 4 pairs over-determine the velocity


class Locator:
    def __init__(self, site, half_m=1600.0, step_m=20.0, agl=(30.0, 60.0, 90.0, 120.0)):
        xs = np.arange(-half_m, half_m + 1e-6, step_m)
        X, Y = np.meshgrid(xs, xs)
        G = site.ground(X, Y)
        self.site = site
        self.agl = np.array(agl)
        self.P = np.stack([np.stack([X, Y, G + a], axis=-1) for a in agl])  # (A, n, n, 3)
        self._cache = {}

    def _pred(self, m: PairMeas):
        key = m.pair_index
        if key not in self._cache:
            P = self.P
            self._cache[key] = (np.linalg.norm(P - m.tx, axis=-1) + np.linalg.norm(P - m.rx, axis=-1)
                                - np.linalg.norm(m.rx - m.tx))
        return self._cache[key]

    def locate(self, meas: list[PairMeas], max_targets=3, min_pairs=3) -> list[Fix]:
        fixes = []
        used = {m.pair_index: set() for m in meas}
        for _ in range(max_targets):
            count = np.zeros(self.P.shape[:3])
            for m in meas:
                rs = [d.range_m for i, d in enumerate(m.dets) if i not in used[m.pair_index]]
                if not rs:
                    continue
                pred = self._pred(m)
                gate = 0.75 * m.range_res
                hit = np.zeros(pred.shape, dtype=bool)
                for r in rs:
                    hit |= np.abs(pred - r) < gate
                count += hit
            best = count.max()
            if best < min_pairs:
                break
            cand = np.argwhere(count == best)
            p0 = self.P[tuple(cand[len(cand) // 2])]
            fix = self._refine(meas, used, p0)
            if fix is None or fix.n_pairs < min_pairs:
                break
            # Consume every detection at this point's range on every pair (body and rotor-blade lines),
            # so the next search looks elsewhere instead of re-finding the same target.
            for m in meas:
                pred = np.linalg.norm(fix.pos - m.tx) + np.linalg.norm(fix.pos - m.rx) - np.linalg.norm(m.rx - m.tx)
                used[m.pair_index] |= {i for i, d in enumerate(m.dets) if abs(d.range_m - pred) < 1.2 * m.range_res}
            for pi, di in fix.matched:
                used[pi].add(di)
            if self._plausible(fix, meas):
                fixes.append(fix)
        return fixes

    def _refine(self, meas, used, p0, iters=6):
        p = p0.astype(float).copy()
        z_prior = p0[2]
        for _ in range(iters):
            rows, res, w, matched = [], [], [], []
            for m in meas:
                pred = np.linalg.norm(p - m.tx) + np.linalg.norm(p - m.rx) - np.linalg.norm(m.rx - m.tx)
                best, bi = None, None
                for i, d in enumerate(m.dets):
                    if i in used[m.pair_index]:
                        continue
                    e = d.range_m - pred
                    if abs(e) < 1.2 * m.range_res and (best is None or abs(e) < abs(best)):
                        best, bi = e, i
                if best is None:
                    continue
                g = (p - m.tx) / np.linalg.norm(p - m.tx) + (p - m.rx) / np.linalg.norm(p - m.rx)
                rows.append(g)
                res.append(best)
                w.append(1.0 / (0.3 * m.range_res) ** 2)
                matched.append((m.pair_index, bi))
            if len(rows) < 3:
                return None
            A = np.array(rows) * np.sqrt(w)[:, None]
            b = np.array(res) * np.sqrt(w)
            # Weak prior on height (sigma 40 m) keeps the problem well posed.
            A = np.vstack([A, [0, 0, 1 / 40.0]])
            b = np.append(b, (z_prior - p[2]) / 40.0)
            dp, *_ = np.linalg.lstsq(A, b, rcond=None)
            p += dp
            if np.linalg.norm(dp) < 0.5:
                break
        resid = float(np.sqrt(np.mean(np.square(res))))
        # Velocity from bistatic Dopplers. Each pair may have several detections at this range (the body
        # and rotor-blade flashes hundreds of Hz away), so pick per pair the detection that agrees with one
        # common velocity, found by random sample consensus (RANSAC) over the pairs.
        by_pair = {m.pair_index: m for m in meas}
        rows, cands = {}, {}
        for m in meas:
            pred = np.linalg.norm(p - m.tx) + np.linalg.norm(p - m.rx) - np.linalg.norm(m.rx - m.tx)
            c = [i for i, d in enumerate(m.dets) if i not in used[m.pair_index] and abs(d.range_m - pred) < 1.2 * m.range_res]
            if c:
                ut = (p - m.tx) / np.linalg.norm(p - m.tx)
                ur = (p - m.rx) / np.linalg.norm(p - m.rx)
                rows[m.pair_index] = -(ut + ur) / m.lam
                cands[m.pair_index] = c
        pis = list(rows)
        if len(pis) < 3:
            return None
        rng = np.random.default_rng(len(pis))

        def solve(sel):
            sel = [(pi, di) for pi, di in sel if pi in rows]  # pairs without a usable detection add nothing
            A = np.array([rows[pi] for pi, _ in sel] + [[0, 0, 3.0]])  # prefer level flight
            b = np.array([by_pair[pi].dets[di].doppler_hz for pi, di in sel] + [0.0])
            return np.linalg.lstsq(A, b, rcond=None)[0]

        def assign(v):
            out = []
            for pi in pis:
                di = min(cands[pi], key=lambda i: abs(rows[pi] @ v - by_pair[pi].dets[i].doppler_hz))
                out.append((pi, di, abs(rows[pi] @ v - by_pair[pi].dets[di].doppler_hz)))
            return out

        tol = 2.5 * MAX_DOPPLER_RMS_HZ
        best = None
        for _ in range(60):
            trial = [(pi, cands[pi][rng.integers(len(cands[pi]))]) for pi in rng.choice(pis, 3, replace=False)]
            v = solve(trial)
            if np.hypot(v[0], v[1]) > MAX_SPEED_MPS:
                continue
            inl = [(pi, di) for pi, di, e in assign(v) if e < tol]
            if best is None or len(inl) > len(best):
                best = inl
        if not best or len(best) < 3:
            # No consistent velocity: report the range-only match so the caller can reject it.
            v = solve(matched)
            A = np.array([rows.get(pi, np.zeros(3)) for pi, _ in matched])
            b = np.array([by_pair[pi].dets[di].doppler_hz for pi, di in matched])
            md = max(by_pair[pi].dets[di].microdoppler_db for pi, di in matched)
            return Fix(p, v, len(matched), resid, matched, md, float(np.sqrt(np.mean((A @ v - b) ** 2))))
        v = solve(best)
        final = [(pi, di) for pi, di, e in assign(v) if e < tol]
        v = solve(final)
        A = np.array([rows[pi] for pi, _ in final])
        b = np.array([by_pair[pi].dets[di].doppler_hz for pi, di in final])
        dop_rms = float(np.sqrt(np.mean((A @ v - b) ** 2)))
        md = max(by_pair[pi].dets[di].microdoppler_db for pi, di in final)
        return Fix(p, v, len(final), resid, final, md, dop_rms)

    @staticmethod
    def _plausible(fix: "Fix", meas) -> bool:
        by_pair = {m.pair_index: m for m in meas}
        listeners = {tuple(np.round(by_pair[pi].rx, 1)) for pi, _ in fix.matched}
        if len(listeners) < 2 or fix.n_pairs < 3:
            return False
        if np.hypot(fix.vel[0], fix.vel[1]) > MAX_SPEED_MPS:
            return False
        return fix.doppler_rms_hz <= MAX_DOPPLER_RMS_HZ or fix.n_pairs < 4


# ---------------------------------------------------------------------------
# Tracking
# ---------------------------------------------------------------------------
@dataclass
class Track:
    id: int
    x: np.ndarray  # (6,) position, velocity
    P: np.ndarray
    hits: list = field(default_factory=list)  # 1/0 per frame
    misses: int = 0
    confirmed: bool = False
    md_scores: list = field(default_factory=list)
    history: list = field(default_factory=list)

    @property
    def label(self):
        if not self.md_scores:
            return "unknown"
        return "drone (rotor signature)" if max(self.md_scores) > 6.0 else "no rotor signature"


MERGE_M = 40.0


class Tracker:
    def __init__(self, q=1.5, sigma_xy=15.0, sigma_z=40.0, gate=4.0):
        self.tracks: list[Track] = []
        self.q, self.sxy, self.sz, self.gate = q, sigma_xy, sigma_z, gate
        self._next = 1

    def _F(self, dt):
        F = np.eye(6)
        F[:3, 3:] = np.eye(3) * dt
        return F

    def _Q(self, dt):
        q = self.q ** 2
        Q = np.zeros((6, 6))
        for i in range(3):
            Q[i, i] = q * dt ** 4 / 4
            Q[i, i + 3] = Q[i + 3, i] = q * dt ** 3 / 2
            Q[i + 3, i + 3] = q * dt ** 2
        return Q

    def step(self, fixes: list[Fix], dt: float, t: float):
        H = np.hstack([np.eye(3), np.zeros((3, 3))])
        R = np.diag([self.sxy ** 2, self.sxy ** 2, self.sz ** 2])
        for tr in self.tracks:
            F = self._F(dt)
            tr.x = F @ tr.x
            tr.P = F @ tr.P @ F.T + self._Q(dt)
        unused = list(range(len(fixes)))
        for tr in sorted(self.tracks, key=lambda t: -sum(t.hits)):
            best, bj = None, None
            S = H @ tr.P @ H.T + R
            Si = np.linalg.inv(S)
            for j in unused:
                y = fixes[j].pos - H @ tr.x
                d2 = float(y @ Si @ y)
                if d2 < self.gate ** 2 and (best is None or d2 < best):
                    best, bj = d2, j
            if bj is None:
                tr.hits.append(0)
                tr.misses += 1
                continue
            f = fixes[bj]
            unused.remove(bj)
            y = f.pos - H @ tr.x
            K = tr.P @ H.T @ np.linalg.inv(H @ tr.P @ H.T + R)
            tr.x = tr.x + K @ y
            tr.P = (np.eye(6) - K @ H) @ tr.P
            tr.hits.append(1)
            tr.misses = 0
            tr.md_scores.append(f.microdoppler_db)
            if sum(tr.hits[-3:]) >= 2:
                tr.confirmed = True
        for j in unused:
            f = fixes[j]
            x = np.concatenate([f.pos, f.vel])
            P = np.diag([self.sxy ** 2, self.sxy ** 2, self.sz ** 2, 10.0 ** 2, 10.0 ** 2, 3.0 ** 2])
            self.tracks.append(Track(self._next, x, P, hits=[1], md_scores=[f.microdoppler_db]))
            self._next += 1
        self.tracks = [tr for tr in self.tracks if tr.misses < 3]
        # Merge duplicates: two tracks on the same object (within MERGE_M) -> keep the older one.
        keep = []
        for tr in sorted(self.tracks, key=lambda t: t.id):
            if all(np.hypot(*(tr.x[:2] - k.x[:2])) > MERGE_M for k in keep):
                keep.append(tr)
        self.tracks = keep
        for tr in self.tracks:
            tr.history.append((t, tr.x[:3].copy(), tr.confirmed))
        return [tr for tr in self.tracks if tr.confirmed]
