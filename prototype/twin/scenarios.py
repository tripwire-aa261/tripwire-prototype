"""Scenarios: the real Hays State Prison site, and the two Fraunhofer LTE450 trials used to calibrate
and check the model (Demissie & Steffes 2025, IET Radar Sonar Navig. 19:e70092).

Trial geometry not given in the paper's text (figure-only) is marked ASSUMPTION.
"""
from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import numpy as np

from .config import Params
from .geo import Site, distance_to_polygon
from .lte import Carrier
from .rf import Illuminator, Listener
from .scene import FlatSite, Trajectory, bird_target, build_scene, drone_target

ROOT = Path(__file__).resolve().parent.parent
SITES = ROOT / "data" / "sites"

# ---------------------------------------------------------------------------
# Real facilities (real terrain, buildings and towers)
# ---------------------------------------------------------------------------
SITE_IDS = {"hays": "hays-state-prison", "hancock": "hancock-state-prison", "fulton": "fulton-county-jail",
            "clemson": "clemson-memorial-stadium"}
SITE_LABELS = {"hays": "moderate towers", "hancock": "sparse towers", "fulton": "dense towers",  # by tower density (Nov 12)
               "clemson": "stadium"}  # a different kind of customer (Nov 12)
# Per-site settings applied on top of every scenario's Params. The stadium alternates sensors on top of the stands
# with 6 m poles in the plaza 20 m outside (setback ASSUMPTION). Chosen by tools/placement_study.py (Nov 12): poles alone
# never see into the bowl (stands block it, <= ~65 % covered inside); on the stands alone the sensors see too much
# tower signal and fail around the stadium below 40 dB of interference removal; alternating covers both.
# Microphones are off at the stadium: on game day the crowd drowns out a drone (ASSUMPTION), so the microphone
# builds there rely on the radar alone.
SITE_PARAMS = {"clemson": {"mount": "mixed", "setback_m": 20.0, "mic_range_m": 0.0}}
_SITES: dict = {}


def load_site(key: str) -> Site:
    """Sites are cached per process (terrain grids take a moment to load)."""
    if key not in _SITES:
        _SITES[key] = Site(SITES / SITE_IDS[key])
    return _SITES[key]


def fence_centre(site) -> np.ndarray:
    return np.asarray(site.fence)[:-1].mean(axis=0)


def site_flight(site, p: Params, key: str = "hays") -> Trajectory:
    """Contraband run: in from the east-south-east, hover over the drop point, out to the north-west.
    Start/end ~1 km from the drop point (scenario choice). Hays keeps its v0.2 drop point."""
    drop = np.array([-20.0, 40.0]) if key == "hays" else fence_centre(site)
    a_in, a_out = np.radians(110), np.radians(300)
    start = drop + 1100 * np.array([np.sin(a_in), np.cos(a_in)])
    end = drop + 1000 * np.array([np.sin(a_out), np.cos(a_out)])
    return Trajectory(np.array([start, drop, end]), p.speed_mps, p.altitude_agl_m, hover_at=1, hover_s=p.hover_s)


def site_bird(site, key: str = "hays") -> Trajectory:
    c = np.array([380.0, -330.0]) if key == "hays" else fence_centre(site) + np.array([300.0, -300.0])
    ang = np.linspace(0, 2 * np.pi, 13)
    return Trajectory(c + 220 * np.stack([np.sin(ang), np.cos(ang)], axis=1), 10.0, 35.0, loop=True)


def site_scene(key: str, p: Params, site_params: bool = True):
    """Scene for a real facility. SITE_PARAMS for the site are applied unless the caller set them itself."""
    site = load_site(key)
    if site_params and key in SITE_PARAMS:
        p = replace(p, **SITE_PARAMS[key])
    targets = [drone_target(p, site_flight(site, p, key))]
    if p.bird:
        targets.append(bird_target(site_bird(site, key)))
    return build_scene(site, p, targets)


