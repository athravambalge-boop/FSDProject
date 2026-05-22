async function login() {
    try {
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        const errorDiv = document.getElementById("error");

        // Validation
        if (!username || !password) {
            errorDiv.textContent = "Username and password are required";
            errorDiv.classList.add('show');
            return;
        }

        if (username.length < 2) {
            errorDiv.textContent = "Username must be at least 2 characters";
            errorDiv.classList.add('show');
            return;
        }

        showLoading();
        errorDiv.classList.remove('show');

        const res = await fetch(apiUrl("auth/login"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        hideLoading();

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const errorMsg = err.error || "Login failed. Please check your credentials.";
            errorDiv.textContent = errorMsg;
            errorDiv.classList.add('show');
            showToast(errorMsg, 'error');
            return;
        }

        const data = await res.json();

        if (!data.role) {
            errorDiv.textContent = "Invalid login response";
            errorDiv.classList.add('show');
            return;
        }

        // Save session
        saveUserSession(
            data.role,
            data.mess_id || null,
            data.phone || null,
            data.username || username,
            data.email || null,
            data.contact || data.phone || data.email || data.username || username
        );

        // Store additional info
        localStorage.setItem("auth_token", data.token || "");
        localStorage.setItem("loginTime", new Date().toISOString());

        showToast(`Welcome ${data.username || username}!`, 'success');

        const pendingMenuTargetRaw = sessionStorage.getItem('pendingMenuTarget');
        const pendingMenuTarget = pendingMenuTargetRaw ? JSON.parse(pendingMenuTargetRaw) : null;
        if (pendingMenuTargetRaw) {
            sessionStorage.removeItem('pendingMenuTarget');
        }

        async function resolveMessByQuery(query) {
            const cleanQuery = String(query || '').trim().toLowerCase();
            if (!cleanQuery) {
                return null;
            }

            const response = await fetch(apiUrl(`mess?search=${encodeURIComponent(cleanQuery)}`));
            if (!response.ok) {
                return null;
            }

            const messes = await response.json();
            return messes.find((mess) => {
                const name = String(mess.name || '').toLowerCase();
                const location = String(mess.location || '').toLowerCase();
                return name.includes(cleanQuery) || location.includes(cleanQuery);
            }) || messes[0] || null;
        }

        // Redirect based on role
        setTimeout(() => {
            switch (data.role) {
                case "owner":
                    window.location.href = "owner.html";
                    break;
                case "visitor":
                    if (pendingMenuTarget) {
                        resolveMessByQuery(pendingMenuTarget.messQuery).then((mess) => {
                            if (!mess) {
                                window.location.href = "index.html";
                                return;
                            }

                            const query = new URLSearchParams({
                                id: String(mess.mess_id),
                                item: pendingMenuTarget.item || '',
                                mess: mess.name
                            });

                            window.location.href = `mess.html?${query.toString()}`;
                        });
                        return;
                    }

                    window.location.href = "index.html";
                    break;
                case "admin":
                    window.location.href = "admin.html";
                    break;
                default:
                    errorDiv.textContent = "Unknown role. Please contact support.";
                    errorDiv.classList.add('show');
            }
        }, 1000);

    } catch (error) {
        console.error("Login error:", error);
        hideLoading();
        const errorDiv = document.getElementById("error");
        const errorMsg = `Unable to connect to server. Check backend URL: ${API_ORIGIN}`;
        errorDiv.textContent = errorMsg;
        errorDiv.classList.add('show');
        showToast(errorMsg, 'error');
    }
}

function loginWithGoogle() {
    if (!GOOGLE_CLIENT_ID) {
        showToast('Google Client ID not configured. Please set it up.', 'error');
        return;
    }
    
    // Initialize Google Sign-In
    if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleLogin
        });
        
        // Prompt user to sign in
        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                // If prompt isn't displayed, show fallback
                showGoogleSignInButton('googleLoginBtn');
            }
        });
    }
}

function showGoogleSignInButton(elementId) {
    if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleLogin
        });
        
        google.accounts.id.renderButton(
            document.getElementById(elementId),
            { theme: 'outline', size: 'large' }
        );
    }
}

async function handleGoogleLogin(response) {
    try {
        showLoading();
        
        const res = await fetch(apiUrl('auth/google-login'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: response.credential
            })
        });

        hideLoading();

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const errorMsg = err.error || 'Google login failed.';
            showToast(errorMsg, 'error');
            return;
        }

        const data = await res.json();

        // Save session
        saveUserSession(
            data.role,
            data.mess_id || null,
            data.phone || null,
            data.name || data.email,
            data.email || null,
            data.email || data.phone || data.name
        );

        localStorage.setItem('auth_token', data.token || '');
        localStorage.setItem('loginTime', new Date().toISOString());

        showToast(`Welcome ${data.name || data.email}!`, 'success');

        setTimeout(() => {
            switch (data.role) {
                case 'owner':
                    window.location.href = 'owner.html';
                    break;
                case 'admin':
                    window.location.href = 'admin.html';
                    break;
                default:
                    window.location.href = 'index.html';
            }
        }, 800);

    } catch (error) {
        console.error('Google login error:', error);
        hideLoading();
        showToast('Google login failed. Try again.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (isLoggedIn()) {
        const session = getUserSession();
        if (session.role === 'owner') {
            window.location.href = 'owner.html';
        } else if (session.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'index.html';
        }
    }

    document.getElementById('password')?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            login();
        }
    });

    // Initialize Google Sign-In button
    if (window.google && window.google.accounts && window.google.accounts.id) {
        setTimeout(() => {
            if (GOOGLE_CLIENT_ID) {
                showGoogleSignInButton('googleLoginBtn');
            }
        }, 1500);
    }
});
