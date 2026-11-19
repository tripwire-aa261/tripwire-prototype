"""Heat-camera cueing (v0.6): when our track points a thermal PTZ camera at a drone, how far out can staff see it?

Johnson criteria (STANDARD, used for thermal camera DRI ranges): pixels across the target's critical dimension needed
for a 50% chance of detection 1.5, recognition 6, identification 12. Pixels across = size / (range x IFOV), with
IFOV = pixel pitch / focal length. Camera (ASSUMPTION, typical uncooled security PTZ): 640 x 480 sensor, 12 um pitch,
35 mm lens (horizontal field of view ~12.5 deg) and, as an option, 100 mm. Atmosphere and contrast are ignored, so
these are upper bounds; a measured low-cost camera saw a Phantom 4 at only ~51 m (Univ. of Zagreb 2017).
Slew-to-cue: the camera turns at 60 deg/s (ASSUMPTION) and the drone must sit inside the field of view, i.e. the
track error must be smaller than half the view width at that range.
"""
from __future__ import annotations

import numpy as np

JOHNSON = {"detect": 1.5, "recognise": 6.0, "identify": 12.0}
CAMERAS = {"35mm": {"pitch_um": 12.0, "focal_mm": 35.0, "px_h": 640}, "100mm": {"pitch_um": 12.0, "focal_mm": 100.0, "px_h": 640}}
SLEW_DEG_S = 60.0


def ifov_rad(cam):
    return cam["pitch_um"] * 1e-6 / (cam["focal_mm"] * 1e-3)


def dri_ranges_m(size_m: float, cam_key: str = "35mm") -> dict:
    ifov = ifov_rad(CAMERAS[cam_key])
    return {k: round(size_m / (n * ifov)) for k, n in JOHNSON.items()}


def fov_width_m(range_m: float, cam_key: str = "35mm") -> float:
    cam = CAMERAS[cam_key]
    return range_m * cam["px_h"] * ifov_rad(cam)


def cue(cam_pos, track_pos, prev_az_deg=0.0):
    """Pan/tilt to a track and the time to slew there from the previous pan angle."""
    d = np.asarray(track_pos, float) - np.asarray(cam_pos, float)
    az = float(np.degrees(np.arctan2(d[0], d[1])) % 360)
    el = float(np.degrees(np.arctan2(d[2], np.hypot(d[0], d[1]))))
    turn = abs((az - prev_az_deg + 180) % 360 - 180)
    return {"az_deg": round(az, 1), "el_deg": round(el, 1), "range_m": round(float(np.linalg.norm(d))),
            "slew_s": round(turn / SLEW_DEG_S, 2)}
