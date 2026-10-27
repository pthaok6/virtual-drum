from __future__ import annotations

import os
import logging
import base64
import subprocess
import sys
import tempfile
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

MAX_BYTES = 50 * 1024 * 1024
ANALYSIS_SECONDS = 120
ANALYSIS_SAMPLE_RATE = 44100
ALLOWED_SUFFIXES = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".webm"}

raw_origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
allowed_origins = [o.strip().rstrip("/") for o in raw_origins.split(",") if o.strip()]
if "*" in allowed_origins:
    allowed_origins = ["*"]

app = FastAPI(title="Virtual Drum song analysis")
logger = logging.getLogger("uvicorn.error")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def classify_onset(audio: np.ndarray, sample_rate: int, time: float) -> str:
    start = max(0, int(time * sample_rate))
    segment = audio[start : start + int(sample_rate * 0.08)]
    if len(segment) < int(sample_rate * 0.02):
        return "snare"
    spectrum = np.abs(np.fft.rfft(segment * np.hanning(len(segment))))
    frequencies = np.fft.rfftfreq(len(segment), 1 / sample_rate)
    low = float(spectrum[(frequencies >= 30) & (frequencies < 150)].sum())
    mid = float(spectrum[(frequencies >= 150) & (frequencies < 6000)].sum())
    high = float(spectrum[(frequencies >= 6000) & (frequencies < 12000)].sum())
    if low > mid * 1.15 and low > high:
        return "kick"
    if high > mid * 0.45:
        return "hihat"
    return "snare"


@app.post("/api/analyze")
def analyze(file: UploadFile = File(...)) -> dict:
    suffix = Path(file.filename or "song").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(415, "Choose a supported audio file.")
    contents = file.file.read(MAX_BYTES + 1)
    if not contents or len(contents) > MAX_BYTES:
        raise HTTPException(413, "Choose an audio file smaller than 50 MB.")

    try:
        with tempfile.TemporaryDirectory(prefix="virtual-drum-") as work_dir:
            input_path = Path(work_dir) / f"upload{suffix}"
            analysis_path = Path(work_dir) / "first-two-minutes.wav"
            drum_path = Path(work_dir) / "drums.wav"
            backing_path = Path(work_dir) / "no_drums.wav"
            input_path.write_bytes(contents)
            # Keep and analyze only the requested window; later audio is discarded.
            source_audio, source_rate = librosa.load(
                input_path, sr=ANALYSIS_SAMPLE_RATE, mono=False, duration=ANALYSIS_SECONDS
            )
            analyzed_duration = float(source_audio.shape[-1] / source_rate)
            if analyzed_duration < 3:
                raise HTTPException(422, "Choose an audio file at least 3 seconds long.")
            sf.write(analysis_path, source_audio.T if source_audio.ndim == 2 else source_audio, source_rate, subtype="PCM_16")
            try:
                subprocess.run(
                    [sys.executable, str(Path(__file__).with_name("separate_drums.py")),
                     str(analysis_path), str(drum_path), str(backing_path), os.getenv("DEMUCS_MODEL", "htdemucs"),
                     os.getenv("DEMUCS_DEVICE", "cpu")],
                    check=True, capture_output=True, text=True, timeout=1200,
                )
            except subprocess.TimeoutExpired as error:
                raise HTTPException(504, "Drum separation took too long. Try a shorter song.") from error
            except subprocess.CalledProcessError as error:
                details = (error.stderr or error.stdout or "").strip()
                logger.error("Demucs failed (exit %s): %s", error.returncode, details[-3000:])
                if "No module named 'demucs'" in details or "No module named demucs" in details:
                    raise HTTPException(503, "Demucs is not installed. Install backend/requirements.txt.") from error
                message = details.splitlines()[-1] if details else "unknown Demucs error"
                raise HTTPException(422, f"Could not separate drums: {message}") from error
            if not drum_path.exists():
                raise HTTPException(422, "Drum separation did not produce an audio track.")
            if not backing_path.exists():
                raise HTTPException(422, "Drum separation did not produce a backing track.")
            audio, sample_rate = librosa.load(drum_path, sr=22050, mono=True)
            backing_audio, backing_rate = librosa.load(backing_path, sr=22050, mono=True)
            backing_audio = np.clip(backing_audio, -1, 1)
            backing_pcm = (backing_audio * 32767).astype("<i2").tobytes()
        duration = float(len(audio) / sample_rate)
        if duration < 3 or duration > ANALYSIS_SECONDS + 1:
            raise HTTPException(422, "Could not analyze the first two minutes of this audio.")
        tempo, beat_frames = librosa.beat.beat_track(y=audio, sr=sample_rate)
        bpm = float(np.asarray(tempo).reshape(-1)[0])
        if not np.isfinite(bpm) or bpm <= 0:
            raise HTTPException(422, "Could not estimate a tempo for this audio.")
        onset_frames = librosa.onset.onset_detect(y=audio, sr=sample_rate, backtrack=True)
        onset_times = librosa.frames_to_time(onset_frames, sr=sample_rate)
        # Keep the chart readable and avoid duplicate onset detections within 70 ms.
        notes = []
        last_time = -1.0
        for time in onset_times:
            seconds = float(time)
            if seconds - last_time < 0.07:
                continue
            notes.append({"time": round(seconds, 3), "lane": classify_onset(audio, sample_rate, seconds)})
            last_time = seconds
        beats = librosa.frames_to_time(beat_frames, sr=sample_rate)
        return {
            "bpm": round(bpm, 1),
            "durationSeconds": round(duration, 3),
            "analyzedDurationSeconds": round(analyzed_duration, 3),
            "beatTimes": [round(float(time), 3) for time in beats],
            "notes": notes,
            # Mono 22.05 kHz PCM keeps the two-minute browser-stored backing track compact.
            "backingAudioBase64": base64.b64encode(backing_pcm).decode("ascii"),
            "backingSampleRate": backing_rate,
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Song analysis failed")
        raise HTTPException(422, "Could not analyze this audio file. Try another file.") from error
    finally:
        file.file.close()
