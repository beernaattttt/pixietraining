import { db } from "../../../../lib/firebaseAdmin";
import { verifyRobloxServer, unauthorized } from "../../../../lib/verifyRoblox";
import { rateLimit, tooManyRequests } from "../../../../lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * This is what your Manual Panel script (or any ride's operating panel,
 * across any of your maps) calls before letting a player actually toggle
 * power / open doors / start preshow. One check, works for every ride you
 * own, because qualification is keyed by rideCode in a single doc per user
 * rather than duplicated per-map systems.
 *
 * Optional sessionId: if the panel is inside a private server that is
 * itself a live training session for this ride, and the caller is an
 * active (non-kicked/failed/banned) trainee in that session, they're
 * allowed to operate the panel even without a permanent qualification —
 * this is the "practice mode" that only applies inside that one private
 * server, never anywhere else.
 *
 * pendingAction: this same call doubles as where a manager's web-issued
 * kick/ban actually gets enforced, since there's no live push channel
 * from the console to Roblox. If the trainee has a pendingAction queued,
 * we return it here and clear it, so the panel script can act on it
 * (teleport them out with a message) the moment they try to use
 * anything — not instantly when the manager clicks the button, but the
 * next real interaction, which is the tradeoff of the no-heartbeat design.
 */
export async function POST(req) {
  if (!verifyRobloxServer(req)) return unauthorized();

  const limit = rateLimit(`qualified:${req.headers.get("x-pixie-server-key")}`, {
    max: 120,
    windowMs: 60_000,
  });
  if (!limit.allowed) return tooManyRequests();

  const body = await req.json().catch(() => null);
  const { robloxUserId, rideCode, sessionId } = body || {};

  if (!robloxUserId || !rideCode) {
    return new Response(JSON.stringify({ error: "robloxUserId and rideCode required" }), {
      status: 400,
    });
  }

  const snap = await db().collection("robloxUsers").doc(String(robloxUserId)).get();
  let qualified = Boolean(snap.exists && snap.data()?.qualifications?.[rideCode]);

  let practiceMode = false;
  let pendingAction = null;
  let pendingActionReason = null;
  let pendingTeleport = null;

  if (sessionId) {
    const sessionSnap = await db().collection("sessions").doc(sessionId).get();
    const session = sessionSnap.exists ? sessionSnap.data() : null;
    const trainee = session?.trainees?.[String(robloxUserId)];

    if (trainee?.pendingAction) {
      pendingAction = trainee.pendingAction;
      pendingActionReason = trainee.reason || null;
      // Clear it immediately so it only fires once.
      await db()
        .collection("sessions")
        .doc(sessionId)
        .set({ trainees: { [String(robloxUserId)]: { pendingAction: null } } }, { merge: true });
    }

    if (trainee?.pendingTeleport) {
      pendingTeleport = trainee.pendingTeleport;
      await db()
        .collection("sessions")
        .doc(sessionId)
        .set({ trainees: { [String(robloxUserId)]: { pendingTeleport: null } } }, { merge: true });
    }

    if (
      session &&
      session.rideCode === rideCode &&
      trainee &&
      ["trainee"].includes(trainee.rank)
    ) {
      practiceMode = true;
    }
  }

  return Response.json({
    qualified: qualified || practiceMode,
    practiceMode,
    pendingAction,
    pendingActionReason,
    pendingTeleport,
  });
}
