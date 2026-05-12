// Dashboard JavaScript - Glassmorphism Theme System

class GlassmorphismDashboard {
    constructor() {
        this.currentTheme = 'light-orange';
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSavedTheme();
        this.initializeAnimations();
    }

    bindEvents() {
        // Settings modal
        const settingsBtn = document.getElementById('settingsBtn');
        const closeSettings = document.getElementById('closeSettings');
        const modal = document.getElementById('settingsModal');

        settingsBtn.addEventListener('click', () => this.openSettings());
        closeSettings.addEventListener('click', () => this.closeSettings());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeSettings();
        });

        // Theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.changeTheme(e.target.dataset.theme));
        });

        // Dark mode toggle
        const darkModeToggle = document.getElementById('darkModeToggle');
        darkModeToggle.addEventListener('change', (e) => this.toggleDarkMode(e.target.checked));

        // iOS toggles haptic feedback
        document.querySelectorAll('.ios-toggle input').forEach(toggle => {
            toggle.addEventListener('change', (e) => this.handleToggleHaptic(e.target));
        });

        // Export button
        document.querySelector('.export-btn').addEventListener('click', () => this.handleExport());

        // Refresh button
        document.querySelector('.refresh-btn').addEventListener('click', () => this.handleRefresh());
    }

    openSettings() {
        const modal = document.getElementById('settingsModal');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeSettings() {
        const modal = document.getElementById('settingsModal');
        modal.classList.remove('active';
        document.body.style.overflow = '';
    }

    changeTheme(themeName) {
        // Remove active class from all theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to selected theme button
        document.querySelector(`[data-theme="${themeName}"]`).classList.add('active');

        // Apply theme
        document.body.className = `theme-${themeName}`;

        // Update liquid background colors
        this.updateLiquidBackground(themeName);

        // Save theme preference
        localStorage.setItem('dashboard-theme', themeName);
        this.currentTheme = themeName;

        // Update dark mode toggle state
        const darkModeToggle = document.getElementById('darkModeToggle');
        darkModeToggle.checked = themeName.includes('dark');
    }

    toggleDarkMode(isDark) {
        const currentAccent = this.currentTheme.includes('purple') ? 'purple' : 'orange';
        const newTheme = isDark ? `dark-${currentAccent}` : `light-${currentAccent}`;
        this.changeTheme(newTheme);
    }

    updateLiquidBackground(themeName) {
        const accentColor = themeName.includes('purple') ? '#a855f7' : '#ff7b00';
        document.documentElement.style.setProperty('--accent-color', accentColor);

        // Update CSS custom properties for liquid background
        const root = document.documentElement;
        root.style.setProperty('--liquid-accent', accentColor);
    }

    handleToggleHaptic(toggle) {
        // Add haptic feedback animation
        const slider = toggle.nextElementSibling;
        slider.style.transform = 'scale(0.95)';

        setTimeout(() => {
            slider.style.transform = '';
        }, 150);

        // Visual feedback
        this.showToast(toggle.checked ? 'Enabled' : 'Disabled', 'success');
    }

    handleExport() {
        // Simulate export process
        const btn = document.querySelector('.export-btn');
        const originalText = btn.innerHTML;

        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
            Exporting...
        `;

        setTimeout(() => {
            btn.innerHTML = originalText;
            this.showToast('Data exported successfully!', 'success');
        }, 2000);
    }

    handleRefresh() {
        const btn = document.querySelector('.refresh-btn');

        // Add spinning animation
        btn.style.animation = 'spin 1s ease-in-out';

        // Update pulse points with new random positions
        const pulsePoints = document.querySelectorAll('.pulse-point');
        pulsePoints.forEach(point => {
            const newTop = Math.random() * 80 + 10; // 10% to 90%
            const newLeft = Math.random() * 80 + 10; // 10% to 90%
            point.style.top = `${newTop}%`;
            point.style.left = `${newLeft}%`;
        });

        setTimeout(() => {
            btn.style.animation = '';
            this.showToast('Data refreshed!', 'info');
        }, 1000);
    }

    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        // Add to DOM
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 100);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    loadSavedTheme() {
        const savedTheme = localStorage.getItem('dashboard-theme') || 'light-orange';
        this.changeTheme(savedTheme);
    }

    initializeAnimations() {
        // Add intersection observer for scroll animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);

        // Observe control cards
        document.querySelectorAll('.control-card').forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'all 0.6s ease-out';
            observer.observe(card);
        });
    }
}

// Add CSS for toast notifications and spinning animation
const style = document.createElement('style');
style.textContent = `
    .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease-out;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .toast.show {
        transform: translateX(0);
    }

    .toast-success {
        background: rgba(16, 185, 129, 0.9);
    }

    .toast-info {
        background: rgba(59, 130, 246, 0.9);
    }

    .toast-warning {
        background: rgba(245, 158, 11, 0.9);
    }

    .toast-error {
        background: rgba(239, 68, 68, 0.9);
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .spinning {
        animation: spin 1s linear infinite;
    }

    /* Enhanced glassmorphism effects */
    .control-card {
        position: relative;
        overflow: hidden;
    }

    .control-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
        transition: left 0.5s;
    }

    .control-card:hover::before {
        left: 100%;
    }

    /* Pulse animation for status dots */
    @keyframes pulse-glow {
        0%, 100% {
            box-shadow: 0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor;
        }
        50% {
            box-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
        }
    }

    .status-dot.active {
        animation: pulse-glow 2s ease-in-out infinite;
    }
`;
document.head.appendChild(style);

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GlassmorphismDashboard();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('settingsModal');
        if (modal.classList.contains('active')) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // Ctrl/Cmd + K to open settings
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('settingsBtn').click();
    }
});</content>
<parameter name="filePath">/workspaces/AntigravityKeys/public/dashboard.js