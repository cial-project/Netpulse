document.querySelector('.signup-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const fullName = document.getElementById('fullname').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
        document.getElementById('signup-error').textContent = 'Passwords do not match.';
        return;
    }

    const formData = {
        username: fullName,
        email: email,
        password: password,
    };

    fetch('/api/signup/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            window.location.href = 'login.html';
        } else {
            document.getElementById('signup-error').textContent = data.error || 'Signup failed.';
        }
    })
    .catch(() => {
        document.getElementById('signup-error').textContent = 'Network error. Please try again.';
    });
});