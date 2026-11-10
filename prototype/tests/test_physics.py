"""Physics and signal-processing checks. Run from prototype/:  .venv/bin/python -m pytest -q"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from twin import env
from twin.config import CAL_PATH, DRONES, Params
from twin.geo import C, LocalFrame, Site, bullington_loss_db, distance_to_polygon, knife_edge_j, two_ray_gain_db
from twin.locate import Locator, PairMeas, Tracker
from twin.lte import Carrier, crs_subcarriers, gold_sequence, ofdm_demod, ofdm_symbol_time
from twin.processing import Detection, cfar_detect, dpc_svd, range_doppler
from twin.rf import (FOUR_PI, Illuminator, adc_sqnr_db, bistatic_doppler, bistatic_range, echo_power_re_dbw,
                     re_power_dbw, undb)
from twin.scene import FlatSite, Trajectory

ROOT = Path(__file__).resolve().parent.parent
HAYS = ROOT / "data" / "sites" / "hays-state-prison"


# ---------------------------------------------------------------------------
# LTE signals (3GPP TS 36.211)
# ---------------------------------------------------------------------------
def test_gold_sequence_matches_spec_recurrence():
    # With c_init = 0 the second m-sequence is all zeros, so c(n) = x1(n + 1600).
    x1 = [1] + [0] * 30
    for n in range(1600 + 64):
        x1.append(x1[n + 3] ^ x1[n])
    assert gold_sequence(0, 64).tolist() == x1[1600:1664]
    c = gold_sequence(12345, 20000)
    assert 0.48 < c.mean() < 0.52  # balanced


def test_crs_mapping_every_sixth_subcarrier_with_cell_shift():
    for cell in (0, 1, 5, 101):
        k0 = crs_subcarriers(cell, 50, 0)
        k4 = crs_subcarriers(cell, 50, 4)
        assert len(k0) == 100 and np.all(np.diff(k0) == 6)
        assert k0[0] == cell % 6 and k4[0] == (3 + cell % 6) % 6


def test_crs_symbols_are_unit_qpsk():
    r = Carrier(751e6, 10, cell_id=42).re_symbols(ns=3)
    assert np.allclose(np.abs(r), 1.0)
    assert set(np.round(r.real * np.sqrt(2)).astype(int)) <= {-1, 1}


def test_frequency_domain_model_matches_full_ofdm_simulation():
    """The simulator's model Y_k = a e^{-j2 pi f_k tau} e^{j phi} (paper eq. 7-8) against a real OFDM symbol
    (all subcarriers loaded) delayed and Doppler-shifted sample by sample, then demodulated."""
    car = Carrier(751e6, 10, cell_id=7)
    rng = np.random.default_rng(0)
    grid = (rng.choice([-1, 1], car.n_subcarriers) + 1j * rng.choice([-1, 1], car.n_subcarriers)) / np.sqrt(2)
    cp = 72
    x = ofdm_symbol_time(car, grid, cp)
    d, nu = 9, 35.0  # 9-sample delay (~176 m bistatic), 35 Hz Doppler
    y = np.concatenate([np.zeros(d), x[:-d]]) * np.exp(2j * np.pi * nu * np.arange(len(x)) / car.fs)
    rx = ofdm_demod(car, y, cp)
    half = 6 * car.n_rb
    k = np.arange(car.n_subcarriers)
    f = np.where(k < half, k - half, k - half + 1) * 15e3
    tau = d / car.fs
    model = grid * np.exp(-2j * np.pi * f * tau) * np.exp(2j * np.pi * nu * (cp + car.n_fft / 2) / car.fs)
    err = np.linalg.norm(rx - model) / np.linalg.norm(model)
    assert err < 0.02, err


# ---------------------------------------------------------------------------
# Propagation
# ---------------------------------------------------------------------------
def test_knife_edge_values_from_itu_p526():
    assert knife_edge_j(0.0) == pytest.approx(6.0, abs=0.1)  # grazing incidence: ~6 dB
    assert knife_edge_j(-0.78) == 0.0
    assert knife_edge_j(2.4) == pytest.approx(20.6, abs=0.3)  # large nu: ~13 + 20 log nu


def test_bullington_clear_path_and_ridge():
    flat = lambda x, y: np.zeros_like(np.asarray(x, dtype=float))  # noqa: E731
    clear, _ = bullington_loss_db(flat, [[0, 0, 100]], [[5000, 0, 100]], 750e6)
    assert clear[0] < 0.5
    ridge = lambda x, y: np.where(np.abs(np.asarray(x) - 2500) < 100, 200.0, 0.0)  # noqa: E731
    blocked, _ = bullington_loss_db(ridge, [[0, 0, 30]], [[5000, 0, 30]], 750e6)
    assert blocked[0] > 20


def test_two_ray_bounds():
    g = two_ray_gain_db(np.full(500, 30.0), np.linspace(10, 200, 500), 2000.0, 750e6, 0.7)
    assert g.max() <= 20 * np.log10(1.7) + 1e-9 and g.min() >= 20 * np.log10(0.3) - 1e-9


def test_local_frame_round_trip_and_polygon_distance():
    fr = LocalFrame(34.5, -85.3)
    lat, lon = fr.to_latlon(1234.0, -567.0)
    x, y = fr.to_xy(lat, lon)
    assert x == pytest.approx(1234.0, abs=1e-6) and y == pytest.approx(-567.0, abs=1e-6)
    sq = np.array([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], dtype=float)
    assert distance_to_polygon(5, 5, sq) == 0.0
    assert distance_to_polygon(13, 14, sq) == pytest.approx(5.0)
    assert distance_to_polygon(np.array([5, 20]), np.array([5, 5]), sq).tolist() == [0.0, 10.0]


def test_hays_site_loads_real_data():
    s = Site(HAYS)
    assert 180 < float(s.ground(0, 0)) < 220  # valley floor ~201 m (USGS 3DEP)
    assert float(s.coarse.z.max()) > 450  # Taylor Ridge
    assert len(s.buildings) > 50 and s.bldg.z.max() > 0
    assert any(t["source"] == "FCC ASR" for t in s.towers)


# ---------------------------------------------------------------------------
# Link budget
# ---------------------------------------------------------------------------
def _flat_illuminator(freq=751e6):
    return Illuminator("t", "t", "x", Carrier(freq, 10), np.array([-2000.0, 0, 40]), 30.0, 90.0, 0.0)


def test_echo_power_is_the_bistatic_radar_equation():
    ill = _flat_illuminator()
    rx = np.array([0.0, 0, 40])
    tgt = np.array([300.0, 400, 40])  # level with tower and receiver: on-boresight, no tilt loss
    rcs = 0.05
    p, rt, rr = echo_power_re_dbw(FlatSite(), ill, rx, tgt, rcs, 5.0, 0.0, 0.0)
    lam = C / ill.carrier.freq_hz
    closed = undb(re_power_dbw(ill)) * undb(5.0) * lam ** 2 * rcs / (FOUR_PI ** 3 * rt[0] ** 2 * rr[0] ** 2)
    sector = -min(12 * (np.degrees(np.arctan2(400, 2300)) / 65) ** 2, 30)  # small azimuth offset
    assert p[0] == pytest.approx(10 * np.log10(closed) + sector, abs=0.05)


def test_adc_and_geometry_helpers():
    assert adc_sqnr_db(12, 0) == pytest.approx(74.0, abs=0.1)
    tx, rx = np.array([-1000.0, 0, 0]), np.array([0.0, 0, 0])
    p = np.array([0.0, 500, 0])
    assert bistatic_range(tx, rx, p) == pytest.approx(np.hypot(1000, 500) + 500 - 1000)
    assert bistatic_doppler(tx, rx, p, np.array([0, 10.0, 0]), 750e6) < 0  # moving away -> negative


# ---------------------------------------------------------------------------
# Processing
# ---------------------------------------------------------------------------
def _target_matrix(fk, L, r, nu, amp=1.0):
    tl = np.arange(L) * 0.5e-3
    return amp * np.outer(np.exp(-2j * np.pi * fk * r / C), np.exp(2j * np.pi * nu * tl))


def test_range_doppler_puts_a_target_in_the_right_cell():
    fk = Carrier(751e6, 10).re_freqs(0)
    rd = range_doppler(_target_matrix(fk, 1000, 640.0, 42.0), fk, 3000)
    i, j = np.unravel_index(rd.power.argmax(), rd.power.shape)
    assert abs(rd.ranges[i] - 640) <= rd.ranges[1] - rd.ranges[0]
    assert abs(rd.dopplers[j] - 42) <= 2.0


def test_svd_cancellation_removes_static_paths_but_keeps_moving_target():
    fk = Carrier(751e6, 10).re_freqs(0)
    L = 1000
    static = np.outer(1e4 * np.exp(-2j * np.pi * fk * 0 / C) + 300 * np.exp(-2j * np.pi * fk * 900 / C), np.ones(L))
    tgt = _target_matrix(fk, L, 640.0, 42.0, amp=0.1)
    out = dpc_svd(static + tgt, 1)
    before = range_doppler(tgt, fk, 3000).power.max()
    after = range_doppler(out, fk, 3000)
    assert after.power.max() == pytest.approx(before, rel=0.05)
    k = np.unravel_index(after.power.argmax(), after.power.shape)
    assert abs(after.dopplers[k[1]] - 42) <= 2.0
    assert np.linalg.norm(out - tgt) / np.linalg.norm(static) < 1e-6


def test_cfar_false_alarm_rate_on_noise():
    rng = np.random.default_rng(3)
    fk = Carrier(751e6, 10).re_freqs(0)
    Y = (rng.standard_normal((100, 1000)) + 1j * rng.standard_normal((100, 1000))) / np.sqrt(2)
    rd = range_doppler(Y, fk, 3000)
    assert 0.8 < np.mean(rd.power) < 1.2  # normalised noise
    pfa = 1e-3
    dets, _ = cfar_detect(rd, pfa, max_dets=10 ** 6)
    cells = rd.power.size
    # Peak picking keeps local maxima only, so expect fewer than pfa * cells, but the same order.
    assert 0.05 * pfa * cells < len(dets) < 2 * pfa * cells


# ---------------------------------------------------------------------------
# Localisation and tracking
# ---------------------------------------------------------------------------
def test_locator_finds_target_from_noise_free_bistatic_ranges():
    site = FlatSite()
    loc = Locator(site, half_m=800, step_m=20)
    truth = np.array([150.0, -220.0, 60.0])
    txs = [np.array([-3000.0, 1000, 50]), np.array([2500.0, 2500, 60]), np.array([500.0, -4000, 40])]
    rxs = [np.array([-200.0, 0, 6]), np.array([200.0, 0, 6]), np.array([0.0, 300, 6])]
    vel = np.array([8.0, -6.0, 0.0])
    lam = C / 751e6

    def build(doppler_fn):
        meas = []
        for ti, tx in enumerate(txs):
            for ri, rx in enumerate(rxs):
                r = float(bistatic_range(tx, rx, truth))
                meas.append(PairMeas(tx, rx, lam, 33.6, [Detection(r, doppler_fn(tx, rx), 15.0, -30.0, 0, 0)], ti * 3 + ri))
        return meas

    fixes = loc.locate(build(lambda tx, rx: float(bistatic_doppler(tx, rx, truth, vel, 751e6))))
    assert fixes and np.linalg.norm(fixes[0].pos[:2] - truth[:2]) < 10
    assert np.linalg.norm(fixes[0].vel[:2] - vel[:2]) < 1.0
    # Same ranges but Dopplers that no single velocity explains (like coincident false alarms): rejected.
    rng = np.random.default_rng(1)
    assert loc.locate(build(lambda tx, rx: float(rng.uniform(-800, 800)))) == []


def test_tracker_confirms_after_two_hits():
    from twin.locate import Fix
    trk = Tracker()
    for k in range(3):
        f = Fix(np.array([10.0 * k, 0, 60]), np.array([10.0, 0, 0]), 4, 5.0, [], -30.0)
        confirmed = trk.step([f], 1.0, float(k))
    assert len(confirmed) == 1


# ---------------------------------------------------------------------------
# Configuration, calibration, scenario plumbing
# ---------------------------------------------------------------------------
def test_params_parsing_and_trajectory_hover():
    p = Params.from_dict({"bird": "false", "n_listeners": "8", "cit_s": "0.8", "unknown": 1})
    assert p.bird is False and p.n_listeners == 8 and p.cit_s == 0.8
    t = Trajectory(np.array([[0, 0], [100, 0], [100, 100]]), 10, 50, hover_at=1, hover_s=5)
    assert t.duration == pytest.approx(25)
    _, v = t.state(FlatSite(), 12.0)
    assert np.allclose(v, 0)
    assert set(DRONES) >= {"mini", "mavic", "m210"}


def test_calibration_file_is_consistent():
    cal = json.loads(CAL_PATH.read_text())
    assert abs(cal["figure11_calibrated"]["max_range_m"] - 1600) < 80
    assert 0 < cal["lumped_loss_db"] < 45
    sims = [v["pd_pct"] for v in cal["validation"]["simulated"].values()]
    assert all(60 <= s <= 100 for s in sims)


def test_env_reads_keys_without_exposing(tmp_path, monkeypatch):
    f = tmp_path / ".env"
    f.write_text("# comment\nOPENCELLID_API_KEY = 'pk.test123'\n")
    monkeypatch.delenv("OPENCELLID_API_KEY", raising=False)
    monkeypatch.setattr(env, "CANDIDATES", [f])
    assert env.get_key("OPENCELLID_API_KEY") == "pk.test123"
    assert env.get_key("MISSING_KEY") is None
