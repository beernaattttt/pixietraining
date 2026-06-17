import { getServerSession } from "next-auth/next";
import { authOptions } from "../app/api/auth/[...nextauth]/route";

/**
 * Use at the top of every privileged API route. Returns the session if
 * the caller is logged in AND has been explicitly granted consoleAccess.
 * Returns null otherwise — callers must respond with 401/403 themselves
 * so each route can pick the right error message/status.
 *
 * Wrapped in try/catch: if getServerSession itself throws (a bad/missing
 * NEXTAUTH_SECRET, a cookie parsing issue, etc.), we want a clear 403
 * from the caller, not an unhandled exception that surfaces as a bare,
 * message-less 500.
 */
export async function requireConsoleAccess() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) return null;
    if (!session.user.consoleAccess) return null;
    return session;
  } catch (e) {
    console.error("[requireConsoleAccess] getServerSession threw:", e);
    return null;
  }
}

export function forbidden(message = "Forbidden") {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}
