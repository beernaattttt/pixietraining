import { db } from "../../../../lib/firebaseAdmin";
import { requireConsoleAccess, forbidden } from "../../../../lib/requireAuth";

export async function GET() {
  const session = await requireConsoleAccess();
  if (!session) return forbidden("Console access required.");

  const snap = await db()
    .collection("sessions")
    .where("status", "in", ["open", "locked"])
    .orderBy("createdAt", "desc")
    .get();

  const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return Response.json({ sessions });
}
