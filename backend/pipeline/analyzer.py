import json
import re
from dataclasses import dataclass
from typing import Optional

from .. import log_store as log

DEFAULT_SYSTEM_PROMPT = """\
Você é um editor de vídeo especializado em criar cortes virais de podcasts.

Critérios de seleção:
- Histórias pessoais impactantes ou revelações
- Debates acalorados ou opiniões fortes e controversas
- Momentos de humor ou emoção intensa
- Insights valiosos ou conselhos práticos
- Frases de efeito ou momentos "quotável"
- Início e fim devem ser naturais (nunca no meio de uma frase)\
"""

TECHNICAL_INSTRUCTIONS = """\
Analise a transcrição abaixo e identifique os melhores momentos para criar clips \
de {min_duration}s a {max_duration}s.

Transcrição (formato [segundos] texto):
{transcript}

Retorne APENAS JSON válido, sem texto adicional:
{{
  "clips": [
    {{
      "start": <segundos float>,
      "end": <segundos float>,
      "title": "<título chamativo em português, max 80 chars>",
      "description": "<descrição otimizada para YouTube com hashtags, max 300 chars>",
      "score": <0-100>
    }}
  ]
}}

Máximo {max_clips} clips, ordenados do maior para o menor score.\
"""

# Max chars per chunk sent to the LLM.
# ~15k chars ≈ ~4k tokens, keeping well within context window limits.
CHUNK_MAX_CHARS = 15_000

# Overlap in seconds between adjacent chunks so clips at boundaries aren't lost.
CHUNK_OVERLAP_SECS = 30


@dataclass
class ClipCandidate:
    start: float
    end: float
    title: str
    description: str
    score: float


async def analyze_transcript(
    transcript_text: str,
    transcript_entries: list[dict],
    llm_provider: str,
    openai_api_key: Optional[str] = None,
    openai_model: str = "gpt-4o-mini",
    llamacpp_model_path: Optional[str] = None,
    llamacpp_n_ctx: int = 4096,
    llamacpp_n_gpu_layers: int = -1,
    custom_prompt: Optional[str] = None,
    max_clips: int = 6,
    min_duration: int = 15,
    max_duration: int = 120,
) -> list[ClipCandidate]:
    """Analyze transcript via LLM in chunks. Returns candidates sorted by score desc."""
    user_guidelines = custom_prompt or DEFAULT_SYSTEM_PROMPT
    template = f"{user_guidelines}\n\n{TECHNICAL_INSTRUCTIONS}"

    chunks = _split_entries_into_chunks(transcript_entries, CHUNK_MAX_CHARS, CHUNK_OVERLAP_SECS)
    log.info(f"Transcript: {len(transcript_entries)} entries → {len(chunks)} chunk(s)")

    all_candidates: list[ClipCandidate] = []

    for idx, chunk_entries in enumerate(chunks, 1):
        timestamped = _build_timestamped(chunk_entries)
        t0 = chunk_entries[0].get("start", 0)
        t1 = chunk_entries[-1].get("start", 0)
        log.info(f"Chunk {idx}/{len(chunks)}: {len(chunk_entries)} entries, "
                 f"{len(timestamped)} chars, [{t0:.0f}s – {t1:.0f}s]")

        prompt = template.format(
            transcript=timestamped,
            max_clips=max_clips,
            min_duration=min_duration,
            max_duration=max_duration,
        )

        try:
            if llm_provider == "openai":
                raw = await _openai(prompt, openai_api_key, openai_model)
            elif llm_provider == "llamacpp":
                raw = _llamacpp(prompt, llamacpp_model_path, llamacpp_n_ctx, llamacpp_n_gpu_layers)
            else:
                raise ValueError(f"Unknown LLM provider: {llm_provider}")

            log.info(f"Chunk {idx} LLM response ({len(raw)} chars): {raw[:300]}")
            parsed = _parse(raw)
            log.info(f"Chunk {idx}: {len(parsed)} candidates parsed")
            all_candidates.extend(parsed)

        except Exception as e:
            log.error(f"Chunk {idx} LLM error: {e}")
            continue

    # Log all candidates before filtering
    for c in all_candidates:
        dur = c.end - c.start
        ok = min_duration <= dur <= max_duration
        log.info(f"  → {c.title[:40]}  start={c.start} end={c.end} "
                 f"dur={dur:.0f}s score={c.score} {'✓' if ok else '✗ FILTERED'}")

    # Filter by duration
    filtered = [
        c for c in all_candidates
        if min_duration <= (c.end - c.start) <= max_duration
    ]

    # Deduplicate overlapping clips (keep highest score)
    deduped = _deduplicate(filtered)

    log.info(f"Total: {len(all_candidates)} raw → {len(filtered)} filtered → {len(deduped)} deduped")
    return sorted(deduped, key=lambda x: x.score, reverse=True)[:max_clips]


