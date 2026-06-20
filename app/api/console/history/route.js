import { db } from "../../../../lib/firebaseAdmin";
import { requireConsoleAccess, forbidden } from "../../../../lib/requireAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireConsoleAccess();
  if (!session) return forbidden("Console access required.");

  try {
    const snap = await db()
      .collection("sessions")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return Response.json({ sessions });
  } catch (e) {
    return Response.json({ error: String(e?.message || e), sessions: [] }, { status: 500 });
  }
}
