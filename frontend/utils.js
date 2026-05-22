const THEME_STORAGE_KEY = 'theme-preference';

function getStoredThemePreference() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : '';
}

function getSystemThemePreference() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncThemeToggle(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) {
        return;
    }

    const isDark = theme === 'dark';
    themeToggle.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    themeToggle.setAttribute('aria-pressed', String(isDark));
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

function applyThemePreference(theme, options = {}) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.documentElement.style.colorScheme = nextTheme;

    if (document.body) {
        document.body.setAttribute('data-theme', nextTheme);
    }

    if (options.persist) {
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }

    syncThemeToggle(nextTheme);
    return nextTheme;
}

function initializeThemePreference() {
    applyThemePreference(getStoredThemePreference() || getSystemThemePreference());
}

window.applyThemePreference = applyThemePreference;
window.initializeThemePreference = initializeThemePreference;

document.addEventListener('DOMContentLoaded', initializeThemePreference);
document.addEventListener('DOMContentLoaded', loadGoogleClientId);

window.addEventListener('storage', (event) => {
    if (event.key === THEME_STORAGE_KEY) {
        applyThemePreference(event.newValue || getSystemThemePreference());
    }
});

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove();">×</button>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, duration);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

function showLoading(elementId = null) {
    if (elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = '<div class="spinner"></div>';
        }
    } else {
        const spinner = document.createElement('div');
        spinner.className = 'spinner-overlay';
        spinner.id = 'loadingOverlay';
        spinner.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(spinner);
    }
}

function hideLoading(elementId = null) {
    if (elementId) {
        const element = document.getElementById(elementId);
        if (element) element.innerHTML = '';
    } else {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.remove();
    }
}

// Smooth hiding with fade animation
function hideLoadingSmoothly(elementId = null) {
    if (elementId) {
        const element = document.getElementById(elementId);
        if (element) element.innerHTML = '';
    } else {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }
    }
}

/* ========================
   VALIDATION FUNCTIONS
======================== */

function validatePhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length === 10;
}

function validateName(name) {
    return name && name.trim().length >= 2 && name.trim().length <= 100;
}

function validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

function formatPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return cleaned.slice(0, 3) + ' ' + cleaned.slice(3, 6) + ' ' + cleaned.slice(6);
    }
    return cleaned;
}

/* ========================
   API HELPERS
======================== */

const IS_LOCAL_HOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const IS_FILE_PROTOCOL = window.location.protocol === 'file:';

function isLoopbackOrigin(url) {
    return /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(url || ''));
}

const API_ORIGIN = (() => {
    const override = window.API_ORIGIN || localStorage.getItem('api_origin');

    // In local development, always use local backend unless explicitly overridden via window.API_ORIGIN.
    if ((IS_LOCAL_HOST || IS_FILE_PROTOCOL) && !window.API_ORIGIN) {
        return 'http://localhost:5000';
    }

    if (override) {
        const cleaned = String(override).replace(/\/+$/, '');
        // Prevent deployed frontend from being pinned to localhost by mistake.
        if (!IS_LOCAL_HOST && isLoopbackOrigin(cleaned)) {
            return 'https://pccoe-campus-bites.onrender.com';
        }
        return cleaned;
    }

    if (IS_LOCAL_HOST || IS_FILE_PROTOCOL) {
        return 'http://localhost:5000';
    }

    // In production deployment, use production backend
    return 'https://pccoe-campus-bites.onrender.com';
})();

const IS_PLACEHOLDER_API = API_ORIGIN.includes('your-backend-domain.com');
const NEEDS_BACKEND_CONFIG = !IS_LOCAL_HOST && (IS_PLACEHOLDER_API || isLoopbackOrigin(API_ORIGIN));

const API_BASE = `${API_ORIGIN}/api`;

// Google OAuth Client ID - Will be fetched from backend
let GOOGLE_CLIENT_ID = (() => {
    // Try to get from window object first (for custom override)
    if (window.GOOGLE_CLIENT_ID) {
        return window.GOOGLE_CLIENT_ID;
    }
    
    // Try to get from localStorage
    const stored = localStorage.getItem('google_client_id');
    if (stored) {
        return stored;
    }
    
    // Will be fetched from backend config
    return '';
})();

// Fetch Google Client ID from backend
async function loadGoogleClientId() {
    try {
        const response = await fetch(apiUrl('auth/config'));
        if (response.ok) {
            const data = await response.json();
            if (data.google_client_id) {
                GOOGLE_CLIENT_ID = data.google_client_id;
                localStorage.setItem('google_client_id', data.google_client_id);
            }
        }
    } catch (error) {
        console.error('Failed to load Google Client ID:', error);
    }
}

function apiUrl(path = '') {
    const cleanPath = String(path).replace(/^\/+/, '');
    return cleanPath ? `${API_BASE}/${cleanPath}` : API_BASE;
}

function normalizeApiOrigin(input) {
    if (!input) return '';
    let value = String(input).trim();

    if (!/^https?:\/\//i.test(value)) {
        value = `https://${value}`;
    }

    try {
        const url = new URL(value);
        return `${url.protocol}//${url.host}`;
    } catch (error) {
        return '';
    }
}

