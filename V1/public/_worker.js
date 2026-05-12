export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (path.startsWith("/api/antigravity/")) {
            const apiPath = path.replace("/api/antigravity/", "");
            
            if (apiPath === "me") return handleGetMe(request, env);
            if (apiPath === "logout" && request.method === "POST") return handleLogout(request, env);
            if (apiPath === "projects" && request.method === "POST") return handleCreateProject(request, env);
            if (apiPath === "track" && request.method === "POST") return handleTrack(request, env);
            if (apiPath === "auth/discord") return handleDiscordLogin(request, env);
            if (apiPath === "auth/discord/callback") return handleDiscordCallback(request, env);

            const projectsMatch = apiPath.match(/^projects\/([^\/]+)$/);
            if (projectsMatch) {
                const id = projectsMatch[1];
                if (request.method === "DELETE") return handleDeleteProject(request, env, { id });
                if (request.method === "PATCH" || request.method === "PUT") return handleUpdateProject(request, env, { id });
            }

            const statsMatch = apiPath.match(/^stats\/([^\/]+)$/);
            if (statsMatch) return handleGetStats(request, env, { id: statsMatch[1] });

            const activityMatch = apiPath.match(/^activity\/([^\/]+)$/);
            if (activityMatch) return handleGetActivity(request, env, { id: activityMatch[1] });

            return new Response('Not found', { status: 404 });
        }

        if (path.startsWith("/api/")) {
            return new Response('Not found', { status: 404 });
        }

        const asset = await env.ASSETS.fetch(request);

        if (asset.status === 404) {
            const idx = await env.ASSETS.fetch(new URL("/", request.url));
            return new Response(idx.body, {
                status: 200,
                headers: idx.headers
            });
        }

        return asset;
    }
};
export function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    });
}

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

async function logWebhook(env, embed) {
    const url = env.ANTIGRAVITY_LOG_WEBHOOK;
    if (!url) return;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{ color: 0x10b981, timestamp: new Date().toISOString(), ...embed }]
            })
        });
    } catch (e) { }
}

