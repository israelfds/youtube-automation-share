import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";

const DEFAULT = `Você é um editor de vídeo especializado em criar cortes virais de podcasts.

Critérios de seleção:
- Histórias pessoais impactantes ou revelações
- Debates acalorados ou opiniões fortes e controversas
- Momentos de humor ou emoção intensa
- Insights valiosos ou conselhos práticos
- Frases de efeito ou momentos "quotável"
- Início e fim devem ser naturais (nunca no meio de uma frase)`;

export default function Prompt() {
  const { t } = useTranslation();
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
    if (confirm(t("prompt.confirm_restore"))) setPrompt(DEFAULT);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t("prompt.title")}</h1>
        <div className="flex gap-2">
          <button
            onClick={restore}
            className="text-sm px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700"
          >
            {t("prompt.restore_default")}
          </button>
          <button
            onClick={save}
            className="text-sm px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
          >
            {saved ? t("prompt.saved") : t("common.save")}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        {t("prompt.help_text")}
      </p>

      {loading ? (
        <p className="text-gray-500 text-sm">{t("common.loading")}</p>
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
