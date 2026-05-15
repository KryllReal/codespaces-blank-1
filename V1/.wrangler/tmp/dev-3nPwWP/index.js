var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// .wrangler/tmp/bundle-Nh9mrb/checked-fetch.js
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
var urls;
var init_checked_fetch = __esm({
  ".wrangler/tmp/bundle-Nh9mrb/checked-fetch.js"() {
    urls = /* @__PURE__ */ new Set();
    __name(checkURL, "checkURL");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        const [request, init] = argArray;
        checkURL(request, init);
        return Reflect.apply(target, thisArg, argArray);
      }
    });
  }
});

// .wrangler/tmp/bundle-Nh9mrb/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
var init_strip_cf_connecting_ip_header = __esm({
  ".wrangler/tmp/bundle-Nh9mrb/strip-cf-connecting-ip-header.js"() {
    __name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        return Reflect.apply(target, thisArg, [
          stripCfConnectingIPHeader.apply(null, argArray)
        ]);
      }
    });
  }
});

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
  }
});

// node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// src/utils/crypto.js
var crypto_exports = {};
__export(crypto_exports, {
  aesEncryptCTR: () => aesEncryptCTR,
  generateDynamicToken: () => generateDynamicToken,
  generateLaunchToken: () => generateLaunchToken,
  generateScopedToken: () => generateScopedToken,
  generateTOTPSecret: () => generateTOTPSecret,
  hashIP: () => hashIP,
  hashPassword: () => hashPassword,
  verifyAuthenticator: () => verifyAuthenticator,
  verifyTOTP: () => verifyTOTP,
  xorEncryptToBase64: () => xorEncryptToBase64,
  xxteaEncrypt: () => xxteaEncrypt
});
async function generateScopedToken(scriptId, timestamp, scope, secret) {
  const enc = new TextEncoder();
  const data = enc.encode(`${scriptId}:${scope}:${timestamp}`);
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function generateDynamicToken(scriptId, timestamp, secret) {
  return generateScopedToken(scriptId, timestamp, "auth", secret);
}
async function generateLaunchToken(scriptId, timestamp, secret) {
  return generateScopedToken(scriptId, timestamp, "launch", secret);
}
function xorEncryptToBase64(plaintext, key) {
  const textBytes = new TextEncoder().encode(plaintext);
  const keyBytes = new TextEncoder().encode(key);
  const result = new Uint8Array(textBytes.length);
  for (let i = 0; i < textBytes.length; i++) {
    result[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return uint8ToBase64(result);
}
async function aesEncryptCTR(plaintext, keyString) {
  return xorEncryptToBase64(plaintext, keyString);
}
async function verifyAuthenticator(request, scriptId, secret) {
  const auth = request.headers.get("X-M-A") || request.headers.get("Authorization");
  if (!auth || !auth.includes("."))
    return false;
  const [ts, sig] = auth.split(".");
  const timestamp = parseInt(ts);
  if (isNaN(timestamp) || Math.abs(Date.now() - timestamp) > 12e4)
    return false;
  const expected = await generateDynamicToken(scriptId, ts, secret);
  return sig === expected;
}
async function verifyTOTP(secret, code) {
  if (!secret || !code)
    return false;
  const key = decodeBase32(secret);
  const epoch = Math.floor(Date.now() / 1e3);
  const counter = Math.floor(epoch / 30);
  for (let i = -1; i <= 1; i++) {
    const expected = await generateHOTP(key, counter + i);
    if (expected === code)
      return true;
  }
  return false;
}
async function generateHOTP(keyBuffer, counter) {
  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  view.setBigUint64(0, BigInt(counter), false);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, counterBuffer);
  const hmac = new Uint8Array(signature);
  const offset = hmac[hmac.length - 1] & 15;
  const binary = (hmac[offset] & 127) << 24 | (hmac[offset + 1] & 255) << 16 | (hmac[offset + 2] & 255) << 8 | hmac[offset + 3] & 255;
  return (binary % 1e6).toString().padStart(6, "0");
}
function decodeBase32(s) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  s = s.toUpperCase().replace(/=+$/, "");
  let bits = 0, value = 0, index = 0;
  const output = new Uint8Array(s.length * 5 / 8 | 0);
  for (let i = 0; i < s.length; i++) {
    value = value << 5 | alphabet.indexOf(s[i]);
    bits += 5;
    if (bits >= 8) {
      output[index++] = value >>> bits - 8 & 255;
      bits -= 8;
    }
  }
  return output.buffer;
}
function generateTOTPSecret() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map((x) => chars[x % chars.length]).join("");
}
function xxteaEncrypt(plaintext, keyString) {
  const key = strToUint32(keyString.padEnd(16, "\0").substring(0, 16));
  const data = strToUint32(plaintext);
  if (data.length === 0)
    return "";
  if (data.length === 1)
    data.push(0);
  const n = data.length;
  let z = data[n - 1];
  let y = data[0];
  const delta = 2654435769;
  let q = Math.floor(6 + 52 / n);
  let sum = 0;
  while (q-- > 0) {
    sum = sum + delta | 0;
    const e = sum >>> 2 & 3;
    for (let p = 0; p < n - 1; p++) {
      y = data[p + 1];
      z = data[p] = data[p] + ((z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4) ^ (sum ^ y) + (key[p & 3 ^ e] ^ z)) | 0;
    }
    y = data[0];
    z = data[n - 1] = data[n - 1] + ((z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4) ^ (sum ^ y) + (key[n - 1 & 3 ^ e] ^ z)) | 0;
  }
  return uint8ToBase64(uint32ToUint8(data));
}
function strToUint32(s) {
  const bytes = new TextEncoder().encode(s);
  const n = Math.ceil(bytes.length / 4);
  const uint32 = new Uint32Array(n);
  for (let i = 0; i < bytes.length; i++) {
    uint32[i >>> 2] |= bytes[i] << ((i & 3) << 3);
  }
  return Array.from(uint32);
}
function uint32ToUint8(uint32) {
  const res = new Uint8Array(uint32.length * 4);
  for (let i = 0; i < uint32.length; i++) {
    res[i * 4] = uint32[i] & 255;
    res[i * 4 + 1] = uint32[i] >>> 8 & 255;
    res[i * 4 + 2] = uint32[i] >>> 16 & 255;
    res[i * 4 + 3] = uint32[i] >>> 24 & 255;
  }
  return res;
}
function uint8ToBase64(uint8) {
  let binary = "";
  for (let i = 0; i < uint8.length; i += 8192) {
    binary += String.fromCharCode(...uint8.subarray(i, Math.min(i + 8192, uint8.length)));
  }
  return btoa(binary);
}
async function hashPassword(password) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(password));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashIP(ip) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-1", enc.encode(ip + "maxitom_salt_9283"));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
}
var init_crypto = __esm({
  "src/utils/crypto.js"() {
    init_checked_fetch();
    init_strip_cf_connecting_ip_header();
    init_modules_watch_stub();
    __name(generateScopedToken, "generateScopedToken");
    __name(generateDynamicToken, "generateDynamicToken");
    __name(generateLaunchToken, "generateLaunchToken");
    __name(xorEncryptToBase64, "xorEncryptToBase64");
    __name(aesEncryptCTR, "aesEncryptCTR");
    __name(verifyAuthenticator, "verifyAuthenticator");
    __name(verifyTOTP, "verifyTOTP");
    __name(generateHOTP, "generateHOTP");
    __name(decodeBase32, "decodeBase32");
    __name(generateTOTPSecret, "generateTOTPSecret");
    __name(xxteaEncrypt, "xxteaEncrypt");
    __name(strToUint32, "strToUint32");
    __name(uint32ToUint8, "uint32ToUint8");
    __name(uint8ToBase64, "uint8ToBase64");
    __name(hashPassword, "hashPassword");
    __name(hashIP, "hashIP");
  }
});

// .wrangler/tmp/bundle-Nh9mrb/middleware-loader.entry.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// .wrangler/tmp/bundle-Nh9mrb/middleware-insertion-facade.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// src/index.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// src/shared/router.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var Router = class {
  constructor() {
    this.routes = [];
  }
  add(method, path, handler) {
    const pattern = path.replace(/\//g, "\\/").replace(/:(\w+)/g, "(?<$1>[^/]+)");
    const regex = new RegExp(`^${pattern}$`);
    this.routes.push({ method, regex, handler });
  }
  async handle(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    for (const route of this.routes) {
      if (route.method !== method && route.method !== "ALL")
        continue;
      const match = path.match(route.regex);
      if (match) {
        const params = match.groups || {};
        return await route.handler(request, env, ctx, params);
      }
    }
    return null;
  }
};
__name(Router, "Router");

// src/handlers.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// src/utils/constants.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var MAX_SCRIPT_SIZE = 500 * 1024;

// src/shared/constants.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var ALLOWED_ORIGINS = [
  // Add your own domains here if you host frontend elsewhere
];
var secureHeaders = {
  "Content-Security-Policy": "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com; worker-src 'self' blob:; font-src *;",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store, max-age=0"
};

// src/utils/state.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var statusCache = /* @__PURE__ */ new Map();
var usedTokens = /* @__PURE__ */ new Set();
var loginAttempts = /* @__PURE__ */ new Map();

// src/shared/utils.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const ok = ALLOWED_ORIGINS.some((o) => {
    if (origin === o)
      return true;
    const domain = o.replace("https://", "");
    return origin.endsWith(`.${domain}`) || origin === `https://${domain}`;
  });
  return {
    "Access-Control-Allow-Origin": ok ? origin : "null",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-M-A, X-M-K, X-M-Ts, X-M-T, X-M-Op, X-M-ID, X-M-U, X-M-G, Exploit-Guid, Identifier, HWID",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin"
  };
}
__name(getCorsHeaders, "getCorsHeaders");
function json(data, status = 200, extraHeaders = {}, request = null) {
  const cors2 = request ? getCorsHeaders(request) : {};
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...secureHeaders, ...cors2, ...extraHeaders }
  });
}
__name(json, "json");
function text(t, status = 200, extraHeaders = {}, request = null) {
  const cors2 = request ? getCorsHeaders(request) : {};
  return new Response(t, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...cors2, ...extraHeaders }
  });
}
__name(text, "text");

// src/utils/utils.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// src/utils/users.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var MANUAL_USERS = {
  "admin": {
    password: "testpassword",
    disabled: false
  }
};

