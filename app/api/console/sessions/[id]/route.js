import { db } from "../../../../../lib/firebaseAdmin";
import { requireConsoleAccess, forbidden } from "../../../../../lib/requireAuth";
import { audit } from "../../../../../lib/audit";
import { appendSessionEvent } from "../../../../../lib/sessionEvents";
import { notifyDiscordBot } from "../../../../../lib/notifyDiscordBot";

export const dynamic = "force-dynamic";

const VALID_ACTIONS = [
  "lock",
  "open",
  "close",
  "rate",
  "kick",
  "ban",
  "configure",
  "teleport-all",
];
const VALID_RATINGS = ["passed", "failed"];
const VALID_BAN_SCOPES = ["session", "permanent"];

const HOST_ONLY_ACTIONS = ["lock", "open", "close", "rate", "kick", "ban", "configure"];

export async function POST(req, { params }) {
  const session = await requireConsoleAccess();
  if (!session) return forbidden("Console access required.");

  const { id } = params;
  const body = await req.json().catch(() => null);
  const { action, robloxUserId, rating, banScope, code, maxTrainees, reason } = body || {};

  if (!VALID_ACTIONS.includes(action)) {
    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
  }

  const ref = db().collection("sessions").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return new Response(JSON.stringify({ error: "Session not found" }), { status: 404 });
  }
  const data = snap.data();

  const manages = session.user.manages || [];
  if (!session.user.superAdmin && manages.length > 0 && !manages.includes(data.rideCode)) {
    return forbidden("You do not manage this ride.");
  }

  if (action === "lock" || action === "open" || action === "close") {
    const statusMap = { lock: "locked", open: "open", close: "closed" };
    await ref.update({
      status: statusMap[action],
      ...(action === "close" ? { closedAt: new Date().toISOString() } : {}),
    });
    await appendSessionEvent(id, {
      type: action === "close" ? "closed" : action,
      robloxUserId: null,
      username: null,
      by: session.user.discordId,
    });

    // Let the Discord embed reflect the new status immediately rather than
    // waiting for the bot's next poll cycle.
    notifyDiscordBot({
      type: "session-status-changed",
      sessionId: id,
      status: statusMap[action],
    });
  }

  if (action === "configure") {
    const updates = {};
    if (typeof code === "string" && code.trim()) updates.code = code.trim();
    if (typeof maxTrainees === "number" || maxTrainees === null) {
      updates.maxTrainees = maxTrainees;
    }
    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: "Nothing to configure" }), { status: 400 });
    }
    await ref.update(updates);
    await appendSessionEvent(id, {
      type: "configured",
      robloxUserId: null,
      username: null,
      by: session.user.discordId,
      meta: updates,
    });
  }

  if (action === "teleport-all") {
    const trainees = data.trainees || {};
    const updates = {};
    for (const [uid, t] of Object.entries(trainees)) {
      if (t.inServer) {
        updates[`trainees.${uid}.pendingTeleport`] = "to-host";
      }
    }
    if (Object.keys(updates).length > 0) {
      await ref.update(updates);
    }
    await appendSessionEvent(id, {
      type: "teleport-all",
      robloxUserId: null,
      username: null,
      by: session.user.discordId,
    });
  }

  if (action === "kick") {
    if (!robloxUserId) {
      return new Response(JSON.stringify({ error: "robloxUserId required for kick" }), {
        status: 400,
      });
    }
    await ref.update({
      [`trainees.${robloxUserId}.rank`]: "kicked",
      [`trainees.${robloxUserId}.ratedBy`]: session.user.discordId,
      [`trainees.${robloxUserId}.ratedAt`]: new Date().toISOString(),
      [`trainees.${robloxUserId}.pendingAction`]: "kick",
      [`trainees.${robloxUserId}.reason`]: reason || "",
    });
    await appendSessionEvent(id, {
      type: "kicked",
      robloxUserId: String(robloxUserId),
      username: data.trainees?.[robloxUserId]?.username || null,
      by: session.user.discordId,
      meta: { reason: reason || "" },
    });
  }

  if (action === "ban") {
    if (!robloxUserId || !VALID_BAN_SCOPES.includes(banScope)) {
      return new Response(
        JSON.stringify({ error: "robloxUserId and banScope ('session'|'permanent') required" }),
        { status: 400 }
      );
    }

    await ref.update({
      [`trainees.${robloxUserId}.rank`]: "banned",
      [`trainees.${robloxUserId}.banScope`]: banScope,
      [`trainees.${robloxUserId}.ratedBy`]: session.user.discordId,
      [`trainees.${robloxUserId}.ratedAt`]: new Date().toISOString(),
      [`trainees.${robloxUserId}.pendingAction`]: "ban",
      [`trainees.${robloxUserId}.reason`]: reason || "",
    });

    if (banScope === "permanent") {
      await db()
        .collection("bans")
        .doc(String(robloxUserId))
        .set({
          bannedBy: session.user.discordId,
          bannedAt: new Date().toISOString(),
          reason: reason || `Banned from training session ${id} (ride: ${data.rideCode})`,
        });
    }

    await appendSessionEvent(id, {
      type: "banned",
      robloxUserId: String(robloxUserId),
      username: data.trainees?.[robloxUserId]?.username || null,
      by: session.user.discordId,
      meta: { banScope, reason: reason || "" },
    });
  }

  if (action === "rate") {
    if (!robloxUserId || !VALID_RATINGS.includes(rating)) {
      return new Response(
        JSON.stringify({ error: "robloxUserId and rating ('passed'|'failed') required" }),
        { status: 400 }
      );
    }

    await ref.update({
      [`trainees.${robloxUserId}.rank`]: rating,
      [`trainees.${robloxUserId}.ratedBy`]: session.user.discordId,
      [`trainees.${robloxUserId}.ratedAt`]: new Date().toISOString(),
      [`trainees.${robloxUserId}.pendingAction`]: rating === "passed" ? "pass" : "fail",
      [`trainees.${robloxUserId}.reason`]: reason || "",
    });

    // Pass grants the qualification, Fail explicitly revokes it -- if
    // someone was previously passed (qualifications.{rideCode} = true)
    // and is later failed in a new session, they must lose operating
    // access immediately. Leaving the field untouched on fail was the
    // bug: a previously-passed person who got failed kept full access.
    await db()
      .collection("robloxUsers")
      .doc(String(robloxUserId))
      .set(
        { qualifications: { [data.rideCode]: rating === "passed" } },
        { merge: true }
      );

    await appendSessionEvent(id, {
      type: rating,
      robloxUserId: String(robloxUserId),
      username: data.trainees?.[robloxUserId]?.username || null,
      by: session.user.discordId,
    });
  }

  await audit({
    actor: session.user.discordId,
    actorType: "discord",
    action: `session-${action}`,
    target: id,
    meta: { robloxUserId, rating, banScope },
  });

  return Response.json({ ok: true });
}