"""Platform demos for prototype v0.6: GPS jammer locator, heat-camera cueing and the contraband-drop walkthrough.

Writes web/runs/platform_v06.json (the Platform tab of the viewer). Run after tools/broadcast_study.py:
    python -m tools.platform_demo
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from twin import gnss_jam, thermal  # noqa: E402
from twin.config import DRONES, Params  # noqa: E402
from twin.explore import BASE, DESIGNS, SITE_PARAMS  # noqa: E402
from twin.scenarios import load_site  # noqa: E402
from twin.scene import place_listeners  # noqa: E402

RUNS = ROOT / "web" / "runs"
OUT = RUNS / "platform_v06.json"


def sensors_for(key, n):
    site = load_site(key)
    p = Params.from_dict({**BASE, **DESIGNS["ring8_enh_hist"]["p"], "n_listeners": n, "zone_buffer_m": 150, **SITE_PARAMS.get(key, {})})
    return site, np.array([l.pos for l in place_listeners(site, p)])


def gnss_section():
    out = {"method": gnss_jam.__doc__.strip(), "cases": [], "maps": {}}
    rng = np.random.default_rng(11)
    for key in ("hays", "fulton"):
        for n in (6, 12):
            site, s = sensors_for(key, n)
            for power in (10, 30):
                for clock in ("ocxo", "csac"):
                    for mode in ("tdoa", "tdoa+aoa"):
                        for name, xy in (("car on a road 300 m from the fence", (300.0, -250.0)), ("1 km away", (800.0, 600.0)),
                                         ("2 km away", (-1600.0, 1200.0))):
                            r = gnss_jam.trial(site, s, xy, power, gnss_jam.CLOCKS_NS[clock], rng, mode=mode)
                            out["cases"].append({"site": key, "sensors": n, "power_dbm": power, "clock": clock, "mode": mode, "where": name, **r})
            for clock in ("ocxo", "csac"):
                m = gnss_jam.jammer_map(site, s, 10, gnss_jam.CLOCKS_NS[clock])
                out["maps"][f"{key}|{n}|10|{clock}"] = {**m, "sensors": np.round(s[:, :2], 1).tolist(), "fence": np.round(site.fence, 1).tolist()}
    return out


def thermal_section():
    out = {"method": thermal.__doc__.strip(), "ranges": {}}
    for d in ("mavic", "m210"):
        for cam in thermal.CAMERAS:
            out["ranges"][f"{d}|{cam}"] = thermal.dri_ranges_m(DRONES[d].size_m, cam)
    return out


def walkthrough():
    """Hays State Prison, 5 kg drone (Matrice 210 class: the heavy-lift drones that now carry up to 25 lb), our own
    receiver with 4 sensors, today's 20 dB: the twin's full signal replay, turned into a timeline."""
    rep = json.loads((RUNS / "replay-hays-m210-custom.json").read_text())
    site = load_site("hays")
    drop = np.array([-20.0, 40.0])
    cam = np.array(rep["listeners"][0]["pos"], dtype=float)
    dri = thermal.dri_ranges_m(DRONES["m210"].size_m, "35mm")
    ev, first, inside, seen, recog, az = [], None, None, None, None, 0.0
    for fr in rep["frames"]:
        t, p = fr["t"], np.array(fr["truth"]["drone"]["pos"])
        dist = float(np.hypot(*(p[:2] - drop)))
        ok = [tr for tr in fr["tracks"] if math.dist(tr["pos"][:2], p[:2]) < 60]
        if ok and first is None:
            first = (t, dist, ok[0]["pos"])
        if inside is None and site.in_zone(p[0], p[1], 0.0):
            inside = (t, dist)
        if first is not None and recog is None:
            rng_cam = float(np.linalg.norm(p - cam))
            if rng_cam <= dri["recognise"]:
                c = thermal.cue(cam, ok[0]["pos"] if ok else p, az)
                recog = (t, rng_cam, c)
    hover_t = next((fr["t"] for fr in rep["frames"] if np.hypot(*(np.array(fr["truth"]["drone"]["pos"][:2]) - drop)) < 5), None)
    speed = rep["params"]["speed_mps"]
    if first:
        ev.append({"t": first[0], "who": "Tripwire", "what": f"First track, {round(first[1])} m from the drop point. Alert to the control room and the response team's phones.", "kind": "detect"})
        c = thermal.cue(cam, first[2], az)
        ev.append({"t": round(first[0] + c["slew_s"], 1), "who": "Tripwire", "what": f"Heat camera on the fence turns to the track ({c['slew_s']} s at 60 deg/s); drone {c['range_m']} m away.", "kind": "camera"})
    if recog:
        ev.append({"t": recog[0], "who": "Control room", "what": f"Drone recognisable on the heat camera at {round(recog[1])} m (Johnson criteria, 35 mm lens).", "kind": "camera"})
    if inside:
        ev.append({"t": inside[0], "who": "Drone", "what": "Crosses the fence line.", "kind": "drone"})
    if hover_t is not None:
        ev.append({"t": hover_t, "who": "Drone", "what": f"Hovers {rep['params']['hover_s']:.0f} s over the drop point and releases the package.", "kind": "drone"})
        ev.append({"t": hover_t, "who": "Response team", "what": "Already moving to the drop point it was sent to at the first alert; recovers the package (South Carolina uses a pre-selected facility team; SCDC via Facilities Dive).", "kind": "people"})
    tail = [fr for fr in rep["frames"] if fr["tracks"]][-1]
    ev.append({"t": tail["t"], "who": "Tripwire", "what": "Track followed back out of the zone; its heading and the inbound track are kept as evidence and point the sheriff's K-9 team to where the pilot launched (the Georgia DOC pattern: staff alert the sheriff and K-9, who search and arrest).", "kind": "evidence"})
    ev.sort(key=lambda e: e["t"])
    lead = (inside[0] - first[0]) if (first and inside) else None
    return {"replay": rep["id"], "site": "Hays State Prison, Trion GA", "drone": DRONES["m210"].name, "speed_mps": speed,
            "metrics": {k: rep["metrics"][k] for k in ("track_availability_pct", "first_track_distance_m", "median_error_m", "false_tracks", "bird_tracks")},
            "warning_before_fence_s": lead, "camera": "35mm", "dri_m": dri, "events": ev,
            "cases": [
                {"where": "Lieber Correctional, SC, 14 Mar 2025", "what": "Drone reported about 5 a.m.; inmates picked up the package shortly after; the pilot walked out of the woods with a drone and a bag and was sentenced to a year and a day (WRDW, Nov 2026).", "lesson": "Inmates reached the package before staff: the warning has to come before the drop, not after."},
                {"where": "Calhoun State Prison, GA, 21 Sep 2025", "what": "Staff saw a drone carrying a duffel bag; the sheriff and K-9 were called and three civilians were caught that evening with 5 phones, 6.4 kg of tobacco and 1.2 kg of marijuana (Georgia DOC).", "lesson": "The response playbook exists; it needs an earlier and more reliable trigger, and the launch direction."}]}


def main():
    study = json.loads((RUNS / "broadcast_study.json").read_text())
    doc = {"version": "v0.6", "broadcast": study, "gnss": gnss_section(), "thermal": thermal_section(), "walkthrough": walkthrough()}
    OUT.write_text(json.dumps(doc, indent=1))
    print("wrote", OUT)
    w = doc["walkthrough"]
    print("walkthrough: warning before fence", w["warning_before_fence_s"], "s;", [(e["t"], e["what"][:60]) for e in w["events"]])
    for c in doc["gnss"]["cases"]:
        if c["site"] == "hays" and c["sensors"] == 6:
            print(c["power_dbm"], c["clock"], c["mode"], c["where"][:12], c["detected"], c["error_m"], c["fail_pct"])
    print(doc["thermal"]["ranges"])


if __name__ == "__main__":
    main()