// src/utils/utils.js
init_crypto();
function getAdminKey(env) {
  return env.ADMIN_KEY;
}
__name(getAdminKey, "getAdminKey");
function generateId(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++)
    result += chars[randomValues[i] % chars.length];
  return result;
}
__name(generateId, "generateId");
function generateSessionId() {
  return generateId(32);
}
__name(generateSessionId, "generateSessionId");
async function isAdmin(request, env) {
  const url = new URL(request.url);
  const queryKey = url.searchParams.get("key") || url.searchParams.get("admin_key");
  if (queryKey && env.ADMIN_KEY && queryKey === env.ADMIN_KEY) {
    return { admin_name: "admin", isMaster: true };
  }
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session_id=([^;]+)/);
  if (!match)
    return null;
  const sessionId = match[1];
  const session = await env.DB.prepare(`
        SELECT s.*, a.disabled as admin_disabled, a.avatar 
        FROM sessions s 
        LEFT JOIN admins a ON s.admin_name = a.username 
        WHERE s.id = ?
    `).bind(sessionId).first();
  if (!session || session.expires_at < Date.now())
    return null;
  if (session.admin_disabled)
    return null;
  if (MANUAL_USERS[session.admin_name] && MANUAL_USERS[session.admin_name].disabled)
    return null;
  if (Math.random() < 0.02) {
    env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ?`).bind(Date.now()).run().catch(() => {
    });
  }
  return session;
}
__name(isAdmin, "isAdmin");
async function verifyPassword(username, adminKey, env) {
  let user = null;
  if (username === "admin" && adminKey === getAdminKey(env)) {
    user = { username: "admin", isStatic: true, totp_enabled: 0 };
  } else if (MANUAL_USERS[username]) {
    if (!MANUAL_USERS[username].disabled && MANUAL_USERS[username].password === adminKey) {
      user = { username, ...MANUAL_USERS[username], isStatic: true, totp_enabled: 0 };
    }
  }
  try {
    const row = await env.DB.prepare(`SELECT * FROM admins WHERE username = ?`).bind(username).first();
    if (row) {
      if (row.disabled)
        return { valid: false };
      if (user) {
        user.totp_enabled = row.totp_enabled;
        user.totp_secret = row.totp_secret;
      } else {
        const h = await hashPassword(adminKey);
        if (h === row.password_hash) {
          user = { ...row, isStatic: false };
        }
      }
    }
  } catch (e) {
    console.error("Auth DB Error:", e);
  }
  if (user)
    return { valid: true, user };
  return { valid: false };
}
__name(verifyPassword, "verifyPassword");
function checkLoginRateLimit(ip) {
  if (!ip)
    return true;
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry) {
    if (now > entry.resetTime) {
      loginAttempts.set(ip, { count: 1, resetTime: now + 6e4 });
      return true;
    }
    if (entry.count >= 5)
      return false;
    entry.count++;
    return true;
  }
  loginAttempts.set(ip, { count: 1, resetTime: now + 6e4 });
  return true;
}
__name(checkLoginRateLimit, "checkLoginRateLimit");
async function recordStats(env, script, request, ctx) {
  await env.DB.prepare(`UPDATE scripts SET views = views + 1, executions = executions + 1 WHERE id = ?`).bind(script.id).run();
  if (env.ADMIN_LOG_WEBHOOK) {
    const ip = request.headers.get("CF-Connecting-IP") || "Unknown IP";
    const country = request.cf?.country || "Unknown";
    const user = request.headers.get("X-M-U") || "Unknown User";
    const hwid = request.headers.get("X-M-ID") || "Unknown HWID";
    const gameId = request.headers.get("X-M-G");
    let gameFieldValue = "Unknown";
    if (gameId && gameId !== "0") {
      gameFieldValue = `[Place ${gameId}](https://www.roblox.com/games/${gameId})`;
    } else if (gameId === "0") {
      gameFieldValue = "Studio / Unknown";
    }
    const embed = {
      title: `Script Executed: ${script.name}`,
      color: 5793266,
      fields: [
        { name: "Who (User)", value: user, inline: true },
        { name: "Who (HWID)", value: hwid, inline: true },
        { name: "Where (IP / Country)", value: `${ip} (${country})`, inline: false },
        { name: "What Game", value: gameFieldValue, inline: false },
        { name: "When", value: `<t:${Math.floor(Date.now() / 1e3)}:f>`, inline: false }
      ],
      footer: { text: "maxitom Script Hub" }
    };
    const webhookPromise = fetch(env.ADMIN_LOG_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    }).catch((e) => console.error("Webhook error", e));
    if (ctx)
      ctx.waitUntil(webhookPromise);
  }
}
__name(recordStats, "recordStats");

// src/handlers.js
init_crypto();

// src/shared/ui.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
function getDetailedUI(title, message) {
  return `(function()
    local t, m = [=[${title}]=], [=[${message}]=]
    pcall(function()
        local sg = Instance.new("ScreenGui")
        sg.Name = "maxitomError"
        sg.ResetOnSpawn = false
        sg.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
        local f = Instance.new("Frame")
        f.Size = UDim2.new(0, 460, 0, 280)
        f.Position = UDim2.new(0.5, -230, 0.5, -140)
        f.BackgroundColor3 = Color3.fromRGB(12, 12, 12)
        f.BorderSizePixel = 0
        f.Parent = sg
        Instance.new("UICorner", f).CornerRadius = UDim.new(0, 10)
        local stroke = Instance.new("UIStroke", f)
        stroke.Color = Color3.fromRGB(40, 40, 40)
        stroke.Thickness = 1
        local title = Instance.new("TextLabel", f)
        title.Size = UDim2.new(1, -40, 0, 50)
        title.Position = UDim2.new(0, 20, 0, 5)
        title.BackgroundTransparency = 1
        title.Text = t
        title.TextColor3 = Color3.fromRGB(255, 70, 70)
        title.TextSize = 20
        title.Font = Enum.Font.GothamBold
        title.TextXAlignment = Enum.TextXAlignment.Left
        local scroll = Instance.new("ScrollingFrame", f)
        scroll.Size = UDim2.new(1, -40, 1, -120)
        scroll.Position = UDim2.new(0, 20, 0, 60)
        scroll.BackgroundTransparency = 1
        scroll.BorderSizePixel = 0
        scroll.CanvasSize = UDim2.new(0, 0, 0, 0)
        scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
        scroll.ScrollBarThickness = 3
        scroll.ScrollBarImageColor3 = Color3.fromRGB(50, 50, 50)
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
        close.Size = UDim2.new(0, 110, 0, 38)
        close.Position = UDim2.new(1, -130, 1, -50)
        close.BackgroundColor3 = Color3.fromRGB(22, 22, 22)
        close.Text = "Dismiss"
        close.TextColor3 = Color3.fromRGB(255, 255, 255)
        close.Font = Enum.Font.GothamMedium
        close.TextSize = 14
        Instance.new("UICorner", close).CornerRadius = UDim.new(0, 8)
        local bStroke = Instance.new("UIStroke", close)
        bStroke.Color = Color3.fromRGB(45, 45, 45)
        close.MouseButton1Click:Connect(function() sg:Destroy() end)
        sg.Parent = (gethui and gethui()) or (game:GetService("CoreGui")) or (game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui"))
    end)
end)()`;
}
__name(getDetailedUI, "getDetailedUI");

// src/ui/ui.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();

