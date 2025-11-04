class RealTimeMonitor {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
    }

    connect() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/dashboard/`;
            
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
        // Fallback to regular API polling every 10 seconds
        setInterval(() => this.pollDashboard(), 10000);
    }

    async pollDashboard() {
        try {
            const response = await apiFetch('/dashboard/kpi/');
            if (response && response.ok) {
                const data = await response.json();
                this.updateDashboard(data);
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
                    window.showNotifications().catch(()=>{});
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
                    <div style="font-size:0.85rem; color:#6b7280">${(item.severity||'info').toUpperCase()} • ${new Date(item.created_at).toLocaleString()}</div>
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
        if (data.devices_online !== undefined) {
            const totalDevices = 6; // Should come from API
            document.getElementById('kpi-devices-status').textContent = 
                `${data.devices_online}/${totalDevices} Online`;
        }
        
        // Update notification badge (alerts KPI removed from dashboard)
        this.updateNotificationBadge(data.alerts_critical || 0);
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
                try { window.netPulseCharts.ingestMetrics(metrics); } catch (e) { console.error('netPulseCharts.ingestMetrics error', e); }
            }

        } catch (e) {
            console.error('Failed to route metric update to page handlers', e);
        }
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
        // Refresh all dashboard data
        if (window.loadKPIs) loadKPIs();
        if (window.loadAIInsights) loadAIInsights();
        if (window.loadStatsOverview) loadStatsOverview();
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