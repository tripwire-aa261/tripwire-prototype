"""v0.6 platform modules: broadcast link budget, GPS jammer locator, heat-camera ranges."""
import numpy as np

from twin import gnss_jam, thermal
from twin.broadcast import Broadcast, calibrate_tv, pair_snr
from twin.config import DRONES, Params
from twin.scene import FlatSite


def test_fm_weaker_than_tv_for_small_drone():
    """Same power and geometry, real bandwidths (TV 6 MHz, FM 200 kHz): FM loses on processing gain and on the
    Rayleigh roll-off of a small drone at a 3 m wavelength."""
    p, site = Params(), FlatSite()
    rx, pt = np.array([0.0, 0.0, 6.0]), np.array([[200.0, 0.0, 60.0]])
    tv = Broadcast("tv", "tv", 581e6, 6e6, 80.0, np.array([20000.0, 0, 300]), 20)
    fm = Broadcast("fm", "fm", 98e6, 200e3, 80.0, np.array([20000.0, 0, 300]), 20)
    d = DRONES["mavic"]
    assert pair_snr(site, p, tv, rx, pt, d)[0] - pair_snr(site, p, fm, rx, pt, d)[0] > 15


def test_tv_calibration_is_conservative():
    """Against the DVB-T trial (5 km bistatic) the model falls short, so no extra gain is ever added."""
    c = calibrate_tv()
    assert c["extra_loss_db"] == 0.0 and c["snr_at_limit_db"] < c["threshold_db"]


def test_tdoa_locates_exactly_without_noise():
    s = np.array([[0.0, 0, 6], [400, 0, 6], [0, 400, 6], [400, 400, 6]])
    jam = np.array([150.0, 250.0, 1.5])
    toa = np.linalg.norm(s - jam, axis=1) / gnss_jam.C
    est = gnss_jam.locate(s, toa, s[:, :2].mean(axis=0), 1.0)
    assert np.hypot(*(est - jam[:2])) < 1.0


def test_bearings_fix_poor_geometry():
    """A jammer outside a small ring: adding bearings beats time differences alone."""
    site = FlatSite()
    s = np.array([[np.cos(a) * 150, np.sin(a) * 150, 6.0] for a in np.linspace(0, 2 * np.pi, 7)[:-1]])
    rng = np.random.default_rng(1)
    a = gnss_jam.trial(site, s, (900.0, 300.0), 30, 50.0, rng, n_mc=60, mode="tdoa")
    b = gnss_jam.trial(site, s, (900.0, 300.0), 30, 50.0, rng, n_mc=60, mode="tdoa+aoa")
    assert b["error_m"] is not None and (a["error_m"] is None or b["error_m"] < a["error_m"])


def test_johnson_ranges_scale_with_lens():
    a, b = thermal.dri_ranges_m(0.88, "35mm"), thermal.dri_ranges_m(0.88, "100mm")
    assert a["detect"] > a["recognise"] > a["identify"] and abs(b["detect"] / a["detect"] - 100 / 35) < 0.01
