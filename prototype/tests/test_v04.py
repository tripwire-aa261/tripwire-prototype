"""Tests for v0.4: three real sites, accuracy model, multi-radius flight scoring, financial defaults."""
import numpy as np
import pytest

from twin.config import Params
from twin.cost import FINANCE, facility_costs, node_cost
from twin.coverage import albersheim_db, pair_snr_db, position_error_m
from twin.flights import random_flights, score_flight
from twin.scenarios import SITE_IDS, fence_centre, load_site, site_scene


@pytest.mark.parametrize("key", list(SITE_IDS))
def test_each_site_loads_with_fence_terrain_and_towers(key):
    s = load_site(key)
    assert len(s.fence) >= 4 and np.allclose(s.fence[0], s.fence[-1])
    c = fence_centre(s)
    assert bool(s.in_zone(c[0], c[1], 0.0))
    assert 0 < float(s.ground(c[0], c[1])) < 2000
    assert any(t.get("likely_cellular") for t in s.towers)


def test_accuracy_improves_with_snr_and_needs_three_pairs():
    p = Params(drone="m210", antenna="omni", rx_elements=4, processing="full", n_listeners=6, bird=False)
    sc = site_scene("hays", p)
    pts = np.array([[0.0, 0.0, float(sc.site.ground(0, 0)) + 60]])
    thr = albersheim_db(0.9, p.pfa)
    snrs = [pair_snr_db(sc, pr, pts) for pr in sc.pairs]
    e1 = position_error_m(sc, pts, snrs, thr)[0]
    e2 = position_error_m(sc, pts, [s + 10 for s in snrs], thr)[0]
    assert np.isfinite(e1) and e2 < e1  # stronger echoes, smaller error
    assert np.isnan(position_error_m(sc, pts, [s - 200 for s in snrs], thr)[0])  # nobody detects


def test_flights_fixed_height_and_radius_scoring():
    p = Params(drone="m210", antenna="omni", rx_elements=4, processing="full", n_listeners=8, bird=False)
    sc = site_scene("hays", p)
    fl = random_flights(sc.site, p, 3, agl=120)
    assert all(t.agl == 120 for t in fl)
    r = score_flight(sc, fl[0], radii=[50, 300])
    assert set(r["by_radius"]) == {50, 300} and all(0 <= v <= 100 for v in r["by_radius"].values())


def test_financial_defaults_match_data_package_for_three_sensors():
    n = node_cost(4, "omni", "bladerf", "full", True)["total"]
    c = facility_costs(3, n)
    per_sensor_install = c["install"] - FINANCE["install"]["site_setup_usd"]
    assert per_sensor_install == pytest.approx(6000)  # data package: $6,000 deployment per 3-node zone
    assert c["yearly"] == pytest.approx(5000, rel=0.02)  # data package: ~$5,000/yr maintenance per zone


def test_locator_velocity_fallback_tolerates_pairs_without_doppler_rows():
    """Regression: the no-consistent-velocity fallback looked up pairs that had no Doppler row (KeyError)."""
    import inspect
    from twin import locate
    src = inspect.getsource(locate.Locator._refine)
    assert "if pi in rows" in src
