class RealTimeMonitor {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.metricThrottleMs = 15000;
        this.lastMetricFlush = 0;
        this.pendingMetricUpdates = [];
        this.metricFlushTimer = null;
        this.pollIntervalId = null;
        this.refreshCooldownMs = 15000;
        this.lastFullRefresh = 0;
        this.refreshTimer = null;
    }

    connect() {
        try {
            // Determine Backend URL similar to api.js
            const getBackendUrl = () => {
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
                return 'http://127.0.0.1:8000';
            };

            const backendUrl = getBackendUrl();
            const wsProtocol = backendUrl.startsWith('https') ? 'wss:' : 'ws:';
            // Remove protocol from backendUrl to get host
            const host = backendUrl.replace(/^https?:\/\//, '');
            const wsUrl = `${wsProtocol}//${host}/ws/dashboard/`;

            console.log('Connecting to WebSocket:', wsUrl);
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.onConnected();
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.handleReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.handleReconnect();
        }
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);

            setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached');
            this.fallbackToPolling();
        }
    }

    fallbackToPolling() {
        console.log('Falling back to HTTP polling');
        // Fallback to regular API polling every 30 seconds
        if (this.pollIntervalId) return;
        this.pollIntervalId = setInterval(() => this.pollDashboard(), 30000);
    }

    async pollDashboard() {
        try {
            const response = await apiFetch('/dashboard/real_time_data/');
            if (!response || !response.ok) {
                return;
            }

            const data = await response.json();
            if (Array.isArray(data.metrics)) {
                this.enqueueMetrics(data.metrics);
            }

            if (typeof window.updateStatsFromSummary === 'function') {
                try { window.updateStatsFromSummary(data); } catch (e) { console.error('updateStatsFromSummary error', e); }
            }

            if (typeof window.updateCpuKPI === 'function') {
                const cpuVal = data.laptop?.cpu ?? data.avg_cpu;
                const updated = window.updateCpuKPI(cpuVal, { allowZero: false });
                if (!updated && typeof window.ensureCpuPlaceholder === 'function') {
                    window.ensureCpuPlaceholder();
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'initial_data':
                this.updateDashboard(data);
                break;

            case 'device_update':
                this.showNotification('Device status updated', 'info');
                this.refreshData();
                // Update device grid item in-place if present
                if (data.device) {
                    this.updateDeviceInGrid(data.device);
                }
                // append to notification panel if open (prefer alert payload if present)
                if (window.showNotifications) {
                    // refresh the panel contents
                    window.showNotifications().catch(() => { });
                }
                // If an alert object was included, add it to the panel immediately
                if (data.alert) {
                    this.prependNotificationToPanel({
                        title: data.alert.title || `Device ${data.device?.name} status change`,
                        description: data.alert.description || '',
                        severity: data.alert.severity || 'info',
                        created_at: data.alert.created_at || new Date().toISOString()
                    });
                    this.incrementBadge();
                }
                break;

            case 'alert_triggered':
                this.handleNewAlert(data.alert);
                // also ensure the alert appears in the floating panel immediately
                this.prependNotificationToPanel({
                    title: data.alert.title,
                    description: data.alert.description || '',
                    severity: data.alert.severity || 'info',
                    created_at: data.alert.created_at || new Date().toISOString()
                });
                this.incrementBadge();
                break;

            case 'metric_update':
                this.updateCharts(data.metrics);
                break;
        }
    }

    updateDeviceInGrid(device) {
        try {
            const id = device.id;
            const el = document.querySelector(`.device-item[data-device-id="${id}"]`);
            if (el) {
                // Update classes and status text
                if (device.is_online) {
                    el.classList.remove('offline');
                    el.classList.add('online');
                    el.querySelector('.device-status').textContent = 'Online';
                } else {
                    el.classList.remove('online');
                    el.classList.add('offline');
                    el.querySelector('.device-status').textContent = 'Offline';
                }
                // Update IP if changed
                if (device.ip) {
                    const ipEl = el.querySelector('.device-ip');
                    if (ipEl) ipEl.textContent = device.ip;
                }
            } else {
                // If device not present in the compact grid, refresh device grid
                if (window.loadDeviceGrid) loadDeviceGrid();
            }
        } catch (e) {
            console.error('Failed to update device in grid', e);
        }
    }

    prependNotificationToPanel(item) {
        try {
            const panel = document.getElementById('notification-panel');
            const html = `
                <div style="padding:10px 12px; border-bottom:1px solid #f1f1f1">
                    <div style="font-weight:600">${item.title}</div>
                    <div style="font-size:0.85rem; color:#6b7280">${(item.severity || 'info').toUpperCase()} • ${new Date(item.created_at).toLocaleString()}</div>
                    <div style="margin-top:6px; font-size:0.9rem">${item.description || ''}</div>
                </div>
            `;
            if (panel && panel.style.display !== 'none') {
                panel.insertAdjacentHTML('afterbegin', html);
            }
        } catch (e) {
            console.error('Failed to prepend notification', e);
        }
    }

    incrementBadge() {
        try {
            const badge = document.querySelector('.notification-badge');
            if (!badge) return;
            const val = parseInt(badge.textContent || '0', 10) || 0;
            badge.textContent = val + 1;
            badge.style.display = 'inline-block';
        } catch (e) {
            console.error('Failed to increment badge', e);
        }
    }

    updateDashboard(data) {
        // Update KPI cards
        const statusEl = document.getElementById('kpi-devices-status');
        if (statusEl) {
            const online = data.devices_online ?? data.online_count ?? data.devices?.online ?? null;
            const total = data.total_devices ?? data.total ?? data.devices?.total ?? null;

            if (online !== null) {
                statusEl.textContent = total !== null
                    ? `${online}/${total} Online`
                    : `${online} Online`;
            }
        }

        // Update notification badge (alerts KPI removed from dashboard)
        const alertCount = data.alerts_critical ?? data.critical_alerts ?? 0;
        this.updateNotificationBadge(alertCount);
    }

    // Route incoming metric updates to page-specific handlers if present.
    updateCharts(metrics) {
        try {
            // Trends page (has window.trendsApp with an updateCharts method)
            if (window.trendsApp && typeof window.trendsApp.updateCharts === 'function') {
                try { window.trendsApp.updateCharts(metrics); } catch (e) { console.error('trendsApp.updateCharts error', e); }
            }

            // Environmental page (attach as window.envApp)
            if (window.envApp && typeof window.envApp.updateMetrics === 'function') {
                try { window.envApp.updateMetrics(metrics); } catch (e) { console.error('envApp.updateMetrics error', e); }
            }

            // Network devices page bandwidth chart helper
            if (typeof window.updateBandwidthChart === 'function') {
                try { window.updateBandwidthChart(metrics); } catch (e) { console.error('updateBandwidthChart error', e); }
            }

            if (window.netPulseCharts && typeof window.netPulseCharts.ingestMetrics === 'function') {
                this.enqueueMetrics(metrics);
            }

        } catch (e) {
            console.error('Failed to route metric update to page handlers', e);
        }
    }

    enqueueMetrics(metrics) {
        if (!Array.isArray(metrics) || metrics.length === 0) {
            return;
        }

        this.pendingMetricUpdates.push(...metrics);

        const now = Date.now();
        if (now - this.lastMetricFlush >= this.metricThrottleMs) {
            this.flushMetricQueue();
            return;
        }

        if (this.metricFlushTimer) {
            return;
        }

        const delay = Math.max(this.metricThrottleMs - (now - this.lastMetricFlush), 250);
        this.metricFlushTimer = setTimeout(() => {
            this.metricFlushTimer = null;
            this.flushMetricQueue();
        }, delay);
    }

    flushMetricQueue() {
        if (!this.pendingMetricUpdates.length) {
            return;
        }

        const payload = this.pendingMetricUpdates;
        this.pendingMetricUpdates = [];
        this.lastMetricFlush = Date.now();

        try {
            const deduped = this.deduplicateMetrics(payload);
            if (deduped.length) {
                window.netPulseCharts.ingestMetrics(deduped);
            }
        } catch (e) {
            console.error('netPulseCharts.ingestMetrics error', e);
        }
    }

    deduplicateMetrics(metrics) {
        if (!Array.isArray(metrics)) {
            return [];
        }

        const map = new Map();
        metrics.forEach(metric => {
            if (!metric) return;
            const deviceId = metric.device ?? metric.device_id;
            const timestamp = metric.timestamp;
            if (deviceId === undefined || deviceId === null || !timestamp) {
                return;
            }
            const key = `${deviceId}-${timestamp}`;
            map.set(key, metric);
        });
        return Array.from(map.values());
    }

    handleNewAlert(alert) {
        // Show desktop notification
        if (Notification.permission === 'granted') {
            new Notification('NetPulse Alert', {
                body: `${alert.severity.toUpperCase()}: ${alert.title}`,
                icon: '/favicon.ico'
            });
        }

        // Show in-app notification
        this.showNotification(`${alert.severity}: ${alert.title}`, alert.severity);

        // Refresh alerts
        this.refreshAlerts();
    }

    showNotification(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `notification-toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close">&times;</button>
        `;

        document.body.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => toast.remove(), 5000);

        // Close button
        toast.querySelector('.toast-close').onclick = () => toast.remove();
    }

    getNotificationIcon(type) {
        const icons = {
            'critical': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle',
            'success': 'check-circle'
        };
        return icons[type] || 'info-circle';
    }

    updateNotificationBadge(count) {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
    }

    onConnected() {
        console.log('Real-time monitoring active');
    }

    refreshData() {
        const now = Date.now();
        const elapsed = now - this.lastFullRefresh;

        const runRefresh = () => {
            this.refreshTimer = null;
            this.lastFullRefresh = Date.now();
            if (window.loadKPIs) loadKPIs();
            if (window.loadAIInsights) loadAIInsights();
            if (window.loadStatsOverview) loadStatsOverview();
        };

        if (elapsed >= this.refreshCooldownMs) {
            runRefresh();
            return;
        }

        if (this.refreshTimer) return;

        const delay = Math.max(this.refreshCooldownMs - elapsed, 200);
        this.refreshTimer = setTimeout(runRefresh, delay);
    }

    refreshAlerts() {
        // Refresh alerts data
        if (window.updateNotificationBadge) updateNotificationBadge();
    }
}

// Initialize real-time monitoring
const realTimeMonitor = new RealTimeMonitor();
// Expose for debugging
window.realTimeMonitor = realTimeMonitor;

// Auto-connect on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        realTimeMonitor.connect();
    } catch (e) {
        console.error('Failed to start realTimeMonitor', e);
    }
});