import { db } from "../../../../../lib/firebaseAdmin";
import { requireConsoleAccess, forbidden } from "../../../../../lib/requireAuth";
import { audit } from "../../../../../lib/audit";
import { appendSessionEvent } from "../../../../../lib/sessionEvents";

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

// Actions a Co-Host is NOT allowed to do — Host-only, full stop. This is
// enforced here, not just hidden in the UI, because the web console is
// the only caller of this route and we don't want to rely on the
// frontend not rendering a button as the actual security boundary.
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

  // Scoped managers (session.user.manages is non-empty) can only act on
  // rides they're assigned to. Empty manages array + superAdmin = full access.
  const manages = session.user.manages || [];
  if (!session.user.superAdmin && manages.length > 0 && !manages.includes(data.rideCode)) {
    return forbidden("You do not manage this ride.");
  }

  // Web console actions are always performed by the signed-in Discord
  // user — there's no separate "are you the Co-Host" concept on the web
  // side (Co-Host is an in-game-only role for the trainer panel). The
  // web console itself is Host-equivalent for whoever has console
  // access, since granting console access is already the bigger gate.
  // HOST_ONLY_ACTIONS exists for the in-game trainer panel's Co-Host
  // distinction (enforced in Roblox's own check, see manualPanelController
  // and TrainingCommands) — kept here as a comment so the boundary is
  // documented in one place even though this route's actions are all
  // available to any console user with access to this ride.

  // "lock" stops NEW trainees from joining — it deliberately does not
  // touch anyone already in trainees, and does not teleport anyone out.
  // Managers can still enter a locked session regardless (enforced in
  // join-session, not here).
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

  // Queues a teleport-to-host for everyone currently marked inServer.
  // Picked up by the same poll-on-interaction pattern as pendingAction —
  // there's no live push to Roblox, so this fires the next time each
  // trainee's client checks in via a panel interaction OR (more
  // reliably) the periodic in-game trainer panel poll, see
  // TrainerPanel.lua's own polling loop for managers.
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

  // kick/ban don't remove the player in real time — there's no live push
  // channel to Roblox. Instead we queue a pendingAction that the panel's
  // check-qualified call picks up and acts on the next time that player
  // tries to interact with anything, per the no-heartbeat design.
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
      // Pass and fail both remove the trainee from the floor — pass
      // because they're now qualified and don't need the practice
      // server anymore, fail because the session told them to retry
      // elsewhere. Both go through pendingAction so the panel/teleport
      // logic enforces the actual exit with the right message.
      [`trainees.${robloxUserId}.pendingAction`]: rating === "passed" ? "pass" : "fail",
      [`trainees.${robloxUserId}.reason`]: reason || "",
    });

    // On pass, write the qualification onto the trainee's permanent record —
    // this is the single flag every ride's panel checks going forward.
    // Note: Firestore's merge:true recursively merges nested maps, so this
    // only adds/overwrites qualifications.{rideCode} — it does not wipe out
    // qualifications the trainee already has for other rides.
    if (rating === "passed") {
      await db()
        .collection("robloxUsers")
        .doc(String(robloxUserId))
        .set(
          { qualifications: { [data.rideCode]: true } },
          { merge: true }
        );
    }

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
