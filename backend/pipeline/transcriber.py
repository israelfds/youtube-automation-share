from typing import Optional

_model_cache: dict = {}


def detect_device() -> tuple[str, str]:
    """Returns (device, compute_type) for faster-whisper based on available hardware."""
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda", "float16"
        if torch.backends.mps.is_available():
            # faster-whisper doesn't support MPS — fall through to CPU
            pass
    except ImportError:
        pass
    return "cpu", "int8"


def get_whisper_model(model_size: str = "base", device_override: Optional[str] = None):
    from faster_whisper import WhisperModel

    if device_override:
        device = device_override
        compute_type = "float32" if device == "cpu" else "float16"
    else:
        device, compute_type = detect_device()

    cache_key = f"{model_size}:{device}"
    if cache_key not in _model_cache:
        print(f"[WHISPER] Loading {model_size} on {device} ({compute_type})")
        _model_cache[cache_key] = WhisperModel(
            model_size, device=device, compute_type=compute_type
        )

    return _model_cache[cache_key]


def transcribe_audio(
    audio_path: str,
    model_size: str = "base",
    language: str = "pt",
    device_override: Optional[str] = None,
) -> list[dict]:
    """
    Transcribe audio. Returns word-level list: [{"word", "start", "end"}, ...]
    Falls back to segment-level if word timestamps unavailable.
    """
    model = get_whisper_model(model_size, device_override)
    segments, _ = model.transcribe(
        audio_path,
        language=language,
        word_timestamps=True,
        vad_filter=True,
    )

    words = []
    for seg in segments:
        if seg.words:
            for w in seg.words:
                words.append({"word": w.word.strip(), "start": w.start, "end": w.end})
        else:
            # fallback: split segment text into pseudo-words evenly
            tokens = seg.text.strip().split()
            if tokens:
                step = (seg.end - seg.start) / len(tokens)
                for i, t in enumerate(tokens):
                    words.append({
                        "word": t,
                        "start": seg.start + i * step,
                        "end": seg.start + (i + 1) * step,
                    })
    return words


def segments_to_text(entries: list[dict]) -> str:
    """Flatten YouTube transcript entries into plain text."""
    return " ".join(e.get("text", "").strip() for e in entries)
