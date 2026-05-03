import { useEffect, useRef, useState } from "react";

interface LogEntry {
  ts: string;
  level: "INFO" | "WARNING" | "ERROR";
  message: string;
}

const LEVEL_COLORS: Record<string, string> = {
  INFO: "text-gray-300",
  WARNING: "text-yellow-400",
  ERROR: "text-red-400",
};

const LEVEL_BADGE: Record<string, string> = {
  INFO: "bg-gray-800 text-gray-400",
  WARNING: "bg-yellow-900/50 text-yellow-400",
  ERROR: "bg-red-900/50 text-red-400",
};

export default function Logs() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>("");
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/logs/stream");
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const entry: LogEntry = JSON.parse(e.data);
        setEntries((prev) => [...prev.slice(-999), entry]);
      } catch {
        /* ignore keepalive */
      }
    };

    return () => {
      es.close();
    };
  }, []);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, autoScroll]);

  const clear = () => setEntries([]);

  const visible = filterLevel
    ? entries.filter((e) => e.level === filterLevel)
    : entries;

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour12: false });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Logs</h1>

        <div className="flex gap-2">
          <select
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
          </select>

          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-red-500"
            />
            Auto-scroll
          </label>

          <button
            onClick={clear}
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700"
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-950 border border-gray-800 rounded-xl p-3 font-mono text-xs">
        {visible.length === 0 ? (
          <p className="text-gray-600 mt-4 text-center">Aguardando logs...</p>
        ) : (
          visible.map((entry, i) => (
            <div key={i} className="flex gap-2 mb-0.5 hover:bg-gray-900/50 px-1 rounded">
              <span className="text-gray-600 shrink-0">{fmt(entry.ts)}</span>
              <span
                className={`shrink-0 px-1.5 rounded text-xs ${LEVEL_BADGE[entry.level]}`}
              >
                {entry.level}
              </span>
              <span className={LEVEL_COLORS[entry.level] || "text-gray-400"}>
                {entry.message}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
