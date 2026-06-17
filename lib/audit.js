import { db } from "./firebaseAdmin";

/**
 * Every privileged action gets recorded, append-only. This isn't optional
 * decoration — when someone disputes a kick/fail/rank decision, or you
 * need to figure out how an unauthorized session got created, this is
 * the only record. Never delete from this collection from app code.
 */
export async function audit({ actor, actorType, action, target = null, meta = {} }) {
  await db().collection("auditLog").add({
    actor,
    actorType, // "discord" | "roblox-server"
    action,
    target,
    meta,
    at: new Date().toISOString(),
  });
}
