import { db } from "../../../../lib/firebaseAdmin";
import { verifyRobloxServer, unauthorized } from "../../../../lib/verifyRoblox";
import { rateLimit, tooManyRequests } from "../../../../lib/rateLimit";
import { appendSessionEvent } from "../../../../lib/sessionEvents";

export const dynamic = "force-dynamic";

/**
 * Self-assignment, no approval step — matches "any manager present can
 * do this." Only one Co-Host slot exists per session; calling this again
 * (by the same or a different manager) just reassigns it, it doesn't
 * stack multiple Co-Hosts. We still re-verify rank server-side rather
 * than trusting the in-game trainer panel's own rank check, since that
 * panel's gating is a UX nicety, not the security boundary (same pattern
 * as every other Roblox-facing route here).
 */
export async function POST(req) {
  if (!verifyRobloxServer(req)) return unauthorized();

  const limit = rateLimit(`cohost:${req.headers.get("x-pixie-server-key")}`, {
    max: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) return tooManyRequests();

  const body = await req.json().catch(() => null);
  const { sessionId, robloxUserId, username } = body || {};

  if (!sessionId || !robloxUserId) {
    return new Response(JSON.stringify({ error: "sessionId and robloxUserId required" }), {
      status: 400,
    });
  }

  const userSnap = await db().collection("robloxUsers").doc(String(robloxUserId)).get();
  const groupRank = userSnap.exists ? userSnap.data()?.groupRank || 0 : 0;

  if (groupRank < 7) {
    return new Response(JSON.stringify({ error: "Only managers (rank 7+) can become Co-Host." }), {
      status: 403,
    });
  }

  const ref = db().collection("sessions").doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) {
    return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
  }

  await ref.update({
    coHostRobloxId: String(robloxUserId),
    coHostUsername: username || "",
  });

  await appendSessionEvent(sessionId, {
    type: "co-host-assigned",
    robloxUserId: String(robloxUserId),
    username: username || "",
    by: String(robloxUserId),
  });

  return Response.json({ ok: true });
}
