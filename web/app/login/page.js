"use client";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "min(420px, 100%)" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--mute)",
            marginBottom: 12,
          }}
        >
          Pixie Productions
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 32,
            margin: "0 0 8px",
            lineHeight: 1.15,
          }}
        >
          Training console
        </h1>
        <p style={{ color: "var(--mute)", margin: "0 0 28px", lineHeight: 1.5 }}>
          Access is granted individually. Signing in with Discord confirms who
          you are — it does not grant access by itself.
        </p>

        <button
          onClick={() => signIn("discord", { callbackUrl: "/" })}
          style={{
            width: "100%",
            padding: "14px 18px",
            background: "var(--ink)",
            color: "var(--paper)",
            border: "none",
            borderRadius: 2,
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Continue with Discord
        </button>

        <div
          style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: "1px solid var(--line)",
            fontSize: 13,
            color: "var(--mute)",
            lineHeight: 1.5,
          }}
        >
          No console access yet? Ask whoever is training you to grant it from
          their console — it isn't self-service.
        </div>
      </div>
    </main>
  );
}
