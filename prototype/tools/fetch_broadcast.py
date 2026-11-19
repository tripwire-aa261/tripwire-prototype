"""Fetch licensed digital TV and FM transmitters around each site from the FCC (v0.6).

Source: FCC TV Query and FM Query (transition.fcc.gov/fcc-bin/tvq, /fmq), list=4 text output: call sign, RF channel or
frequency, ERP, antenna height above mean sea level (RCAMSL), coordinates. MEASURED data; nothing here is assumed except
the frequency of each US TV channel (STANDARD: 47 CFR 73.603 channel plan) and the bandwidths (ATSC 6 MHz, FM 200 kHz).

Writes data/sites/<id>/broadcast.json. Run: python -m tools.fetch_broadcast
"""
from __future__ import annotations

import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from twin.geo import LocalFrame  # noqa: E402
from twin.scenarios import SITE_IDS  # noqa: E402

TV_KM, FM_KM = 80, 60


def _dms(lat: float, lon: float) -> str:
    def split(v):
        v = abs(v); d = int(v); m = int((v - d) * 60); s = round(((v - d) * 60 - m) * 60, 1)
        return d, m, s
    a, b = split(lat), split(lon)
    return (f"dlat2={a[0]}&mlat2={a[1]}&slat2={a[2]}&NS={'N' if lat >= 0 else 'S'}"
            f"&dlon2={b[0]}&mlon2={b[1]}&slon2={b[2]}&EW={'W' if lon < 0 else 'E'}")


def tv_channel_hz(ch: int) -> float:
    """Centre frequency of US TV RF channel ch (47 CFR 73.603)."""
    if 2 <= ch <= 4:
        return (54 + 6 * (ch - 2) + 3) * 1e6
    if 5 <= ch <= 6:
        return (76 + 6 * (ch - 5) + 3) * 1e6
    if 7 <= ch <= 13:
        return (174 + 6 * (ch - 7) + 3) * 1e6
    return (470 + 6 * (ch - 14) + 3) * 1e6


def _get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "tripwire-twin/0.6 (research)"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read().decode("latin-1")
        except Exception:  # noqa: BLE001 - FCC server is occasionally slow, and some Python installs lack its CA chain
            try:  # fall back to curl, which uses the system certificate store
                import subprocess
                return subprocess.run(["curl", "-s", "-m", "60", url], capture_output=True, check=True).stdout.decode("latin-1")
            except Exception:  # noqa: BLE001
                time.sleep(3 * (attempt + 1))
    raise RuntimeError("FCC query failed: " + url)


def _num(s: str) -> float:
    s = s.replace("kW", "").replace("m", "").strip()
    try:
        return float(s)
    except ValueError:  # '-' = not listed
        return 0.0


def parse(text: str, kind: str, frame: LocalFrame) -> list[dict]:
    out = []
    for line in text.splitlines():
        f = [x.strip() for x in line.split("|")]
        if len(f) < 32 or f[9] != "LIC":
            continue
        if kind == "tv" and f[3] not in ("DTV", "DT"):
            continue
        if kind == "fm" and f[3] != "FM":  # full-power FM only (no translators FX / boosters FB / low-power FL)
            continue
        lat = (float(f[20]) + float(f[21]) / 60 + float(f[22]) / 3600) * (1 if f[19] == "N" else -1)
        lon = (float(f[24]) + float(f[25]) / 60 + float(f[26]) / 3600) * (-1 if f[23] == "W" else 1)
        x, y = frame.to_xy(lat, lon)
        if kind == "tv":
            ch = int(f[4]); freq, bw = tv_channel_hz(ch), 6e6
        else:
            ch = None; freq, bw = float(f[2].replace("MHz", "")) * 1e6, 200e3
        erp_kw = _num(f[14]) if f[14] not in ("-", "") else _num(f[15])
        out.append({"call": f[1], "kind": kind, "channel": ch, "freq_hz": freq, "bw_hz": bw, "erp_kw": erp_kw,
                    "rcamsl_m": _num(f[31]), "lat": round(lat, 6), "lon": round(lon, 6), "x": round(float(x), 1),
                    "y": round(float(y), 1), "distance_km": _num(f[28].replace("km", "")), "owner": f[27][:60]})
    # one entry per transmitter and channel (the query lists some stations twice)
    seen, uniq = set(), []
    for t in sorted(out, key=lambda t: t["distance_km"]):
        k = (t["call"], round(t["freq_hz"]))
        if k not in seen:
            seen.add(k); uniq.append(t)
    return uniq


def fetch(key: str) -> dict:
    folder = ROOT / "data" / "sites" / SITE_IDS[key]
    meta = json.loads((folder / "site.json").read_text())
    o = meta["origin"]
    frame = LocalFrame(o["lat"], o["lon"])
    loc = _dms(o["lat"], o["lon"])
    tv = parse(_get(f"https://transition.fcc.gov/fcc-bin/tvq?list=4&{loc}&dist={TV_KM}&size=9&serv=DT"), "tv", frame)
    fm = parse(_get(f"https://transition.fcc.gov/fcc-bin/fmq?list=4&{loc}&dist={FM_KM}&size=9"), "fm", frame)
    doc = {"site": SITE_IDS[key], "fetched": time.strftime("%Y-%m-%d"), "source": "FCC TV Query / FM Query (list=4)",
           "radius_km": {"tv": TV_KM, "fm": FM_KM}, "transmitters": tv + fm}
    (folder / "broadcast.json").write_text(json.dumps(doc, indent=1))
    print(f"{key}: {len(tv)} TV, {len(fm)} FM transmitters")
    return doc


if __name__ == "__main__":
    for k in (sys.argv[1:] or list(SITE_IDS)):
        fetch(k)
