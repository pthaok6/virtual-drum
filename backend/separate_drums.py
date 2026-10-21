from __future__ import annotations

import sys
from pathlib import Path

import soundfile as sf
import torchaudio
import demucs.separate


def save_with_soundfile(uri, source, sample_rate, **_kwargs) -> None:
    audio = source.detach().cpu().numpy()
    if audio.ndim == 2:
        audio = audio.T
    sf.write(str(uri), audio, sample_rate, subtype="PCM_16")


def main() -> None:
    source_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    backing_path = Path(sys.argv[3])
    model = sys.argv[4]
    device = sys.argv[5]
    output_dir = output_path.parent / "demucs-output"
    torchaudio.save = save_with_soundfile
    demucs.separate.main([
        "-d", device,
        "--two-stems", "drums",
        "-n", model,
        "--out", str(output_dir),
        str(source_path),
    ])
    separated_path = output_dir / model / source_path.stem / "drums.wav"
    backing_separated_path = output_dir / model / source_path.stem / "no_drums.wav"
    if not separated_path.exists():
        raise FileNotFoundError(f"Demucs output not found: {separated_path}")
    separated_path.replace(output_path)
    if not backing_separated_path.exists():
        raise FileNotFoundError(f"Demucs backing output not found: {backing_separated_path}")
    backing_separated_path.replace(backing_path)


if __name__ == "__main__":
    main()
