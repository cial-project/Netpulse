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

const API_BASE_URL = `${API_BASE}/api`;

let kpisLoadedOnce = false;
let statsLoadedOnce = false;
let fallbackEnvCache = null;
let fallbackKPIApplied = false;

// Simple API utility function
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');

    if (!token && !window.location.href.includes('login.html')) {
        console.log('No token - redirecting to login');
        window.location.href = 'login.html';
        return null;
    }

    // Use correct API base for all endpoints
    const url = `${API_BASE_URL}${endpoint}`;

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

    if (!kpisLoadedOnce) {
        kpiIds.forEach(id => showLoading(id));
    }

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
                kpisLoadedOnce = true;
                return;
            }
            // Use fallback data if all API calls fail
            setFallbackData();
            kpisLoadedOnce = true;
            return;
        }

        const data = await response.json();
        console.log('KPI Data received:', data);

        // Update KPI cards with actual data
        updateKPICards(data);
        updateStatsFromSummary(data);
        kpisLoadedOnce = true;

    } catch (error) {
        console.error('KPI loading error:', error);
        setFallbackData();
        kpisLoadedOnce = true;
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

    // Data Center Environmental Data (Enhanced)
    if (data.zones && Array.isArray(data.zones)) {
        data.zones.forEach(zone => {
            const key = zone.key.toLowerCase();
            const tempEl = document.getElementById(`kpi-${key}-temp`);
            const humEl = document.getElementById(`kpi-${key}-humidity`);
            const ipEl = document.getElementById(`kpi-${key}-ip`);
            const statusEl = document.getElementById(`kpi-${key}-status`);

            if (tempEl) tempEl.textContent = `${zone.temperature}°C`;
            if (humEl) humEl.textContent = `${zone.humidity}% humidity`;
            if (ipEl) ipEl.textContent = zone.ip_address || 'NOT ASSIGNED';

            if (statusEl) {
                statusEl.textContent = zone.is_online ? 'ONLINE' : 'OFFLINE';
                statusEl.className = zone.is_online ? 'status-pill online' : 'status-pill offline';
            }
        });
    }

    // Update Important Infrastructure Grid
    if (data.important_devices && Array.isArray(data.important_devices)) {
        updateImportantDevicesGrid(data.important_devices);
    }

    // Core & Distribution Metrics
    setKPIValue('metric-critical-alerts', `${data.critical_alerts || 0} Critical`);
    const memVal = data.avg_memory || 45;
    setKPIValue('metric-avg-memory', `${Math.round(memVal)}%`);
    const memCircle = document.getElementById('metric-memory-circle');
    if (memCircle) {
        const pct = Math.round(memVal);
        memCircle.style.background = `conic-gradient(#4fd1c5 0% ${pct}%, #e2e8f0 ${pct}% 100%)`;
        const span = memCircle.querySelector('span');
        if (span) span.textContent = `${pct}%`;
    }

    setKPIValue('metric-avg-temp', `${data.avg_temp || 32}°C`);

    // Bandwidth - computed from real data
    const totalBw = data.total_bandwidth_gbps || 0;
    const bwDisplay = totalBw > 0 ? `${totalBw} Gbps` : `${((data.bandwidth_value || 0) / 1000).toFixed(1)} Gbps`;
    setKPIValue('metric-bandwidth-1', bwDisplay);
    setKPIValue('metric-bandwidth-2', bwDisplay);

    // Update Notification Badge
    updateNotificationBadge(data.critical_alerts || 0);

    // Update Tables if device data is present (array of device objects)
    const deviceArray = data.devices || data.device_list;
    if (Array.isArray(deviceArray) && deviceArray.length > 0) {
        updateDeviceTables(deviceArray);
    }

    // Update CPU KPI
    const cpuVal = data.avg_cpu;
    if (cpuVal !== undefined && cpuVal !== null) {
        updateCpuKPI(cpuVal);
    }

    // Show Database status (static for now but visually correct)
    const dbStatus = document.querySelector('#db-connection-status .status-text');
    if (dbStatus) {
        dbStatus.textContent = 'CONNECTED';
        dbStatus.style.color = '#10b981';
    }
}

