let inputEditor, outputEditor;
document.addEventListener('DOMContentLoaded', async () => {
    const checkEngine = setInterval(() => {
        const luaReady = window.fengari;
        const filesReady = window.prometheusFiles;
        const statusText = document.getElementById('engineStatusText');
        const dot = document.getElementById('engineStatusDot');
        const header = document.querySelector('.obf-header');
        const btn = document.getElementById('obfuscateBtn');
        if (!statusText) return; 
        if (luaReady && filesReady) {
            btn.disabled = false;
            statusText.textContent = 'Ready';
            header.classList.add('engine-ready');
            clearInterval(checkEngine);
        } else if (luaReady && !filesReady) {
            statusText.textContent = 'Loading Prometheus...';
        } else if (!luaReady && filesReady) {
            statusText.textContent = 'Loading Fengari...';
        }
    }, 300);
    try {
        const r = await fetch('/api/checkAuth', { credentials: 'same-origin' });
        if (!r.ok) {
            document.getElementById('unauthOverlay').innerHTML = `
                <h1 style="letter-spacing: -0.04em;">Unauthorized</h1>
                <p style="color: #444; font-size: 0.9rem;">You must be logged in to access the Hardener.</p>
                <a href="/" style="color: #fff; text-decoration: none; font-weight: 600; margin-top: 1rem; display: inline-block;">Return to Login</a>
            `;
            return;
        }
        document.getElementById('unauthOverlay').style.display = 'none';
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('app').style.display = 'flex';
        require(['vs/editor/editor.main'], function () {
            inputEditor = monaco.editor.create(document.getElementById('inputEditor'), {
                value: "-- Paste your Lua script here\nprint('Hello, Specter!')\n",
                language: "lua",
                theme: "vs-dark",
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 13,
                padding: { top: 16 }
            });
            outputEditor = monaco.editor.create(document.getElementById('outputEditor'), {
                value: "-- Output will appear here",
                language: "lua",
                theme: "vs-dark",
                automaticLayout: true,
                wordWrap: "on",
                minimap: { enabled: false },
                readOnly: true,
                fontSize: 13,
                padding: { top: 16 }
            });
        });
    } catch (err) {
        document.getElementById('unauthOverlay').innerHTML = `<h1 style="letter-spacing: -0.04em;">Connection Error</h1><p style="color: #444;">Failed to verify session.</p>`;
    }
    document.getElementById('obfuscateBtn').onclick = async () => {
        if (!inputEditor) return;
        const code = inputEditor.getValue();
        if (!code.trim()) return toast('Please enter some code to obfuscate.', 'error');
        const btn = document.getElementById('obfuscateBtn');
        btn.textContent = 'Obfuscating...';
        btn.disabled = true;
        document.getElementById('app').classList.add('is-obfuscating');
        setTimeout(() => {
            try {
                const f = window.fengari;
                if (!f || !f.lauxlib) {
                    throw new Error('Engine not ready. Reload the page.');
                }
                const { lua, lauxlib, lualib } = f;
                const L = lauxlib.luaL_newstate();
                lualib.luaL_openlibs(L);
                lua.lua_newtable(L);
                lua.lua_setglobal(L, f.to_luastring("arg"));
                function getSafeLuaString(str) {
                    let level = 0;
                    while (str.includes(`]${'='.repeat(level)}]`) || str.includes(`[${'='.repeat(level)}[`)) {
                        level++;
                    }
                    const eq = '='.repeat(level);
                    return `[${eq}[${str}]${eq}]`;
                }
                const safeCode = getSafeLuaString(code);
                lua.lua_newtable(L);
                for (const [path, content] of Object.entries(window.prometheusFiles)) {
                    lua.lua_pushstring(L, f.to_luastring(path));
                    lua.lua_pushstring(L, f.to_luastring(content));
                    lua.lua_settable(L, -3);
                }
                lua.lua_setglobal(L, f.to_luastring("prometheusFiles"));
                const useVM = document.getElementById('vmToggle').checked;
                const masterScript = `
                    local files = prometheusFiles
                    local module_map = {
                        ["prometheus"] = "prometheus",
                        ["prometheus.ast"] = "prometheus/ast",
                        ["prometheus.enums"] = "prometheus/enums",
                        ["prometheus.parser"] = "prometheus/parser",
                        ["prometheus.tokenizer"] = "prometheus/tokenizer",
                        ["prometheus.unparser"] = "prometheus/unparser",
                        ["prometheus.util"] = "prometheus/util",
                        ["prometheus.visitast"] = "prometheus/visitast",
                        ["prometheus.pipeline"] = "prometheus/pipeline",
                        ["prometheus.steps"] = "prometheus/steps",
                        ["prometheus.namegenerators"] = "prometheus/namegenerators",
                        ["colors"] = "colors",
                        ["config"] = "config",
                        ["highlightlua"] = "highlightlua",
                        ["logger"] = "logger",
                        ["presets"] = "presets"
                    }
                    local old_require = _G.require
                    _G.require = function(name)
                        if package.loaded[name] then return package.loaded[name] end
                        local path = module_map[name] or name:gsub("%.", "/")
                        if files[path] then
                            local virtualPath = "@prometheus/" .. path .. ".lua"
                            local f, err = load(files[path], virtualPath)
                            if not f then error("Failed to load "..path..": "..tostring(err)) end
                            local res = f()
                            package.loaded[name] = res
                            return res
                        end
                        return old_require(name)
                    end
                    _G.loadstring = _G.loadstring or _G.load
                    _G.bit32 = _G.bit32 or {
                        band = function(a, b) return a & b end,
                        bor  = function(a, b) return a | b end,
                        bxor = function(a, b) return a ~ b end,
                        bnot = function(a) return ~a end,
                        lshift = function(a, b) return a << b end,
                        rshift = function(a, b) return a >> b end,
                        extract = function(n, field, width)
                            width = width or 1
                            return (n >> field) & ((1 << width) - 1)
                        end
                    }
                    _G.prometheus = require("prometheus")
                    local steps = {
                        { Name = "AddVararg" },
                        { Name = "ConstantArray" },
                        { Name = "SplitStrings" },
                        { Name = "EncryptStrings" },
                        { Name = "ProxifyLocals" },
                    }
                    if ${useVM} then
                        table.insert(steps, { Name = "NumbersToExpressions" })
                        table.insert(steps, { Name = "Vmify" })
                    end
                    table.insert(steps, { Name = "WrapInFunction" })
                    local pipeline = prometheus.Pipeline:fromConfig({
                        LuaVersion = "LuaU",
                        NameGenerator = "MangledShuffled",
                        Steps = steps
                    })
                    local ok, result = pcall(function()
                        return pipeline:apply(${safeCode}, "HardenedScript")
                    end)
                    if not ok then error("Pipeline Error: " .. tostring(result)) end
                    return result
                `;
                const luaStr = f.to_luastring(masterScript);
                if (lauxlib.luaL_dostring(L, luaStr) !== 0) {
                    const err = lua.lua_tojsstring(L, -1);
                    throw new Error(err);
                }
                const result = lua.lua_tojsstring(L, -1);
                outputEditor.setValue(result);
                toast('Obfuscation complete.', 'success');
            } catch (e) {
                console.error(e);
                toast('Obfuscation failed: ' + e.message, 'error');
            } finally {
                btn.textContent = 'Obfuscate Code';
                btn.disabled = false;
                document.getElementById('app').classList.remove('is-obfuscating');
            }
        }, 50);
    };
    document.getElementById('copyBtn').onclick = async () => {
        if (!outputEditor) return;
        const text = outputEditor.getValue();
        try {
            await navigator.clipboard.writeText(text);
            toast('Copied to clipboard!', 'success');
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            toast('Copied to clipboard!', 'success');
        }
    };
});
function toast(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => t.remove(), 2500);
}
