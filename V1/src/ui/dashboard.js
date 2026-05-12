export function getAdminDashboardHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>maxitom — Admin Manager</title>
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
    </script>
</body>
</html>`;
}
