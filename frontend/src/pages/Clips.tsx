import { useEffect, useState } from "react";
import { Trash2, ExternalLink, Film, UploadCloud, Loader2, Image as ImageIcon } from "lucide-react";
import { api } from "../api";

interface Clip {
  id: string;
  title: string;
  source_title: string;
  source_url: string;
  score: number;
  duration: number;
  format: "short" | "long";
  status: string;
  youtube_id: string | null;
  thumbnail_key: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  ready: "bg-green-900 text-green-300",
  pending: "bg-yellow-900 text-yellow-300",
  rendering: "bg-blue-900 text-blue-300",
  uploading: "bg-purple-900 text-purple-300",
  published: "bg-teal-900 text-teal-300",
  error: "bg-red-900 text-red-300",
  manual: "bg-gray-800 text-gray-300",
};

const fmt = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

export default function Clips() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [filter, setFilter] = useState({ format: "", status: "", days: 7 });
  const [preview, setPreview] = useState<Clip | null>(null);
  const [thumbPreview, setThumbPreview] = useState<Clip | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [thumbingId, setThumbingId] = useState<string | null>(null);

  const load = () => {
    const q = new URLSearchParams();
    if (filter.format) q.set("format", filter.format);
    if (filter.status) q.set("status", filter.status);
    q.set("days", String(filter.days));
    api.get<Clip[]>(`/api/clips?${q}`).then(setClips).catch(console.error);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const remove = async (id: string) => {
    if (!confirm("Remover clip?")) return;
    await api.del(`/api/clips/${id}`);
    load();
  };

  const uploadClip = async (id: string) => {
    if (!confirm("Fazer upload deste corte para o YouTube agora?")) return;
    setUploadingId(id);
    try {
      const res = await api.post<{ ok: boolean; yt_id: string }>(`/api/clips/${id}/upload`);
      if (res.ok) {
        setClips((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, status: "published", youtube_id: res.yt_id } : c
          )
        );
        alert("Upload concluído com sucesso!");
      }
    } catch (e: any) {
      alert(`Erro no upload: ${e.message || e}`);
    } finally {
      setUploadingId(null);
    }
  };

  const generateThumb = async (id: string) => {
    setThumbingId(id);
    try {
      const res = await api.post<{ ok: boolean; thumbnail_key: string }>(`/api/clips/${id}/thumbnail`);
      if (res.ok) {
        setClips((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, thumbnail_key: res.thumbnail_key } : c
          )
        );
        alert("Thumbnail gerada com sucesso!");
      }
    } catch (e: any) {
      alert(`Erro ao gerar thumbnail: ${e.message || e}`);
    } finally {
      setThumbingId(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Clips</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
          value={filter.format}
          onChange={(e) => setFilter({ ...filter, format: e.target.value })}
        >
          <option value="">Todos formatos</option>
          <option value="short">Short</option>
          <option value="long">Long</option>
        </select>

        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">Todos status</option>
          <option value="ready">Ready (Auto-upload)</option>
          <option value="manual">Manual (Sem upload)</option>
          <option value="published">Published</option>
          <option value="error">Error</option>
        </select>

        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
          value={filter.days}
          onChange={(e) => setFilter({ ...filter, days: Number(e.target.value) })}
        >
          <option value={1}>Hoje</option>
          <option value={7}>7 dias</option>
          <option value={30}>30 dias</option>
          <option value={365}>Todos</option>
        </select>
      </div>

      {clips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
          <Film size={40} className="mb-3" />
          <p>Nenhum clip encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clips.map((clip) => (
            <div
              key={clip.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4 items-start"
            >
              {/* Preview button */}
              <button
                onClick={() => setPreview(clip)}
                className="w-16 h-16 shrink-0 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors overflow-hidden"
                title="Preview"
              >
                {clip.thumbnail_key ? (
                  <img 
                    src={`/api/clips/${clip.id}/thumbnail_image`} 
                    alt="Thumb" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Film size={22} className="text-gray-500" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium text-sm">{clip.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      STATUS_COLORS[clip.status] || "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {clip.status}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs bg-blue-900/50 text-blue-400">
                    {clip.format}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate mb-1">{clip.source_title}</p>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>score: {clip.score.toFixed(0)}</span>
                  <span>{fmt(clip.duration)}</span>
                  <span>{new Date(clip.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                {clip.youtube_id && (
                  <a
                    href={`https://youtu.be/${clip.youtube_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
                <button
                  onClick={() => clip.thumbnail_key ? setThumbPreview(clip) : generateThumb(clip.id)}
                  disabled={thumbingId === clip.id}
                  title={clip.thumbnail_key ? "Ver Thumbnail" : "Gerar Thumbnail (IA)"}
                  className={`p-2 rounded-lg bg-gray-800 hover:bg-purple-900/40 text-gray-400 hover:text-purple-400 disabled:opacity-50 ${clip.thumbnail_key ? 'text-purple-400' : ''}`}
                >
                  {thumbingId === clip.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ImageIcon size={14} />
                  )}
                </button>
                {clip.status !== "published" && (
                  <button
                    onClick={() => uploadClip(clip.id)}
                    disabled={uploadingId === clip.id}
                    title="Fazer upload para o YouTube"
                    className="p-2 rounded-lg bg-gray-800 hover:bg-green-900/40 text-gray-400 hover:text-green-400 disabled:opacity-50"
                  >
                    {uploadingId === clip.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <UploadCloud size={14} />
                    )}
                  </button>
                )}
                <button
                  onClick={() => remove(clip.id)}
                  title="Excluir corte"
                  className="p-2 rounded-lg bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video preview modal */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-gray-900 rounded-xl overflow-hidden max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-medium truncate">{preview.title}</span>
              <button onClick={() => setPreview(null)} className="text-gray-400 ml-2">
                ✕
              </button>
            </div>
            <video
              src={`/api/clips/${preview.id}/stream`}
              controls
              autoPlay
              className="w-full"
              style={{
                maxHeight: preview.format === "short" ? "70vh" : "50vh",
                objectFit: "contain",
              }}
            />
          </div>
        </div>
      )}

      {/* Thumbnail preview modal */}
      {thumbPreview && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setThumbPreview(null)}
        >
          <div
            className="bg-gray-900 rounded-xl overflow-hidden max-w-lg w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-medium truncate">Thumbnail: {thumbPreview.title}</span>
              <button onClick={() => setThumbPreview(null)} className="text-gray-400 ml-2 hover:text-white">
                ✕
              </button>
            </div>
            <img
              src={`/api/clips/${thumbPreview.id}/thumbnail_image`}
              alt="Thumbnail"
              className="w-full h-auto"
            />
            <div className="p-4 flex justify-between">
              <button
                onClick={() => generateThumb(thumbPreview.id)}
                disabled={thumbingId === thumbPreview.id}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                {thumbingId === thumbPreview.id ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                Gerar Novamente
              </button>
              <a
                href={`/api/clips/${thumbPreview.id}/thumbnail_image`}
                download={`thumb_${thumbPreview.id}.png`}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                Baixar
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
