--[[
	TrainingCommands (Script, place in ServerScriptService)

	Chat commands:
	  !jointraining CODE        -- any registered cast/student tries to join
	  !hosttraining RIDECODE CODE  -- Manager+ with canHostTraining starts one

	Why commands instead of a GUI for v1: matches what you described
	("they say !jointraining CODE"), and keeps the in-game surface area
	tiny — no exploitable GUI remotes to worry about, just one parsed
	chat string per command into a server-only HTTP call.

	SECURITY NOTE: this entire script runs on the server. Chat messages
	are already server-authoritative in Roblox (TextChatService routes
	through the server), so there is no client-trust issue here — the
	real authorization happens inside PixieBackend's calls to Vercel,
	which re-check canHostTraining / qualifications server-side regardless
	of what this script thinks. This script being correct is a UX nicety,
	not the security boundary.
]]

local Players = game:GetService("Players")
local TeleportService = game:GetService("TeleportService")

local PixieBackend = require(script.Parent:WaitForChild("PixieBackend"))

local PLACE_ID = game.PlaceId -- training takes place on the same map/place

--[[
	Notifications: SetCore("ChatMakeSystemMessage", ...) is a CLIENT-ONLY
	API — it cannot be called from a server Script at all (StarterGui on
	the server has no SetCore). To actually show feedback in the player's
	chat we fire a RemoteEvent and let a small LocalScript call SetCore.
	Create a RemoteEvent named "TrainingNotify" under
	ReplicatedStorage (a "events" folder is fine, matches your existing
	convention) and the matching LocalScript below.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local notifyEvent = Instance.new("RemoteEvent")
notifyEvent.Name = "TrainingNotify"
notifyEvent.Parent = ReplicatedStorage

local function notify(player, message)
	notifyEvent:FireClient(player, message)
end

local function handleJoin(player, code)
	if not code or code == "" then
		notify(player, "Usage: !jointraining CODE")
		return
	end

	local result, err = PixieBackend.JoinSession(code, player.UserId, player.Name)

	if err then
		notify(player, "Could not reach the training system. Try again shortly.")
		return
	end

	if not result.allow then
		notify(player, "Join failed: " .. tostring(result.reason or "not allowed"))
		return
	end

	local ok, teleportErr = pcall(function()
		TeleportService:TeleportToPrivateServer(
			PLACE_ID,
			result.privateServerId,
			{ player }
		)
	end)

	if not ok then
		warn("[TrainingCommands] Teleport failed: " .. tostring(teleportErr))
		notify(player, "Found the session but teleport failed. Tell a manager.")
	end
end

local function handleHost(player, rideCode, code)
	if not rideCode or not code then
		notify(player, "Usage: !hosttraining RIDECODE CODE")
		return
	end

	local hostCheck, hostErr = PixieBackend.CanHost(player.UserId, rideCode)
	if hostErr or not hostCheck or not hostCheck.canHost then
		notify(player, "You are not authorized to host training sessions.")
		return
	end

	-- Reserve a fresh private server for this session.
	local accessCode = nil
	local ok = pcall(function()
		accessCode = TeleportService:ReserveServer(PLACE_ID)
	end)

	if not ok or not accessCode then
		notify(player, "Could not reserve a private server. Try again.")
		return
	end

	local result, err = PixieBackend.CreateSession({
		code = code,
		rideCode = rideCode,
		hostRobloxId = player.UserId,
		hostUsername = player.Name,
		privateServerId = accessCode,
		privateServerLink = "", -- optional: build a roblox.com join link if desired
	})

	if err then
		notify(player, "Could not create session: " .. tostring(err))
		return
	end

	notify(player, string.format("Session '%s' is live for %s. Share the code with trainees.", code, rideCode))

	-- Host teleports into their own freshly reserved server too.
	pcall(function()
		TeleportService:TeleportToPrivateServer(PLACE_ID, accessCode, { player })
	end)
end

local function onChatted(player, message)
	local lower = message:lower()

	if lower:sub(1, 13) == "!jointraining" then
		local code = message:sub(15):gsub("^%s+", ""):gsub("%s+$", "")
		handleJoin(player, code)
		return
	end

	if lower:sub(1, 13) == "!hosttraining" then
		local rest = message:sub(15)
		local parts = {}
		for part in rest:gmatch("%S+") do
			table.insert(parts, part)
		end
		handleHost(player, parts[1], parts[2])
		return
	end
end

Players.PlayerAdded:Connect(function(player)
	player.Chatted:Connect(function(message)
		onChatted(player, message)
	end)
end)
