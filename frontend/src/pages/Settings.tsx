import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader, ChevronDown, ChevronRight, Terminal, ExternalLink } from "lucide-react";
import { api } from "../api";

type Tab = "llm" | "whisper" | "youtube" | "pipeline";

const TABS: { id: Tab; label: string }[] = [
  { id: "llm", label: "LLM" },
  { id: "whisper", label: "Whisper" },
  { id: "youtube", label: "YouTube" },
  { id: "pipeline", label: "Pipeline" },
];

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

const STEPS = [
  {
    title: "Criar projeto no Google Cloud",
    content: (
      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
        <li>
          Acesse{" "}
          <a
            href="https://console.cloud.google.com"
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 underline inline-flex items-center gap-1"
          >
            console.cloud.google.com <ExternalLink size={11} />
          </a>
        </li>
        <li>
          No seletor de projetos (topo da página), clique em{" "}
          <span className="bg-gray-700 px-1.5 py-0.5 rounded font-mono text-xs">Novo Projeto</span>
        </li>
        <li>Dê um nome (ex: <span className="font-mono text-xs bg-gray-700 px-1 rounded">automation-youtube</span>) e clique em <strong>Criar</strong></li>
        <li>Aguarde e selecione o projeto recém-criado</li>
      </ol>
    ),
  },
  {
    title: "Ativar YouTube Data API v3",
    content: (
      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
        <li>
          No menu lateral: <strong>APIs e Serviços → Biblioteca</strong>
        </li>
        <li>
          Pesquise por{" "}
          <span className="font-mono text-xs bg-gray-700 px-1 rounded">YouTube Data API v3</span>
        </li>
        <li>Clique no resultado e depois em <strong>Ativar</strong></li>
        <li>Aguarde a ativação (alguns segundos)</li>
      </ol>
    ),
  },
  {
    title: "Configurar tela de consentimento OAuth",
    content: (
      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
        <li>
          Vá em <strong>APIs e Serviços → Tela de consentimento OAuth</strong>
        </li>
        <li>
          Selecione <strong>Externo</strong> e clique em <strong>Criar</strong>
        </li>
        <li>
          Preencha apenas os obrigatórios:
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-gray-400">
            <li>Nome do app (ex: AutoYT)</li>
            <li>E-mail de suporte</li>
            <li>E-mail do desenvolvedor (rodapé)</li>
          </ul>
        </li>
        <li>Clique em <strong>Salvar e continuar</strong> nas próximas telas (sem adicionar escopos nem usuários por enquanto)</li>
        <li>
          Na última tela, clique em <strong>Publicar aplicativo</strong> → confirma
          <br />
          <span className="text-yellow-500 text-xs">
            ⚠ Se ficar em "Em teste", só contas adicionadas em "Usuários de teste" podem autorizar
          </span>
        </li>
      </ol>
    ),
  },
  {
    title: "Criar credenciais OAuth2 (Client ID + Secret)",
    content: (
      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
        <li>
          Vá em <strong>APIs e Serviços → Credenciais</strong>
        </li>
        <li>
          Clique em <strong>+ Criar Credenciais → ID do cliente OAuth</strong>
        </li>
        <li>
          Tipo de aplicativo: selecione <strong>App para computador (Desktop)</strong>
        </li>
        <li>Nome: qualquer (ex: <span className="font-mono text-xs bg-gray-700 px-1 rounded">autoyt-desktop</span>)</li>
        <li>Clique em <strong>Criar</strong></li>
        <li>
          Uma janela mostrará o <strong>Client ID</strong> e <strong>Client Secret</strong>
          <br />
          <span className="text-gray-400 text-xs">Copie ambos — ou faça download do JSON</span>
        </li>
      </ol>
    ),
  },
  {
    title: "Adicionar escopo de upload",
    content: (
      <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
        <li>
          Volte em <strong>Tela de consentimento OAuth → Editar app → Escopos</strong>
        </li>
        <li>Clique em <strong>Adicionar ou remover escopos</strong></li>
        <li>
          Filtre por{" "}
          <span className="font-mono text-xs bg-gray-700 px-1 rounded">youtube</span> e marque:
          <br />
          <span className="font-mono text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded mt-1 inline-block">
            https://www.googleapis.com/auth/youtube.upload
          </span>
        </li>
        <li>Clique em <strong>Atualizar</strong> e depois <strong>Salvar e continuar</strong></li>
      </ol>
    ),
  },
  {
    title: "Gerar Refresh Token (autorizar canal)",
    content: (
      <div className="space-y-3 text-sm text-gray-300">
        <p>
          Com o Client ID e Secret em mãos, execute o script de autorização no terminal:
        </p>
        <div className="bg-gray-950 border border-gray-700 rounded-lg p-3 font-mono text-xs text-green-400 flex items-start gap-2">
          <Terminal size={13} className="mt-0.5 shrink-0 text-gray-500" />
          <div>
            <div className="text-gray-500"># Na pasta do projeto:</div>
            <div>cd ~/workspace/automation-youtube</div>
            <div>source venv/bin/activate</div>
            <div>python scripts/get_yt_token.py</div>
          </div>
        </div>
        <ol className="list-decimal list-inside space-y-1 text-gray-300">
          <li>O script vai pedir Client ID e Client Secret</li>
          <li>Um navegador abre para você <strong>autorizar com a conta do canal</strong></li>
          <li>Após autorizar, o terminal imprime o <strong>Refresh Token</strong></li>
          <li>Cole o token no campo abaixo e clique em <strong>Salvar</strong></li>
        </ol>
        <p className="text-yellow-500 text-xs">
          ⚠ O refresh token autoriza upload em nome do canal que fez login. Use a conta correta.
        </p>
      </div>
    ),
  },
];

