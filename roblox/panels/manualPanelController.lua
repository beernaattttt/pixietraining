--[[
	manualPanelController (Script, child of Manual Panel)

	This is your original panel script, kept structurally the same (same
	paths, same attribute names, same flow) so nothing about how the
	panel itself works changes — plus:

	  1. A qualification gate: a player must be marked qualified for this
	     ride (rideCode below) in the training database before any click
	     does anything. Unqualified players clicking the power switch get
	     a clear message instead of silently nothing happening.
	  2. A per-player debounce so rapid/automated clicking can't desync
	     state or double-fire teleports/animations downstream.
	  3. Defensive nil-checks so one missing part can't silently break
	     update() for every other indicator.

	Qualification check calls the same Vercel backend as the training
	system (PixieBackend ModuleScript in ServerScriptService) — one
	source of truth for "can this person operate this ride" across every
	map you own.
]]

local panel = script.Parent
local foyer = workspace.foyer
local events = foyer.events

local Toggle = events:WaitForChild("PanelToggle")
local Entry = events:WaitForChild("PanelOpenEntry")
local Start = events:WaitForChild("PanelStart")

local ServerScriptService = game:GetService("ServerScriptService")
local PixieBackend = require(ServerScriptService:WaitForChild("PixieBackend"))

local RIDE_CODE = "htm" -- set per map: this map's ride code

--------------------------------------------------
-- MODELS
--------------------------------------------------

local powerModel = panel.panelPower["Key(ROTATE)"]
local entryModel = panel.entryDoors.Switch["Switch(ROTATE)"]
local stretchModel = panel.stretchDoors.Switch["Switch(ROTATE)"]

local powerClick = panel.panelPower.ClickPart.ClickDetector
local entryClick = panel.entryDoors.Switch["Switch(ROTATE)"].ClickPart.ClickDetector
local startClick = panel.startPreshow.Button.Button.ClickDetector

--------------------------------------------------
-- QUALIFICATION GATE
--------------------------------------------------

-- Cache results briefly per player so every click doesn't trigger a fresh
-- HTTP round trip — qualification changes rarely (a manager grants it
-- once), so a short cache is the right tradeoff between freshness and
-- not hammering the backend every time someone taps a button.
local qualificationCache = {} -- [userId] = { qualified = bool, checkedAt = number }
local CACHE_SECONDS = 30

local function isQualified(player)
	local cached = qualificationCache[player.UserId]
	if cached and (os.clock() - cached.checkedAt) < CACHE_SECONDS then
		return cached.qualified
	end

	local result, err = PixieBackend.CheckQualified(player.UserId, RIDE_CODE)
	local qualified = (not err) and result and result.qualified or false

	qualificationCache[player.UserId] = { qualified = qualified, checkedAt = os.clock() }
	return qualified
end

local function notifyUnqualified(player)
	local ReplicatedStorage = game:GetService("ReplicatedStorage")
	local notifyEvent = ReplicatedStorage:FindFirstChild("TrainingNotify")
	if notifyEvent then
		notifyEvent:FireClient(player, "You are not trained to operate this ride yet.")
	end
end

--------------------------------------------------
-- PER-PLAYER DEBOUNCE
--------------------------------------------------

local lastClickAt = {} -- [userId] = os.clock()
local DEBOUNCE_SECONDS = 0.4

local function debounced(player)
	local now = os.clock()
	local last = lastClickAt[player.UserId]
	if last and (now - last) < DEBOUNCE_SECONDS then
		return true
	end
	lastClickAt[player.UserId] = now
	return false
end

--------------------------------------------------
-- INDICATORS
--------------------------------------------------

local indicators = panel.indicatorLights

local function setButtonLight(indicator, on)
	if not indicator then return end
	local button = indicator:FindFirstChild("button")
	if not button then return end

	button.Material = on and Enum.Material.Neon or Enum.Material.Glass
	button.Transparency = on and 0 or 0.5
end

--------------------------------------------------
-- START BUTTON IMAGES
--------------------------------------------------

