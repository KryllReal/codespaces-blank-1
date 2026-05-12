let currentUser = null;
let currentProjects = [];

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

async function boot() {
    const path = window.location.pathname;

    if (path.startsWith('/p/')) {
        const id = path.split('/p/')[1];
        if (id) return showPublicStats(id);
    }

    try {
        const res = await fetch('/api/antigravity/me', { credentials: 'include' });
        const data = await res.json();
        if (data.authenticated) {
            currentUser = data.user;
            currentProjects = data.projects;
            showDash();
        } else {
            showLanding();
        }
    } catch (e) {
        showLanding();
    }
    bindEvents();
}

function hideAll() {
    $$('.view').forEach(v => v.classList.remove('active'));
}

function switchAuthTab(tabName, element) {
    // Hide all auth tabs
    $$('.auth-tab').forEach(tab => tab.classList.remove('active'));
    
    // Show selected tab
    const tab = $(`#${tabName}Tab`);
    if (tab) tab.classList.add('active');
    
    // Update title
    const title = $('#authTitle');
    if (title) {
        if (tabName === 'login') title.textContent = 'Sign In';
        else if (tabName === 'signup') title.textContent = 'Create Account';
        else if (tabName === 'forgot') title.textContent = 'Reset Password';
    }

    // Update tab navigation state
    $$('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
}

function showLanding() {
    hideAll();
    $('#landing').classList.add('active');
}

function showDash() {
    hideAll();
    $('#dashboard').classList.add('active');
    $('#username').textContent = currentUser.username;
    const av = $('#user-avatar');
    if (currentUser.avatar) { av.src = currentUser.avatar; av.style.display = ''; }
    else { av.style.display = 'none'; }
    renderProjects();
}

async function showPublicStats(id) {
    hideAll();
    $('#public-stats').classList.add('active');

    try {
        const [statsRes, actRes] = await Promise.all([
            fetch(`/api/antigravity/stats/${id}`),
            fetch(`/api/antigravity/activity/${id}`)
        ]);
        const data = await statsRes.json();
        const activity = actRes.ok ? await actRes.json() : { daily: [], hourly: [], types: [], countries: [] };

        if (data.name) {
            document.title = `${data.name} - Antigravity`;
            $('#stats-name').textContent = data.name;
            $('#stats-desc').textContent = data.description || '';
            $('#stats-creator').textContent = data.creator;
            $('#stats-status').textContent = data.status;
            if (data.status !== 'ACTIVE') $('#stats-status').classList.add('inactive');
            $('#stat-total').textContent = data.stats.total.toLocaleString();
            $('#stat-unique').textContent = data.stats.unique.toLocaleString();
            $('#stat-daily').textContent = data.stats.daily.toLocaleString();
            $('#stats-created').textContent = new Date(data.createdAt).toLocaleDateString();
            $('#stats-view').style.display = '';
            $('#stats-error').style.display = 'none';

            drawLineChart(activity.daily);
            drawHeatmap(activity.daily);
            drawWorldMap(activity.countries);
            drawHourlyChart(activity.hourly);
            drawWeeklyRhythm(activity.daily);
            drawLoyaltyChart(data.stats.total, data.stats.unique);
            drawCountryList(activity.countries);

            $('#btn-open-summary').onclick = () => openSummary({ ...data, activity });
        } else {
            $('#stats-view').style.display = 'none';
            $('#stats-error').style.display = '';
        }
    } catch (e) {
        console.error('Stats Error:', e);
        $('#stats-view').style.display = 'none';
        $('#stats-error').style.display = '';
    }

    bindEvents();
}

function getFlagEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🌐';
    return countryCode.toUpperCase().replace(/./g, char =>
        String.fromCodePoint(127397 + char.charCodeAt())
    );
}

function svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}

