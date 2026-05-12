import { MAX_SCRIPT_SIZE } from './utils/constants.js';
import { secureHeaders } from './shared/constants.js';
import { statusCache, usedTokens } from './utils/state.js';
import { json, text } from './shared/utils.js';
import { generateId, generateSessionId, getAdminKey, isAdmin, checkLoginRateLimit, recordStats, verifyPassword } from './utils/utils.js';
import { generateDynamicToken, generateLaunchToken, xxteaEncrypt, hashPassword, hashIP } from './utils/crypto.js';
import { getDetailedUI } from './shared/ui.js';
import { getStopUI, getKeySystemUI, getScriptPortalHTML, getErrorPortalHTML } from './ui/ui.js';
import { getRVMRuntime, getSecureLoader, getLauncher, getKillSwitch } from './core/vm.js';
import { MANUAL_USERS } from './utils/users.js';
import { getAdminDashboardHTML } from './ui/dashboard.js';
import { sendWebhook } from './shared/webhooks.js';
export async function handleLogin(request, env, ctx) {
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
        await env.DB.prepare('INSERT INTO sessions (id, admin_name, expires_at) VALUES (?, ?, ?)')
            .bind(attemptToken, username, Date.now() + 300000)
            .run();
        return json({ 
            success: true, 
            twoFactorRequired: true, 
            attemptToken: attemptToken 
        }, 200, {}, request);
    }
    const sessionId = generateSessionId();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1e3;
    await env.DB.prepare(`INSERT INTO sessions (id, expires_at, admin_name) VALUES (?, ?, ?)`).bind(sessionId, expiresAt, username).run();
    ctx.waitUntil(sendWebhook(env, 'MAXITOM', {
        title: 'Administrative Access',
        description: `Admin **${username}** has established a secure session with the Maxitom network.`,
        color: 0x5865F2, 
        fields: [
            { name: 'Operator', value: `\`${username}\``, inline: true },
            { name: 'Identity', value: `\`${ip}\``, inline: true },
            { name: 'Location', value: `\`${request.cf?.city || 'Unknown'}\`, \`${request.cf?.country || 'Unknown'}\` (\`${request.cf?.colo || 'UNK'}\`)`, inline: false }
        ],
        footer: `Maxitom • Session Active`
    }));
    const cookie = `session_id=${sessionId}; Path=/; HttpOnly; SameSite=None; Max-Age=86400; Secure`;
    return json({ success: true }, 200, { "Set-Cookie": cookie }, request);
}
export async function handleLogout(request, env) {
    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(/session_id=([^;]+)/);
    if (match) {
        await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(match[1]).run();
    }
    const clearCookie = `session_id=; Path=/; HttpOnly; SameSite=None; Max-Age=0; Secure`;
    return json({ success: true }, 200, { "Set-Cookie": clearCookie }, request);
}
export async function handleCheckAuth(request, env) {
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
export async function handleStatus(id, request, env) {
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
        if (!s) return json({ error: "Not found" }, 404, {}, request);
        statusCache.set(cacheKey, { timestamp: nowMs, data: s });
    }
    let au = null;
    const isRoblox = (request.headers.get("User-Agent") || "").toLowerCase().includes("roblox");
    const isAuthentic = user !== "Unknown";
    if (isAuthentic) {
        const activeUserId = `${id}:${user}:${hwid || rawIp}`;
        const now = (new Date()).toISOString();
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
        if (au.action_kick) response.ak = true;
        if (au.action_message) response.am = au.action_message;
    }
    if (Math.random() < 0.05) {
        const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1e3).toISOString();
        env.DB.prepare(`DELETE FROM active_users WHERE last_ping < ?`).bind(twoMinsAgo).run().catch(() => { });
    }
    return json(response, 200, {}, request);
}
export async function handleTicket(id, request, env) {
    const ip = request.headers.get("X-Zen-Client-IP") || request.headers.get("CF-Connecting-IP") || "127.0.0.1";
    const hwid = request.headers.get("X-M-ID") || "";
    const ticketId = generateId(24);
    await env.DB.prepare(`INSERT INTO checkpoint_tickets (id, script_id, hwid, ip) VALUES (?, ?, ?, ?)`).bind(ticketId, id, hwid, ip).run();
    return json({ ticket: ticketId }, 200, {}, request);
}
export async function handleCheckpoint(request, env) {
    const url = new URL(request.url);
    const scriptId = url.searchParams.get("s");
    const ticketId = url.searchParams.get("t");
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!scriptId) return json({ error: "Missing script ID" }, 400, {}, request);
    if (!ticketId) return json({ error: "Unauthorized: No ticket provided." }, 403, {}, request);
    const ticket = await env.DB.prepare(`SELECT * FROM checkpoint_tickets WHERE id = ? AND script_id = ? AND is_used = 0`).bind(ticketId, scriptId).first();
    if (!ticket) return json({ error: "Invalid or expired ticket." }, 403, {}, request);
    const tempKey = "MAXI-" + generateId(4).toUpperCase() + "-" + generateId(4).toUpperCase();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await env.DB.batch([
        env.DB.prepare(`UPDATE checkpoint_tickets SET is_used = 1 WHERE id = ?`).bind(ticketId),
        env.DB.prepare(`INSERT INTO temp_keys (id, script_id, key_value, ip, expires_at) VALUES (?, ?, ?, ?, ?)`).bind(generateId(16), scriptId, tempKey, ip, expiresAt)
    ]);
    return json({ success: true, key: tempKey }, 200, {}, request);
}
export async function handleMessage(id, request, env) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401, {}, request);
    const s = await env.DB.prepare(`SELECT id FROM scripts WHERE id = ? AND (owner = ? OR (owner IS NULL AND ? = 'admin'))`).bind(id, admin.admin_name, admin.admin_name).first();
    if (!s) return json({ error: "Not found" }, 404, {}, request);
    const { message } = await request.json();
    await env.DB.prepare(`UPDATE scripts SET remote_message = ? WHERE id = ?`).bind(message || null, id).run();
    statusCache.delete(`status:${id}`);
    return json({ success: true }, 200, {}, request);
}
export async function handleActiveUsers(request, env) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401, {}, request);
    const oneMinAgo = new Date(Date.now() - 1 * 60 * 1e3).toISOString();
    await env.DB.prepare(`DELETE FROM active_users WHERE last_ping < ?`).bind(oneMinAgo).run().catch(() => { });
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
export async function handleUserAction(idRaw, request, env) {
    const id = decodeURIComponent(idRaw);
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401, {}, request);
    const scriptId = id.split(':')[0];
    const scriptCheck = await env.DB.prepare(`SELECT id FROM scripts WHERE id = ? AND (owner = ? OR (owner IS NULL AND ? = 'admin'))`).bind(scriptId, admin.admin_name, admin.admin_name).first();
    if (!scriptCheck) return json({ error: "Not found" }, 404, {}, request);
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
export async function handleUpload(request, env, ctx) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401, {}, request);
    const data = await request.json();
    if (!data.name?.trim() || !data.content?.trim()) return json({ error: "Name and content required" }, 400, {}, request);
    if (data.content.length > MAX_SCRIPT_SIZE) return json({ error: "Script too large" }, 400, {}, request);
    const id = generateId();
    const now = (new Date()).toISOString();
    await env.DB.prepare(`INSERT INTO scripts (id, name, content, description, category, created_at, updated_at, is_private, access_key, max_executions, expires_at, anti_skid, simple_protection, allowed_hwids, owner, use_adgate, is_enabled, key_system_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).bind(id, data.name.trim(), data.content, data.description || "", data.category || "general", now, now, data.isPrivate ? 1 : 0, data.accessKey || null, data.maxExecutions || null, data.expiresAt || null, data.antiSkid ? 1 : 0, data.simpleProtection ? 1 : 0, data.allowedHwids || null, admin.admin_name, data.useAdgate ? 1 : 0, data.keySystemUrl || null).run();
    ctx.waitUntil(sendWebhook(env, 'MAXITOM', {
        title: '📦 New Script Upload',
        description: `A new script has been published to the Maxitom network.`,
        color: 0x10b981, 
        fields: [
            { name: 'Name', value: data.name, inline: true },
            { name: 'ID', value: id, inline: true },
            { name: 'Owner', value: admin.admin_name, inline: true }
        ],
        footer: `Maxitom • Registry Updated`
    }));
    return json({ success: true, id }, 200, {}, request);
}
export async function handleList(request, env) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401, {}, request);
    const result = await env.DB.prepare(`SELECT id, name, description, category, created_at, updated_at, views, executions, is_private, is_enabled, access_key, max_executions, expires_at, version, anti_skid, simple_protection, allowed_hwids, use_adgate, key_system_url FROM scripts WHERE (owner = ? OR (owner IS NULL AND ? = 'admin')) ORDER BY updated_at DESC`).bind(admin.admin_name, admin.admin_name).all();
    return json({ scripts: result.results.map((s) => ({ id: s.id, name: s.name, description: s.description, category: s.category, createdAt: s.created_at, updatedAt: s.updated_at, views: s.views, executions: s.executions, isPrivate: !!s.is_private, isEnabled: !!s.is_enabled, accessKey: s.access_key, maxExecutions: s.max_executions, expiresAt: s.expires_at, version: s.version, antiSkid: !!s.anti_skid, simpleProtection: !!s.simple_protection, allowedHwids: s.allowed_hwids, useAdgate: !!s.use_adgate, keySystemUrl: s.key_system_url })) }, 200, {}, request);
}
export async function handleGet(id, request, env) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401, {}, request);
    const s = await env.DB.prepare(`SELECT * FROM scripts WHERE id = ? AND (owner = ? OR (owner IS NULL AND ? = 'admin'))`).bind(id, admin.admin_name, admin.admin_name).first();
    if (!s) return json({ error: "Not found" }, 404, {}, request);
    return json({ id: s.id, name: s.name, content: s.content, description: s.description, category: s.category, createdAt: s.created_at, updatedAt: s.updated_at, views: s.views, executions: s.executions, isPrivate: !!s.is_private, isEnabled: !!s.is_enabled, accessKey: s.access_key, maxExecutions: s.max_executions, expiresAt: s.expires_at, version: s.version, antiSkid: !!s.anti_skid, simpleProtection: !!s.simple_protection, allowedHwids: s.allowed_hwids, useAdgate: !!s.use_adgate, keySystemUrl: s.key_system_url }, 200, {}, request);
}
export async function handleUpdate(id, request, env) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401, {}, request);
    const s = await env.DB.prepare(`SELECT * FROM scripts WHERE id = ? AND (owner = ? OR (owner IS NULL AND ? = 'admin'))`).bind(id, admin.admin_name, admin.admin_name).first();
    if (!s) return json({ error: "Not found" }, 404, {}, request);
    const data = await request.json();
    const now = (new Date()).toISOString();
    await env.DB.prepare(`UPDATE scripts SET name=?, content=?, description=?, category=?, updated_at=?, is_private=?, access_key=?, max_executions=?, expires_at=?, anti_skid=?, simple_protection=?, allowed_hwids=?, use_adgate=?, key_system_url=? WHERE id=?`).bind(data.name || s.name, data.content || s.content, data.description ?? s.description, data.category || s.category, now, data.isPrivate !== void 0 ? data.isPrivate ? 1 : 0 : s.is_private, data.accessKey ?? s.access_key, data.maxExecutions ?? s.max_executions, data.expiresAt ?? s.expires_at, data.antiSkid !== void 0 ? data.antiSkid ? 1 : 0 : s.anti_skid, data.simpleProtection !== void 0 ? data.simpleProtection ? 1 : 0 : s.simple_protection, data.allowedHwids !== void 0 ? data.allowedHwids : s.allowed_hwids, data.useAdgate !== void 0 ? data.useAdgate ? 1 : 0 : s.use_adgate, data.keySystemUrl ?? s.key_system_url, id).run();
    if (data.isPrivate !== void 0 || data.accessKey !== void 0) {
        await env.DB.prepare(`DELETE FROM authorized_clients WHERE script_id = ?`).bind(id).run();
    }
    return json({ success: true }, 200, {}, request);
}
export async function handleDelete(id, request, env) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401, {}, request);
    const s = await env.DB.prepare(`SELECT id FROM scripts WHERE id = ? AND (owner = ? OR (owner IS NULL AND ? = 'admin'))`).bind(id, admin.admin_name, admin.admin_name).first();
    if (!s) return json({ error: "Not found" }, 404, {}, request);
    await env.DB.prepare(`DELETE FROM scripts WHERE id = ?`).bind(id).run();
    return json({ success: true }, 200, {}, request);
}
export async function handleToggle(id, request, env) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401, {}, request);
    const s = await env.DB.prepare(`SELECT is_enabled FROM scripts WHERE id = ? AND (owner = ? OR (owner IS NULL AND ? = 'admin'))`).bind(id, admin.admin_name, admin.admin_name).first();
    if (!s) return json({ error: "Not found" }, 404, {}, request);
    const newEnabled = s.is_enabled ? 0 : 1;
    let kick = 0;
    if (!newEnabled) {
        try {
            const body = await request.json();
            kick = body.kick ? 1 : 0;
        } catch { }
    }
    await env.DB.prepare(`UPDATE scripts SET is_enabled = ?, force_kick = ? WHERE id = ?`).bind(newEnabled, kick, id).run();
    statusCache.delete(`status:${id}`);
    return json({ success: true, isEnabled: !!newEnabled }, 200, {}, request);
}
export async function handleRaw(id, request, env, ctx) {
    const ua = request.headers.get("User-Agent") || "";
    const isRoblox = ua.toLowerCase().includes("roblox");
    const isPost = request.method === "POST";
    const urlObj = new URL(request.url);
    const errorRes = (msg, status) => {
        if (isPost) return text(msg, status, {}, request);
        if (!isRoblox) {
            return new Response(getErrorPortalHTML(msg, "This resource is unavailable.", status), {
                status,
                headers: { "Content-Type": "text/html; charset=utf-8", ...secureHeaders }
            });
        }
        return text(`${getDetailedUI("Access Restricted", `[${status}] ${msg}`)}\nwarn("[maxitom] ${msg}")`, status, {}, request);
    };
    const s = await env.DB.prepare(`
        SELECT s.*, a.disabled as owner_disabled 
        FROM scripts s 
        LEFT JOIN admins a ON s.owner = a.username 
        WHERE s.id = ?
    `).bind(id).first();
    if (!s) return errorRes("Script not found (404)", 404);
    let ownerDisabled = !!s.owner_disabled;
    if (s.owner && MANUAL_USERS[s.owner]) {
        if (MANUAL_USERS[s.owner].disabled) ownerDisabled = true;
    }
    if (ownerDisabled) return errorRes("Account suspended (403)", 403);
    if (!s.is_enabled) return errorRes("Script disabled (403)", 403);
    if (s.expires_at && new Date(s.expires_at) < new Date()) return errorRes("Script expired (403)", 403);
    const hwid = request.headers.get("X-M-ID") ||
        request.headers.get("Exploit-Guid") ||
        request.headers.get("Identifier") ||
        request.headers.get("HWID") || "";
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (request.method === "GET") {
        if (!isRoblox) {
            const statuses = [];
            if (s.is_private) statuses.push({ label: "Private w/ Key", color: "#9333ea" });
            if (s.anti_skid) statuses.push({ label: "Maximum Security", color: "#0070f3" });
            else if (s.simple_protection) statuses.push({ label: "Browser Blocked", color: "#ea580c" });
            if (statuses.length === 0) statuses.push({ label: "Normal", color: "#10b981" });
            return new Response(getScriptPortalHTML(s, statuses), { headers: { "Content-Type": "text/html; charset=utf-8", ...secureHeaders } });
        }
        if (s.anti_skid) {
            const ts = Date.now().toString();
            const hash = await generateLaunchToken(id, ts, getAdminKey(env));
            return text(getLauncher(urlObj.href, ts, hash, getStopUI), 200, {}, request);
        }
        if (s.is_private) {
            const sessionQuery = (hwid && hwid.length > 5) 
                ? `SELECT * FROM authorized_clients WHERE script_id = ? AND hwid = ? AND ip = ? AND expires_at > ?`
                : `SELECT * FROM authorized_clients WHERE script_id = ? AND ip = ? AND expires_at > ?`;
            const sessionParams = (hwid && hwid.length > 5) ? [id, hwid, ip, new Date().toISOString()] : [id, ip, new Date().toISOString()];
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
            const ts = request.headers.get("X-M-Ts");
            const hash = request.headers.get("X-M-T");
            if (!ts || !hash || Date.now() - parseInt(ts) > 3000) return text(getStopUI(), 200, {}, request);
            const expectedHash = await generateLaunchToken(id, ts, getAdminKey(env));
            if (expectedHash !== hash) return text(getStopUI(), 200, {}, request);
            const authHash = await generateDynamicToken(id, ts, getAdminKey(env));
            return text(getSecureLoader(urlObj.href, ts, authHash, getStopUI, getRVMRuntime), 200, {}, request);
        }
        const authHeader = request.headers.get("X-M-A");
        const clientKey = request.headers.get("X-M-K");
        if (s.is_private && s.access_key && !clientKey) {
            const sessionQuery = (hwid && hwid.length > 5) 
                ? `SELECT * FROM authorized_clients WHERE script_id = ? AND hwid = ? AND ip = ? AND expires_at > ?`
                : `SELECT * FROM authorized_clients WHERE script_id = ? AND ip = ? AND expires_at > ?`;
            const sessionParams = (hwid && hwid.length > 5) ? [id, hwid, ip, new Date().toISOString()] : [id, ip, new Date().toISOString()];
            const session = await env.DB.prepare(sessionQuery).bind(...sessionParams).first();
            if (session) {
                await recordStats(env, s, request, ctx);
                return text(s.content, 200, {}, request);
            }
            const ui = getKeySystemUI(id, urlObj.origin, s.key_system_url);
            if (authHeader && authHeader.includes(".")) {
                const [ts, hash] = authHeader.split(".");
                const encryptedUI = xxteaEncrypt(ui, hash + hwid);
                const packet = JSON.stringify([{ o: 0x05, d: encryptedUI }]);
                return text(xxteaEncrypt(packet, hash), 200, {}, request);
            }
            return text(ui, 200, {}, request);
        }
        if (s.is_private && s.access_key && clientKey !== s.access_key) {
            const tk = await env.DB.prepare(`SELECT * FROM temp_keys WHERE script_id = ? AND key_value = ? AND (ip = ? OR ip = 'unknown') AND expires_at > ?`).bind(id, clientKey, ip, new Date().toISOString()).first();
            if (!tk) return errorRes("Invalid key (401)", 401);
            await env.DB.prepare(`DELETE FROM temp_keys WHERE id = ?`).bind(tk.id).run();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await env.DB.prepare(`INSERT INTO authorized_clients (id, script_id, hwid, ip, expires_at) VALUES (?, ?, ?, ?, ?)`).bind(generateId(16), id, hwid, ip, expiresAt).run();
            await recordStats(env, s, request, ctx);
            return text(s.content, 200, {}, request);
        }
        if (!authHeader) {
            if (s.is_private && clientKey && clientKey === s.access_key) {
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                await env.DB.prepare(`INSERT INTO authorized_clients (id, script_id, hwid, ip, expires_at) VALUES (?, ?, ?, ?, ?)`).bind(generateId(16), id, hwid, ip, expiresAt).run();
                await recordStats(env, s, request, ctx);
                return text(s.content, 200, {}, request);
            }
            return errorRes("Unauthorized (401)", 401);
        }
        if (!authHeader.includes(".")) return errorRes("Unauthenticated access (403)", 403);
        const [ts, hash] = authHeader.split(".");
        if (Date.now() - parseInt(ts) > 2e3) return errorRes("Token expired (403)", 403);
        const expectedHash = await generateDynamicToken(id, ts, getAdminKey(env));
        if (expectedHash !== hash) return errorRes("Invalid token signature (403)", 403);
        if (usedTokens.has(authHeader)) return errorRes("Token already used (403)", 403);
        usedTokens.add(authHeader);
        setTimeout(() => usedTokens.delete(authHeader), 2e3);
        if (usedTokens.size > 500) {
            const half = [...usedTokens].slice(0, 250);
            half.forEach(t => usedTokens.delete(t));
        }
        if (s.max_executions && s.executions >= s.max_executions) return errorRes("Execution limit reached (403)", 403);
        if (s.allowed_hwids) {
            const list = s.allowed_hwids.split(",").map(h => h.trim()).filter(Boolean);
            if (list.length && hwid && !list.includes(hwid)) {
                return errorRes("HWID not authorized (403)", 403);
            }
        }
        await recordStats(env, s, request, ctx);
        let scriptSource = s.content;
        const killSwitch = s.anti_skid ? getKillSwitch(id, urlObj.origin) : "";
        const OPS = { GETG: 0x01, GETF: 0x02, PUSH: 0x03, CALL: 0x04, EXEC: 0x05, VCHK: 0x06 };
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
export async function handleDashboard(request, env, ctx, params) {
    const key = params?.key || new URL(request.url).pathname.split('/').pop();
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
export async function handleListAdmins(request, env) {
    const admin = await isAdmin(request, env);
    if (!admin || admin.admin_name !== 'admin') return json({ error: "Unauthorized" }, 401, {}, request);
    const dbAdmins = (await env.DB.prepare(`SELECT username, disabled FROM admins`).all()).results || [];
    const allAdmins = [...dbAdmins];
    for (const [username, data] of Object.entries(MANUAL_USERS)) {
        if (!allAdmins.find(a => a.username === username)) {
            allAdmins.push({
                username,
                disabled: data.disabled,
                isStatic: true
            });
        }
    }
    return json({ admins: allAdmins }, 200, {}, request);
}
export async function handleAddAdmin(request, env) {
    const admin = await isAdmin(request, env);
    if (!admin || admin.admin_name !== 'admin') return json({ error: "Unauthorized" }, 401, {}, request);
    const { username, password } = await request.json();
    if (!username || !password) return json({ error: "Missing fields" }, 400, {}, request);
    const h = await hashPassword(password);
    try {
        await env.DB.prepare(`INSERT INTO admins (username, password_hash, disabled) VALUES (?, ?, 0)`).bind(username, h).run();
        return json({ success: true }, 200, {}, request);
    } catch (e) {
        return json({ error: "User already exists or DB error" }, 400, {}, request);
    }
}
export async function handleToggleAdmin(request, env, username) {
    const admin = await isAdmin(request, env);
    if (!admin || admin.admin_name !== 'admin') return json({ error: "Unauthorized" }, 401, {}, request);
    if (username === 'admin') return json({ error: "Cannot disable superadmin" }, 403, {}, request);
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
export async function handleChangeAdminPassword(request, env, username) {
    const admin = await isAdmin(request, env);
    if (!admin || admin.admin_name !== 'admin') return json({ error: "Unauthorized" }, 401, {}, request);
    const { password } = await request.json();
    if (!password) return json({ error: "Password required" }, 400, {}, request);
    const h = await hashPassword(password);
    await env.DB.prepare(`UPDATE admins SET password_hash = ? WHERE username = ?`).bind(h, username).run();
    await env.DB.prepare(`DELETE FROM sessions WHERE admin_name = ?`).bind(username).run();
    return json({ success: true }, 200, {}, request);
}
export async function handleGetProfile(request, env) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401, {}, request);
    let row;
    try {
        row = await env.DB.prepare(`SELECT username, discord_id, avatar, totp_enabled, totp_secret, password_hash FROM admins WHERE username = ?`).bind(admin.admin_name).first();
        if (row) row.has_secret = !!row.totp_secret;
    } catch (e) {
        row = await env.DB.prepare(`SELECT username, discord_id, avatar FROM admins WHERE username = ?`).bind(admin.admin_name).first();
        if (row) { row.totp_enabled = 0; row.has_secret = false; }
    }
    if (!row) {
        row = { username: admin.admin_name, discord_id: null, avatar: null, totp_enabled: 0, password_hash: null };
    }
    if (!row.password_hash || row.password_hash === 'static_account' || row.password_hash === 'dummy') {
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let newPass = "";
        for (let i = 0; i < 12; i++) newPass += charset.charAt(Math.floor(Math.random() * charset.length));
        const h = await hashPassword(newPass);
        await env.DB.prepare('INSERT OR REPLACE INTO admins (username, password_hash, discord_id, avatar, totp_enabled, totp_secret) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(row.username, h, row.discord_id, row.avatar, row.totp_enabled || 0, row.totp_secret || null).run();
        row.current_password = newPass; 
    } else {
        row.current_password = "••••••••••••"; 
    }
    delete row.password_hash;
    return json({ user: row }, 200, {}, request);
}
export async function handleUpdatePassword(request, env) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401, {}, request);
    const { password } = await request.json();
    if (!password || password.length < 4) return json({ error: "Password too short" }, 400, {}, request);
    const h = await hashPassword(password);
    await env.DB.prepare(`UPDATE admins SET password_hash = ? WHERE username = ?`).bind(h, admin.admin_name).run();
    return json({ success: true }, 200, {}, request);
}
export async function handleDiscordLogin(request, env) {
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
export async function handleDiscordCallback(request, env, ctx) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
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
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri
            })
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);
        const userRes = await fetch('https://discord.com/api/users/@me', {
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
            ctx.waitUntil(sendWebhook(env, 'MAXITOM', {
                title: '🆕 New Platform Registration',
                description: `A new user has registered via Discord and gained administrative access.`,
                color: 0x3b82f6, 
                fields: [
                    { name: 'Username', value: `\`${username}\``, inline: true },
                    { name: 'Discord ID', value: `\`${discordId}\``, inline: true },
                    { name: 'IP Address', value: `\`${ip}\``, inline: true },
                    { name: 'Location', value: `\`${request.cf?.city || 'Unknown'}\`, \`${request.cf?.country || 'Unknown'}\``, inline: false }
                ],
                footer: `Maxitom • Registry Updated`
            }));
        }
        if (admin.disabled) {
            return new Response(`
                <script>
                    alert("Unauthorized: Your account (${username}) is currently suspended.");
                    window.location.href = "/";
                </script>
            `, { headers: { 'Content-Type': 'text/html' } });
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
export async function handleVerify2FA(request, env) {
    const { username, attemptToken, code } = await request.json();
    if (!username || !attemptToken || !code) return json({ error: "Missing data" }, 400);
    const session = await env.DB.prepare('SELECT * FROM sessions WHERE id = ? AND admin_name = ?')
        .bind(attemptToken, username).first();
    if (!session || Date.now() > session.expires_at) {
        return json({ error: "Attempt expired" }, 401);
    }
    const admin = await env.DB.prepare('SELECT totp_secret FROM admins WHERE username = ?')
        .bind(username).first();
    const { verifyTOTP } = await import('./utils/crypto.js');
    const isValid = await verifyTOTP(admin.totp_secret, code);
    if (!isValid) return json({ error: "Invalid 2FA code" }, 401);
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(attemptToken).run();
    const sessionId = generateSessionId();
    await env.DB.prepare('INSERT INTO sessions (id, admin_name, expires_at) VALUES (?, ?, ?)')
        .bind(sessionId, username, Date.now() + 86400000).run();
    return json({ success: true }, 200, {
        'Set-Cookie': `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400; Secure`
    });
}
export async function handleSetup2FA(request, env) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401);
    const adminName = admin.admin_name || admin.username;
    const existing = await env.DB.prepare('SELECT totp_secret, totp_enabled FROM admins WHERE username = ?').bind(adminName).first();
    if (existing && existing.totp_secret) {
        return json({ success: true, secret: existing.totp_secret, alreadyConfigured: true });
    }
    const { generateTOTPSecret } = await import('./utils/crypto.js');
    const secret = generateTOTPSecret();
    try {
        await env.DB.prepare('ALTER TABLE admins ADD COLUMN totp_secret TEXT').run();
        await env.DB.prepare('ALTER TABLE admins ADD COLUMN totp_enabled INTEGER DEFAULT 0').run();
    } catch(e) {}
    await env.DB.prepare('INSERT OR IGNORE INTO admins (username, password_hash, disabled) VALUES (?, ?, 0)')
        .bind(adminName, 'static_account').run();
    await env.DB.prepare('UPDATE admins SET totp_secret = ? WHERE username = ?')
        .bind(secret, adminName).run();
    const qrUrl = `otpauth://totp/Maxitom:${adminName}?secret=${secret}&issuer=Maxitom`;
    return json({ success: true, secret, qrUrl, alreadyConfigured: false });
}
export async function handleDisable2FA(request, env) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401);
    const { code } = await request.json();
    if (!code) return json({ error: "Verification code required to disable 2FA" }, 400);
    const adminName = admin.admin_name || admin.username;
    const row = await env.DB.prepare('SELECT totp_secret FROM admins WHERE username = ?').bind(adminName).first();
    if (!row || !row.totp_secret) return json({ error: "2FA is not configured" }, 400);
    const { verifyTOTP } = await import('./utils/crypto.js');
    const valid = await verifyTOTP(row.totp_secret, code);
    if (!valid) return json({ error: "Invalid verification code" }, 400);
    await env.DB.prepare('UPDATE admins SET totp_enabled = 0 WHERE username = ?').bind(adminName).run();
    return json({ success: true });
}
export async function handleConfirm2FA(request, env) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401);
    const adminName = admin.admin_name || admin.username;
    if (admin.totp_enabled) return json({ error: "2FA is already enabled." }, 403);
    const { code } = await request.json();
    const dbAdmin = await env.DB.prepare('SELECT totp_secret FROM admins WHERE username = ?')
        .bind(adminName).first();
    const { verifyTOTP } = await import('./utils/crypto.js');
    const isValid = await verifyTOTP(dbAdmin?.totp_secret, code);
    if (!isValid) return json({ error: "Invalid code" }, 400);
    await env.DB.prepare('UPDATE admins SET totp_enabled = 1 WHERE username = ?')
        .bind(adminName).run();
    return json({ success: true });
}

