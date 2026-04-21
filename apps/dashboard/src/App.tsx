import { Link, Route, Routes } from "react-router-dom";
import { SessionViewer } from "./routes/SessionViewer.js";
import { SessionsList } from "./routes/SessionsList.js";

export function App() {
  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <Link to="/" className="text-lg font-semibold text-slate-900">
          AI Support Dashboard
        </Link>
        <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
          mock mode
        </span>
      </header>
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<SessionsList />} />
          <Route path="/sessions/:id" element={<SessionViewer />} />
        </Routes>
      </main>
    </div>
  );
}