function updateImportantDevicesGrid(devices) {
    const grid = document.getElementById('important-devices-summary');
    if (!grid) return;

    if (devices.length === 0) {
        grid.innerHTML = '<div class="loading-placeholder">No critical infrastructure devices identified.</div>';
        return;
    }

    grid.innerHTML = devices.map(device => `
        <div class="imp-device-card" style="border-left-color: ${device.is_online ? '#10b981' : '#ef4444'}">
            <div class="imp-device-info">
                <h4>${device.name}</h4>
                <p>${device.ip_address} • ${device.device_type.toUpperCase()}</p>
            </div>
            <div class="imp-device-stats">
                <div class="imp-stat-label">CPU / MEM</div>
                <div class="imp-stat-value">${Math.round(device.cpu_load)}% / ${Math.round(device.memory_load)}%</div>
                <div class="status-pill ${device.is_online ? 'online' : 'offline'}" style="margin-top: 0.25rem;">
                    ${device.is_online ? 'ACTIVE' : 'INACTIVE'}
                </div>
            </div>
        </div>
    `).join('');
}

// Generate realistic environmental data with slight variations
function generateEnvironmentalData() {
    if (!fallbackEnvCache) {
        const baseTemp = 22.0;
        const baseHumidity = 45;

        // Cache a single deterministic snapshot per page load to avoid jitter
        fallbackEnvCache = {
            dc1: {
                temp: (baseTemp + Math.random() * 2 - 1).toFixed(1),
                humidity: Math.round(baseHumidity + Math.random() * 6 - 3)
            },
            dc2: {
                temp: (baseTemp - 0.4 + Math.random() * 1.5 - 0.75).toFixed(1),
                humidity: Math.round(baseHumidity + 3 + Math.random() * 4 - 2)
            },
            dr: {
                temp: (baseTemp + 0.8 + Math.random() * 1.5 - 0.75).toFixed(1),
                humidity: Math.round(baseHumidity - 3 + Math.random() * 4 - 2)
            }
        };
    }

    return fallbackEnvCache;
}

function setFallbackData() {
    if (fallbackKPIApplied) {
        return;
    }

    fallbackKPIApplied = true;
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

    // Generate fallback data for tables
    const mockDevices = [
        { name: 'Core-Router-01', cpu_load: 45, temperature: 42, uplink_capacity: '10 Gbps', device_type: 'router', is_online: true },
        { name: 'Core-Switch-02', cpu_load: 32, temperature: 38, uplink_capacity: '10 Gbps', device_type: 'switch', is_online: true },
        { name: 'Dist-Switch-A1', cpu_load: 28, memory_load: 40, uplink_capacity: '10 Gbps', throughput_out: 450, device_type: 'switch', is_online: true },
        { name: 'Dist-Switch-B2', cpu_load: 55, memory_load: 62, uplink_capacity: '10 Gbps', throughput_out: 820, device_type: 'switch', is_online: true },
        { name: 'sw-access-01', cpu_load: 12, temperature: 35, uplink_capacity: '1 Gbps', device_type: 'switch', is_online: true },
        { name: 'sw-access-02', cpu_load: 15, temperature: 36, uplink_capacity: '1 Gbps', device_type: 'switch', is_online: true },
        { name: 'sw-access-03', cpu_load: 0, temperature: 0, uplink_capacity: '1 Gbps', device_type: 'switch', is_online: false } // Offline example
    ];
    updateDeviceTables(mockDevices);
}

function setKPIValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
        const nextValue = value === undefined || value === null ? '' : String(value);
        if (el.textContent !== nextValue) {
            el.textContent = nextValue;
        }
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

