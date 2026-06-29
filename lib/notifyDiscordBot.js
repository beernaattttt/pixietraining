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
  const url = process.env.DISCORD_BOT_NOTIFY_URL;
  const secret = process.env.DISCORD_NOTIFY_SECRET;

  if (!url || !secret) {
    console.warn("notifyDiscordBot: missing DISCORD_BOT_NOTIFY_URL or DISCORD_NOTIFY_SECRET, skipping.");
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-discord-bot-key": secret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch (err) {
    // Never let a Discord notification failure affect the training flow.
    console.error("notifyDiscordBot failed (non-fatal):", err?.message || err);
  }
}
