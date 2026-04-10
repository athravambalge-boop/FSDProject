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

let otpVerified = false;

async function sendOtpToRegisteredContact() {
    const username = document.getElementById('fpUsername').value.trim();
    const sendButton = document.getElementById('sendOtpBtn');
    const statusMessage = document.getElementById('fpStatusMessage');
    const devOtpHint = document.getElementById('fpDevOtpHint');
    const otpSection = document.getElementById('otpSection');
    const resetPasswordSection = document.getElementById('resetPasswordSection');

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        showError('Please enter a valid username.');
        statusMessage.hidden = true;
        return;
    }

    clearError();

    try {
        showLoading();
        sendButton.disabled = true;

        const response = await fetch(apiUrl('auth/request-password-reset-by-username'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });

        const data = await response.json().catch(() => ({}));
        hideLoading();
        sendButton.disabled = false;

        if (!response.ok) {
            const errorMessage = data.details ? `${data.error} (${data.details})` : (data.error || 'Unable to send OTP.');
            showError(errorMessage);
            statusMessage.hidden = true;
            devOtpHint.hidden = true;
            devOtpHint.textContent = '';
            showToast(errorMessage, 'error');
            return;
        }

        const deliveryText = data.deliveryMethod === 'phone'
            ? 'OTP sent to registered phone number.'
            : 'OTP sent to registered email.';

        otpVerified = false;
        otpSection.hidden = false;
        resetPasswordSection.hidden = true;
        document.getElementById('fpOtpInput').value = '';
        document.getElementById('fpNewPassword').value = '';
        document.getElementById('fpConfirmPassword').value = '';

        statusMessage.hidden = false;
        statusMessage.textContent = deliveryText;

        if (data.devOtp) {
            devOtpHint.hidden = false;
            devOtpHint.textContent = `Development OTP: ${data.devOtp}`;
        } else {
            devOtpHint.hidden = true;
            devOtpHint.textContent = '';
        }

        showToast(deliveryText, 'success');
    } catch (error) {
        console.error('Forgot password OTP error:', error);
        hideLoading();
        sendButton.disabled = false;
        showError(`Unable to connect to the backend. Check backend URL: ${API_ORIGIN}`);
        statusMessage.hidden = true;
        devOtpHint.hidden = true;
        devOtpHint.textContent = '';
        showToast('Backend connection failed.', 'error');
    }
}

async function verifyOtpForUsername() {
    const username = document.getElementById('fpUsername').value.trim();
    const otp = document.getElementById('fpOtpInput').value.trim();
    const resetPasswordSection = document.getElementById('resetPasswordSection');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        showError('Please enter a valid username.');
        return;
    }

    if (!/^\d{6}$/.test(otp)) {
        showError('Please enter a valid 6-digit OTP.');
        return;
    }

    clearError();

    try {
        showLoading();
        verifyOtpBtn.disabled = true;

        const response = await fetch(apiUrl('auth/verify-password-reset-by-username'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, otp })
        });

        const data = await response.json().catch(() => ({}));
        hideLoading();
        verifyOtpBtn.disabled = false;

        if (!response.ok) {
            const errorMessage = data.details ? `${data.error} (${data.details})` : (data.error || 'OTP verification failed.');
            showError(errorMessage);
            showToast(errorMessage, 'error');
            resetPasswordSection.hidden = true;
            return;
        }

        otpVerified = true;
        resetPasswordSection.hidden = false;
        document.getElementById('fpNewPassword').focus();
        showToast('OTP verified. Set your new password.', 'success');
    } catch (error) {
        console.error('Verify OTP error:', error);
        hideLoading();
        verifyOtpBtn.disabled = false;
        showError(`Unable to connect to the backend. Check backend URL: ${API_ORIGIN}`);
        showToast('Backend connection failed.', 'error');
    }
}

async function updatePasswordByUsername() {
    const username = document.getElementById('fpUsername').value.trim();
    const otp = document.getElementById('fpOtpInput').value.trim();
    const newPassword = document.getElementById('fpNewPassword').value;
    const confirmPassword = document.getElementById('fpConfirmPassword').value;
    const updatePasswordBtn = document.getElementById('updatePasswordBtn');

    if (!otpVerified) {
        showError('Please verify OTP first.');
        return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        showError('Please enter a valid username.');
        return;
    }

    if (!/^\d{6}$/.test(otp)) {
        showError('Please enter a valid 6-digit OTP.');
        return;
    }

    if (newPassword.length < 6) {
        showError('Password must be at least 6 characters.');
        return;
    }

    if (newPassword !== confirmPassword) {
        showError('Password and confirm password do not match.');
        return;
    }

    clearError();

    try {
        showLoading();
        updatePasswordBtn.disabled = true;

        const response = await fetch(apiUrl('auth/reset-password-by-username'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, otp, newPassword, confirmPassword })
        });

        const data = await response.json().catch(() => ({}));
        hideLoading();
        updatePasswordBtn.disabled = false;

        if (!response.ok) {
            const errorMessage = data.details ? `${data.error} (${data.details})` : (data.error || 'Failed to update password.');
            showError(errorMessage);
            showToast(errorMessage, 'error');
            return;
        }

        showToast('Password updated successfully.', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 700);
    } catch (error) {
        console.error('Update password error:', error);
        hideLoading();
        updatePasswordBtn.disabled = false;
        showError(`Unable to connect to the backend. Check backend URL: ${API_ORIGIN}`);
        showToast('Backend connection failed.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fpUsername')?.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            sendOtpToRegisteredContact();
        }
    });

    document.getElementById('fpOtpInput')?.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            verifyOtpForUsername();
        }
    });

    document.getElementById('fpConfirmPassword')?.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            updatePasswordByUsername();
        }
    });
});
