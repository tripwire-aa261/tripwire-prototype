"""Real towers near a site, from the FCC Antenna Structure Registration (ASR) database,
optionally cross-checked with OpenCelliD (crowd-sourced LTE cell locations).

Usage (from prototype/):
    .venv/bin/python tools/fetch_towers.py --site hays-state-prison [--radius-km 12]

FCC ASR: public bulk file, no key. Only structures that need FAA notice (mostly > 200 ft, or near
airports) are registered, so shorter cell sites are missing. ASR does not say what is mounted on a
structure; "likely cellular" is inferred from the owner name (ASSUMPTION).

OpenCelliD: needs OPENCELLID_API_KEY (see twin/env.py for where to put it). When present:
each FCC structure gets the LTE cells OpenCelliD places within MATCH_M, and the carriers they belong to.
OpenCelliD positions are averages of where phones reported from, not antenna positions; they can sit
hundreds of metres from the tower (or cluster where people are), so they are used only as evidence of
which carriers use a registered structure, never to invent towers.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from twin.env import get_key, key_source  # noqa: E402
from twin.geo import LocalFrame  # noqa: E402

UA = "tripwire-prototype/0.2 (Stanford AA261 student project)"
FCC_URL = "https://data.fcc.gov/download/pub/uls/complete/r_tower.zip"
RAW = ROOT / "data" / "raw" / "fcc"

# Owner-name keywords. ASSUMPTION: tower companies and carriers host cellular equipment;
# utilities and local government structures mostly do not.
CELLULAR_HINTS = ["tower", "crown castle", "sba ", "cellco", "verizon", "at&t", "new cingular", "t-mobile",
                  "vertical bridge", "diamond", "pinnacle", "towercom", "apc ", "municipal communications",
                  "sprint", "us cellular", "alltel", "global signal", "insite", "phoenix tower"]
NON_CELLULAR_HINTS = [" emc", "electric", "power", "county of", "city of", "state of", "board of",
                      "department of", "radio", "broadcast", "television"]

# FCC ASR RA.dat field positions (pipe-delimited), checked against the file layout.
MATCH_M = 600.0  # ASSUMPTION: OpenCelliD-to-tower association radius
# Mobile network codes (MCC 310/311/312/313 = USA) -> carrier. Public ITU/ATIS assignments.
CARRIERS = {"310-410": "AT&T", "310-150": "AT&T", "310-170": "AT&T", "310-280": "AT&T", "313-100": "AT&T",
            "311-480": "Verizon", "311-110": "Verizon", "310-4": "Verizon", "310-590": "Verizon",
            "310-260": "T-Mobile", "310-160": "T-Mobile", "310-200": "T-Mobile", "310-210": "T-Mobile",
            "310-220": "T-Mobile", "310-230": "T-Mobile", "310-240": "T-Mobile", "310-250": "T-Mobile",
            "310-270": "T-Mobile", "310-310": "T-Mobile", "310-490": "T-Mobile", "310-660": "T-Mobile",
            "311-490": "T-Mobile", "311-870": "T-Mobile", "311-880": "T-Mobile", "312-250": "T-Mobile",
            "310-120": "T-Mobile", "316-10": "T-Mobile"}
RA_USI, RA_STATUS, RA_STRUCT_H, RA_GROUND, RA_AGL, RA_AMSL, RA_TYPE = 4, 8, 28, 29, 30, 31, 32
STATUS = {"C": "constructed", "G": "granted", "A": "pending", "I": "dismissed", "D": "dismantled"}


def ensure_fcc():
    RAW.mkdir(parents=True, exist_ok=True)
    if (RAW / "RA.dat").exists():
        return
    print("downloading FCC ASR (~38 MB) ...")
    req = urllib.request.Request(FCC_URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=600) as r:
        (RAW / "r_tower.zip").write_bytes(r.read())
    with zipfile.ZipFile(RAW / "r_tower.zip") as z:
        z.extractall(RAW)


def likely_cellular(owner: str) -> bool:
    o = f" {owner.lower()} "
    if any(k in o for k in NON_CELLULAR_HINTS):
        return any(k in o for k in ["tower", "cellco", "verizon"])
    return any(k in o for k in CELLULAR_HINTS)


def fcc_towers(frame: LocalFrame, radius_m: float):
    ensure_fcc()
    near = {}
    for line in open(RAW / "CO.dat", encoding="latin-1"):
        f = line.rstrip("\n").split("|")
        if len(f) < 16 or f[5] != "T":
            continue
        try:
            lat = float(f[10]) / 3600 * (1 if f[9] == "N" else -1)
            lon = float(f[15]) / 3600 * (-1 if f[14] == "W" else 1)
        except ValueError:
            continue
        x, y = frame.to_xy(lat, lon)
        if math.hypot(x, y) <= radius_m:
            near[f[4]] = (lat, lon, float(x), float(y))
    ra, owner = {}, {}
    for line in open(RAW / "RA.dat", encoding="latin-1"):
        f = line.rstrip("\n").split("|")
        if len(f) > RA_TYPE and f[RA_USI] in near:
            ra[f[RA_USI]] = f
    for line in open(RAW / "EN.dat", encoding="latin-1"):
        f = line.rstrip("\n").split("|")
        if len(f) > 9 and f[4] in near and f[5] == "O":
            owner[f[4]] = f[9]
    towers = []
    seen = set()
    for usi, (lat, lon, x, y) in near.items():
        f = ra.get(usi)
        if not f:
            continue
        status = STATUS.get(f[RA_STATUS], f[RA_STATUS])

        def num(i):
            try:
                return float(f[i])
            except ValueError:
                return None
        key = (round(lat, 4), round(lon, 4))
        if status != "constructed" or key in seen:
            continue  # skip unbuilt and duplicate filings at the same spot
        seen.add(key)
        own = owner.get(usi, "")
        towers.append({
            "id": f"ASR-{f[3]}", "source": "FCC ASR", "lat": lat, "lon": lon,
            "x": round(x, 1), "y": round(y, 1),
            "distance_m": round(math.hypot(x, y)), "bearing_deg": round(math.degrees(math.atan2(x, y)) % 360, 1),
            "ground_m": num(RA_GROUND), "height_agl_m": num(RA_AGL), "structure_type": f[RA_TYPE],
            "owner": own, "likely_cellular": likely_cellular(own), "opencellid_lte_cells": None,
            "carriers": [],
        })
    return sorted(towers, key=lambda t: t["distance_m"])


def opencellid_cells(frame: LocalFrame, radius_m: float, key: str):
    """LTE cells from OpenCelliD in tiles (the API limits area per request)."""
    cells = []
    tile = 1800.0  # m; keeps each request under the API's area limit
    n = int(math.ceil(radius_m / tile))
    for i in range(-n, n):
        for j in range(-n, n):
            la1, lo1 = frame.to_latlon(i * tile, j * tile)
            la2, lo2 = frame.to_latlon((i + 1) * tile, (j + 1) * tile)
            q = urllib.parse.urlencode({"key": key, "BBOX": f"{la1},{lo1},{la2},{lo2}",
                                        "format": "json", "radio": "LTE", "limit": 50})
            req = urllib.request.Request("https://opencellid.org/cell/getInArea?" + q, headers={"User-Agent": UA})
            try:
                data = json.loads(urllib.request.urlopen(req, timeout=60).read())
            except Exception as e:  # noqa: BLE001
                print(f"  OpenCelliD tile failed: {type(e).__name__}")
                continue
            if "error" in data:
                print(f"  OpenCelliD error: {data.get('error')}")
                return cells
            for c in data.get("cells", []):
                x, y = frame.to_xy(c["lat"], c["lon"])
                cells.append({"x": float(x), "y": float(y), "mcc": c.get("mcc"), "mnc": c.get("mnc"),
                              "cellid": c.get("cellid"), "range": c.get("range"), "samples": c.get("samples")})
            time.sleep(0.5)
    return cells


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    ap.add_argument("--radius-km", type=float, default=12)
    args = ap.parse_args()
    folder = ROOT / "data" / "sites" / args.site
    site = json.loads((folder / "site.json").read_text())
    frame = LocalFrame(site["origin"]["lat"], site["origin"]["lon"])
    radius = args.radius_km * 1000
    towers = fcc_towers(frame, radius)
    sources = ["FCC Antenna Structure Registration bulk data (r_tower.zip), constructed structures only",
               "likely_cellular inferred from owner name (ASSUMPTION)"]
    key = get_key("OPENCELLID_API_KEY")
    cells = []
    if key:
        print(f"OpenCelliD key found in {key_source('OPENCELLID_API_KEY')}; querying ...")
        cells = opencellid_cells(frame, min(radius, 8000), key)
        for c in cells:
            c["carrier"] = CARRIERS.get(f"{c['mcc']}-{c['mnc']}", "other")
        for t in towers:
            near = [c for c in cells if math.hypot(c["x"] - t["x"], c["y"] - t["y"]) < MATCH_M]
            t["opencellid_lte_cells"] = len(near)
            t["carriers"] = sorted({c["carrier"] for c in near} - {"other"})
            if near:
                t["likely_cellular"] = True
        sources.append(f"OpenCelliD LTE cells (CC BY-SA 4.0): {len(cells)} cells within 8 km; "
                       f"matched to towers within {MATCH_M:.0f} m (ASSUMPTION)")
    else:
        print("No OPENCELLID_API_KEY found; using FCC data only.")
    out = {"site": args.site, "radius_m": radius, "fetched": dt.date.today().isoformat(),
           "sources": sources, "towers": towers,
           "opencellid_cells": [{k: (round(v, 1) if isinstance(v, float) else v) for k, v in c.items()}
                                for c in cells]}
    (folder / "towers.json").write_text(json.dumps(out, indent=1))
    n_cell = sum(t["likely_cellular"] for t in towers)
    print(f"wrote {folder}/towers.json: {len(towers)} constructed structures, {n_cell} likely cellular")
    for t in towers:
        print(f"  {t['distance_m']/1000:5.1f} km  {t['bearing_deg']:5.1f} deg  {t['height_agl_m']:5.1f} m  "
              f"{'cell' if t['likely_cellular'] else '    '}  {t['owner'][:34]:34s} {','.join(t['carriers'])}")


if __name__ == "__main__":
    main()
