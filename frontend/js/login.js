document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = {
        username: document.getElementById('login-username').value,
        password: document.getElementById('login-password').value,
    };

    fetch('/api/login/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // 'X-CSRFToken': getCookie('csrftoken'), // Uncomment if CSRF protection is needed
        },
        body: JSON.stringify(formData)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // Redirect to dashboard or landing page
            window.location.href = 'dashboard.html';
        } else {
            // Show error message
            document.getElementById('login-error').textContent = data.error || 'Login failed.';
        }
    })
    .catch(() => {
        document.getElementById('login-error').textContent = 'Network error. Please try again.';
    });
});