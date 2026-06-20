"use client";
import { useState, useEffect } from "react";
import StatusPill from "./StatusPill";
import ConfirmDialog from "./ConfirmDialog";

export default function SessionCard({ session, onAction }) {
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [codeInput, setCodeInput] = useState(session.code);
  const [maxInput, setMaxInput] = useState(session.maxTrainees ?? "");
  const [thumbnails, setThumbnails] = useState({});
  const [pendingDialog, setPendingDialog] = useState(null);

  const trainees = Object.entries(session.trainees || {});
  const activeTrainees = trainees.filter(([, t]) => t.rank === "trainee");
  const traineeIdsKey = trainees.map(([uid]) => uid).join(",");

  useEffect(() => {
    const ids = trainees.map(([uid]) => uid);
    if (ids.length === 0) return;

    fetch("/api/console/avatars", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userIds: ids }),
    })
      .then((res) => res.json())
      .then((data) => setThumbnails((prev) => ({ ...prev, ...data.thumbnails })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traineeIdsKey]);

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

  function openDialog(kind, robloxUserId) {
    setPendingDialog({ kind, robloxUserId });
  }

  async function confirmDialog(reason) {
    const { kind, robloxUserId } = pendingDialog;
    setPendingDialog(null);

    if (kind === "pass") {
      await run("rate", robloxUserId, { rating: "passed" });
    } else if (kind === "fail") {
      await run("rate", robloxUserId, { rating: "failed", reason });
    } else if (kind === "kick") {
      await run("kick", robloxUserId, { reason });
    } else if (kind === "ban-session") {
      await run("ban", robloxUserId, { banScope: "session", reason });
    } else if (kind === "ban-permanent") {
      await run("ban", robloxUserId, { banScope: "permanent", reason });
    } else if (kind === "end-session") {
      await run("close");
    }
    setSelected(null);
  }

  const selectedTrainee = selected && session.trainees?.[selected];

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
        {session.coHostUsername && <> · co-host {session.coHostUsername}</>}
        {typeof session.maxTrainees === "number" && (
          <> · {activeTrainees.length}/{session.maxTrainees} trainees</>
        )}
      </div>

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
                background: "var(--line)",
                position: "relative",
              }}
            >
              {thumbnails[uid] ? (
                <img
                  src={thumbnails[uid]}
                  alt={t.username || uid}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--mute)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: "100%",
                  }}
                >
                  {(t.username || "?").slice(0, 2).toUpperCase()}
                </span>
              )}
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

      {selectedTrainee && (
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
              <span style={{ fontSize: 14 }}>{selectedTrainee.username || selected}</span>
              <StatusPill value={selectedTrainee.rank} />
              {selectedTrainee.inServer && (
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
              onClick={() => openDialog("pass", selected)}
              style={btnStyle("var(--signal-green)")}
            >
              Pass
            </button>
            <button
              disabled={busy}
              onClick={() => openDialog("fail", selected)}
              style={btnStyle("var(--signal-red)")}
            >
              Fail
            </button>
            <button disabled={busy} onClick={() => openDialog("kick", selected)} style={btnStyle("var(--mute)")}>
              Kick
            </button>
            <button
              disabled={busy}
              onClick={() => openDialog("ban-session", selected)}
              style={btnStyle("var(--signal-red)")}
            >
              Ban (this session)
            </button>
            <button
              disabled={busy}
              onClick={() => openDialog("ban-permanent", selected)}
              style={btnStyle("var(--signal-red)")}
            >
              Ban (permanent)
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--mute)", margin: "8px 0 0" }}>
            Takes effect the next time this person interacts with a panel in-game —
            there's no instant push to Roblox.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {session.status !== "locked" && (
          <button disabled={busy} onClick={() => run("lock")} style={outlineBtn}>
            Lock (stop new trainees)
          </button>
        )}
        {session.status === "locked" && (
          <button disabled={busy} onClick={() => run("open")} style={outlineBtn}>
            Unlock
          </button>
        )}
        <button disabled={busy} onClick={() => openDialog("end-session", null)} style={outlineBtn}>
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

      {pendingDialog?.kind === "pass" && (
        <ConfirmDialog
          title="Confirm pass"
          message={`Is ${selectedTrainee?.username || "this trainee"} prepared to operate this ride? Confirm only if they've completed the full training without skipping any steps.`}
          confirmLabel="Pass"
          confirmColor="var(--signal-green)"
          onConfirm={confirmDialog}
          onCancel={() => setPendingDialog(null)}
        />
      )}

      {pendingDialog?.kind === "fail" && (
        <ConfirmDialog
          title="Confirm fail"
          message={`Is ${selectedTrainee?.username || "this trainee"} not yet ready to operate this ride? They'll be told to retry in another session.`}
          confirmLabel="Fail"
          confirmColor="var(--signal-red)"
          onConfirm={confirmDialog}
          onCancel={() => setPendingDialog(null)}
        />
      )}

      {pendingDialog?.kind === "kick" && (
        <ConfirmDialog
          title="Kick from session"
          message={`${selectedTrainee?.username || "This trainee"} will be removed. This is recorded on their record and shown to them as the reason.`}
          confirmLabel="Kick"
          confirmColor="var(--mute)"
          requireReason
          onConfirm={confirmDialog}
          onCancel={() => setPendingDialog(null)}
        />
      )}

      {pendingDialog?.kind === "ban-session" && (
        <ConfirmDialog
          title="Ban from this session"
          message={`${selectedTrainee?.username || "This trainee"} won't be able to rejoin THIS session. This is recorded and shown to them as the reason.`}
          confirmLabel="Ban (session)"
          confirmColor="var(--signal-red)"
          requireReason
          onConfirm={confirmDialog}
          onCancel={() => setPendingDialog(null)}
        />
      )}

      {pendingDialog?.kind === "ban-permanent" && (
        <ConfirmDialog
          title="Permanent ban"
          message={`${selectedTrainee?.username || "This trainee"} won't be able to join ANY training session, ever, until manually unbanned. This is recorded and shown to them as the reason.`}
          confirmLabel="Ban (permanent)"
          confirmColor="var(--signal-red)"
          requireReason
          onConfirm={confirmDialog}
          onCancel={() => setPendingDialog(null)}
        />
      )}

      {pendingDialog?.kind === "end-session" && (
        <ConfirmDialog
          title="End this session?"
          message="Everyone currently in the private server — including the host — will be teleported to a normal server. The session closes permanently and can't be reopened or rejoined."
          confirmLabel="End session"
          confirmColor="var(--signal-red)"
          onConfirm={confirmDialog}
          onCancel={() => setPendingDialog(null)}
        />
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
