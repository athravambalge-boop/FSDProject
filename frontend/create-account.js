let contactMode = 'phone';
let pendingSignup = null;
let otpVerified = false;
let verifiedOtp = '';

function setContactMode(mode) {
    contactMode = mode === 'email' ? 'email' : 'phone';

    const contactInput = document.getElementById('contactValue');
    const phoneBtn = document.getElementById('phoneModeBtn');
    const emailBtn = document.getElementById('emailModeBtn');

    if (contactMode === 'phone') {
        contactInput.placeholder = '10-digit phone number';
        contactInput.value = contactInput.value.replace(/\D/g, '').slice(0, 10);
        contactInput.inputMode = 'numeric';
        phoneBtn.classList.remove('inactive');
        emailBtn.classList.add('inactive');
    } else {
        contactInput.placeholder = 'Email address';
        contactInput.inputMode = 'email';
        phoneBtn.classList.add('inactive');
        emailBtn.classList.remove('inactive');
    }
}

function getNormalizedContactValue() {
    const rawValue = document.getElementById('contactValue').value.trim();
    return contactMode === 'phone' ? rawValue.replace(/\D/g, '') : rawValue.toLowerCase();
}

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

function validateSignupInput() {
    const fullName = document.getElementById('fullName').value.trim();
    const contactValue = getNormalizedContactValue();

    if (!validateName(fullName)) {
        showError('Please enter a valid full name.');
        return null;
    }

    if (contactMode === 'phone' && !validatePhone(contactValue)) {
        showError('Please enter a valid 10-digit phone number.');
        return null;
    }

    if (contactMode === 'email' && !validateEmail(contactValue)) {
        showError('Please enter a valid email address.');
        return null;
    }

    clearError();

    return {
        fullName,
        contactType: contactMode,
        contactValue
    };
}

async function requestOtp() {
    const payload = validateSignupInput();
    if (!payload) return;

    const requestButton = document.getElementById('requestOtpBtn');
    const otpSection = document.getElementById('otpSection');
    const otpMessage = document.getElementById('otpMessage');
    const devOtpHint = document.getElementById('devOtpHint');

    try {
        showLoading();
        requestButton.disabled = true;

        const response = await fetch(apiUrl('auth/request-signup-otp'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        hideLoading();
        requestButton.disabled = false;

        if (!response.ok) {
            const errorMessage = data.details ? `${data.error} (${data.details})` : (data.error || 'Unable to send OTP right now.');
            showError(errorMessage);
            showToast(errorMessage, 'error');
            return;
        }

        pendingSignup = payload;
        otpVerified = false;
        verifiedOtp = '';
        otpSection.hidden = false;
        otpMessage.hidden = false;
        otpMessage.textContent = `Enter the OTP within ${data.expiresInMinutes || 10} minutes to complete your account setup.`;
        document.getElementById('credentialsSection').hidden = true;

        if (data.devOtp) {
            devOtpHint.hidden = false;
            devOtpHint.textContent = `Development OTP: ${data.devOtp}`;
        } else {
            devOtpHint.hidden = true;
            devOtpHint.textContent = '';
        }

        document.getElementById('otpInput').focus();
        showToast('OTP sent successfully.', 'success');
    } catch (error) {
        console.error('OTP request error:', error);
        hideLoading();
        requestButton.disabled = false;
        showError(`Unable to connect to the backend. Check backend URL: ${API_ORIGIN}`);
        showToast('Backend connection failed.', 'error');
    }
}

async function verifyOtp() {
    const payload = validateSignupInput();
    if (!payload) return;

    const otp = document.getElementById('otpInput').value.trim();
    if (!/^\d{6}$/.test(otp)) {
        showError('Please enter the 6-digit OTP.');
        return;
    }

    try {
        showLoading();

        const response = await fetch(apiUrl('auth/verify-signup-otp'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...(pendingSignup || payload),
                otp
            })
        });

        const data = await response.json().catch(() => ({}));
        hideLoading();

        if (!response.ok) {
            const errorMessage = data.details ? `${data.error} (${data.details})` : (data.error || 'OTP verification failed.');
            showError(errorMessage);
            showToast(errorMessage, 'error');
            return;
        }

        otpVerified = true;
        verifiedOtp = otp;

        const credentialsSection = document.getElementById('credentialsSection');
        credentialsSection.hidden = false;
        document.getElementById('signupUsername').focus();

        showToast('OTP verified. Now set your username and password.', 'success');
    } catch (error) {
        console.error('OTP verification error:', error);
        hideLoading();
        showError(`Unable to connect to the backend. Check backend URL: ${API_ORIGIN}`);
        showToast('Backend connection failed.', 'error');
    }
}

async function completeSignup() {
    const payload = pendingSignup || validateSignupInput();
    if (!payload) return;

    if (!otpVerified || !verifiedOtp) {
        showError('Please verify OTP before creating account.');
        return;
    }

    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        showError('Username must be 3-30 characters and only letters, numbers, underscore.');
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

        const response = await fetch(apiUrl('auth/complete-signup'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...payload,
                otp: verifiedOtp,
                username,
                password,
                confirmPassword
            })
        });

        const data = await response.json().catch(() => ({}));
        hideLoading();

        if (!response.ok) {
            const errorMessage = data.details ? `${data.error} (${data.details})` : (data.error || 'Unable to create account.');
            showError(errorMessage);
            showToast(errorMessage, 'error');
            return;
        }

        const account = { ...(data.account || {}), role: 'visitor' };
        saveUserSession(
            'visitor',
            null,
            account.phone || null,
            account.name || payload.fullName,
            account.email || null,
            account.contact || account.phone || account.email || username
        );
        saveVisitorAccount(account);

        showToast('Account created successfully.', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);
    } catch (error) {
        console.error('Complete signup error:', error);
        hideLoading();
        showError(`Unable to connect to the backend. Check backend URL: ${API_ORIGIN}`);
        showToast('Backend connection failed.', 'error');
    }
}

function continueWithSavedAccount() {
    const savedAccount = getSavedVisitorAccount();
    if (!savedAccount) return;

    const visitorAccount = { ...savedAccount, role: 'visitor' };

    saveUserSession(
        'visitor',
        null,
        visitorAccount.phone || null,
        visitorAccount.name || 'Visitor',
        visitorAccount.email || null,
        visitorAccount.contact || visitorAccount.phone || visitorAccount.email || ''
    );

    saveVisitorAccount(visitorAccount);

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
        savedText.textContent = `${savedAccount.name || 'Visitor'} can continue with ${savedAccount.contact || savedAccount.phone || savedAccount.email}.`;
        savedCard.hidden = false;
    }

    document.getElementById('contactValue').addEventListener('input', (event) => {
        if (contactMode === 'phone') {
            event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10);
        }
    });

    document.getElementById('otpInput').addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            verifyOtp();
        }
    });

    document.getElementById('signupConfirmPassword')?.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            completeSignup();
        }
    });
});