function drawLineChart(daily, target = '#activity-chart') {
    const wrap = $(target);
    if (!daily.length) { wrap.innerHTML = '<div class="no-data">No data available</div>'; return; }

    const lookup = {};
    daily.forEach(d => lookup[d.day] = d.n);

    const days = [];
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        days.push({ label: key, val: lookup[key] || 0 });
    }

    const w = 840, h = 200, px = 48, py = 20;
    const plotW = w - px - 16, plotH = h - py * 2;
    const peak = Math.max(...days.map(d => d.val), 1);

    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet' });

    for (let i = 0; i <= 4; i++) {
        const y = py + (plotH / 4) * i;
        svg.appendChild(svgEl('line', { x1: px, y1: y, x2: w - 16, y2: y, stroke: '#1f1f1f', 'stroke-width': 1 }));
        const label = svgEl('text', { x: px - 8, y: y + 4, fill: '#555', 'font-size': '10', 'text-anchor': 'end', 'font-family': 'Inter, sans-serif' });
        label.textContent = Math.round(peak - (peak / 4) * i).toLocaleString();
        svg.appendChild(label);
    }

    const pts = days.map((d, i) => {
        const x = px + (i / (days.length - 1)) * plotW;
        const y = py + plotH - (d.val / peak) * plotH;
        return { x, y };
    });

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    svg.appendChild(svgEl('path', { d: line, fill: 'none', stroke: '#10b981', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'anim-line' }));

    const area = line + ` L${pts[pts.length - 1].x},${py + plotH} L${pts[0].x},${py + plotH} Z`;
    svg.appendChild(svgEl('path', { d: area, fill: 'url(#areaGrad)', opacity: '0.3' }));

    const defs = svgEl('defs');
    const grad = svgEl('linearGradient', { id: 'areaGrad', x1: '0', y1: '0', x2: '0', y2: '1' });
    const s1 = svgEl('stop', { offset: '0%', 'stop-color': '#10b981' });
    const s2 = svgEl('stop', { offset: '100%', 'stop-color': '#10b981', 'stop-opacity': '0' });
    grad.appendChild(s1); grad.appendChild(s2);
    defs.appendChild(grad);
    svg.insertBefore(defs, svg.firstChild);

    pts.forEach((p, i) => {
        const dot = svgEl('circle', { cx: p.x, cy: p.y, r: 3, fill: '#10b981' });
        dot.style.opacity = '0';
        dot.style.transition = 'opacity 0.15s';
        svg.appendChild(dot);

        const hitArea = svgEl('rect', { x: p.x - 12, y: py, width: 24, height: plotH, fill: 'transparent' });
        hitArea.addEventListener('mouseenter', () => dot.style.opacity = '1');
        hitArea.addEventListener('mouseleave', () => dot.style.opacity = '0');
        svg.appendChild(hitArea);
    });

    days.forEach((d, i) => {
        const x = px + (i / (days.length - 1)) * plotW;
        const date = new Date(d.label + 'T12:00:00');
        const label = svgEl('text', { x, y: h - 4, fill: '#555', 'font-size': '10', 'text-anchor': 'middle', 'font-family': 'Inter, sans-serif' });
        label.textContent = (date.getMonth() + 1) + '-' + date.getDate().toString().padStart(2, '0');
        svg.appendChild(label);
    });

    wrap.innerHTML = '';
    wrap.appendChild(svg);
}