window.normalizeApiOrigin = normalizeApiOrigin;

function setBackendOriginFromPrompt() {
    const current = localStorage.getItem('api_origin') || '';
    const suggested = current || (IS_PLACEHOLDER_API ? '' : API_ORIGIN);
    const entered = window.prompt('Enter backend URL (example: https://your-backend.onrender.com)', suggested);

    if (entered === null) return;

    const normalized = normalizeApiOrigin(entered);
    if (!normalized) {
        alert('Invalid URL. Please enter a valid backend domain URL.');
        return;
    }

    localStorage.setItem('api_origin', normalized);
    window.location.reload();
}

window.setBackendApiOrigin = setBackendOriginFromPrompt;

async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const path = String(endpoint).replace(/^\/+/, '');
        const response = await fetch(apiUrl(path), options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `HTTP ${response.status}`);
        }

        return result;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

/* ========================
   LOCAL STORAGE HELPERS
======================== */

function saveUserSession(role, messId = null, phone = null, name = null, email = null, contact = null) {
    localStorage.setItem('role', role);
    if (messId !== null) localStorage.setItem('mess_id', messId);
    if (phone !== null) localStorage.setItem('customer_phone', phone);
    if (name !== null) localStorage.setItem('customer_name', name);
    if (email !== null) localStorage.setItem('customer_email', email);
    if (contact !== null) localStorage.setItem('customer_contact', contact);
}

function getUserSession() {
    return {
        role: localStorage.getItem('role'),
        mess_id: localStorage.getItem('mess_id'),
        customer_phone: localStorage.getItem('customer_phone'),
        customer_name: localStorage.getItem('customer_name'),
        customer_email: localStorage.getItem('customer_email'),
        customer_contact: localStorage.getItem('customer_contact') || localStorage.getItem('customer_phone') || localStorage.getItem('customer_email')
    };
}

function clearUserSession() {
    localStorage.removeItem('role');
    localStorage.removeItem('mess_id');
    localStorage.removeItem('customer_phone');
    localStorage.removeItem('customer_name');
    localStorage.removeItem('customer_email');
    localStorage.removeItem('customer_contact');
}

function isLoggedIn() {
    return !!localStorage.getItem('role');
}

function saveVisitorAccount(account) {
    localStorage.setItem('saved_visitor_account', JSON.stringify(account));
}

function getSavedVisitorAccount() {
    try {
        const raw = localStorage.getItem('saved_visitor_account');
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error('Unable to parse saved visitor account:', error);
        return null;
    }
}

/* ========================
   TIME FORMATTING
======================== */

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

/* ========================
   CURRENCY FORMATING
======================== */

function formatCurrency(amount) {
    return `₹${parseFloat(amount).toFixed(2)}`;
}

/* ========================
   MODAL HELPERS
======================== */

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

/* ========================
   LOGOUT HANDLER
======================== */

function logout() {
    clearUserSession();
    showToast('Logged out successfully!', 'info');
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 500);
}

document.addEventListener('DOMContentLoaded', () => {
    if (!NEEDS_BACKEND_CONFIG) return;
    if (document.body.dataset.showBackendConfig !== 'true') return;
    if (document.getElementById('setBackendUrlBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Set Backend URL';
    btn.style.position = 'fixed';
    btn.style.right = '16px';
    btn.style.bottom = '16px';
    btn.style.zIndex = '9999';
    btn.style.width = 'auto';
    btn.style.padding = '10px 14px';
    btn.style.border = 'none';
    btn.style.borderRadius = '999px';
    btn.style.cursor = 'pointer';
    btn.style.color = '#fff';
    btn.style.background = 'linear-gradient(135deg, #d35400, #e67e22)';
    btn.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
    btn.onclick = setBackendOriginFromPrompt;

    document.body.appendChild(btn);

    // Show once per tab session to avoid repetitive alerts.
    if (!sessionStorage.getItem('api_origin_notice_shown')) {
        showToast('Backend URL not configured. Use "Set Backend URL".', 'warning', 6000);
        sessionStorage.setItem('api_origin_notice_shown', '1');
    }
});

function loadCampusBitesChatbotAssets() {
    if (window.__campusBitesChatbotAssetsLoaded) {
        return;
    }

    window.__campusBitesChatbotAssetsLoaded = true;

    if (!document.getElementById('campusBitesChatbotCss')) {
        const css = document.createElement('link');
        css.id = 'campusBitesChatbotCss';
        css.rel = 'stylesheet';
        css.href = 'chatbot.css';
        document.head.appendChild(css);
    }

    if (!document.getElementById('campusBitesChatbotScript')) {
        const script = document.createElement('script');
        script.id = 'campusBitesChatbotScript';
        script.src = 'chatbot.js';
        script.defer = true;
        document.body.appendChild(script);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.body?.dataset.disableChatbot === 'true') {
        return;
    }

    loadCampusBitesChatbotAssets();
});
