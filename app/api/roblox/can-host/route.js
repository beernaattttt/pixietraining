import { db } from "../../../../lib/firebaseAdmin";
import { verifyRobloxServer, unauthorized } from "../../../../lib/verifyRoblox";
import { rateLimit, tooManyRequests } from "../../../../lib/rateLimit";
import { audit } from "../../../../lib/audit";

export async function POST(req) {
  if (!verifyRobloxServer(req)) return unauthorized();

  const limit = rateLimit(`can-host:${req.headers.get("x-pixie-server-key")}`, {
    max: 60,
    windowMs: 60_000,
  });
  if (!limit.allowed) return tooManyRequests();

  const body = await req.json().catch(() => null);
  if (!body?.robloxUserId || !body?.rideCode) {
    return new Response(JSON.stringify({ error: "robloxUserId and rideCode required" }), {
      status: 400,
    });
  }

  const userSnap = await db().collection("robloxUsers").doc(String(body.robloxUserId)).get();
  const user = userSnap.exists ? userSnap.data() : null;

  const canHost = Boolean(user?.canHostTraining);

  await audit({
    actor: String(body.robloxUserId),
    actorType: "roblox-server",
    action: "check-can-host",
    target: body.rideCode,
    meta: { result: canHost },
  });

  return Response.json({ canHost });
}
