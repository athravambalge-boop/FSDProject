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

function signupWithGoogle() {
    if (!GOOGLE_CLIENT_ID) {
        showToast('Google Client ID not configured. Please set it up.', 'error');
        return;
    }
    
    // Initialize Google Sign-In
    if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSignup
        });
        
        // Prompt user to sign in
        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                // If prompt isn't displayed, show fallback
                showGoogleSignUpButton('googleSignupBtn');
            }
        });
    }
}

function showGoogleSignUpButton(elementId) {
    if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSignup
        });
        
        google.accounts.id.renderButton(
            document.getElementById(elementId),
            { theme: 'outline', size: 'large' }
        );
    }
}

async function handleGoogleSignup(response) {
    try {
        showLoading();
        
        const res = await fetch(apiUrl('auth/google-signup'), {
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
            const errorMsg = err.error || 'Google signup failed.';
            showError(errorMsg);
            showToast(errorMsg, 'error');
            return;
        }

        const data = await res.json();

        // Save session
        saveUserSession(
            'visitor',
            null,
            null,
            data.name || data.email,
            data.email || null,
            data.email || data.name
        );

        localStorage.setItem('auth_token', data.token || '');
        localStorage.setItem('loginTime', new Date().toISOString());

        showToast('Account created successfully with Google!', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);

    } catch (error) {
        console.error('Google signup error:', error);
        hideLoading();
        showError('Google signup failed. Try again.');
        showToast('Google signup failed.', 'error');
    }
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

    // Initialize Google Sign-In button
    if (GOOGLE_CLIENT_ID && window.google) {
        setTimeout(() => {
            showGoogleSignUpButton('googleSignupBtn');
        }, 1000);
    }
});