let ready = false;
async function bootstrap(env) {
    if (ready) return;
    await env.DB.batch([
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS hub_projects (
            project_id TEXT PRIMARY KEY, owner_id TEXT, name TEXT NOT NULL,
            description TEXT, api_key TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'ACTIVE', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS hub_project_stats (
            project_id TEXT NOT NULL,
            stat_type TEXT NOT NULL,
            stat_key TEXT NOT NULL,
            count INTEGER DEFAULT 0,
            PRIMARY KEY (project_id, stat_type, stat_key)
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS hub_unique_ips (
            project_id TEXT NOT NULL,
            ip_hash TEXT NOT NULL,
            PRIMARY KEY (project_id, ip_hash)
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS admins (
            username TEXT PRIMARY KEY,
            discord_id TEXT UNIQUE,
            avatar TEXT,
            disabled INTEGER DEFAULT 0,
            password_hash TEXT
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            expires_at INTEGER,
            admin_name TEXT,
            FOREIGN KEY(admin_name) REFERENCES admins(username)
        )`)
    ]);

    try {
        const check = await env.DB.prepare("SELECT 1 FROM hub_project_stats LIMIT 1").first();
        if (!check) {
            await env.DB.batch([
                env.DB.prepare(`INSERT OR IGNORE INTO hub_project_stats (project_id, stat_type, stat_key, count) SELECT project_id, 'total', 'all', COUNT(*) FROM hub_events GROUP BY project_id`),
                env.DB.prepare(`INSERT OR IGNORE INTO hub_project_stats (project_id, stat_type, stat_key, count) SELECT project_id, 'total', 'unique', COUNT(DISTINCT ip_hash) FROM hub_events GROUP BY project_id`),
                env.DB.prepare(`INSERT OR IGNORE INTO hub_project_stats (project_id, stat_type, stat_key, count) SELECT project_id, 'daily', DATE(created_at), COUNT(*) FROM hub_events GROUP BY project_id, DATE(created_at)`),
                env.DB.prepare(`INSERT OR IGNORE INTO hub_project_stats (project_id, stat_type, stat_key, count) SELECT project_id, 'hourly', CAST(strftime('%H', created_at) AS INTEGER), COUNT(*) FROM hub_events GROUP BY project_id, CAST(strftime('%H', created_at) AS INTEGER)`),
                env.DB.prepare(`INSERT OR IGNORE INTO hub_project_stats (project_id, stat_type, stat_key, count) SELECT project_id, 'type', event_type, COUNT(*) FROM hub_events GROUP BY project_id, event_type`),
                env.DB.prepare(`INSERT OR IGNORE INTO hub_project_stats (project_id, stat_type, stat_key, count) SELECT project_id, 'country', IFNULL(country, '??'), COUNT(*) FROM hub_events WHERE country IS NOT NULL AND country != '' GROUP BY project_id, country`),
                env.DB.prepare(`INSERT OR IGNORE INTO hub_unique_ips (project_id, ip_hash) SELECT DISTINCT project_id, ip_hash FROM hub_events`)
            ]);
        }
    } catch (e) { }

    ready = true;
}

async function getSession(request, env) {
    // MOCK FOR TESTING
    return {
        admin_name: "Tester",
        discord_id: "123456789",
        avatar: null,
        expires_at: Date.now() + 86400000
    };
    /*
    const c = request.headers.get("Cookie") || "";
    const m = c.match(/xut_sid=([^;]+)/);
    if (!m) return null;

    const row = await env.DB.prepare(`
        SELECT s.*, a.discord_id, a.avatar
        FROM sessions s LEFT JOIN admins a ON s.admin_name = a.username
        WHERE s.id = ?
    `).bind(m[1]).first();

    if (!row || row.expires_at < Date.now()) return null;
    return row;
    */
}

export async function handleDiscordLogin(request, env) {
    // REDIRECT DIRECTLY FOR TESTING
    return new Response(null, {
        status: 302,
        headers: { "Location": new URL(request.url).origin }
    });
}

export async function handleDiscordCallback(request, env) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const saved = (request.headers.get("Cookie") || "").match(/xut_oauth=([^;]+)/)?.[1];

    if (!code || !state || state !== saved) {
        return new Response('Invalid state', { status: 403 });
    }

    const origin = new URL(request.url).origin;
    const redirect = `${origin}/api/antigravity/auth/discord/callback`;

    try {
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: env.DISCORD_CLIENT_ID,
                client_secret: env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code, redirect_uri: redirect
            })
        });
        const tokens = await tokenRes.json();
        if (tokens.error) throw new Error('OAuth exchange failed');

        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        const u = await userRes.json();
        if (!u.id) throw new Error('Failed to fetch identity');

        const avatar = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : null;

        await env.DB.prepare(`
            INSERT INTO admins (username, discord_id, avatar, disabled, password_hash)
            VALUES (?, ?, ?, 0, 'xutions_user')
            ON CONFLICT(username) DO UPDATE SET discord_id = ?, avatar = ?
        `).bind(u.username, u.id, avatar, u.id, avatar).run();

        const sid = makeId(32);
        const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
        await env.DB.prepare(`INSERT INTO sessions (id, expires_at, admin_name) VALUES (?, ?, ?)`).bind(sid, exp, u.username).run();

        await logWebhook(env, {
            title: 'User Login',
            description: `**${u.username}** logged in`,
            thumbnail: avatar ? { url: avatar } : undefined,
            fields: [{ name: 'Discord ID', value: u.id, inline: true }]
        });

        return new Response(null, {
            status: 302,
            headers: {
                "Location": new URL(request.url).origin,
                "Set-Cookie": `xut_sid=${sid}; Path=/; HttpOnly; SameSite=None; Max-Age=604800; Secure`
            }
        });
    } catch (e) {
        return new Response('Authentication failed', { status: 500 });
    }
}

export async function handleGetMe(request, env) {
    const user = await getSession(request, env);
    if (!user) return json({ authenticated: false }, 401, cors(request));

    await bootstrap(env);

    const rows = await env.DB.prepare(
        "SELECT project_id, name, description, api_key, status, created_at FROM hub_projects WHERE owner_id = ? ORDER BY created_at DESC"
    ).bind(user.discord_id).all();

    return json({
        authenticated: true,
        user: { username: user.admin_name, avatar: user.avatar },
        projects: rows.results || []
    }, 200, cors(request));
}

export async function handleCreateProject(request, env) {
    const user = await getSession(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401, cors(request));

    const body = await request.json();
    const name = truncate(body.name?.trim(), 80);
    const description = truncate(body.description?.trim(), 200);
    if (!name) return json({ error: "Name required" }, 400, cors(request));

    await bootstrap(env);

    const count = await env.DB.prepare(
        "SELECT COUNT(*) as c FROM hub_projects WHERE owner_id = ?"
    ).bind(user.discord_id).first();

    if ((count?.c || 0) >= MAX_PROJECTS_PER_USER) {
        return json({ error: `Maximum ${MAX_PROJECTS_PER_USER} projects reached` }, 400, cors(request));
    }

    const pid = makeId(12);
    const key = "xut_" + makeId(32);

    await env.DB.prepare(
        "INSERT INTO hub_projects (project_id, owner_id, name, description, api_key) VALUES (?, ?, ?, ?, ?)"
    ).bind(pid, user.discord_id, name, description || "", key).run();

    await logWebhook(env, {
        title: 'Project Created',
        fields: [
            { name: 'Name', value: name, inline: true },
            { name: 'ID', value: `\`${pid}\``, inline: true },
            { name: 'Owner', value: `${user.admin_name} (\`${user.discord_id}\`)`, inline: false },
            { name: 'Description', value: description || 'None', inline: false }
        ]
    });

    return json({ success: true, projectId: pid, apiKey: key }, 200, cors(request));
}

export async function handleDeleteProject(request, env, params) {
    const user = await getSession(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401, cors(request));

    const pid = params.id;
    if (!pid) return json({ error: "Missing ID" }, 400, cors(request));

    await bootstrap(env);

    const proj = await env.DB.prepare(
        "SELECT project_id, name, owner_id FROM hub_projects WHERE project_id = ?"
    ).bind(pid).first();

    if (!proj) return json({ error: "Not found" }, 404, cors(request));
    if (proj.owner_id !== user.discord_id) return json({ error: "Forbidden" }, 403, cors(request));

    await env.DB.batch([
        env.DB.prepare("DELETE FROM hub_project_stats WHERE project_id = ?").bind(pid),
        env.DB.prepare("DELETE FROM hub_unique_ips WHERE project_id = ?").bind(pid),
        env.DB.prepare("DELETE FROM hub_projects WHERE project_id = ?").bind(pid)
    ]);
    try { await env.DB.prepare("DELETE FROM hub_events WHERE project_id = ?").bind(pid).run(); } catch(e){}

    await logWebhook(env, {
        title: 'Project Deleted',
        color: 0xef4444,
        fields: [
            { name: 'Name', value: proj.name, inline: true },
            { name: 'ID', value: `\`${pid}\``, inline: true },
            { name: 'Owner', value: `${user.admin_name} (\`${user.discord_id}\`)`, inline: false }
        ]
    });

    return json({ success: true }, 200, cors(request));
}

export async function handleTrack(request, env) {
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

        await bootstrap(env);

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

export async function handleUpdateProject(request, env, params) {
    const user = await getSession(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401, cors(request));

    const pid = params.id;
    if (!pid) return json({ error: "Missing ID" }, 400, cors(request));

    const body = await request.json();
    const name = truncate(body.name?.trim(), 80);
    const description = truncate(body.description?.trim(), 200);

    if (!name) return json({ error: "Name required" }, 400, cors(request));

    await bootstrap(env);

    const proj = await env.DB.prepare(
        "SELECT project_id, owner_id FROM hub_projects WHERE project_id = ?"
    ).bind(pid).first();

    if (!proj) return json({ error: "Not found" }, 404, cors(request));
    if (proj.owner_id !== user.discord_id) return json({ error: "Forbidden" }, 403, cors(request));

    await env.DB.prepare(
        "UPDATE hub_projects SET name = ?, description = ? WHERE project_id = ?"
    ).bind(name, description || "", pid).run();

    return json({ success: true }, 200, cors(request));
}

export async function handleGetStats(request, env, params) {
    const pid = params.id;
    if (!pid) return json({ error: "Missing ID" }, 400, cors(request));

    await bootstrap(env);

    const proj = await env.DB.prepare(
        "SELECT name, description, created_at, status, owner_id FROM hub_projects WHERE project_id = ?"
    ).bind(pid).first();

    if (!proj) return json({ error: "Not found" }, 404, cors(request));

    const owner = await env.DB.prepare("SELECT username FROM admins WHERE discord_id = ?").bind(proj.owner_id).first();

    const dayAgo = new Date().toISOString().split('T')[0];

    const [totalRes, uniqueRes, dailyRes] = await Promise.all([
        env.DB.prepare("SELECT count FROM hub_project_stats WHERE project_id = ? AND stat_type = 'total' AND stat_key = 'all'").bind(pid).first(),
        env.DB.prepare("SELECT count FROM hub_project_stats WHERE project_id = ? AND stat_type = 'total' AND stat_key = 'unique'").bind(pid).first(),
        env.DB.prepare("SELECT count FROM hub_project_stats WHERE project_id = ? AND stat_type = 'daily' AND stat_key = ?").bind(pid, dayAgo).first()
    ]);

    return json({
        name: proj.name, description: proj.description,
        createdAt: proj.created_at, status: proj.status,
        creator: owner?.username || "Anonymous",
        stats: { 
            total: totalRes?.count || 0, 
            unique: uniqueRes?.count || 0, 
            daily: dailyRes?.count || 0 
        }
    }, 200, cors(request));
}

export async function handleGetActivity(request, env, params) {
    const pid = params.id;
    if (!pid) return json({ error: "Missing ID" }, 400, cors(request));

    await bootstrap(env);

    const proj = await env.DB.prepare(
        "SELECT project_id FROM hub_projects WHERE project_id = ?"
    ).bind(pid).first();

    if (!proj) return json({ error: "Not found" }, 404, cors(request));

    const cutoffDay = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [daily, hourly, types, countries] = await Promise.all([
        env.DB.prepare(`
            SELECT stat_key as day, count as n
            FROM hub_project_stats 
            WHERE project_id = ? AND stat_type = 'daily' AND stat_key >= ?
            ORDER BY day ASC
        `).bind(pid, cutoffDay).all(),

        env.DB.prepare(`
            SELECT CAST(stat_key AS INTEGER) as hr, count as n
            FROM hub_project_stats WHERE project_id = ? AND stat_type = 'hourly'
            ORDER BY hr ASC
        `).bind(pid).all(),

        env.DB.prepare(`
            SELECT stat_key as t, count as n
            FROM hub_project_stats WHERE project_id = ? AND stat_type = 'type'
            ORDER BY n DESC LIMIT 10
        `).bind(pid).all(),

        env.DB.prepare(`
            SELECT stat_key as cc, count as n
            FROM hub_project_stats WHERE project_id = ? AND stat_type = 'country' AND stat_key != '??'
            ORDER BY n DESC LIMIT 50
        `).bind(pid).all()
    ]);

    return json({
        daily: daily.results || [],
        hourly: hourly.results || [],
        types: types.results || [],
        countries: countries.results || []
    }, 200, cors(request));
}

export async function handleLogout(request, env) {
    const c = request.headers.get("Cookie") || "";
    const m = c.match(/xut_sid=([^;]+)/);
    if (m) {
        await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(m[1]).run();
    }
    return json({ success: true }, 200, {
        ...cors(request),
        "Set-Cookie": "xut_sid=; Path=/; HttpOnly; SameSite=None; Max-Age=0; Secure"
    });
}
