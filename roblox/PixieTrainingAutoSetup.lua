--[[
	PixieTrainingAutoSetup

	Run this ONCE to scaffold every Roblox-side instance the training
	system needs. Paste into the Studio Command Bar (View -> Command Bar)
	and run it, OR temporarily place as a Script anywhere, run the game
	once in Studio (not live), then delete the script — it only builds
	structure, it doesn't need to keep running.

	What it creates (skips anything that already exists, safe to re-run):
	  ServerScriptService/
	    PixieBackend          (you still paste in the real ModuleScript code)
	    PlayerRegistration
	    TrainingCommands
	  ReplicatedStorage/
	    TrainingNotify (RemoteEvent)
	  StarterPlayerScripts/
	    TrainingNotifyClient

	This script does NOT paste in the actual Lua source for the three
	server scripts — Studio's API can create empty Script instances, but
	you still need to copy the source from PixieBackend.lua,
	PlayerRegistration.lua, and TrainingCommands.lua (delivered alongside
	this) into them. This just guarantees they exist in the right place
	with the right name, so there's no ambiguity about where things go.
]]

local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local StarterPlayer = game:GetService("StarterPlayer")

local function ensureScript(parent, name, className)
	local existing = parent:FindFirstChild(name)
	if existing then
		print("[PixieSetup] Already exists, skipping: " .. parent:GetFullName() .. "/" .. name)
		return existing
	end

	local instance = Instance.new(className)
	instance.Name = name
	instance.Parent = parent
	print("[PixieSetup] Created: " .. instance:GetFullName())
	return instance
end

-- ServerScriptService scripts
ensureScript(ServerScriptService, "PixieBackend", "ModuleScript")
ensureScript(ServerScriptService, "PlayerRegistration", "Script")
ensureScript(ServerScriptService, "TrainingCommands", "Script")

-- ReplicatedStorage RemoteEvent
ensureScript(ReplicatedStorage, "TrainingNotify", "RemoteEvent")

-- StarterPlayerScripts
local starterPlayerScripts = StarterPlayer:FindFirstChild("StarterPlayerScripts")
if starterPlayerScripts then
	ensureScript(starterPlayerScripts, "TrainingNotifyClient", "LocalScript")
else
	warn("[PixieSetup] StarterPlayerScripts not found under StarterPlayer — create it manually and re-run.")
end

print("[PixieSetup] Done. Now paste the matching source from the delivered .lua files into each script.")
print("[PixieSetup] Don't forget: set BASE_URL and SERVER_KEY inside PixieBackend, and GROUP_ID inside PlayerRegistration.")
