"""v0.5: stadium site (Clemson Memorial Stadium), building holes, sensor mounting options."""
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np

from twin.config import Params
from twin.scenarios import SITE_PARAMS, fence_centre, load_site
from twin.scene import building_reflectors, place_listeners

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))


def test_join_rings_closes_open_member_ways_in_any_direction():
    from fetch_site import join_rings
    a, b, c, d = (0, 0), (0, 1), (1, 1), (1, 0)
    rings = join_rings([[a, b], [c, b], [c, d], [a, d]])  # second and fourth reversed
    assert len(rings) == 1 and rings[0][0] == rings[0][-1] and len(rings[0]) == 5


def test_stadium_stands_have_an_open_field_and_ring_reflectors():
    s = load_site("clemson")
    stands = [b for b in s.buildings if b.get("holes")]
    assert stands, "the grandstand multipolygon should keep its field as a hole"
    c = fence_centre(s)
    assert abs(float(s.surface(*c)) - float(s.ground(*c))) < 1.0  # field open, not a 30 m block
    pts, rcs = building_reflectors(s)
    assert min(np.hypot(p[0] - c[0], p[1] - c[1]) for p in pts[:len(pts)]) > 20  # no echo placed at mid-field


def test_mounting_options_put_sensors_on_the_stands_or_on_poles_outside():
    s = load_site("clemson")
    base = replace(Params(), n_listeners=6, antenna="omni", rx_elements=4, **SITE_PARAMS["clemson"])
    c = fence_centre(s)
    pole = place_listeners(s, replace(base, mount="pole"))
    struct = place_listeners(s, replace(base, mount="structure"))
    mixed = place_listeners(s, replace(base, mount="mixed"))
    agl = lambda l: l.pos[2] - float(s.ground(l.pos[0], l.pos[1]))  # noqa: E731
    assert all(abs(agl(l) - base.mast_m) < 0.01 for l in pole)
    stands_h = max((b for b in s.buildings if b.get("holes")), key=lambda b: b["area_m2"])["height_m"]
    assert all(agl(l) > stands_h for l in struct)
    r = lambda l: np.hypot(l.pos[0] - c[0], l.pos[1] - c[1])  # noqa: E731
    assert all(r(p) > r(q) for p, q in zip(pole, struct))  # poles stand outside, structure sensors inside
    assert agl(mixed[0]) > stands_h and abs(agl(mixed[1]) - base.mast_m) < 0.01


def test_prison_sensors_unchanged_by_the_mounting_option():
    s = load_site("hays")
    p = replace(Params(), n_listeners=6)
    for l in place_listeners(s, p):
        assert abs(l.pos[2] - float(s.ground(l.pos[0], l.pos[1])) - p.mast_m) < 0.01
