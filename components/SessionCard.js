"use client";
import { useState } from "react";
import StatusPill from "./StatusPill";

export default function SessionCard({ session, onAction }) {
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null); // robloxUserId of opened detail
  const [configOpen, setConfigOpen] = useState(false);
  const [codeInput, setCodeInput] = useState(session.code);
  const [maxInput, setMaxInput] = useState(session.maxTrainees ?? "");

  const trainees = Object.entries(session.trainees || {});
  const activeTrainees = trainees.filter(([, t]) => t.rank === "trainee");

  async function run(action, robloxUserId, extra) {
    setBusy(true);
    await onAction(session.id, action, robloxUserId, extra);
    setBusy(false);
  }

  async function saveConfig() {
    const maxTrainees = maxInput === "" ? null : Number(maxInput);
    setBusy(true);
    await onAction(session.id, "configure", null, { code: codeInput, maxTrainees });
    setBusy(false);
    setConfigOpen(false);
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

      <div style={{ fontSize: 13, color: "var(--mute)", marginBottom: 12 }}>
        Hosted by {session.hostUsername || session.hostRobloxId}
        {typeof session.maxTrainees === "number" && (
          <> · {activeTrainees.length}/{session.maxTrainees} trainees</>
        )}
      </div>

      {/* Avatar row — click a face to open kick/ban/detail for that person */}
      {trainees.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {trainees.map(([uid, t]) => (
            <button
              key={uid}
              onClick={() => setSelected(selected === uid ? null : uid)}
              title={`${t.username || uid} — ${t.rank}`}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: `2px solid ${selected === uid ? "var(--ink)" : "var(--line)"}`,
                padding: 0,
                overflow: "hidden",
                background: "var(--paper)",
                position: "relative",
              }}
            >
              <img
                src={`https://www.roblox.com/headshot-thumbnail/image?userId=${uid}&width=150&height=150&format=png`}
                alt={t.username || uid}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {t.inServer && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "var(--signal-green)",
                    border: "2px solid var(--panel)",
                  }}
                  title="Currently in the private server"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {trainees.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--mute)", marginBottom: 12 }}>
          No one has joined yet.
        </div>
      )}

      {/* Detail panel for the selected trainee */}
      {selected && session.trainees?.[selected] && (
        <div
          style={{
            border: "1px solid var(--line)",
            padding: 12,
            marginBottom: 12,
            background: "var(--paper)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>
                {session.trainees[selected].username || selected}
              </span>
              <StatusPill value={session.trainees[selected].rank} />
              {session.trainees[selected].inServer && (
                <span style={{ fontSize: 11, color: "var(--signal-green)" }}>in server now</span>
              )}
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ border: "none", background: "none", color: "var(--mute)", fontSize: 12 }}
            >
              Close
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              disabled={busy}
              onClick={() => run("rate", selected, { rating: "passed" })}
              style={btnStyle("var(--signal-green)")}
            >
              Pass
            </button>
            <button
              disabled={busy}
              onClick={() => run("rate", selected, { rating: "failed" })}
              style={btnStyle("var(--signal-red)")}
            >
              Fail
            </button>
            <button disabled={busy} onClick={() => run("kick", selected)} style={btnStyle("var(--mute)")}>
              Kick
            </button>
            <button
              disabled={busy}
              onClick={() => run("ban", selected, { banScope: "session" })}
              style={btnStyle("var(--signal-red)")}
            >
              Ban (this session)
            </button>
            <button
              disabled={busy}
              onClick={() => run("ban", selected, { banScope: "permanent" })}
              style={btnStyle("var(--signal-red)")}
            >
              Ban (permanent)
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--mute)", margin: "8px 0 0" }}>
            Kick/ban takes effect the next time this person interacts with a panel in-game —
            there's no instant push to Roblox.
          </p>
        </div>
      )}

      {/* Session-level controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {session.status !== "locked" && (
          <button disabled={busy} onClick={() => run("lock")} style={outlineBtn}>
            Lock (stop new trainees)
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
        <button disabled={busy} onClick={() => run("teleport-all")} style={outlineBtn}>
          Teleport all to host
        </button>
        <button disabled={busy} onClick={() => setConfigOpen(!configOpen)} style={outlineBtn}>
          Configure
        </button>
      </div>

      {configOpen && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--line)",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label style={{ fontSize: 12, color: "var(--mute)" }}>
            Code{" "}
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: 12, color: "var(--mute)" }}>
            Trainee limit{" "}
            <input
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
              placeholder="unlimited"
              style={{ ...inputStyle, width: 70 }}
            />
          </label>
          <button disabled={busy} onClick={saveConfig} style={btnStyle("var(--ink)")}>
            Save
          </button>
        </div>
      )}
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

const inputStyle = {
  border: "1px solid var(--line)",
  padding: "6px 8px",
  fontSize: 12,
  borderRadius: 2,
  background: "var(--panel)",
};
