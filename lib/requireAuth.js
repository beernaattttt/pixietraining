import { getServerSession } from "next-auth/next";
import { authOptions } from "../app/api/auth/[...nextauth]/route";

/**
 * Use at the top of every privileged API route. Returns the session if
 * the caller is logged in AND has been explicitly granted consoleAccess.
 * Returns null otherwise — callers must respond with 401/403 themselves
 * so each route can pick the right error message/status.
 */
export async function requireConsoleAccess(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId) return null;
  if (!session.user.consoleAccess) return null;
  return session;
}

export function forbidden(message = "Forbidden") {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}
