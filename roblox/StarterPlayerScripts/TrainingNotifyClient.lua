--[[
	TrainingNotifyClient (LocalScript, place in StarterPlayerScripts)

	The other half of the notify() function in TrainingCommands.lua.
	SetCore("ChatMakeSystemMessage", ...) only works from the client, so
	the server fires this RemoteEvent and this LocalScript does the actual
	display. This script has zero logic of its own to exploit — it just
	renders whatever string the server sends, so there's nothing here for
	an exploiter to abuse to fake authorization (the authorization already
	happened server-side before this fires).
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local StarterGui = game:GetService("StarterGui")

local notifyEvent = ReplicatedStorage:WaitForChild("TrainingNotify")

notifyEvent.OnClientEvent:Connect(function(message)
	pcall(function()
		StarterGui:SetCore("ChatMakeSystemMessage", {
			Text = tostring(message),
			Color = Color3.fromRGB(220, 170, 60),
			Font = Enum.Font.SourceSansBold,
		})
	end)
end)
