const COLORS = {
  open: "var(--signal-amber)",
  locked: "var(--mute)",
  closed: "var(--signal-red)",
  trainee: "var(--mute)",
  passed: "var(--signal-green)",
  failed: "var(--signal-red)",
  kicked: "var(--signal-red)",
};

export default function StatusPill({ value }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: COLORS[value] || "var(--mute)",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: COLORS[value] || "var(--mute)",
          display: "inline-block",
        }}
      />
      {value}
    </span>
  );
}
