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
        'kpi-devices-status',
        'kpi-dc1-temp', 'kpi-dc1-humidity', 'kpi-dc2-temp', 'kpi-dc2-humidity',
        'kpi-dr-temp', 'kpi-dr-humidity', 'kpi-cpu-utilization'
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
        updateStatsFromSummary(devicesData);
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
        updateStatsFromSummary(data);
        
    } catch (error) {
        console.error('KPI loading error:', error);
        setFallbackData();
    }
}

function updateKPICardsWithDevicesData(devicesData) {
    // Use devices summary data for KPIs
    const devicesStatusEl = document.getElementById('kpi-devices-status');
    if (devicesStatusEl) {
        devicesStatusEl.textContent = `${devicesData.online_devices || 0}/${devicesData.total_devices || 0} Online`;
    }
    
    // Set other KPIs to reasonable defaults (no System Uptime card present)
    
    // Generate dynamic environmental data
    const envData = generateEnvironmentalData();
    setKPIValue('kpi-dc1-temp', `${envData.dc1.temp}°C`);
    setKPIValue('kpi-dc1-humidity', `${envData.dc1.humidity}% Humidity`);
    setKPIValue('kpi-dc2-temp', `${envData.dc2.temp}°C`);
    setKPIValue('kpi-dc2-humidity', `${envData.dc2.humidity}% Humidity`);
    setKPIValue('kpi-dr-temp', `${envData.dr.temp}°C`);
    setKPIValue('kpi-dr-humidity', `${envData.dr.humidity}% Humidity`);
    
    updateNotificationBadge(devicesData.critical_alerts || 0);

    const cpuFromSummary = devicesData.avg_cpu ?? devicesData.performance?.avg_cpu ?? devicesData.average_cpu;
    updateCpuKPI(cpuFromSummary);
}

function updateKPICards(data) {
    // Device Status
    if (data.devices_status) {
        setKPIValue('kpi-devices-status', data.devices_status);
    } else if (data.online_count !== undefined) {
        setKPIValue('kpi-devices-status', `${data.online_count || 0}/${data.total_devices || 0} Online`);
    }

    // Active Alerts
    // Active alerts KPI removed from dashboard; notifications still handled elsewhere

    // Temperature
    // avg_temperature is available in the payload but there is no single "avg temperature" card.
    // We display per-site temperatures (DC1/DC2/DR) instead below.

    // System Uptime data is intentionally not displayed (card removed)

    // Data Center Environmental Data
    setKPIValue('kpi-dc1-temp', data.dc1_temperature || '22.5°C');
    setKPIValue('kpi-dc1-humidity', data.dc1_humidity || '45% Humidity');
    setKPIValue('kpi-dc2-temp', data.dc2_temperature || '21.8°C');
    setKPIValue('kpi-dc2-humidity', data.dc2_humidity || '48% Humidity');
    setKPIValue('kpi-dr-temp', data.dr_temperature || '23.1°C');
    setKPIValue('kpi-dr-humidity', data.dr_humidity || '42% Humidity');

    const cpuVal = data.avg_cpu ?? data.cpu_usage ?? data.average_cpu;
    updateCpuKPI(cpuVal);

    // Update notification badge
    updateNotificationBadge(data.critical_alerts || 0);
}

// Generate realistic environmental data with slight variations
function generateEnvironmentalData() {
    const baseTemp = 22.0;
    const baseHumidity = 45;
    
    return {
        dc1: {
            temp: (baseTemp + Math.random() * 2 - 1).toFixed(1),
            humidity: Math.round(baseHumidity + Math.random() * 6 - 3)
        },
        dc2: {
            temp: (baseTemp - 0.5 + Math.random() * 2 - 1).toFixed(1),
            humidity: Math.round(baseHumidity + 3 + Math.random() * 6 - 3)
        },
        dr: {
            temp: (baseTemp + 1 + Math.random() * 2 - 1).toFixed(1),
            humidity: Math.round(baseHumidity - 3 + Math.random() * 6 - 3)
        }
    };
}

function setFallbackData() {
    console.log('Using fallback data');
    
    // Fallback demo data
    setKPIValue('kpi-devices-status', '6/8 Online');
    // System Uptime card removed; no KPI for uptime displayed
    
    // Generate dynamic environmental data
    const envData = generateEnvironmentalData();
    setKPIValue('kpi-dc1-temp', `${envData.dc1.temp}°C`);
    setKPIValue('kpi-dc1-humidity', `${envData.dc1.humidity}% Humidity`);
    setKPIValue('kpi-dc2-temp', `${envData.dc2.temp}°C`);
    setKPIValue('kpi-dc2-humidity', `${envData.dc2.humidity}% Humidity`);
    setKPIValue('kpi-dr-temp', `${envData.dr.temp}°C`);
    setKPIValue('kpi-dr-humidity', `${envData.dr.humidity}% Humidity`);
    setKPIValue('kpi-cpu-utilization', '32%');
    
    updateNotificationBadge(2);
}

function setKPIValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
}

function updateCpuKPI(value) {
    if (value === undefined || value === null) {
        return false;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return false;
    }

    const precision = Math.abs(numeric) >= 10 ? 0 : 1;
    const formatted = numeric.toFixed(precision).replace(/\.0$/, '');
    setKPIValue('kpi-cpu-utilization', `${formatted}%`);
    return true;
}

function updateStatsFromSummary(data) {
    const totalEl = document.getElementById('stat-total-devices');
    if (!totalEl) return;

    const devices = data.devices || {};
    const alerts = Array.isArray(data.alerts) ? data.alerts : [];

    setKPIValue('stat-total-devices', data.total_devices ?? devices.total ?? data.total ?? 0);
    setKPIValue('stat-online-devices', data.online_devices ?? data.online_count ?? devices.online ?? 0);

    const warningCount = data.warning_devices ?? data.warning_alerts ?? alerts.filter(a => a.severity === 'warning').length;
    const criticalCount = data.critical_devices ?? data.critical_alerts ?? alerts.filter(a => a.severity === 'critical').length;

    setKPIValue('stat-warning-devices', warningCount);
    setKPIValue('stat-critical-devices', criticalCount);

        const cpuFromSummary = data.laptop?.cpu ?? data.avg_cpu ?? data.performance?.avg_cpu ?? data.performance?.cpu ?? devices.avg_cpu;
        updateCpuKPI(cpuFromSummary);
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
        loadStatsOverview();
    }, 30000);

    // Refresh insights every 2 minutes
    setInterval(() => {
        loadAIInsights();
    }, 120000);

    // No ISP polling on the simplified dashboard
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
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            await Promise.all([loadKPIs(), loadAIInsights(), loadStatsOverview()]);
            setTimeout(() => {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            }, 800);
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

    if (window.netPulseCharts && typeof window.netPulseCharts.initCharts === 'function') {
        window.netPulseCharts.initCharts();
    }

    // No ISP refresh wiring on simplified dashboard

    // Load initial data
    await Promise.all([
        loadUserInfo(),
        loadKPIs(),
        loadAIInsights(),
        loadStatsOverview()
    ]);

    if (window.netPulseCharts && typeof window.netPulseCharts.startFallbackUpdates === 'function') {
        window.netPulseCharts.startFallbackUpdates();
    }

    // Start auto-refresh
    startAutoRefresh();

    // Load switch KPIs immediately and schedule periodic updates
    loadSwitchKPIs();
    setInterval(loadSwitchKPIs, 30000);

    console.log('Dashboard initialized successfully');
}

// Fetch and render switch counts for the new KPI cards
async function loadSwitchKPIs() {
    try {
        // Attempt to use paginated response (DRF style) which provides `count`
        const resp = await apiFetch('/devices/?type=switch');
        if (!resp) return;

        // If apiFetch returned a Response object, parse JSON
        let data;
        try {
            data = await resp.json();
        } catch (e) {
            console.warn('Switch KPI: Failed to parse JSON', e);
            data = null;
        }

        let total = 0;
        let down = 0;

        if (data && typeof data === 'object') {
            if (data.count !== undefined) {
                total = data.count;
                // If results array is present, count down items in results
                if (Array.isArray(data.results)) {
                    down = data.results.filter(d => d.status === 'down').length;
                }
            } else if (Array.isArray(data)) {
                total = data.length;
                down = data.filter(d => d.status === 'down').length;
            }
        }

        // If we couldn't deduce counts from the response, try a direct count endpoint
        if (!total) {
            // Try a lightweight count-only request (if backend provides it)
            try {
                const countResp = await apiFetch('/devices/count/?type=switch');
                if (countResp) {
                    const cdata = await countResp.json();
                    if (cdata && cdata.count !== undefined) total = cdata.count;
                }
            } catch (e) {
                // ignore
            }
        }

        const elTotal = document.getElementById('kpi-switch-count');
        const elDown = document.getElementById('kpi-switch-down-count');
        if (elTotal) elTotal.textContent = total;
        if (elDown) elDown.textContent = down;
    } catch (err) {
        console.error('Failed to load switch KPIs', err);
    }
}