function drawHeatmap(daily) {
    const wrap = $('#heatmap');
    if (!daily.length) { wrap.innerHTML = '<div class="no-data">No activity yet</div>'; return; }

    const lookup = {};
    daily.forEach(d => lookup[d.day] = d.n);

    const weeks = 24;
    const totalDays = weeks * 7;
    const end = new Date();
    end.setHours(12, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - totalDays + 1);
    start.setDate(start.getDate() - start.getDay());

    const cells = [];
    const cursor = new Date(start);
    cursor.setHours(12, 0, 0, 0);

    while (cursor <= end) {
        const key = cursor.toISOString().split('T')[0];
        cells.push({
            day: key,
            val: lookup[key] || 0,
            dow: cursor.getDay(),
            week: Math.floor((cursor - start) / (7 * 86400000))
        });
        cursor.setDate(cursor.getDate() + 1);
    }

    const peak = Math.max(...cells.map(c => c.val), 1);
    const sz = 13, gap = 3, leftPad = 28;
    const totalWeeks = cells[cells.length - 1].week + 1;
    const w = leftPad + totalWeeks * (sz + gap) + 8;
    const h = 7 * (sz + gap) + 24;

    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet' });

    ['Mon', 'Wed', 'Fri'].forEach((l, i) => {
        const dayIndex = [1, 3, 5][i];
        const label = svgEl('text', { x: 0, y: dayIndex * (sz + gap) + sz - 1, fill: '#555', 'font-size': '10', 'font-family': 'Inter, sans-serif' });
        label.textContent = l;
        svg.appendChild(label);
    });

    let tip = document.querySelector('.hm-tip');
    if (!tip) {
        tip = document.createElement('div');
        tip.className = 'hm-tip';
        document.body.appendChild(tip);
    }

    function intensity(val) {
        if (val === 0) return '#121212';
        const t = val / peak;
        if (t < 0.2) return '#062d19';
        if (t < 0.4) return '#0e4429';
        if (t < 0.6) return '#006d32';
        if (t < 0.8) return '#26a641';
        return '#39d353';
    }

    cells.forEach(c => {
        const x = leftPad + c.week * (sz + gap);
        const y = c.dow * (sz + gap);
        const rect = svgEl('rect', {
            x, y, width: sz, height: sz, rx: 3,
            fill: intensity(c.val)
        });
        rect.style.transition = 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
        rect.style.cursor = 'pointer';

        rect.addEventListener('mouseenter', (e) => {
            rect.style.stroke = '#fff';
            rect.style.strokeWidth = '1.5px';
            rect.setAttribute('width', sz + 1);
            rect.setAttribute('height', sz + 1);
            rect.setAttribute('x', x - 0.5);
            rect.setAttribute('y', y - 0.5);

            tip.innerHTML = `<strong>${c.val.toLocaleString()}</strong> run${c.val !== 1 ? 's' : ''}<br><span style="color:var(--dim)">${new Date(c.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>`;
            tip.classList.add('on');
            tip.style.left = e.clientX + 12 + 'px';
            tip.style.top = e.clientY - 42 + 'px';
        });
        rect.addEventListener('mousemove', (e) => {
            tip.style.left = e.clientX + 12 + 'px';
            tip.style.top = e.clientY - 42 + 'px';
        });
        rect.addEventListener('mouseleave', () => {
            rect.style.stroke = 'none';
            rect.setAttribute('width', sz);
            rect.setAttribute('height', sz);
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            tip.classList.remove('on');
        });
        svg.appendChild(rect);
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let lastMonth = -1;
    cells.forEach(c => {
        if (c.dow !== 0) return;
        const m = new Date(c.day).getMonth();
        if (m === lastMonth) return;
        lastMonth = m;
        const x = leftPad + c.week * (sz + gap);
        const label = svgEl('text', { x, y: h - 4, fill: '#555', 'font-size': '10', 'font-family': 'Inter, sans-serif' });
        label.textContent = months[m];
        svg.appendChild(label);
    });

    wrap.innerHTML = '';
    wrap.appendChild(svg);
}

function drawHourlyChart(hourly, target = '#hourly-chart') {
    const wrap = $(target);
    if (!hourly.length) { wrap.innerHTML = '<div class="no-data">No data</div>'; return; }

    const counts = new Array(24).fill(0);
    hourly.forEach(h => counts[h.hr] = h.n);
    const peak = Math.max(...counts, 1);

    const w = 420, h = 160, px = 32, py = 12;
    const plotW = w - px - 8, plotH = h - py - 24;
    const barW = (plotW / 24) - 2;

    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet' });

    for (let i = 0; i <= 3; i++) {
        const y = py + (plotH / 3) * i;
        svg.appendChild(svgEl('line', { x1: px, y1: y, x2: w - 8, y2: y, stroke: '#1f1f1f', 'stroke-width': 1 }));
    }

    const currentHr = new Date().getUTCHours();
    const peakHr = counts.indexOf(peak);

    let tip = document.querySelector('.hm-tip');

    counts.forEach((v, i) => {
        const barH = (v / peak) * plotH;
        const x = px + (i / 24) * plotW + 1;
        const y = py + plotH - barH;
        const isCurrent = i === currentHr;

        const rect = svgEl('rect', {
            x, y, width: Math.max(barW, 4), height: Math.max(barH, 1), rx: 3,
            fill: i === peakHr ? '#10b981' : (isCurrent ? '#34d399' : '#1a2e26'),
            class: 'anim-bar'
        });
        rect.style.animationDelay = `${i * 0.02}s`;
        rect.style.transition = 'all 0.15s ease-out';
        rect.style.cursor = 'pointer';
        if (isCurrent) {
            rect.style.filter = 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.4))';
        }

        rect.addEventListener('mouseenter', (e) => {
            rect.style.fill = '#10b981';
            rect.style.transform = 'translateY(-2px)';
            const pct = ((v / (counts.reduce((a, b) => a + b, 0) || 1)) * 100).toFixed(1);
            tip.innerHTML = `<strong>${v.toLocaleString()}</strong> runs at ${i.toString().padStart(2, '0')}:00<br><span style="color:var(--dim)">${pct}% of total traffic</span>`;
            tip.classList.add('on');
            tip.style.left = e.clientX + 12 + 'px';
            tip.style.top = e.clientY - 42 + 'px';
        });

        rect.addEventListener('mousemove', (e) => {
            tip.style.left = e.clientX + 12 + 'px';
            tip.style.top = e.clientY - 42 + 'px';
        });

        rect.addEventListener('mouseleave', () => {
            rect.style.fill = i === peakHr ? '#10b981' : (isCurrent ? '#34d399' : '#1a2e26');
            rect.style.transform = 'translateY(0)';
            tip.classList.remove('on');
        });

        svg.appendChild(rect);
    });

    [0, 6, 12, 18, 23].forEach(i => {
        const x = px + (i / 24) * plotW + barW / 2;
        const label = svgEl('text', { x, y: h - 4, fill: '#555', 'font-size': '9', 'text-anchor': 'middle', 'font-family': 'Inter, sans-serif' });
        label.textContent = `${i.toString().padStart(2, '0')}:00`;
        svg.appendChild(label);
    });

    wrap.innerHTML = '';
    wrap.appendChild(svg);
}


function drawCountryList(countries) {
    const wrap = $('#country-list');
    if (!countries.length) { wrap.innerHTML = '<div class="no-data">No data</div>'; return; }

    const top = countries[0].n;
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

    wrap.innerHTML = countries.slice(0, 10).map(c => {
        const name = regionNames.of(c.cc.toUpperCase()) || c.cc;
        return `
            <div class="ev-row">
                <span class="ev-label">
                    <span style="margin-right:8px">${getFlagEmoji(c.cc)}</span>
                    ${name}
                </span>
                <div class="ev-bar-wrap"><div class="ev-bar" style="width:${(c.n / top * 100).toFixed(1)}%"></div></div>
                <span class="ev-count">${c.n.toLocaleString()}</span>
            </div>
        `;
    }).join('');
}

