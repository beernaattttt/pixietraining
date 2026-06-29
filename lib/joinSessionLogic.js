import { db } from "./firebaseAdmin";
import { audit } from "./audit";
import { appendSessionEvent } from "./sessionEvents";

// Hardcoded per your Pixie Productions group (34087378) rank structure.
// Kept here rather than in the database because rank meaning is a
// business rule that changes rarely and should be reviewed in code, not
// editable by accident from a UI.
const RANK_TRAINEE_MIN = 4;
const RANK_CAST_MIN = 5; // 5 = cast, 6 = senior cast
const RANK_MANAGER_MIN = 7;

/**
 * Shared join-session business logic. Used by both:
 *  - app/api/roblox/join-session/route.js (called by the Roblox game server)
 *  - app/api/discord/join-session/route.js (called by the Discord bot on a
 *    member's behalf when they press "Join" on a training embed)
 *
 * `actorType` is passed through to audit/event logs so it's always clear
 * whether a join came from in-game or from Discord, without changing the
 * eligibility rules themselves — those must stay identical regardless of
 * which surface triggered them.
 */
export async function attemptJoinSession({ code, robloxUserId, username, actorType }) {
  // No-guests rule: must have a robloxUsers profile at all.
  const userSnap = await db().collection("robloxUsers").doc(String(robloxUserId)).get();
  if (!userSnap.exists) {
    await audit({
      actor: String(robloxUserId),
      actorType,
      action: "join-denied",
      target: code,
      meta: { reason: "no profile / not cast or student" },
    });
    return { allow: false, reason: "Not recognized as cast or a student." };
  }

  const user = userSnap.data();
  const groupRank = typeof user.groupRank === "number" ? user.groupRank : 0;
  const isManager = groupRank >= RANK_MANAGER_MIN;
  const isCastOrTrainee = groupRank >= RANK_TRAINEE_MIN && groupRank < RANK_MANAGER_MIN;

  if (!isManager && !isCastOrTrainee) {
    return { allow: false, reason: "Your group rank isn't eligible for training." };
  }

  // Permanent ban check, independent of any specific session.
  const banSnap = await db().collection("bans").doc(String(robloxUserId)).get();
  if (banSnap.exists) {
    return { allow: false, reason: "You are permanently banned from training sessions." };
  }

  const sessionQuery = await db()
    .collection("sessions")
    .where("code", "==", code)
    .where("status", "in", ["open", "locked"])
    .limit(1)
    .get();

  if (sessionQuery.empty) {
    return { allow: false, reason: "No active session with that code." };
  }

  const sessionDoc = sessionQuery.docs[0];
  const session = sessionDoc.data();
  const existingTrainee = session.trainees?.[String(robloxUserId)];

  // Session-scoped ban: kicked-and-banned-for-this-session trainees can't
  // rejoin the same session even if it's still open.
  if (existingTrainee?.rank === "banned" && existingTrainee?.banScope === "session") {
    return { allow: false, reason: "You were banned from this session." };
  }

  // Managers always get in, regardless of lock state — they're
  // supervising, not training.
  if (isManager) {
    return {
      allow: true,
      asManager: true,
      privateServerId: session.privateServerId,
      privateServerLink: session.privateServerLink,
      sessionId: sessionDoc.id,
    };
  }

  // Cast/senior cast who already hold this ride's certification get
  // redirected instead of entering as a trainee — this session has
  // nothing to teach them, and keeping them out keeps the trainee list
  // meaningful for whoever's running it.
  const alreadyCertified = Boolean(user.qualifications?.[session.rideCode]);
  if (alreadyCertified) {
    return {
      allow: false,
      alreadyCertified: true,
      reason: "You're already certified for this ride.",
    };
  }

  if (session.status === "locked" && !existingTrainee) {
    return { allow: false, reason: "This session is locked to new trainees." };
  }

  const currentTraineeCount = Object.values(session.trainees || {}).filter(
    (t) => t.rank === "trainee"
  ).length;

  if (
    !existingTrainee &&
    typeof session.maxTrainees === "number" &&
    currentTraineeCount >= session.maxTrainees
  ) {
    return { allow: false, reason: "This session is full." };
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
    actorType,
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

  return {
    allow: true,
    asManager: false,
    privateServerId: session.privateServerId,
    privateServerLink: session.privateServerLink,
    sessionId: sessionDoc.id,
  };
}

/**
 * Removes a trainee from a session's trainee list — used by the Discord
 * "already joined, unjoin?" confirmation flow. Only removes trainees who
 * joined normally (not banned/kicked entries, which are deliberately kept
 * for moderation history).
 */
export async function leaveSession({ code, robloxUserId }) {
  const sessionQuery = await db()
    .collection("sessions")
    .where("code", "==", code)
    .where("status", "in", ["open", "locked"])
    .limit(1)
    .get();

  if (sessionQuery.empty) {
    return { ok: false, reason: "No active session with that code." };
  }

  const sessionDoc = sessionQuery.docs[0];
  const session = sessionDoc.data();
  const existingTrainee = session.trainees?.[String(robloxUserId)];

  if (!existingTrainee || existingTrainee.rank !== "trainee") {
    return { ok: false, reason: "You are not currently signed up for this session." };
  }

  const updatedTrainees = { ...session.trainees };
  delete updatedTrainees[String(robloxUserId)];

  await sessionDoc.ref.update({ trainees: updatedTrainees });

  await appendSessionEvent(sessionDoc.id, {
    type: "left",
    robloxUserId: String(robloxUserId),
    username: existingTrainee.username || "",
    by: null,
  });

  return { ok: true, sessionId: sessionDoc.id };
}
