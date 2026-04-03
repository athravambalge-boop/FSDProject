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

        const res = await fetch("http://localhost:5000/api/auth/login", {
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

        // Redirect based on role
        setTimeout(() => {
            switch (data.role) {
                case "owner":
                    window.location.href = "owner.html";
                    break;
                case "visitor":
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
        const errorMsg = "Unable to connect to server. Make sure backend is running on http://localhost:5000";
        errorDiv.textContent = errorMsg;
        errorDiv.classList.add('show');
        showToast(errorMsg, 'error');
    }
}

/* ========================
   INITIALIZE LOGIN PAGE
======================== */

document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
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

    // Enter key to login
    document.getElementById('password')?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            login();
        }
    });
});
