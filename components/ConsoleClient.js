"use client";
import { useEffect, useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import SessionCard from "./SessionCard";
import LinkRobloxAccount from "./LinkRobloxAccount";

export default function ConsoleClient({ user }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [robloxUserId, setRobloxUserId] = useState(user.robloxUserId);
  const [robloxUsername, setRobloxUsername] = useState(user.robloxUsername);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/console/sessions");
      if (!res.ok) throw new Error("Failed to load sessions");
      const data = await res.json();
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
    // Live-ish view without a websocket layer: poll every 5s. Good enough
    // for a console managers glance at, not a high-frequency dashboard.
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  async function onAction(sessionId, action, robloxUserId, rating) {
    await fetch(`/api/console/sessions/${sessionId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, robloxUserId, rating }),
    });
    load();
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 32,
          paddingBottom: 20,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--mute)",
              marginBottom: 6,
            }}
          >
            Pixie Productions
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, margin: 0 }}>
            Active sessions
          </h1>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>{user.username}</div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            {user.superAdmin && (
              <Link
                href="/people"
                style={{ fontSize: 12, color: "var(--mute)", textDecoration: "underline" }}
              >
                People
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                fontSize: 12,
                color: "var(--mute)",
                background: "none",
                border: "none",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <LinkRobloxAccount
        robloxUserId={robloxUserId}
        robloxUsername={robloxUsername}
        onLinked={(id, name) => {
          setRobloxUserId(id);
          setRobloxUsername(name);
        }}
      />

      {loading && <p style={{ color: "var(--mute)" }}>Loading…</p>}
      {error && <p style={{ color: "var(--signal-red)" }}>{error}</p>}

      {!loading && sessions.length === 0 && (
        <p style={{ color: "var(--mute)" }}>
          Nothing running right now. Sessions appear here the moment a host
          starts one in-game.
        </p>
      )}

      {sessions.map((s) => (
        <SessionCard key={s.id} session={s} onAction={onAction} />
      ))}
    </main>
  );
}
