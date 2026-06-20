import { db } from "../../../../lib/firebaseAdmin";
import { requireConsoleAccess, forbidden } from "../../../../lib/requireAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireConsoleAccess();
  if (!session) return forbidden("Console access required.");
  if (!session.user.superAdmin) {
    return forbidden("Only a super admin can view the people list.");
  }

  try {
    const snap = await db().collection("staff").get();
    const people = await Promise.all(
      snap.docs.map(async (d) => {
        const staff = { discordId: d.id, ...d.data() };

        if (staff.robloxUserId) {
          const robloxSnap = await db().collection("robloxUsers").doc(staff.robloxUserId).get();
          const robloxData = robloxSnap.exists ? robloxSnap.data() : null;
          staff.canHostTraining = Boolean(robloxData?.canHostTraining);
          staff.qualifications = robloxData?.qualifications || {};
        } else {
          staff.canHostTraining = false;
          staff.qualifications = {};
        }

        return staff;
      })
    );
    return Response.json({ people });
  } catch (e) {
    return Response.json({ error: String(e?.message || e), people: [] }, { status: 500 });
  }
}
