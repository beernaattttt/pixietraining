import { db } from "../../../../../lib/firebaseAdmin";
import { requireConsoleAccess, forbidden } from "../../../../../lib/requireAuth";
import { audit } from "../../../../../lib/audit";

export const dynamic = "force-dynamic";

const VALID_ACTIONS = ["lock", "open", "close", "rate", "kick"];
const VALID_RATINGS = ["passed", "failed"];

export async function POST(req, { params }) {
  const session = await requireConsoleAccess();
  if (!session) return forbidden("Console access required.");

  const { id } = params;
  const body = await req.json().catch(() => null);
  const { action, robloxUserId, rating } = body || {};

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

  if (action === "lock" || action === "open" || action === "close") {
    await ref.update({
      status: action === "close" ? "closed" : action,
      ...(action === "close" ? { closedAt: new Date().toISOString() } : {}),
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
  }

  await audit({
    actor: session.user.discordId,
    actorType: "discord",
    action: `session-${action}`,
    target: id,
    meta: { robloxUserId, rating },
  });

  return Response.json({ ok: true });
}
