"use client";
import { useState } from "react";

export default function LinkRobloxAccount({ robloxUserId, robloxUsername, onLinked }) {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function link() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/console/link-roblox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not link that account.");
        return;
      }
      onLinked(data.robloxUserId, data.robloxUsername);
      setUsername("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        background: "var(--panel)",
        padding: "16px 20px",
        marginBottom: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      {robloxUserId ? (
        <div style={{ fontSize: 13 }}>
          Roblox account: <strong>{robloxUsername}</strong>{" "}
          <span style={{ color: "var(--mute)" }}>(ID {robloxUserId})</span>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--mute)" }}>
          Your Roblox account isn't linked yet — managers and hosting permissions
          are tracked by Roblox ID, not Discord.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Your Roblox username"
          disabled={busy}
          style={{
            border: "1px solid var(--line)",
            padding: "8px 10px",
            fontSize: 13,
            borderRadius: 2,
            background: "var(--paper)",
          }}
        />
        <button
          onClick={link}
          disabled={busy || !username.trim()}
          style={{
            border: "1px solid var(--ink)",
            background: "var(--ink)",
            color: "var(--paper)",
            padding: "8px 14px",
            fontSize: 13,
            borderRadius: 2,
          }}
        >
          {robloxUserId ? "Re-link" : "Link account"}
        </button>
      </div>

      {error && (
        <div style={{ width: "100%", color: "var(--signal-red)", fontSize: 13 }}>{error}</div>
      )}
    </div>
  );
}