function drawWeeklyRhythm(daily, target = '#weekly-chart') {
    const wrap = $(target);
    if (!daily.length) { wrap.innerHTML = '<div class="no-data">No data</div>'; return; }

    const days = new Array(7).fill(0);
    daily.forEach(d => {
        const date = new Date(d.day + 'T12:00:00'); // Midday to avoid TZ shifts
        days[date.getDay()] += d.n;
    });

    const peak = Math.max(...days, 1);
    const w = 420, h = 160, px = 32, py = 12;
    const plotW = w - px - 8, plotH = h - py - 24;
    const barW = (plotW / 7) - 12;

    const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet' });
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i <= 3; i++) {
        svg.appendChild(svgEl('line', { x1: px, y1: py + (plotH / 3) * i, x2: w - 8, y2: py + (plotH / 3) * i, stroke: '#1f1f1f', 'stroke-width': 1 }));
    }

    days.forEach((v, i) => {
        const barH = (v / peak) * plotH;
        const x = px + (i / 7) * plotW + 6;
        const y = py + plotH - barH;

        const rect = svgEl('rect', {
            x, y, width: barW, height: Math.max(barH, 1), rx: 4,
            fill: '#1a2e26',
            class: 'anim-bar'
        });
        rect.style.animationDelay = `${i * 0.03}s`;
        rect.style.transition = 'all 0.15s ease-out';
        rect.style.cursor = 'pointer';

        rect.addEventListener('mouseenter', (e) => {
            rect.style.fill = '#10b981';
            rect.style.transform = 'translateY(-2px)';
            const tip = document.querySelector('.hm-tip');
            tip.innerHTML = `<strong>${v.toLocaleString()}</strong> runs on ${labels[i]}s`;
            tip.classList.add('on');
            tip.style.left = e.clientX + 12 + 'px';
            tip.style.top = e.clientY - 32 + 'px';
        });

        rect.addEventListener('mouseleave', () => {
            rect.style.fill = '#1a2e26';
            rect.style.transform = 'translateY(0)';
            document.querySelector('.hm-tip').classList.remove('on');
        });

        svg.appendChild(rect);

        const label = svgEl('text', { x: x + barW / 2, y: h - 4, fill: '#555', 'font-size': '10', 'text-anchor': 'middle', 'font-family': 'Inter, sans-serif' });
        label.textContent = labels[i];
        svg.appendChild(label);
    });

    wrap.innerHTML = '';
    wrap.appendChild(svg);
}

function drawLoyaltyChart(total, unique, target = '#loyalty-chart') {
    const wrap = $(target);
    if (!total) { wrap.innerHTML = '<div class="no-data">No data</div>'; return; }

    const returning = Math.max(0, total - unique);
    const newPct = total > 0 ? ((unique / total) * 100).toFixed(1) : 0;

    const size = 120;
    const center = size / 2;
    const radius = 45;
    const circ = 2 * Math.PI * radius;

    wrap.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:20px;">
            <div style="position:relative; width:${size}px; height:${size}px;">
                <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                    <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#1a2e26" stroke-width="12" />
                    <circle id="loyalty-progress" cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#10b981" stroke-width="12" 
                        stroke-dasharray="${circ}" stroke-dashoffset="${circ}" transform="rotate(-90 ${center} ${center})" class="anim-donut" />
                </svg>
                <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                    <span style="font-size:16px; font-weight:800; color:white;">${newPct}%</span>
                    <span style="font-size:9px; color:var(--dim); font-weight:600; text-transform:uppercase;">New</span>
                </div>
            </div>
            <div class="loyalty-stats" style="width:100%">
                <div class="loyalty-row">
                    <span class="loyalty-label"><span class="loyalty-dot" style="background:#10b981"></span> New Users</span>
                    <span class="loyalty-val">${unique.toLocaleString()}</span>
                </div>
                <div class="loyalty-row">
                    <span class="loyalty-label"><span class="loyalty-dot" style="background:#1a2e26"></span> Recurring</span>
                    <span class="loyalty-val">${returning.toLocaleString()}</span>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const prog = wrap.querySelector('#loyalty-progress');
        if (prog) prog.style.strokeDashoffset = circ - (unique / total) * circ;
    }, 100);
}

const MAP_URL = 'https://cdn.jsdelivr.net/gh/flekschas/simple-world-map@master/world-map.svg';
let cachedMap = null;