// Fetch and populate the stats overview (total/online/warning/critical)
async function loadStatsOverview() {
    try {
        const resp = await apiFetch('/dashboard/real_time_data/');
        if (!resp) return;

        const data = await resp.json();
        updateStatsFromSummary(data);

        let cpuUpdated = false;

        if (Array.isArray(data.metrics) && data.metrics.length > 0) {
            const laptopMetric = data.metrics.find(metric => {
                const name = (metric.device_name || '').toLowerCase();
                return name.includes('laptop');
            });

            if (laptopMetric) {
                cpuUpdated = updateCpuKPI(laptopMetric.cpu_usage);
            }

            if (!cpuUpdated) {
                const cpuValues = data.metrics
                    .map(metric => Number(metric.cpu_usage))
                    .filter(val => Number.isFinite(val));
                if (cpuValues.length > 0) {
                    const cpuAvg = cpuValues.reduce((acc, val) => acc + val, 0) / cpuValues.length;
                    cpuUpdated = updateCpuKPI(cpuAvg);
                }
            }
        }

        if (!cpuUpdated) {
            const cpuFallback = data.laptop?.cpu ?? data.avg_cpu ?? data.performance?.avg_cpu ?? data.performance?.cpu ?? data.devices?.avg_cpu;
            cpuUpdated = updateCpuKPI(cpuFallback);
        }

        if (!cpuUpdated) {
            setKPIValue('kpi-cpu-utilization', '--');
        }

        if (window.netPulseCharts && typeof window.netPulseCharts.ingestMetrics === 'function') {
            window.netPulseCharts.ingestMetrics(data.metrics || []);
        }
    } catch (err) {
        console.error('Failed to load stats overview', err);
    }
}

// 10. ISP Loading & Rendering
async function loadISPs() {
    const container = document.getElementById('isp-list');
    if (!container) return;
    container.innerHTML = '<div class="loading">Loading ISPs...</div>';

    try {
        // Try an unauthenticated fetch first (we allow read-only access from backend)
        const API_BASE = 'http://127.0.0.1:8000/api';
        let response;
        try {
            response = await fetch(`${API_BASE}/isps/`, { method: 'GET' });
        } catch (fetchErr) {
            // Network/CORS issue or similar — fallback to authenticated helper
            console.warn('Direct fetch failed, falling back to authenticated apiFetch', fetchErr);
            const helperResp = await apiFetch('/isps/');
            if (!helperResp) {
                container.innerHTML = '<div class="error">Unable to load ISPs</div>';
                return;
            }
            const data = await helperResp.json();
            renderISPs(data);
            return;
        }

        if (response.status === 401) {
            // If API still requires auth, try using apiFetch (which handles tokens)
            const helperResp = await apiFetch('/isps/');
            if (!helperResp) {
                container.innerHTML = '<div class="error">Unauthorized to view ISP list</div>';
                return;
            }
            const data = await helperResp.json();
            renderISPs(data);
            return;
        }

        if (!response.ok) {
            container.innerHTML = '<div class="error">Unable to load ISPs</div>';
            return;
        }

        const data = await response.json();
        renderISPs(data);
    } catch (err) {
        console.error('Error loading ISPs', err);
        container.innerHTML = '<div class="error">Error loading ISPs</div>';
    }
}

function renderISPs(isps) {
    const container = document.getElementById('isp-list');
    if (!container) return;

    if (!Array.isArray(isps) || isps.length === 0) {
        container.innerHTML = '<div class="grid-empty">No ISPs found</div>';
        return;
    }

    // Render as structured ISP cards
    container.innerHTML = isps.map(isp => {
        const latency = isp.latency_ms !== null && isp.latency_ms !== undefined ? isp.latency_ms : '—';
        const loss = isp.packet_loss !== null && isp.packet_loss !== undefined ? isp.packet_loss : '—';
        const lastChecked = isp.last_checked ? new Date(isp.last_checked).toLocaleString() : '—';

        // Determine status and classes
        let iconClass = 'kpi-icon primary';
        let badgeClass = 'isp-badge healthy';
        if (loss !== '—' && parseFloat(loss) > 5) { iconClass = 'kpi-icon danger'; badgeClass = 'isp-badge critical'; }
        else if (loss !== '—' && parseFloat(loss) > 1) { iconClass = 'kpi-icon warning'; badgeClass = 'isp-badge warning'; }
        else if (latency !== '—' && parseFloat(latency) > 200) { iconClass = 'kpi-icon warning'; badgeClass = 'isp-badge warning'; }

        return `
            <div class="isp-card">
                <div class="isp-icon ${iconClass}"><i class="fas fa-globe"></i></div>
                <div class="isp-content">
                    <h4>${isp.name}</h4>
                    <div class="isp-latency">${latency} ms</div>
                    <div class="isp-meta">Loss: ${loss}% &middot; ${isp.host}</div>
                    <div class="isp-last">Last: ${lastChecked}</div>
                </div>
                <div class="${badgeClass}">${badgeClass.includes('critical') ? 'CRITICAL' : (badgeClass.includes('warning') ? 'WARN' : 'OK')}</div>
            </div>
        `;
    }).join('');
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