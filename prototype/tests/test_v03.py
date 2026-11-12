"""Tests for iteration 3: antenna patterns and pointing, processing modes, cost model, scored flights."""
import math

import numpy as np
import pytest

from twin.antenna import ANTENNAS, NodeAntenna, face_azimuths, node_antenna, pattern_db
from twin.config import Params, processing_gain_db
from twin.cost import RADIOS, ZONE, custom_board_usd, facility_economics, node_cost
from twin.lte import Carrier
from twin.rf import Illuminator, Listener
from twin.scene import FlatSite, Trajectory, build_scene, drone_target, noise_budget


def test_patterns_peak_back_and_omni():
    o = np.zeros(3)
    for a in ANTENNAS.values():
        north = pattern_db(a, 0.0, o, np.array([[0.0, 1000.0, 1000 * math.tan(math.radians(5))]]))[0]
        assert north == pytest.approx(a.gain_dbi, abs=0.05)  # boresight (beam tilted up 5 deg)
        if a.az_bw_deg < 360:
            south = pattern_db(a, 0.0, o, np.array([[0.0, -1000.0, 87.5]]))[0]
            assert south == pytest.approx(a.gain_dbi - a.front_to_back_db, abs=0.05)
            edge = pattern_db(a, 0.0, o, np.array([[1000 * math.sin(math.radians(a.az_bw_deg / 2)),
                                                    1000 * math.cos(math.radians(a.az_bw_deg / 2)), 87.5]]))[0]
            assert edge == pytest.approx(a.gain_dbi - 3.0, abs=0.1)  # half-power at half the beamwidth
            # Gain-beamwidth rule of thumb G ~ 30,000 / (az x el) within 2 dB.
            assert a.gain_dbi == pytest.approx(10 * math.log10(30000 / (a.az_bw_deg * a.el_bw_deg)), abs=2.0)
    om = ANTENNAS["omni"]
    g = pattern_db(om, 0.0, o, np.array([[1000.0, 0, 0], [-1000, 0, 0], [0, 1000, 0]]))
    assert np.ptp(g) == pytest.approx(0.0, abs=1e-9)


def test_faces_tile_an_arc_and_layout_splits_elements():
    p = ANTENNAS["patch"]
    assert face_azimuths(90.0, p, 1) == [90.0]
    f2 = face_azimuths(90.0, p, 2)
    assert f2 == pytest.approx([55.0, 125.0])  # neighbors meet at the 70-deg beam edges
    assert len(face_azimuths(0.0, p, 8)) == 8 and np.diff(sorted(face_azimuths(0.0, p, 8)))[0] == pytest.approx(45.0)
    na = node_antenna(Params(antenna="patch", rx_elements=8, faces=2), 0.0)
    assert len(na.faces) == 2 and na.array_gain_db == pytest.approx(10 * math.log10(4))
    assert node_antenna(Params(antenna="omni", rx_elements=8, faces=4), 0.0).faces == [0.0]  # circular array
    iso = node_antenna(Params(antenna="iso", rx_elements=4, rx_gain_dbi=10), 0.0)
    assert iso.gain_db(0, np.zeros(3), np.ones((3, 3))) == pytest.approx([10, 10, 10])


def test_processing_gain_from_resource_counts():
    assert processing_gain_db("crs_p0", 0.3) == 0.0
    assert processing_gain_db("crs_all", 0.3) == pytest.approx(10 * math.log10(4))
    assert processing_gain_db("full", 0.3) == pytest.approx(10 * math.log10((8 + 76 * 0.3) / 2))
    assert processing_gain_db("full", 1.0) == pytest.approx(10 * math.log10(42))