async function drawWorldMap(countries) {
    const wrap = $('#world-map');
    if (!countries || !countries.length) { wrap.innerHTML = '<div class="no-data">No location data yet</div>'; return; }

    if (!cachedMap) {
        try {
            const res = await fetch(MAP_URL);
            cachedMap = await res.text();
        } catch (e) {
            wrap.innerHTML = '<div class="no-data">Could not load map</div>';
            return;
        }
    }

    const lookup = {};
    let peak = 0;
    countries.forEach(c => {
        const code = c.cc.toLowerCase();
        lookup[code] = c.n;
        if (c.n > peak) peak = c.n;
    });

    wrap.innerHTML = cachedMap;
    const svg = wrap.querySelector('svg');
    if (!svg) return;

    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.cursor = 'grab';
    svg.style.display = 'block';
    svg.style.overflow = 'visible';

    // Wrap in viewport group
    const innerContent = svg.innerHTML;
    svg.innerHTML = `<g class="map-viewport" style="transform-origin: 0 0;">${innerContent}</g>`;
    const viewport = svg.querySelector('.map-viewport');

    let scale = 1;
    let x = 0;
    let y = 0;
    let isPanning = false;
    let startX, startY;

    function update() {
        viewport.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }

    function zoomAt(factor, cx, cy) {
        const nextScale = Math.min(Math.max(scale * factor, 1), 12);
        if (nextScale !== scale) {
            x -= (cx - x) * (nextScale / scale - 1);
            y -= (cy - y) * (nextScale / scale - 1);
            scale = nextScale;
            update();
        }
    }

    svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = svg.getBoundingClientRect();
        zoomAt(e.deltaY > 0 ? 0.85 : 1.15, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    svg.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isPanning = true;
        startX = e.clientX - x;
        startY = e.clientY - y;
        svg.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        x = e.clientX - startX;
        y = e.clientY - startY;
        update();
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        svg.style.cursor = 'grab';
    });

    svg.addEventListener('dblclick', () => {
        scale = 1; x = 0; y = 0; update();
    });

    function shade(val) {
        const t = val / peak;
        if (t < 0.15) return '#0e4429';
        if (t < 0.35) return '#006d32';
        if (t < 0.6) return '#26a641';
        return '#39d353';
    }

    let tip = document.querySelector('.hm-tip');
    if (!tip) {
        tip = document.createElement('div');
        tip.className = 'hm-tip';
        document.body.appendChild(tip);
    }

    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

    for (const [code, count] of Object.entries(lookup)) {
        const el = viewport.querySelector(`#${code}`);
        if (!el) continue;
        const paths = el.tagName === 'g' ? el.querySelectorAll('path') : [el];

        const name = regionNames.of(code.toUpperCase()) || code.toUpperCase();

        paths.forEach(p => {
            p.style.fill = shade(count);
            p.style.cursor = 'pointer';

            p.addEventListener('mouseenter', (e) => {
                const flag = getFlagEmoji(code);
                tip.innerHTML = `<span style="margin-right:8px">${flag}</span> <strong>${name}</strong>: ${count.toLocaleString()} runs`;
                tip.classList.add('on');
            });
            p.addEventListener('mousemove', (e) => {
                tip.style.left = e.clientX + 12 + 'px';
                tip.style.top = e.clientY - 32 + 'px';
            });
            p.addEventListener('mouseleave', () => {
                tip.classList.remove('on');
            });
        });
    }

    viewport.querySelectorAll('path').forEach(p => {
        if (p.style.fill) return;
        p.addEventListener('mouseenter', (e) => {
            const id = p.id || (p.parentElement.id && p.parentElement.tagName === 'g' ? p.parentElement.id : null);
            if (id && !id.startsWith('_')) {
                const name = regionNames.of(id.toUpperCase()) || id.toUpperCase();
                const flag = getFlagEmoji(id);
                tip.innerHTML = `<span style="margin-right:8px">${flag}</span> <strong>${name}</strong>: 0 runs`;
                tip.classList.add('on');
            }
        });
        p.addEventListener('mousemove', (e) => {
            tip.style.left = e.clientX + 12 + 'px';
            tip.style.top = e.clientY - 32 + 'px';
        });
        p.addEventListener('mouseleave', () => {
            tip.classList.remove('on');
        });
    });

    const controls = document.createElement('div');
    controls.className = 'map-controls';
    controls.innerHTML = `
        <button title="Zoom In" id="m-in">+</button>
        <button title="Zoom Out" id="m-out">−</button>
        <button title="Reset View" id="m-reset">⟲</button>
    `;
    wrap.appendChild(controls);

    controls.querySelector('#m-in').onclick = () => {
        const rect = svg.getBoundingClientRect();
        zoomAt(1.5, rect.width / 2, rect.height / 2);
    };
    controls.querySelector('#m-out').onclick = () => {
        const rect = svg.getBoundingClientRect();
        zoomAt(1 / 1.5, rect.width / 2, rect.height / 2);
        if (scale <= 1.01) { scale = 1; x = 0; y = 0; update(); }
    };
    controls.querySelector('#m-reset').onclick = () => { scale = 1; x = 0; y = 0; update(); };

    const legend = document.createElement('div');
    legend.className = 'map-legend';
    legend.innerHTML = `
        <span>Less</span>
        <div class="map-swatch" style="background:#0e4429"></div>
        <div class="map-swatch" style="background:#006d32"></div>
        <div class="map-swatch" style="background:#26a641"></div>
        <div class="map-swatch" style="background:#39d353"></div>
        <span>More</span>
    `;
    wrap.appendChild(legend);

    const tags = document.createElement('div');
    tags.className = 'map-countries';
    tags.innerHTML = countries.slice(0, 3).map(c => `
        <div class="map-cc">
            <div class="map-cc-dot" style="background:${shade(c.n)}"></div>
            ${c.cc}
            <span class="map-cc-count">${c.n.toLocaleString()}</span>
        </div>
    `).join('');
    wrap.appendChild(tags);
}

