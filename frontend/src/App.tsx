import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Channels from "./pages/Channels";
import Settings from "./pages/Settings";
import Prompt from "./pages/Prompt";
import Clips from "./pages/Clips";
import Logs from "./pages/Logs";

export default function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/clips" element={<Clips />} />
          <Route path="/prompt" element={<Prompt />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </main>
    </div>
  );
}
