"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

export default function PeopleClient() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/console/people");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setPeople(data.people || []);
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

  async function grant(discordId, robloxUserId, type, value) {
    if (type === "console") {
      await fetch("/api/console/grants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "console", value: { discordId, grant: value } }),
      });
    } else if (type === "host") {
      if (!robloxUserId) return;
      await fetch("/api/console/grants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "host", value: { robloxUserId, grant: value } }),
      });
    }
    load();
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--mute)", textDecoration: "underline" }}>
          ← Active sessions
        </Link>
      </div>

      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, margin: "0 0 24px" }}>
        People
      </h1>

      {loading && <p style={{ color: "var(--mute)" }}>Loading…</p>}
      {error && <p style={{ color: "var(--signal-red)" }}>{error}</p>}

      {!loading && people.length === 0 && (
        <p style={{ color: "var(--mute)" }}>
          No one has signed in yet. People appear here after their first Discord login.
        </p>
      )}

      {people.map((p) => (
        <div
          key={p.discordId}
          style={{
            border: "1px solid var(--line)",
            background: "var(--panel)",
            padding: 16,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{p.username || p.discordId}</div>
              <div style={{ fontSize: 12, color: "var(--mute)" }}>
                {p.robloxUsername
                  ? `Roblox: ${p.robloxUsername} (${p.robloxUserId})`
                  : "No Roblox account linked yet"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ToggleButton
              label="Console access"
              on={Boolean(p.consoleAccess)}
              onClick={() => grant(p.discordId, p.robloxUserId, "console", !p.consoleAccess)}
            />
            <ToggleButton
              label="Can host training"
              on={Boolean(p.canHostTraining)}
              disabled={!p.robloxUserId}
              hint={!p.robloxUserId ? "Needs a linked Roblox account first" : null}
              onClick={() => grant(p.discordId, p.robloxUserId, "host", !p.canHostTraining)}
            />
          </div>
        </div>
      ))}
    </main>
  );
}

function ToggleButton({ label, on, onClick, disabled, hint }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint || ""}
      style={{
        border: `1px solid ${on ? "var(--signal-green)" : "var(--line)"}`,
        background: "transparent",
        color: disabled ? "var(--mute)" : on ? "var(--signal-green)" : "var(--ink)",
        fontSize: 12,
        padding: "6px 12px",
        borderRadius: 2,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}: {on ? "granted" : "not granted"}
    </button>
  );
}
