import { useEffect, useMemo, useState } from "react";

type ExperimentStatus = "draft" | "scale" | "continue" | "testing" | "paused";

type Snapshot = {
  mode: "demo" | "live";
  updatedAt: string;
  portfolio: {
    activeExperiments: number;
    totalViews: number;
    followers: number;
  };
  experiments: Array<{
    id: string;
    name: string;
    status: ExperimentStatus;
    views: number;
    followers: number;
    retention: number;
    trend: number[];
  }>;
  providers: Array<{
    name: string;
    state: "connected" | "not_connected" | "planned";
    accounts: number;
    views: number;
  }>;
  signals: {
    rising: number;
    flat: number;
    falling: number;
    note: string;
  };
};

const statusLabel: Record<ExperimentStatus, string> = {
  draft: "Entwurf",
  scale: "Steigend",
  continue: "Positiv",
  testing: "Seitwärts",
  paused: "Pausiert",
};

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("./portfolio-snapshot.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Snapshot konnte nicht geladen werden.");
        return response.json() as Promise<Snapshot>;
      })
      .then(setSnapshot)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Unbekannter Fehler"),
      );
  }, []);

  const sorted = useMemo(
    () =>
      snapshot
        ? [...snapshot.experiments].sort((a, b) => b.views - a.views)
        : [],
    [snapshot],
  );

  if (error) {
    return (
      <main className="center-shell">
        <div className="error-card">
          <strong>Sounddesk Overview</strong>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="center-shell">
        <div className="loading-card">Portfolio wird geladen …</div>
      </main>
    );
  }

  const stale = isSnapshotStale(snapshot.updatedAt, 24);

  return (
    <div className="page">
      {snapshot.mode === "demo" ? (
        <div className="demo-banner">
          DEMO-DATEN · Noch keine echten Social-Analytics verbunden
        </div>
      ) : null}

      <header className="hero">
        <div>
          <p className="eyebrow">Sounddesk Enterprise</p>
          <h1>Portfolio Overview</h1>
          <p className="hero-copy">
            Read-only Übersicht. Entscheidungen, Freigaben und Aktionen bleiben im
            Sounddesk Master-Chat.
          </p>
        </div>

        <div className={stale ? "freshness stale" : "freshness"}>
          <span className="live-dot" />
          <div>
            <strong>{stale ? "Daten veraltet" : "Snapshot aktuell"}</strong>
            <small>{formatUpdated(snapshot.updatedAt)}</small>
          </div>
        </div>
      </header>

      <section className="metric-grid">
        <Metric label="Aktive Tests" value={String(snapshot.portfolio.activeExperiments)} />
        <Metric label="Views" value={formatNumber(snapshot.portfolio.totalViews)} />
        <Metric label="Follower" value={"+" + formatNumber(snapshot.portfolio.followers)} />
        <Metric
          label="Provider live"
          value={String(
            snapshot.providers.filter((provider) => provider.state === "connected").length,
          )}
        />
      </section>

      <section className="layout">
        <div className="panel primary-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Experimente</p>
              <h2>Was bewegt sich?</h2>
            </div>

            <div className="signal-strip">
              <span className="signal-up">↑ {snapshot.signals.rising}</span>
              <span className="signal-flat">→ {snapshot.signals.flat}</span>
              <span className="signal-down">↓ {snapshot.signals.falling}</span>
            </div>
          </div>

          <div className="experiment-table">
            {sorted.map((experiment) => (
              <article className="experiment-row" key={experiment.id}>
                <div className="experiment-name">
                  <span className={"status-dot " + experiment.status} />
                  <div>
                    <strong>{experiment.name}</strong>
                  </div>
                </div>

                <Sparkline values={experiment.trend} />

                <div className="numeric">
                  <strong>{formatNumber(experiment.views)}</strong>
                  <span>Views</span>
                </div>

                <div className="numeric hide-small">
                  <strong>{formatPercent(experiment.retention)}</strong>
                  <span>Retention</span>
                </div>

                <div className={"trend-label " + experiment.status}>
                  {statusLabel[experiment.status]}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="stack">
          <section className="panel">
            <p className="eyebrow">Provider</p>
            <h2>Verbindungen</h2>

            <div className="provider-list">
              {snapshot.providers.map((provider) => (
                <div className="provider-row" key={provider.name}>
                  <div className="provider-mark">
                    {provider.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <strong>{provider.name}</strong>
                    <small>
                      {provider.accounts > 0
                        ? provider.accounts +
                          " Account" +
                          (provider.accounts === 1 ? "" : "s")
                        : "Noch nicht verbunden"}
                    </small>
                  </div>

                  <span className={"provider-state " + provider.state}>
                    {provider.state === "connected"
                      ? "Live"
                      : provider.state === "planned"
                        ? "Später"
                        : "Offen"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel chat-card">
            <p className="eyebrow">Steuerung</p>
            <h2>Master-Chat</h2>
            <p>
              Diese Seite zeigt nur den Zustand. Für neue Experimente, Freigaben,
              Publishing oder Änderungen gehst du zurück in ChatGPT.
            </p>
            <div className="safe-badge">
              Keine Tokens · Keine Passwörter · Keine Aktionen
            </div>
          </section>
        </aside>
      </section>

      <footer>
        <span>{snapshot.signals.note}</span>
        <span>Nur sanitierte Portfolio-Daten.</span>
      </footer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  const width = 130;
  const height = 42;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 8) - 4;
      return x.toFixed(1) + "," + y.toFixed(1);
    })
    .join(" ");

  return (
    <svg className="sparkline" viewBox={"0 0 " + width + " " + height} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("de-CH").format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("de-CH", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUpdated(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function isSnapshotStale(value: string, maxAgeHours: number) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return true;
  return Date.now() - timestamp > maxAgeHours * 60 * 60 * 1000;
}
