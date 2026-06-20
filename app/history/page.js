import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import HistoryClient from "../../components/HistoryClient";

export default async function HistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!session.user.consoleAccess) redirect("/");

  return <HistoryClient />;
}