// Xutions Analytics Handlers
const MAX_PROJECTS_PER_USER = 10;
const MAX_FIELD_LEN = 200;
const MAX_METADATA_LEN = 512;
const TRACK_WINDOW = 60000;
const TRACK_MAX_PER_IP = 10;
const DEDUP_WINDOW = 10000;

const trackLimits = new Map();
const recentHits = new Map();

function cors(request) {
    const origin = request?.headers?.get("Origin") || "";
    return {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin'
    };
}

function makeId(len = 8) {
    const pool = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => pool[b % pool.length]).join('');
}

async function digestIP(raw) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

function truncate(s, max) {
    if (!s || typeof s !== 'string') return null;
    return s.substring(0, max);
}

function isRateLimited(ip) {
    if (!ip) return false;
    const now = Date.now();

    if (trackLimits.size > 5000) {
        for (const [k, v] of trackLimits) {
            if (now > v.reset) trackLimits.delete(k);
        }
    }

    const entry = trackLimits.get(ip);
    if (!entry || now > entry.reset) {
        trackLimits.set(ip, { count: 1, reset: now + TRACK_WINDOW });
        return false;
    }
    if (entry.count >= TRACK_MAX_PER_IP) return true;
    entry.count++;
    return false;
}

function isDuplicate(projectId, ipHash) {
    const now = Date.now();
    const key = `${projectId}:${ipHash}`;

    if (recentHits.size > 10000) {
        for (const [k, ts] of recentHits) {
            if (now - ts > DEDUP_WINDOW) recentHits.delete(k);
        }
    }

    const last = recentHits.get(key);
    if (last && now - last < DEDUP_WINDOW) return true;
    recentHits.set(key, now);
    return false;
}

