import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Play, Pencil, Trash2, X, Link } from "lucide-react";
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
  const { t } = useTranslation();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [form, setForm] = useState<Omit<Channel, "id">>(EMPTY);
  const [showModal, setShowModal] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [videoModal, setVideoModal] = useState<Channel | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [globalVideoModal, setGlobalVideoModal] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [maxClips, setMaxClips] = useState(6);

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
      alert(`${t("common.error")}: ${e}`);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t("channels.confirm_delete"))) return;
    await api.del(`/api/channels/${id}`);
    load();
  };

  const runNow = async (ch: Channel) => {
    setRunningId(ch.id);
    setMsg("");
    try {
      await api.post(`/api/channels/${ch.id}/run`);
      setMsg(`${t("channels.pipeline_started")} "${ch.name || ch.url}"`);
    } catch (e: unknown) {
      setMsg(`${t("common.error")}: ${e}`);
    } finally {
      setRunningId(null);
    }
  };

  const openVideoModal = (ch: Channel) => {
    setVideoModal(ch);
    setVideoUrl("");
  };

  const runVideo = async () => {
    if (!videoModal || !videoUrl.trim()) return;
    setRunningId(videoModal.id);
    setMsg("");
    try {
      await api.post(`/api/channels/${videoModal.id}/run`, { 
        video_url: videoUrl.trim(),
        max_clips: maxClips 
      });
      setMsg(`${t("channels.pipeline_started")} ${videoUrl.trim()}`);
      setVideoModal(null);
    } catch (e: unknown) {
      setMsg(`${t("common.error")}: ${e}`);
    } finally {
      setRunningId(null);
    }
  };

  const runGlobalVideo = async () => {
    if (!videoUrl.trim()) return;
    setRunningId("manual");
    setMsg("");
    try {
      await api.post(`/api/channels/manual/run`, { 
        video_url: videoUrl.trim(),
        max_clips: maxClips 
      });
      setMsg(`${t("channels.pipeline_started")} ${videoUrl.trim()}`);
      setGlobalVideoModal(false);
    } catch (e: unknown) {
      setMsg(`${t("common.error")}: ${e}`);
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
        <h1 className="text-2xl font-bold">{t("channels.title")}</h1>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setVideoUrl("");
              setGlobalVideoModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg"
          >
            <Play size={15} /> {t("channels.add_video")}
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg"
          >
            <Plus size={15} /> {t("channels.add_channel")}
          </button>
        </div>
      </div>

      {msg && (
        <p className="mb-4 text-sm text-green-400 bg-green-900/30 border border-green-800 px-4 py-2 rounded-lg">
          {msg}
        </p>
      )}

      {channels.length === 0 ? (
        <p className="text-gray-500">{t("channels.no_channels")}</p>
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
                    {t("channels.analysis_time").toLowerCase()} {ch.job_hour}:{String(ch.job_minute).padStart(2, "0")} •
                    {t("channels.upload_time").toLowerCase()} {ch.upload_hour}:{String(ch.upload_minute).padStart(2, "0")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => runNow(ch)}
                  disabled={runningId === ch.id}
                  title={t("channels.run_now_title")}
                  className="p-2 rounded-lg bg-green-900/40 hover:bg-green-800/60 text-green-400 disabled:opacity-40"
                >
                  <Play size={15} />
                </button>
                <button
                  onClick={() => openVideoModal(ch)}
                  disabled={runningId === ch.id}
                  title={t("channels.process_video")}
                  className="p-2 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 text-blue-400 disabled:opacity-40"
                >
                  <Link size={15} />
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

      {videoModal && (
        <Modal
          title={`${t("channels.process_video")} — ${videoModal.name || videoModal.url}`}
          onClose={() => setVideoModal(null)}
        >
          <p className="text-xs text-gray-400 mb-4">
            {t("channels.process_video_channel_help")}
          </p>
          <Field label={t("channels.video_url_label")}>
            <input
              className={inp}
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runVideo()}
              autoFocus
            />
          </Field>
          <Field label={t("channels.max_clips_label")}>
            <input
              type="number"
              min={1}
              max={20}
              className={inp}
              value={maxClips}
              onChange={(e) => setMaxClips(Number(e.target.value))}
            />
          </Field>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setVideoModal(null)}
              className="px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={runVideo}
              disabled={!videoUrl.trim() || runningId === videoModal.id}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
            >
              {t("common.process")}
            </button>
          </div>
        </Modal>
      )}

      {globalVideoModal && (
        <Modal
          title={t("channels.process_specific_video")}
          onClose={() => setGlobalVideoModal(false)}
        >
          <p className="text-xs text-gray-400 mb-4">
            {t("channels.process_video_help")}
          </p>
          <Field label={t("channels.video_url_label")}>
            <input
              className={inp}
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runGlobalVideo()}
              autoFocus
            />
          </Field>
          <Field label={t("channels.max_clips_label")}>
            <input
              type="number"
              min={1}
              max={20}
              className={inp}
              value={maxClips}
              onChange={(e) => setMaxClips(Number(e.target.value))}
            />
          </Field>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setGlobalVideoModal(false)}
              className="px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={runGlobalVideo}
              disabled={!videoUrl.trim() || runningId === "manual"}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
            >
              {t("common.process")}
            </button>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal title={editing ? t("channels.edit_channel") : t("channels.new_channel")} onClose={close}>
          <Field label={t("channels.url_placeholder")}>
            <input
              className={inp}
              placeholder="https://www.youtube.com/@canal/streams"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
            />
          </Field>

          <Field label={t("channels.name_optional")}>
            <input
              className={inp}
              placeholder="Meu Podcast"
              value={form.name || ""}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>

          <Field label={t("channels.formats")}>
            <div className="flex gap-3">
              {["short", "long"].map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.formats.includes(f)}
                    onChange={() => toggleFormat(f)}
                    className="accent-red-500"
                  />
                  {f === "short" ? "Shorts (9:16)" : (t("en") === "en" ? "Longs (16:9)" : "Longos (16:9)")}
                </label>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label={t("channels.analysis_time")}>
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
              <p className="text-xs text-gray-500 mt-1">{t("channels.hour_min_help")}</p>
            </Field>

            <Field label={t("channels.upload_time")}>
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
              <p className="text-xs text-gray-500 mt-1">{t("channels.hour_min_help")}</p>
            </Field>
          </div>

          <Field label={`${t("channels.max_clips")}: ${form.max_clips}`}>
            <input
              type="range"
              min={1}
              max={20}
              value={form.max_clips}
              onChange={(e) => set("max_clips", Number(e.target.value))}
              className="w-full accent-red-500"
            />
          </Field>

          <Field label={t("channels.active")}>
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
              <span className="text-sm">{form.active ? t("channels.active") : t("channels.inactive")}</span>
            </label>
          </Field>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={close}
              className="px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={save}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
            >
              {t("common.save")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
