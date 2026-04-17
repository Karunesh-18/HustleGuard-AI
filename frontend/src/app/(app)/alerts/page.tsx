"use client";

import { useEffect, useState, useCallback } from "react";
import { getZoneLiveData, API_BASE } from "@/lib/api";
import type { ZoneLiveData } from "@/types";

interface NewsAlert {
  title: string;
  description: string;
  url: string;
  published_at: string;
  source_name: string;
  severity: "high" | "medium" | "info";
}

async function fetchNewsAlerts(): Promise<NewsAlert[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/alerts`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    high:   { label: "HIGH",   color: "var(--danger)",  bg: "rgba(239,68,68,0.12)" },
    medium: { label: "MEDIUM", color: "var(--warning)", bg: "rgba(245,158,11,0.12)" },
    info:   { label: "INFO",   color: "var(--accent)",  bg: "rgba(6,214,160,0.10)" },
  };
  const s = map[severity] ?? map.info;
  return (
    <span style={{
      fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.05em",
      color: s.color, background: s.bg, padding: "2px 7px", borderRadius: 4,
    }}>
      {s.label}
    </span>
  );
}

function NewsAlertCard({ item }: { item: NewsAlert }) {
  const icon = item.severity === "high" ? "🚨" : item.severity === "medium" ? "⚠️" : "📰";
  const timeAgo = (() => {
    const diff = Date.now() - new Date(item.published_at).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return "< 1h ago";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  })();

  return (
    <div className="card" style={{ display: "flex", gap: 12 }}>
      <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row justify-between" style={{ gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <SeverityBadge severity={item.severity} />
          <span className="body-sm" style={{ color: "var(--text-tertiary)" }}>{timeAgo}</span>
        </div>
        <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: 4, lineHeight: 1.4 }}>
          {item.title}
        </div>
        {item.description && (
          <div className="body-sm" style={{ color: "var(--text-secondary)", marginBottom: 6, lineHeight: 1.5 }}>
            {item.description.slice(0, 160)}{item.description.length > 160 ? "…" : ""}
          </div>
        )}
        <div className="row" style={{ gap: 8 }}>
          <span className="body-sm" style={{ color: "var(--text-tertiary)" }}>
            via {item.source_name}
          </span>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "0.75rem", color: "var(--brand-light)", fontWeight: 600 }}
            >
              Read →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertCard({ zone }: { zone: ZoneLiveData }) {
  const level = zone.dai < 0.4 ? "high" : zone.dai < 0.6 ? "moderate" : "normal";
  const icon = level === "high" ? "🚨" : level === "moderate" ? "⚠️" : "✅";
  const message =
    level === "high"
      ? "Severe disruption — auto-payout check running"
      : level === "moderate"
      ? "Moderate disruption — monitor closely"
      : "Conditions normal — no action needed";

  return (
    <div className="card" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div className="row justify-between" style={{ marginBottom: 4 }}>
          <div style={{ fontWeight: 700 }}>{zone.zone_name}</div>
          <div className={`pill pill-${level}`} style={{ fontSize: "0.6rem" }}>
            {level.toUpperCase()}
          </div>
        </div>
        <div className="body-sm" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
          {message}
        </div>
        <div className="grid-3" style={{ gap: 6 }}>
          {[
            { l: "DAI", v: `${Math.round(zone.dai * 100)}%` },
            { l: "Rain", v: `${zone.rainfall_mm}mm` },
            { l: "AQI", v: zone.aqi },
          ].map(({ l, v }) => (
            <div key={l} style={{ fontSize: "0.75rem" }}>
              <span style={{ color: "var(--text-tertiary)" }}>{l}: </span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [zones, setZones] = useState<ZoneLiveData[]>([]);
  const [news, setNews] = useState<NewsAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"zone" | "news">("zone");

  const fetchAll = useCallback(async () => {
    try {
      const [zonesData, newsData] = await Promise.allSettled([
        getZoneLiveData(),
        fetchNewsAlerts(),
      ]);
      if (zonesData.status === "fulfilled") setZones(zonesData.value);
      if (newsData.status === "fulfilled") setNews(newsData.value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    const id = setInterval(fetchAll, 60_000); // refresh every 60s (NewsAPI has 10m cache)
    return () => clearInterval(id);
  }, [fetchAll]);

  // Sort: disrupted first
  const sorted = [...zones].sort((a, b) => a.dai - b.dai);
  const disrupted = sorted.filter((z) => z.dai < 0.4);
  const watch = sorted.filter((z) => z.dai >= 0.4 && z.dai < 0.6);
  const clear = sorted.filter((z) => z.dai >= 0.6);

  const highNews = news.filter((n) => n.severity === "high");
  const otherNews = news.filter((n) => n.severity !== "high");

  return (
    <div className="p-md stack">
      <div style={{ paddingTop: 4 }}>
        <div className="display-sm">Alerts</div>
        <div className="body-sm" style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Live zone monitoring + real news alerts
        </div>
      </div>

      {/* Tab bar */}
      <div className="row" style={{ gap: 0, background: "var(--bg-raised)", borderRadius: "var(--radius-md)", padding: 3 }}>
        {(["zone", "news"] as const).map((t) => (
          <button
            key={t} type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "7px 0", borderRadius: "calc(var(--radius-md) - 2px)",
              background: tab === t ? "var(--bg-card)" : "transparent",
              border: tab === t ? "1px solid var(--border)" : "1px solid transparent",
              color: tab === t ? "var(--text-primary)" : "var(--text-tertiary)",
              fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.02em",
              transition: "all 0.15s", textTransform: "capitalize",
            }}
          >
            {t === "zone" ? `Zone Status (${zones.length})` : `News Alerts ${news.length > 0 ? `(${news.length})` : ""}`}
          </button>
        ))}
      </div>

      {/* ── Zone Status Tab ── */}
      {tab === "zone" && (
        loading ? (
          <div className="stack">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton-shimmer" style={{ height: 100 }} />)}
          </div>
        ) : zones.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <div className="empty-title">No zone data</div>
            <div className="empty-body">Backend may be offline</div>
          </div>
        ) : (
          <>
            {disrupted.length > 0 && (
              <div className="section">
                <div className="section-title"><span>🚨</span> Active Disruptions ({disrupted.length})</div>
                <div className="stack">
                  {disrupted.map((z) => <AlertCard key={z.zone_name} zone={z} />)}
                </div>
              </div>
            )}
            {watch.length > 0 && (
              <div className="section">
                <div className="section-title"><span>⚠️</span> Watch ({watch.length})</div>
                <div className="stack">
                  {watch.map((z) => <AlertCard key={z.zone_name} zone={z} />)}
                </div>
              </div>
            )}
            {clear.length > 0 && (
              <div className="section">
                <div className="section-title"><span>✅</span> Clear ({clear.length})</div>
                <div className="stack">
                  {clear.map((z) => <AlertCard key={z.zone_name} zone={z} />)}
                </div>
              </div>
            )}
          </>
        )
      )}

      {/* ── News Alerts Tab ── */}
      {tab === "news" && (
        loading ? (
          <div className="stack">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton-shimmer" style={{ height: 120 }} />)}
          </div>
        ) : news.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <div className="empty-title">No alerts right now</div>
            <div className="empty-body">
              Powered by NewsAPI — monitoring Bangalore flood, rain & traffic alerts.
              No matching news in the last 24 hours.
            </div>
          </div>
        ) : (
          <>
            {highNews.length > 0 && (
              <div className="section">
                <div className="section-title"><span>🚨</span> High Severity ({highNews.length})</div>
                <div className="stack">
                  {highNews.map((n, i) => <NewsAlertCard key={i} item={n} />)}
                </div>
              </div>
            )}
            {otherNews.length > 0 && (
              <div className="section">
                <div className="section-title"><span>📰</span> Updates ({otherNews.length})</div>
                <div className="stack">
                  {otherNews.map((n, i) => <NewsAlertCard key={i} item={n} />)}
                </div>
              </div>
            )}
            <div className="body-sm" style={{ color: "var(--text-tertiary)", textAlign: "center", marginTop: 8 }}>
              Source: NewsAPI · Refreshes every 10 min · Keywords: Bangalore flood, rain, cyclone, traffic
            </div>
          </>
        )
      )}
    </div>
  );
}
