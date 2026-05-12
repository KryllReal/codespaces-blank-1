export function bs(str) {
    return 'string.char(' + str.split('').map(c => c.charCodeAt(0)).join(',') + ')';
}
export function getRVMRuntime(ops) {
    return `(function(bc, hash, hwid)
    local _rf = restorefunction
    if _rf then pcall(_rf, _rf) pcall(_rf, clonefunction) pcall(_rf, hookfunction) end
    local _cf = clonefunction or function(f) return f end
    local function _pu(f) if _rf then pcall(_rf, f) end return _cf(f) end
    if getgenv and not getgenv().restorefunction then
        getgenv().restorefunction = _rf or function(f) if hookfunction then pcall(hookfunction, f, f) end end
    end
    local _C = {}
    _C._sb = _pu(string.byte) _C._sc = _pu(string.char) _C._ss = _pu(string.sub) _C._sl = _pu(string.len)
    _C._sg = _pu(string.gsub) _C._tc = _pu(table.concat) _C._mf = _pu(math.floor)
    _C._ls = _pu(loadstring)
    _C._bx = _pu(bit32.bxor)
    _C._ts = _pu(task.spawn)
    _C._up = _pu(unpack)
    _C._jd = _pu(game:GetService("HttpService").JSONDecode)
    local _stack = {}
    local _env = getgenv and getgenv() or getfenv(0)
    local _pcall = _pu(pcall)
    local _kb = (function(s)
        local u = {}
        for i = 1, 16, 4 do
            local b1, b2, b3, b4 = _C._sb(s, i, i + 3)
            u[#u + 1] = bit32.bor(b1 or 0, bit32.lshift(b2 or 0, 8), bit32.lshift(b3 or 0, 16), bit32.lshift(b4 or 0, 24))
        end
        return u
    end)(hash .. hwid)
    local _bls = _pu(bit32.lshift)
    local _brs = _pu(bit32.rshift)
    local _ba = _pu(bit32.band)
    local _bo = _pu(bit32.bor)
    local _bl = {}
    local _bc2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    for i=1,64 do _bl[_C._ss(_bc2,i,i)] = i-1 end
    local function _bd(d)
        local r, buf, bits = {}, 0, 0
        for i=1, _C._sl(d) do
            local c = _C._ss(d, i, i)
            if c ~= "=" then
                buf = _bo(_bls(buf, 6), (_bl[c] or 0))
                bits = bits + 6
                if bits >= 8 then
                    bits = bits - 8
                    r[#r+1] = _C._sc(_ba(_brs(buf, bits), 0xFF))
                    buf = _ba(buf, _bls(1, bits) - 1)
                end
            end
        end
        return _C._tc(r)
    end
    local _ti = _pu(table.insert)
    local _tr = _pu(table.remove)
    local function _xd(v, k)
        if #v < 2 then return v end
        local n = #v
        local z = v[n]
        local y = v[1]
        local delta = 0x9e3779b9
        local q = _C._mf(6 + 52 / n)
        local sum = bit32.band(q * delta, 0xFFFFFFFF)
        while sum ~= 0 do
            local e = bit32.band(bit32.rshift(sum, 2), 3)
            for p = n, 2, -1 do
                z = v[p - 1]
                local mx = bit32.bxor(
                    bit32.band(bit32.bxor(bit32.rshift(z, 5), bit32.lshift(y, 2)) + bit32.bxor(bit32.rshift(y, 3), bit32.lshift(z, 4)), 0xFFFFFFFF),
                    bit32.band(bit32.bxor(sum, y) + bit32.bxor(k[bit32.bxor(bit32.band(p - 1, 3), e) + 1], z), 0xFFFFFFFF)
                )
                v[p] = bit32.band(v[p] - mx, 0xFFFFFFFF)
                y = v[p]
            end
            z = v[n]
            local mx = bit32.bxor(
                bit32.band(bit32.bxor(bit32.rshift(z, 5), bit32.lshift(y, 2)) + bit32.bxor(bit32.rshift(y, 3), bit32.lshift(z, 4)), 0xFFFFFFFF),
                bit32.band(bit32.bxor(sum, y) + bit32.bxor(k[bit32.bxor(bit32.band(0, 3), e) + 1], z), 0xFFFFFFFF)
            )
            v[1] = bit32.band(v[1] - mx, 0xFFFFFFFF)
            y = v[1]
            sum = bit32.band(sum - delta, 0xFFFFFFFF)
        end
        return v
    end
    local function _s2u(s)
        local u = {}
        for i = 1, #s, 4 do
            local b1, b2, b3, b4 = _C._sb(s, i, i + 3)
            u[#u + 1] = bit32.bor(b1 or 0, bit32.lshift(b2 or 0, 8), bit32.lshift(b3 or 0, 16), bit32.lshift(b4 or 0, 24))
        end
        return u
    end
    local function _u2s(u)
        local r = {}
        for i = 1, #u do
            local v = u[i]
            r[#r + 1] = _C._sc(bit32.band(v, 0xFF), bit32.band(bit32.rshift(v, 8), 0xFF), bit32.band(bit32.rshift(v, 16), 0xFF), bit32.band(bit32.rshift(v, 24), 0xFF))
        end
        return _C._tc(r)
    end
    local _handlers = {
        [${ops.GETG}] = function(d) _ti(_stack, _env[d]) end,
        [${ops.GETF}] = function()
            local k = _tr(_stack)
            local o = _tr(_stack)
            _ti(_stack, o[k])
        end,
        [${ops.PUSH}] = function(d) _ti(_stack, d) end,
        [${ops.CALL}] = function(n)
            local args = {}
            for i=1, n do _ti(args, 1, _tr(_stack)) end
            local f = _tr(_stack)
            local ok, res = _pcall(f, _C._up(args))
            if ok and res ~= nil then _ti(_stack, res) end
        end,
        [${ops.EXEC}] = function(d)
            local raw = _bd(d)
            local u = _s2u(raw)
            local res = _xd(u, _kb)
            local s = _u2s(res)
            s = _C._sg(s, "%z+$", "")
            local f, e = _C._ls(s)
            if f then
                setfenv(f, _env)
                _C._ts(f)
            else
                warn("[maxitom] Maximum Security: Payload compilation failed!")
            end
        end
    }
    for _, inst in ipairs(bc) do
        local h = _handlers[inst.o]
        if h then h(inst.d) end
    end
end)`;
}
export function getSecureLoader(url, ts, hash, getStopUI, getRVMRuntime) {
    const p1 = hash.substring(0, 16).split("").reverse().join("");
    const p2 = hash.substring(16, 32).split("").reverse().join("");
    const p3 = hash.substring(32, 48).split("").reverse().join("");
    const p4 = hash.substring(48, 64).split("").reverse().join("");
    return `local _rf = restorefunction
if _rf then pcall(_rf, _rf) pcall(_rf, clonefunction) pcall(_rf, hookfunction) end
local _cf = clonefunction or function(f) return f end
local function _pu(f) if _rf then pcall(_rf, f) end return _cf(f) end
if getgenv and not getgenv().restorefunction then
    getgenv().restorefunction = _rf or function(f) if hookfunction then pcall(hookfunction, f, f) end end
end
local _C = {}
_C._sb = _pu(string.byte) _C._sc = _pu(string.char) _C._ss = _pu(string.sub) _C._sl = _pu(string.len)
_C._sg = _pu(string.gsub) _C._tc = _pu(table.concat) _C._mf = _pu(math.floor)
_C._ls = _pu(loadstring)
_C._bx = _pu(bit32.bxor)
_C._ts = _pu(task.spawn)
_C._jd = _pu(game:GetService("HttpService").JSONDecode)
local function _ui(t, m)
    pcall(function()
        local sg = Instance.new("ScreenGui", (gethui and gethui()) or (game:GetService("CoreGui")) or (game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui")))
        sg.Name = "maxitomError"
        local f = Instance.new("Frame", sg)
        f.Size = UDim2.new(0, 480, 0, 320)
        f.Position = UDim2.new(0.5, -240, 0.5, -160)
        f.BackgroundColor3 = Color3.fromRGB(12, 12, 12)
        f.BorderSizePixel = 0
        Instance.new("UICorner", f).CornerRadius = UDim.new(0, 24)
        local stroke = Instance.new("UIStroke", f)
        stroke.Color = Color3.fromRGB(40, 40, 40)
        stroke.Thickness = 1
        local badge = Instance.new("TextLabel", f)
        badge.Size = UDim2.new(0, 100, 0, 24)
        badge.Position = UDim2.new(0, 25, 0, 25)
        badge.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
        badge.Text = "SYSTEM ERROR"
        badge.TextColor3 = Color3.fromRGB(255, 70, 70)
        badge.TextSize = 10
        badge.Font = Enum.Font.GothamBold
        Instance.new("UICorner", badge).CornerRadius = UDim.new(0, 100)
        Instance.new("UIStroke", badge).Color = Color3.fromRGB(60, 60, 60)
        local title = Instance.new("TextLabel", f)
        title.Size = UDim2.new(1, -50, 0, 40)
        title.Position = UDim2.new(0, 25, 0, 55)
        title.BackgroundTransparency = 1
        title.Text = t
        title.TextColor3 = Color3.fromRGB(255, 70, 70)
        title.TextSize = 24
        title.Font = Enum.Font.GothamBold
        title.TextXAlignment = Enum.TextXAlignment.Left
        local scroll = Instance.new("ScrollingFrame", f)
        scroll.Size = UDim2.new(1, -50, 1, -160)
        scroll.Position = UDim2.new(0, 25, 0, 105)
        scroll.BackgroundTransparency = 1
        scroll.BorderSizePixel = 0
        scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
        scroll.CanvasSize = UDim2.new(0,0,0,0)
        scroll.ScrollBarThickness = 2
        scroll.ScrollBarImageColor3 = Color3.fromRGB(80, 80, 80)
        local msg = Instance.new("TextLabel", scroll)
        msg.Size = UDim2.new(1, 0, 0, 0)
        msg.AutomaticSize = Enum.AutomaticSize.Y
        msg.BackgroundTransparency = 1
        msg.Text = m
        msg.TextColor3 = Color3.fromRGB(180, 180, 180)
        msg.TextSize = 14
        msg.Font = Enum.Font.Code
        msg.TextWrapped = true
        msg.TextXAlignment = Enum.TextXAlignment.Left
        msg.TextYAlignment = Enum.TextYAlignment.Top
        local close = Instance.new("TextButton", f)
        close.Size = UDim2.new(1, -50, 0, 45)
        close.Position = UDim2.new(0, 25, 1, -70)
        close.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
        close.Text = "Dismiss"
        close.TextColor3 = Color3.fromRGB(255, 255, 255)
        close.Font = Enum.Font.GothamBold
        close.TextSize = 14
        Instance.new("UICorner", close).CornerRadius = UDim.new(0, 12)
        close.MouseButton1Click:Connect(function() sg:Destroy() end)
    end)
end
local _rq = _pu(request or http_request or (http and http.request))
if type(_rq) ~= "function" then _ui("Executor Error", "Your executor does not support http requests.") return end
local _a1 = ${bs(p1)} local _a2 = ${bs(p2)} local _a3 = ${bs(p3)} local _a4 = ${bs(p4)}
local function _rv(s) local r={} for i=#s,1,-1 do r[#r+1]=_C._ss(s,i,i) end return _C._tc(r) end
local _hash = _rv(_a1).._rv(_a2).._rv(_a3).._rv(_a4)
local _hw = (gethwid and gethwid()) or ""
local _ek = _hash.._hw
_a1=nil _a2=nil _a3=nil _a4=nil
local _f1 = ${bs(Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join(""))}
local _pn = "Unknown" pcall(function() _pn=game:GetService("Players").LocalPlayer.Name end)
local _pid = "0" pcall(function() _pid=tostring(game.PlaceId) end)
local _rs = _rq({
    Url = ${bs(url)},
    Method = "POST",
    Headers = {
        [${bs("X-M-T")}] = ${bs(ts)}.."."..(_f1),
        [${bs("X-M-A")}] = ${bs(ts)}..".".._hash,
        [${bs("X-M-ID")}] = (gethwid and gethwid()) or "",
        [${bs("X-M-U")}] = _pn,
        [${bs("X-M-G")}] = _pid,
        ["Content-Type"] = "application/octet-stream",
        ["Content-Length"] = "0"
    },
    Body = ""
})
_f1=nil _pn=nil _rq=nil _hash=nil
if _rs.StatusCode == 200 then
    local _bls = _pu(bit32.lshift) local _brs = _pu(bit32.rshift) local _ba = _pu(bit32.band) local _bo = _pu(bit32.bor)
    local _bl = {} local _bc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    for i=1,64 do _bl[_C._ss(_bc,i,i)] = i-1 end
    local function _bd(d)
        local r, buf, bits = {}, 0, 0
        for i=1, _C._sl(d) do
            local c = _C._ss(d, i, i)
            if c ~= "=" then
                buf = _bo(_bls(buf, 6), (_bl[c] or 0))
                bits = bits + 6
                if bits >= 8 then
                    bits = bits - 8
                    r[#r+1] = _C._sc(_ba(_brs(buf, bits), 0xFF))
                    buf = _ba(buf, _bls(1, bits) - 1)
                end
            end
        end
        return _C._tc(r)
    end
    local _raw = _bd(_rs.Body)
    _rs = nil
    local function _xd(v, k)
        if #v < 2 then return v end
        local n = #v
        local z = v[n]
        local y = v[1]
        local delta = 0x9e3779b9
        local q = _C._mf(6 + 52 / n)
        local sum = bit32.band(q * delta, 0xFFFFFFFF)
        while sum ~= 0 do
            local e = bit32.band(bit32.rshift(sum, 2), 3)
            for p = n, 2, -1 do
                z = v[p - 1]
                local mx = bit32.bxor(
                    bit32.band(bit32.bxor(bit32.rshift(z, 5), bit32.lshift(y, 2)) + bit32.bxor(bit32.rshift(y, 3), bit32.lshift(z, 4)), 0xFFFFFFFF),
                    bit32.band(bit32.bxor(sum, y) + bit32.bxor(k[bit32.bxor(bit32.band(p - 1, 3), e) + 1], z), 0xFFFFFFFF)
                )
                v[p] = bit32.band(v[p] - mx, 0xFFFFFFFF)
                y = v[p]
            end
            z = v[n]
            local mx = bit32.bxor(
                bit32.band(bit32.bxor(bit32.rshift(z, 5), bit32.lshift(y, 2)) + bit32.bxor(bit32.rshift(y, 3), bit32.lshift(z, 4)), 0xFFFFFFFF),
                bit32.band(bit32.bxor(sum, y) + bit32.bxor(k[bit32.bxor(bit32.band(0, 3), e) + 1], z), 0xFFFFFFFF)
            )
            v[1] = bit32.band(v[1] - mx, 0xFFFFFFFF)
            y = v[1]
            sum = bit32.band(sum - delta, 0xFFFFFFFF)
        end
        return v
    end
    local function _s2u(s)
        local u = {}
        for i = 1, #s, 4 do
            local b1, b2, b3, b4 = _C._sb(s, i, i + 3)
            u[#u + 1] = bit32.bor(b1 or 0, bit32.lshift(b2 or 0, 8), bit32.lshift(b3 or 0, 16), bit32.lshift(b4 or 0, 24))
        end
        return u
    end
    local function _u2s(u)
        local r = {}
        for i = 1, #u do
            local v = u[i]
            r[#r + 1] = _C._sc(bit32.band(v, 0xFF), bit32.band(bit32.rshift(v, 8), 0xFF), bit32.band(bit32.rshift(v, 16), 0xFF), bit32.band(bit32.rshift(v, 24), 0xFF))
        end
        return _C._tc(r)
    end
    local _kb = (function(s)
        local u = {}
        for i = 1, 16, 4 do
            local b1, b2, b3, b4 = _C._sb(s, i, i + 3)
            u[#u + 1] = bit32.bor(b1 or 0, bit32.lshift(b2 or 0, 8), bit32.lshift(b3 or 0, 16), bit32.lshift(b4 or 0, 24))
        end
        return u
    end)(_ek)
    local _res = _xd(_s2u(_raw), _kb)
    local _cd = _u2s(_res)
    _cd = _C._sg(_cd, "%z+$", "")
    _raw = nil _res = nil _u = nil _ek = nil
    local _rvm = ${getRVMRuntime({ GETG: 0x01, GETF: 0x02, PUSH: 0x03, CALL: 0x04, EXEC: 0x05 })}
    local _ok, _pkt = pcall(function() return _C._jd(game:GetService("HttpService"), _cd) end)
    if _ok and type(_pkt) == "table" then
        _rvm(_pkt, ${bs(hash)}, _hw)
    else
        _ui("Delivery Error", "RVM packet decode failed.")
    end
    _cd=nil _bd=nil _bl=nil _bc=nil _hw=nil
else
    local _msg = _rs.Body
    if not _msg or _msg == "" or string.sub(_msg, 1, 9) == "<!DOCTYPE" then _msg = "Status "..tostring(_rs.StatusCode) end
    _ui("Delivery Failed", _msg)
end`;
}
export function getLauncher(url, ts, hash, getStopUI) {
    return `local _g = getfenv()
local _r = "\\114\\101\\115\\116\\111\\114\\101\\102\\117\\110\\099\\116\\105\\111\\110"
local _c = "\\099\\108\\111\\110\\101\\102\\117\\110\\099\\116\\105\\111\\110"
local _h = "\\104\\111\\111\\107\\102\\117\\110\\099\\116\\105\\111\\110"
local _l = "\\108\\111\\097\\100\\115\\116\\114\\105\\110\\103"
local _rf = _g[_r]
if _rf then pcall(_rf, _rf) pcall(_rf, _g[_c]) pcall(_rf, _g[_h]) pcall(_rf, _g[_l]) end
local _cf = _g[_c] or function(f) return f end
local function _pu(f) if _rf then pcall(_rf, f) end return _cf(f) end
if _g.getgenv and not _g.getgenv().restorefunction then
    _g.getgenv().restorefunction = _rf or function(f) if _g[_h] then pcall(_g[_h], f, f) end end
end
local _rq = _pu(request or http_request or (http and http.request))
if type(_rq) ~= "function" then
    ${getStopUI()}
    return
end
local _ls = _pu(_g[_l])
local _ts = _pu(task.spawn)
local _rs = _rq({
    Url = ${bs(url)},
    Method = "POST",
    Headers = {
        [${bs("X-M-Op")}] = ${bs("get_loader")},
        [${bs("X-M-Ts")}] = ${bs(ts)},
        [${bs("X-M-T")}] = ${bs(hash)},
        ["Content-Type"] = "application/octet-stream"
    }
})
if _rs.StatusCode == 200 then
    local _f, _e = _ls(_rs.Body)
    if _f then
        _ts(_f)
    else
        warn("[maxitom] Loader failed to compile: "..tostring(_e))
    end
else
    warn("[maxitom] Failed to fetch loader: "..tostring(_rs.StatusCode))
end`;
}
export function getKillSwitch(id, origin) {
    return `local _rf = restorefunction
if _rf then pcall(_rf, _rf) pcall(_rf, clonefunction) pcall(_rf, hookfunction) end
local _cf = clonefunction or function(f) return f end
local function _pu(f) if _rf then pcall(_rf, f) end return _cf(f) end
if getgenv and not getgenv().restorefunction then
    getgenv().restorefunction = _rf or function(f) if hookfunction then pcall(hookfunction, f, f) end end
end
local _env = (getgenv and getgenv()) or getfenv(0)
_env._LSH_SEEN = _env._LSH_SEEN or {}
local _LSH_SEEN = _env._LSH_SEEN
if not _LSH_SEEN[${bs(id)}] then
    _LSH_SEEN[${bs(id)}] = true
    task.spawn(function()
        local _gs = _pu(game.GetService)
        local _rq = _pu(request or http_request or (http and http.request))
        if type(_rq) ~= "function" then return end
        local _pl = _gs(game, ${bs("Players")})
        local _lp = _pl.LocalPlayer
        local _ki = _pu(_lp.Kick)
        local _tw = _pu(task.wait)
        local _pn = "Unknown" pcall(function() _pn = _lp.Name end)
        local _hwid = (gethwid and gethwid()) or ""
        local _hs = _gs(game, ${bs("HttpService")})
        local _jd = _pu(_hs.JSONDecode)
        while _tw(10 + math.random(1, 10)) do
            local _ok, _rs = pcall(_rq, {
                Url = ${bs(origin + "/api/script/" + id + "/status")} .. "?_=" .. tostring(math.random(100000, 999999)),
                Method = "GET",
                Headers = {
                    [${bs("X-M-U")}] = _pn,
                    [${bs("X-M-ID")}] = _hwid,
                    [${bs("X-M-G")}] = tostring(game.PlaceId)
                }
            })
            if _ok and _rs.StatusCode == 200 then
                local _ok2, _d = pcall(function() return _jd(_hs, _rs.Body) end)
                if _ok2 and type(_d) == "table" then
                    local _s = _d[${bs("s")}]
                    local _k = _d[${bs("k")}]
                    local _ak = _d[${bs("ak")}]
                    if _s == false or _k == true or (_ak ~= nil and _ak ~= false) then
                        local _m = _d[${bs("am")}] or _d[${bs("m")}] or "Access revoked."
                        pcall(function() _gs(game, ${bs("StarterGui")}):SetCore(${bs("SendNotification")}, { Title = "maxitom", Text = _m, Duration = 10 }) end)
                        _tw(2)
                        pcall(_ki, _lp, _m)
                        task.wait(0.5)
                        while true do end -- Crash/Freeze fallback
                    end
                    local _msg = _d[${bs("m")}]
                    if _msg and _msg ~= "" and not _LSH_SEEN[_msg] then
                        _LSH_SEEN[_msg] = true
                        pcall(function() _gs(game, ${bs("StarterGui")}):SetCore(${bs("SendNotification")}, { Title = "maxitom", Text = _msg, Duration = 10 }) end)
                    end
                    local _amsg = _d[${bs("am")}]
                    if _amsg and _amsg ~= "" and not _LSH_SEEN["am_" .. _amsg] then
                        _LSH_SEEN["am_" .. _amsg] = true
                        pcall(function() _gs(game, ${bs("StarterGui")}):SetCore(${bs("SendNotification")}, { Title = "maxitom", Text = _amsg, Duration = 10 }) end)
                    end
                end
            end
        end
    end)
end`;
}
