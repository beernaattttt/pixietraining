import { db } from "../../../../lib/firebaseAdmin";
import { verifyRobloxServer, unauthorized } from "../../../../lib/verifyRoblox";
import { rateLimit, tooManyRequests } from "../../../../lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Event-driven presence, not a heartbeat: Roblox calls this exactly twice
 * per trainee per session (once on join, once on leave via
 * PlayerRemoving), not on a timer. The console's "who's in here right
 * now" view is only as fresh as the last join/leave event — acceptable
 * given the explicit choice to avoid a continuous heartbeat.
 */
export async function POST(req) {
  if (!verifyRobloxServer(req)) return unauthorized();

  const limit = rateLimit(`presence:${req.headers.get("x-pixie-server-key")}`, {
    max: 120,
    windowMs: 60_000,
  });
  if (!limit.allowed) return tooManyRequests();

  const body = await req.json().catch(() => null);
  const { sessionId, robloxUserId, event } = body || {};

  if (!sessionId || !robloxUserId || !["joined", "left"].includes(event)) {
    return new Response(
      JSON.stringify({ error: "sessionId, robloxUserId, and event ('joined'|'left') required" }),
      { status: 400 }
    );
  }

  await db()
    .collection("sessions")
    .doc(sessionId)
    .set(
      {
        trainees: {
          [String(robloxUserId)]: {
            inServer: event === "joined",
          },
        },
      },
      { merge: true }
    );

  return Response.json({ ok: true });
}
