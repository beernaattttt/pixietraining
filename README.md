# Pixie Productions — Ride Training System

A training session system for Pixie Productions: managers host live
training sessions in-game (`!hosttraining htm htm`), trainees join private
servers by code (`!jointraining htm`), get rated pass/fail from a web
console, and a pass permanently unlocks operating that specific ride's
panel for that person — checked the same way across every map you own.

## What's in here

```
docs/
  ARCHITECTURE.md      start here — explains the trust model and data model
  SETUP.md             step-by-step deployment, do this in order
  FIRESTORE_RULES.txt  paste into Firebase console

web/                   Next.js app, deploy this to Vercel
  app/api/roblox/*      endpoints Roblox calls (server-key authenticated)
  app/api/console/*     endpoints the web console calls (Discord-authenticated)
  app/, components/     the console UI itself

roblox/                paste/scaffold these into Roblox Studio
  PixieTrainingAutoSetup.lua          run once to scaffold instance structure
  ServerScriptService/*.lua           paste into the scaffolded scripts
  StarterPlayerScripts/*.lua          paste into the scaffolded LocalScript
  panels/manualPanelController.lua    your fixed + hardened Manual Panel script
```

## Read this order

1. `docs/ARCHITECTURE.md` — why it's built this way, the data model
2. `docs/SETUP.md` — the actual steps, in order, to get it running
3. Everything else is referenced from SETUP.md as you go

## The original bug

Your Manual Panel script was structurally fine — the actual problem was
that `entryDoors`/`stretchDoors`/`startPreshow` clicks only fired
`PanelOpenEntry`/`PanelStart` events with nothing confirmed to be
listening and setting the resulting attributes, while `PanelToggle`
clearly had a working listener (since power toggling worked). The new
`panels/manualPanelController.lua` keeps your original logic intact and
adds the training-qualification gate, per-player debounce, and nil-safety
on top — but you should still confirm whatever listens for
`PanelOpenEntry`/`PanelStart` (likely `preshowHandler`) is present,
enabled, and actually setting `EntryOpen`/`StretchOpen`/`CanStart`.
