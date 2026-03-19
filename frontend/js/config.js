// Backend API Configuration
// Set this to your production backend URL when deploying
window.NETPULSE_API_BASE = "https://netpulse-gkcp.onrender.com";

window.applyNetpulseSettings = function() {
    try {
        const savedSettings = localStorage.getItem('netpulse-settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);

            // Theme Application
            if (settings['theme']) {
                if (settings['theme'] === 'dark') {
                    document.documentElement.classList.add('dark-theme');
                } else if (settings['theme'] === 'light') {
                    document.documentElement.classList.remove('dark-theme');
                } else {
                    // auto
                    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                        document.documentElement.classList.add('dark-theme');
                    } else {
                        document.documentElement.classList.remove('dark-theme');
                    }
                }
            }

            // Dashboard Layout Application
            if (settings['dashboard-layout']) {
                document.documentElement.setAttribute('data-layout', settings['dashboard-layout']);
            }
            
            // Auto Refresh Application
            // Clear existing interval if any
            if (window._netpulseRefreshInterval) {
                clearInterval(window._netpulseRefreshInterval);
                window._netpulseRefreshInterval = null;
            }
            // Only apply refresh on dashboard pages, not settings/login
            if (settings['refresh-rate'] && settings['refresh-rate'] !== "0") {
                const isDashboard = window.location.pathname.includes('dashboard.html') || 
                                    window.location.pathname.includes('environmental.html') ||
                                    window.location.pathname.includes('network-devices.html') ||
                                    window.location.pathname.endsWith('/');
                if (isDashboard) {
                    const secs = parseInt(settings['refresh-rate']);
                    if (!isNaN(secs) && secs > 0) {
                        window._netpulseRefreshInterval = setInterval(() => {
                            window.location.reload();
                        }, secs * 1000);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Error applying Netpulse settings:", e);
    }
};

// Apply settings immediately on script load
window.applyNetpulseSettings();
