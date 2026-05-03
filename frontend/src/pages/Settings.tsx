import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, Loader, ChevronDown, ChevronRight, Terminal, ExternalLink } from "lucide-react";
import { api } from "../api";

type Tab = "llm" | "whisper" | "youtube" | "pipeline";

const inp =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-1">{hint}</p>}
      {children}
    </div>
  );
}

// ── YouTube setup guide ───────────────────────────────────────────────────────

function YoutubeGuide() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState<number | null>(null);

  const STEPS = [
    {
      title: t("settings.guide.step_1"),
      content: i18n.language === 'pt' ? (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Acesse <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-blue-400 underline inline-flex items-center gap-1">console.cloud.google.com <ExternalLink size={11} /></a></li>
          <li>No seletor de projetos (topo da página), clique em <span className="bg-gray-700 px-1.5 py-0.5 rounded font-mono text-xs">Novo Projeto</span></li>
          <li>Dê um nome (ex: <span className="font-mono text-xs bg-gray-700 px-1 rounded">automation-youtube</span>) e clique em <strong>Criar</strong></li>
          <li>Aguarde e selecione o projeto recém-criado</li>
        </ol>
      ) : (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-blue-400 underline inline-flex items-center gap-1">console.cloud.google.com <ExternalLink size={11} /></a></li>
          <li>In the project selector (top of the page), click <span className="bg-gray-700 px-1.5 py-0.5 rounded font-mono text-xs">New Project</span></li>
          <li>Give it a name (e.g., <span className="font-mono text-xs bg-gray-700 px-1 rounded">automation-youtube</span>) and click <strong>Create</strong></li>
          <li>Wait and select the newly created project</li>
        </ol>
      ),
    },
    {
      title: t("settings.guide.step_2"),
      content: i18n.language === 'pt' ? (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>No menu lateral: <strong>APIs e Serviços → Biblioteca</strong></li>
          <li>Pesquise por <span className="font-mono text-xs bg-gray-700 px-1 rounded">YouTube Data API v3</span></li>
          <li>Clique no resultado e depois em <strong>Ativar</strong></li>
          <li>Aguarde a ativação (alguns segundos)</li>
        </ol>
      ) : (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>In the side menu: <strong>APIs & Services → Library</strong></li>
          <li>Search for <span className="font-mono text-xs bg-gray-700 px-1 rounded">YouTube Data API v3</span></li>
          <li>Click the result and then <strong>Enable</strong></li>
          <li>Wait for activation (a few seconds)</li>
        </ol>
      ),
    },
    {
      title: t("settings.guide.step_3"),
      content: i18n.language === 'pt' ? (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Vá em <strong>APIs e Serviços → Tela de consentimento OAuth</strong></li>
          <li>Selecione <strong>Externo</strong> e clique em <strong>Criar</strong></li>
          <li>Preencha apenas os obrigatórios:
            <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-gray-400">
              <li>Nome do app (ex: AutoYT)</li>
              <li>E-mail de suporte</li>
              <li>E-mail do desenvolvedor (rodapé)</li>
            </ul>
          </li>
          <li>Clique em <strong>Salvar e continuar</strong> nas próximas telas</li>
          <li>Na última tela, clique em <strong>Publicar aplicativo</strong> → confirma</li>
        </ol>
      ) : (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Go to <strong>APIs & Services → OAuth consent screen</strong></li>
          <li>Select <strong>External</strong> and click <strong>Create</strong></li>
          <li>Fill in only the mandatory ones:
            <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-gray-400">
              <li>App name (e.g., AutoYT)</li>
              <li>Support email</li>
              <li>Developer email (footer)</li>
            </ul>
          </li>
          <li>Click <strong>Save and continue</strong> on the next screens</li>
          <li>On the last screen, click <strong>Publish app</strong> → confirm</li>
        </ol>
      ),
    },
    {
      title: t("settings.guide.step_4"),
      content: i18n.language === 'pt' ? (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Vá em <strong>APIs e Serviços → Credenciais</strong></li>
          <li>Clique em <strong>+ Criar Credenciais → ID do cliente OAuth</strong></li>
          <li>Tipo de aplicativo: selecione <strong>App para computador (Desktop)</strong></li>
          <li>Nome: qualquer (ex: <span className="font-mono text-xs bg-gray-700 px-1 rounded">autoyt-desktop</span>)</li>
          <li>Clique em <strong>Criar</strong></li>
          <li>Uma janela mostrará o <strong>Client ID</strong> e <strong>Client Secret</strong></li>
        </ol>
      ) : (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Go to <strong>APIs & Services → Credentials</strong></li>
          <li>Click <strong>+ Create Credentials → OAuth client ID</strong></li>
          <li>Application type: select <strong>Desktop app</strong></li>
          <li>Name: any (e.g., <span className="font-mono text-xs bg-gray-700 px-1 rounded">autoyt-desktop</span>)</li>
          <li>Click <strong>Create</strong></li>
          <li>A window will show the <strong>Client ID</strong> and <strong>Client Secret</strong></li>
        </ol>
      ),
    },
    {
      title: t("settings.guide.step_5"),
      content: i18n.language === 'pt' ? (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Volte em <strong>Tela de consentimento OAuth → Editar app → Escopos</strong></li>
          <li>Clique em <strong>Adicionar ou remover escopos</strong></li>
          <li>Filtre por <span className="font-mono text-xs bg-gray-700 px-1 rounded">youtube</span> e marque:
            <br />
            <span className="font-mono text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded mt-1 inline-block">
              https://www.googleapis.com/auth/youtube.upload
            </span>
          </li>
          <li>Clique em <strong>Atualizar</strong> e depois <strong>Salvar e continuar</strong></li>
        </ol>
      ) : (
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Go back to <strong>OAuth consent screen → Edit app → Scopes</strong></li>
          <li>Click <strong>Add or remove scopes</strong></li>
          <li>Filter by <span className="font-mono text-xs bg-gray-700 px-1 rounded">youtube</span> and check:
            <br />
            <span className="font-mono text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded mt-1 inline-block">
              https://www.googleapis.com/auth/youtube.upload
            </span>
          </li>
          <li>Click <strong>Update</strong> and then <strong>Save and continue</strong></li>
        </ol>
      ),
    },
    {
      title: t("settings.guide.step_6"),
      content: i18n.language === 'pt' ? (
        <div className="space-y-3 text-sm text-gray-300">
          <ol className="list-decimal list-inside space-y-1 text-gray-400 mt-2">
            <li>Certifique-se de ter salvo o <strong>Client ID</strong> e <strong>Client Secret</strong> no formulário abaixo!</li>
            <li>Clique no botão vermelho <strong>Autorizar Canal do YouTube</strong>.</li>
            <li>Autorize o aplicativo com a conta do seu canal.</li>
          </ol>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-gray-300">
          <ol className="list-decimal list-inside space-y-1 text-gray-400 mt-2">
            <li>Make sure you have saved the <strong>Client ID</strong> and <strong>Client Secret</strong> in the form below!</li>
            <li>Click the red <strong>Authorize YouTube Channel</strong> button.</li>
            <li>Authorize the application with your channel's account.</li>
          </ol>
        </div>
      ),
    },
  ];

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(open === -1 ? null : -1)}
        className="w-full flex items-center justify-between bg-blue-950/40 border border-blue-900/60 rounded-xl px-4 py-3 text-sm text-blue-300 hover:bg-blue-950/60 transition-colors"
      >
        <span className="font-medium">{t("settings.guide.title")}</span>
        {open === -1 ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {open === -1 && (
        <div className="mt-2 space-y-2">
          {STEPS.map((step, idx) => (
            <div key={idx} className="border border-gray-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpen(open === idx ? null : idx)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-800/60 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center shrink-0 font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-gray-200 font-medium">{step.title}</span>
                </span>
                {open === idx ? (
                  <ChevronDown size={15} className="text-gray-500 shrink-0" />
                ) : (
                  <ChevronRight size={15} className="text-gray-500 shrink-0" />
                )}
              </button>
              {open === idx && (
                <div className="px-4 pb-4 pt-1 bg-gray-900/50 border-t border-gray-800">
                  {step.content}
                </div>
              )}
            </div>
          ))}

          <div className="bg-green-950/30 border border-green-900/50 rounded-xl px-4 py-3 text-sm text-green-300">
            {t("settings.guide.footer")}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("llm");
  const [cfg, setCfg] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState(false);
  const [ytStatus, setYtStatus] = useState<"idle" | "loading" | "ok" | "fail">("idle");

  const TABS: { id: Tab; label: string }[] = [
    { id: "llm", label: "LLM" },
    { id: "whisper", label: "Whisper" },
    { id: "youtube", label: "YouTube" },
    { id: "pipeline", label: "Pipeline" },
  ];

  useEffect(() => {
    api.get<Record<string, unknown>>("/api/settings").then(setCfg).catch(console.error);
    
    // Check for OAuth callback status
    const params = new URLSearchParams(window.location.search);
    if (params.get("youtube_auth") === "success") {
      alert(t("settings.auth_success"));
      // Clean url
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get("youtube_auth") === "error") {
      alert(`${t("settings.auth_error")}: ${params.get("msg")}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const set = (k: string, v: unknown) => setCfg((c) => ({ ...c, [k]: v }));

  const save = async () => {
    try {
      await api.put("/api/settings", cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert(`${t("common.error")}: ${e}`);
    }
  };

  const testYt = async () => {
    setYtStatus("loading");
    try {
      const r = await api.post<{ ok: boolean; error?: string }>(
        "/api/settings/test-youtube"
      );
      setYtStatus(r.ok ? "ok" : "fail");
      if (r.ok) {
        alert(t("settings.success_yt_test"));
      } else {
        alert(`${t("settings.fail_yt_test")}: ${r.error || t("common.unknown_error")}`);
      }
    } catch (e: any) {
      setYtStatus("fail");
      alert(`${t("settings.error_yt_test")}: ${e.message || e}`);
    }
    setTimeout(() => setYtStatus("idle"), 4000);
  };

  const s = (k: string, fallback: unknown = "") =>
    cfg[k] !== undefined ? cfg[k] : fallback;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <button
          onClick={save}
          className="bg-red-600 hover:bg-red-700 text-white text-sm px-5 py-2 rounded-lg"
        >
          {saved ? t("settings.saved") : t("common.save")}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-xl w-fit border border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
              tab === t.id
                ? "bg-red-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-xl">
        {/* ── LLM ─────────────────────────────────────────────────── */}
        {tab === "llm" && (
          <>
            <Field label={t("settings.llm_provider")}>
              <div className="flex gap-3">
                {["openai", "llamacpp"].map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="llm_provider"
                      value={p}
                      checked={s("llm_provider", "openai") === p}
                      onChange={() => set("llm_provider", p)}
                      className="accent-red-500"
                    />
                    {p === "openai" ? "OpenAI API" : "llama.cpp (local)"}
                  </label>
                ))}
              </div>
            </Field>

            {s("llm_provider", "openai") === "openai" ? (
              <>
                <Field label={t("settings.openai_key")}>
                  <input
                    type="password"
                    className={inp}
                    placeholder="sk-..."
                    value={String(s("openai_api_key"))}
                    onChange={(e) => set("openai_api_key", e.target.value)}
                  />
                </Field>
                <Field label={t("settings.model")}>
                  <select
                    className={inp}
                    value={String(s("openai_model", "gpt-4o-mini"))}
                    onChange={(e) => set("openai_model", e.target.value)}
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4-turbo">gpt-4-turbo</option>
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field
                  label={t("settings.gguf_path")}
                  hint="Ex: /home/user/models/llama-3.1-8b.gguf"
                >
                  <input
                    className={inp}
                    placeholder="/home/user/models/model.gguf"
                    value={String(s("llamacpp_model_path"))}
                    onChange={(e) => set("llamacpp_model_path", e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t("settings.context_size")}>
                    <input
                      type="number"
                      className={inp}
                      value={Number(s("llamacpp_n_ctx", 4096))}
                      onChange={(e) => set("llamacpp_n_ctx", Number(e.target.value))}
                    />
                  </Field>
                  <Field label={t("settings.gpu_layers")}>
                    <input
                      type="number"
                      className={inp}
                      value={Number(s("llamacpp_n_gpu_layers", -1))}
                      onChange={(e) =>
                        set("llamacpp_n_gpu_layers", Number(e.target.value))
                      }
                    />
                  </Field>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Whisper ──────────────────────────────────────────────── */}
        {tab === "whisper" && (
          <>
            <Field label={t("settings.whisper_size")}>
              <select
                className={inp}
                value={String(s("whisper_model", "base"))}
                onChange={(e) => set("whisper_model", e.target.value)}
              >
                {["tiny", "base", "small", "medium", "large-v3"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {t("settings.whisper_help")}
              </p>
            </Field>

            <Field
              label={t("settings.device_override")}
              hint={t("settings.device_help")}
            >
              <select
                className={inp}
                value={String(s("whisper_device_override", ""))}
                onChange={(e) =>
                  set("whisper_device_override", e.target.value || null)
                }
              >
                <option value="">{t("settings.auto_gpu")}</option>
                <option value="cuda">CUDA (NVIDIA)</option>
                <option value="cpu">CPU</option>
              </select>
            </Field>
          </>
        )}

        {/* ── YouTube ──────────────────────────────────────────────── */}
        {tab === "youtube" && (
          <>
            <YoutubeGuide />

            <div className="border-t border-gray-800 mt-6 pt-6">
              <h3 className="text-sm font-semibold mb-4 text-gray-200">
                {t("settings.oauth_credentials")}
              </h3>

              <Field label="Client ID">
                <input
                  className={inp}
                  placeholder="000000000000-xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                  value={String(s("youtube_client_id"))}
                  onChange={(e) => set("youtube_client_id", e.target.value)}
                />
              </Field>

              <Field label="Client Secret">
                <input
                  type="password"
                  className={inp}
                  placeholder="GOCSPX-••••••••"
                  value={String(s("youtube_client_secret"))}
                  onChange={(e) => set("youtube_client_secret", e.target.value)}
                />
              </Field>

              <Field
                label="Refresh Token"
                hint={t("settings.refresh_token_help")}
              >
                <input
                  type="password"
                  className={inp}
                  placeholder="1//••••••••"
                  value={String(s("youtube_refresh_token"))}
                  onChange={(e) => set("youtube_refresh_token", e.target.value)}
                  readOnly
                />
              </Field>

              <div className="flex flex-wrap gap-3 mt-2">
                <a
                  href="/api/settings/youtube/auth"
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg font-medium"
                >
                  {t("settings.authorize_button")}
                </a>
                <button
                  onClick={testYt}
                  disabled={ytStatus === "loading"}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-sm px-4 py-2 rounded-lg"
                >
                  {ytStatus === "loading" && <Loader size={14} className="animate-spin" />}
                  {ytStatus === "ok" && <CheckCircle size={14} className="text-green-400" />}
                  {ytStatus === "fail" && <XCircle size={14} className="text-red-400" />}
                  {ytStatus === "idle" && t("settings.test_credentials")}
                  {ytStatus === "loading" && t("settings.testing")}
                  {ytStatus === "ok" && t("settings.valid_credentials")}
                  {ytStatus === "fail" && t("settings.invalid_credentials")}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Pipeline ─────────────────────────────────────────────── */}
        {tab === "pipeline" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("settings.min_duration_shorts")}>
                <input
                  type="number"
                  className={inp}
                  value={Number(s("clip_min_duration", 15))}
                  onChange={(e) => set("clip_min_duration", Number(e.target.value))}
                />
              </Field>
              <Field label={t("settings.max_duration_shorts")}>
                <input
                  type="number"
                  className={inp}
                  value={Number(s("clip_max_duration", 120))}
                  onChange={(e) => set("clip_max_duration", Number(e.target.value))}
                />
              </Field>
              <Field label={t("settings.min_duration_longs")}>
                <input
                  type="number"
                  className={inp}
                  value={Number(s("long_clip_min_duration", 300))}
                  onChange={(e) =>
                    set("long_clip_min_duration", Number(e.target.value))
                  }
                />
              </Field>
              <Field label={t("settings.max_duration_longs")}>
                <input
                  type="number"
                  className={inp}
                  value={Number(s("long_clip_max_duration", 600))}
                  onChange={(e) =>
                    set("long_clip_max_duration", Number(e.target.value))
                  }
                />
              </Field>
              <Field label={t("settings.shorts_per_day")}>
                <input
                  type="number"
                  className={inp}
                  value={Number(s("daily_short_uploads", 9))}
                  onChange={(e) => set("daily_short_uploads", Number(e.target.value))}
                />
              </Field>
              <Field label={t("settings.longs_per_day")}>
                <input
                  type="number"
                  className={inp}
                  value={Number(s("daily_long_uploads", 1))}
                  onChange={(e) => set("daily_long_uploads", Number(e.target.value))}
                />
              </Field>
              <Field label={t("settings.clip_ttl")}>
                <input
                  type="number"
                  className={inp}
                  value={Number(s("clip_ttl_days", 7))}
                  onChange={(e) => set("clip_ttl_days", Number(e.target.value))}
                />
              </Field>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