function renderProjects() {
    const el = $('#projects-list');

    if (!currentProjects.length) {
        el.innerHTML = '<div class="empty-state">No projects yet. Create one to start tracking.</div>';
        return;
    }

    el.innerHTML = currentProjects.map(p => `
        <div class="proj-row">
            <div class="proj-left">
                <span class="proj-name">${esc(p.name)}</span>
                <span class="proj-meta">${p.project_id}</span>
            </div>
            <div class="proj-right">
                <span class="status-dot"></span>
                <button class="btn-fill btn-sm" data-script="${p.api_key}">Get Script</button>
                <button class="btn-ghost btn-sm" data-summary="${p.project_id}">Summary</button>
                <a class="btn-ghost btn-sm" href="/p/${p.project_id}" target="_blank" style="text-decoration:none;text-align:center">Stats</a>
                <button class="btn-ghost btn-sm" data-edit="${p.project_id}">Edit</button>
                <button class="btn-ghost btn-sm" data-delete="${p.project_id}" style="color:var(--red);border-color:var(--red)">Delete</button>
            </div>
        </div>
    `).join('');
}

function bindEvents() {
    // Auth Modal Controls
    const authOverlay = $('#authOverlay');
    const authClose = $('#authClose');
    
    if (authClose) {
        authClose.onclick = () => {
            if (authOverlay) authOverlay.classList.remove('active');
        };
    }

    $$('.login-trigger').forEach(b => {
        b.onclick = () => {
            if (authOverlay) authOverlay.classList.add('active');
            switchAuthTab('login');
        };
    });

    // Auth Form Submissions
    const loginForm = $('#loginForm');
    const signupForm = $('#signupForm');
    const forgotForm = $('#forgotForm');

    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('input[type="email"]').value;
            const password = loginForm.querySelector('input[type="password"]').value;
            
            try {
                const res = await fetch('/api/antigravity/auth/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, mode: 'login' }),
                    credentials: 'include'
                });
                const data = await res.json();
                
                if (data.success) {
                    notify('Signed in successfully');
                    setTimeout(() => location.reload(), 500);
                } else {
                    notify(data.error || 'Login failed', true);
                }
            } catch (err) {
                notify('An error occurred', true);
            }
        };
    }

    if (signupForm) {
        signupForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = signupForm.querySelectorAll('input[type="email"]')[0].value;
            const password = signupForm.querySelectorAll('input[type="password"]')[0].value;
            const confirmPassword = signupForm.querySelectorAll('input[type="password"]')[1].value;
            
            if (password !== confirmPassword) {
                notify('Passwords do not match', true);
                return;
            }

            try {
                const res = await fetch('/api/antigravity/auth/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, mode: 'signup' }),
                    credentials: 'include'
                });
                const data = await res.json();
                
                if (data.success) {
                    notify('Account created successfully');
                    switchAuthTab('login');
                    signupForm.reset();
                } else {
                    notify(data.error || 'Signup failed', true);
                }
            } catch (err) {
                notify('An error occurred', true);
            }
        };
    }

    if (forgotForm) {
        forgotForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = forgotForm.querySelector('input[type="email"]').value;
            
            try {
                const res = await fetch('/api/antigravity/auth/forgot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                    credentials: 'include'
                });
                const data = await res.json();
                
                if (data.success) {
                    notify('Reset link sent to your email');
                    forgotForm.reset();
                } else {
                    notify(data.error || 'Failed to send reset link', true);
                }
            } catch (err) {
                notify('An error occurred', true);
            }
        };
    }

    // OAuth Buttons
    $$('#discordLoginBtn, #discordSignupBtn').forEach(b => {
        b.onclick = () => { window.location.href = '/api/antigravity/auth/discord'; };
    });

    $$('#googleLoginBtn, #googleSignupBtn').forEach(b => {
        b.onclick = () => { window.location.href = '/api/antigravity/auth/google'; };
    });

    // Close auth modal on overlay click
    if (authOverlay) {
        authOverlay.onclick = (e) => {
            if (e.target === authOverlay) {
                authOverlay.classList.remove('active');
            }
        };
    }

    const logoutBtn = $('.logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await fetch('/api/antigravity/logout', { method: 'POST', credentials: 'include' });
            location.reload();
        };
    }

    const createBtn = $('#open-create');
    if (createBtn) createBtn.onclick = () => openDialog('dlg-create');

    const guideBtn = $('#open-guide');
    if (guideBtn) guideBtn.onclick = () => openDialog('dlg-guide');

    $('#btn-close-summary').onclick = closeSummary;
    $('#drawer-overlay').onclick = closeSummary;

    $$('.close-dlg').forEach(b => { b.onclick = closeDialogs; });

    const overlay = $('#overlay');
    if (overlay) overlay.onclick = (e) => { if (e.target.id === 'overlay') closeDialogs(); };

    const form = $('#form-create');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const name = $('#f-name').value;
            const desc = $('#f-desc').value;

            const res = await fetch('/api/antigravity/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description: desc }),
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                notify('Project created');
                closeDialogs();
                form.reset();
                const r2 = await fetch('/api/antigravity/me', { credentials: 'include' });
                const d2 = await r2.json();
                if (d2.authenticated) { currentProjects = d2.projects; renderProjects(); }
            } else {
                notify(data.error || 'Failed', true);
            }
        };
    }

    document.addEventListener('click', (e) => {
        const scriptBtn = e.target.closest('[data-script]');
        if (scriptBtn) {
            showScript(scriptBtn.dataset.script);
            return;
        }

        const delBtn = e.target.closest('[data-delete]');
        if (delBtn) {
            deleteProject(delBtn.dataset.delete);
            return;
        }

        const editBtn = e.target.closest('[data-edit]');
        if (editBtn) {
            const pid = editBtn.dataset.edit;
            const p = currentProjects.find(x => x.project_id === pid);
            if (p) {
                $('#e-id').value = p.project_id;
                $('#e-name').value = p.name;
                $('#e-desc').value = p.description || '';
                openDialog('dlg-edit');
            }
            return;
        }

        const summaryBtn = e.target.closest('[data-summary]');
        if (summaryBtn) {
            fetchSummaryAndOpen(summaryBtn.dataset.summary);
            return;
        }
    });

    const editForm = $('#form-edit');
    if (editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = $('#e-id').value;
            const name = $('#e-name').value;
            const description = $('#e-desc').value;

            const res = await fetch(`/api/antigravity/projects/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description }),
                credentials: 'include'
            });
            const data = await res.json();

            if (data.success) {
                notify('Project updated');
                closeDialogs();
                const r2 = await fetch('/api/antigravity/me', { credentials: 'include' });
                const d2 = await r2.json();
                if (d2.authenticated) { currentProjects = d2.projects; renderProjects(); }
            } else {
                notify(data.error || 'Failed', true);
            }
        };
    }
}

async function deleteProject(id) {
    if (!confirm('Delete this project and all its data?')) return;

    const res = await fetch(`/api/antigravity/projects/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    const data = await res.json();

    if (data.success) {
        notify('Project deleted');
        currentProjects = currentProjects.filter(p => p.project_id !== id);
        renderProjects();
    } else {
        notify(data.error || 'Failed', true);
    }
}

function showScript(key) {
    const origin = window.location.origin;
    const code = `local http = (syn and syn.request) or request or http_request
local HttpService = game:GetService("HttpService")

local function Track(eventType, userId)
    pcall(function()
        http({
            Url = "${origin}/api/antigravity/track",
            Method = "POST",
            Headers = { ["Content-Type"] = "application/json" },
            Body = HttpService:JSONEncode({
                apiKey = "${key}",
                eventType = eventType or "PING",
                userId = userId or tostring(game.Players.LocalPlayer.UserId),
                metadata = {
                    placeId = game.PlaceId,
                    jobId = game.JobId
                }
            })
        })
    end)
end

Track("EXECUTION")`;

    $('#script-output').textContent = code;
    openDialog('dlg-script');

    $('.copy-btn').onclick = () => {
        navigator.clipboard.writeText(code);
        notify('Copied');
    };
}

function openDialog(id) {
    $$('.dialog').forEach(d => d.classList.add('hidden'));
    $(`#${id}`).classList.remove('hidden');
    $('#overlay').classList.add('active');
}

function closeDialogs() {
    $('#overlay').classList.remove('active');
}

function notify(msg, err = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

function esc(s) {
    const d = document.createElement('span');
    d.textContent = s;
    return d.innerHTML;
}

boot();

let currentSlide = 0;
let summaryData = null;

function openSummary(data) {
    summaryData = data;
    currentSlide = 0;
    const modal = $('#summary-modal');
    const overlay = $('#drawer-overlay');
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.add('active');
        overlay.classList.add('active');
        renderSlide();
    }, 10);

    $('#btn-next-slide').onclick = () => {
        if (currentSlide < slides.length - 1) {
            currentSlide++;
            renderSlide();
        } else {
            closeSummary();
        }
    };

    $('#btn-prev-slide').onclick = () => {
        if (currentSlide > 0) {
            currentSlide--;
            renderSlide();
        }
    };
}

