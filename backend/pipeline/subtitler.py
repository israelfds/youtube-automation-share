from pathlib import Path
from typing import Literal


def words_to_ass(
    words: list[dict],
    output_path: str,
    fmt: Literal["short", "long"] = "short",
    words_per_chunk: int = 3,
) -> str:
    """
    Social-media style ASS: 3-word chunks, active word YELLOW uppercase.
    short=1080x1920, long=1920x1080.
    """
    if fmt == "short":
        res_x, res_y, margin_v, font_size = 1080, 1920, 200, 65
    else:
        res_x, res_y, margin_v, font_size = 1920, 1080, 80, 48

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {res_x}\n"
        f"PlayResY: {res_y}\n"
        "Collisions: Normal\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,Arial,{font_size},&H00FFFFFF,&H000000FF,"
        f"&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,"
        f"2,20,20,{margin_v},1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    chunks = _chunk(words, words_per_chunk)
    events = []

    for chunk in chunks:
        if not chunk:
            continue
        chunk_end = chunk[-1]["end"]

        for i, word in enumerate(chunk):
            w_start = word["start"]
            w_end = word["end"] if i < len(chunk) - 1 else chunk_end

            parts = []
            for j, w in enumerate(chunk):
                txt = w["word"].strip()
                if j == i:
                    # active word: yellow, uppercase
                    parts.append(f"{{\\c&H00FFFF&}}{txt.upper()}{{\\c&H00FFFFFF&}}")
                else:
                    parts.append(txt)

            line = " ".join(parts)
            events.append(
                f"Dialogue: 0,{_ass_time(w_start)},{_ass_time(w_end)},"
                f"Default,,0,0,0,,{line}"
            )

    Path(output_path).write_text(header + "\n".join(events), encoding="utf-8")
    return output_path


def words_to_srt(
    words: list[dict],
    output_path: str,
    words_per_chunk: int = 8,
) -> str:
    """Standard SRT from word-level timestamps."""
    chunks = _chunk(words, words_per_chunk)
    blocks = []

    for idx, chunk in enumerate(chunks, 1):
        if not chunk:
            continue
        start = chunk[0]["start"]
        end = chunk[-1]["end"]
        text = " ".join(w["word"].strip() for w in chunk)
        blocks.append(f"{idx}\n{_srt_time(start)} --> {_srt_time(end)}\n{text}\n")

    Path(output_path).write_text("\n".join(blocks), encoding="utf-8")
    return output_path


def entries_to_srt(entries: list[dict], output_path: str) -> str:
    """Convert YouTube transcript entries directly to SRT (fallback)."""
    blocks = []
    for idx, e in enumerate(entries, 1):
        start = e.get("start", 0)
        end = start + e.get("duration", 2)
        text = e.get("text", "").strip()
        if text:
            blocks.append(f"{idx}\n{_srt_time(start)} --> {_srt_time(end)}\n{text}\n")
    Path(output_path).write_text("\n".join(blocks), encoding="utf-8")
    return output_path


# ── helpers ───────────────────────────────────────────────────────────────────

def _chunk(words: list[dict], size: int) -> list[list[dict]]:
    return [words[i : i + size] for i in range(0, len(words), size)]


def _ass_time(s: float) -> str:
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    cs = int((s % 1) * 100)
    return f"{h}:{m:02d}:{sec:02d}.{cs:02d}"


def _srt_time(s: float) -> str:
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    ms = int((s % 1) * 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"
