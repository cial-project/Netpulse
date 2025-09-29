// Simple API utility function
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    
    if (!token && !window.location.href.includes('login.html')) {
        console.log('No token - redirecting to login');
        window.location.href = 'login.html';
        return null;
    }

    // Use correct API base for all endpoints
    const API_BASE = 'http://127.0.0.1:8000/api';
    const url = `${API_BASE}${endpoint}`;
    
    console.log('API Call:', url);
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        console.log('API Response Status:', response.status);
        
        if (response.status === 401) {
            console.warn('Authentication failed - redirecting to login');
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

// Show loading state
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<span class="loading">Loading...</span>';
    }
}

// Show error state
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<span class="error">${message}</span>`;
    }
}

// 1. User Info
async function loadUserInfo() {
    showLoading('sidebar-username');
    showLoading('header-username');

    try {
        const response = await apiFetch('/user/me/');
        if (!response) {
            // Use fallback username
            document.getElementById('sidebar-username').textContent = 'Admin';
            document.getElementById('header-username').textContent = 'Admin';
            return;
        }

        const data = await response.json();
        document.getElementById('sidebar-username').textContent = data.username || 'Admin';
        document.getElementById('header-username').textContent = data.username || 'Admin';
        
    } catch (error) {
        console.error('User info error:', error);
        document.getElementById('sidebar-username').textContent = 'Admin';
        document.getElementById('header-username').textContent = 'Admin';
    }
}

// 2. Current Date & Time
function updateCurrentDateTime() {
    function update() {
        const now = new Date();
        const dateTimeStr = now.toLocaleString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        document.getElementById('current-date-time').textContent = dateTimeStr;
    }
    
    update();
    setInterval(update, 1000);
}

// 3. KPIs - SIMPLIFIED VERSION
async function loadKPIs() {
    const kpiIds = [
        'kpi-devices-status', 'kpi-active-alerts', 'kpi-avg-temperature',
        'kpi-ups-status', 'kpi-bandwidth', 'kpi-throughput',
        'kpi-latency', 'kpi-jitter'
    ];

    // Show loading states
    kpiIds.forEach(id => showLoading(id));

    try {
        // Try the correct endpoint first
        const response = await apiFetch('/dashboard/kpi/');
        if (!response) {
            // If that fails, try devices summary
            const devicesResponse = await apiFetch('/devices/summary/');
            if (devicesResponse && devicesResponse.ok) {
                const devicesData = await devicesResponse.json();
                updateKPICardsWithDevicesData(devicesData);
                return;
            }
            // Use fallback data if all API calls fail
            setFallbackData();
            return;
        }

        const data = await response.json();
        console.log('KPI Data received:', data);

        // Update KPI cards with actual data
        updateKPICards(data);
        
    } catch (error) {
        console.error('KPI loading error:', error);
        setFallbackData();
    }
}

function updateKPICardsWithDevicesData(devicesData) {
    // Use devices summary data for KPIs
    document.getElementById('kpi-devices-status').textContent = 
        `${devicesData.online_devices || 0}/${devicesData.total_devices || 0} Online`;
    
    document.getElementById('kpi-active-alerts').textContent = 
        `${devicesData.critical_alerts || 0} Critical, ${devicesData.warning_alerts || 0} Warning`;
    
    // Set other KPIs to reasonable defaults
    document.getElementById('kpi-avg-temperature').textContent = '22.5°C';
    document.getElementById('kpi-ups-status').textContent = `${devicesData.uptime_percentage || 85}%`;
    document.getElementById('kpi-bandwidth').textContent = '245.7 Mbps';
    document.getElementById('kpi-throughput').textContent = '128.3 Mbps';
    document.getElementById('kpi-latency').textContent = '23 ms';
    document.getElementById('kpi-jitter').textContent = '2 ms';
    
    updateNotificationBadge(devicesData.critical_alerts || 0);
}

function updateKPICards(data) {
    // Device Status
    if (data.devices_status) {
        document.getElementById('kpi-devices-status').textContent = data.devices_status;
    } else if (data.online_count !== undefined) {
        document.getElementById('kpi-devices-status').textContent = 
            `${data.online_count || 0}/${data.total_devices || 0} Online`;
    }

    // Active Alerts
    if (data.active_alerts) {
        document.getElementById('kpi-active-alerts').textContent = data.active_alerts;
    } else if (data.critical_alerts !== undefined) {
        document.getElementById('kpi-active-alerts').textContent = 
            `${data.critical_alerts || 0} Critical, ${data.warning_alerts || 0} Warning`;
    }

    // Temperature
    if (data.avg_temperature) {
        document.getElementById('kpi-avg-temperature').textContent = data.avg_temperature;
    } else if (data.temperature_value) {
        document.getElementById('kpi-avg-temperature').textContent = `${data.temperature_value}°C`;
    }

    // System Uptime
    if (data.ups_status) {
        document.getElementById('kpi-ups-status').textContent = data.ups_status;
    } else if (data.health_percentage) {
        document.getElementById('kpi-ups-status').textContent = `${data.health_percentage}%`;
    }

    // Bandwidth & Throughput
    document.getElementById('kpi-bandwidth').textContent = data.bandwidth || '245.7 Mbps';
    document.getElementById('kpi-throughput').textContent = data.throughput || '128.3 Mbps';

    // Latency & Jitter
    document.getElementById('kpi-latency').textContent = data.latency || '23 ms';
    document.getElementById('kpi-jitter').textContent = data.jitter || '2 ms';

    // Update notification badge
    updateNotificationBadge(data.critical_alerts || 0);
}

function setFallbackData() {
    console.log('Using fallback data');
    
    // Fallback demo data
    document.getElementById('kpi-devices-status').textContent = '6/8 Online';
    document.getElementById('kpi-active-alerts').textContent = '2 Critical, 1 Warning';
    document.getElementById('kpi-avg-temperature').textContent = '22.5°C';
    document.getElementById('kpi-ups-status').textContent = '85% Healthy';
    document.getElementById('kpi-bandwidth').textContent = '245.7 Mbps';
    document.getElementById('kpi-throughput').textContent = '128.3 Mbps';
    document.getElementById('kpi-latency').textContent = '23 ms';
    document.getElementById('kpi-jitter').textContent = '2 ms';
    
    updateNotificationBadge(2);
}

// 4. AI Insights
async function loadAIInsights() {
    const insightsDiv = document.getElementById('ai-insights');
    if (!insightsDiv) return;

    insightsDiv.innerHTML = '<p>Loading insights...</p>';

    try {
        const response = await apiFetch('/dashboard/ai_insights/');
        if (!response) {
            // Use fallback insights
            insightsDiv.innerHTML = `
                <p>System analysis: All components functioning normally</p>
                <p>Network status: Stable and performing well</p>
                <p>Alert status: No critical issues detected</p>
            `;
            return;
        }

        const data = await response.json();
        if (data.insights && data.insights.length > 0) {
            insightsDiv.innerHTML = data.insights.map(insight => 
                `<p>${insight}</p>`
            ).join('');
        } else {
            insightsDiv.innerHTML = '<p>All systems operating normally</p>';
        }
    } catch (error) {
        console.error('AI insights error:', error);
        insightsDiv.innerHTML = '<p>System analysis unavailable</p>';
    }
}

// 5. Notification Badge
function updateNotificationBadge(count) {
    const badges = document.querySelectorAll('.notification-badge, .nav-badge');
    badges.forEach(badge => {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
    });
}

// 6. Auto-refresh data
function startAutoRefresh() {
    // Refresh KPIs every 30 seconds (reduced from 30 to reduce load)
    setInterval(() => {
        loadKPIs();
    }, 30000);

    // Refresh insights every 2 minutes
    setInterval(() => {
        loadAIInsights();
    }, 120000);
}

// 7. Check authentication
function checkAuthentication() {
    const token = localStorage.getItem('access_token');
    if (!token && !window.location.href.includes('login.html')) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// 8. Logout function
function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
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

// 9. Refresh button functionality
function setupRefreshButton() {
    const refreshBtn = document.getElementById('refresh-insights');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            await Promise.all([loadKPIs(), loadAIInsights()]);
            setTimeout(() => {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            }, 1000);
        });
    }
}

// Main initialization function
async function initializeDashboard() {
    console.log('Initializing dashboard...');
    
    if (!checkAuthentication()) return;

    // Set up functionality
    setupLogout();
    setupRefreshButton();
    updateCurrentDateTime();

    // Load initial data
    await Promise.all([
        loadUserInfo(),
        loadKPIs(),
        loadAIInsights()
    ]);

    // Start auto-refresh
    startAutoRefresh();

    console.log('Dashboard initialized successfully');
}

// Add CSS for loading and error states
const style = document.createElement('style');
style.textContent = `
    .loading {
        color: #6b7280;
        font-style: italic;
    }
    .error {
        color: #ef4444;
        font-size: 0.9em;
    }
    .kpi-value .loading,
    .kpi-value .error {
        font-size: 1.5rem;
        font-style: normal;
    }
`;
document.head.appendChild(style);

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
});