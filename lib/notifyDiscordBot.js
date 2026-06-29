/**
 * Fire-and-forget notification to the Discord bot's small HTTP listener.
 *
 * Why fire-and-forget: the Roblox game server is waiting on create-session's
 * response to continue running the training. If Discord's bot host (Render
 * free tier) is slow or briefly down, that must never delay or fail the
 * actual training flow in-game. We log failures but never throw.
 *
 * DISCORD_BOT_NOTIFY_URL should point at the bot's keep-alive HTTP server,
 * e.g. https://nightfall-bot.onrender.com/training-event
 */
export async function notifyDiscordBot(payload) {
  const baseUrl = process.env.DISCORD_BOT_NOTIFY_URL;
  const secret = process.env.DISCORD_NOTIFY_SECRET;

  if (!baseUrl || !secret) {
    console.warn("notifyDiscordBot: missing DISCORD_BOT_NOTIFY_URL or DISCORD_NOTIFY_SECRET, skipping.");
    return;
  }

  // DISCORD_BOT_NOTIFY_URL is documented as "base URL + /training-event",
  // but in practice people set it to just the bot's root URL (with or
  // without a trailing slash). Normalize here so a misconfigured env var
  // doesn't silently send the notification to "/" instead of the actual
  // training-event endpoint — that failure mode previously returned 200
  // (the bot's keep-alive root response) and looked like success.
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const url = trimmedBase.endsWith("/training-event")
    ? trimmedBase
    : `${trimmedBase}/training-event`;

  try {
    // 25s, not 5s: Render's free tier can take 20-30s to wake a sleeping
    // instance (cold start). A short timeout would abort before the bot
    // ever gets a chance to respond, even though the notification would
    // have succeeded if given enough time.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    console.log(`notifyDiscordBot: POST ${url}`);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-discord-bot-key": secret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    console.log(`notifyDiscordBot: bot responded with status ${res.status}`);
  } catch (err) {
    // Never let a Discord notification failure affect the training flow.
    console.error("notifyDiscordBot failed (non-fatal):", err?.message || err);
  }
}
