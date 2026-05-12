import { Router } from './shared/router.js';
import * as handlers from './handlers.js';
import { getDetailedUI } from './shared/ui.js';

const router = new Router();

// Dashboard Route
router.add('GET', '/zen', (req, env, ctx) => {
    return handlers.handleDashboard(req, env, ctx, { key: env.ADMIN_KEY });
});

// Auth Routes
router.add('POST', '/api/login', handlers.handleLogin);
router.add('POST', '/api/logout', handlers.handleLogout);
router.add('GET', '/api/checkAuth', handlers.handleCheckAuth);

// Discord OAuth
router.add('GET', '/api/auth/discord', handlers.handleDiscordLogin);
router.add('GET', '/api/auth/discord/callback', handlers.handleDiscordCallback);

// Admin Profile
router.add('GET', '/api/me', handlers.handleGetProfile);
router.add('POST', '/api/me/password', handlers.handleUpdatePassword);
router.add('GET', '/api/admins', handlers.handleListAdmins);
router.add('POST', '/api/admins', handlers.handleAddAdmin);
router.add('POST', '/api/admins/:id/toggle', (req, env, ctx, params) => handlers.handleToggleAdmin(req, env, params.id));
router.add('POST', '/api/admins/:id/password', (req, env, ctx, params) => handlers.handleChangeAdminPassword(req, env, params.id));

// 2FA Routes
router.add('POST', '/api/auth/2fa/setup', handlers.handleSetup2FA);
router.add('POST', '/api/auth/2fa/confirm', handlers.handleConfirm2FA);
router.add('POST', '/api/auth/2fa/verify', handlers.handleVerify2FA);
router.add('POST', '/api/auth/2fa/disable', handlers.handleDisable2FA);

// Script Management
router.add('POST', '/api/upload', handlers.handleUpload);
router.add('GET', '/api/scripts', handlers.handleList);
router.add('GET', '/api/active_users', handlers.handleActiveUsers);

// Script Operations
router.add('GET', '/api/script/:id', (req, env, ctx, params) => handlers.handleGet(params.id, req, env));
router.add('PUT', '/api/script/:id', (req, env, ctx, params) => handlers.handleUpdate(params.id, req, env));
router.add('DELETE', '/api/script/:id', (req, env, ctx, params) => handlers.handleDelete(params.id, req, env));
router.add('POST', '/api/script/:id/toggle', (req, env, ctx, params) => handlers.handleToggle(params.id, req, env));
router.add('POST', '/api/script/:id/message', (req, env, ctx, params) => handlers.handleMessage(params.id, req, env));
router.add('GET', '/api/script/:id/status', (req, env, ctx, params) => handlers.handleStatus(params.id, req, env));
router.add('POST', '/api/script/:id/ticket', (req, env, ctx, params) => handlers.handleTicket(params.id, req, env));

// User Actions
router.add('POST', '/api/user/:id/action', (req, env, ctx, params) => handlers.handleUserAction(params.id, req, env));

// Checkpoint/Raw Execution
router.add('POST', '/api/checkpoint/verify', handlers.handleCheckpoint);
router.add('GET', '/raw/:id', (req, env, ctx, params) => handlers.handleRaw(params.id, req, env, ctx));
router.add('POST', '/raw/:id', (req, env, ctx, params) => handlers.handleRaw(params.id, req, env, ctx));

// Antigravity Analytics Routes
router.add('GET', '/api/antigravity/me', handlers.handleAntigravityGetMe);
router.add('POST', '/api/antigravity/logout', handlers.handleAntigravityLogout);
router.add('POST', '/api/antigravity/projects', handlers.handleAntigravityCreateProject);
router.add('POST', '/api/antigravity/track', handlers.handleAntigravityTrack);
router.add('GET', '/api/antigravity/auth/discord', handlers.handleAntigravityDiscordLogin);
router.add('GET', '/api/antigravity/auth/discord/callback', handlers.handleAntigravityDiscordCallback);
router.add('DELETE', '/api/antigravity/projects/:id', (req, env, ctx, params) => handlers.handleAntigravityDeleteProject(req, env, params.id));
router.add('PUT', '/api/antigravity/projects/:id', (req, env, ctx, params) => handlers.handleAntigravityUpdateProject(req, env, params.id));
router.add('GET', '/api/antigravity/stats/:id', (req, env, ctx, params) => handlers.handleAntigravityGetStats(req, env, params.id));
router.add('GET', '/api/antigravity/activity/:id', (req, env, ctx, params) => handlers.handleAntigravityGetActivity(req, env, params.id));

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const isRoblox = (request.headers.get("User-Agent") || "").toLowerCase().includes("roblox");

        try {
            if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/raw/') || url.pathname === '/zen') {
                const response = await router.handle(request, env, ctx);
                if (response) return response;
                
                if (isRoblox) {
                    return new Response(`${getDetailedUI("Invalid Endpoint", "The requested URL does not belong to the network.")}\nwarn("[maxitom] 404 Not Found")`, {
                        status: 404,
                        headers: { "Content-Type": "text/plain; charset=utf-8" }
                    });
                }
                return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: { 'Content-Type': 'application/json' } });
            }

            if (env.ASSETS) {
                return env.ASSETS.fetch(request);
            }
            return new Response("Standalone Antigravity Ready (No Assets Bound)", { status: 200 });
            
        } catch (e) {
            console.error("Critical Error:", e);
            return new Response(JSON.stringify({ error: "Internal Server Error", details: e.message }), { 
                status: 500, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }
    }
};
