import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { db } from "../../../../lib/firebaseAdmin";

/**
 * Logging in with Discord proves WHO you are. It does not by itself grant
 * any permission. On every sign-in we look up staff/{discordId} in
 * Firestore and attach consoleAccess (and any manages list) to the
 * session token. Pages and API routes check session.user.consoleAccess —
 * never just "is logged in" — before doing anything privileged.
 */
export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile?.id) {
        token.discordId = profile.id;
        token.username = `${profile.username}`;
      }

      // Re-check Firestore on every token refresh, not just first login,
      // so revoking access takes effect quickly instead of waiting for
      // a stale long-lived session to expire.
      if (token.discordId) {
        const snap = await db().collection("staff").doc(token.discordId).get();
        const data = snap.exists ? snap.data() : null;
        token.consoleAccess = Boolean(data?.consoleAccess);
        token.manages = data?.manages || []; // ride codes this person manages, [] = all if super
        token.superAdmin = Boolean(data?.superAdmin);
      }

      return token;
    },
    async session({ session, token }) {
      session.user.discordId = token.discordId;
      session.user.username = token.username;
      session.user.consoleAccess = token.consoleAccess;
      session.user.manages = token.manages;
      session.user.superAdmin = token.superAdmin;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
