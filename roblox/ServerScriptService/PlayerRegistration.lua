--[[
	PlayerRegistration (Script, place in ServerScriptService)

	Runs once per player join. This is what makes a player "known" to the
	training system at all (the no-guests rule in join-session checks for
	this profile existing). Does NOT grant any permission — registration
	just keeps username/rank fresh so Manager+ can find and grant people
	by current username in the console.
]]

local Players = game:GetService("Players")
local PixieBackend = require(script.Parent:WaitForChild("PixieBackend"))

local GROUP_ID = 0 -- TODO: set to your actual Pixie Productions group ID

local function onPlayerAdded(player)
	local groupRank = 0
	pcall(function()
		groupRank = player:GetRankInGroup(GROUP_ID)
	end)

	local _, err = PixieBackend.RegisterUser(player.UserId, player.Name, groupRank)
	if err then
		warn(string.format("[PlayerRegistration] Failed to register %s: %s", player.Name, err))
	end
end

Players.PlayerAdded:Connect(onPlayerAdded)

for _, player in ipairs(Players:GetPlayers()) do
	task.spawn(onPlayerAdded, player)
end
