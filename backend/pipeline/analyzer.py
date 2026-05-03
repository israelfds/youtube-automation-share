import json
import re
from dataclasses import dataclass
from typing import Optional

DEFAULT_PODCAST_PROMPT = """\
Você é um editor de vídeo especializado em criar cortes virais de podcasts.

Analise a transcrição abaixo e identifique os melhores momentos para criar clips \
de {min_duration}s a {max_duration}s.

Critérios de seleção:
- Histórias pessoais impactantes ou revelações
- Debates acalorados ou opiniões fortes e controversas
- Momentos de humor ou emoção intensa
- Insights valiosos ou conselhos práticos
- Frases de efeito ou momentos "quotável"
- Início e fim devem ser naturais (nunca no meio de uma frase)

Transcrição (formato [MM:SS] texto):
{transcript}

Retorne APENAS JSON válido, sem texto adicional:
{{
  "clips": [
    {{
      "start": <segundos float>,
      "end": <segundos float>,
      "title": "<título chamativo em português, max 80 chars>",
      "score": <0-100>
    }}
  ]
}}

Máximo {max_clips} clips, ordenados do maior para o menor score.\
"""


@dataclass
class ClipCandidate:
    start: float
    end: float
    title: str
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
    """Analyze transcript via LLM. Returns candidates sorted by score desc."""
    template = custom_prompt or DEFAULT_PODCAST_PROMPT
    timestamped = _build_timestamped(transcript_entries)

    prompt = template.format(
        transcript=timestamped[:60000],
        max_clips=max_clips,
        min_duration=min_duration,
        max_duration=max_duration,
    )

    if llm_provider == "openai":
        raw = await _openai(prompt, openai_api_key, openai_model)
    elif llm_provider == "llamacpp":
        raw = _llamacpp(prompt, llamacpp_model_path, llamacpp_n_ctx, llamacpp_n_gpu_layers)
    else:
        raise ValueError(f"Unknown LLM provider: {llm_provider}")

    candidates = _parse(raw)
    filtered = [
        c for c in candidates
        if min_duration <= (c.end - c.start) <= max_duration
    ]
    return sorted(filtered, key=lambda x: x.score, reverse=True)[:max_clips]


def _build_timestamped(entries: list[dict]) -> str:
    lines = []
    for e in entries:
        start = e.get("start", 0)
        m, s = int(start // 60), int(start % 60)
        lines.append(f"[{m:02d}:{s:02d}] {e.get('text', '').strip()}")
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
                score=float(c.get("score", 50)),
            )
            for c in data.get("clips", [])
        ]
    except Exception as e:
        print(f"[ANALYZER] Parse error: {e}\n{text[:300]}")
        return []
