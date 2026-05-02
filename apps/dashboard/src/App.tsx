import { Route, Routes } from "react-router-dom";
import { SystemHeader } from "./components/SystemHeader.js";
import { SessionViewer } from "./routes/SessionViewer.js";
import { SessionsList } from "./routes/SessionsList.js";

export function App() {
  return (
    <div className="flex h-full flex-col bg-canvas text-fg-0">
      <SystemHeader />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          <Routes>
            <Route path="/" element={<SessionsList />} />
            <Route path="/sessions/:id" element={<SessionViewer />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
