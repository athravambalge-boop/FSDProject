function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
}

function clearError() {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = '';
    errorDiv.classList.remove('show');
}

async function signupWithEmail() {
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    // Validation
    if (!validateEmail(email)) {
        showError('Please enter a valid email address.');
        return;
    }

    if (!password || password.length < 6) {
        showError('Password must be at least 6 characters.');
        return;
    }

    if (password !== confirmPassword) {
        showError('Password and confirm password do not match.');
        return;
    }

    clearError();

    try {
        showLoading();

        // Create username from email
        const username = email.split('@')[0] + Math.random().toString(36).substr(2, 5);

        const response = await fetch(apiUrl('auth/register'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                email,
                password,
                role: 'visitor'
            })
        });

        hideLoading();

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const errorMsg = err.details || err.error || 'Failed to create account.';
            showError(errorMsg);
            showToast(errorMsg, 'error');
            return;
        }

        const data = await response.json();

        // Save session
        saveUserSession(
            'visitor',
            null,
            null,
            email,
            email,
            email
        );

        localStorage.setItem('auth_token', data.token || '');
        localStorage.setItem('loginTime', new Date().toISOString());

        showToast('Account created successfully!', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);
    } catch (error) {
        console.error('Signup error:', error);
        hideLoading();
        showError(`Connection error: ${error.message}`);
        showToast('Backend connection failed.', 'error');
    }
}

function loginWithGoogle() {
    // Google OAuth will be implemented
    showToast('Google login integration coming soon.', 'info');
}

function signupWithGoogle() {
    // Google OAuth will be implemented
    showToast('Google signup integration coming soon.', 'info');
}

function continueWithSavedAccount() {
    const savedAccount = getSavedVisitorAccount();
    if (!savedAccount) return;

    saveUserSession(
        'visitor',
        null,
        savedAccount.phone || null,
        savedAccount.name || savedAccount.email,
        savedAccount.email || null,
        savedAccount.email || savedAccount.phone || ''
    );

    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    if (isLoggedIn()) {
        const session = getUserSession();
        if (session.role === 'owner') {
            window.location.href = 'owner.html';
            return;
        }
        if (session.role === 'admin') {
            window.location.href = 'admin.html';
            return;
        }
        window.location.href = 'index.html';
        return;
    }

    const savedAccount = getSavedVisitorAccount();
    if (savedAccount) {
        const savedCard = document.getElementById('savedAccountCard');
        const savedText = document.getElementById('savedAccountText');
        savedText.textContent = `${savedAccount.email || savedAccount.name} - Continue with this account?`;
        savedCard.hidden = false;
    }

    document.getElementById('signupPassword')?.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            signupWithEmail();
        }
    });
});
