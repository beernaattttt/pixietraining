import crypto from "crypto";

/**
 * Verifies a request really came from the Discord bot.
 *
 * Same timing-safe pattern as verifyRoblox.js, kept as a separate function
 * (rather than reusing verifyRobloxServer) because these are two distinct
 * trust boundaries with two distinct secrets — the Roblox game server and
 * the Discord bot should never be able to impersonate each other, and
 * rotating one secret should never require touching the other's checks.
 */
export function verifyDiscordBot(req) {
  const provided = req.headers.get("x-discord-bot-key") || "";
  const expected = process.env.DISCORD_NOTIFY_SECRET || "";

  if (!expected) {
    return false;
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

export function unauthorized(message = "Unauthorized") {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