# ── helpers ───────────────────────────────────────────────────────────────────

def _split_entries_into_chunks(
    entries: list[dict],
    max_chars: int,
    overlap_secs: float,
) -> list[list[dict]]:
    """Split transcript entries into chunks that fit within max_chars,
    with time-based overlap between consecutive chunks."""
    if not entries:
        return []

    chunks: list[list[dict]] = []
    current_chunk: list[dict] = []
    current_chars = 0

    for entry in entries:
        start_sec = entry.get('start', 0)
        line = f"[{start_sec:.1f}s] {entry.get('text', '').strip()}\n"
        line_len = len(line)

        if current_chunk and (current_chars + line_len) > max_chars:
            chunks.append(current_chunk)

            # Start next chunk with overlap: include entries from the last N seconds
            overlap_start = entry.get("start", 0) - overlap_secs
            overlap_entries = [
                e for e in current_chunk
                if e.get("start", 0) >= overlap_start
            ]
            current_chunk = list(overlap_entries)
            current_chars = sum(
                len(f"[{e.get('start', 0):.1f}s] {e.get('text', '').strip()}\n") for e in current_chunk
            )

        current_chunk.append(entry)
        current_chars += line_len

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def _deduplicate(candidates: list[ClipCandidate], threshold: float = 0.5) -> list[ClipCandidate]:
    """Remove overlapping clips, keeping the one with the highest score.
    Two clips overlap if their intersection is > threshold of the shorter clip's duration.
    """
    if not candidates:
        return []

    sorted_c = sorted(candidates, key=lambda x: x.score, reverse=True)
    kept: list[ClipCandidate] = []

    for c in sorted_c:
        c_dur = c.end - c.start
        overlaps = False
        for k in kept:
            overlap_start = max(c.start, k.start)
            overlap_end = min(c.end, k.end)
            overlap = max(0, overlap_end - overlap_start)
            if overlap > threshold * c_dur:
                overlaps = True
                break
        if not overlaps:
            kept.append(c)

    return kept


def _build_timestamped(entries: list[dict]) -> str:
    lines = []
    for e in entries:
        start = e.get("start", 0)
        lines.append(f"[{start:.1f}s] {e.get('text', '').strip()}")
    return "\n".join(lines)


async def _openai(prompt: str, api_key: str, model: str) -> str:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    resp = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        response_format={"type": "json_object"},
    )
    return resp.choices[0].message.content


def _llamacpp(
    prompt: str,
    model_path: str,
    n_ctx: int,
    n_gpu_layers: int,
) -> str:
    from llama_cpp import Llama

    llm = Llama(
        model_path=model_path,
        n_ctx=n_ctx,
        n_gpu_layers=n_gpu_layers,
        verbose=False,
    )
    out = llm.create_chat_completion(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=2048,
    )
    return out["choices"][0]["message"]["content"]


def _parse(text: str) -> list[ClipCandidate]:
    try:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        data = json.loads(match.group() if match else text)
        return [
            ClipCandidate(
                start=float(c["start"]),
                end=float(c["end"]),
                title=c.get("title", "Clip"),
                description=c.get("description", "Cortado com AutoYT"),
                score=float(c.get("score", 50)),
            )
            for c in data.get("clips", [])
        ]
    except Exception as e:
        log.error(f"Parse error: {e} — {text[:300]}")
        return []
