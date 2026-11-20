"""Render demo.html to an MP4 (or to still frames) through headless Chrome and ffmpeg.

Serve the prototype folder first (for example `python -m http.server 8768` inside prototype/), then:
    python render.py out.mp4                 full video, 1920x1080, 30 fps
    python render.py stills_dir 3 14 40      PNG stills at those seconds
Needs Chrome, ffmpeg on PATH (or FFMPEG=...), and `pip install websockets`.
"""
import asyncio, base64, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
import websockets

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
FFMPEG = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or "ffmpeg"
URL = os.environ.get("DEMO_URL", "http://127.0.0.1:8768/platform/video/demo.html?t=0")
PORT, FPS = 9334, 30


async def main(out, stills):
    prof = tempfile.mkdtemp(prefix="tw_demo_")
    proc = subprocess.Popen([CHROME, "--headless=new", f"--remote-debugging-port={PORT}", f"--user-data-dir={prof}",
                             "--window-size=1920,1080", "--hide-scrollbars", "about:blank"])
    try:
        tabs = None
        for _ in range(150):
            try:
                tabs = json.loads(urllib.request.build_opener(urllib.request.ProxyHandler({})).open(f"http://127.0.0.1:{PORT}/json", timeout=2).read()); break
            except Exception:
                time.sleep(0.2)
        ws_url = next(t["webSocketDebuggerUrl"] for t in tabs if t["type"] == "page")
        async with websockets.connect(ws_url, max_size=2 ** 28) as ws:
            n = [0]

            async def cmd(method, **params):
                n[0] += 1; i = n[0]
                await ws.send(json.dumps({"id": i, "method": method, "params": params}))
                while True:
                    m = json.loads(await ws.recv())
                    if m.get("id") == i:
                        if "error" in m: raise RuntimeError(m["error"])
                        return m.get("result", {})

            async def ev(js):
                r = await cmd("Runtime.evaluate", expression=js, awaitPromise=True, returnByValue=True)
                if r.get("exceptionDetails"): raise RuntimeError(r["exceptionDetails"])
                return r.get("result", {}).get("value")

            await cmd("Page.navigate", url=URL)
            for _ in range(200):
                if await ev("!!window.READY"): break
                await asyncio.sleep(0.1)
            total = await ev("window.TOTAL")
            grab = "(t) => { window.render(t); return document.getElementById('c').toDataURL('image/%s'%s).split(',')[1]; }"
            if stills is not None:
                os.makedirs(out, exist_ok=True)
                for t in stills:
                    b = await ev(f"({grab % ('png', '')})({t})")
                    open(os.path.join(out, f"still_{t:05.1f}.png"), "wb").write(base64.b64decode(b))
                print("stills", stills, "total", total)
                return
            nf = int(round(total * FPS))
            ff = subprocess.Popen([FFMPEG, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-i", "-",
                                   "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
                                  stdin=subprocess.PIPE)
            t0 = time.time()
            for f in range(nf):
                b = await ev(f"({grab % ('jpeg', ', 0.95')})({f / FPS})")
                ff.stdin.write(base64.b64decode(b))
                if f % 150 == 0: print(f"frame {f}/{nf}  {time.time() - t0:.0f} s", flush=True)
            ff.stdin.close(); ff.wait()
            print("wrote", out, nf, "frames", f"{total:.1f} s")
    finally:
        proc.terminate()


if __name__ == "__main__":
    out = sys.argv[1]
    stills = [float(x) for x in sys.argv[2:]] if len(sys.argv) > 2 else None
    asyncio.run(main(out, stills))
