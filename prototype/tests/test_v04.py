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


def test_financial_defaults_are_below_the_data_package_planning_figures():
    # v0.4.4 re-priced parts, labor and upkeep (sourced where possible): 3 standard bladeRF sensors now cost less
    # than the data package's $24,000 hardware + $6,000 deployment and ~$5,000/yr per 3-node zone.
    n = node_cost(4, "omni", "bladerf", "full", False)["total"]
    c = facility_costs(3, n)
    i, m = FINANCE["install"], FINANCE["maintenance"]
    per_sensor = i["tech_hours_per_sensor"] * i["labour_rate_usd_per_h"] + i["mounting_cabling_usd"]
    assert c["install"] == pytest.approx(3 * per_sensor + i["site_setup_usd"] + i["hub_usd"])
    assert c["hardware"] < 24000 and c["install"] < 6000 + i["site_setup_usd"] + i["hub_usd"] and c["yearly"] < 5000
    assert node_cost(8, "omni", "custom", "full")["items"]["receiver"] < 700  # board price excludes the NRE


def test_locator_velocity_fallback_tolerates_pairs_without_doppler_rows():
    """Regression: the no-consistent-velocity fallback looked up pairs that had no Doppler row (KeyError)."""
    import inspect
    from twin import locate
    src = inspect.getsource(locate.Locator._refine)
    assert "if pi in rows" in src


def test_drones_caught_and_cost_plus_pricing():
    from twin.cost import customer_price
    p = Params(drone="m210", antenna="omni", rx_elements=4, processing="full", n_listeners=8, bird=False)
    sc = site_scene("hays", p)
    fl = random_flights(sc.site, p, 2, agl=60)
    r = score_flight(sc, fl[0], radii=[150])
    assert 0 <= r["caught_pct"] <= 100  # share of draws tracked before the drone crosses the fence
    # Default margins: 40 % on both (Nov 12): $30,000 cost -> $50,000; $5,000/yr -> $8,333/yr.
    c = customer_price(30000, 5000)
    assert c["price"] == pytest.approx(50000) and c["sub"] == pytest.approx(8333.3, rel=0.001)
    assert c["customer_total"] == pytest.approx(c["price"] + FINANCE["pricing"]["years"] * c["sub"])
    # All-in model: nothing upfront; the yearly fee repays the upfront cost with interest over the contract.
    f = {**FINANCE, "pricing": {**FINANCE["pricing"], "model": "all_in"}}
    a = customer_price(30000, 5000, f)
    assert a["price"] == 0 and a["customer_total"] > c["customer_total"]


def test_recommend_picks_cheapest_radio_meeting_area_and_tracking_targets():
    from twin.explore import BUILDS, DEFAULT_REQ, RADII, node_costs, recommend
    ri, h = RADII.index(DEFAULT_REQ["radius_m"]), DEFAULT_REQ["height_m"]

    def point(design, n, cov, trk, det50=500.0):
        c, t = [0.0] * len(RADII), [0.0] * len(RADII)
        c[ri], t[ri] = cov, trk
        return {"k": ["hays", "m210", design, h, 20, n], "cov": c, "trk": t, "caught": 90.0,
                "acc": [10.0] * len(RADII), "det50": det50}
    ots, custom = BUILDS["bladerf"], BUILDS["custom"]
    res = [point(ots, 4, 95, 70),      # misses the tracking target
           point(ots, 8, 99, 90),      # meets
           point(custom, 4, 99, 85),   # meets with fewer sensors
           point("ring4", 3, 99, 99)]  # not a fixed build: never recommended
    de, radio, n, ok = recommend(res, node_costs(), "hays", "m210", 20)
    assert ok and n in (4, 8) and de in BUILDS.values() and radio in BUILDS
    # No point meets the targets -> best area, flagged as not meeting.
    de, radio, n, ok = recommend([point(ots, 4, 60, 50), point(ots, 8, 80, 70)], node_costs(), "hays", "m210", 20)
    assert not ok and n == 8 and radio == "bladerf"
    # Detection range: a setup whose typical drone is first tracked too close to the fence does not qualify.
    de, radio, n, ok = recommend([point(ots, 4, 99, 90, det50=100), point(ots, 8, 99, 90, det50=400)], node_costs(), "hays", "m210", 20)
    assert ok and n == 8
    # bladeRF and B210 share a build; the B210 is never the cheaper of the two.
    assert BUILDS["bladerf"] == BUILDS["b210"]


def test_explore_has_a_map_for_every_fixed_build_and_count():
    import json
    from pathlib import Path
    from twin.explore import BUILDS, map_jobs
    doc = json.loads((Path(__file__).resolve().parent.parent / "web" / "data" / "explore.json").read_text())
    have = {tuple(m["k"]) for m in doc["maps"]}
    assert all(tuple(j) in have for j in map_jobs())
    assert doc.get("builds") == BUILDS


def test_hover_history_needs_stable_background_and_only_holds_tracks():
    from twin.antenna import zone_samples
    from twin.flights import scored_flights
    from twin.hover import hover_sinr_db
    base = dict(drone="m210", antenna="omni", rx_elements=4, processing="full", n_listeners=4, bird=False,
                cit_s=0.8, network_load=0.3, cochannel_suppression_db=20)
    sc = site_scene("hays", Params(**base, hover_history=True, background_stability_db=-30))
    pts = zone_samples(sc.site, 0.0, 60.0, 80.0)[:20]
    pr = sc.pairs[0]
    s30 = hover_sinr_db(sc, pr, pts, 4.8)
    sc40 = site_scene("hays", Params(**base, hover_history=True, background_stability_db=-40))
    s40 = hover_sinr_db(sc40, sc40.pairs[0], pts, 4.8)
    assert np.all(s40 >= s30 - 1e-9) and np.any(s40 > s30 + 1)  # steadier background -> better
    # Listening longer helps (noise falls behind) but never beyond the background limit.
    assert np.all(hover_sinr_db(sc40, sc40.pairs[0], pts, 4.8) >= hover_sinr_db(sc40, sc40.pairs[0], pts, 0.8) - 1e-9)
    # In flights: history only holds tracks, so drones caught is unchanged and time tracked does not fall.
    off = scored_flights(site_scene("hays", Params(**base)), 4, agl=60, radii=[150])
    on = scored_flights(sc, 4, agl=60, radii=[150])
    assert on["caught_pct"] == off["caught_pct"] and on["by_radius"][150] >= off["by_radius"][150]
