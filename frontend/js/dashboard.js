// Utility: Format date as "Month Day, Year"
function formatDate(date) {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Authentication helper functions
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

async function refreshToken() {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) return false;

    try {
    const response = await fetch('http://127.0.0.1:8000/api/auth/token/refresh/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('access_token', data.access);
            return true;
        } else {
            throw new Error('Token refresh failed');
        }
    } catch (error) {
        console.error('Token refresh error:', error);
        return false;
    }
}

async function fetchWithAuth(url, options = {}) {
    const headers = getAuthHeaders();
    // Patch: only add /api/auth/ if not already present
    if (url.startsWith('http://127.0.0.1:8000/api/') && !url.startsWith('http://127.0.0.1:8000/api/auth/')) {
        url = url.replace('http://127.0.0.1:8000/api/', 'http://127.0.0.1:8000/api/auth/');
    }
    let response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers }
    });

    // If token expired, try to refresh and retry
    if (response.status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) {
            const newHeaders = getAuthHeaders();
            response = await fetch(url, {
                ...options,
                headers: { ...newHeaders, ...options.headers }
            });
        } else {
            // Redirect to login if refresh fails
            window.location.href = 'login.html';
            return null;
        }
    }

    return response;
}

// Show loading state
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<div class="loading">Loading...</div>';
    }
}

