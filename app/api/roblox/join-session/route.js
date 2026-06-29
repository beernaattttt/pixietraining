import { verifyRobloxServer, unauthorized } from "../../../../lib/verifyRoblox";
import { rateLimit, tooManyRequests } from "../../../../lib/rateLimit";
import { attemptJoinSession } from "../../../../lib/joinSessionLogic";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!verifyRobloxServer(req)) return unauthorized();

  const limit = rateLimit(`join:${req.headers.get("x-pixie-server-key")}`, {
    max: 40,
    windowMs: 60_000,
  });
  if (!limit.allowed) return tooManyRequests();

  const body = await req.json().catch(() => null);
  const { code, robloxUserId, username } = body || {};

  if (!code || !robloxUserId) {
    return new Response(JSON.stringify({ error: "code and robloxUserId required" }), {
      status: 400,
    });
  }

  const result = await attemptJoinSession({
    code,
    robloxUserId,
    username,
    actorType: "roblox-server",
  });

  return Response.json(result);
}
