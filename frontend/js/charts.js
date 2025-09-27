class NetPulseCharts {
    constructor() {
        this.charts = {};
        this.metricHistory = [];
        this.maxHistoryPoints = 50;
    }

    initCharts() {
        console.log('Charts initialization - checking for canvas elements');
        
        // Only initialize charts if canvas elements exist
        if (document.getElementById('bandwidthChart')) {
            this.initBandwidthChart();
        }
        if (document.getElementById('cpuChart')) {
            this.initCPUChart();
        }
        if (document.getElementById('alertChart')) {
            this.initAlertTrendsChart();
        }
        
        console.log('Charts initialized for available canvases');
    }

    initBandwidthChart() {
        const ctx = document.getElementById('bandwidthChart');
        if (!ctx) {
            console.log('Bandwidth chart canvas not found');
            return;
        }
        
        this.charts.bandwidth = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: this.generateTimeLabels(),
                datasets: [
                    {
                        label: 'Download (Mbps)',
                        data: [],
                        borderColor: '#3182ce',
                        backgroundColor: 'rgba(49, 130, 206, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Upload (Mbps)',
                        data: [],
                        borderColor: '#38a169',
                        backgroundColor: 'rgba(56, 161, 105, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: this.getChartOptions('Network Bandwidth (Mbps)')
        });
    }

    initCPUChart() {
        const ctx = document.getElementById('cpuChart');
        if (!ctx) {
            console.log('CPU chart canvas not found');
            return;
        }
        
        this.charts.cpu = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'CPU Usage %',
                    data: [],
                    backgroundColor: '#e53e3e',
                    borderColor: '#c53030',
                    borderWidth: 1
                }]
            },
            options: this.getChartOptions('Device CPU Usage')
        });
    }

    initAlertTrendsChart() {
        const ctx = document.getElementById('alertChart');
        if (!ctx) {
            console.log('Alert chart canvas not found');
            return;
        }
        
        this.charts.alerts = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: this.generateTimeLabels(24),
                datasets: [
                    {
                        label: 'Critical Alerts',
                        data: [],
                        borderColor: '#e53e3e',
                        backgroundColor: 'rgba(229, 62, 62, 0.1)',
                        fill: true
                    },
                    {
                        label: 'Warning Alerts',
                        data: [],
                        borderColor: '#d69e2e',
                        backgroundColor: 'rgba(214, 158, 46, 0.1)',
                        fill: true
                    }
                ]
            },
            options: this.getChartOptions('Alert Trends')
        });
    }

    getChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title },
                legend: { position: 'bottom' }
            },
            scales: {
                x: { 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#a0aec0' }
                },
                y: { 
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#a0aec0' }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        };
    }

    generateTimeLabels(hours = 12) {
        const labels = [];
        for (let i = hours; i >= 0; i--) {
            const date = new Date();
            date.setHours(date.getHours() - i);
            labels.push(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
        return labels;
    }

    // Real-time data fetching
    async startLiveUpdates() {
        console.log('Starting live chart updates');
        // Update every 30 seconds instead of 10 to reduce load
        setInterval(() => this.fetchAndFillCharts(), 30000);
    }

    async fetchAndFillCharts() {
        try {
            // Only fetch if charts exist
            if (Object.keys(this.charts).length === 0) {
                return;
            }
            
            // Simple demo data for charts
            this.updateWithDemoData();
            
        } catch (error) {
            console.error('Error fetching chart data:', error);
        }
    }

    updateWithDemoData() {
        // Generate demo data for charts
        const demoMetrics = Array.from({length: 12}, (_, i) => ({
            network_in: Math.random() * 500 + 100,
            network_out: Math.random() * 250 + 50,
            timestamp: new Date(Date.now() - i * 300000)
        }));

        const demoDevices = [
            { name: 'Core-Router-01', cpu_usage: Math.random() * 30 + 10 },
            { name: 'Switch-T1-A', cpu_usage: Math.random() * 20 + 5 },
            { name: 'Firewall-Main', cpu_usage: Math.random() * 25 + 8 }
        ];

        const demoAlerts = Array.from({length: 24}, (_, i) => ({
            severity: Math.random() > 0.8 ? 'critical' : 'warning',
            created_at: new Date(Date.now() - i * 3600000)
        }));

        if (this.charts.bandwidth) {
            this.updateBandwidthChart(demoMetrics);
        }
        if (this.charts.cpu) {
            this.updateCPUChart(demoDevices);
        }
        if (this.charts.alerts) {
            this.updateAlertChart(demoAlerts);
        }
    }

    updateBandwidthChart(metrics) {
        if (!this.charts.bandwidth) return;
        const chart = this.charts.bandwidth;
        chart.data.labels = metrics.map((_, i) => {
            const date = new Date();
            date.setMinutes(date.getMinutes() - (metrics.length - i - 1) * 5);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        });
        chart.data.datasets[0].data = metrics.map(m => m.network_in);
        chart.data.datasets[1].data = metrics.map(m => m.network_out);
        chart.update();
    }

    updateCPUChart(devices) {
        if (!this.charts.cpu) return;
        const chart = this.charts.cpu;
        chart.data.labels = devices.map(d => d.name);
        chart.data.datasets[0].data = devices.map(d => d.cpu_usage);
        chart.update();
    }

    updateAlertChart(alerts) {
        if (!this.charts.alerts) return;
        const chart = this.charts.alerts;
        chart.data.labels = alerts.map((_, i) => {
            const date = new Date();
            date.setHours(date.getHours() - (alerts.length - i - 1));
            return date.toLocaleTimeString([], { hour: '2-digit' });
        });
        chart.data.datasets[0].data = alerts.map(a => a.severity === 'critical' ? 1 : 0);
        chart.data.datasets[1].data = alerts.map(a => a.severity === 'warning' ? 1 : 0);
        chart.update();
    }
}

// Initialize charts
const netPulseCharts = new NetPulseCharts();