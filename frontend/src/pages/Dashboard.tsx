import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";

interface Health {
  status: string;
  mongodb: string;
  minio: string;
  gpu_backend: string;
}

interface Stats {
  total: number;
  today: number;
  published: number;
  yt_shorts_today: number;
  yt_longs_today: number;
}

interface Job {
  id: string;
  name: string;
  next_run: string | null;
}

function Badge({ value, green = "ok" }: { value: string; green?: string }) {
  const ok = value === green;
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-mono ${
        ok ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"
      }`}
    >
      {value}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const [health, setHealth] = useState<Health | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [syncing, setSyncing] = useState(false);

  const reload = () => {
    api.get<Health>("/api/health").then(setHealth).catch(() => null);
    api.get<Stats>("/api/clips/stats").then(setStats).catch(() => null);
    api.get<Job[]>("/api/jobs").then(setJobs).catch(() => []);
  };

  useEffect(() => { reload(); }, []);

  const syncJobs = async () => {
    setSyncing(true);
    await api.post("/api/jobs/sync").catch(console.error);
    await api.get<Job[]>("/api/jobs").then(setJobs).catch(() => []);
    setSyncing(false);
  };

  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(i18n.language === 'pt' ? 'pt-BR' : 'en-US', {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("dashboard.title")}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card title={t("dashboard.infrastructure")}>
          {health ? (
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between items-center">
                MongoDB <Badge value={health.mongodb} />
              </li>
              <li className="flex justify-between items-center">
                MinIO <Badge value={health.minio} />
              </li>
              <li className="flex justify-between items-center">
                GPU
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-blue-900 text-blue-300">
                  {health.gpu_backend}
                </span>
              </li>
            </ul>
          ) : (
            <p className="text-red-400 text-sm">{t("dashboard.backend_inaccessible")}</p>
          )}
        </Card>

        <Card title={t("dashboard.clips")}>
          {stats ? (
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-gray-400">{t("dashboard.total")}</span>
                <span className="font-mono">{stats.total}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-400">{t("dashboard.today")}</span>
                <span className="font-mono">{stats.today}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-400">{t("dashboard.published")}</span>
                <span className="font-mono">{stats.published}</span>
              </li>
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">—</p>
          )}
        </Card>

        <Card title={t("dashboard.youtube_today")}>
          {stats ? (
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span className="text-gray-400">Shorts</span>
                <span className="font-mono">{stats.yt_shorts_today}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-400">{t("en") === "en" ? "Longs" : "Longos"}</span>
                <span className="font-mono">{stats.yt_longs_today}</span>
              </li>
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">—</p>
          )}
        </Card>
      </div>

      <Card title={`${t("dashboard.scheduled_jobs")} (${jobs.length})`}>
        <div className="flex justify-end mb-3">
          <button
            onClick={syncJobs}
            disabled={syncing}
            className="text-xs px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
          >
            {syncing ? t("dashboard.syncing") : t("dashboard.sync")}
          </button>
        </div>
        {jobs.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("dashboard.no_jobs")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase">
                <th className="text-left py-1 pr-4">ID</th>
                <th className="text-left py-1">{t("dashboard.next_run")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-gray-800">
                  <td className="py-1 pr-4 font-mono text-xs text-gray-400">{j.id}</td>
                  <td className="py-1 text-gray-300">{fmt(j.next_run)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
