/* ========================
   TOAST NOTIFICATIONS
======================== */

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

/* ========================
   LOADING STATES
======================== */

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

const API_BASE = "http://localhost:5000/api";

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

        const response = await fetch(`${API_BASE}${endpoint}`, options);
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

function saveUserSession(role, messId = null, phone = null, name = null) {
    localStorage.setItem('role', role);
    if (messId !== null) localStorage.setItem('mess_id', messId);
    if (phone !== null) localStorage.setItem('customer_phone', phone);
    if (name !== null) localStorage.setItem('customer_name', name);
}

function getUserSession() {
    return {
        role: localStorage.getItem('role'),
        mess_id: localStorage.getItem('mess_id'),
        customer_phone: localStorage.getItem('customer_phone'),
        customer_name: localStorage.getItem('customer_name')
    };
}

function clearUserSession() {
    localStorage.removeItem('role');
    localStorage.removeItem('mess_id');
    localStorage.removeItem('customer_phone');
    localStorage.removeItem('customer_name');
}

function isLoggedIn() {
    return !!localStorage.getItem('role');
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
        window.location.href = 'index.html';
    }, 500);
}