local startButton = panel.startPreshow.Button.Button
local lit = startButton:FindFirstChild("Lit")
local unlit = startButton:FindFirstChild("Unlit")

--------------------------------------------------
-- ROTACIÓ
--------------------------------------------------

local pivots = {
	power = powerModel:GetPivot(),
	entry = entryModel:GetPivot(),
	stretch = stretchModel:GetPivot(),
}

local ANGLE = math.rad(-110)

local function rotate(model, base, on)
	if not model then return end
	model:PivotTo(base * CFrame.Angles(0, on and ANGLE or 0, 0))
end

--------------------------------------------------
-- FLASH READY
--------------------------------------------------

local flashing = false

local function flashStart()
	if flashing then return end
	flashing = true

	task.spawn(function()
		while panel:GetAttribute("CanStart") do
			if lit and unlit then
				lit.Transparency = 0
				unlit.Transparency = 1
				task.wait(0.7)

				lit.Transparency = 1
				unlit.Transparency = 0
				task.wait(0.7)
			else
				task.wait(0.7) -- avoid a tight loop if parts are missing
			end
		end

		if lit and unlit then
			lit.Transparency = 1
			unlit.Transparency = 0
		end

		flashing = false
	end)
end

--------------------------------------------------
-- UPDATE
--------------------------------------------------

local function update()
	local panelOn = panel:GetAttribute("PanelOn") or false
	local entryOpen = panel:GetAttribute("EntryOpen") or false
	local stretchOpen = panel:GetAttribute("StretchOpen") or false
	local inUse = panel:GetAttribute("InUse") or false
	local canStart = panel:GetAttribute("CanStart") or false

	-- ROTATE
	rotate(powerModel, pivots.power, panelOn)
	rotate(entryModel, pivots.entry, entryOpen)
	rotate(stretchModel, pivots.stretch, stretchOpen)

	-- CLICK LOGIC
	powerClick.MaxActivationDistance = 10

	if panelOn then
		entryClick.MaxActivationDistance = entryOpen and 0 or 10
		startClick.MaxActivationDistance = 10
	else
		entryClick.MaxActivationDistance = 0
		startClick.MaxActivationDistance = 0
	end

	-- LIGHTS
	setButtonLight(indicators.panelActive, panelOn)
	setButtonLight(indicators.entryDoorsOpen, entryOpen)
	setButtonLight(indicators.stretchDoorOpen, stretchOpen)
	setButtonLight(indicators.StretchInUse, inUse)
	setButtonLight(indicators.stretchPanelActive, panelOn)
	setButtonLight(indicators.preshowReady, canStart)

	-- FLASH
	if canStart then
		flashStart()
	end
end

--------------------------------------------------
-- EVENTS
--------------------------------------------------

panel:GetAttributeChangedSignal("PanelOn"):Connect(update)
panel:GetAttributeChangedSignal("EntryOpen"):Connect(update)
panel:GetAttributeChangedSignal("StretchOpen"):Connect(update)
panel:GetAttributeChangedSignal("InUse"):Connect(update)
panel:GetAttributeChangedSignal("CanStart"):Connect(update)

--------------------------------------------------
-- CLICK
--------------------------------------------------

powerClick.MouseClick:Connect(function(player)
	if debounced(player) then return end

	if not isQualified(player) then
		notifyUnqualified(player)
		return
	end

	local current = panel:GetAttribute("PanelOn") or false
	Toggle:Fire(not current)
end)

entryClick.MouseClick:Connect(function(player)
	if debounced(player) then return end
	if panel:GetAttribute("EntryOpen") then return end

	if not isQualified(player) then
		notifyUnqualified(player)
		return
	end

	Entry:Fire()
end)

startClick.MouseClick:Connect(function(player)
	if debounced(player) then return end

	if not isQualified(player) then
		notifyUnqualified(player)
		return
	end

	Start:Fire()
end)

--------------------------------------------------
-- INIT
--------------------------------------------------

update()
