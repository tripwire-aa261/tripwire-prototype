"""All model inputs in one place, each tagged with where it comes from.

Tags: CITED (a published source), STANDARD (a specification or textbook method), MEASURED
(fetched data, e.g. FCC/OSM/USGS), ASSUMPTION (placeholder for the team to replace).
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field, fields
from pathlib import Path

CAL_PATH = Path(__file__).resolve().parent / "calibration.json"


@dataclass(frozen=True)
class DroneModel:
    id: str
    name: str
    size_m: float  # largest dimension
    rcs_m2: float  # body RCS at UHF (ASSUMPTION)
    rotors: int
    blades: int
    rotor_radius_m: float
    rotor_hz: float  # revolutions per second in forward flight
    blade_rcs_fraction: float  # blade echo power relative to body (carbon/plastic blades: weak)


# ASSUMPTION: UHF RCS values. Published small-UAV measurements span ~0.001-0.1 m^2 depending on
# frequency, aspect and polarisation. After calibration only RATIOS to the Matrice 210 matter.
DRONES = {
    "mini": DroneModel("mini", "Mini (<250 g, DJI Mini class)", 0.25, 0.003, 4, 2, 0.075, 130, 0.10),
    "mavic": DroneModel("mavic", "Mavic-class (0.9 kg)", 0.38, 0.01, 4, 2, 0.12, 100, 0.10),
    "m210": DroneModel("m210", "Matrice 210 (5 kg, the Fraunhofer trial drone)", 0.88, 0.10, 4, 2, 0.22, 60, 0.10),
    "heavy": DroneModel("heavy", "Heavy-lift (1.2 m, 10+ kg)", 1.2, 0.30, 6, 2, 0.27, 50, 0.10),
}


@dataclass(frozen=True)
class BirdModel:
    name: str = "Crow-sized bird"
    size_m: float = 0.45  # wingspan
    rcs_m2: float = 0.005  # ASSUMPTION (UHF)
    wingbeat_hz: float = 4.5  # ASSUMPTION
    wing_rcs_fraction: float = 0.3  # ASSUMPTION
    speed_mps: float = 10.0  # ASSUMPTION


BIRD = BirdModel()

# ASSUMPTION: one 10 MHz low-band LTE carrier per operator. Bands are real (3GPP TS 36.101);
# the exact channel each operator uses at this site is not known.
BANDS = {
    "AT&T": {"band": "B17/B12", "freq_hz": 739.0e6, "bw_mhz": 10},
    "Verizon": {"band": "B13", "freq_hz": 751.0e6, "bw_mhz": 10},
    "T-Mobile": {"band": "B71", "freq_hz": 627.5e6, "bw_mhz": 10},
}
# Which LTE downlink resource elements (REs) the processing uses. Per resource block and 0.5 ms slot
# there are 12 x 7 = 84 REs (TS 36.211, normal cyclic prefix). The Fraunhofer method uses port-0 CRS in
# one symbol per slot: 2 REs. All CRS of a 2-port cell: 8 REs (ASSUMPTION: 2 ports). Full signal: CRS plus
# every RE carrying data or control, i.e. 76 x network load (ASSUMPTION), rebuilt by demodulating the
# downlink. Gain = more REs integrated, applied as an ideal reduction of the noise floor (ASSUMPTION:
# optimistic for full signal, where reconstruction errors add their own residue).
PROCESSING = {
    "crs_p0": "Cell reference signals, port 0, one symbol per slot (Fraunhofer method)",
    "crs_all": "All cell reference signals (2 ports, 2 symbols per slot)",
    "full": "Full signal: reference + data/control resource elements, rebuilt by demodulating",
}


def processing_gain_db(mode: str, load: float) -> float:
    used = {"crs_p0": 2.0, "crs_all": 8.0, "full": 8.0 + 76.0 * max(load, 0.0)}[mode]
    return float(10 * __import__("math").log10(used / 2.0))


DEFAULT_OPERATOR = "AT&T"  # ASSUMPTION: towers with no OpenCelliD evidence carry the area's largest carrier


@dataclass
class Params:
    # --- receiver node ---
    n_listeners: int = 6
    rx_gain_dbi: float = 5.0  # only used when antenna == "iso" (v0.2 behavior)
    rx_elements: int = 1
    antenna: str = "patch"  # omni | patch | lpda | yagi | iso (see antenna.py)
    faces: int = 1  # directions the elements are split over (1 = one array; = elements: fan)
    pointing: str = "inward"  # inward: face the facility; auto: also turn away from strong towers
    nf_db: float = 6.0
    adc_bits: int = 12
    adc_backoff_db: float = 12.0
    mast_m: float = 6.0
    mount: str = "pole"  # pole: on a mast at the perimeter | structure: on the building at the perimeter | mixed: alternate
    setback_m: float = 0.0  # pole sensors this far outside the perimeter line (e.g. a plaza around a stadium)
    structure_inset_m: float = 12.0  # structure sensors this far inside the outline (on the top of the stands)
    roof_mast_m: float = 3.0  # short mast above the structure's top
    # --- processing ---
    cit_s: float = 0.5
    pfa: float = 1e-6
    dpc_rank: int = 1
    processing: str = "crs_p0"  # crs_p0 | crs_all | full (see PROCESSING)
    max_illuminators: int = 6
    cochannel_suppression_db: float = 20.0
    network_load: float = 0.3
    max_range_m: float = 3000.0
    # --- illuminators ---
    eirp_dbw: float = 30.0
    downtilt_deg: float = 4.0
    antenna_height_fraction: float = 0.9
    max_tower_km: float = 10.0
    # --- targets & scene ---
    drone: str = "mavic"
    altitude_agl_m: float = 60.0
    speed_mps: float = 12.0
    hover_s: float = 6.0
    bird: bool = True
    ground_gamma: float = 0.7
    vegetation_fraction: float = 0.3
    vegetation_spread_hz: float = 1.5
    zone_buffer_m: float = 150.0
    mic_range_m: float = 0.0  # acoustic detection range of an optional microphone per node (0 = none)
    hover_history: bool = False  # hold a stopped track by comparing with the learned quiet background (hover.py)
    background_stability_db: float = -30.0  # what is left of the static background after subtracting its history
    hover_dwell_s: float = 4.8  # longest listening time on a stopped track
    # --- v1.0 multi-band sensor ---
    signals: str = "cell"  # cell | cell+tv: which illuminators the design-point simulation uses (multiband.py)
    tv_transmitters: int = 3  # digital TV channels processed per sensor (TV bank tuning plan, ASSUMPTION)
    # --- run ---
    frame_dt_s: float = 1.5
    seed: int = 7
    lumped_loss_db: float | None = None  # None -> read calibration.json
    dpi_residual_db: float | None = None  # None -> read calibration.json

    def _cal(self, key: str, default: float) -> float:
        if CAL_PATH.exists():
            return float(json.loads(CAL_PATH.read_text()).get(key, default))
        return default

    def resolved_loss_db(self) -> float:
        return self.lumped_loss_db if self.lumped_loss_db is not None else self._cal("lumped_loss_db", 0.0)

    def resolved_dpi_db(self) -> float:
        return self.dpi_residual_db if self.dpi_residual_db is not None else self._cal("dpi_residual_db", 70.0)

    @classmethod
    def from_dict(cls, d: dict) -> "Params":
        names = {f.name: f for f in fields(cls)}
        out = {}
        for k, v in (d or {}).items():
            if k not in names or v is None:
                continue
            t = type(getattr(cls(), k))
            out[k] = (str(v).lower() in ("1", "true", "yes", "on")) if t is bool else (t(v) if t in (int, float, str) else v)
        return cls(**out)

    def to_dict(self) -> dict:
        return asdict(self)


# What each parameter means and where its default comes from (shown in the web page).
PARAM_SOURCES = {
    "n_listeners": ("Listener nodes on the fence line", "design choice"),
    "rx_gain_dbi": ("Antenna gain toward every direction (only for antenna = iso, the v0.2 model)", "ASSUMPTION"),
    "rx_elements": ("Antenna elements per node", "design choice; the Fraunhofer validation trial used 4 Yagis"),
    "antenna": ("Element type: gain, beamwidths, front-to-back (antenna.py)", "ASSUMPTION: typical datasheet values"),
    "faces": ("Directions a node's elements are split over; elements per face are combined coherently (+10 log10 of elements per face)", "design choice"),
    "pointing": ("inward: face the middle of the facility; auto: turn each node (up to 90 deg) to maximise detections over the zone", "design choice"),
    "processing": ("Which LTE resource elements are used (crs_p0 = Fraunhofer method)", "crs_p0 CITED; gains of crs_all and full ASSUMPTION (TS 36.211 resource counts)"),
    "mic_range_m": ("Acoustic detection range per node (optional microphone)", "ASSUMPTION"),
    "hover_history": ("Hold a stopped (hovering) track by background history: compare each distance bin with its learned quiet level", "design choice (hover.py)"),
    "background_stability_db": ("Leftover of the static background after subtracting its learned history (-40 dB = echoes steady to ~1 %)", "ASSUMPTION: to be measured on Seed recordings; tools/hover_feasibility.py"),
    "hover_dwell_s": ("Longest listening time on a stopped track", "ASSUMPTION"),
    "signals": ("Illuminators used: cell towers only, or cell towers plus licensed digital TV transmitters (UHF TV bank)", "design choice (multiband.py)"),
    "tv_transmitters": ("Digital TV channels processed per sensor (strongest drone echo over the site)", "ASSUMPTION: the TV bank's tuning plan fits them"),
    "nf_db": ("Receiver noise figure", "ASSUMPTION (typical SDR front end)"),
    "adc_bits": ("ADC resolution", "CITED: USRP B210 = 12 bit (Ettus); KrakenSDR/RTL = 8 bit"),
    "adc_backoff_db": ("ADC headroom for OFDM peaks", "ASSUMPTION"),
    "mast_m": ("Listener mast height", "ASSUMPTION"),
    "mount": ("Where sensors go: poles at the perimeter, on the structure itself (stadium stands), or alternating", "design choice; tools/placement_study.py"),
    "setback_m": ("Pole sensors stand this far outside the perimeter line", "ASSUMPTION"),
    "structure_inset_m": ("Structure sensors sit this far inside the building outline (the top of the stands)", "ASSUMPTION"),
    "roof_mast_m": ("Mast above the structure's top for structure-mounted sensors", "ASSUMPTION"),
    "cit_s": ("Coherent integration time", "CITED: 0.8 s in Demissie & Steffes 2025; default 0.5 s (ASSUMPTION, manoeuvring drone)"),
    "pfa": ("False-alarm probability per range-Doppler cell (CFAR)", "ASSUMPTION"),
    "dpc_rank": ("Singular components removed (direct path + static clutter)", "CITED: SVD method, Demissie & Steffes 2025 eq. 13"),
    "max_illuminators": ("LTE cells processed per node", "ASSUMPTION (receiver channel budget)"),
    "cochannel_suppression_db": ("Suppression of same-carrier neighbour cells (spatial + known-CRS cancellation)", "ASSUMPTION"),
    "network_load": ("Share of LTE data resource elements in use (drives co-channel leakage)", "ASSUMPTION"),
    "max_range_m": ("Largest bistatic range processed", "below the 3.33 km CRS ambiguity (STANDARD)"),
    "eirp_dbw": ("LTE sector EIRP (10 MHz)", "ASSUMPTION: 60 dBm (46 dBm + 15 dBi - 1 dB)"),
    "downtilt_deg": ("Sector downtilt", "ASSUMPTION"),
    "antenna_height_fraction": ("Antenna height / structure height", "ASSUMPTION; structure heights MEASURED (FCC ASR)"),
    "max_tower_km": ("Towers considered", "MEASURED positions (FCC ASR)"),
    "drone": ("Drone model", "see DRONES; RCS values ASSUMPTION"),
    "altitude_agl_m": ("Drone height above ground", "scenario"),
    "speed_mps": ("Drone speed", "scenario"),
    "hover_s": ("Hover time over the drop point", "scenario"),
    "bird": ("Add a crow-sized bird", "scenario"),
    "ground_gamma": ("Ground reflection coefficient magnitude", "ASSUMPTION (rough ground, horizontal pol.)"),
    "vegetation_fraction": ("Share of clutter that moves (wind-blown trees)", "ASSUMPTION"),
    "vegetation_spread_hz": ("Doppler spread of moving clutter", "ASSUMPTION"),
    "zone_buffer_m": ("Protected zone = fence + buffer", "CITED: memo release gate, 150 m"),
    "frame_dt_s": ("Time between processed frames", "run setting"),
    "lumped_loss_db": ("Calibrated lumped loss (echo only)", "fit to Demissie & Steffes 2025, Fig. 11 + Table 1 (calibration.json)"),
    "dpi_residual_db": ("Direct-signal cancellation depth: leftover sits this far below the direct signal",
                        "fit to Demissie & Steffes 2025, Fig. 11 + Table 1 (calibration.json)"),
}

ASSUMPTION_TABLE = [
    ("LTE CRS sequence and mapping", "Gold sequence, QPSK, every 6th subcarrier, port 0", "STANDARD: 3GPP TS 36.211 §6.10.1, §7.2"),
    ("Range-Doppler processing", "inverse filter on CRS, SVD direct-path removal, 2D FFT", "CITED: Demissie & Steffes 2025, §2.2-2.4"),
    ("Detection", "2D cell-averaging CFAR", "STANDARD (Richards, Fundamentals of Radar Signal Processing)"),
    ("Terrain diffraction", "Bullington method with 4/3 Earth", "STANDARD: ITU-R P.526-15 §4.5.1"),
    ("Sector antenna pattern", "65° azimuth / 10° elevation beamwidth, 30/20 dB floors", "STANDARD: 3GPP TR 36.814 Table A.2.1.1-2"),
    ("Ground reflection", f"two-ray, |Γ| = {Params.ground_gamma}", "STANDARD model; |Γ| ASSUMPTION"),
    ("Towers", "positions and heights", "MEASURED: FCC Antenna Structure Registration"),
    ("Carriers per tower", "LTE cells within 600 m", "MEASURED: OpenCelliD (weak evidence; positions are phone-report averages)"),
    ("Site", "fence and buildings", "MEASURED: OpenStreetMap; building heights 7 m ASSUMPTION"),
    ("Terrain", "elevation", "MEASURED: USGS 3DEP"),
    ("Sector azimuths, EIRP, carrier channels", "see parameters", "ASSUMPTION"),
    ("Drone and bird RCS", "see drone models", "ASSUMPTION; only ratios to the M210 matter after calibration"),
    ("Calibration target 1", "M210 detected to ~1600 m bistatic range at Pfa 1e-4 (receiver near the eNodeB)", "CITED: Demissie & Steffes 2025, Fig. 11"),
    ("Calibration target 2", "Pd ~83 % (75-96 %) at Pfa 0.008, 2 eNodeBs ~10 km away", "CITED: Demissie & Steffes 2025, Table 1"),
    ("Receive antennas", "omni 2 dBi; log-periodic 7 dBi, 70 deg; patch 8 dBi, 70 deg; Yagi 11 dBi, 50 deg; 18-20 dB front-to-back", "ASSUMPTION: typical datasheet values (antenna.py); parabolic pattern like 3GPP TR 36.814"),
    ("Antenna pointing", "nodes face the middle of the facility (or auto-turned to maximise zone detections), beams tilted up 5 deg; faces meet at half-power edges", "ASSUMPTION / design choice"),
    ("Arrays", "elements behind one face combine coherently: +10 log10(N) on every noise term (ideal; no channel mismatch or nulling)", "ASSUMPTION"),
    ("Several faces in the signal simulation", "each frame uses the face that sees the drone best", "SIMPLIFICATION: equals detecting on every element and keeping the best, without the extra false alarms"),
    ("Processing modes", "port-0 CRS 2 REs per RB-slot; all CRS 8; full signal 8 + 76 x load", "STANDARD RE counts (TS 36.211); ideal gain ASSUMPTION"),
    ("Microphones (optional)", "detect a drone within mic_range_m of a node; located when 2+ nodes hear it", "ASSUMPTION; acoustic range to be sourced"),
    ("Hover hold by background history", "a held track that stops is kept when 3+ pairs see a steady new echo above noise + background x stability (ground sigma0 -20 dB + buildings), listening up to hover_dwell_s; cued only (never starts a track)", "ASSUMPTION: stability -30 dB default; twin/hover.py"),
    ("Independent validation", "not yet done: both Fraunhofer trials are used for fitting", "NEXT: arXiv 2412.20788 LTE tracking trial"),
]
