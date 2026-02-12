async function signupUser() {

    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    // Basic validation
    if (password !== confirmPassword) {
        document.getElementById("signup-error").textContent = "Passwords do not match";
        return;
    }

    if (password.length < 8) {
        document.getElementById("signup-error").textContent = "Password must be at least 8 characters";
        return;
    }

    // Determine API Base URL dynamically
    const API_BASE = (() => {
        const override = window.NETPULSE_API_BASE;
        if (override && typeof override === 'string') {
            return override.replace(/\/$/, '');
        }
        return 'http://127.0.0.1:8000';
    })();

    try {
        const response = await fetch(`${API_BASE}/api/auth/auth/signup/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (response.ok && data.access) {
            // Store tokens and redirect to login
            localStorage.setItem('access_token', data.access);
            localStorage.setItem('refresh_token', data.refresh);
            localStorage.setItem('user', JSON.stringify(data.user));

            alert("Signup successful! Please login.");
            window.location.href = "login.html";
        } else {
            const errorMsg = data.username ? data.username[0] :
                data.email ? data.email[0] :
                    data.password ? data.password[0] :
                        "Signup failed";
            document.getElementById("signup-error").textContent = errorMsg;
        }
    } catch (error) {
        console.error('Signup error:', error);
        document.getElementById("signup-error").textContent = "Network error. Please try again.";
    }
}

// Add event listener for form submission
document.addEventListener('DOMContentLoaded', function () {
    const signupForm = document.querySelector('.signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', function (event) {
            event.preventDefault();
            signupUser();
        });
    }
});