def _flat_scene(antenna: NodeAntenna | None, p: Params):
    tx = np.array([-2000.0, 0.0, 30.0])
    ill = Illuminator("bs", "bs", "X", Carrier(751e6, 10, cell_id=7), tx, 30.0, azimuth_deg=90.0, downtilt_deg=2.0)
    rx = Listener("RX", np.array([0.0, 0.0, 6.0]), antenna)
    traj = Trajectory(np.array([[0.0, 300.0], [0.0, 900.0]]), 10.0, 60.0)
    return build_scene(FlatSite(), p, [drone_target(p, traj)], illuminators=[ill], listeners=[rx])


def test_pointing_away_from_tower_cuts_direct_signal_and_noise():
    p = Params(drone="m210", antenna="patch", bird=False, vegetation_fraction=0.0)
    patch = ANTENNAS["patch"]
    toward = _flat_scene(NodeAntenna("patch", [270.0], 0.0), p).pairs[0]  # tower is due west
    away = _flat_scene(NodeAntenna("patch", [90.0], 0.0), p).pairs[0]
    d_t, d_a = toward.noise_parts[0]["direct"], away.noise_parts[0]["direct"]
    assert d_t - d_a == pytest.approx(patch.front_to_back_db, abs=0.5)
    assert away.noise_re_dbw[0] <= toward.noise_re_dbw[0]


def test_array_and_processing_gain_lower_noise():
    base = Params(drone="m210", antenna="iso", rx_elements=1, bird=False, vegetation_fraction=0.0)
    n1 = _flat_scene(None, base).pairs[0].noise_re_dbw[0]
    n4 = _flat_scene(None, Params(**{**base.to_dict(), "rx_elements": 4})).pairs[0].noise_re_dbw[0]
    nf = _flat_scene(None, Params(**{**base.to_dict(), "processing": "full"})).pairs[0].noise_re_dbw[0]
    assert n1 - n4 == pytest.approx(10 * math.log10(4), abs=1e-6)
    assert n1 - nf == pytest.approx(processing_gain_db("full", base.network_load), abs=1e-6)


def test_cost_model_matches_data_package_arithmetic():
    b = node_cost(4, "patch", "b210")
    assert b["items"]["receiver"] == pytest.approx(2 * RADIOS["b210"]["usd"])
    assert "clock_distribution" in b["items"]
    assert "clock_distribution" not in node_cost(2, "patch", "bladerf")["items"]
    # Data package: $50k install - $24k hardware - $6k deployment = 40 % installation margin.
    e = facility_economics(3, ZONE["hardware_target_usd"] / 3)
    assert e["install_margin"] == pytest.approx(0.40) and e["hardware_gate_pass"] and e["zones"] == 1
    assert facility_economics(7, 1000)["zones"] == 3
    assert custom_board_usd(8, 10000) < custom_board_usd(8, 100)  # volume curve


def test_hovering_drone_is_never_radar_detected():
    from twin.flights import score_flight
    p = Params(drone="heavy", antenna="iso", rx_gain_dbi=15, rx_elements=8, bird=False, processing="full",
               vegetation_fraction=0.0, zone_buffer_m=5000)
    sc = _flat_scene(None, p)
    hover = Trajectory(np.array([[0.0, 300.0], [0.0, 300.0001]]), 1e-6, 60.0, hover_at=0, hover_s=30.0)
    assert score_flight(sc, hover)["availability_pct"] == 0.0


def test_custom_bom_sources_and_total():
    from twin.cost import CUSTOM_BOM, custom_board_breakdown
    for line in CUSTOM_BOM:  # every line is cited (with a link) or labeled an assumption
        assert line["source"].startswith(("CITED", "ASSUMPTION")), line["part"]
        if line["source"].startswith("CITED"):
            assert line["url"].startswith("https://"), line["part"]
    b = custom_board_breakdown(8, 1000)
    assert b["total_usd"] == pytest.approx(b["parts_usd"] + b["assembly_usd"] + b["test_usd"], abs=0.05)  # NRE separate
    assert [ln["count"] for ln in b["lines"]][:3] == [4, 1, 10]  # 4 transceivers, 1 FPGA, 8 + 2 LNAs
    assert custom_board_usd(8, 1000) == pytest.approx(b["total_usd"])
