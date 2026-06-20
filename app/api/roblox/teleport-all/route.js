import { db } from "../../../../lib/firebaseAdmin";
import { verifyRobloxServer, unauthorized } from "../../../../lib/verifyRoblox";
import { rateLimit, tooManyRequests } from "../../../../lib/rateLimit";
import { appendSessionEvent } from "../../../../lib/sessionEvents";

export const dynamic = "force-dynamic";

/**
 * In-game trainer panel version of "teleport everyone to me" — the web
 * console has its own copy of this logic in
 * /api/console/sessions/[id] (action: "teleport-all"). Both write to the
 * same trainees.{uid}.pendingTeleport field, picked up by
 * session-state polling, so it doesn't matter which side triggered it.
 *
 * Host can always do this. Co-Host can ALSO do this — per your answer,
 * Co-Host is limited to teleport actions only, this being one of them.
 */
export async function POST(req) {
  if (!verifyRobloxServer(req)) return unauthorized();

  const limit = rateLimit(`teleport-all:${req.headers.get("x-pixie-server-key")}`, {
    max: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) return tooManyRequests();

  const body = await req.json().catch(() => null);
  const { sessionId, robloxUserId } = body || {};

  if (!sessionId || !robloxUserId) {
    return new Response(JSON.stringify({ error: "sessionId and robloxUserId required" }), {
      status: 400,
    });
  }

  const ref = db().collection("sessions").doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) {
    return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
  }
  const data = snap.data();

  const isHost = String(data.hostRobloxId) === String(robloxUserId);
  const isCoHost = data.coHostRobloxId && String(data.coHostRobloxId) === String(robloxUserId);

  if (!isHost && !isCoHost) {
    return new Response(JSON.stringify({ error: "Only the Host or Co-Host can do this." }), {
      status: 403,
    });
  }

  const trainees = data.trainees || {};
  const updates = {};
  for (const [uid, t] of Object.entries(trainees)) {
    if (t.inServer && String(uid) !== String(robloxUserId)) {
      updates[`trainees.${uid}.pendingTeleport`] = "to-host";
    }
  }

  if (Object.keys(updates).length > 0) {
    await ref.update(updates);
  }

  await appendSessionEvent(sessionId, {
    type: "teleport-all",
    robloxUserId: null,
    username: null,
    by: String(robloxUserId),
  });

  return Response.json({ ok: true });
}
