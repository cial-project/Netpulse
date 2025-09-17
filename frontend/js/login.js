document.querySelector('.login-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const formData = {
        email: email,
        password: password,
    };

    fetch('/api/login/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            window.location.href = 'dashboard.html';
        } else {
            document.getElementById('login-error').textContent = data.error || 'Login failed.';
        }
    })
    .catch(() => {
        document.getElementById('login-error').textContent = 'Network error. Please try again.';
    });
});