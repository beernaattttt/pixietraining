import { db } from "../../../../lib/firebaseAdmin";
import { verifyRobloxServer, unauthorized } from "../../../../lib/verifyRoblox";
import { rateLimit, tooManyRequests } from "../../../../lib/rateLimit";
import { audit } from "../../../../lib/audit";
import { notifyDiscordBot } from "../../../../lib/notifyDiscordBot";
import { waitUntil } from "next/server";

export const dynamic = "force-dynamic";

const CODE_PATTERN = /^[a-z0-9_-]{2,24}$/i;

export async function POST(req) {
  if (!verifyRobloxServer(req)) return unauthorized();

  const limit = rateLimit(`create-session:${req.headers.get("x-pixie-server-key")}`, {
    max: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) return tooManyRequests();

  const body = await req.json().catch(() => null);
  const { code, rideCode, hostRobloxId, hostUsername, privateServerId, privateServerLink, maxTrainees } =
    body || {};

  if (!code || !rideCode || !hostRobloxId || !privateServerId) {
    return new Response(
      JSON.stringify({ error: "code, rideCode, hostRobloxId, privateServerId required" }),
      { status: 400 }
    );
  }

  if (!CODE_PATTERN.test(code)) {
    return new Response(
      JSON.stringify({ error: "Code must be 2-24 letters/numbers/hyphens/underscores" }),
      { status: 400 }
    );
  }

  // Re-verify hosting permission server-side — never trust that the
  // Roblox client-side check (already done before this call) wasn't
  // bypassed. Defense in depth: every privileged write re-checks.
  const userSnap = await db().collection("robloxUsers").doc(String(hostRobloxId)).get();
  const user = userSnap.exists ? userSnap.data() : null;
  if (!user?.canHostTraining) {
    await audit({
      actor: String(hostRobloxId),
      actorType: "roblox-server",
      action: "create-session-denied",
      target: rideCode,
      meta: { reason: "not authorized to host" },
    });
    return new Response(JSON.stringify({ error: "Not authorized to host training" }), {
      status: 403,
    });
  }

  const rideSnap = await db().collection("rides").doc(rideCode).get();
  if (!rideSnap.exists || rideSnap.data()?.active === false) {
    return new Response(JSON.stringify({ error: "Unknown or inactive ride code" }), {
      status: 400,
    });
  }

  // Codes must be unique among currently-open sessions, not globally —
  // letting old closed sessions free up codes avoids artificial exhaustion.
  const existing = await db()
    .collection("sessions")
    .where("code", "==", code)
    .where("status", "in", ["open", "locked"])
    .limit(1)
    .get();

  if (!existing.empty) {
    return new Response(JSON.stringify({ error: "That code is already in use by an active session" }), {
      status: 409,
    });
  }

  const ref = await db().collection("sessions").add({
    code,
    rideCode,
    hostRobloxId: String(hostRobloxId),
    hostUsername: hostUsername || "",
    status: "open",
    privateServerId,
    privateServerLink: privateServerLink || "",
    maxTrainees: typeof maxTrainees === "number" && maxTrainees > 0 ? maxTrainees : null,
    createdAt: new Date().toISOString(),
    closedAt: null,
    trainees: {},
  });

  await audit({
    actor: String(hostRobloxId),
    actorType: "roblox-server",
    action: "create-session",
    target: ref.id,
    meta: { code, rideCode },
  });

  // Fire-and-forget: tell the Discord bot a new training opened so it can
  // post the announcement embed. Wrapped in waitUntil so Vercel keeps the
  // function alive long enough to finish this background call even though
  // the response above has already been sent — without it, Vercel can
  // freeze/kill the function as soon as it returns, cancelling this fetch
  // mid-flight regardless of notifyDiscordBot's own internal timeout.
  waitUntil(
    notifyDiscordBot({
      type: "session-opened",
      sessionId: ref.id,
      code,
      rideCode,
      rideName: rideSnap.data()?.name || rideCode,
      hostUsername: hostUsername || "",
      maxTrainees: typeof maxTrainees === "number" && maxTrainees > 0 ? maxTrainees : null,
    }),
  );

  return Response.json({ sessionId: ref.id });
}
