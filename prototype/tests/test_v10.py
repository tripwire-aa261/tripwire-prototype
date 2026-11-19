"""v1.0 platform: TV pairs fused into the design-point simulation, the multi-band parts list, outline growing."""
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from twin import platform_bom  # noqa: E402
from twin.config import Params  # noqa: E402
from twin.coverage import albersheim_db, pair_snr_db  # noqa: E402
from twin.multiband import all_pairs, is_tv  # noqa: E402
from twin.scenarios import site_scene  # noqa: E402


def _scene(signals):
    p = Params.from_dict({"cit_s": 0.8, "bird": False, "antenna": "omni", "rx_elements": 8, "processing": "full",
                          "n_listeners": 6, "drone": "mavic", "signals": signals})
    return site_scene("hays", p)


def test_tv_pairs_only_when_asked():
    assert _scene("cell").tv_pairs == []
    sc = _scene("cell+tv")
    assert len(sc.tv_pairs) == 3 * len(sc.listeners)
    assert all(is_tv(p) for p in sc.tv_pairs) and not any(is_tv(p) for p in sc.pairs)
    assert all_pairs(sc)[: len(sc.pairs)] == list(sc.pairs)  # cell pairs first (flights.hover_hold relies on it)


def test_fused_detections_never_fewer():
    cell, both = _scene("cell"), _scene("cell+tv")
    pts = np.array([[x, y, float(cell.site.ground(x, y)) + 60] for x in (-300, 0, 300) for y in (-300, 0, 300)])
    thr = albersheim_db(0.9, cell.params.pfa)
    n_cell = np.sum([pair_snr_db(cell, pr, pts) >= thr for pr in all_pairs(cell)], axis=0)
    n_both = np.sum([pair_snr_db(both, pr, pts) >= thr for pr in all_pairs(both)], axis=0)
    assert (n_both >= n_cell).all()


def test_board_has_three_banks():
    b = platform_bom.board(1000)
    chips = next(l for l in b["lines"] if "LMS7002M" in l["part"])
    assert chips["count"] == 8 and platform_bom.CHANNELS == 16
    assert next(l for l in b["lines"] if "SMA" in l["part"])["count"] == 17
    s = platform_bom.sensor(1000)
    assert 2000 < s["total_usd"] < 5000
    assert platform_bom.sensor(10000)["total_usd"] < s["total_usd"] < platform_bom.sensor(100)["total_usd"]


def test_products_cost_more_than_their_sensors():
    u = platform_bom.sensor(1000)["total_usd"]
    for k in platform_bom.PRODUCTS:
        c = platform_bom.product(k, u)
        assert c["upfront_usd"] >= c["sensors"] * u


def test_grow_outline_contains_original():
    sys.path.insert(0, str(ROOT / "tools"))
    from fetch_site import grow_outline
    from twin.geo import distance_to_polygon
    sq = np.array([[0, 0], [100, 0], [100, 50], [0, 50], [0, 0]], dtype=float)
    g = grow_outline(sq, 250.0)
    d = np.asarray(distance_to_polygon(g[:-1, 0], g[:-1, 1], sq))  # every grown vertex ~250 m outside the original
    assert (d > 240).all() and (d < 251).all()