// src/core/vm.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
function bs(str) {
  return "string.char(" + str.split("").map((c) => c.charCodeAt(0)).join(",") + ")";
}
__name(bs, "bs");
function getRVMRuntime(ops) {
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
__name(getRVMRuntime, "getRVMRuntime");
function getSecureLoader(url, ts, hash, getStopUI2, getRVMRuntime2) {
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
    local _rvm = ${getRVMRuntime2({ GETG: 1, GETF: 2, PUSH: 3, CALL: 4, EXEC: 5 })}
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
__name(getSecureLoader, "getSecureLoader");
function getLauncher(url, ts, hash, getStopUI2) {
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
    ${getStopUI2()}
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
__name(getLauncher, "getLauncher");
function getKillSwitch(id, origin) {
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
__name(getKillSwitch, "getKillSwitch");

// src/ui/ui.js
function getStopUI() {
  const asciiBlock = `
-- \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 
-- \u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557
-- \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557   \u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D
-- \u255A\u2550\u2550\u2550\u2550\u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u255D 
-- \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551   \u2588\u2588\u2551   \u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551     
-- \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D   \u255A\u2550\u255D    \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u255D`;
  const wall = Array(150).fill(asciiBlock).join("\\n\\n");
  return `${wall}\\n\\nwhile true do end`;
}
__name(getStopUI, "getStopUI");
function getKeySystemUI(id, origin, customUrl) {
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
__name(getKeySystemUI, "getKeySystemUI");
function getScriptPortalHTML(s, statuses) {
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
            ${statuses.map((st) => `
                <div class="badge" style="background:${st.color}10; color:${st.color}; border:1px solid ${st.color}20">
                    ${st.label}
                </div>
            `).join("")}
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
__name(getScriptPortalHTML, "getScriptPortalHTML");
function getErrorPortalHTML(title, message, status) {
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
__name(getErrorPortalHTML, "getErrorPortalHTML");

// src/ui/dashboard.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
function getAdminDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>maxitom \u2014 Admin Manager</title>
    <meta name="robots" content="noindex, nofollow">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg: #09090b; --bg2: #111113; --bg3: #18181b;
            --border: #27272a; --text: #fafafa; --text2: #a1a1aa;
            --muted: #52525b; --accent: #fafafa; --success: #22c55e;
            --error: #ef4444; --radius: 10px;
        }
        body { background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; font-size: 14px; -webkit-font-smoothing: antialiased; }
        .hidden { display: none !important; }
        .login-overlay { position: fixed; inset: 0; background: var(--bg); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
        .login-box { max-width: 340px; width: 100%; padding: 2.5rem; background: var(--bg2); border: 1px solid var(--border); border-radius: 16px; }
        .login-box h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: .25rem; letter-spacing: -0.03em; }
        .login-box p { color: var(--muted); font-size: .8rem; margin-bottom: 1.75rem; font-weight: 500; }
        .login-box input { width: 100%; padding: .7rem .85rem; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); font-size: .85rem; margin-bottom: .75rem; color: var(--text); font-family: inherit; }
        .login-box button { width: 100%; padding: .7rem; background: var(--text); color: var(--bg); border: none; border-radius: var(--radius); font-weight: 600; cursor: pointer; font-size: .85rem; }
        .login-error { color: var(--error); font-size: .8rem; margin-top: .75rem; text-align: center; font-weight: 500; }
        .header { padding: 0 1.5rem; height: 52px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); background: var(--bg); position: sticky; top: 0; z-index: 100; }
        .logo { font-size: 1rem; font-weight: 700; letter-spacing: -0.03em; color: var(--accent); }
        .logout-btn { padding: .35rem .85rem; background: transparent; border: 1px solid var(--border); border-radius: 6px; font-size: .8rem; font-weight: 500; cursor: pointer; color: var(--muted); transition: all .15s; }
        .logout-btn:hover { color: var(--error); border-color: rgba(239,68,68,.3); }
        .main { max-width: 800px; margin: 0 auto; padding: 2.5rem 1.5rem; }
        .section-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
        .section-title { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; }
        .grid { display: flex; flex-direction: column; gap: 0.75rem; }
        .card { background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; transition: all .15s; }
        .card:hover { border-color: var(--muted); background: var(--bg3); }
        .card-info { display: flex; flex-direction: column; gap: 0.25rem; }
        .card-name { font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
        .badge { font-size: 0.6rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid transparent; }
        .badge-static { background: rgba(59,130,246,0.1); color: #60a5fa; border-color: rgba(96,165,250,0.2); }
        .badge-db { background: rgba(168,85,247,0.1); color: #c084fc; border-color: rgba(192,132,252,0.2); }
        .badge-disabled { background: rgba(239,68,68,0.1); color: #f87171; border-color: rgba(248,113,113,0.2); }
        .badge-active { background: rgba(34,197,94,0.1); color: #4ade80; border-color: rgba(74,222,128,0.2); }
        .card-actions { display: flex; gap: 0.5rem; }
        .btn { padding: 0.45rem 0.85rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: var(--bg); color: var(--text); transition: all .15s; }
        .btn:hover { border-color: var(--muted); }
        .btn-primary { background: var(--text); color: var(--bg); border-color: var(--text); }
        .btn-danger { color: var(--error); border-color: rgba(239,68,68,0.3); }
        .btn-sm { padding: 0.35rem 0.75rem; font-size: 0.75rem; }
        .form-group { margin-bottom: 1.25rem; }
        .form-label { display: block; font-size: 0.7rem; font-weight: 600; color: var(--muted); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .form-input { width: 100%; padding: 0.75rem; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; font-size: 0.85rem; color: var(--text); font-family: inherit; }
        .form-input:focus { outline: none; border-color: var(--muted); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 500; display: none; align-items: center; justify-content: center; padding: 1.5rem; }
        .modal-overlay.active { display: flex; }
        .modal { background: var(--bg2); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 360px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        .modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .modal-title { font-size: 1rem; font-weight: 700; }
        .modal-close { background: transparent; border: none; font-size: 1.5rem; cursor: pointer; color: var(--muted); }
        .modal-body { padding: 1.5rem; }
        .toast-container { position: fixed; bottom: 2rem; right: 2rem; z-index: 1001; display: flex; flex-direction: column; gap: 0.75rem; }
        .toast { padding: 0.75rem 1.25rem; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; font-size: 0.85rem; font-weight: 600; animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        @keyframes toastIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .toast.success { border-left: 4px solid var(--success); }
        .toast.error { border-left: 4px solid var(--error); }
        .empty { text-align: center; padding: 5rem 0; color: var(--muted); font-weight: 500; font-size: 0.9rem; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.8; } }
        .gz-orbit { stroke: rgba(59, 130, 246, 0.5); }
        .gz-node { fill: #10b981; stroke: #059669; }
        .gz-node-alt { fill: #3b82f6; stroke: #2563eb; }
        .bg-logo-container {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80vw;
            height: 80vw;
            max-width: 900px;
            max-height: 900px;
            opacity: 0.05;
            pointer-events: none;
            z-index: -1;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .bg-logo-container svg { width: 100%; height: 100%; animation: rotate 120s linear infinite; }
        .gz-orbit { animation: pulse 8s ease-in-out infinite; transform-origin: center; }
        .gz-node, .gz-node-alt { animation: pulse 4s ease-in-out infinite; transform-origin: center; }
    </style>
</head>
<body>
    <div class="bg-logo-container">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle class="gz-orbit" cx="16" cy="16" r="15" stroke="black" stroke-width="1" stroke-dasharray="2 4" opacity="0.2"/>
            <circle cx="16" cy="16" r="13" stroke="black" stroke-width="2"/>
            <path d="M10 10H22L10 22H22" stroke="black" stroke-width="3" stroke-linecap="square" stroke-linejoin="bevel"/>
            <circle class="gz-node" cx="10" cy="10" r="1.5" fill="white" stroke="black" stroke-width="1"/>
            <circle class="gz-node-alt" cx="22" cy="22" r="1.5" fill="white" stroke="black" stroke-width="1"/>
            <circle class="gz-zen-core" cx="16" cy="16" r="2.5" fill="black"/>
        </svg>
    </div>
    <div class="login-overlay" id="loginOverlay">
        <div class="login-box" id="loginBox">
            <h1>maxitom</h1>
            <p>Administration Portal</p>
            <input type="text" id="usernameInput" placeholder="Username" autocomplete="username">
            <input type="password" id="adminKeyInput" placeholder="Password" autocomplete="current-password">
            <button id="loginBtn">Sign In</button>
            <div class="login-error hidden" id="loginError"></div>
        </div>
        <!-- 2FA Step -->
        <div class="login-box hidden" id="twoFactorBox">
            <h1>Identity Verification</h1>
            <p>Please enter the 6-digit code from your authenticator app.</p>
            <input type="text" id="totpInput" placeholder="000000" maxlength="6" style="text-align:center; font-size: 1.5rem; letter-spacing: 0.5rem; font-family: monospace;">
            <button id="verify2FABtn">Verify & Continue</button>
            <div class="login-error hidden" id="totpError"></div>
        </div>
    </div>
    <div class="app hidden" id="app">
        <header class="header">
            <div class="logo">maxitom</div>
            <button class="logout-btn" id="logoutBtn">Sign Out</button>
        </header>
        <main class="main">
            <div class="section-header">
                <span class="section-title">System Administrators</span>
                <button class="btn btn-sm btn-primary" id="openAddAdminBtn">Add Admin</button>
            </div>
            <div class="grid" id="adminsGrid"></div>
        </main>
    </div>
    <!-- Modals -->
    <div class="modal-overlay" id="addAdminModal">
        <div class="modal">
            <div class="modal-header"><span class="modal-title">New Admin</span><button class="modal-close" onclick="closeModals()">&times;</button></div>
            <div class="modal-body">
                <form id="addAdminForm">
                    <div class="form-group"><label class="form-label">Username</label><input class="form-input" id="new-user" required></div>
                    <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="new-pass" type="password" required></div>
                    <button type="submit" class="btn btn-primary" style="width:100%;padding:0.75rem;">Create Account</button>
                </form>
            </div>
        </div>
    </div>
    <div class="modal-overlay" id="passModal">
        <div class="modal">
            <div class="modal-header"><span class="modal-title">Change Password</span><button class="modal-close" onclick="closeModals()">&times;</button></div>
            <div class="modal-body">
                <form id="passForm">
                    <input type="hidden" id="pass-user">
                    <div class="form-group"><label class="form-label" id="pass-label">New Password</label><input class="form-input" id="pass-input" type="password" required></div>
                    <button type="submit" class="btn btn-primary" style="width:100%;padding:0.75rem;">Update Password</button>
                </form>
            </div>
        </div>
    </div>
    <!-- 2FA Setup Modal -->
    <div class="modal-overlay" id="totpSetupModal">
        <div class="modal">
            <div class="modal-header"><span class="modal-title">Secure Account</span><button class="modal-close" onclick="closeModals()">&times;</button></div>
            <div class="modal-body" style="text-align:center;">
                <p style="color:var(--text2); font-size: 0.85rem; margin-bottom: 1.5rem;">Scan this QR code in Google Authenticator or Authy.</p>
                <div id="totpQr" style="background:#fff; padding:1rem; border-radius:12px; display:inline-block; margin-bottom: 1.5rem;">
                    <!-- QR Placeholder -->
                    <img id="qrImg" src="" style="width:200px; height:200px;">
                </div>
                <div class="form-group" style="text-align:left;">
                    <label class="form-label">Secret Key (Manual)</label>
                    <input class="form-input" id="totpSecret" readonly style="font-family:monospace; text-align:center;">
                </div>
                <div class="form-group" style="text-align:left;">
                    <label class="form-label">Verify Code</label>
                    <input class="form-input" id="totpConfirm" placeholder="Enter 6-digit code">
                </div>
                <button id="confirm2FABtn" class="btn btn-primary" style="width:100%;padding:0.75rem;">Enable 2FA</button>
            </div>
        </div>
    </div>
    <div class="toast-container" id="toasts"></div>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            validateSession();
            document.getElementById('loginBtn').onclick = login;
            document.getElementById('logoutBtn').onclick = logout;
            document.getElementById('openAddAdminBtn').onclick = () => document.getElementById('addAdminModal').classList.add('active');
            document.getElementById('addAdminForm').onsubmit = async e => {
                e.preventDefault();
                const r = await fetch('/api/admins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: document.getElementById('new-user').value, password: document.getElementById('new-pass').value }) });
                const j = await r.json();
                if (j.success) { toast('Admin created'); closeModals(); loadAdmins(); e.target.reset(); } else toast(j.error || 'Error', 'error');
            };
            document.getElementById('passForm').onsubmit = async e => {
                e.preventDefault();
                const user = document.getElementById('pass-user').value;
                const r = await fetch('/api/admins/' + encodeURIComponent(user) + '/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: document.getElementById('pass-input').value }) });
                if (r.ok) { toast('Password updated'); closeModals(); e.target.reset(); } else toast('Error updating password', 'error');
            };
            document.body.addEventListener('click', e => {
                const btn = e.target;
                if (btn.dataset.toggle) toggleAdmin(btn.dataset.toggle);
                if (btn.dataset.pass) {
                    document.getElementById('pass-user').value = btn.dataset.pass;
                    document.getElementById('pass-label').textContent = 'New Password for ' + btn.dataset.pass;
                    document.getElementById('passModal').classList.add('active');
                }
                if (btn.dataset.totp) setup2FA(btn.dataset.totp);
            });
        });
        async function setup2FA() {
            const r = await fetch('/api/auth/2fa/setup', { method: 'POST' });
            const data = await r.json();
            if (data.success) {
                document.getElementById('qrImg').src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(data.qrUrl);
                document.getElementById('totpSecret').value = data.secret;
                document.getElementById('totpSetupModal').classList.add('active');
            }
        }
        document.getElementById('confirm2FABtn').onclick = async () => {
            const code = document.getElementById('totpConfirm').value;
            const r = await fetch('/api/auth/2fa/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            if (r.ok) { toast('2FA Enabled Successfully'); closeModals(); loadAdmins(); } else toast('Invalid code', 'error');
        };
        async function login() {
            const username = document.getElementById('usernameInput').value;
            const adminKey = document.getElementById('adminKeyInput').value;
            const r = await fetch('/api/login', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ username, adminKey }) 
            });
            const data = await r.json();
            if (r.ok) {
                if (data.twoFactorRequired) {
                    window.currentUsername = username;
                    window.attemptToken = data.attemptToken;
                    document.getElementById('loginBox').classList.add('hidden');
                    document.getElementById('twoFactorBox').classList.remove('hidden');
                } else {
                    showApp();
                }
            } else {
                showError(data.error || 'Invalid credentials');
            }
        }
        document.getElementById('verify2FABtn').onclick = async () => {
            const code = document.getElementById('totpInput').value;
            const r = await fetch('/api/auth/2fa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: window.currentUsername, attemptToken: window.attemptToken, code })
            });
            if (r.ok) showApp(); else {
                const el = document.getElementById('totpError');
                el.textContent = 'Invalid verification code';
                el.classList.remove('hidden');
            }
        };
        async function validateSession() { const r = await fetch('/api/checkAuth'); if (r.ok) showApp(); }
        async function logout() { await fetch('/api/logout', { method: 'POST' }); location.reload(); }
        function showError(msg) { const el = document.getElementById('loginError'); el.textContent = msg; el.classList.remove('hidden'); }
        function showApp() { document.getElementById('loginOverlay').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); loadAdmins(); }
        async function loadAdmins() {
            const r = await fetch('/api/admins');
            if (!r.ok) return;
            const { admins } = await r.json();
            document.getElementById('adminsGrid').innerHTML = admins.map(a => {
                const statusBadge = a.disabled ? '<span class="badge badge-disabled">Suspended</span>' : '<span class="badge badge-active">Active</span>';
                const sourceBadge = a.isStatic ? '<span class="badge badge-static">users.js</span>' : '<span class="badge badge-db">Database</span>';
                const totpBadge = a.totp_enabled ? '<span class="badge badge-active" style="background:rgba(16,185,129,0.1);color:#10b981;border-color:rgba(16,185,129,0.2)">2FA Active</span>' : '';
                const actions = (a.username === 'admin' || a.isStatic) 
                    ? \`<button class="btn btn-sm" \${a.totp_enabled ? 'disabled style="opacity:0.5"' : 'data-totp="true"'}>\${a.totp_enabled ? 'Protected' : 'Shield Account'}</button>\` 
                    : \`<button class="btn btn-sm" data-pass="\${a.username}">Pass</button>
                       <button class="btn btn-sm \${a.disabled ? 'btn-primary' : 'btn-danger'}" data-toggle="\${a.username}">\${a.disabled ? 'Restore' : 'Suspend'}</button>\`;
                return \`<div class="card">
                    <div class="card-info">
                        <div class="card-name">\${esc(a.username)} \${statusBadge} \${totpBadge}</div>
                        <div style="display:flex;gap:0.4rem">\${sourceBadge}</div>
                    </div>
                    <div class="card-actions">\${actions}</div>
                </div>\`;
            }).join('') || '<div class="empty">No administrators found.</div>';
        }
        async function toggleAdmin(username) {
            const r = await fetch('/api/admins/' + encodeURIComponent(username) + '/toggle', { method: 'POST' });
            if (r.ok) loadAdmins(); else toast('Operation failed', 'error');
        }
        function closeModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); }
        function toast(msg, type) { 
            const t = document.createElement('div'); 
            t.className = 'toast ' + (type || 'success'); 
            t.textContent = msg; 
            document.getElementById('toasts').appendChild(t); 
            setTimeout(() => t.remove(), 2500); 
        }
        function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    <\/script>
</body>
</html>`;
}
__name(getAdminDashboardHTML, "getAdminDashboardHTML");

// src/shared/webhooks.js
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
async function sendWebhook(env, channelOrUrl, { title, description, color, fields, footer, components }) {
  const targetUrl = env.MAXITOM_LOG_WEBHOOK || env.DISCORD_WEBHOOK;
  if (!targetUrl || !targetUrl.startsWith("http")) {
    return null;
  }
  try {
    const payload = {
      embeds: [{
        title: title || "Network Activity",
        description: description || "",
        color: color || 6220500,
        fields: fields || [],
        footer: footer ? { text: footer } : { text: "Maxitom Telemetry" },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }]
    };
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[WEBHOOK_ERROR] ${response.status}: ${errorBody}`);
    }
    return response;
  } catch (e) {
    console.error("[WEBHOOK_EXCEPTION]", e);
    return null;
  }
}
__name(sendWebhook, "sendWebhook");

// src/handlers.js
async function handleLogin(request, env, ctx) {
  const ip = request.headers.get("X-Zen-Client-IP") || request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  if (!checkLoginRateLimit(ip)) {
    console.warn(`Login rate limit hit for IP: ${ip}`);
    return json({ error: "Too many login attempts. Try again later." }, 429, {}, request);
  }
  let username, adminKey;
  try {
    const body = await request.json();
    username = body.username;
    adminKey = body.adminKey;
  } catch (e) {
    return json({ error: "Invalid request body" }, 400, {}, request);
  }
  console.log(`Login attempt for user: ${username} from IP: ${ip}`);
  const { valid, user } = await verifyPassword(username, adminKey, env);
  if (!valid) {
    console.warn(`Invalid credentials for user: ${username}`);
    return json({ error: "Invalid credentials" }, 401, {}, request);
  }
  if (user.totp_enabled) {
    const attemptToken = "2FA_" + Math.random().toString(36).substring(2);
    await env.DB.prepare("INSERT INTO sessions (id, admin_name, expires_at) VALUES (?, ?, ?)").bind(attemptToken, username, Date.now() + 3e5).run();
    return json({
      success: true,
      twoFactorRequired: true,
      attemptToken
    }, 200, {}, request);
  }
  const sessionId = generateSessionId();
  const expiresAt = Date.now() + 24 * 60 * 60 * 1e3;
  await env.DB.prepare(`INSERT INTO sessions (id, expires_at, admin_name) VALUES (?, ?, ?)`).bind(sessionId, expiresAt, username).run();
  ctx.waitUntil(sendWebhook(env, "MAXITOM", {
    title: "Administrative Access",
    description: `Admin **${username}** has established a secure session with the Maxitom network.`,
    color: 5793266,
    fields: [
      { name: "Operator", value: `\`${username}\``, inline: true },
      { name: "Identity", value: `\`${ip}\``, inline: true },
      { name: "Location", value: `\`${request.cf?.city || "Unknown"}\`, \`${request.cf?.country || "Unknown"}\` (\`${request.cf?.colo || "UNK"}\`)`, inline: false }
    ],
    footer: `Maxitom \u2022 Session Active`
  }));
  const cookie = `session_id=${sessionId}; Path=/; HttpOnly; SameSite=None; Max-Age=86400; Secure`;
  return json({ success: true }, 200, { "Set-Cookie": cookie }, request);
}
__name(handleLogin, "handleLogin");
async function handleLogout(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session_id=([^;]+)/);
  if (match) {
    await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(match[1]).run();
  }
  const clearCookie = `session_id=; Path=/; HttpOnly; SameSite=None; Max-Age=0; Secure`;
  return json({ success: true }, 200, { "Set-Cookie": clearCookie }, request);
}
__name(handleLogout, "handleLogout");
async function handleCheckAuth(request, env) {
  const auth = await isAdmin(request, env);
  if (auth) {
    return json({
      authenticated: true,
      user: {
        username: auth.admin_name,
        avatar: auth.avatar || null
      }
    }, 200, {}, request);
  }
  return json({ error: "Unauthorized" }, 401, {}, request);
}
__name(handleCheckAuth, "handleCheckAuth");
async function handleStatus(id, request, env) {
  const rawIp = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const ip = await hashIP(rawIp);
  const user = request.headers.get("X-M-U") || "Unknown";
  const hwid = request.headers.get("X-M-ID") || "";
  const gameId = request.headers.get("X-M-G") || "Unknown";
  const nowMs = Date.now();
  let s;
  const cacheKey = `status:${id}`;
  const cachedStatus = statusCache.get(cacheKey);
  if (cachedStatus && nowMs - cachedStatus.timestamp < 5e3) {
    s = cachedStatus.data;
  } else {
    try {
      s = await env.DB.prepare(`SELECT is_enabled, remote_message, force_kick FROM scripts WHERE id = ?`).bind(id).first();
    } catch {
      s = await env.DB.prepare(`SELECT is_enabled, remote_message FROM scripts WHERE id = ?`).bind(id).first();
    }
    if (!s)
      return json({ error: "Not found" }, 404, {}, request);
    statusCache.set(cacheKey, { timestamp: nowMs, data: s });
  }
  let au = null;
  const isRoblox = (request.headers.get("User-Agent") || "").toLowerCase().includes("roblox");
  const isAuthentic = user !== "Unknown";
  if (isAuthentic) {
    const activeUserId = `${id}:${user}:${hwid || rawIp}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    try {
      await env.DB.prepare(`
                INSERT INTO active_users (id, script_id, username, hwid, ip, game_id, last_ping) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET 
                    last_ping = excluded.last_ping,
                    ip = excluded.ip,
                    hwid = COALESCE(excluded.hwid, active_users.hwid),
                    game_id = excluded.game_id
            `).bind(activeUserId, id, user, hwid || null, ip, gameId, now).run();
      const existing = await env.DB.prepare(`SELECT action_kick, action_message FROM active_users WHERE id = ?`).bind(activeUserId).first();
      if (existing) {
        au = existing;
        if (au.action_kick) {
          await env.DB.prepare(`UPDATE active_users SET action_kick = 0 WHERE id = ? AND action_kick = 1`).bind(activeUserId).run();
        }
        if (au.action_message) {
          await env.DB.prepare(`UPDATE active_users SET action_message = NULL WHERE id = ? AND action_message = ?`).bind(activeUserId, au.action_message).run();
        }
      }
    } catch (e) {
      console.error("Tracking error", e);
    }
  }
  const response = {
    s: !!s.is_enabled,
    m: s.remote_message || null,
    k: !!s.force_kick
  };
  if (au) {
    if (au.action_kick)
      response.ak = true;
    if (au.action_message)
      response.am = au.action_message;
  }
  if (Math.random() < 0.05) {
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1e3).toISOString();
    env.DB.prepare(`DELETE FROM active_users WHERE last_ping < ?`).bind(twoMinsAgo).run().catch(() => {
    });
  }
  return json(response, 200, {}, request);
}
__name(handleStatus, "handleStatus");
async function handleTicket(id, request, env) {
  const ip = request.headers.get("X-Zen-Client-IP") || request.headers.get("CF-Connecting-IP") || "127.0.0.1";
  const hwid = request.headers.get("X-M-ID") || "";
  const ticketId = generateId(24);
  await env.DB.prepare(`INSERT INTO checkpoint_tickets (id, script_id, hwid, ip) VALUES (?, ?, ?, ?)`).bind(ticketId, id, hwid, ip).run();
  return json({ ticket: ticketId }, 200, {}, request);
}
__name(handleTicket, "handleTicket");
async function handleCheckpoint(request, env) {
  const url = new URL(request.url);
  const scriptId = url.searchParams.get("s");
  const ticketId = url.searchParams.get("t");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!scriptId)
    return json({ error: "Missing script ID" }, 400, {}, request);
  if (!ticketId)
    return json({ error: "Unauthorized: No ticket provided." }, 403, {}, request);
  const ticket = await env.DB.prepare(`SELECT * FROM checkpoint_tickets WHERE id = ? AND script_id = ? AND is_used = 0`).bind(ticketId, scriptId).first();
  if (!ticket)
    return json({ error: "Invalid or expired ticket." }, 403, {}, request);
  const tempKey = "MAXI-" + generateId(4).toUpperCase() + "-" + generateId(4).toUpperCase();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE checkpoint_tickets SET is_used = 1 WHERE id = ?`).bind(ticketId),
    env.DB.prepare(`INSERT INTO temp_keys (id, script_id, key_value, ip, expires_at) VALUES (?, ?, ?, ?, ?)`).bind(generateId(16), scriptId, tempKey, ip, expiresAt)
  ]);
  return json({ success: true, key: tempKey }, 200, {}, request);
}
__name(handleCheckpoint, "handleCheckpoint");
async function handleMessage(id, request, env) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401, {}, request);
  const s = await env.DB.prepare(`SELECT id FROM scripts WHERE id = ? AND (owner = ? OR (owner IS NULL AND ? = 'admin'))`).bind(id, admin.admin_name, admin.admin_name).first();
  if (!s)
    return json({ error: "Not found" }, 404, {}, request);
  const { message } = await request.json();
  await env.DB.prepare(`UPDATE scripts SET remote_message = ? WHERE id = ?`).bind(message || null, id).run();
  statusCache.delete(`status:${id}`);
  return json({ success: true }, 200, {}, request);
}
__name(handleMessage, "handleMessage");
async function handleActiveUsers(request, env) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401, {}, request);
  const oneMinAgo = new Date(Date.now() - 1 * 60 * 1e3).toISOString();
  await env.DB.prepare(`DELETE FROM active_users WHERE last_ping < ?`).bind(oneMinAgo).run().catch(() => {
  });
  try {
    const result = await env.DB.prepare(`
            SELECT a.id, a.script_id, a.username, a.hwid, a.ip, a.game_id, a.last_ping, s.name as script_name
            FROM active_users a
            JOIN scripts s ON a.script_id = s.id
            WHERE (s.owner = ? OR (s.owner IS NULL AND ? = 'admin'))
            ORDER BY a.last_ping DESC
        `).bind(admin.admin_name, admin.admin_name).all();
    return json({ users: result.results || [] }, 200, {}, request);
  } catch {
    return json({ users: [] }, 200, {}, request);
  }
}
__name(handleActiveUsers, "handleActiveUsers");
async function handleUserAction(idRaw, request, env) {
  const id = decodeURIComponent(idRaw);
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401, {}, request);
  const scriptId = id.split(":")[0];
  const scriptCheck = await env.DB.prepare(`SELECT id FROM scripts WHERE id = ? AND (owner = ? OR (owner IS NULL AND ? = 'admin'))`).bind(scriptId, admin.admin_name, admin.admin_name).first();
  if (!scriptCheck)
    return json({ error: "Not found" }, 404, {}, request);
  const body = await request.json();
  statusCache.delete(`user:${id}`);
  const updates = [];
  const params = [];
  if (body.action === "kick") {
    updates.push("action_kick = 1");
    if (body.message && body.message.trim()) {
      updates.push("action_message = ?");
      params.push(body.message.trim());
    }
  } else if (body.action === "message") {
    updates.push("action_message = ?");
    params.push(body.message);
  } else {
    return json({ error: "Invalid action" }, 400, {}, request);
  }
  if (updates.length > 0) {
    params.push(id);
    const query = `UPDATE active_users SET ${updates.join(", ")} WHERE id = ?`;
    await env.DB.prepare(query).bind(...params).run();
    return json({ success: true }, 200, {}, request);
  }
  return json({ error: "No update made" }, 400, {}, request);
}
__name(handleUserAction, "handleUserAction");
async function handleUpload(request, env, ctx) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401, {}, request);
  const data = await request.json();
  if (!data.name?.trim() || !data.content?.trim())
    return json({ error: "Name and content required" }, 400, {}, request);
  if (data.content.length > MAX_SCRIPT_SIZE)
    return json({ error: "Script too large" }, 400, {}, request);
  const id = generateId();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await env.DB.prepare(`INSERT INTO scripts (id, name, content, description, category, created_at, updated_at, is_private, access_key, max_executions, expires_at, anti_skid, simple_protection, allowed_hwids, owner, use_adgate, is_enabled, key_system_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).bind(id, data.name.trim(), data.content, data.description || "", data.category || "general", now, now, data.isPrivate ? 1 : 0, data.accessKey || null, data.maxExecutions || null, data.expiresAt || null, data.antiSkid ? 1 : 0, data.simpleProtection ? 1 : 0, data.allowedHwids || null, admin.admin_name, data.useAdgate ? 1 : 0, data.keySystemUrl || null).run();
  ctx.waitUntil(sendWebhook(env, "MAXITOM", {
    title: "\u{1F4E6} New Script Upload",
    description: `A new script has been published to the Maxitom network.`,
    color: 1096065,
    fields: [
      { name: "Name", value: data.name, inline: true },
      { name: "ID", value: id, inline: true },
      { name: "Owner", value: admin.admin_name, inline: true }
    ],
    footer: `Maxitom \u2022 Registry Updated`
  }));
  return json({ success: true, id }, 200, {}, request);
}
__name(handleUpload, "handleUpload");
async function handleList(request, env) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401, {}, request);
  const result = await env.DB.prepare(`SELECT id, name, description, category, created_at, updated_at, views, executions, is_private, is_enabled, access_key, max_executions, expires_at, version, anti_skid, simple_protection, allowed_hwids, use_adgate, key_system_url FROM scripts WHERE (owner = ? OR (owner IS NULL AND ? = 'admin')) ORDER BY updated_at DESC`).bind(admin.admin_name, admin.admin_name).all();
  return json({ scripts: result.results.map((s) => ({ id: s.id, name: s.name, description: s.description, category: s.category, createdAt: s.created_at, updatedAt: s.updated_at, views: s.views, executions: s.executions, isPrivate: !!s.is_private, isEnabled: !!s.is_enabled, accessKey: s.access_key, maxExecutions: s.max_executions, expiresAt: s.expires_at, version: s.version, antiSkid: !!s.anti_skid, simpleProtection: !!s.simple_protection, allowedHwids: s.allowed_hwids, useAdgate: !!s.use_adgate, keySystemUrl: s.key_system_url })) }, 200, {}, request);
}
__name(handleList, "handleList");
async function handleGet(id, request, env) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401, {}, request);
  const s = await env.DB.prepare(`SELECT * FROM scripts WHERE id = ? AND (owner = ? OR (owner IS NULL AND ? = 'admin'))`).bind(id, admin.admin_name, admin.admin_name).first();
  if (!s)
    return json({ error: "Not found" }, 404, {}, request);
  return json({ id: s.id, name: s.name, content: s.content, description: s.description, category: s.category, createdAt: s.created_at, updatedAt: s.updated_at, views: s.views, executions: s.executions, isPrivate: !!s.is_private, isEnabled: !!s.is_enabled, accessKey: s.access_key, maxExecutions: s.max_executions, expiresAt: s.expires_at, version: s.version, antiSkid: !!s.anti_skid, simpleProtection: !!s.simple_protection, allowedHwids: s.allowed_hwids, useAdgate: !!s.use_adgate, keySystemUrl: s.key_system_url }, 200, {}, request);
}
__name(handleGet, "handleGet");
async function handleUpdate(id, request, env) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401, {}, request);
  const s = await env.DB.prepare(`SELECT * FROM scripts WHERE id = ? AND (owner = ? OR (owner IS NULL AND ? = 'admin'))`).bind(id, admin.admin_name, admin.admin_name).first();
  if (!s)
    return json({ error: "Not found" }, 404, {}, request);
  const data = await request.json();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await env.DB.prepare(`UPDATE scripts SET name=?, content=?, description=?, category=?, updated_at=?, is_private=?, access_key=?, max_executions=?, expires_at=?, anti_skid=?, simple_protection=?, allowed_hwids=?, use_adgate=?, key_system_url=? WHERE id=?`).bind(data.name || s.name, data.content || s.content, data.description ?? s.description, data.category || s.category, now, data.isPrivate !== void 0 ? data.isPrivate ? 1 : 0 : s.is_private, data.accessKey ?? s.access_key, data.maxExecutions ?? s.max_executions, data.expiresAt ?? s.expires_at, data.antiSkid !== void 0 ? data.antiSkid ? 1 : 0 : s.anti_skid, data.simpleProtection !== void 0 ? data.simpleProtection ? 1 : 0 : s.simple_protection, data.allowedHwids !== void 0 ? data.allowedHwids : s.allowed_hwids, data.useAdgate !== void 0 ? data.useAdgate ? 1 : 0 : s.use_adgate, data.keySystemUrl ?? s.key_system_url, id).run();
  if (data.isPrivate !== void 0 || data.accessKey !== void 0) {
    await env.DB.prepare(`DELETE FROM authorized_clients WHERE script_id = ?`).bind(id).run();
  }
  return json({ success: true }, 200, {}, request);
}
__name(handleUpdate, "handleUpdate");
async function handleDelete(id, request, env) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401, {}, request);
  const s = await env.DB.prepare(`SELECT id FROM scripts WHERE id = ? AND (owner = ? OR (owner IS NULL AND ? = 'admin'))`).bind(id, admin.admin_name, admin.admin_name).first();
  if (!s)
    return json({ error: "Not found" }, 404, {}, request);
  await env.DB.prepare(`DELETE FROM scripts WHERE id = ?`).bind(id).run();
  return json({ success: true }, 200, {}, request);
}
__name(handleDelete, "handleDelete");
async function handleToggle(id, request, env) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401, {}, request);
  const s = await env.DB.prepare(`SELECT is_enabled FROM scripts WHERE id = ? AND (owner = ? OR (owner IS NULL AND ? = 'admin'))`).bind(id, admin.admin_name, admin.admin_name).first();
  if (!s)
    return json({ error: "Not found" }, 404, {}, request);
  const newEnabled = s.is_enabled ? 0 : 1;
  let kick = 0;
  if (!newEnabled) {
    try {
      const body = await request.json();
      kick = body.kick ? 1 : 0;
    } catch {
    }
  }
  await env.DB.prepare(`UPDATE scripts SET is_enabled = ?, force_kick = ? WHERE id = ?`).bind(newEnabled, kick, id).run();
  statusCache.delete(`status:${id}`);
  return json({ success: true, isEnabled: !!newEnabled }, 200, {}, request);
}
__name(handleToggle, "handleToggle");
async function handleRaw(id, request, env, ctx) {
  const ua = request.headers.get("User-Agent") || "";
  const isRoblox = ua.toLowerCase().includes("roblox");
  const isPost = request.method === "POST";
  const urlObj = new URL(request.url);
  const errorRes = /* @__PURE__ */ __name((msg, status) => {
    if (isPost)
      return text(msg, status, {}, request);
    if (!isRoblox) {
      return new Response(getErrorPortalHTML(msg, "This resource is unavailable.", status), {
        status,
        headers: { "Content-Type": "text/html; charset=utf-8", ...secureHeaders }
      });
    }
    return text(`${getDetailedUI("Access Restricted", `[${status}] ${msg}`)}
warn("[maxitom] ${msg}")`, status, {}, request);
  }, "errorRes");
  const s = await env.DB.prepare(`
        SELECT s.*, a.disabled as owner_disabled 
        FROM scripts s 
        LEFT JOIN admins a ON s.owner = a.username 
        WHERE s.id = ?
    `).bind(id).first();
  if (!s)
    return errorRes("Script not found (404)", 404);
  let ownerDisabled = !!s.owner_disabled;
  if (s.owner && MANUAL_USERS[s.owner]) {
    if (MANUAL_USERS[s.owner].disabled)
      ownerDisabled = true;
  }
  if (ownerDisabled)
    return errorRes("Account suspended (403)", 403);
  if (!s.is_enabled)
    return errorRes("Script disabled (403)", 403);
  if (s.expires_at && new Date(s.expires_at) < /* @__PURE__ */ new Date())
    return errorRes("Script expired (403)", 403);
  const hwid = request.headers.get("X-M-ID") || request.headers.get("Exploit-Guid") || request.headers.get("Identifier") || request.headers.get("HWID") || "";
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (request.method === "GET") {
    if (!isRoblox) {
      const statuses = [];
      if (s.is_private)
        statuses.push({ label: "Private w/ Key", color: "#9333ea" });
      if (s.anti_skid)
        statuses.push({ label: "Maximum Security", color: "#0070f3" });
      else if (s.simple_protection)
        statuses.push({ label: "Browser Blocked", color: "#ea580c" });
      if (statuses.length === 0)
        statuses.push({ label: "Normal", color: "#10b981" });
      return new Response(getScriptPortalHTML(s, statuses), { headers: { "Content-Type": "text/html; charset=utf-8", ...secureHeaders } });
    }
    if (s.anti_skid) {
      const ts = Date.now().toString();
      const hash = await generateLaunchToken(id, ts, getAdminKey(env));
      return text(getLauncher(urlObj.href, ts, hash, getStopUI), 200, {}, request);
    }
    if (s.is_private) {
      const sessionQuery = hwid && hwid.length > 5 ? `SELECT * FROM authorized_clients WHERE script_id = ? AND hwid = ? AND ip = ? AND expires_at > ?` : `SELECT * FROM authorized_clients WHERE script_id = ? AND ip = ? AND expires_at > ?`;
      const sessionParams = hwid && hwid.length > 5 ? [id, hwid, ip, (/* @__PURE__ */ new Date()).toISOString()] : [id, ip, (/* @__PURE__ */ new Date()).toISOString()];
      const session = await env.DB.prepare(sessionQuery).bind(...sessionParams).first();
      if (session) {
        await recordStats(env, s, request, ctx);
        if (s.anti_skid) {
          const ts = Date.now().toString();
          const hash = await generateDynamicToken(id, ts, getAdminKey(env));
          return text(getSecureLoader(urlObj.href, ts, hash, getStopUI, getRVMRuntime), 200, {}, request);
        }
        const remoteControl = getKillSwitch(id, urlObj.origin);
        return text(remoteControl + "\n" + s.content, 200, {}, request);
      }
      return text(getKeySystemUI(id, urlObj.origin, s.key_system_url), 200, {}, request);
    }
    if (s.simple_protection) {
      await recordStats(env, s, request, ctx);
      const remoteControl = getKillSwitch(id, urlObj.origin);
      return text(remoteControl + "\n" + s.content, 200, {}, request);
    }
    return text(s.content, 200, {}, request);
  }
  if (request.method === "POST") {
    const action = request.headers.get("X-M-Op");
    if (action === "get_loader") {
      const ts2 = request.headers.get("X-M-Ts");
      const hash2 = request.headers.get("X-M-T");
      if (!ts2 || !hash2 || Date.now() - parseInt(ts2) > 3e3)
        return text(getStopUI(), 200, {}, request);
      const expectedHash2 = await generateLaunchToken(id, ts2, getAdminKey(env));
      if (expectedHash2 !== hash2)
        return text(getStopUI(), 200, {}, request);
      const authHash = await generateDynamicToken(id, ts2, getAdminKey(env));
      return text(getSecureLoader(urlObj.href, ts2, authHash, getStopUI, getRVMRuntime), 200, {}, request);
    }
    const authHeader = request.headers.get("X-M-A");
    const clientKey = request.headers.get("X-M-K");
    if (s.is_private && s.access_key && !clientKey) {
      const sessionQuery = hwid && hwid.length > 5 ? `SELECT * FROM authorized_clients WHERE script_id = ? AND hwid = ? AND ip = ? AND expires_at > ?` : `SELECT * FROM authorized_clients WHERE script_id = ? AND ip = ? AND expires_at > ?`;
      const sessionParams = hwid && hwid.length > 5 ? [id, hwid, ip, (/* @__PURE__ */ new Date()).toISOString()] : [id, ip, (/* @__PURE__ */ new Date()).toISOString()];
      const session = await env.DB.prepare(sessionQuery).bind(...sessionParams).first();
      if (session) {
        await recordStats(env, s, request, ctx);
        return text(s.content, 200, {}, request);
      }
      const ui = getKeySystemUI(id, urlObj.origin, s.key_system_url);
      if (authHeader && authHeader.includes(".")) {
        const [ts2, hash2] = authHeader.split(".");
        const encryptedUI = xxteaEncrypt(ui, hash2 + hwid);
        const packet = JSON.stringify([{ o: 5, d: encryptedUI }]);
        return text(xxteaEncrypt(packet, hash2), 200, {}, request);
      }
      return text(ui, 200, {}, request);
    }
    if (s.is_private && s.access_key && clientKey !== s.access_key) {
      const tk = await env.DB.prepare(`SELECT * FROM temp_keys WHERE script_id = ? AND key_value = ? AND (ip = ? OR ip = 'unknown') AND expires_at > ?`).bind(id, clientKey, ip, (/* @__PURE__ */ new Date()).toISOString()).first();
      if (!tk)
        return errorRes("Invalid key (401)", 401);
      await env.DB.prepare(`DELETE FROM temp_keys WHERE id = ?`).bind(tk.id).run();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString();
      await env.DB.prepare(`INSERT INTO authorized_clients (id, script_id, hwid, ip, expires_at) VALUES (?, ?, ?, ?, ?)`).bind(generateId(16), id, hwid, ip, expiresAt).run();
      await recordStats(env, s, request, ctx);
      return text(s.content, 200, {}, request);
    }
    if (!authHeader) {
      if (s.is_private && clientKey && clientKey === s.access_key) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString();
        await env.DB.prepare(`INSERT INTO authorized_clients (id, script_id, hwid, ip, expires_at) VALUES (?, ?, ?, ?, ?)`).bind(generateId(16), id, hwid, ip, expiresAt).run();
        await recordStats(env, s, request, ctx);
        return text(s.content, 200, {}, request);
      }
      return errorRes("Unauthorized (401)", 401);
    }
    if (!authHeader.includes("."))
      return errorRes("Unauthenticated access (403)", 403);
    const [ts, hash] = authHeader.split(".");
    if (Date.now() - parseInt(ts) > 2e3)
      return errorRes("Token expired (403)", 403);
    const expectedHash = await generateDynamicToken(id, ts, getAdminKey(env));
    if (expectedHash !== hash)
      return errorRes("Invalid token signature (403)", 403);
    if (usedTokens.has(authHeader))
      return errorRes("Token already used (403)", 403);
    usedTokens.add(authHeader);
    setTimeout(() => usedTokens.delete(authHeader), 2e3);
    if (usedTokens.size > 500) {
      const half = [...usedTokens].slice(0, 250);
      half.forEach((t) => usedTokens.delete(t));
    }
    if (s.max_executions && s.executions >= s.max_executions)
      return errorRes("Execution limit reached (403)", 403);
    if (s.allowed_hwids) {
      const list = s.allowed_hwids.split(",").map((h) => h.trim()).filter(Boolean);
      if (list.length && hwid && !list.includes(hwid)) {
        return errorRes("HWID not authorized (403)", 403);
      }
    }
    await recordStats(env, s, request, ctx);
    let scriptSource = s.content;
    const killSwitch = s.anti_skid ? getKillSwitch(id, urlObj.origin) : "";
    const OPS = { GETG: 1, GETF: 2, PUSH: 3, CALL: 4, EXEC: 5, VCHK: 6 };
    const packets = [];
    packets.push({ o: OPS.GETG, d: "print" });
    packets.push({ o: OPS.PUSH, d: "[maxitom] RVM Shield Active" });
    packets.push({ o: OPS.CALL, d: 1 });
    packets.push({ o: OPS.VCHK, d: 0 });
    const encryptionKey = hash + hwid;
    if (killSwitch) {
      const encKill = xxteaEncrypt(killSwitch, encryptionKey);
      packets.push({ o: OPS.EXEC, d: encKill });
    }
    const encBody = xxteaEncrypt(scriptSource, encryptionKey);
    packets.push({ o: OPS.EXEC, d: encBody });
    const encrypted = xxteaEncrypt(JSON.stringify(packets), encryptionKey);
    return text(encrypted, 200, {}, request);
  }
  return errorRes("Method not allowed (405)", 405);
}
__name(handleRaw, "handleRaw");
async function handleDashboard(request, env, ctx, params) {
  const key = params?.key || new URL(request.url).pathname.split("/").pop();
  if (key !== getAdminKey(env)) {
    return json({ error: "Not found" }, 404, {}, request);
  }
  return new Response(getAdminDashboardHTML(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      ...secureHeaders
    }
  });
}
__name(handleDashboard, "handleDashboard");
async function handleListAdmins(request, env) {
  const admin = await isAdmin(request, env);
  if (!admin || admin.admin_name !== "admin")
    return json({ error: "Unauthorized" }, 401, {}, request);
  const dbAdmins = (await env.DB.prepare(`SELECT username, disabled FROM admins`).all()).results || [];
  const allAdmins = [...dbAdmins];
  for (const [username, data] of Object.entries(MANUAL_USERS)) {
    if (!allAdmins.find((a) => a.username === username)) {
      allAdmins.push({
        username,
        disabled: data.disabled,
        isStatic: true
      });
    }
  }
  return json({ admins: allAdmins }, 200, {}, request);
}
__name(handleListAdmins, "handleListAdmins");
async function handleAddAdmin(request, env) {
  const admin = await isAdmin(request, env);
  if (!admin || admin.admin_name !== "admin")
    return json({ error: "Unauthorized" }, 401, {}, request);
  const { username, password } = await request.json();
  if (!username || !password)
    return json({ error: "Missing fields" }, 400, {}, request);
  const h = await hashPassword(password);
  try {
    await env.DB.prepare(`INSERT INTO admins (username, password_hash, disabled) VALUES (?, ?, 0)`).bind(username, h).run();
    return json({ success: true }, 200, {}, request);
  } catch (e) {
    return json({ error: "User already exists or DB error" }, 400, {}, request);
  }
}
__name(handleAddAdmin, "handleAddAdmin");
async function handleToggleAdmin(request, env, username) {
  const admin = await isAdmin(request, env);
  if (!admin || admin.admin_name !== "admin")
    return json({ error: "Unauthorized" }, 401, {}, request);
  if (username === "admin")
    return json({ error: "Cannot disable superadmin" }, 403, {}, request);
  const row = await env.DB.prepare(`SELECT disabled FROM admins WHERE username = ?`).bind(username).first();
  if (row) {
    const newVal = row.disabled ? 0 : 1;
    await env.DB.prepare(`UPDATE admins SET disabled = ? WHERE username = ?`).bind(newVal, username).run();
    return json({ success: true, disabled: !!newVal }, 200, {}, request);
  } else if (MANUAL_USERS[username]) {
    return json({ error: "Static users must be managed in users.js" }, 403, {}, request);
  }
  return json({ error: "User not found" }, 404, {}, request);
}
__name(handleToggleAdmin, "handleToggleAdmin");
async function handleChangeAdminPassword(request, env, username) {
  const admin = await isAdmin(request, env);
  if (!admin || admin.admin_name !== "admin")
    return json({ error: "Unauthorized" }, 401, {}, request);
  const { password } = await request.json();
  if (!password)
    return json({ error: "Password required" }, 400, {}, request);
  const h = await hashPassword(password);
  await env.DB.prepare(`UPDATE admins SET password_hash = ? WHERE username = ?`).bind(h, username).run();
  await env.DB.prepare(`DELETE FROM sessions WHERE admin_name = ?`).bind(username).run();
  return json({ success: true }, 200, {}, request);
}
__name(handleChangeAdminPassword, "handleChangeAdminPassword");
async function handleGetProfile(request, env) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401, {}, request);
  let row;
  try {
    row = await env.DB.prepare(`SELECT username, discord_id, avatar, totp_enabled, totp_secret, password_hash FROM admins WHERE username = ?`).bind(admin.admin_name).first();
    if (row)
      row.has_secret = !!row.totp_secret;
  } catch (e) {
    row = await env.DB.prepare(`SELECT username, discord_id, avatar FROM admins WHERE username = ?`).bind(admin.admin_name).first();
    if (row) {
      row.totp_enabled = 0;
      row.has_secret = false;
    }
  }
  if (!row) {
    row = { username: admin.admin_name, discord_id: null, avatar: null, totp_enabled: 0, password_hash: null };
  }
  if (!row.password_hash || row.password_hash === "static_account" || row.password_hash === "dummy") {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let newPass = "";
    for (let i = 0; i < 12; i++)
      newPass += charset.charAt(Math.floor(Math.random() * charset.length));
    const h = await hashPassword(newPass);
    await env.DB.prepare("INSERT OR REPLACE INTO admins (username, password_hash, discord_id, avatar, totp_enabled, totp_secret) VALUES (?, ?, ?, ?, ?, ?)").bind(row.username, h, row.discord_id, row.avatar, row.totp_enabled || 0, row.totp_secret || null).run();
    row.current_password = newPass;
  } else {
    row.current_password = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  }
  delete row.password_hash;
  return json({ user: row }, 200, {}, request);
}
__name(handleGetProfile, "handleGetProfile");
async function handleUpdatePassword(request, env) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401, {}, request);
  const { password } = await request.json();
  if (!password || password.length < 4)
    return json({ error: "Password too short" }, 400, {}, request);
  const h = await hashPassword(password);
  await env.DB.prepare(`UPDATE admins SET password_hash = ? WHERE username = ?`).bind(h, admin.admin_name).run();
  return json({ success: true }, 200, {}, request);
}
__name(handleUpdatePassword, "handleUpdatePassword");
async function handleDiscordLogin(request, env) {
  const clientId = env.DISCORD_CLIENT_ID;
  const redirectUri = env.DISCORD_REDIRECT_URI || `${new URL(request.url).origin}/api/auth/discord/callback`;
  const state = generateId(16);
  const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20email&state=${state}`;
  const cookie = `discord_state=${state}; Path=/; HttpOnly; Max-Age=300; Secure; SameSite=Lax`;
  return new Response(null, {
    status: 302,
    headers: {
      "Location": discordUrl,
      "Set-Cookie": cookie
    }
  });
}
__name(handleDiscordLogin, "handleDiscordLogin");
async function handleDiscordCallback(request, env, ctx) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieHeader = request.headers.get("Cookie") || "";
  const stateMatch = cookieHeader.match(/discord_state=([^;]+)/);
  const savedState = stateMatch ? stateMatch[1] : null;
  if (!code || !state || state !== savedState) {
    return json({ error: "Invalid state or missing code. CSRF protection triggered." }, 403, {}, request);
  }
  const clientId = env.DISCORD_CLIENT_ID;
  const clientSecret = env.DISCORD_CLIENT_SECRET;
  const redirectUri = env.DISCORD_REDIRECT_URI || `${url.origin}/api/auth/discord/callback`;
  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri
      })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error)
      throw new Error(tokenData.error_description || tokenData.error);
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();
    const discordId = userData.id;
    const username = userData.username;
    const email = userData.email;
    const avatar = userData.avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${userData.avatar}.png` : null;
    let admin = await env.DB.prepare(`SELECT username, disabled, discord_id FROM admins WHERE discord_id = ? OR (username = ? AND discord_id IS NULL)`).bind(discordId, username).first();
    if (!admin && username === "admin") {
      admin = await env.DB.prepare(`SELECT username, disabled, discord_id FROM admins WHERE username = 'admin'`).first();
    }
    if (admin && !admin.discord_id) {
      await env.DB.prepare(`UPDATE admins SET discord_id = ?, avatar = ? WHERE username = ?`).bind(discordId, avatar, admin.username).run();
    }
    if (!admin && username === "admin") {
      admin = { username: "admin", disabled: 0 };
      await env.DB.prepare(`INSERT OR IGNORE INTO admins (username, discord_id, avatar, disabled, password_hash) VALUES (?, ?, ?, 0, 'dummy')`).bind("admin", discordId, avatar).run();
    }
    if (!admin) {
      await env.DB.prepare(`
                INSERT INTO admins (username, discord_id, avatar, disabled, password_hash) 
                VALUES (?, ?, ?, 0, 'dummy')
            `).bind(username, discordId, avatar).run();
      admin = { username, disabled: 0 };
      const ip = request.headers.get("X-Zen-Client-IP") || request.headers.get("CF-Connecting-IP") || "127.0.0.1";
      ctx.waitUntil(sendWebhook(env, "MAXITOM", {
        title: "\u{1F195} New Platform Registration",
        description: `A new user has registered via Discord and gained administrative access.`,
        color: 3900150,
        fields: [
          { name: "Username", value: `\`${username}\``, inline: true },
          { name: "Discord ID", value: `\`${discordId}\``, inline: true },
          { name: "IP Address", value: `\`${ip}\``, inline: true },
          { name: "Location", value: `\`${request.cf?.city || "Unknown"}\`, \`${request.cf?.country || "Unknown"}\``, inline: false }
        ],
        footer: `Maxitom \u2022 Registry Updated`
      }));
    }
    if (admin.disabled) {
      return new Response(`
                <script>
                    alert("Unauthorized: Your account (${username}) is currently suspended.");
                    window.location.href = "/";
                <\/script>
            `, { headers: { "Content-Type": "text/html" } });
    }
    const sessionId = generateSessionId();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1e3;
    await env.DB.prepare(`INSERT INTO sessions (id, expires_at, admin_name) VALUES (?, ?, ?)`).bind(sessionId, expiresAt, admin.username).run();
    const cookie = `session_id=${sessionId}; Path=/; HttpOnly; SameSite=None; Max-Age=86400; Secure`;
    const dashboardUrl = env.FRONTEND_URL || "/";
    return new Response(null, {
      status: 302,
      headers: {
        "Location": dashboardUrl,
        "Set-Cookie": cookie
      }
    });
  } catch (e) {
    console.error("Discord Auth Error:", e);
    return json({ error: "Authentication failed", details: e.message }, 500, {}, request);
  }
}
__name(handleDiscordCallback, "handleDiscordCallback");
async function handleVerify2FA(request, env) {
  const { username, attemptToken, code } = await request.json();
  if (!username || !attemptToken || !code)
    return json({ error: "Missing data" }, 400);
  const session = await env.DB.prepare("SELECT * FROM sessions WHERE id = ? AND admin_name = ?").bind(attemptToken, username).first();
  if (!session || Date.now() > session.expires_at) {
    return json({ error: "Attempt expired" }, 401);
  }
  const admin = await env.DB.prepare("SELECT totp_secret FROM admins WHERE username = ?").bind(username).first();
  const { verifyTOTP: verifyTOTP2 } = await Promise.resolve().then(() => (init_crypto(), crypto_exports));
  const isValid = await verifyTOTP2(admin.totp_secret, code);
  if (!isValid)
    return json({ error: "Invalid 2FA code" }, 401);
  await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(attemptToken).run();
  const sessionId = generateSessionId();
  await env.DB.prepare("INSERT INTO sessions (id, admin_name, expires_at) VALUES (?, ?, ?)").bind(sessionId, username, Date.now() + 864e5).run();
  return json({ success: true }, 200, {
    "Set-Cookie": `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400; Secure`
  });
}
__name(handleVerify2FA, "handleVerify2FA");
async function handleSetup2FA(request, env) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401);
  const adminName = admin.admin_name || admin.username;
  const existing = await env.DB.prepare("SELECT totp_secret, totp_enabled FROM admins WHERE username = ?").bind(adminName).first();
  if (existing && existing.totp_secret) {
    return json({ success: true, secret: existing.totp_secret, alreadyConfigured: true });
  }
  const { generateTOTPSecret: generateTOTPSecret2 } = await Promise.resolve().then(() => (init_crypto(), crypto_exports));
  const secret = generateTOTPSecret2();
  try {
    await env.DB.prepare("ALTER TABLE admins ADD COLUMN totp_secret TEXT").run();
    await env.DB.prepare("ALTER TABLE admins ADD COLUMN totp_enabled INTEGER DEFAULT 0").run();
  } catch (e) {
  }
  await env.DB.prepare("INSERT OR IGNORE INTO admins (username, password_hash, disabled) VALUES (?, ?, 0)").bind(adminName, "static_account").run();
  await env.DB.prepare("UPDATE admins SET totp_secret = ? WHERE username = ?").bind(secret, adminName).run();
  const qrUrl = `otpauth://totp/Maxitom:${adminName}?secret=${secret}&issuer=Maxitom`;
  return json({ success: true, secret, qrUrl, alreadyConfigured: false });
}
__name(handleSetup2FA, "handleSetup2FA");
async function handleDisable2FA(request, env) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401);
  const { code } = await request.json();
  if (!code)
    return json({ error: "Verification code required to disable 2FA" }, 400);
  const adminName = admin.admin_name || admin.username;
  const row = await env.DB.prepare("SELECT totp_secret FROM admins WHERE username = ?").bind(adminName).first();
  if (!row || !row.totp_secret)
    return json({ error: "2FA is not configured" }, 400);
  const { verifyTOTP: verifyTOTP2 } = await Promise.resolve().then(() => (init_crypto(), crypto_exports));
  const valid = await verifyTOTP2(row.totp_secret, code);
  if (!valid)
    return json({ error: "Invalid verification code" }, 400);
  await env.DB.prepare("UPDATE admins SET totp_enabled = 0 WHERE username = ?").bind(adminName).run();
  return json({ success: true });
}
__name(handleDisable2FA, "handleDisable2FA");
async function handleConfirm2FA(request, env) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401);
  const adminName = admin.admin_name || admin.username;
  if (admin.totp_enabled)
    return json({ error: "2FA is already enabled." }, 403);
  const { code } = await request.json();
  const dbAdmin = await env.DB.prepare("SELECT totp_secret FROM admins WHERE username = ?").bind(adminName).first();
  const { verifyTOTP: verifyTOTP2 } = await Promise.resolve().then(() => (init_crypto(), crypto_exports));
  const isValid = await verifyTOTP2(dbAdmin?.totp_secret, code);
  if (!isValid)
    return json({ error: "Invalid code" }, 400);
  await env.DB.prepare("UPDATE admins SET totp_enabled = 1 WHERE username = ?").bind(adminName).run();
  return json({ success: true });
}
__name(handleConfirm2FA, "handleConfirm2FA");
var MAX_PROJECTS_PER_USER = 10;
var MAX_FIELD_LEN = 200;
var MAX_METADATA_LEN = 512;
var TRACK_WINDOW = 6e4;
var TRACK_MAX_PER_IP = 10;
var DEDUP_WINDOW = 1e4;
var trackLimits = /* @__PURE__ */ new Map();
var recentHits = /* @__PURE__ */ new Map();
function cors(request) {
  const origin = request?.headers?.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin"
  };
}
__name(cors, "cors");
function makeId(len = 8) {
  const pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => pool[b % pool.length]).join("");
}
__name(makeId, "makeId");
async function digestIP(raw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
}
__name(digestIP, "digestIP");
function truncate(s, max) {
  if (!s || typeof s !== "string")
    return null;
  return s.substring(0, max);
}
__name(truncate, "truncate");
function isRateLimited(ip) {
  if (!ip)
    return false;
  const now = Date.now();
  if (trackLimits.size > 5e3) {
    for (const [k, v] of trackLimits) {
      if (now > v.reset)
        trackLimits.delete(k);
    }
  }
  const entry = trackLimits.get(ip);
  if (!entry || now > entry.reset) {
    trackLimits.set(ip, { count: 1, reset: now + TRACK_WINDOW });
    return false;
  }
  if (entry.count >= TRACK_MAX_PER_IP)
    return true;
  entry.count++;
  return false;
}
__name(isRateLimited, "isRateLimited");
function isDuplicate(projectId, ipHash) {
  const now = Date.now();
  const key = `${projectId}:${ipHash}`;
  if (recentHits.size > 1e4) {
    for (const [k, ts] of recentHits) {
      if (now - ts > DEDUP_WINDOW)
        recentHits.delete(k);
    }
  }
  const last = recentHits.get(key);
  if (last && now - last < DEDUP_WINDOW)
    return true;
  recentHits.set(key, now);
  return false;
}
__name(isDuplicate, "isDuplicate");
async function handleAntigravityGetMe(request, env) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401);
  const projects = await env.DB.prepare(
    "SELECT project_id, name, description, status, created_at FROM hub_projects WHERE owner_id = ? ORDER BY created_at DESC"
  ).bind(admin.admin_name).all();
  return json({
    authenticated: true,
    user: {
      username: admin.admin_name,
      avatar: admin.avatar
    },
    projects: projects.results || []
  }, 200, cors(request));
}
__name(handleAntigravityGetMe, "handleAntigravityGetMe");
async function handleAntigravityLogout(request, env) {
  return json({ success: true }, 200, cors(request));
}
__name(handleAntigravityLogout, "handleAntigravityLogout");
async function handleAntigravityCreateProject(request, env) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401);
  try {
    const body = await request.json();
    const name = truncate(body.name, MAX_FIELD_LEN);
    const description = truncate(body.description, MAX_METADATA_LEN);
    if (!name)
      return json({ error: "Name required" }, 400, cors(request));
    const count = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM hub_projects WHERE owner_id = ?"
    ).bind(admin.admin_name).first();
    if (count.count >= MAX_PROJECTS_PER_USER) {
      return json({ error: "Project limit reached" }, 403, cors(request));
    }
    const projectId = makeId(8);
    const apiKey = "xut_" + makeId(32);
    await env.DB.prepare(
      "INSERT INTO hub_projects (project_id, owner_id, name, description, api_key) VALUES (?, ?, ?, ?, ?)"
    ).bind(projectId, admin.admin_name, name, description, apiKey).run();
    return json({
      project_id: projectId,
      api_key: apiKey
    }, 201, cors(request));
  } catch (e) {
    return json({ error: "Bad request" }, 400, cors(request));
  }
}
__name(handleAntigravityCreateProject, "handleAntigravityCreateProject");
async function handleAntigravityTrack(request, env) {
  const h = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
  const ip = request.headers.get("X-Zen-Client-IP") || request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const country = (request.headers.get("X-Zen-Country") || request.headers.get("CF-IPCountry") || "").toUpperCase().substring(0, 2) || null;
  if (isRateLimited(ip)) {
    return json({ error: "Rate limited" }, 429, h);
  }
  try {
    const body = await request.json();
    const apiKey = body.apiKey;
    if (!apiKey || typeof apiKey !== "string")
      return json({ error: "Missing key" }, 400, h);
    const proj = await env.DB.prepare(
      "SELECT project_id, status FROM hub_projects WHERE api_key = ?"
    ).bind(apiKey).first();
    if (!proj)
      return json({ error: "Invalid key" }, 403, h);
    if (proj.status !== "ACTIVE")
      return json({ error: "Inactive" }, 403, h);
    const hash = await digestIP(ip);
    if (isDuplicate(proj.project_id, hash)) {
      return json({ success: true, deduplicated: true }, 200, h);
    }
    const eventType = truncate(body.eventType, MAX_FIELD_LEN) || "PING";
    const day = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const hour = (/* @__PURE__ */ new Date()).getUTCHours().toString();
    const cc = country || "??";
    let isUnique = false;
    try {
      await env.DB.prepare("INSERT INTO hub_unique_ips (project_id, ip_hash) VALUES (?, ?)").bind(proj.project_id, hash).run();
      isUnique = true;
    } catch (e) {
    }
    const vals = [
      `(?1, 'total', 'all', 1)`,
      `(?1, 'daily', ?2, 1)`,
      `(?1, 'hourly', ?3, 1)`,
      `(?1, 'type', ?4, 1)`,
      `(?1, 'country', ?5, 1)`
    ];
    if (isUnique)
      vals.push(`(?1, 'total', 'unique', 1)`);
    const query = `
            INSERT INTO hub_project_stats (project_id, stat_type, stat_key, count)
            VALUES ${vals.join(", ")}
            ON CONFLICT(project_id, stat_type, stat_key) DO UPDATE SET count = count + 1
        `;
    await env.DB.prepare(query).bind(proj.project_id, day, hour, eventType, cc).run();
    return json({ success: true }, 200, h);
  } catch (e) {
    return json({ error: "Bad request" }, 400, h);
  }
}
__name(handleAntigravityTrack, "handleAntigravityTrack");
async function handleAntigravityDiscordLogin(request, env) {
  const url = new URL(request.url);
  return new Response(null, {
    status: 302,
    headers: { "Location": `${url.origin}/api/auth/discord` }
  });
}
__name(handleAntigravityDiscordLogin, "handleAntigravityDiscordLogin");
async function handleAntigravityDiscordCallback(request, env) {
  const url = new URL(request.url);
  return new Response(null, {
    status: 302,
    headers: { "Location": `${url.origin}/api/auth/discord/callback` }
  });
}
__name(handleAntigravityDiscordCallback, "handleAntigravityDiscordCallback");
async function handleAntigravityDeleteProject(request, env, projectId) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401);
  try {
    const proj = await env.DB.prepare(
      "SELECT owner_id FROM hub_projects WHERE project_id = ?"
    ).bind(projectId).first();
    if (!proj || proj.owner_id !== admin.admin_name) {
      return json({ error: "Not found" }, 404, cors(request));
    }
    await env.DB.prepare("DELETE FROM hub_project_stats WHERE project_id = ?").bind(projectId).run();
    await env.DB.prepare("DELETE FROM hub_unique_ips WHERE project_id = ?").bind(projectId).run();
    await env.DB.prepare("DELETE FROM hub_projects WHERE project_id = ?").bind(projectId).run();
    return json({ success: true }, 200, cors(request));
  } catch (e) {
    return json({ error: "Bad request" }, 400, cors(request));
  }
}
__name(handleAntigravityDeleteProject, "handleAntigravityDeleteProject");
async function handleAntigravityUpdateProject(request, env, projectId) {
  const admin = await isAdmin(request, env);
  if (!admin)
    return json({ error: "Unauthorized" }, 401);
  try {
    const body = await request.json();
    const name = truncate(body.name, MAX_FIELD_LEN);
    const description = truncate(body.description, MAX_METADATA_LEN);
    const status = body.status;
    if (!name)
      return json({ error: "Name required" }, 400, cors(request));
    const proj = await env.DB.prepare(
      "SELECT owner_id FROM hub_projects WHERE project_id = ?"
    ).bind(projectId).first();
    if (!proj || proj.owner_id !== admin.admin_name) {
      return json({ error: "Not found" }, 404, cors(request));
    }
    await env.DB.prepare(
      "UPDATE hub_projects SET name = ?, description = ?, status = ? WHERE project_id = ?"
    ).bind(name, description, status, projectId).run();
    return json({ success: true }, 200, cors(request));
  } catch (e) {
    return json({ error: "Bad request" }, 400, cors(request));
  }
}
__name(handleAntigravityUpdateProject, "handleAntigravityUpdateProject");
async function handleAntigravityGetStats(request, env, projectId) {
  try {
    const proj = await env.DB.prepare(
      "SELECT * FROM hub_projects WHERE project_id = ?"
    ).bind(projectId).first();
    if (!proj)
      return json({ error: "Not found" }, 404, cors(request));
    const stats = {};
    const statRows = await env.DB.prepare(
      "SELECT stat_type, stat_key, count FROM hub_project_stats WHERE project_id = ?"
    ).bind(projectId).all();
    for (const row of statRows.results || []) {
      if (!stats[row.stat_type])
        stats[row.stat_type] = {};
      stats[row.stat_type][row.stat_key] = row.count;
    }
    return json({
      name: proj.name,
      description: proj.description,
      status: proj.status,
      creator: proj.owner_id,
      createdAt: proj.created_at,
      stats: {
        total: stats.total?.all || 0,
        unique: stats.total?.unique || 0,
        daily: stats.total?.all || 0
      }
    }, 200, cors(request));
  } catch (e) {
    return json({ error: "Bad request" }, 400, cors(request));
  }
}
__name(handleAntigravityGetStats, "handleAntigravityGetStats");
async function handleAntigravityGetActivity(request, env, projectId) {
  try {
    const proj = await env.DB.prepare(
      "SELECT * FROM hub_projects WHERE project_id = ?"
    ).bind(projectId).first();
    if (!proj)
      return json({ error: "Not found" }, 404, cors(request));
    const activity = { daily: [], hourly: [], types: [], countries: [] };
    const dailyRows = await env.DB.prepare(
      "SELECT stat_key, count FROM hub_project_stats WHERE project_id = ? AND stat_type = 'daily' ORDER BY stat_key"
    ).bind(projectId).all();
    for (const row of dailyRows.results || []) {
      activity.daily.push({ date: row.stat_key, count: row.count });
    }
    const hourlyRows = await env.DB.prepare(
      "SELECT stat_key, count FROM hub_project_stats WHERE project_id = ? AND stat_type = 'hourly' ORDER BY stat_key"
    ).bind(projectId).all();
    for (const row of hourlyRows.results || []) {
      activity.hourly.push({ hour: parseInt(row.stat_key), count: row.count });
    }
    const typeRows = await env.DB.prepare(
      "SELECT stat_key, count FROM hub_project_stats WHERE project_id = ? AND stat_type = 'type' ORDER BY count DESC"
    ).bind(projectId).all();
    for (const row of typeRows.results || []) {
      activity.types.push({ type: row.stat_key, count: row.count });
    }
    const countryRows = await env.DB.prepare(
      "SELECT stat_key, count FROM hub_project_stats WHERE project_id = ? AND stat_type = 'country' ORDER BY count DESC"
    ).bind(projectId).all();
    for (const row of countryRows.results || []) {
      activity.countries.push({ country: row.stat_key, count: row.count });
    }
    return json(activity, 200, cors(request));
  } catch (e) {
    return json({ error: "Bad request" }, 400, cors(request));
  }
}
__name(handleAntigravityGetActivity, "handleAntigravityGetActivity");

