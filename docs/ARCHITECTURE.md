# Pixie Productions — Training System Architecture

## Why it's shaped this way

Roblox never talks to Firebase directly. Every request goes:

```
Roblox game server  -->  Vercel API (holds real Firebase secret)  -->  Firestore
Discord-authed manager (browser)  -->  Vercel API  -->  Firestore
```

Reasoning: a Firebase service account key embedded in a Roblox Script is a
single leaked-key disaster (full database access, no rate limiting, no way
to revoke without re-publishing the game). A Vercel route holding that same
secret can be rate-limited, logged, instantly rotated, and protected by a
second, narrower secret that only your Roblox servers know. If that second
secret leaks, you rotate one env var on Vercel — the game doesn't even need
republishing.

## Trust boundaries

1. **Roblox -> Vercel**: every request includes header `x-pixie-server-key`.
   Vercel checks it against `ROBLOX_SERVER_KEY` (env var) using a constant-time
   compare. No key, no match -> 401, request never touches Firebase.
2. **Browser -> Vercel**: Discord OAuth session (NextAuth, httpOnly signed
   JWT cookie). No cookie / invalid -> redirected to login.
3. **Vercel -> Firestore**: Firebase Admin SDK with a service account key,
   stored only in Vercel environment variables, never sent to any client.
4. **Authorization is always rechecked server-side.** A Discord login gets
   you *in the door* of the console. It does NOT grant any permission by
   itself — every privileged action re-checks the caller's role/grants
   stored in Firestore (`staff/{discordId}.consoleAccess`,
   `.manages`, etc.) before doing anything. Same pattern in Roblox: group
   rank gets a player *eligible*, but the explicit `consoleAccess` /
   `canHostTraining` grant is what's actually checked.

## Data model (Firestore)

```
rides/{rideCode}                          e.g. rides/htm
  name: "Haunted Mansion"
  code: "htm"
  active: bool

staff/{discordId}                          web console identity
  discordId, username, avatar
  consoleAccess: bool        <- explicit grant, NOT derived from anything
  grantedBy: discordId
  grantedAt: timestamp

robloxUsers/{robloxUserId}
  username
  groupRank: number          <- last known, refreshed on join
  canHostTraining: bool      <- explicit grant (separate from console access)
  qualifications: { [rideCode]: bool }   <- "can operate this ride"

sessions/{sessionId}
  code: string                 manager-chosen join code, e.g. "htm"-scoped
  rideCode: string              "htm"
  hostRobloxId: string
  hostUsername: string
  status: "open" | "locked" | "closed"
  privateServerId: string       Roblox reserved server access code
  privateServerLink: string
  createdAt, closedAt: timestamp
  trainees: {
    [robloxUserId]: {
      username: string
      rank: "trainee" | "passed" | "failed" | "kicked"
      ratedBy: string
      ratedAt: timestamp
    }
  }

auditLog/{autoId}                         every privileged action, append-only
  actor: string (discordId or robloxUserId)
  actorType: "discord" | "roblox-server"
  action: string
  target: string
  meta: object
  at: timestamp
```

Two separate grant flags on purpose: `consoleAccess` (web) and
`canHostTraining` (in-game `!jointraining` hosting) are independent because
you said you personally grant access while training managers — someone
might need one without the other during onboarding.

## Roblox join flow (`!jointraining CODE`)

1. Player chats `!jointraining htm`.
2. Chat hook -> server Script calls Vercel `POST /api/roblox/join-session`
   with `{ code, robloxUserId, username }` + server key header.
3. Vercel: looks up session by code, checks `status == "open"`, checks
   caller is a student/cast (no guests) using the same membership rule as
   hosting eligibility, returns `{ allow: true, privateServerLink }` or a
   reason string.
4. Roblox teleports the player into the reserved private server via
   `TeleportService:TeleportToPrivateServer`.

No guests rule: Roblox renders `Player.MembershipType` (`Premium`/`None`)
and account age, but "guest" really means *no real Roblox account context*
— this is already guaranteed by Roblox (true anonymous guest play was
removed platform-wide), so the actual filter you want is "is a verified
member of staff/university roster," which is the `robloxUsers` doc check,
not a Roblox API flag. The system checks for an existing `robloxUsers`
profile with at least cast/student standing rather than trying to detect
"guest" as a literal Roblox concept.

## Files in this delivery

- `web/` — Next.js app (Vercel-ready): API routes, Discord auth, console UI
- `roblox/` — server Scripts/Modules for Studio: join command, session
  hosting, panel permission check, auto-setup console script
- `docs/FIRESTORE_RULES.txt` — security rules to paste into Firebase console
- `docs/SETUP.md` — step by step deployment
