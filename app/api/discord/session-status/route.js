import { db } from "../../../../lib/firebaseAdmin";
import { verifyDiscordBot, unauthorized } from "../../../../lib/verifyDiscordBot";

export const dynamic = "force-dynamic";

// Read-only status check for the Discord bot to poll while a session embed
// is live, so it can edit the message's trainee count without needing
// direct Firestore credentials of its own.
export async function GET(req) {
  if (!verifyDiscordBot(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return Response.json({ error: "sessionId is required" }, { status: 400 });
  }

  const snap = await db().collection("sessions").doc(sessionId).get();

  if (!snap.exists) {
    return Response.json({ found: false });
  }

  const session = snap.data();
  const traineeCount = Object.values(session.trainees || {}).filter(
    (t) => t.rank === "trainee"
  ).length;

  return Response.json({
    found: true,
    status: session.status,
    code: session.code,
    rideCode: session.rideCode,
    hostUsername: session.hostUsername || "",
    maxTrainees: session.maxTrainees ?? null,
    traineeCount,
    closedAt: session.closedAt || null,
  });
}