// src/index.js
var router = new Router();
router.add("GET", "/zen", (req, env, ctx) => {
  return handleDashboard(req, env, ctx, { key: env.ADMIN_KEY });
});
router.add("POST", "/api/login", handleLogin);
router.add("POST", "/api/logout", handleLogout);
router.add("GET", "/api/checkAuth", handleCheckAuth);
router.add("GET", "/api/auth/discord", handleDiscordLogin);
router.add("GET", "/api/auth/discord/callback", handleDiscordCallback);
router.add("GET", "/api/me", handleGetProfile);
router.add("POST", "/api/me/password", handleUpdatePassword);
router.add("GET", "/api/admins", handleListAdmins);
router.add("POST", "/api/admins", handleAddAdmin);
router.add("POST", "/api/admins/:id/toggle", (req, env, ctx, params) => handleToggleAdmin(req, env, params.id));
router.add("POST", "/api/admins/:id/password", (req, env, ctx, params) => handleChangeAdminPassword(req, env, params.id));
router.add("POST", "/api/auth/2fa/setup", handleSetup2FA);
router.add("POST", "/api/auth/2fa/confirm", handleConfirm2FA);
router.add("POST", "/api/auth/2fa/verify", handleVerify2FA);
router.add("POST", "/api/auth/2fa/disable", handleDisable2FA);
router.add("POST", "/api/upload", handleUpload);
router.add("GET", "/api/scripts", handleList);
router.add("GET", "/api/active_users", handleActiveUsers);
router.add("GET", "/api/script/:id", (req, env, ctx, params) => handleGet(params.id, req, env));
router.add("PUT", "/api/script/:id", (req, env, ctx, params) => handleUpdate(params.id, req, env));
router.add("DELETE", "/api/script/:id", (req, env, ctx, params) => handleDelete(params.id, req, env));
router.add("POST", "/api/script/:id/toggle", (req, env, ctx, params) => handleToggle(params.id, req, env));
router.add("POST", "/api/script/:id/message", (req, env, ctx, params) => handleMessage(params.id, req, env));
router.add("GET", "/api/script/:id/status", (req, env, ctx, params) => handleStatus(params.id, req, env));
router.add("POST", "/api/script/:id/ticket", (req, env, ctx, params) => handleTicket(params.id, req, env));
router.add("POST", "/api/user/:id/action", (req, env, ctx, params) => handleUserAction(params.id, req, env));
router.add("POST", "/api/checkpoint/verify", handleCheckpoint);
router.add("GET", "/raw/:id", (req, env, ctx, params) => handleRaw(params.id, req, env, ctx));
router.add("POST", "/raw/:id", (req, env, ctx, params) => handleRaw(params.id, req, env, ctx));
router.add("GET", "/api/antigravity/me", handleAntigravityGetMe);
router.add("POST", "/api/antigravity/logout", handleAntigravityLogout);
router.add("POST", "/api/antigravity/projects", handleAntigravityCreateProject);
router.add("POST", "/api/antigravity/track", handleAntigravityTrack);
router.add("GET", "/api/antigravity/auth/discord", handleAntigravityDiscordLogin);
router.add("GET", "/api/antigravity/auth/discord/callback", handleAntigravityDiscordCallback);
router.add("DELETE", "/api/antigravity/projects/:id", (req, env, ctx, params) => handleAntigravityDeleteProject(req, env, params.id));
router.add("PUT", "/api/antigravity/projects/:id", (req, env, ctx, params) => handleAntigravityUpdateProject(req, env, params.id));
router.add("GET", "/api/antigravity/stats/:id", (req, env, ctx, params) => handleAntigravityGetStats(req, env, params.id));
router.add("GET", "/api/antigravity/activity/:id", (req, env, ctx, params) => handleAntigravityGetActivity(req, env, params.id));
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isRoblox = (request.headers.get("User-Agent") || "").toLowerCase().includes("roblox");
    try {
      if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/raw/") || url.pathname === "/zen") {
        const response = await router.handle(request, env, ctx);
        if (response)
          return response;
        if (isRoblox) {
          return new Response(`${getDetailedUI("Invalid Endpoint", "The requested URL does not belong to the network.")}
warn("[maxitom] 404 Not Found")`, {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        }
        return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: { "Content-Type": "application/json" } });
      }
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
      return new Response("Standalone Antigravity Ready (No Assets Bound)", { status: 200 });
    } catch (e) {
      console.error("Critical Error:", e);
      return new Response(JSON.stringify({ error: "Internal Server Error", details: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-Nh9mrb/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
init_checked_fetch();
init_strip_cf_connecting_ip_header();
init_modules_watch_stub();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-Nh9mrb/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
