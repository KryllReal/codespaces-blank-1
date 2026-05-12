// Theme Management System

const DARK_MODE_KEY = 'antigravity-dark-mode';

function initTheme() {
    const isDarkMode = localStorage.getItem(DARK_MODE_KEY) === 'true';
    applyMode(isDarkMode);

    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.checked = isDarkMode;
        darkModeToggle.addEventListener('change', (event) => {
            applyMode(event.target.checked);
        });
    }
}

function applyMode(isDark) {
    if (isDark) {
        document.documentElement.setAttribute('data-mode', 'dark');
    } else {
        document.documentElement.removeAttribute('data-mode');
    }
    localStorage.setItem(DARK_MODE_KEY, String(isDark));
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initTheme);