def hays_scene(p: Params):
    return site_scene("hays", p)


# ---------------------------------------------------------------------------
# Fraunhofer LTE450 trials
# ---------------------------------------------------------------------------
LTE450 = dict(freq_hz=467.37e6, bw_mhz=5)  # CITED: centre frequency 467.37 MHz, up to ~5 MHz bandwidth


def fraunhofer_params(**kw) -> Params:
    base = Params(
        cit_s=0.8,  # CITED: 26,666,640 samples at 200/6 MHz = 0.8 s
        adc_bits=14,  # CITED: USRP X310 (TwinRX, 14-bit ADC)
        antenna="iso",  # trial antennas pointed at the test area: their peak gain applies (v0.2 model)
        rx_gain_dbi=7.0,  # ASSUMPTION: patch / log-periodic antenna
        nf_db=6.0, drone="m210", altitude_agl_m=50.0, speed_mps=10.0, hover_s=0.0, bird=False,
        network_load=0.0,  # ASSUMPTION: LTE450 network in roll-out (2025), essentially idle -> no co-channel data
        eirp_dbw=31.0,  # ASSUMPTION: 46 dBm + 15 dBi
        vegetation_fraction=0.1,  # agricultural fields
        max_range_m=3300.0,
    )
    return replace(base, **kw)


def fraunhofer_cal_scene(p: Params):
    """Single surveillance channel near a base station SW of Cologne, drone flying away over fields.
    ASSUMPTION: receiver 150 m from the eNodeB, tower 30 m, receiver 10 m, flight radial at 50 m."""
    site = FlatSite()
    tx = np.array([-150.0, 0.0, 30.0])
    ill = Illuminator("lte450-bs", "LTE450 eNodeB", "LTE450", Carrier(**LTE450, cell_id=101), tx,
                      p.eirp_dbw, azimuth_deg=90.0, downtilt_deg=2.0)
    rx = Listener("RX", np.array([0.0, 0.0, 10.0]))
    traj = Trajectory(np.array([[60.0, 0.0], [3000.0, 0.0]]), p.speed_mps, p.altitude_agl_m)
    return build_scene(site, p, [drone_target(p, traj)], illuminators=[ill], listeners=[rx])


def fraunhofer_val_scene(p: Params):
    """Multichannel trial: 4-Yagi array, two eNodeBs ~10.8 km and ~9.6 km away (CITED), drone at
    30 m (CITED) flying clockwise loops at ~10 m/s (CITED). ASSUMPTION: base-station bearings,
    loop radius 250 m centred 700 m from the receiver."""
    site = FlatSite()
    p = replace(p, rx_elements=4, altitude_agl_m=30.0)
    ills = []
    for i, (dist, brg) in enumerate([(10800, 200.0), (9600, 215.0)]):
        b = np.radians(brg)
        pos = np.array([dist * np.sin(b), dist * np.cos(b), 40.0])
        ills.append(Illuminator(f"bs{i + 1}", f"base station {i + 1}", "LTE450",
                                Carrier(**LTE450, cell_id=200 + i), pos, p.eirp_dbw,
                                azimuth_deg=(brg + 180) % 360, downtilt_deg=1.0))
    rx = Listener("RX", np.array([0.0, 0.0, 12.0]))
    c = np.array([0.0, 700.0])
    ang = -np.linspace(0, 2 * np.pi, 25)  # clockwise
    loop = c + 250 * np.stack([np.sin(ang), np.cos(ang)], axis=1)
    return build_scene(site, p, [drone_target(p, Trajectory(loop, p.speed_mps, p.altitude_agl_m, loop=True))],
                       illuminators=ills, listeners=[rx]), p


SCENARIOS = {k: (lambda p, k=k: site_scene(k, p)) for k in SITE_IDS}


def protected_zone(site, buffer_m):
    return lambda x, y: distance_to_polygon(x, y, site.fence) <= buffer_m
