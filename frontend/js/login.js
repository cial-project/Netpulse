async function loginUser(event) {
  event.preventDefault();


  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    alert("Please enter both username and password.");
    return;
  }

  try {
    const response = await fetch("http://127.0.0.1:8000/api/auth/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username, password: password })
    });

    console.log("Response status:", response.status);
    
    const data = await response.json();
    console.log("Response data:", data);

    if (response.ok && data.access) {
      // ✅ Save JWT tokens (Django format) with consistent key names
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);

      // Since Django doesn't return user data in login response,
      // we need to fetch it separately
      try {
        const userResponse = await fetch("http://127.0.0.1:8000/api/auth/user/me/", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${data.access}`
          }
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          localStorage.setItem("user", JSON.stringify(userData));
        }
      } catch (userError) {
        console.error("Failed to fetch user data:", userError);
      }

      // Redirect to dashboard
      window.location.href = "dashboard.html";
    } else {
      alert(data.detail || data.error || "Login failed. Please check your credentials.");
    }
  } catch (error) {
    console.error("Login error:", error);
    alert("Could not connect to server. Try again later.");
  }
}

// Add event listener
document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.querySelector('.login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', loginUser);
  }
  
  // Add enter key support
  const passwordField = document.getElementById("password");
  if (passwordField) {
    passwordField.addEventListener('keypress', function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        loginUser(event);
      }
    });
  }
});