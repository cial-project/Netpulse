// API utility function
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    
    // If no token and not on login page, redirect to login
    if (!token && !window.location.href.includes('login.html') && !window.location.href.includes('signup.html')) {
        window.location.href = 'login.html';
        return null;
    }

    // Determine API Base URL dynamically
    const API_BASE = (() => {
        const override = window.NETPULSE_API_BASE;
        if (override && typeof override === 'string') {
            return override.replace(/\/$/, '');
        }

        const { origin, protocol, hostname, port } = window.location || {};
        const staticDevPorts = new Set(['5500', '5501', '5502', '3000', '3001']);

        if (origin && origin !== 'null' && !origin.startsWith('file://')) {
            if (port && staticDevPorts.has(String(port))) {
                const backendPort = protocol === 'https:' ? '443' : '8000';
                return `${protocol}//${hostname}:${backendPort}`.replace(/\/$/, '');
            }
            return origin.replace(/\/$/, '');
        }
        if (protocol && hostname) {
            const defaultPort = protocol === 'https:' ? '443' : '80';
            const hasExplicitPort = port && port !== defaultPort;
            const backendPort = protocol === 'https:' ? '443' : '8000';
            const finalPort = hasExplicitPort ? port : backendPort;
            return `${protocol}//${hostname}:${finalPort}`.replace(/\/$/, '');
        }
        return 'http://127.0.0.1:8000';
    })();

    const url = `${API_BASE}/api${endpoint}`;
    
    console.log('API Call:', url);
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        console.log('API Response Status:', response.status);
        
        if (response.status === 401) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return null;
        }

        if (!response.ok) {
            console.error('API Error:', response.status, response.statusText);
            return null;
        }

        return response;
    } catch (error) {
        console.error('API Fetch Error:', error);
        return null;
    }
}