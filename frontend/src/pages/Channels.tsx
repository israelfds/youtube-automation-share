import { useEffect, useState } from "react";
import { Plus, Play, Pencil, Trash2, X } from "lucide-react";
import { api } from "../api";

interface Channel {
  id: string;
  url: string;
  name: string | null;
  active: boolean;
  formats: string[];
  job_hour: number;
  job_minute: number;
  upload_hour: number;
  upload_minute: number;
  max_clips: number;
}

const EMPTY: Omit<Channel, "id"> = {
  url: "",
  name: "",
  active: true,
  formats: ["short"],
  job_hour: 12,
  job_minute: 0,
  upload_hour: 14,
  upload_minute: 0,
  max_clips: 6,
};

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inp =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500";

export default function Channels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [form, setForm] = useState<Omit<Channel, "id">>(EMPTY);
  const [showModal, setShowModal] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = () =>
    api.get<Channel[]>("/api/channels").then(setChannels).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setShowModal(true);
  };

  const openEdit = (ch: Channel) => {
    setEditing(ch);
    const { id: _, ...rest } = ch;
    setForm(rest);
    setShowModal(true);
  };

  const close = () => setShowModal(false);

  const save = async () => {
    try {
      if (editing) {
        await api.patch(`/api/channels/${editing.id}`, form);
      } else {
        await api.post("/api/channels", form);
      }
      close();
      load();
    } catch (e: unknown) {
      alert(`Erro: ${e}`);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remover canal?")) return;
    await api.del(`/api/channels/${id}`);
    load();
  };

  const runNow = async (ch: Channel) => {
    setRunningId(ch.id);
    setMsg("");
    try {
      await api.post(`/api/channels/${ch.id}/run`);
      setMsg(`Pipeline iniciado para "${ch.name || ch.url}"`);
    } catch (e: unknown) {
      setMsg(`Erro: ${e}`);
    } finally {
      setRunningId(null);
    }
  };

  const toggleFormat = (fmt: string) => {
    const cur = form.formats;
    setForm({
      ...form,
      formats: cur.includes(fmt) ? cur.filter((f) => f !== fmt) : [...cur, fmt],
    });
  };

  const set = (k: keyof typeof form, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Canais</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg"
        >
          <Plus size={15} /> Adicionar canal
        </button>
      </div>

      {msg && (
        <p className="mb-4 text-sm text-green-400 bg-green-900/30 border border-green-800 px-4 py-2 rounded-lg">
          {msg}
        </p>
      )}

      {channels.length === 0 ? (
        <p className="text-gray-500">Nenhum canal cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-2 h-2 rounded-full ${ch.active ? "bg-green-500" : "bg-gray-600"}`}
                  />
                  <span className="font-medium text-sm truncate">
                    {ch.name || ch.url}
                  </span>
                </div>
                <div className="text-xs text-gray-500 truncate">{ch.url}</div>
                <div className="flex gap-2 mt-2">
                  {ch.formats.map((f) => (
                    <span
                      key={f}
                      className="px-2 py-0.5 rounded text-xs bg-blue-900 text-blue-300"
                    >
                      {f}
                    </span>
                  ))}
                  <span className="text-xs text-gray-500">
                    análise {ch.job_hour}:{String(ch.job_minute).padStart(2, "0")} •
                    upload {ch.upload_hour}:{String(ch.upload_minute).padStart(2, "0")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => runNow(ch)}
                  disabled={runningId === ch.id}
                  title="Executar agora"
                  className="p-2 rounded-lg bg-green-900/40 hover:bg-green-800/60 text-green-400 disabled:opacity-40"
                >
                  <Play size={15} />
                </button>
                <button
                  onClick={() => openEdit(ch)}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => remove(ch.id)}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-red-900/60 text-gray-400 hover:text-red-400"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Editar canal" : "Novo canal"} onClose={close}>
          <Field label="URL do canal YouTube">
            <input
              className={inp}
              placeholder="https://www.youtube.com/@canal/streams"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
            />
          </Field>

          <Field label="Nome (opcional)">
            <input
              className={inp}
              placeholder="Meu Podcast"
              value={form.name || ""}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>

          <Field label="Formatos">
            <div className="flex gap-3">
              {["short", "long"].map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.formats.includes(f)}
                    onChange={() => toggleFormat(f)}
                    className="accent-red-500"
                  />
                  {f === "short" ? "Shorts (9:16)" : "Longos (16:9)"}
                </label>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Horário de análise">
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  className={inp}
                  value={form.job_hour}
                  onChange={(e) => set("job_hour", Number(e.target.value))}
                />
                <input
                  type="number"
                  min={0}
                  max={59}
                  className={inp}
                  value={form.job_minute}
                  onChange={(e) => set("job_minute", Number(e.target.value))}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">hora : minuto</p>
            </Field>

            <Field label="Horário de upload YT">
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  className={inp}
                  value={form.upload_hour}
                  onChange={(e) => set("upload_hour", Number(e.target.value))}
                />
                <input
                  type="number"
                  min={0}
                  max={59}
                  className={inp}
                  value={form.upload_minute}
                  onChange={(e) => set("upload_minute", Number(e.target.value))}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">hora : minuto</p>
            </Field>
          </div>

          <Field label={`Max clips por execução: ${form.max_clips}`}>
            <input
              type="range"
              min={1}
              max={20}
              value={form.max_clips}
              onChange={(e) => set("max_clips", Number(e.target.value))}
              className="w-full accent-red-500"
            />
          </Field>

          <Field label="Ativo">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => set("active", !form.active)}
                className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${
                  form.active ? "bg-red-600" : "bg-gray-700"
                } relative`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    form.active ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
              <span className="text-sm">{form.active ? "Ativo" : "Inativo"}</span>
            </label>
          </Field>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={close}
              className="px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
            >
              Salvar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
