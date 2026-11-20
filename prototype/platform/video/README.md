# Demo video

`demo.html` draws a 70-second presentation film from the platform app's flight simulator data
(`../data/flights.json`, `../data/explore.json`): title, the Hays site, one 0.9 kg drone flight with cell + TV
(echoes, track, alert), the same flight with cell towers only, and a closing card. Every number on screen is
computed from those files, so re-running the twin and `tools/flight_demo_v1.py` updates the video.

Watch it live: serve `prototype/` (`python -m http.server 8768` inside it) and open
http://127.0.0.1:8768/platform/video/demo.html?play (or `?t=24` for one frame).

Render the MP4 (1920x1080, 30 fps; needs Chrome, ffmpeg and `pip install websockets`):

    python render.py tripwire_demo.mp4
    python render.py stills_dir 13 24 57      # PNG stills at those seconds

The simulation is one random draw per 1.5 s frame: the track at Hays is confirmed 466 m out, drops for 7 frames,
is held again from 345 m to the fence, and drops while the drone hovers. The captions say so.
