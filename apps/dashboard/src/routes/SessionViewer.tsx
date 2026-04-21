import { useParams } from "react-router-dom";

export function SessionViewer() {
  const { id } = useParams<{ id: string }>();
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Session {id}
      </h2>
      <p className="text-sm text-slate-500">
        Session replay arrives in Bundle F.
      </p>
    </section>
  );
}
