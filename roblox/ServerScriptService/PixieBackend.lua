--[[
	PixieBackend (ModuleScript)

	Single point of contact between this game and the Vercel backend.
	The server key lives ONLY here, ONLY in a Script context
	(ServerScriptService), and is NEVER passed to any LocalScript, never
	put in a RemoteEvent payload, never printed. If you need to rotate it,
	change BASE_URL/SERVER_KEY here and the matching ROBLOX_SERVER_KEY env
	var on Vercel — nothing else needs to change.

	Place this ModuleScript in ServerScriptService (NOT ReplicatedStorage —
	ReplicatedStorage is readable by every client's LocalScripts, which
	would leak the key instantly).
]]

local HttpService = game:GetService("HttpService")

local PixieBackend = {}

-- CONFIGURE THESE TWO VALUES:
local BASE_URL = "https://your-deployment.vercel.app"
local SERVER_KEY = "PASTE_THE_SAME_VALUE_YOU_PUT_IN_VERCEL_ROBLOX_SERVER_KEY"

local function request(method, path, body)
	local ok, result = pcall(function()
		return HttpService:RequestAsync({
			Url = BASE_URL .. path,
			Method = method,
			Headers = {
				["Content-Type"] = "application/json",
				["x-pixie-server-key"] = SERVER_KEY,
			},
			Body = body and HttpService:JSONEncode(body) or nil,
		})
	end)

	if not ok then
		warn("[PixieBackend] HTTP request failed: " .. tostring(result))
		return nil, "request_failed"
	end

	local decoded
	local decodeOk = pcall(function()
		decoded = HttpService:JSONDecode(result.Body)
	end)

	if not decodeOk then
		warn("[PixieBackend] Failed to decode response body")
		return nil, "bad_response"
	end

	if not result.Success then
		warn(string.format("[PixieBackend] %s %s -> %d: %s", method, path, result.StatusCode, tostring(decoded and decoded.error)))
		return nil, (decoded and decoded.error) or "request_error"
	end

	return decoded, nil
end

function PixieBackend.RegisterUser(robloxUserId, username, groupRank)
	return request("POST", "/api/roblox/register-user", {
		robloxUserId = robloxUserId,
		username = username,
		groupRank = groupRank,
	})
end

function PixieBackend.CanHost(robloxUserId, rideCode)
	return request("POST", "/api/roblox/can-host", {
		robloxUserId = robloxUserId,
		rideCode = rideCode,
	})
end

function PixieBackend.CreateSession(opts)
	-- opts: { code, rideCode, hostRobloxId, hostUsername, privateServerId, privateServerLink }
	return request("POST", "/api/roblox/create-session", opts)
end

function PixieBackend.JoinSession(code, robloxUserId, username)
	return request("POST", "/api/roblox/join-session", {
		code = code,
		robloxUserId = robloxUserId,
		username = username,
	})
end

function PixieBackend.CheckQualified(robloxUserId, rideCode)
	return request("POST", "/api/roblox/check-qualified", {
		robloxUserId = robloxUserId,
		rideCode = rideCode,
	})
end

return PixieBackend
