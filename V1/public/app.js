const API_BASE = window.location.origin;
const ORIGIN = window.location.origin;
let scripts = [];
let scriptCache = {};
let activeUsers = [];
let currentView = 'scripts';
let uploadEditor = null;
let editEditor = null;
let currentEditingId = null;
window.getApiUrl = (path) => API_BASE + path;
window.toast = (msg, type = 'success') => {
    const container = document.getElementById('toasts');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateY(10px)';
        setTimeout(() => t.remove(), 300);
    }, 3000);
};
window.esc = (s) => {
    if (!s) return "";
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
};
window.copy = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        window.toast('Copied to clipboard');
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        window.toast('Copied to clipboard');
    }
};
window.copyLoader = (id) => {
    const s = scripts.find(x => x.id === id);
    if (!s) return;
    const url = `${ORIGIN}/raw/${s.id}`;
    const loadstring = `loadstring(game:HttpGet("${url}"))()`;
    window.copy(loadstring);
};
window.openUrl = (id) => {
    const s = scripts.find(x => x.id === id);
    if (!s) return;
    window.open(`${ORIGIN}/raw/${s.id}`, '_blank');
};
function setLoading(active, message = "Establishing Session...") {
    const loader = document.getElementById('zenLoader');
    const msgEl = loader.querySelector('.loader-msg');
    if (active) {
        msgEl.textContent = message;
        loader.classList.add('active');
    } else {
        loader.classList.remove('active');
    }
}
window.initTheme = () => {
    const saved = localStorage.getItem('theme');
    if (saved !== 'light') {
        document.body.classList.add('dark-mode');
    }
};
window.toggleTheme = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const monacoTheme = isDark ? 'vs-dark' : 'vs';
    if (uploadEditor) monaco.editor.setTheme(monacoTheme);
    if (editEditor) monaco.editor.setTheme(monacoTheme);
};
window.initUploadEditor = () => {
    return new Promise((resolve) => {
        if (uploadEditor) return resolve(uploadEditor);
        require(['vs/editor/editor.main'], function () {
            const isDark = document.body.classList.contains('dark-mode');
            uploadEditor = monaco.editor.create(document.getElementById('f-content'), {
                value: "-- Luau Source Code\n",
                language: "lua",
                theme: isDark ? "vs-dark" : "vs",
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 13,
                padding: { top: 16 }
            });
            resolve(uploadEditor);
        });
    });
};
window.initEditEditor = (initialValue = "") => {
    return new Promise((resolve) => {
        if (editEditor) {
            editEditor.setValue(initialValue);
            return resolve(editEditor);
        }
        require(['vs/editor/editor.main'], function () {
            const isDark = document.body.classList.contains('dark-mode');
            editEditor = monaco.editor.create(document.getElementById('e-content'), {
                value: initialValue,
                language: "lua",
                theme: isDark ? "vs-dark" : "vs",
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 13,
                padding: { top: 16 }
            });
            resolve(editEditor);
        });
    });
};
async function validateSession() {
    try {
        const r = await fetch(window.getApiUrl('/api/checkAuth'), { credentials: 'include' });
        const data = await r.json();
        if (r.ok && data.authenticated) {
            if (data.user) {
                document.getElementById('userDisplayName').textContent = data.user.username;
                const img = document.getElementById('userAvatar');
                if (data.user.avatar) {
                    img.src = data.user.avatar;
                    img.classList.remove('hidden');
                } else {
                    img.classList.add('hidden');
                }
            }
            showApp();
        }
        if (r.status === 403) return showError("Access Restricted", r);
    } catch (e) { }
}
window.login = async () => {
    const username = document.getElementById('usernameInput').value.trim();
    const adminKey = document.getElementById('adminKeyInput').value.trim();
    if (!username || !adminKey) {
        showError('Identity credentials required.');
        return;
    }
    setLoading(true, "Verifying Identity...");
    await new Promise(r => setTimeout(r, 600));
    try {
        const r = await fetch(window.getApiUrl('/api/login'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, adminKey })
        });
        if (r.ok) {
            const data = await r.json().catch(() => ({}));
            if (data.twoFactorRequired) {
                window.currentUsername = username;
                window.attemptToken = data.attemptToken;
                document.getElementById('loginBtn').classList.add('hidden');
                document.getElementById('twoFactorSection').classList.remove('hidden');
                setLoading(false);
            } else {
                setLoading(true, "Synchronizing Registry...");
                await new Promise(r => setTimeout(r, 400));
                showApp();
            }
        } else {
            const data = await r.json().catch(() => ({}));
            showError(data.error || 'Access Denied', r);
        }
    } catch (e) {
        showError('Network connectivity issue.');
    } finally {
        setLoading(false);
    }
};
async function showError(msg, response = null) {
    const err = document.getElementById('loginError');
    if (response && (response.status === 403 || response.status === 503)) {
        const html = await response.text();
        if (html.includes('<html')) {
            document.open();
            document.write(html);
            document.close();
            return;
        }
    }
    err.textContent = msg;
    err.classList.remove('hidden');
}
function showApp() {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    refreshData();
    setInterval(() => {
        if (currentView === 'users' && activeUsers.length > 0) {
            renderUsers(true); 
        }
    }, 1000);
    setInterval(() => {
        if (currentView === 'users' && !document.hidden) {
            window.loadUsers();
        }
    }, 45000);
}
window.logout = async () => {
    try { await fetch(window.getApiUrl('/api/logout'), { method: 'POST', credentials: 'include' }); } catch (e) { }
    location.reload();
};
async function refreshData() {
    await Promise.all([window.loadScripts(), window.loadUsers()]);
}
window.loadScripts = async () => {
    try {
        const r = await fetch(window.getApiUrl('/api/scripts'), { credentials: 'include' });
        if (r.status === 401) return location.reload();
        const data = await r.json();
        scripts = data.scripts || [];
        renderScripts();
        updateStats();
    } catch (e) { window.toast('Failed to load scripts', 'error'); }
};
window.loadUsers = async () => {
    try {
        const r = await fetch(window.getApiUrl('/api/active_users'), { credentials: 'include' });
        const data = await r.json();
        activeUsers = data.users || [];
        renderUsers();
    } catch (e) { window.toast('Failed to load users', 'error'); }
};
function updateStats() {
    const totalRuns = scripts.reduce((a, s) => a + (s.executions || 0), 0);
    const activeCount = scripts.filter(s => s.isEnabled).length;
    document.getElementById('stats').innerHTML = `
        <div class="stat"><div class="stat-value">${scripts.length}</div><div class="stat-label">Registry</div></div>
        <div class="stat"><div class="stat-value">${totalRuns.toLocaleString()}</div><div class="stat-label">Executions</div></div>
        <div class="stat"><div class="stat-value">${activeCount}</div><div class="stat-label">Online</div></div>
    `;
}
function renderScripts() {
    const grid = document.getElementById('scriptsGrid');
    if (scripts.length === 0) {
        grid.innerHTML = '<div class="empty">The registry is currently empty.</div>';
        return;
    }
    grid.innerHTML = scripts.map(s => {
        const url = `${ORIGIN}/raw/${s.id}`;
        const loadstring = `loadstring(game:HttpGet("${url}"))()`;
        const statusBadge = s.isEnabled
            ? (s.isPrivate ? '<span class="badge badge-private">Private</span>' : '<span class="badge badge-public">Public</span>')
            : '<span class="badge badge-disabled">Offline</span>';
        const protectionBadge = s.antiSkid
            ? '<span class="badge badge-shield">SHIELD ACTIVE</span>'
            : (s.simpleProtection ? '<span class="badge badge-warn">BROWSER BLOCK</span>' : '');
        const keyBadge = (s.isPrivate && s.accessKey)
            ? `<span class="key-tag">KEY: ${s.accessKey}</span>`
            : '';
        return `
            <div class="card script-card ${s.isEnabled ? '' : 'is-disabled'}">
                <div class="card-main">
                    <div class="card-header">
                        <div class="card-title-row">
                            <h3 class="card-name">${window.esc(s.name)}</h3>
                            <div class="card-badges">${statusBadge} ${protectionBadge} ${keyBadge}</div>
                        </div>
                        <div class="card-id-tag">ID: ${s.id}</div>
                    </div>
                    <div class="card-body">
                        <div class="card-stat-grid">
                            <div class="card-mini-stat">
                                <span class="mini-stat-label">Executions</span>
                                <span class="mini-stat-value">${s.executions.toLocaleString()}</span>
                            </div>
                            <div class="card-mini-stat">
                                <span class="mini-stat-label">Category</span>
                                <span class="mini-stat-value">${window.esc(s.category)}</span>
                            </div>
                        </div>
                        <div class="loadstring-wrapper" title="Click to Copy Loader">
                            <div class="loadstring-code" onclick="window.copyLoader('${s.id}')">
                                <span>${window.esc(loadstring)}</span>
                                <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2M16 4h2a2 2 0 0 1 2 2v4M16 2v4h4"></path></svg>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <div class="card-actions-primary">
                        <button class="btn btn-sm btn-primary action-btn" onclick="window.copyLoader('${s.id}')">Copy</button>
                        <button class="btn btn-sm action-btn" onclick="window.editScript('${s.id}')">Configure</button>
                    </div>
                    <div class="card-actions-secondary">
                        <button class="btn-icon" onclick="window.openUrl('${s.id}')" title="View Raw">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        </button>
                        <button class="btn-icon" onclick="window.openGlobalMessage('${s.id}')" title="Broadcast Message">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        </button>
                        <button class="btn-icon ${s.isEnabled ? 'text-danger' : 'text-success'}" onclick="window.toggleScript('${s.id}')" title="${s.isEnabled ? 'Disable' : 'Enable'}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}
function renderUsers(softRender = false) {
    const grid = document.getElementById('usersGrid');
    if (!softRender && activeUsers.length === 0) {
        grid.innerHTML = '<div class="empty">No active sessions detected.</div>';
        return;
    }
    if (activeUsers.length === 0) return;
    const now = Date.now();
    grid.innerHTML = activeUsers.map(u => {
        const lastPingDate = new Date(u.last_ping);
        const lastPingTime = lastPingDate.getTime();
        const diffSeconds = Math.floor((now - lastPingTime) / 1000);
        const isStale = diffSeconds > 20;
        const gameDisplay = u.game_id && u.game_id !== '0' && u.game_id !== 'Unknown'
            ? `Place ${u.game_id}`
            : (u.game_id === '0' ? 'Roblox Studio' : 'Unknown Game');
        return `
            <div class="session-row ${isStale ? 'is-stale' : ''}">
                <div class="session-col col-user">
                    <div class="row-name">
                        ${window.esc(u.username)}
                        ${isStale ? `<span class="stale-warning" title="Last ping ${diffSeconds}s ago. User may have disconnected.">⚠️</span>` : ''}
                    </div>
                    <div class="row-sub">${window.esc(u.script_name)} &middot; ${u.ip}</div>
                </div>
                <div class="session-col col-env">
                    <div class="row-label">Active Environment</div>
                    <div class="row-value">${gameDisplay}</div>
                </div>
                <div class="session-col col-time">
                    <div class="row-label">Last Ping</div>
                    <div class="row-value">${lastPingDate.toLocaleTimeString()}</div>
                </div>
                <div class="session-col col-actions">
                    <div class="session-actions">
                        <button class="btn-icon" title="Send Message" onclick="window.userAction('${u.id}', 'message')">💬</button>
                        <button class="btn-icon danger" title="Force Kick" onclick="window.userAction('${u.id}', 'kick')">🚫</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}
window.editScript = async (id) => {
    currentEditingId = id;
    let script = scripts.find(s => s.id === id);
    if (!scriptCache[id]) {
        window.toast('Fetching source code...', 'info');
        try {
            const r = await fetch(window.getApiUrl(`/api/script/${id}`), { credentials: 'include' });
            const fullScript = await r.json();
            scriptCache[id] = fullScript.content;
            script = { ...script, content: fullScript.content };
        } catch (e) { window.toast('Failed to fetch script content', 'error'); return; }
    } else {
        script = { ...script, content: scriptCache[id] };
    }
    document.getElementById('e-id').value = script.id;
    document.getElementById('e-name').value = script.name;
    document.getElementById('e-desc').value = script.description || '';
    document.getElementById('e-category').value = script.category;
    document.getElementById('e-key').value = script.accessKey || '';
    document.getElementById('e-key-url').value = script.keySystemUrl || '';
    document.getElementById('e-maxExec').value = script.maxExecutions || '';
    const isPrivate = script.isPrivate === true || script.isPrivate === 1;
    document.getElementById('e-private').classList.toggle('on', isPrivate);
    document.getElementById('e-private-fields').classList.toggle('hidden', !isPrivate);
    document.getElementById('e-antiskid').classList.toggle('on', script.antiSkid);
    document.getElementById('e-simple').classList.toggle('on', script.simpleProtection);
    await window.initEditEditor(script.content);
    document.getElementById('editModal').classList.add('active');
};
window.saveScript = async (e) => {
    if (e) e.preventDefault();
    const id = document.getElementById('e-id').value;
    const content = editEditor ? editEditor.getValue() : scriptCache[id];
    const data = {
        name: document.getElementById('e-name').value,
        content: content,
        description: document.getElementById('e-desc').value,
        category: document.getElementById('e-category').value,
        isPrivate: document.getElementById('e-private').classList.contains('on'),
        antiSkid: document.getElementById('e-antiskid').classList.contains('on'),
        simpleProtection: document.getElementById('e-simple').classList.contains('on'),
        accessKey: document.getElementById('e-key').value || null,
        keySystemUrl: document.getElementById('e-key-url').value || null,
        maxExecutions: parseInt(document.getElementById('e-maxExec').value) || null
    };
    try {
        const r = await fetch(window.getApiUrl(`/api/script/${id}`), {
            method: 'PUT', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (r.ok) {
            scriptCache[id] = content;
            window.toast('Changes deployed successfully');
            window.closeModals();
            window.loadScripts();
        } else { window.toast('Failed to save changes', 'error'); }
    } catch (e) { window.toast('Network error', 'error'); }
};
window.uploadScript = async (e) => {
    if (e) e.preventDefault();
    const content = uploadEditor ? uploadEditor.getValue() : "";
    if (!content.trim()) return window.toast('Source code is required', 'error');
    const data = {
        name: document.getElementById('f-name').value,
        content: content,
        description: document.getElementById('f-desc').value,
        category: document.getElementById('f-category').value,
        isPrivate: document.getElementById('f-private').classList.contains('on'),
        antiSkid: document.getElementById('f-antiskid').classList.contains('on'),
        simpleProtection: document.getElementById('f-simple').classList.contains('on'),
        accessKey: document.getElementById('f-key').value || null,
        keySystemUrl: document.getElementById('f-key-url').value || null,
        maxExecutions: document.getElementById('f-maxExec').value ? parseInt(document.getElementById('f-maxExec').value) : null
    };
    try {
        const r = await fetch(window.getApiUrl('/api/upload'), {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const j = await r.json();
        if (j.success) {
            window.toast('New script published');
            document.getElementById('uploadForm').reset();
            if (uploadEditor) uploadEditor.setValue("-- Luau Source Code\n");
            handleNav('scripts');
            window.loadScripts();
        } else { window.toast(j.error || 'Upload failed', 'error'); }
    } catch (e) { window.toast('Network error', 'error'); }
};
window.toggleScript = async (id) => {
    const s = scripts.find(x => x.id === id);
    if (!s) return;
    if (s.isEnabled) {
        window.showActionModal({
            title: 'Purge Sessions',
            desc: 'Purge all active sessions for this script? This will force-disconnect current users.',
            confirmText: 'Purge and Disable',
            onConfirm: () => executeToggle(id, true)
        });
    } else {
        await executeToggle(id, false);
    }
};
async function executeToggle(id, kick) {
    try {
        await fetch(window.getApiUrl(`/api/script/${id}/toggle`), {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kick })
        });
        window.loadScripts();
        if (kick) window.loadUsers();
    } catch (e) { window.toast('Toggle failed', 'error'); }
}
window.deleteScript = async () => {
    const id = document.getElementById('e-id').value;
    window.showActionModal({
        title: 'Delete Script',
        desc: 'Are you sure? This action is irreversible and will remove the script from the registry.',
        confirmText: 'Delete Forever',
        onConfirm: async () => {
            try {
                const r = await fetch(window.getApiUrl(`/api/script/${id}`), { method: 'DELETE', credentials: 'include' });
                if (r.ok) { window.toast('Script removed from registry'); window.closeModals(); window.loadScripts(); }
            } catch (e) { window.toast('Deletion failed', 'error'); }
        }
    });
};
window.showActionModal = ({ title, desc, hasInput, inputOptional, confirmText, onConfirm }) => {
    const modal = document.getElementById('actionModal');
    document.getElementById('actionModalTitle').innerText = title;
    document.getElementById('actionModalDesc').innerText = desc;
    const inputContainer = document.getElementById('actionModalInputContainer');
    const input = document.getElementById('actionModalInput');
    if (hasInput) {
        inputContainer.classList.remove('hidden');
        input.value = '';
    } else {
        inputContainer.classList.add('hidden');
    }
    const confirmBtn = document.getElementById('actionModalConfirmBtn');
    confirmBtn.innerText = confirmText || 'Confirm';
    confirmBtn.onclick = () => {
        const val = hasInput ? input.value : true;
        if (hasInput && !inputOptional && !val.trim()) return window.toast('Input is required', 'error');
        onConfirm(val);
        window.closeModals();
    };
    modal.classList.add('active');
};
window.userAction = async (id, action) => {
    if (action === 'message') {
        window.showActionModal({
            title: 'Send Message',
            desc: `This message will be displayed as a notification to the user.`,
            hasInput: true,
            confirmText: 'Send Notification',
            onConfirm: async (msg) => {
                await executeAction(id, { action: 'message', message: msg });
            }
        });
    } else if (action === 'kick') {
        window.showActionModal({
            title: 'Confirm Disconnect',
            desc: `Are you sure you want to force disconnect this user? You may provide an optional kick message below.`,
            hasInput: true,
            inputOptional: true,
            confirmText: 'Kick User',
            onConfirm: async (msg) => {
                const payload = { action: 'kick' };
                if (msg && msg.trim()) payload.message = msg.trim();
                await executeAction(id, payload);
            }
        });
    }
};
async function executeAction(id, payload) {
    try {
        const r = await fetch(window.getApiUrl(`/api/user/${encodeURIComponent(id)}/action`), {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (r.ok) window.toast('Action executed');
        else window.toast('Action failed', 'error');
        window.loadUsers();
    } catch (e) { window.toast('Network error', 'error'); }
}
window.openGlobalMessage = async (id) => {
    window.showActionModal({
        title: 'Global Announcement',
        desc: `Send a notification to ALL active users of this script.`,
        hasInput: true,
        confirmText: 'Broadcast Message',
        onConfirm: async (msg) => {
            try {
                const r = await fetch(window.getApiUrl(`/api/script/${id}/message`), {
                    method: 'POST', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg })
                });
                if (r.ok) window.toast('Broadcast sent');
                else window.toast('Failed to broadcast', 'error');
            } catch (e) { window.toast('Network error', 'error'); }
        }
    });
};
window.closeModals = () => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
function handleNav(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    const targetView = document.getElementById(`${view}View`);
    const targetBtn = document.querySelector(`nav button[data-view="${view}"]`);
    if (targetView) targetView.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');
    currentView = view;
    if (view === 'scripts') window.loadScripts();
    if (view === 'users') window.loadUsers();
    if (view === 'settings') loadSettings();
    if (view === 'upload') window.initUploadEditor();
}
async function loadSettings() {
    try {
        const r = await fetch(window.getApiUrl('/api/me'), { credentials: 'include' });
        const data = await r.json();
        if (data.user) {
            document.getElementById('settingsUsername').textContent = data.user.username;
            document.getElementById('settingsDiscordId').textContent = data.user.discord_id ? `ID: ${data.user.discord_id}` : 'Not Linked';
            if (document.getElementById('identityUsername')) document.getElementById('identityUsername').value = data.user.username;
            const passInput = document.getElementById('identityPassword');
            const toggleBtn = document.getElementById('toggleIdentityPass');
            const copyBtn = document.getElementById('copyIdentityBtn');
            if (passInput) {
                if (data.user.current_password === '••••••••••••') {
                    passInput.value = '';
                    passInput.placeholder = '••••••••••••';
                    passInput.title = 'For security, hashed passwords cannot be revealed. Update your key to set a new one.';
                    passInput.style.fontStyle = 'italic';
                    passInput.style.opacity = '0.5';
                    if (toggleBtn) toggleBtn.style.display = 'none';
                    if (copyBtn) copyBtn.style.display = 'none';
                } else {
                    passInput.value = data.user.current_password || '';
                    passInput.placeholder = 'No access key set';
                    passInput.style.fontStyle = 'normal';
                    passInput.style.opacity = '1';
                    if (toggleBtn) toggleBtn.style.display = 'flex';
                    if (copyBtn) copyBtn.style.display = 'flex';
                }
            }
            if (data.user.avatar) {
                document.getElementById('settingsAvatar').src = data.user.avatar;
            } else {
                document.getElementById('settingsAvatar').src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
            }
            const totpEnabled = data.user.totp_enabled;
            document.getElementById('totpEnabledStatus').classList.toggle('hidden', !totpEnabled);
            document.getElementById('totpDisabledStatus').classList.toggle('hidden', totpEnabled);
            const linkBtn = document.getElementById('linkDiscordBtn');
            if (!data.user.discord_id) {
                linkBtn.classList.remove('hidden');
            } else {
                linkBtn.classList.add('hidden');
            }
        }
    } catch (e) {
        alert("Failed to load profile settings.");
    }
}
async function updatePassword() {
    const password = document.getElementById('newPasswordInput').value;
    if (!password) return alert("Please enter a new key.");
    try {
        const r = await fetch(window.getApiUrl('/api/me/password'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        if (r.ok) {
            alert("Security key updated successfully!");
            document.getElementById('newPasswordInput').value = '';
            loadSettings(); 
        } else {
            const d = await r.json();
            alert(d.error || "Failed to update key.");
        }
    } catch (e) {
        alert("An error occurred.");
    }
}
document.addEventListener('DOMContentLoaded', () => {
    validateSession();
    window.initTheme();
    document.getElementById('themeToggle').onclick = window.toggleTheme;
    document.getElementById('changelogBtn').addEventListener('click', () => {
        document.getElementById('changelogModal').classList.add('active');
    });
    document.getElementById('loginBtn').onclick = window.login;
    document.getElementById('discordLoginBtn').onclick = () => {
        window.location.href = window.getApiUrl('/api/auth/discord');
    };
    document.getElementById('logoutBtn').onclick = window.logout;
    document.getElementById('refreshBtn').onclick = window.loadScripts;
    document.getElementById('refreshUsersBtn').onclick = window.loadUsers;
    document.getElementById('updatePasswordBtn').onclick = updatePassword;
    document.getElementById('toggleIdentityPass').onclick = () => {
        const input = document.getElementById('identityPassword');
        const btn = document.getElementById('toggleIdentityPass');
        if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        } else {
            input.type = 'password';
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        }
    };
    document.getElementById('setup2FABtn').onclick = async () => {
        const r = await fetch(window.getApiUrl('/api/auth/2fa/setup'), { method: 'POST', credentials: 'include' });
        const data = await r.json();
        if (data.success) {
            const qrSection = document.getElementById('totpQrContainer');
            const secretSection = document.getElementById('totpSecretContainer');
            const resumeNotice = document.getElementById('resumeNotice');
            if (data.alreadyConfigured) {
                qrSection.classList.add('hidden');
                secretSection.classList.add('hidden');
                resumeNotice.classList.remove('hidden');
            } else {
                qrSection.classList.remove('hidden');
                secretSection.classList.remove('hidden');
                resumeNotice.classList.add('hidden');
                document.getElementById('qrImg').src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(data.qrUrl);
                document.getElementById('totpSecret').value = data.secret;
            }
            document.getElementById('totpSetupModal').classList.add('active');
        }
    };
    document.getElementById('disable2FABtn').onclick = () => {
        document.getElementById('totpDisableInput').value = '';
        document.getElementById('totpDisableError').classList.add('hidden');
        document.getElementById('totpDisableModal').classList.add('active');
    };
    document.getElementById('confirmDisable2FABtn').onclick = async () => {
        const code = document.getElementById('totpDisableInput').value;
        const errEl = document.getElementById('totpDisableError');
        errEl.classList.add('hidden');
        const r = await fetch(window.getApiUrl('/api/auth/2fa/disable'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        if (r.ok) {
            window.toast('2FA Protection Disabled');
            window.closeModals();
            loadSettings();
        } else {
            const data = await r.json().catch(() => ({}));
            errEl.textContent = data.error || 'Verification failed';
            errEl.classList.remove('hidden');
        }
    };
    document.getElementById('confirm2FABtn').onclick = async () => {
        const code = document.getElementById('totpConfirm').value;
        const errEl = document.getElementById('totpSetupError');
        errEl.classList.add('hidden');
        const r = await fetch(window.getApiUrl('/api/auth/2fa/confirm'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        if (r.ok) {
            window.toast('2FA Protection Enabled');
            window.closeModals();
            loadSettings();
        } else {
            const data = await r.json().catch(() => ({}));
            errEl.textContent = data.error || 'Invalid code';
            errEl.classList.remove('hidden');
        }
    };
    document.getElementById('verify2FABtn').onclick = async () => {
        const code = document.getElementById('totpInput').value;
        const errEl = document.getElementById('totpLoginError');
        errEl.classList.add('hidden');
        const r = await fetch(window.getApiUrl('/api/auth/2fa/verify'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: window.currentUsername, attemptToken: window.attemptToken, code })
        });
        if (r.ok) {
            showApp();
        } else {
            const data = await r.json().catch(() => ({}));
            errEl.textContent = data.error || 'Invalid verification code';
            errEl.classList.remove('hidden');
            window.toast('Verification failed', 'error');
        }
    };
    document.getElementById('linkDiscordBtn').onclick = () => {
        window.location.href = window.getApiUrl('/api/auth/discord');
    };
    if (document.getElementById('changelogBtn')) {
        document.getElementById('changelogBtn').onclick = () => {
            document.getElementById('changelogModal').classList.add('active');
        };
    }
    document.querySelectorAll('nav button').forEach(btn => {
        btn.onclick = () => handleNav(btn.dataset.view);
    });
    document.getElementById('closeModal').onclick = window.closeModals;
    document.getElementById('deleteBtn').onclick = window.deleteScript;
    document.getElementById('editForm').onsubmit = window.saveScript;
    document.getElementById('uploadForm').onsubmit = window.uploadScript;
    document.querySelectorAll('.toggle-row').forEach(row => {
        row.onclick = () => {
            const t = row.querySelector('.toggle');
            if (!t) return;
            t.classList.toggle('on');
            if (t.id === 'f-antiskid' && t.classList.contains('on')) document.getElementById('f-simple').classList.remove('on');
            if (t.id === 'f-simple' && t.classList.contains('on')) document.getElementById('f-antiskid').classList.remove('on');
            if (t.id === 'e-antiskid' && t.classList.contains('on')) document.getElementById('e-simple').classList.remove('on');
            if (t.id === 'e-simple' && t.classList.contains('on')) document.getElementById('e-antiskid').classList.remove('on');
            if (t.id === 'f-private') document.getElementById('f-private-details')?.classList.toggle('hidden', !t.classList.contains('on'));
            if (t.id === 'e-private') document.getElementById('e-private-fields')?.classList.toggle('hidden', !t.classList.contains('on'));
        };
    });
    [document.getElementById('usernameInput'), document.getElementById('adminKeyInput')].forEach(i => {
        if (i) i.onkeypress = e => { if (e.key === 'Enter') window.login(); };
    });
});
