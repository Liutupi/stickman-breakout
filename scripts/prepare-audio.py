"""Import ordinary MP3 music and normalize short voice announcements.

Usage: python scripts/prepare-audio.py --music SOURCE_DIR --voices SOURCE_DIR
Requires ffmpeg on PATH or the imageio-ffmpeg Python package. Music and voices
use two-pass loudnorm at -16 LUFS, encoded as stereo 44.1 kHz 192 kbps MP3.
Music uses a -1.5 dBTP ceiling. Voices use -2 dBTP to leave MP3 headroom.
Original inputs are never modified. Missing tracks are left untouched.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import math
from pathlib import Path
import re
import shutil
import subprocess


TRACKS = [
    ("*Eternal*Rave*.mp3", "bgm/level-06-eternal-rave.mp3"),
    ("*BABYDOLL*.mp3", "bgm/level-07-babydoll.mp3"),
    ("*AGUDO*.mp3", "bgm/level-08-agudo-magklco.mp3"),
    ("*Tranquility*.mp3", "bgm/level-09-sea-of-tranquility.mp3"),
    ("*REVENGE*.mp3", "bgm/level-10-revenge-super-slowed.mp3"),
]
VOICES = [
    ("一杀.mp3", "voices/kill-1.mp3"),
    ("二杀.mp3", "voices/kill-2.mp3"),
    ("三杀.mp3", "voices/kill-3.mp3"),
    ("四杀.mp3", "voices/kill-4.mp3"),
    ("你的胆子真是肥嘟嘟的.mp3", "voices/boss-06-settlement.mp3"),
]


def find_ffmpeg():
    executable = shutil.which("ffmpeg")
    if executable:
        return executable
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def measure_loudness(executable, source, true_peak=-2):
    result = subprocess.run([
        executable, "-hide_banner", "-nostdin", "-i", str(source),
        "-af", f"loudnorm=I=-16:TP={true_peak}:LRA=11:print_format=json",
        "-f", "null", "-",
    ], check=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    measurements = json.loads(re.findall(r"\{[^{}]+\}", result.stderr)[-1])
    if not all(math.isfinite(float(measurements[key]))
               for key in ["input_i", "input_tp", "input_lra", "input_thresh"]):
        raise ValueError(f"Cannot measure finite audio loudness: {source.name}")
    return measurements


def import_mp3(item):
    executable, source, destination = item
    destination.parent.mkdir(parents=True, exist_ok=True)
    is_voice = destination.parent.name == "voices"
    true_peak = -2 if is_voice else -1.5
    before = measure_loudness(executable, source, true_peak)
    filter_spec = (
        f"loudnorm=I=-16:TP={true_peak}:LRA=11:linear=true:"
        f"measured_I={before['input_i']}:"
        f"measured_TP={before['input_tp']}:"
        f"measured_LRA={before['input_lra']}:"
        f"measured_thresh={before['input_thresh']}:"
        f"offset={before['target_offset']}"
    )
    encoding = ["-af", filter_spec, "-codec:a", "libmp3lame", "-b:a", "192k",
                "-ar", "44100", "-ac", "2"]
    subprocess.run([
        executable, "-hide_banner", "-nostdin", "-v", "error", "-y",
        "-i", str(source), "-map", "0:a:0", *encoding,
        "-map_metadata", "-1", "-id3v2_version", "0", str(destination),
    ], check=True, capture_output=True)
    checked = subprocess.run([
        executable, "-hide_banner", "-nostdin", "-i", str(destination),
        "-af", "volumedetect", "-f", "null", "-",
    ], check=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    info = checked.stderr
    report = {"source": source.name, "output": destination.as_posix(),
              "bytes": destination.stat().st_size, "full_decode": "passed",
              "audio_processing": "two-pass loudnorm; MP3 192 kbps"}
    for key, pattern in {
        "duration": r"Duration: ([\d:.]+)",
        "mean_volume_db": r"mean_volume: ([\d.-]+) dB",
        "peak_volume_db": r"max_volume: ([\d.-]+) dB",
        "codec": r"Audio: ([^\n]+)",
    }.items():
        found = re.search(pattern, info)
        report[key] = found.group(1).strip() if found else None
    after = measure_loudness(executable, destination, true_peak)
    report["loudness"] = {
        "target_lufs": -16,
        "maximum_decoded_true_peak_dbtp": -1.5,
        "encoding_ceiling_dbtp": true_peak,
        "before_lufs": float(before["input_i"]),
        "before_true_peak_dbtp": float(before["input_tp"]),
        "after_lufs": float(after["input_i"]),
        "after_true_peak_dbtp": float(after["input_tp"]),
    }
    if abs(report["loudness"]["after_lufs"] + 16) > 0.7:
        raise ValueError(f"Normalized loudness outside tolerance: {source.name}")
    if report["loudness"]["after_true_peak_dbtp"] > -1.5:
        raise ValueError(f"Decoded true peak above ceiling: {source.name}")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--music", type=Path)
    parser.add_argument("--voices", type=Path)
    parser.add_argument("--output", type=Path,
                        default=Path(__file__).resolve().parents[1] / "assets/audio")
    args = parser.parse_args()
    executable = find_ffmpeg()
    jobs, missing = [], []
    for source_dir, mappings in [(args.music, TRACKS), (args.voices, VOICES)]:
        if not source_dir:
            continue
        for pattern, destination in mappings:
            candidates = list(source_dir.glob(pattern))
            if not candidates and source_dir == args.voices:
                candidates = list((source_dir / "tests").glob(pattern))
            if not candidates:
                missing.append(pattern)
                continue
            if len(candidates) != 1:
                raise ValueError(f"Expected one input for {pattern}: {candidates}")
            jobs.append((executable, candidates[0], args.output / destination))
    with ThreadPoolExecutor(max_workers=4) as executor:
        reports = list(executor.map(import_mp3, jobs))
    for category in ["voices", "bgm"]:
        category_reports = [{"source": entry["source"],
                             "file": Path(entry["output"]).name,
                             "duration": entry["duration"],
                             "full_decode": entry["full_decode"],
                             **entry["loudness"]}
                            for entry in reports
                            if Path(entry["output"]).parent.name == category]
        if category_reports:
            report_path = args.output / category / "loudness-report.json"
            previous = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else []
            by_file = {entry["file"]: entry for entry in previous}
            by_file.update({entry["file"]: entry for entry in category_reports})
            report_path.write_text(json.dumps(list(by_file.values()), ensure_ascii=False, indent=2)
                                   + "\n", encoding="utf-8")
    print(json.dumps({"imported": reports, "missing_mp3": missing},
                     ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