export async function handleAntigravityGetMe(request, env) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401);

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

export async function handleAntigravityLogout(request, env) {
    // For now, just return success since Maxitom handles its own auth
    return json({ success: true }, 200, cors(request));
}

export async function handleAntigravityCreateProject(request, env) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401);

    try {
        const body = await request.json();
        const name = truncate(body.name, MAX_FIELD_LEN);
        const description = truncate(body.description, MAX_METADATA_LEN);

        if (!name) return json({ error: "Name required" }, 400, cors(request));

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

export async function handleAntigravityTrack(request, env) {
    const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

    const ip = request.headers.get("X-Zen-Client-IP") || request.headers.get("CF-Connecting-IP") || "0.0.0.0";
    const country = (request.headers.get("X-Zen-Country") || request.headers.get("CF-IPCountry") || "").toUpperCase().substring(0, 2) || null;

    if (isRateLimited(ip)) {
        return json({ error: "Rate limited" }, 429, h);
    }

    try {
        const body = await request.json();
        const apiKey = body.apiKey;
        if (!apiKey || typeof apiKey !== 'string') return json({ error: "Missing key" }, 400, h);

        const proj = await env.DB.prepare(
            "SELECT project_id, status FROM hub_projects WHERE api_key = ?"
        ).bind(apiKey).first();

        if (!proj) return json({ error: "Invalid key" }, 403, h);
        if (proj.status !== 'ACTIVE') return json({ error: "Inactive" }, 403, h);

        const hash = await digestIP(ip);

        if (isDuplicate(proj.project_id, hash)) {
            return json({ success: true, deduplicated: true }, 200, h);
        }

        const eventType = truncate(body.eventType, MAX_FIELD_LEN) || 'PING';
        const day = new Date().toISOString().split('T')[0];
        const hour = new Date().getUTCHours().toString();
        const cc = country || '??';

        let isUnique = false;
        try {
            await env.DB.prepare("INSERT INTO hub_unique_ips (project_id, ip_hash) VALUES (?, ?)").bind(proj.project_id, hash).run();
            isUnique = true;
        } catch (e) {}

        const vals = [
            `(?1, 'total', 'all', 1)`,
            `(?1, 'daily', ?2, 1)`,
            `(?1, 'hourly', ?3, 1)`,
            `(?1, 'type', ?4, 1)`,
            `(?1, 'country', ?5, 1)`
        ];
        if (isUnique) vals.push(`(?1, 'total', 'unique', 1)`);

        const query = `
            INSERT INTO hub_project_stats (project_id, stat_type, stat_key, count)
            VALUES ${vals.join(', ')}
            ON CONFLICT(project_id, stat_type, stat_key) DO UPDATE SET count = count + 1
        `;

        await env.DB.prepare(query).bind(proj.project_id, day, hour, eventType, cc).run();

        return json({ success: true }, 200, h);
    } catch (e) {
        return json({ error: "Bad request" }, 400, h);
    }
}

export async function handleAntigravityDiscordLogin(request, env) {
    // For now, redirect to Antigravity's Discord auth
    const url = new URL(request.url);
    return new Response(null, {
        status: 302,
        headers: { "Location": `${url.origin}/api/auth/discord` }
    });
}

export async function handleAntigravityDiscordCallback(request, env) {
    // For now, redirect to Maxitom's Discord callback
    const url = new URL(request.url);
    return new Response(null, {
        status: 302,
        headers: { "Location": `${url.origin}/api/auth/discord/callback` }
    });
}

export async function handleAntigravityDeleteProject(request, env, projectId) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401);

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

