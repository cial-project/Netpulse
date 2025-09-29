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
                break;
                
            case 'alert_triggered':
                this.handleNewAlert(data.alert);
                break;
                
            case 'metric_update':
                this.updateCharts(data.metrics);
                break;
        }
    }

    updateDashboard(data) {
        // Update KPI cards
        if (data.devices_online !== undefined) {
            const totalDevices = 6; // Should come from API
            document.getElementById('kpi-devices-status').textContent = 
                `${data.devices_online}/${totalDevices} Online`;
        }
        
        if (data.alerts_critical !== undefined) {
            document.getElementById('kpi-active-alerts').textContent = 
                `${data.alerts_critical} Critical Alerts`;
        }
        
        // Update notification badge
        this.updateNotificationBadge(data.alerts_critical || 0);
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
        if (window.loadStats) loadStats();
    }

    refreshAlerts() {
        // Refresh alerts data
        if (window.updateNotificationBadge) updateNotificationBadge();
    }
}

// Initialize real-time monitoring
const realTimeMonitor = new RealTimeMonitor();