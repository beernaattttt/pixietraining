import { db } from "./firebaseAdmin";

/**
 * Appends one entry to sessions/{id}.events[] — the human-readable
 * timeline the History tab renders. Separate from auditLog (which is the
 * full operational trail of every privileged call): events[] is a
 * curated subset, one entry per meaningful thing that happened in THIS
 * session, written at the same time as the action that caused it.
 *
 * Uses arrayUnion-style append via FieldValue.arrayUnion is NOT used here
 * on purpose — arrayUnion de-duplicates identical entries, which would
 * silently drop a second identical kick of the same user at the exact
 * same millisecond is vanishingly unlikely, but two different "joined"
 * events with the same shape are not impossible to construct. We append
 * via a transaction-free read-modify-write instead, accepting the small
 * race window (last-write-wins) given how infrequently two events land
 * in the same instant in practice.
 */
export async function appendSessionEvent(sessionId, event) {
  const ref = db().collection("sessions").doc(sessionId);
  const entry = { ...event, at: new Date().toISOString() };

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const current = snap.data().events || [];
    tx.update(ref, { events: [...current, entry] });
  });
}
