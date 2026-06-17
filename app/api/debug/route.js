import { db } from "../../../lib/firebaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.discordId) {
    return Response.json({ error: "Not logged in at all — no discordId on session." });
  }

  const discordId = session.user.discordId;

  let docExists = false;
  let docData = null;
  let lookupError = null;

  try {
    const snap = await db().collection("staff").doc(discordId).get();
    docExists = snap.exists;
    docData = snap.exists ? snap.data() : null;
  } catch (e) {
    lookupError = String(e?.message || e);
  }

  return Response.json({
    sessionDiscordId: discordId,
    sessionDiscordIdLength: discordId.length,
    sessionConsoleAccess: session.user.consoleAccess,
    sessionSuperAdmin: session.user.superAdmin,
    firestoreDocExists: docExists,
    firestoreDocData: docData,
    firestoreLookupError: lookupError,
  });
}