export async function handleAntigravityUpdateProject(request, env, projectId) {
    const admin = await isAdmin(request, env);
    if (!admin) return json({ error: "Unauthorized" }, 401);

    try {
        const body = await request.json();
        const name = truncate(body.name, MAX_FIELD_LEN);
        const description = truncate(body.description, MAX_METADATA_LEN);
        const status = body.status;

        if (!name) return json({ error: "Name required" }, 400, cors(request));

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

export async function handleAntigravityGetStats(request, env, projectId) {
    try {
        const proj = await env.DB.prepare(
            "SELECT * FROM hub_projects WHERE project_id = ?"
        ).bind(projectId).first();

        if (!proj) return json({ error: "Not found" }, 404, cors(request));

        const stats = {};
        const statRows = await env.DB.prepare(
            "SELECT stat_type, stat_key, count FROM hub_project_stats WHERE project_id = ?"
        ).bind(projectId).all();

        for (const row of statRows.results || []) {
            if (!stats[row.stat_type]) stats[row.stat_type] = {};
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

export async function handleAntigravityGetActivity(request, env, projectId) {
    try {
        const proj = await env.DB.prepare(
            "SELECT * FROM hub_projects WHERE project_id = ?"
        ).bind(projectId).first();

        if (!proj) return json({ error: "Not found" }, 404, cors(request));

        const activity = { daily: [], hourly: [], types: [], countries: [] };

        // Get daily activity
        const dailyRows = await env.DB.prepare(
            "SELECT stat_key, count FROM hub_project_stats WHERE project_id = ? AND stat_type = 'daily' ORDER BY stat_key"
        ).bind(projectId).all();

        for (const row of dailyRows.results || []) {
            activity.daily.push({ date: row.stat_key, count: row.count });
        }

        // Get hourly activity
        const hourlyRows = await env.DB.prepare(
            "SELECT stat_key, count FROM hub_project_stats WHERE project_id = ? AND stat_type = 'hourly' ORDER BY stat_key"
        ).bind(projectId).all();

        for (const row of hourlyRows.results || []) {
            activity.hourly.push({ hour: parseInt(row.stat_key), count: row.count });
        }

        // Get event types
        const typeRows = await env.DB.prepare(
            "SELECT stat_key, count FROM hub_project_stats WHERE project_id = ? AND stat_type = 'type' ORDER BY count DESC"
        ).bind(projectId).all();

        for (const row of typeRows.results || []) {
            activity.types.push({ type: row.stat_key, count: row.count });
        }

        // Get countries
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
