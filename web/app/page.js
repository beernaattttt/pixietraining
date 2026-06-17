import { getServerSession } from "next-auth/next";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import ConsoleClient from "../components/ConsoleClient";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");

  if (!session.user.consoleAccess) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, margin: "0 0 8px" }}>
            Signed in, not yet authorized
          </h1>
          <p style={{ color: "var(--mute)", lineHeight: 1.5 }}>
            You're signed in as {session.user.username}, but no one has
            granted this account console access yet. Ask the person training
            you to grant it.
          </p>
        </div>
      </main>
    );
  }

  return <ConsoleClient user={session.user} />;
}