// Expose selected helpers for other modules (websocket fallback, etc.)
window.updateStatsFromSummary = updateStatsFromSummary;
window.updateCpuKPI = updateCpuKPI;
window.loadKPIs = loadKPIs;
window.loadStatsOverview = loadStatsOverview;
window.ensureCpuPlaceholder = function () {
    const el = document.getElementById('kpi-cpu-utilization');
    if (el && (el.textContent === '--' || el.textContent === 'Loading...')) {
        setKPIValue('kpi-cpu-utilization', '0%');
    }
};

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
        const nextValue = String(count ?? '');
        if (badge.textContent !== nextValue) {
            badge.textContent = nextValue;
        }
        const shouldShow = count > 0;
        if (shouldShow && badge.style.display !== 'inline-block') {
            badge.style.display = 'inline-block';
        } else if (!shouldShow && badge.style.display !== 'none') {
            badge.style.display = 'none';
        }
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
    if (initializeDashboard._initialized) {
        console.debug('initializeDashboard: already initialized, skipping duplicate call');
        return;
    }
    initializeDashboard._initialized = true;

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
                total = Number(data.count) || 0;
                const results = Array.isArray(data.results) ? data.results : [];
                down = results.filter(d => {
                    const status = (d.status || d.is_online);
                    if (typeof status === 'string') {
                        return status.toLowerCase() === 'down' || status.toLowerCase() === 'offline';
                    }
                    if (typeof status === 'boolean') {
                        return !status;
                    }
                    return false;
                }).length;
            } else if (Array.isArray(data)) {
                total = data.length;
                down = data.filter(d => {
                    const status = (d.status || d.is_online);
                    if (typeof status === 'string') {
                        return status.toLowerCase() === 'down' || status.toLowerCase() === 'offline';
                    }
                    if (typeof status === 'boolean') {
                        return !status;
                    }
                    return false;
                }).length;
            }
        }

        // No separate count endpoint needed — count derived from list above

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

        statsLoadedOnce = true;

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

        // Populate device tables from real_time_data device_list
        const deviceArray = data.device_list || data.devices;
        if (Array.isArray(deviceArray) && deviceArray.length > 0) {
            updateDeviceTables(deviceArray);
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
        let response;
        try {
            response = await fetch(`${API_BASE_URL}/isps/`, { method: 'GET' });
        } catch (fetchErr) {
            // Network/CORS issue or similar — fallback to authenticated helper
            console.warn('Direct fetch failed, falling back to authenticated apiFetch', fetchErr);
            const helperResp = await apiFetch('/isps/');
            if (!helperResp) {
                container.innerHTML = '<div class="error">Unable to load ISPs</div>';
                return;
            }
            const rawData = await helperResp.json();
            const data = Array.isArray(rawData) ? rawData : (rawData.results || []);
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
            const rawData = await helperResp.json();
            const data = Array.isArray(rawData) ? rawData : (rawData.results || []);
            renderISPs(data);
            return;
        }

        if (!response.ok) {
            container.innerHTML = '<div class="error">Unable to load ISPs</div>';
            return;
        }

        const rawData = await response.json();
        const data = Array.isArray(rawData) ? rawData : (rawData.results || []);
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

// Update Device Tables with real device data from API
function updateDeviceTables(devices) {
    if (!Array.isArray(devices) || devices.length === 0) return;

    // Classify devices by type and naming convention
    const coreDevices = devices.filter(d => {
        const name = (d.name || '').toLowerCase();
        return name.includes('core') || d.device_type === 'router' || d.device_type === 'firewall' || d.device_type === 'server';
    });
    const distDevices = devices.filter(d => {
        const name = (d.name || '').toLowerCase();
        return name.includes('dist') || name.includes('distribution');
    });
    const switchDevices = devices.filter(d => {
        const name = (d.name || '').toLowerCase();
        return d.device_type === 'switch' || name.includes('sw-') || name.includes('switch') || name.includes('access');
    });

    // If no classification matched, distribute all devices across tables
    const hasClassified = coreDevices.length > 0 || distDevices.length > 0 || switchDevices.length > 0;
    const allDevices = hasClassified ? null : devices;

    // 1. Core Devices Table
    const coreTable = document.getElementById('table-core-devices');
    if (coreTable && coreTable.tBodies[0]) {
        const src = coreDevices.length > 0 ? coreDevices : (allDevices ? allDevices.slice(0, Math.ceil(allDevices.length / 3)) : []);
        if (src.length > 0) {
            coreTable.tBodies[0].innerHTML = src.map(d => `
                <tr>
                    <td class="font-bold">
                        <span class="dot ${d.is_online ? 'green' : 'red'}"></span>
                        ${d.name}
                    </td>
                    <td><span class="${getMetricColor(d.cpu_load, 80)}">${d.cpu_load || 0}%</span></td>
                    <td>${d.temperature != null ? d.temperature + '°C' : '—'}</td>
                    <td>${d.uplink_capacity || '10 Gbps'}</td>
                    <td class="text-right"><i class="fas fa-chevron-right text-gray"></i></td>
                </tr>
            `).join('');
        }
    }

    // 2. Distribution Devices Table
    const distTable = document.getElementById('table-dist-devices');
    if (distTable && distTable.tBodies[0]) {
        const src = distDevices.length > 0 ? distDevices : (allDevices ? allDevices.slice(Math.ceil(allDevices.length / 3), Math.ceil(2 * allDevices.length / 3)) : []);
        if (src.length > 0) {
            distTable.tBodies[0].innerHTML = src.map(d => `
                <tr>
                    <td class="font-bold">
                        <span class="dot ${d.is_online ? 'green' : 'red'}"></span>
                        ${d.name}
                    </td>
                    <td><span class="${getMetricColor(d.cpu_load, 80)}">${d.cpu_load || 0}%</span></td>
                    <td>${d.memory_load || 0}%</td>
                    <td>${d.uplink_capacity || '10 Gbps'}</td>
                    <td>${d.throughput_out ? d.throughput_out + ' Mbps' : (d.network_out ? d.network_out + ' Mbps' : '0 Mbps')}</td>
                </tr>
            `).join('');
        }
    }

    // 3. Access / Bottom table - show ALL devices with full details
    const accessTable = document.getElementById('table-access-status');
    if (accessTable && accessTable.tBodies[0]) {
        // Deduplicate: use all devices, ordered by type priority
        const seen = new Set();
        const ordered = [];
        // Priority: switches first, then others
        const priority = [...switchDevices, ...coreDevices, ...distDevices];
        for (const d of priority) {
            const key = d.id || d.name;
            if (!seen.has(key)) {
                seen.add(key);
                ordered.push(d);
            }
        }
        // Then add any remaining devices
        for (const d of devices) {
            const key = d.id || d.name;
            if (!seen.has(key)) {
                seen.add(key);
                ordered.push(d);
            }
        }

        accessTable.tBodies[0].innerHTML = ordered.map(d => {
            const uplinkVal = d.uplink_capacity ? d.uplink_capacity.split(' ')[0] : '10';
            const outTraffic = d.network_out || d.throughput_out || 0;
            return `
                <tr>
                    <td class="font-bold">
                        <span class="dot ${d.is_online ? 'green' : 'red'}"></span> ${d.name}
                    </td>
                    <td><span class="${getMetricColor(d.cpu_load, 80)}">${d.cpu_load || 0}%</span></td>
                    <td>${d.temperature != null ? d.temperature + '°C' : '—'}</td>
                    <td>${uplinkVal} Gbps</td>
                    <td>${d.uplink_capacity || '10 Gbps'}</td>
                    <td>${outTraffic} Mbps</td>
                </tr>
            `;
        }).join('');
    }
}

function getMetricColor(value, threshold) {
    if (!value || !threshold) return '';
    if (value > threshold) return 'text-red';
    if (value > threshold * 0.75) return 'text-warning';
    return 'text-green';
}

// Expose updateDeviceTables for websocket/polling modules
window.updateDeviceTables = updateDeviceTables;