import { db } from "../../../../lib/firebaseAdmin";
import { requireConsoleAccess, forbidden } from "../../../../lib/requireAuth";
import { audit } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

/**
 * Granting permissions is itself a privileged action gated tighter than
 * normal console access: only superAdmin can grant/revoke. This matches
 * what you described — you personally grant access while training
 * managers, rather than any console user being able to grant others.
 */
export async function POST(req) {
  const session = await requireConsoleAccess();
  if (!session) return forbidden("Console access required.");
  if (!session.user.superAdmin) {
    return forbidden("Only a super admin can grant or revoke access.");
  }

  const body = await req.json().catch(() => null);
  const { type, value } = body || {};

  if (type === "console") {
    const { discordId, username, grant } = value || {};
    if (!discordId) return new Response(JSON.stringify({ error: "discordId required" }), { status: 400 });

    await db()
      .collection("staff")
      .doc(discordId)
      .set(
        {
          discordId,
          username: username || "",
          consoleAccess: Boolean(grant),
          grantedBy: session.user.discordId,
          grantedAt: new Date().toISOString(),
        },
        { merge: true }
      );

    await audit({
      actor: session.user.discordId,
      actorType: "discord",
      action: grant ? "grant-console-access" : "revoke-console-access",
      target: discordId,
    });

    return Response.json({ ok: true });
  }

  if (type === "host") {
    const { robloxUserId, grant } = value || {};
    if (!robloxUserId)
      return new Response(JSON.stringify({ error: "robloxUserId required" }), { status: 400 });

    await db()
      .collection("robloxUsers")
      .doc(String(robloxUserId))
      .set({ canHostTraining: Boolean(grant) }, { merge: true });

    await audit({
      actor: session.user.discordId,
      actorType: "discord",
      action: grant ? "grant-host" : "revoke-host",
      target: String(robloxUserId),
    });

    return Response.json({ ok: true });
  }

  if (type === "qualification") {
    const { robloxUserId, rideCode, grant } = value || {};
    if (!robloxUserId || !rideCode)
      return new Response(JSON.stringify({ error: "robloxUserId and rideCode required" }), {
        status: 400,
      });

    await db()
      .collection("robloxUsers")
      .doc(String(robloxUserId))
      .set({ qualifications: { [rideCode]: Boolean(grant) } }, { merge: true });

    await audit({
      actor: session.user.discordId,
      actorType: "discord",
      action: grant ? "grant-qualification" : "revoke-qualification",
      target: String(robloxUserId),
      meta: { rideCode },
    });

    return Response.json({ ok: true });
  }

  return new Response(JSON.stringify({ error: "Unknown grant type" }), { status: 400 });
}
