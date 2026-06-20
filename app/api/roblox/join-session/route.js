import { db } from "../../../../lib/firebaseAdmin";
import { verifyRobloxServer, unauthorized } from "../../../../lib/verifyRoblox";
import { rateLimit, tooManyRequests } from "../../../../lib/rateLimit";
import { audit } from "../../../../lib/audit";
import { appendSessionEvent } from "../../../../lib/sessionEvents";

export const dynamic = "force-dynamic";

// Hardcoded per your Pixie Productions group (34087378) rank structure.
// Kept here rather than in the database because rank meaning is a
// business rule that changes rarely and should be reviewed in code, not
// editable by accident from a UI.
const RANK_TRAINEE_MIN = 4;
const RANK_CAST_MIN = 5; // 5 = cast, 6 = senior cast
const RANK_MANAGER_MIN = 7;

export async function POST(req) {
  if (!verifyRobloxServer(req)) return unauthorized();

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

  // No-guests rule: must have a robloxUsers profile at all.
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

  const user = userSnap.data();
  const groupRank = typeof user.groupRank === "number" ? user.groupRank : 0;
  const isManager = groupRank >= RANK_MANAGER_MIN;
  const isCastOrTrainee = groupRank >= RANK_TRAINEE_MIN && groupRank < RANK_MANAGER_MIN;

  if (!isManager && !isCastOrTrainee) {
    return Response.json({ allow: false, reason: "Your group rank isn't eligible for training." });
  }

  // Permanent ban check, independent of any specific session.
  const banSnap = await db().collection("bans").doc(String(robloxUserId)).get();
  if (banSnap.exists) {
    return Response.json({ allow: false, reason: "You are permanently banned from training sessions." });
  }

  const sessionQuery = await db()
    .collection("sessions")
    .where("code", "==", code)
    .where("status", "in", ["open", "locked"])
    .limit(1)
    .get();

  if (sessionQuery.empty) {
    return Response.json({ allow: false, reason: "No active session with that code." });
  }

  const sessionDoc = sessionQuery.docs[0];
  const session = sessionDoc.data();
  const existingTrainee = session.trainees?.[String(robloxUserId)];

  // Session-scoped ban: kicked-and-banned-for-this-session trainees can't
  // rejoin the same session even if it's still open.
  if (existingTrainee?.rank === "banned" && existingTrainee?.banScope === "session") {
    return Response.json({ allow: false, reason: "You were banned from this session." });
  }

  // Managers always get in, regardless of lock state — they're
  // supervising, not training.
  if (isManager) {
    return Response.json({
      allow: true,
      asManager: true,
      privateServerId: session.privateServerId,
      privateServerLink: session.privateServerLink,
      sessionId: sessionDoc.id,
    });
  }

  // Cast/senior cast who already hold this ride's certification get
  // redirected instead of entering as a trainee — this session has
  // nothing to teach them, and keeping them out keeps the trainee list
  // meaningful for whoever's running it.
  const alreadyCertified = Boolean(user.qualifications?.[session.rideCode]);
  if (alreadyCertified) {
    return Response.json({
      allow: false,
      alreadyCertified: true,
      reason: "You're already certified for this ride.",
    });
  }

  if (session.status === "locked" && !existingTrainee) {
    return Response.json({ allow: false, reason: "This session is locked to new trainees." });
  }

  const currentTraineeCount = Object.values(session.trainees || {}).filter(
    (t) => t.rank === "trainee"
  ).length;

  if (
    !existingTrainee &&
    typeof session.maxTrainees === "number" &&
    currentTraineeCount >= session.maxTrainees
  ) {
    return Response.json({ allow: false, reason: "This session is full." });
  }

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
            inServer: false, // set true by the presence route once they actually land
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

  await appendSessionEvent(sessionDoc.id, {
    type: "joined",
    robloxUserId: String(robloxUserId),
    username: username || "",
    by: null,
  });

  return Response.json({
    allow: true,
    asManager: false,
    privateServerId: session.privateServerId,
    privateServerLink: session.privateServerLink,
    sessionId: sessionDoc.id,
  });
}
