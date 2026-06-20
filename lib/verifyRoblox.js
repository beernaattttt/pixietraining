import crypto from "crypto";

/**
 * Verifies the request really came from one of your Roblox game servers.
 *
 * Why timing-safe comparison: a naive `===` string compare leaks timing
 * information (it returns faster the sooner characters mismatch), which
 * in theory lets an attacker brute-force the secret byte-by-byte by
 * measuring response times. crypto.timingSafeEqual removes that signal.
 *
 * Why this lives separately from Firebase auth: Roblox game servers have
 * no concept of Discord/user login. They authenticate as "a Pixie
 * Productions game server", a single fixed identity, using a long random
 * secret shared only between Vercel env vars and the Roblox game's
 * server-side ServerScriptService (never sent to any client/LocalScript).
 */
export function verifyRobloxServer(req) {
  const provided = req.headers.get("x-pixie-server-key") || "";
  const expected = process.env.ROBLOX_SERVER_KEY || "";

  if (!expected) {
    // Misconfiguration should fail closed, not open.
    return false;
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length) {
    // timingSafeEqual throws on length mismatch — handle explicitly,
    // still without branching on *where* they differ.
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