function closeSummary() {
    const modal = $('#summary-modal');
    const overlay = $('#drawer-overlay');
    modal.classList.remove('active');
    overlay.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

const slides = [
    {
        title: 'Executive Overview',
        subtitle: 'High-level project health',
        render: (data, el) => {
            const total = data.stats.total;
            const unique = data.stats.unique;
            const returning = Math.max(0, total - unique);
            const retention = total > 0 ? ((returning / total) * 100).toFixed(1) : 0;
            
            el.innerHTML = `
                <div class="report-metrics-large">
                    <div class="stat-card"><span class="stat-num">${total.toLocaleString()}</span><span class="stat-label">Total Runs</span></div>
                    <div class="stat-card"><span class="stat-num">${unique.toLocaleString()}</span><span class="stat-label">Unique Users</span></div>
                    <div class="stat-card"><span class="stat-num">${retention}%</span><span class="stat-label">Retention Rate</span></div>
                    <div class="stat-card"><span class="stat-num">${returning.toLocaleString()}</span><span class="stat-label">Recurring Players</span></div>
                </div>
                <div class="slide-text">
                    Your script is currently maintaining a <strong>${retention}% retention rate</strong>. 
                    With <strong>${unique.toLocaleString()}</strong> unique individuals reached, the project shows ${total > 1000 ? 'significant' : 'growing'} scale.
                </div>
            `;
        }
    },
    {
        title: 'Activity Momentum',
        subtitle: '7-day execution trend',
        render: (data, el) => {
            el.innerHTML = `
                <div id="slide-chart" style="height:250px"></div>
                <div class="slide-text" id="slide-analysis"></div>
            `;
            drawLineChart(data.activity.daily, '#slide-chart');
            const last7 = data.activity.daily.slice(-7);
            const avg = last7.length ? (last7.reduce((a, b) => a + b.n, 0) / last7.length).toFixed(0) : 0;
            $('#slide-analysis').innerHTML = `Averages <strong>${avg} executions per day</strong> over the last week. The trend line indicates ${last7[last7.length-1]?.n > last7[0]?.n ? 'upward growth' : 'stable maintenance'}.`;
        }
    },
    {
        title: 'Peak Hours',
        subtitle: 'When your players are active',
        render: (data, el) => {
            el.innerHTML = `
                <div id="slide-chart" style="height:250px"></div>
                <div class="slide-text" id="slide-analysis"></div>
            `;
            drawHourlyChart(data.activity.hourly, '#slide-chart');
            const peakHour = data.activity.hourly.reduce((a, b) => a.n > b.n ? a : b, {hr:0, n:0}).hr;
            $('#slide-analysis').innerHTML = `Your peak traffic window is at <strong>${peakHour}:00 UTC</strong>. We recommend scheduling updates outside of this peak to avoid player disruption.`;
        }
    },
    {
        title: 'User Loyalty',
        subtitle: 'New vs Recurring players',
        render: (data, el) => {
            el.innerHTML = `
                <div id="slide-chart" style="height:250px"></div>
                <div class="slide-text" id="slide-analysis"></div>
            `;
            drawLoyaltyChart(data.stats.total, data.stats.unique, '#slide-chart');
            const returning = data.stats.total - data.stats.unique;
            const perc = ((returning / data.stats.total) * 100).toFixed(1);
            $('#slide-analysis').innerHTML = `<strong>${perc}%</strong> of your traffic comes from returning users. A high loyalty score is the best indicator of a high-quality, useful script.`;
        }
    },
    {
        title: 'Weekly Rhythm',
        subtitle: 'Activity by day of week',
        render: (data, el) => {
            el.innerHTML = `
                <div id="slide-chart" style="height:250px"></div>
                <div class="slide-text" id="slide-analysis"></div>
            `;
            drawWeeklyRhythm(data.activity.daily, '#slide-chart');
            const days = new Array(7).fill(0);
            data.activity.daily.forEach(d => {
                const date = new Date(d.day + 'T12:00:00');
                days[date.getDay()] += d.n;
            });
            const peakDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][days.indexOf(Math.max(...days))];
            $('#slide-analysis').innerHTML = `<strong>${peakDay}</strong> is your strongest day. Engagement typically peaks during ${peakDay === 'Saturday' || peakDay === 'Sunday' ? 'the weekend' : 'mid-week'} sessions.`;
        }
    }
];

