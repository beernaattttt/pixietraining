import { db } from "../../../../lib/firebaseAdmin";
import { verifyRobloxServer, unauthorized } from "../../../../lib/verifyRoblox";
import { rateLimit, tooManyRequests } from "../../../../lib/rateLimit";

/**
 * Call this once per player on game join (PlayerAdded). Creates/refreshes
 * their robloxUsers doc with current username + group rank. This is what
 * makes someone "known" to the system at all — join-session and can-host
 * both depend on this doc existing. We never set canHostTraining or
 * qualifications here; those are exclusively granted by a Manager+ via
 * the console, never by the player's own join action.
 */
export async function POST(req) {
  if (!verifyRobloxServer(req)) return unauthorized();

  const limit = rateLimit(`register:${req.headers.get("x-pixie-server-key")}`, {
    max: 200,
    windowMs: 60_000,
  });
  if (!limit.allowed) return tooManyRequests();

  const body = await req.json().catch(() => null);
  const { robloxUserId, username, groupRank } = body || {};

  if (!robloxUserId || !username) {
    return new Response(JSON.stringify({ error: "robloxUserId and username required" }), {
      status: 400,
    });
  }

  const ref = db().collection("robloxUsers").doc(String(robloxUserId));
  const existing = await ref.get();

  await ref.set(
    {
      username,
      groupRank: typeof groupRank === "number" ? groupRank : 0,
      // Preserve existing grants — never overwrite on a routine refresh.
      canHostTraining: existing.exists ? Boolean(existing.data()?.canHostTraining) : false,
      qualifications: existing.exists ? existing.data()?.qualifications || {} : {},
      lastSeen: new Date().toISOString(),
    },
    { merge: true }
  );

  return Response.json({ ok: true });
}
