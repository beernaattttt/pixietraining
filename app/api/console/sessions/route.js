import { db } from "../../../../lib/firebaseAdmin";
import { requireConsoleAccess, forbidden } from "../../../../lib/requireAuth";

// This route reads the session (cookies) on every request — it must
// never be statically rendered/cached at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireConsoleAccess();
  if (!session) return forbidden("Console access required.");

  try {
    const snap = await db()
      .collection("sessions")
      .where("status", "in", ["open", "locked"])
      .orderBy("createdAt", "desc")
      .get();

    const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return Response.json({ sessions });
  } catch (e) {
    // Surface the real Firestore error (often a missing composite index,
    // which Firestore reports with a direct "create it here" link) instead
    // of a bare 500 with no information.
    return Response.json(
      { error: String(e?.message || e), sessions: [] },
      { status: 500 }
    );
  }
}