function YoutubeGuide() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(open === -1 ? null : -1)}
        className="w-full flex items-center justify-between bg-blue-950/40 border border-blue-900/60 rounded-xl px-4 py-3 text-sm text-blue-300 hover:bg-blue-950/60 transition-colors"
      >
        <span className="font-medium">Como configurar o Google Cloud e gerar credenciais</span>
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
            ✓ Após o passo 6, você terá <strong>Client ID</strong>, <strong>Client Secret</strong> e{" "}
            <strong>Refresh Token</strong> para preencher abaixo.
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [tab, setTab] = useState<Tab>("llm");
  const [cfg, setCfg] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState(false);
  const [ytStatus, setYtStatus] = useState<"idle" | "loading" | "ok" | "fail">("idle");

  useEffect(() => {
    api.get<Record<string, unknown>>("/api/settings").then(setCfg).catch(console.error);
  }, []);

  const set = (k: string, v: unknown) => setCfg((c) => ({ ...c, [k]: v }));

  const save = async () => {
    try {
      await api.put("/api/settings", cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert(`Erro ao salvar: ${e}`);
    }
  };

  const testYt = async () => {
    setYtStatus("loading");
    try {
      const r = await api.post<{ ok: boolean; error?: string }>(
        "/api/settings/test-youtube"
      );
      setYtStatus(r.ok ? "ok" : "fail");
    } catch {
      setYtStatus("fail");
    }
    setTimeout(() => setYtStatus("idle"), 4000);
  };

  const s = (k: string, fallback: unknown = "") =>
    cfg[k] !== undefined ? cfg[k] : fallback;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Configurações</h1>
        <button
          onClick={save}
          className="bg-red-600 hover:bg-red-700 text-white text-sm px-5 py-2 rounded-lg"
        >
          {saved ? "Salvo ✓" : "Salvar"}
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
            <Field label="Provedor LLM">
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
                <Field label="OpenAI API Key">
                  <input
                    type="password"
                    className={inp}
                    placeholder="sk-..."
                    value={String(s("openai_api_key"))}
                    onChange={(e) => set("openai_api_key", e.target.value)}
                  />
                </Field>
                <Field label="Modelo">
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
                  label="Caminho do modelo .gguf"
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
                  <Field label="Context size (n_ctx)">
                    <input
                      type="number"
                      className={inp}
                      value={Number(s("llamacpp_n_ctx", 4096))}
                      onChange={(e) => set("llamacpp_n_ctx", Number(e.target.value))}
                    />
                  </Field>
                  <Field label="GPU layers (-1 = todos)">
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
            <Field label="Tamanho do modelo Whisper">
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
                large-v3 = mais preciso, mais lento. base = bom equilíbrio.
              </p>
            </Field>

            <Field
              label="Override de device"
              hint="Deixe vazio para auto-detectar (recomendado)"
            >
              <select
                className={inp}
                value={String(s("whisper_device_override", ""))}
                onChange={(e) =>
                  set("whisper_device_override", e.target.value || null)
                }
              >
                <option value="">Auto (detectar GPU)</option>
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
                Credenciais OAuth2
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
                hint="Gerado pelo script scripts/get_yt_token.py"
              >
                <input
                  type="password"
                  className={inp}
                  placeholder="1//••••••••"
                  value={String(s("youtube_refresh_token"))}
                  onChange={(e) => set("youtube_refresh_token", e.target.value)}
                />
              </Field>

              <button
                onClick={testYt}
                disabled={ytStatus === "loading"}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-sm px-4 py-2 rounded-lg"
              >
                {ytStatus === "loading" && <Loader size={14} className="animate-spin" />}
                {ytStatus === "ok" && <CheckCircle size={14} className="text-green-400" />}
                {ytStatus === "fail" && <XCircle size={14} className="text-red-400" />}
                {ytStatus === "idle" && "Testar credenciais"}
                {ytStatus === "loading" && "Testando..."}
                {ytStatus === "ok" && "Credenciais válidas"}
                {ytStatus === "fail" && "Credenciais inválidas"}
              </button>
            </div>
          </>
        )}

        {/* ── Pipeline ─────────────────────────────────────────────── */}
        {tab === "pipeline" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Duração mín. shorts (s)">
                <input
                  type="number"
                  className={inp}
                  value={Number(s("clip_min_duration", 15))}
                  onChange={(e) => set("clip_min_duration", Number(e.target.value))}
                />
              </Field>
              <Field label="Duração máx. shorts (s)">
                <input
                  type="number"
                  className={inp}
                  value={Number(s("clip_max_duration", 120))}
                  onChange={(e) => set("clip_max_duration", Number(e.target.value))}
                />
              </Field>
              <Field label="Duração mín. longos (s)">
                <input
                  type="number"
                  className={inp}
                  value={Number(s("long_clip_min_duration", 300))}
                  onChange={(e) =>
                    set("long_clip_min_duration", Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Duração máx. longos (s)">
                <input
                  type="number"
                  className={inp}
                  value={Number(s("long_clip_max_duration", 600))}
                  onChange={(e) =>
                    set("long_clip_max_duration", Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Shorts/dia (quota YT)">
                <input
                  type="number"
                  className={inp}
                  value={Number(s("daily_short_uploads", 9))}
                  onChange={(e) => set("daily_short_uploads", Number(e.target.value))}
                />
              </Field>
              <Field label="Longos/dia (quota YT)">
                <input
                  type="number"
                  className={inp}
                  value={Number(s("daily_long_uploads", 1))}
                  onChange={(e) => set("daily_long_uploads", Number(e.target.value))}
                />
              </Field>
              <Field label="TTL clips não publicados (dias)">
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
