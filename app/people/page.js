import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import PeopleClient from "../../components/PeopleClient";

export default async function PeoplePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  if (!session.user.superAdmin) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <p style={{ color: "var(--mute)" }}>Only a super admin can manage people.</p>
      </main>
    );
  }

  return <PeopleClient />;
}
