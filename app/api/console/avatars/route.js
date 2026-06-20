import { requireConsoleAccess, forbidden } from "../../../../lib/requireAuth";

export const dynamic = "force-dynamic";

/**
 * Roblox's thumbnail API works fine called server-to-server, but
 * browsers calling it directly from the console's origin run into CORS
 * (no Access-Control-Allow-Origin header on Roblox's response), so the
 * <img> tags were silently failing. This route does the lookup here on
 * the server and hands back plain image URLs the browser CAN load
 * directly — Roblox's actual CDN image responses do allow cross-origin
 * <img> loading once you have the URL, it's only the avatars.roblox.com
 * /thumbnails.roblox.com JSON API call itself that blocks browser-origin
 * fetches.
 */
export async function POST(req) {
  const session = await requireConsoleAccess();
  if (!session) return forbidden("Console access required.");

  const body = await req.json().catch(() => null);
  const userIds = Array.isArray(body?.userIds) ? body.userIds.slice(0, 100) : [];

  if (userIds.length === 0) {
    return Response.json({ thumbnails: {} });
  }

  try {
    const idsParam = userIds.join(",");
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${idsParam}&size=150x150&format=png&isCircular=true`
    );

    if (!res.ok) {
      throw new Error(`Roblox thumbnails API responded ${res.status}`);
    }

    const data = await res.json();
    const thumbnails = {};
    for (const item of data?.data || []) {
      thumbnails[String(item.targetId)] = item.imageUrl;
    }

    return Response.json({ thumbnails });
  } catch (e) {
    return Response.json({ error: String(e?.message || e), thumbnails: {} }, { status: 502 });
  }
}
