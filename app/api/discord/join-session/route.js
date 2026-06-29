import { verifyDiscordBotServer, unauthorized } from "../../../../lib/verifyRoblox";
import { rateLimit, tooManyRequests } from "../../../../lib/rateLimit";
import { attemptJoinSession, leaveSession } from "../../../../lib/joinSessionLogic";

export const dynamic = "force-dynamic";

// Called by the Discord bot when a member presses "Join" on a training
// embed. Reuses the exact same eligibility rules as the in-game join flow
// (lib/joinSessionLogic.js) — only the caller's identity and audit trail
// differ (actorType: "discord-bot" vs "roblox-server").
export async function POST(req) {
  if (!verifyDiscordBotServer(req)) return unauthorized();

  const limit = rateLimit(`discord-join:${req.headers.get("x-discord-bot-server-key")}`, {
    max: 60,
    windowMs: 60_000,
  });
  if (!limit.allowed) return tooManyRequests();

  const body = await req.json().catch(() => null);
  const { intent, code, robloxUserId, username } = body || {};

  if (!code || !robloxUserId) {
    return new Response(JSON.stringify({ error: "code and robloxUserId required" }), {
      status: 400,
    });
  }

  if (intent === "leave") {
    const result = await leaveSession({ code, robloxUserId });
    return Response.json(result);
  }

  const result = await attemptJoinSession({
    code,
    robloxUserId,
    username,
    actorType: "discord-bot",
  });

  return Response.json(result);
}