function renderSlide() {
    const slide = slides[currentSlide];
    $('#slide-title').textContent = slide.title;
    $('#slide-subtitle').textContent = slide.subtitle;
    
    const content = $('#slide-content');
    content.innerHTML = '';
    slide.render(summaryData, content);

    // Update buttons
    $('#btn-prev-slide').style.visibility = currentSlide === 0 ? 'hidden' : 'visible';
    $('#btn-next-slide').textContent = currentSlide === slides.length - 1 ? 'Finish' : 'Next';

    // Update dots
    const indicator = $('#slide-indicator');
    indicator.innerHTML = slides.map((_, i) => `<div class="dot ${i === currentSlide ? 'active' : ''}"></div>`).join('');
}

async function fetchSummaryAndOpen(id) {
    try {
        const [statsRes, actRes] = await Promise.all([
            fetch(`/api/antigravity/stats/${id}`),
            fetch(`/api/antigravity/activity/${id}`)
        ]);
        const data = await statsRes.json();
        const activity = actRes.ok ? await actRes.json() : { daily: [], hourly: [], types: [], countries: [] };
        if (data.name) {
            openSummary({ ...data, activity });
        } else {
            notify('Could not load summary', true);
        }
    } catch (e) {
        console.error('Fetch Summary Error:', e);
        notify('Network error', true);
    }
}

function showForgotModal() {
    document.getElementById('forgotModal').style.display = 'block';
}

function hideForgotModal() {
    document.getElementById('forgotModal').style.display = 'none';
}
