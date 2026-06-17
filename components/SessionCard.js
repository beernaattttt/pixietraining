"use client";
import { useState } from "react";
import StatusPill from "./StatusPill";

export default function SessionCard({ session, onAction }) {
  const [busy, setBusy] = useState(false);
  const trainees = Object.entries(session.trainees || {});

  async function run(action, robloxUserId, rating) {
    setBusy(true);
    await onAction(session.id, action, robloxUserId, rating);
    setBusy(false);
  }

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        background: "var(--panel)",
        padding: 20,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600 }}>
            {session.code}
          </span>
          <span style={{ color: "var(--mute)", fontSize: 13 }}>{session.rideCode}</span>
        </div>
        <StatusPill value={session.status} />
      </div>

      <div style={{ fontSize: 13, color: "var(--mute)", marginBottom: 16 }}>
        Hosted by {session.hostUsername || session.hostRobloxId}
      </div>

      <div style={{ marginBottom: 16 }}>
        {trainees.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--mute)" }}>No one has joined yet.</div>
        )}
        {trainees.map(([uid, t]) => (
          <div
            key={uid}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 0",
              borderTop: "1px solid var(--line)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 14 }}>{t.username || uid}</span>
              <StatusPill value={t.rank} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                disabled={busy}
                onClick={() => run("rate", uid, "passed")}
                style={btnStyle("var(--signal-green)")}
              >
                Pass
              </button>
              <button
                disabled={busy}
                onClick={() => run("rate", uid, "failed")}
                style={btnStyle("var(--signal-red)")}
              >
                Fail
              </button>
              <button disabled={busy} onClick={() => run("kick", uid)} style={btnStyle("var(--mute)")}>
                Kick
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {session.status !== "locked" && (
          <button disabled={busy} onClick={() => run("lock")} style={outlineBtn}>
            Lock
          </button>
        )}
        {session.status === "locked" && (
          <button disabled={busy} onClick={() => run("open")} style={outlineBtn}>
            Reopen
          </button>
        )}
        <button disabled={busy} onClick={() => run("close")} style={outlineBtn}>
          End session
        </button>
      </div>
    </div>
  );
}

function btnStyle(color) {
  return {
    border: `1px solid ${color}`,
    color,
    background: "transparent",
    fontSize: 12,
    padding: "5px 10px",
    borderRadius: 2,
  };
}

const outlineBtn = {
  border: "1px solid var(--ink)",
  background: "transparent",
  color: "var(--ink)",
  fontSize: 13,
  padding: "8px 14px",
  borderRadius: 2,
};
