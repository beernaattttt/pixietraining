"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import StatusPill from "./StatusPill";

const EVENT_LABELS = {
  joined: "joined",
  kicked: "was kicked",
  banned: "was banned",
  passed: "passed",
  failed: "failed",
  locked: "session locked",
  open: "session reopened",
  closed: "session closed",
  "co-host-assigned": "became Co-Host",
  configured: "session reconfigured",
  "teleport-all": "teleported everyone to host",
};

export default function HistoryClient() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/console/history");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setSessions(data.sessions || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--mute)", textDecoration: "underline" }}>
          ← Active sessions
        </Link>
      </div>

      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, margin: "0 0 24px" }}>
        Session history
      </h1>

      {loading && <p style={{ color: "var(--mute)" }}>Loading…</p>}
      {error && <p style={{ color: "var(--signal-red)" }}>{error}</p>}

      {!loading && sessions.length === 0 && (
        <p style={{ color: "var(--mute)" }}>No sessions recorded yet.</p>
      )}

      {sessions.map((s) => {
        const isOpen = expanded === s.id;
        const events = s.events || [];
        const trainees = Object.entries(s.trainees || {});
        const passedCount = trainees.filter(([, t]) => t.rank === "passed").length;
        const failedCount = trainees.filter(([, t]) => t.rank === "failed").length;
        const kickedCount = trainees.filter(([, t]) => t.rank === "kicked" || t.rank === "banned").length;

        return (
          <div
            key={s.id}
            style={{
              border: "1px solid var(--line)",
              background: "var(--panel)",
              marginBottom: 12,
            }}
          >
            <button
              onClick={() => setExpanded(isOpen ? null : s.id)}
              style={{
                width: "100%",
                textAlign: "left",
                border: "none",
                background: "transparent",
                padding: 16,
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600 }}>
                    {s.code}
                  </span>
                  <span style={{ color: "var(--mute)", fontSize: 12 }}>{s.rideCode}</span>
                  <StatusPill value={s.status} />
                </div>
                <div style={{ fontSize: 12, color: "var(--mute)" }}>
                  {new Date(s.createdAt).toLocaleString()} · hosted by{" "}
                  {s.hostUsername || s.hostRobloxId}
                  {s.coHostUsername && <> · co-host {s.coHostUsername}</>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--mute)" }}>
                {passedCount > 0 && <span style={{ color: "var(--signal-green)" }}>{passedCount} passed</span>}
                {failedCount > 0 && <span style={{ color: "var(--signal-red)" }}>{failedCount} failed</span>}
                {kickedCount > 0 && <span>{kickedCount} removed</span>}
              </div>
            </button>

            {isOpen && (
              <div style={{ borderTop: "1px solid var(--line)", padding: 16 }}>
                {events.length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--mute)", margin: 0 }}>
                    No events recorded for this session.
                  </p>
                )}
                {events.map((e, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 13,
                      padding: "6px 0",
                      borderTop: i === 0 ? "none" : "1px solid var(--line)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      <strong>{e.username || e.robloxUserId || "Someone"}</strong>{" "}
                      {EVENT_LABELS[e.type] || e.type}
                      {e.meta?.banScope && <> ({e.meta.banScope})</>}
                    </span>
                    <span style={{ color: "var(--mute)" }}>
                      {new Date(e.at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}
