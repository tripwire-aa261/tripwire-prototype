"""Local server for the Tripwire Twin viewer.

    .venv/bin/python serve.py [--port 8000]

Then open http://localhost:8000. Serves the viewer (web/), site data (data/sites/) and a small API
so the page can start new physics simulations:
    GET  /api/meta            parameter defaults, sources, drone models, calibration summary
    GET  /api/runs            list of finished runs
    POST /api/run             start a run, body: {"site": "hays|hancock|fulton", "params": {...}, "id": "optional-name"}
    POST /api/sweep           coverage/cost vs node count for one design, body: {"drone": ..., "design": {...}}
    GET  /api/job/<id>        progress of a run
Binds 127.0.0.1 only. One simulation at a time.
"""
from __future__ import annotations

import argparse
import json
import re
import threading
import traceback
import uuid
from dataclasses import asdict
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent

JOBS: dict[str, dict] = {}
LOCK = threading.Lock()


def meta() -> dict:
    from twin.antenna import ANTENNAS
    from twin.config import ASSUMPTION_TABLE, CAL_PATH, DRONES, PARAM_SOURCES, PROCESSING, Params
    cal = json.loads(CAL_PATH.read_text()) if CAL_PATH.exists() else None
    return {"defaults": Params().to_dict(), "param_sources": PARAM_SOURCES, "assumptions": ASSUMPTION_TABLE,
            "drones": {k: asdict(v) for k, v in DRONES.items()}, "calibration": cal,
            "antennas": {k: asdict(v) for k, v in ANTENNAS.items()}, "processing": PROCESSING,
            "sites": __import__("twin.scenarios", fromlist=["SITE_IDS"]).SITE_IDS}


def _clean_id(raw) -> str | None:
    return re.sub(r"[^a-zA-Z0-9_-]", "-", str(raw or "").strip())[:60] or None


def start_sweep(body: dict) -> str:
    """One custom design across the standard node counts (~15-30 s)."""
    from twin.config import DRONES
    from twin.sweep import sweep
    if not LOCK.acquire(blocking=False):
        raise RuntimeError("a simulation is already running")
    job = uuid.uuid4().hex[:8]
    JOBS[job] = {"status": "running", "done": 0, "total": 0, "run_id": None, "error": None}
    d = body.get("design") or {}
    allowed = {"antenna", "rx_elements", "faces", "rx_gain_dbi", "processing", "mic_range_m", "pointing"}
    pdesign = {k: v for k, v in d.items() if k in allowed}
    drone = body.get("drone") if body.get("drone") in DRONES else "m210"
    label = str(body.get("label") or "custom design")[:80]
    radio = body.get("radio") if body.get("radio") in ("b210", "bladerf", "custom") else "bladerf"
    sid = _clean_id(body.get("id")) or f"custom-{drone}-{uuid.uuid4().hex[:4]}"

    def work():
        try:
            sweep({"custom": {"label": label, "stage": "custom", "radio": radio, "p": pdesign}}, drone, sid,
                  progress=lambda k, n: JOBS[job].update(done=k, total=n))
            JOBS[job].update(status="finished", run_id=sid)
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            JOBS[job].update(status="failed", error=f"{type(e).__name__}: {e}")
        finally:
            LOCK.release()

    threading.Thread(target=work, daemon=True).start()
    return job


def start_job(body: dict) -> str:
    from twin.config import Params
    from twin.run import run
    if not LOCK.acquire(blocking=False):
        raise RuntimeError("a simulation is already running")
    job = uuid.uuid4().hex[:8]
    run_id = _clean_id(body.get("id"))
    JOBS[job] = {"status": "running", "done": 0, "total": 0, "run_id": None, "error": None}

    from twin.scenarios import SITE_IDS
    site = body.get("site") if body.get("site") in SITE_IDS else "hays"

    def work():
        try:
            p = Params.from_dict(body.get("params") or {})
            doc = run(site, p, run_id,
                      progress=lambda k, n: JOBS[job].update(done=k, total=n))
            JOBS[job].update(status="finished", run_id=doc["id"])
        except Exception as e:  # noqa: BLE001 - report any failure to the page
            traceback.print_exc()
            JOBS[job].update(status="failed", error=f"{type(e).__name__}: {e}")
        finally:
            LOCK.release()

    threading.Thread(target=work, daemon=True).start()
    return job


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):  # quieter console
        if "/api/job/" not in (args[0] if args else ""):
            super().log_message(fmt, *args)

    def _json(self, obj, status=HTTPStatus.OK):
        data = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/", "/index.html"):
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Location", "/web/")
            self.end_headers()
            return
        if path == "/api/meta":
            return self._json(meta())
        if path == "/api/runs":
            idx = ROOT / "web" / "runs" / "index.json"
            return self._json(json.loads(idx.read_text()) if idx.exists() else {"runs": []})
        if path.startswith("/api/job/"):
            job = JOBS.get(path.rsplit("/", 1)[-1])
            return self._json(job or {"status": "unknown"}, HTTPStatus.OK if job else HTTPStatus.NOT_FOUND)
        # Static files: only the viewer and site data are exposed.
        if not (path.startswith("/web/") or path.startswith("/data/sites/") or path.startswith("/v0.1/")):
            return self._json({"error": "not found"}, HTTPStatus.NOT_FOUND)
        return super().do_GET()

    def do_POST(self):
        if self.path not in ("/api/run", "/api/sweep"):
            return self._json({"error": "not found"}, HTTPStatus.NOT_FOUND)
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
            return self._json({"job": (start_job if self.path == "/api/run" else start_sweep)(body)})
        except Exception as e:  # noqa: BLE001
            return self._json({"error": str(e)}, HTTPStatus.CONFLICT)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    a = ap.parse_args()
    # Rebuild the run lists from the run files present (they are not committed).
    from twin.run import _update_index
    from twin.sweep import _index as _sweep_index
    _update_index()
    if (ROOT / "web" / "runs" / "sweeps").exists():
        _sweep_index()
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
    print(f"Tripwire Twin: open http://localhost:{a.port}  (Ctrl+C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