// Show error state
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="error">${message}</div>`;
    }
}

// 1. User Info
async function loadUserInfo() {
    showLoading('sidebar-username');
    showLoading('sidebar-userrole');
    showLoading('header-username');

    try {
    const response = await fetchWithAuth('http://127.0.0.1:8000/api/auth/user/me/');
        if (!response) return;

        if (response.ok) {
            const data = await response.json();
            document.getElementById('sidebar-username').textContent = data.username;
            document.getElementById('sidebar-userrole').textContent = data.role || 'User';
            document.getElementById('header-username').textContent = data.username;
        } else {
            showError('sidebar-username', 'Failed to load user info');
        }
    } catch (error) {
        console.error('User info error:', error);
        showError('sidebar-username', 'Error loading user information');
    }
}

// 2. Current Date
function updateCurrentDate() {
    document.getElementById('current-date').textContent = formatDate(new Date());
    // Update date every minute
    setInterval(() => {
        document.getElementById('current-date').textContent = formatDate(new Date());
    }, 60000);
}

// 3. KPIs
async function loadKPIs() {
    const kpiIds = [
        'kpi-devices-status', 'kpi-active-alerts', 'kpi-avg-temperature',
        'kpi-ups-status', 'kpi-bandwidth', 'kpi-throughput',
        'kpi-latency', 'kpi-jitter'
    ];

    kpiIds.forEach(id => showLoading(id));

    try {
    const response = await fetchWithAuth('http://127.0.0.1:8000/api/auth/dashboard/kpi/');
        if (!response) return;

        if (response.ok) {
            const data = await response.json();
            document.getElementById('kpi-devices-status').textContent = data.devices_status;
            document.getElementById('kpi-active-alerts').textContent = data.active_alerts;
            document.getElementById('kpi-avg-temperature').textContent = data.avg_temperature;
            document.getElementById('kpi-ups-status').textContent = data.ups_status;
            document.getElementById('kpi-bandwidth').textContent = data.bandwidth;
            document.getElementById('kpi-throughput').textContent = data.throughput;
            document.getElementById('kpi-latency').textContent = data.latency;
            document.getElementById('kpi-jitter').textContent = data.jitter;
        } else {
            kpiIds.forEach(id => showError(id, 'Failed to load data'));
        }
    } catch (error) {
        console.error('KPI loading error:', error);
        kpiIds.forEach(id => showError(id, 'Error loading data'));
    }
}

// 4. AI Insights
async function loadAIInsights() {
    showLoading('ai-insights');

    try {
    const response = await fetchWithAuth('http://127.0.0.1:8000/api/auth/dashboard/ai_insights/');
        if (!response) return;

        if (response.ok) {
            const data = await response.json();
            const insightsDiv = document.getElementById('ai-insights');
            insightsDiv.innerHTML = '';

            data.insights.forEach(insight => {
                const p = document.createElement('p');
                p.textContent = insight;
                p.className = 'insight-item';
                insightsDiv.appendChild(p);
            });
        } else {
            showError('ai-insights', 'Failed to load insights');
        }
    } catch (error) {
        console.error('AI insights error:', error);
        showError('ai-insights', 'Error loading insights');
    }
}

// 5. Map Zones
async function loadMapData() {
    showLoading('map-zones');
    showLoading('map-legend');

    try {
    const response = await fetchWithAuth('http://127.0.0.1:8000/api/auth/dashboard/map/');
        if (!response) return;

        if (response.ok) {
            const data = await response.json();
            const mapZones = document.getElementById('map-zones');
            mapZones.innerHTML = '';

            data.zones.forEach(zone => {
                const zoneDiv = document.createElement('div');
                zoneDiv.className = 'map-zone';
                zoneDiv.style.top = zone.top;
                zoneDiv.style.left = zone.left;
                zoneDiv.innerHTML = `
                    <div class="zone-point ${zone.status}"></div>
                    <span class="zone-label">${zone.label}</span>
                `;
                mapZones.appendChild(zoneDiv);
            });

            // Legend
            const legend = document.getElementById('map-legend');
            legend.innerHTML = '';
            data.legend.forEach(item => {
                const legendItem = document.createElement('div');
                legendItem.className = 'legend-item';
                legendItem.innerHTML = `
                    <div class="legend-color ${item.status}"></div>
                    <span>${item.label} (${item.count})</span>
                `;
                legend.appendChild(legendItem);
            });
        } else {
            showError('map-zones', 'Failed to load map data');
        }
    } catch (error) {
        console.error('Map data error:', error);
        showError('map-zones', 'Error loading map data');
    }
}

// 6. Stats Section
async function loadStats() {
    const statIds = [
        'stat-temperature', 'stat-humidity', 'stat-passenger-systems'
    ];

    statIds.forEach(id => showLoading(id));

    try {
    const response = await fetchWithAuth('http://127.0.0.1:8000/api/auth/dashboard/stats/');
        if (!response) return;

        if (response.ok) {
            const data = await response.json();

            // Temperature
            document.getElementById('stat-temperature').innerHTML = `${data.temperature.value} <span>°C</span>`;
            document.getElementById('stat-temperature-bar').style.width = data.temperature.progress;
            document.getElementById('stat-temperature-comp').innerHTML = data.temperature.comparison;

            // Humidity
            document.getElementById('stat-humidity').innerHTML = `${data.humidity.value} <span>%</span>`;
            document.getElementById('stat-humidity-bar').style.width = data.humidity.progress;
            document.getElementById('stat-humidity-comp').innerHTML = data.humidity.comparison;

            // Passenger Systems
            document.getElementById('stat-passenger-systems').innerHTML = `${data.passenger_systems.value}<span>%</span>`;
            document.getElementById('stat-passenger-bar').style.width = data.passenger_systems.progress;
            document.getElementById('stat-passenger-comp').innerHTML = data.passenger_systems.comparison;
        } else {
            statIds.forEach(id => showError(id, 'Failed to load stats'));
        }
    } catch (error) {
        console.error('Stats loading error:', error);
        statIds.forEach(id => showError(id, 'Error loading statistics'));
    }
}

// Notification badge update
async function updateNotificationBadge() {
    try {
    const response = await fetchWithAuth('http://127.0.0.1:8000/api/auth/alerts/');
        if (response && response.ok) {
            const data = await response.json();
            const badge = document.querySelector('.notification-badge');
            if (badge && data.length > 0) {
                badge.textContent = data.length;
                badge.style.display = 'inline-block';
            }
        }
    } catch (error) {
        console.error('Notification update error:', error);
    }
}

// Auto-refresh data
function startAutoRefresh() {
    // Refresh KPIs and stats every 30 seconds
    setInterval(() => {
        loadKPIs();
        loadStats();
        updateNotificationBadge();
    }, 30000);

    // Refresh AI insights every 2 minutes
    setInterval(() => {
        loadAIInsights();
    }, 120000);

    // Refresh map data every 5 minutes
    setInterval(() => {
        loadMapData();
    }, 300000);
}

// Check authentication on page load
function checkAuthentication() {
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');

    if (!token || !user) {
        window.location.href = 'login.html';
        return false;
    }

    try {
        const userData = JSON.parse(user);
        if (!userData.username) {
            window.location.href = 'login.html';
            return false;
        }
    } catch (error) {
        window.location.href = 'login.html';
        return false;
    }

    return true;
}

// Logout function
function setupLogout() {
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    }
}

// Main initialization function
async function initializeDashboard() {
    if (!checkAuthentication()) return;

    // Set up logout functionality
    setupLogout();

    // Update current date
    updateCurrentDate();

    // Load all data
    await Promise.all([
        loadUserInfo(),
        loadKPIs(),
        loadAIInsights(),
        loadMapData(),
        loadStats(),
        updateNotificationBadge()
    ]);

    // Start auto-refresh
    startAutoRefresh();

    // Add refresh button functionality
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('refreshing');
            await Promise.all([
                loadKPIs(),
                loadAIInsights(),
                loadStats(),
                updateNotificationBadge()
            ]);
            setTimeout(() => refreshBtn.classList.remove('refreshing'), 1000);
        });
    }
}

// Add some basic CSS for loading and error states
const style = document.createElement('style');
style.textContent = `
    .loading {
        color: #666;
        font-style: italic;
    }
    .error {
        color: #dc3545;
        font-size: 0.9em;
    }
    .refreshing {
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    .insight-item {
        margin: 0.5rem 0;
        padding: 0.5rem;
        background: #f8f9fa;
        border-left: 3px solid #007bff;
        border-radius: 3px;
    }
`;
document.head.appendChild(style);

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Handle page visibility change for better performance
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Refresh data when tab becomes visible
        loadKPIs();
        loadStats();
        updateNotificationBadge();
    }
});
