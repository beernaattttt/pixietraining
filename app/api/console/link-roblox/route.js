import { db } from "../../../../lib/firebaseAdmin";
import { requireConsoleAccess, forbidden } from "../../../../lib/requireAuth";
import { audit } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

/**
 * Lets a signed-in staff member link their own Roblox account by typing
 * their username. We resolve it to a real numeric userId via Roblox's
 * public Users API (so we're not trusting an arbitrary string — if the
 * username doesn't exist, this fails) and store the link on their own
 * staff doc. This only ever writes to the CALLER's own document — there
 * is no way to link an account on someone else's behalf through this
 * route, which matters because otherwise anyone could impersonate
 * another person's Roblox identity in the system.
 */
export async function POST(req) {
  const session = await requireConsoleAccess();
  if (!session) return forbidden("Console access required.");

  const body = await req.json().catch(() => null);
  const username = (body?.username || "").trim();

  if (!username || username.length > 20) {
    return new Response(JSON.stringify({ error: "Enter a valid Roblox username." }), {
      status: 400,
    });
  }

  // Roblox's public username -> id lookup. No auth needed, this is a
  // public endpoint. We POST a single username and ask for an exact match.
  let robloxUser = null;
  try {
    const res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
    });

    if (!res.ok) {
      throw new Error(`Roblox API responded ${res.status}`);
    }

    const data = await res.json();
    robloxUser = data?.data?.[0] || null;
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Could not reach Roblox to verify that username. Try again." }),
      { status: 502 }
    );
  }

  if (!robloxUser) {
    return new Response(
      JSON.stringify({ error: "No Roblox account found with that exact username." }),
      { status: 404 }
    );
  }

  // Prevent the same Roblox account being linked to two different Discord
  // accounts at once — if it's already linked elsewhere, refuse rather
  // than silently letting two staff docs both claim the same Roblox user.
  const existingLink = await db()
    .collection("staff")
    .where("robloxUserId", "==", String(robloxUser.id))
    .limit(1)
    .get();

  if (!existingLink.empty && existingLink.docs[0].id !== session.user.discordId) {
    return new Response(
      JSON.stringify({ error: "That Roblox account is already linked to a different staff member." }),
      { status: 409 }
    );
  }

  await db()
    .collection("staff")
    .doc(session.user.discordId)
    .set(
      {
        robloxUserId: String(robloxUser.id),
        robloxUsername: robloxUser.name,
        robloxLinkedAt: new Date().toISOString(),
      },
      { merge: true }
    );

  await audit({
    actor: session.user.discordId,
    actorType: "discord",
    action: "link-roblox-account",
    target: String(robloxUser.id),
    meta: { robloxUsername: robloxUser.name },
  });

  return Response.json({ ok: true, robloxUserId: String(robloxUser.id), robloxUsername: robloxUser.name });
}
