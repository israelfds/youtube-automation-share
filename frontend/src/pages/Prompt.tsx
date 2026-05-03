import { useEffect, useState } from "react";
import { api } from "../api";

const DEFAULT = `Você é um editor de vídeo especializado em criar cortes virais de podcasts.

Analise a transcrição abaixo e identifique os melhores momentos para criar clips de {min_duration}s a {max_duration}s.

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
{
  "clips": [
    {
      "start": <segundos float>,
      "end": <segundos float>,
      "title": "<título chamativo em português, max 80 chars>",
      "score": <0-100>
    }
  ]
}

Máximo {max_clips} clips, ordenados do maior para o menor score.`;

export default function Prompt() {
  const [prompt, setPrompt] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Record<string, unknown>>("/api/settings")
      .then((cfg) => {
        setPrompt(String(cfg.llm_prompt || DEFAULT));
        setLoading(false);
      })
      .catch(() => {
        setPrompt(DEFAULT);
        setLoading(false);
      });
  }, []);

  const save = async () => {
    await api.put("/api/settings", { llm_prompt: prompt });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const restore = () => {
    if (confirm("Restaurar prompt padrão?")) setPrompt(DEFAULT);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Prompt LLM</h1>
        <div className="flex gap-2">
          <button
            onClick={restore}
            className="text-sm px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700"
          >
            Restaurar padrão
          </button>
          <button
            onClick={save}
            className="text-sm px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
          >
            {saved ? "Salvo ✓" : "Salvar"}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Variáveis disponíveis:{" "}
        <code className="bg-gray-800 px-1 rounded">{"{{transcript}}"}</code>{" "}
        <code className="bg-gray-800 px-1 rounded">{"{{min_duration}}"}</code>{" "}
        <code className="bg-gray-800 px-1 rounded">{"{{max_duration}}"}</code>{" "}
        <code className="bg-gray-800 px-1 rounded">{"{{max_clips}}"}</code>
      </p>

      {loading ? (
        <p className="text-gray-500 text-sm">Carregando...</p>
      ) : (
        <textarea
          className="w-full h-[60vh] bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm font-mono focus:outline-none focus:border-red-500 resize-none"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          spellCheck={false}
        />
      )}
    </div>
  );
}
