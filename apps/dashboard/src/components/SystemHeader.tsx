import { Link, useLocation } from "react-router-dom";

export function SystemHeader() {
  const location = useLocation();
  const isDetail = location.pathname.startsWith("/sessions/");

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-6 px-6">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-sm"
        >
          <Link
            to="/"
            aria-label="AI Support Dashboard"
            className="flex items-center gap-2 font-semibold text-fg-0 transition-colors hover:text-brand"
          >
            <Logomark />
            <span>AI Support</span>
          </Link>
          <span className="text-fg-3" aria-hidden="true">
            /
          </span>
          <Link
            to="/"
            className={`transition-colors ${
              isDetail ? "text-fg-2 hover:text-fg-0" : "font-medium text-fg-0"
            }`}
          >
            Sessions
          </Link>
          {isDetail ? (
            <>
              <span className="text-fg-3" aria-hidden="true">
                /
              </span>
              <span className="font-mono text-xs text-fg-1">
                {location.pathname.split("/").pop()?.slice(0, 8).toUpperCase()}
              </span>
            </>
          ) : null}
        </nav>

        <div className="flex items-center gap-3">
          <ModeBadge label="Claude" value="mock" />
          <ModeBadge label="Shortcut" value="mock" />
          <ModeBadge label="GitHub" value="mock" />
          <span className="h-6 w-px bg-line" aria-hidden="true" />
          <div className="flex items-center gap-1.5 text-xs text-fg-2">
            <span
              className="h-1.5 w-1.5 rounded-full bg-success"
              aria-hidden="true"
            />
            <span>Operational</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function Logomark() {
  return (
    <span
      aria-hidden="true"
      className="grid h-6 w-6 place-items-center rounded-md bg-brand text-[11px] font-bold text-white"
    >
      S
    </span>
  );
}

function ModeBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs">
      <span className="text-fg-2">{label}</span>
      <span className="font-medium text-warning">{value}</span>
    </span>
  );
}
