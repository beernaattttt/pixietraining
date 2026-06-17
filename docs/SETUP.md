# Setup — Pixie Productions Training System

Do these in order. Each step produces a value you'll need in a later step,
so don't skip around.

## 1. Firebase project

1. Go to console.firebase.google.com, create a project (e.g. "pixie-training").
2. Build → Firestore Database → Create database → production mode → pick a region.
3. Go to Firestore → Rules, paste in the contents of `docs/FIRESTORE_RULES.txt`, publish.
   (This denies all direct client access — only your Vercel backend, using
   the Admin SDK, can read/write. That's intentional.)
4. Project Settings (gear icon) → Service Accounts → Generate new private key.
   This downloads a JSON file. From it you need three values for later:
   - `project_id`
   - `client_email`
   - `private_key` (the long one starting `-----BEGIN PRIVATE KEY-----`)

Keep that JSON file somewhere safe and never commit it to git.

## 2. Discord OAuth app

1. Go to discord.com/developers/applications → New Application → name it
   "Pixie Training Console".
2. OAuth2 → General: copy the **Client ID** and **Client Secret**.
3. OAuth2 → General → Redirects: add
   `https://YOUR-VERCEL-DOMAIN.vercel.app/api/auth/callback/discord`
   (you'll come back and fix this URL once you know your real Vercel domain
   in step 4 — for now you can add `http://localhost:3000/api/auth/callback/discord`
   too, for local testing).

## 3. Generate your two secrets

Run these locally (or any machine with a terminal) and save the output:

```
openssl rand -base64 32   # this becomes NEXTAUTH_SECRET
openssl rand -hex 32      # this becomes ROBLOX_SERVER_KEY
```

`ROBLOX_SERVER_KEY` is the one you'll also paste into the Roblox
`PixieBackend` ModuleScript. Treat it like a password — anyone with it can
call your Roblox-facing API routes.

## 4. Deploy to Vercel

1. Push the `web/` folder to a GitHub repo (or import it directly if Vercel
   supports folder import from this zip — easiest is push to GitHub first).
2. vercel.com → Add New → Project → import that repo.
3. Before the first deploy, or right after in Project Settings →
   Environment Variables, add all of these:

   | Key | Value |
   |---|---|
   | `NEXTAUTH_URL` | `https://your-project.vercel.app` (your real Vercel URL) |
   | `NEXTAUTH_SECRET` | from step 3 |
   | `DISCORD_CLIENT_ID` | from step 2 |
   | `DISCORD_CLIENT_SECRET` | from step 2 |
   | `FIREBASE_PROJECT_ID` | from step 1 |
   | `FIREBASE_CLIENT_EMAIL` | from step 1 |
   | `FIREBASE_PRIVATE_KEY` | from step 1 — paste the whole thing including `\n` sequences, wrapped in quotes |
   | `ROBLOX_SERVER_KEY` | from step 3 |

4. Deploy. Once live, go back to Discord (step 2) and make sure the redirect
   URL matches your real Vercel domain exactly.

## 5. Seed your first super admin (yourself)

You need at least one person with `superAdmin: true` to grant everyone
else access — there's no UI for this first bootstrap step, you create it
directly in Firestore once:

1. Log into the console once with Discord (it'll say "signed in, not yet
   authorized" — that's expected, this creates your `staff` doc).
2. Firebase Console → Firestore → `staff` collection → find the document
   with your Discord ID (the one that just got created).
3. Edit it, add two fields: `consoleAccess: true` (boolean) and
   `superAdmin: true` (boolean).
4. Refresh the console — you're in, and can now grant access to others
   from the console itself going forward (use the `/api/console/grants`
   endpoint, or build a small admin UI on top of it later).

## 6. Roblox setup

1. Open Studio on your Haunted Mansion place.
2. View → Command Bar, paste in the contents of
   `roblox/PixieTrainingAutoSetup.lua`, run it. This creates empty
   placeholder scripts in the right spots.
3. Open each created script and paste in the matching source:
   - `ServerScriptService/PixieBackend` ← `roblox/ServerScriptService/PixieBackend.lua`
   - `ServerScriptService/PlayerRegistration` ← `roblox/ServerScriptService/PlayerRegistration.lua`
   - `ServerScriptService/TrainingCommands` ← `roblox/ServerScriptService/TrainingCommands.lua`
   - `StarterPlayerScripts/TrainingNotifyClient` ← `roblox/StarterPlayerScripts/TrainingNotifyClient.lua`
4. Inside `PixieBackend`, set:
   - `BASE_URL` = your real Vercel URL (e.g. `https://pixie-training.vercel.app`)
   - `SERVER_KEY` = the `ROBLOX_SERVER_KEY` value from step 3
5. Inside `PlayerRegistration`, set `GROUP_ID` to your actual Roblox group ID.
6. Replace your existing Manual Panel controller script with
   `roblox/panels/manualPanelController.lua` (same structure as your
   original, with the qualification check, debounce, and nil-safety added).
   Inside it, confirm `RIDE_CODE = "htm"` matches this map.
7. In Firestore, create the ride doc manually (no UI for this yet):
   collection `rides`, document ID `htm`, fields `name: "Haunted Mansion"`,
   `code: "htm"`, `active: true`.

## 7. Grant your first manager

You (as super admin) call `POST /api/console/grants` with:
```json
{ "type": "host", "value": { "robloxUserId": "THEIR_ROBLOX_ID", "grant": true } }
```
to let them host training sessions, and separately grant `"type": "console"`
the same way if they should also access the web console. Easiest way to
fire this for now: a quick `curl` with your Discord session cookie, or a
small temporary form — wiring a proper grants UI into the console is a
natural next addition once this is running.

## 8. Try it

In-game: `!hosttraining htm htm` (Manager+ only) starts a session with
join code `htm`. Trainees: `!jointraining htm`. Watch it appear on
`https://your-vercel-domain.vercel.app` under Active sessions.
