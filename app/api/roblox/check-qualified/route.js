import { db } from "../../../../lib/firebaseAdmin";
import { verifyRobloxServer, unauthorized } from "../../../../lib/verifyRoblox";
import { rateLimit, tooManyRequests } from "../../../../lib/rateLimit";

/**
 * This is what your Manual Panel script (or any ride's operating panel,
 * across any of your maps) calls before letting a player actually toggle
 * power / open doors / start preshow. One check, works for every ride you
 * own, because qualification is keyed by rideCode in a single doc per user
 * rather than duplicated per-map systems.
 */
export async function POST(req) {
  if (!verifyRobloxServer(req)) return unauthorized();

  const limit = rateLimit(`qualified:${req.headers.get("x-pixie-server-key")}`, {
    max: 120,
    windowMs: 60_000,
  });
  if (!limit.allowed) return tooManyRequests();

  const body = await req.json().catch(() => null);
  const { robloxUserId, rideCode } = body || {};

  if (!robloxUserId || !rideCode) {
    return new Response(JSON.stringify({ error: "robloxUserId and rideCode required" }), {
      status: 400,
    });
  }

  const snap = await db().collection("robloxUsers").doc(String(robloxUserId)).get();
  const qualified = Boolean(snap.exists && snap.data()?.qualifications?.[rideCode]);

  return Response.json({ qualified });
}
