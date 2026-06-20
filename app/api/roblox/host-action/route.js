import { db } from "../../../../lib/firebaseAdmin";
import { verifyRobloxServer, unauthorized } from "../../../../lib/verifyRoblox";
import { rateLimit, tooManyRequests } from "../../../../lib/rateLimit";
import { appendSessionEvent } from "../../../../lib/sessionEvents";

export const dynamic = "force-dynamic";

const VALID_ACTIONS = ["lock", "open", "close", "rate", "kick", "ban"];
const VALID_RATINGS = ["passed", "failed"];
const VALID_BAN_SCOPES = ["session", "permanent"];

export async function POST(req) {
  if (!verifyRobloxServer(req)) return unauthorized();

  const limit = rateLimit(`host-action:${req.headers.get("x-pixie-server-key")}`, {
    max: 60,
    windowMs: 60_000,
  });
  if (!limit.allowed) return tooManyRequests();

  const body = await req.json().catch(() => null);
  const { sessionId, robloxUserId, action, targetRobloxUserId, rating, banScope, reason } =
    body || {};

  if (!sessionId || !robloxUserId || !VALID_ACTIONS.includes(action)) {
    return new Response(
      JSON.stringify({ error: "sessionId, robloxUserId, and a valid action are required" }),
      { status: 400 }
    );
  }

  const ref = db().collection("sessions").doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) {
    return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
  }
  const data = snap.data();

  if (String(data.hostRobloxId) !== String(robloxUserId)) {
    return new Response(
      JSON.stringify({ error: "Only the Host can do this from the in-game panel." }),
      { status: 403 }
    );
  }

  if (action === "lock" || action === "open" || action === "close") {
    const statusMap = { lock: "locked", open: "open", close: "closed" };
    await ref.update({
      status: statusMap[action],
      ...(action === "close" ? { closedAt: new Date().toISOString() } : {}),
    });
    await appendSessionEvent(sessionId, {
      type: action === "close" ? "closed" : action,
      robloxUserId: null,
      username: null,
      by: String(robloxUserId),
    });
  }

  if (action === "kick") {
    if (!targetRobloxUserId) {
      return new Response(JSON.stringify({ error: "targetRobloxUserId required" }), {
        status: 400,
      });
    }
    await ref.update({
      [`trainees.${targetRobloxUserId}.rank`]: "kicked",
      [`trainees.${targetRobloxUserId}.ratedBy`]: String(robloxUserId),
      [`trainees.${targetRobloxUserId}.ratedAt`]: new Date().toISOString(),
      [`trainees.${targetRobloxUserId}.pendingAction`]: "kick",
      [`trainees.${targetRobloxUserId}.reason`]: reason || "",
    });
    await appendSessionEvent(sessionId, {
      type: "kicked",
      robloxUserId: String(targetRobloxUserId),
      username: data.trainees?.[targetRobloxUserId]?.username || null,
      by: String(robloxUserId),
      meta: { reason: reason || "" },
    });
  }

  if (action === "ban") {
    if (!targetRobloxUserId || !VALID_BAN_SCOPES.includes(banScope)) {
      return new Response(
        JSON.stringify({ error: "targetRobloxUserId and banScope required" }),
        { status: 400 }
      );
    }
    await ref.update({
      [`trainees.${targetRobloxUserId}.rank`]: "banned",
      [`trainees.${targetRobloxUserId}.banScope`]: banScope,
      [`trainees.${targetRobloxUserId}.ratedBy`]: String(robloxUserId),
      [`trainees.${targetRobloxUserId}.ratedAt`]: new Date().toISOString(),
      [`trainees.${targetRobloxUserId}.pendingAction`]: "ban",
      [`trainees.${targetRobloxUserId}.reason`]: reason || "",
    });

    if (banScope === "permanent") {
      await db()
        .collection("bans")
        .doc(String(targetRobloxUserId))
        .set({
          bannedBy: String(robloxUserId),
          bannedAt: new Date().toISOString(),
          reason: reason || `Banned from training session ${sessionId}`,
        });
    }

    await appendSessionEvent(sessionId, {
      type: "banned",
      robloxUserId: String(targetRobloxUserId),
      username: data.trainees?.[targetRobloxUserId]?.username || null,
      by: String(robloxUserId),
      meta: { banScope, reason: reason || "" },
    });
  }

  if (action === "rate") {
    if (!targetRobloxUserId || !VALID_RATINGS.includes(rating)) {
      return new Response(
        JSON.stringify({ error: "targetRobloxUserId and rating required" }),
        { status: 400 }
      );
    }

    await ref.update({
      [`trainees.${targetRobloxUserId}.rank`]: rating,
      [`trainees.${targetRobloxUserId}.ratedBy`]: String(robloxUserId),
      [`trainees.${targetRobloxUserId}.ratedAt`]: new Date().toISOString(),
      [`trainees.${targetRobloxUserId}.pendingAction`]: rating === "passed" ? "pass" : "fail",
      [`trainees.${targetRobloxUserId}.reason`]: reason || "",
    });

    // Same fix as the web console's session-action route: Fail must
    // explicitly revoke a previous Pass, not just skip writing anything.
    await db()
      .collection("robloxUsers")
      .doc(String(targetRobloxUserId))
      .set({ qualifications: { [data.rideCode]: rating === "passed" } }, { merge: true });

    await appendSessionEvent(sessionId, {
      type: rating,
      robloxUserId: String(targetRobloxUserId),
      username: data.trainees?.[targetRobloxUserId]?.username || null,
      by: String(robloxUserId),
    });
  }

  return Response.json({ ok: true });
}