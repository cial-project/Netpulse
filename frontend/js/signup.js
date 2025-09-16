document.getElementById('signup-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = {
        username: document.getElementById('signup-username').value,
        email: document.getElementById('signup-email').value,
        password: document.getElementById('signup-password').value,
        // Add more fields as needed
    };

    fetch('/api/signup/', {
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
            // Redirect or show success message
            window.location.href = 'login.html';
        } else {
            // Show error message
            document.getElementById('signup-error').textContent = data.error || 'Signup failed.';
        }
    })
    .catch(() => {
        document.getElementById('signup-error').textContent = 'Network error. Please try again.';
    });
});