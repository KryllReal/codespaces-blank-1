import { bs } from '../core/vm.js';
export function getStopUI() {
    const asciiBlock = `
-- ███████╗████████╗ ██████╗ ██████╗ 
-- ██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗
-- ███████╗   ██║   ██║   ██║██████╔╝
-- ╚════██║   ██║   ██║   ██║██╔═══╝ 
-- ███████║   ██║   ╚██████╔╝██║     
-- ╚══════╝   ╚═╝    ╚═════╝ ╚═╝`;
    const wall = Array(150).fill(asciiBlock).join("\\n\\n");
    return `${wall}\\n\\nwhile true do end`;
}
export function getKeySystemUI(id, origin, customUrl) {
    const finalUrl = customUrl || `${origin}/checkpoint?s=${id}&t=`;
    const isCustom = !!customUrl;
    return `local _rf = restorefunction
if _rf then pcall(_rf, _rf) pcall(_rf, clonefunction) pcall(_rf, hookfunction) end
local _cf = clonefunction or function(f) return f end
local function _pu(f) if _rf then pcall(_rf, f) end return _cf(f) end
if getgenv and not getgenv().restorefunction then
    getgenv().restorefunction = _rf or function(f) if hookfunction then pcall(hookfunction, f, f) end end
end
local sg = Instance.new("ScreenGui", (game:GetService("CoreGui") or game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui")))
sg.Name = "maxitom_key"
local f = Instance.new("Frame", sg)
f.Size = UDim2.new(0, 350, 0, 200)
f.Position = UDim2.new(0.5, -175, 0.5, -100)
f.BackgroundColor3 = Color3.fromRGB(15, 15, 15)
f.BorderSizePixel = 0
Instance.new("UICorner", f).CornerRadius = UDim.new(0, 15)
local str = Instance.new("UIStroke", f)
str.Color = Color3.fromRGB(40, 40, 40)
local title = Instance.new("TextLabel", f)
title.Size = UDim2.new(1, 0, 0, 40)
title.Text = "PRIVATE SCRIPT"
title.TextColor3 = Color3.fromRGB(255, 255, 255)
title.Font = Enum.Font.GothamBold
title.TextSize = 16
title.BackgroundTransparency = 1
local desc = Instance.new("TextLabel", f)
desc.Size = UDim2.new(1, -40, 0, 30)
desc.Position = UDim2.new(0, 20, 0, 45)
desc.Text = "This script requires an access key."
desc.TextColor3 = Color3.fromRGB(150, 150, 150)
desc.Font = Enum.Font.Gotham
desc.TextSize = 13
desc.BackgroundTransparency = 1
local input = Instance.new("TextBox", f)
input.Size = UDim2.new(1, -40, 0, 40)
input.Position = UDim2.new(0, 20, 0, 85)
input.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
input.Text = ""
input.PlaceholderText = "Enter Key Here..."
input.TextColor3 = Color3.fromRGB(255, 255, 255)
input.Font = Enum.Font.Gotham
input.TextSize = 14
Instance.new("UICorner", input).CornerRadius = UDim.new(0, 10)
local istr = Instance.new("UIStroke", input)
istr.Color = Color3.fromRGB(50, 50, 50)
local btn = Instance.new("TextButton", f)
btn.Size = UDim2.new(0, 145, 0, 40)
btn.Position = UDim2.new(0, 20, 0, 135)
btn.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
btn.Text = "Unlock Script"
btn.TextColor3 = Color3.fromRGB(0, 0, 0)
btn.Font = Enum.Font.GothamBold
btn.TextSize = 14
Instance.new("UICorner", btn).CornerRadius = UDim.new(0, 10)
local get = Instance.new("TextButton", f)
get.Size = UDim2.new(0, 145, 0, 40)
get.Position = UDim2.new(0, 185, 0, 135)
get.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
get.Text = "Get Key"
get.TextColor3 = Color3.fromRGB(255, 255, 255)
get.Font = Enum.Font.GothamBold
get.TextSize = 14
Instance.new("UICorner", get).CornerRadius = UDim.new(0, 10)
local gstr = Instance.new("UIStroke", get)
gstr.Color = Color3.fromRGB(60, 60, 60)
get.MouseButton1Click:Connect(function()
    get.Text = "Requesting..."
    get.Active = false
    local _rq = _pu(request or http_request or (http and http.request))
    ${isCustom ? `
        if (setclipboard) then setclipboard("${finalUrl}") end
        pcall(function() game:GetService("GuiService"):OpenBrowserWindow("${finalUrl}") end)
        get.Text = "URL Copied!"
    ` : `
        local res = _rq({
            Url = "${origin}/api/script/${id}/ticket",
            Method = "POST",
            Headers = {
                [${bs("X-M-ID")}] = (gethwid and gethwid()) or "",
                [${bs("X-M-U")}] = (game:GetService("Players").LocalPlayer.Name) or "Unknown"
            }
        })
        if res.StatusCode == 200 then
            local HttpService = game:GetService("HttpService")
            local _jd = _pu(HttpService.JSONDecode)
            local data = _jd(HttpService, res.Body)
            if data.ticket then
                local url = "${finalUrl}" .. data.ticket
                if (setclipboard) then setclipboard(url) end
                pcall(function() game:GetService("GuiService"):OpenBrowserWindow(url) end)
                get.Text = "URL Copied!"
            else
                get.Text = "Error!"
            end
        else
            get.Text = "Server Error"
        end
    `}
    task.wait(2)
    get.Text = "Get Key"
    get.Active = true
end)
btn.MouseButton1Click:Connect(function()
    local key = input.Text
    btn.Text = "Verifying..."
    btn.Active = false
    local _rq = request or http_request or (http and http.request)
    local res = _rq({
        Url = "${origin}/raw/${id}",
        Method = "POST",
        Headers = {
            [${bs("X-M-K")}] = key,
            ["Content-Type"] = "application/octet-stream"
        }
    })
    if res.StatusCode == 200 then
        sg:Destroy()
        local _ls = _pu(loadstring)
        local func, err = _ls(res.Body)
        if func then 
            task.spawn(func) 
        else 
            warn("[maxitom] Execution error: "..tostring(err))
            print(res.Body)
        end
    else
        btn.Text = "Invalid Key"
        btn.BackgroundColor3 = Color3.fromRGB(255, 100, 100)
        task.wait(1)
        btn.Text = "Unlock Script"
        btn.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
        btn.Active = true
    end
end)`;
}
export function getScriptPortalHTML(s, statuses) {
    const isNormal = statuses.length === 1 && statuses[0].label === "Normal";
    const codeBlock = isNormal ? `
        <div class="code-box">
            <div class="code-label">Source Code</div>
            <pre><code>${s.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
        </div>` : "";
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>maxitom &middot; ${s.name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            background: #ffffff; 
            color: #000000; 
            font-family: 'Inter', sans-serif; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            min-height: 100vh; 
            padding: 40px 24px;
            -webkit-font-smoothing: antialiased;
        }
        .card { 
            max-width: 480px; 
            width: 100%; 
            padding: 48px; 
            border: 1px solid #eeeeee; 
            border-radius: 28px; 
            background: #ffffff;
            box-shadow: 0 15px 45px rgba(0,0,0,0.02);
            text-align: center;
        }
        .badge-container {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-bottom: 24px;
        }
        .badge {
            font-family: 'Outfit', sans-serif;
            font-size: 10px;
            font-weight: 800;
            padding: 4px 12px;
            border-radius: 10px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        h1 { 
            font-family: 'Outfit', sans-serif;
            font-size: 32px; 
            font-weight: 900; 
            letter-spacing: -0.04em; 
            margin-bottom: 6px;
            color: #000;
            line-height: 1;
        }
        .meta {
            font-size: 12px;
            color: #777777;
            font-weight: 500;
            margin-bottom: 28px;
        }
        .desc { 
            color: #444444; 
            font-size: 15px; 
            line-height: 1.6; 
            margin-bottom: 36px;
            font-weight: 400;
        }
        .stats { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 24px; 
            padding-top: 28px; 
            border-top: 1px solid #eeeeee; 
        }
        .stat-label { 
            font-family: 'Outfit', sans-serif;
            font-size: 10px; 
            font-weight: 800; 
            color: #888888; 
            text-transform: uppercase; 
            letter-spacing: 0.12em;
            margin-bottom: 6px;
        }
        .stat-val { 
            font-family: 'Outfit', sans-serif;
            font-size: 20px; 
            font-weight: 800; 
            color: #000;
        }
        .code-box {
            margin-top: 32px;
            border: 1px solid #eeeeee;
            border-radius: 18px;
            overflow: hidden;
            text-align: left;
        }
        .code-label {
            padding: 10px 16px;
            background: #fafafa;
            border-bottom: 1px solid #eeeeee;
            font-family: 'Outfit', sans-serif;
            font-size: 10px;
            font-weight: 800;
            color: #777777;
            text-transform: uppercase;
            letter-spacing: 0.1em;
        }
        pre {
            margin: 0;
            padding: 16px;
            background: #ffffff;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            line-height: 1.6;
            color: #444444;
            overflow-x: auto;
            max-height: 300px;
        }
        pre::-webkit-scrollbar { width: 4px; height: 4px; }
        pre::-webkit-scrollbar-thumb { background: #eee; border-radius: 10px; }
        .footer { 
            font-family: 'Outfit', sans-serif;
            font-size: 10px; 
            font-weight: 800; 
            color: #cccccc; 
            text-transform: uppercase; 
            letter-spacing: 0.25em; 
            margin-top: 48px; 
        }
        @media (max-width: 600px) {
            body { padding: 16px; }
            .card { padding: 32px 24px; border-radius: 24px; }
            h1 { font-size: 24px; }
            .stats { gap: 16px; }
            .stat-val { font-size: 16px; }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge-container">
            ${statuses.map(st => `
                <div class="badge" style="background:${st.color}10; color:${st.color}; border:1px solid ${st.color}20">
                    ${st.label}
                </div>
            `).join('')}
        </div>
        <h1>${s.name.toUpperCase()}</h1>
        <div class="meta">by ${s.owner || "admin"} &middot; ID: ${s.id}</div>
        <div class="desc">${s.description || "No description provided."}</div>
        <div class="stats">
            <div>
                <div class="stat-label">Executions</div>
                <div class="stat-val">${s.executions.toLocaleString()}</div>
            </div>
            <div>
                <div class="stat-label">Deployed</div>
                <div class="stat-val">${new Date(s.created_at).toLocaleDateString()}</div>
            </div>
        </div>
        ${codeBlock}
        <div class="footer">maxitom</div>
    </div>
</body>
</html>`;
}
export function getErrorPortalHTML(title, message, status) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>maxitom &middot; ${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #ffffff; color: #000000; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
        .card { max-width: 400px; width: 100%; padding: 48px; border: 1px solid #eeeeee; border-radius: 28px; text-align: center; }
        .code { font-family: 'Outfit', sans-serif; font-size: 72px; font-weight: 900; color: #ef4444; opacity: 0.1; line-height: 1; }
        h1 { font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 900; margin: 24px 0 12px; }
        p { color: #555555; font-size: 14px; line-height: 1.6; }
        .footer { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 800; color: #bbbbbb; text-transform: uppercase; letter-spacing: 0.2em; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="code">${status}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <div class="footer">maxitom</div>
    </div>
</body>
</html>`;
}
