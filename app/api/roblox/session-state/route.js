import { db } from "../../../../lib/firebaseAdmin";
import { verifyRobloxServer, unauthorized } from "../../../../lib/verifyRoblox";
import { rateLimit, tooManyRequests } from "../../../../lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Polled by the in-game trainer panel (TrainerPanel.lua) every few
 * seconds while open, and by each trainee's panel script to check for a
 * pendingTeleport. This is the "no heartbeat, but someone has to ask"
 * half of the architecture — Roblox pulls state on an interval here
 * instead of the backend pushing it.
 */
export async function POST(req) {
  if (!verifyRobloxServer(req)) return unauthorized();

  const limit = rateLimit(`session-state:${req.headers.get("x-pixie-server-key")}`, {
    max: 240,
    windowMs: 60_000,
  });
  if (!limit.allowed) return tooManyRequests();

  const body = await req.json().catch(() => null);
  const { sessionId, robloxUserId } = body || {};

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "sessionId required" }), { status: 400 });
  }

  const snap = await db().collection("sessions").doc(sessionId).get();
  if (!snap.exists) {
    return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
  }

  const data = snap.data();
  let pendingTeleport = null;

  if (robloxUserId) {
    const trainee = data.trainees?.[String(robloxUserId)];
    if (trainee?.pendingTeleport) {
      pendingTeleport = trainee.pendingTeleport;
      await db()
        .collection("sessions")
        .doc(sessionId)
        .set(
          { trainees: { [String(robloxUserId)]: { pendingTeleport: null } } },
          { merge: true }
        );
    }
  }

  return Response.json({
    status: data.status,
    hostRobloxId: data.hostRobloxId,
    hostUsername: data.hostUsername,
    coHostRobloxId: data.coHostRobloxId || null,
    coHostUsername: data.coHostUsername || null,
    trainees: data.trainees || {},
    pendingTeleport,
  });
}
