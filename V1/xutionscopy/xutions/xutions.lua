local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

local endpoint = "https://YOUR_DOMAIN/api/xutions/track"
local key = "YOUR_API_KEY"

local http = (syn and syn.request) or request or http_request or HttpService.PostAsync and function(opts)
    local body = HttpService:PostAsync(opts.Url, opts.Body, Enum.HttpContentType.ApplicationJson)
    return { StatusCode = 200, Body = body }
end

local ok, err = pcall(function()
    local body = HttpService:JSONEncode({
        apiKey = key,
        eventType = "EXECUTION",
        userId = Players.LocalPlayer and tostring(Players.LocalPlayer.UserId) or "0",
        metadata = { placeId = game.PlaceId, jobId = game.JobId }
    })

    return http({
        Url = endpoint,
        Method = "POST",
        Headers = { ["Content-Type"] = "application/json" },
        Body = body
    })
end)

if ok then
    print("[Xutions] Tracked successfully")
else
    warn("[Xutions] Failed: " .. tostring(err))
end
