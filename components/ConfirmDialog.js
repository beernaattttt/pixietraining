"use client";
import { useState } from "react";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmColor = "var(--ink)",
  requireReason = false,
  onConfirm,
  onCancel,
}) {
  const [reason, setReason] = useState("");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 20, 15, 0.5)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: 24,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          padding: 24,
          maxWidth: 420,
          width: "100%",
        }}
      >
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 19, margin: "0 0 10px" }}>
          {title}
        </h3>
        <p style={{ fontSize: 14, color: "var(--mute)", lineHeight: 1.5, margin: "0 0 16px" }}>
          {message}
        </p>

        {requireReason && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (shown to the trainee, saved to the record)"
            rows={3}
            style={{
              width: "100%",
              border: "1px solid var(--line)",
              padding: 10,
              fontSize: 13,
              fontFamily: "var(--font-body)",
              marginBottom: 16,
              resize: "vertical",
              background: "var(--paper)",
              boxSizing: "border-box",
            }}
          />
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--ink)",
              fontSize: 13,
              padding: "8px 16px",
              borderRadius: 2,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={requireReason && !reason.trim()}
            style={{
              border: `1px solid ${confirmColor}`,
              background: confirmColor,
              color: "var(--paper)",
              fontSize: 13,
              padding: "8px 16px",
              borderRadius: 2,
              opacity: requireReason && !reason.trim() ? 0.5 : 1,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
