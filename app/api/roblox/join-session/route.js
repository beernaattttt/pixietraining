import { db } from "../../../../lib/firebaseAdmin";
import { verifyRobloxServer, unauthorized } from "../../../../lib/verifyRoblox";
import { rateLimit, tooManyRequests } from "../../../../lib/rateLimit";
import { audit } from "../../../../lib/audit";

export async function POST(req) {
  if (!verifyRobloxServer(req)) return unauthorized();

  // Tighter limit here — this is the endpoint someone would hammer to
  // guess valid session codes.
  const limit = rateLimit(`join:${req.headers.get("x-pixie-server-key")}`, {
    max: 40,
    windowMs: 60_000,
  });
  if (!limit.allowed) return tooManyRequests();

  const body = await req.json().catch(() => null);
  const { code, robloxUserId, username } = body || {};

  if (!code || !robloxUserId) {
    return new Response(JSON.stringify({ error: "code and robloxUserId required" }), {
      status: 400,
    });
  }

  // "No guests" rule: a real account must have a robloxUsers profile at
  // all (created on first join to any Pixie map, see register-user route).
  // This is the actual gate — Roblox no longer has true anonymous guests
  // platform-wide, so "is a verified cast/student" is what we check.
  const userSnap = await db().collection("robloxUsers").doc(String(robloxUserId)).get();
  if (!userSnap.exists) {
    await audit({
      actor: String(robloxUserId),
      actorType: "roblox-server",
      action: "join-denied",
      target: code,
      meta: { reason: "no profile / not cast or student" },
    });
    return Response.json({ allow: false, reason: "Not recognized as cast or a student." });
  }

  const sessionQuery = await db()
    .collection("sessions")
    .where("code", "==", code)
    .where("status", "==", "open")
    .limit(1)
    .get();

  if (sessionQuery.empty) {
    return Response.json({ allow: false, reason: "No active open session with that code." });
  }

  const sessionDoc = sessionQuery.docs[0];
  const session = sessionDoc.data();

  await db()
    .collection("sessions")
    .doc(sessionDoc.id)
    .set(
      {
        trainees: {
          [String(robloxUserId)]: {
            username: username || "",
            rank: "trainee",
            ratedBy: null,
            ratedAt: null,
          },
        },
      },
      { merge: true }
    );

  await audit({
    actor: String(robloxUserId),
    actorType: "roblox-server",
    action: "join-session",
    target: sessionDoc.id,
    meta: { code },
  });

  return Response.json({
    allow: true,
    privateServerId: session.privateServerId,
    privateServerLink: session.privateServerLink,
    sessionId: sessionDoc.id,
  });
}
