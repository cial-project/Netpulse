class NetPulseCharts {
    constructor() {
        this.charts = {};
        this.metricHistory = {}; // deviceId -> [{ timestamp, network_in, network_out, cpu_usage, memory_usage }]
        this.deviceNames = {}; // deviceId -> name
        this.maxHistoryPoints = 50;
        this.colorPalette = [
            '#3182ce', '#38a169', '#d69e2e', '#e53e3e', '#805ad5',
            '#0bc5ea', '#f56565', '#ed8936', '#4fd1c5', '#9ae6b4'
        ];
        this.paletteMap = {};
        this.lastUpdate = null;
        this.fallbackTimer = null;
        this.laptopDeviceId = null;
    }

    initCharts() {
        console.log('Charts initialization - checking for canvas elements');
        
        // Only initialize charts if canvas elements exist
        if (document.getElementById('bandwidthChart')) {
            this.initBandwidthChart();
        }
        if (document.getElementById('cpuTrendChart')) {
            this.initCpuTrendChart();
        }
        if (document.getElementById('laptopChart')) {
            this.initLaptopChart();
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
                labels: [],
                datasets: []
            },
            options: this.getChartOptions('Network Bandwidth (Mbps)')
        });
    }

    initCpuTrendChart() {
        const ctx = document.getElementById('cpuTrendChart');
        if (!ctx) {
            console.log('CPU chart canvas not found');
            return;
        }

        this.charts.cpuTrend = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: this.getChartOptions('Device CPU Usage')
        });
    }

    initLaptopChart() {
        const ctx = document.getElementById('laptopChart');
        if (!ctx) {
            console.log('Laptop chart canvas not found');
            return;
        }

        this.charts.laptop = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Laptop CPU %',
                        data: [],
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.15)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2
                    },
                    {
                        label: 'Laptop Memory %',
                        data: [],
                        borderColor: '#dd6b20',
                        backgroundColor: 'rgba(221, 107, 32, 0.12)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2
                    }
                ]
            },
            options: this.getChartOptions('Operations Laptop Health')
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

    ingestMetrics(metrics) {
        if (!Array.isArray(metrics) || metrics.length === 0) {
            return;
        }

        metrics.forEach(metric => {
            if (!metric || metric.timestamp === undefined || metric.device === undefined) {
                return;
            }

            const deviceId = metric.device;
            const deviceName = metric.device_name || `Device ${deviceId}`;
            const timestamp = new Date(metric.timestamp).toISOString();

            this.deviceNames[deviceId] = deviceName;
            if (!this.laptopDeviceId && typeof deviceName === 'string' && deviceName.toLowerCase().includes('laptop')) {
                this.laptopDeviceId = deviceId;
            }

            if (!this.metricHistory[deviceId]) {
                this.metricHistory[deviceId] = [];
            }

            const history = this.metricHistory[deviceId];
            const normalizedEntry = {
                timestamp,
                network_in: Number(metric.network_in ?? metric.bandwidth_in ?? 0),
                network_out: Number(metric.network_out ?? metric.bandwidth_out ?? 0),
                cpu_usage: Number(metric.cpu_usage ?? metric.avg_cpu ?? 0),
                memory_usage: Number(metric.memory_usage ?? metric.avg_memory ?? 0)
            };

            const existingIndex = history.findIndex(item => item.timestamp === timestamp);
            if (existingIndex >= 0) {
                history[existingIndex] = normalizedEntry;
            } else {
                history.push(normalizedEntry);
            }

            history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            if (history.length > this.maxHistoryPoints) {
                history.splice(0, history.length - this.maxHistoryPoints);
            }
        });

        this.lastUpdate = Date.now();

        if (this.charts.bandwidth) {
            this.updateBandwidthChart();
        }
        if (this.charts.cpuTrend) {
            this.updateCpuTrendChart();
        }
        if (this.charts.laptop) {
            this.updateLaptopChart();
        }
    }

    startFallbackUpdates() {
        if (this.fallbackTimer) return;

        this.fallbackTimer = setInterval(() => {
            const stale = !this.lastUpdate || (Date.now() - this.lastUpdate > 60000);
            if (stale) {
                this.updateWithDemoData();
            }
        }, 30000);
    }

    updateWithDemoData() {
        const now = Date.now();
        const devices = [
            { id: 'demo-router', name: 'Core Router' },
            { id: 'demo-switch', name: 'Edge Switch' },
            { id: 'demo-firewall', name: 'Perimeter Firewall' },
            { id: 'demo-laptop', name: 'Operations Laptop' }
        ];

        const demoMetrics = [];
        devices.forEach(device => {
            for (let i = 12; i >= 0; i--) {
                demoMetrics.push({
                    device: device.id,
                    device_name: device.name,
                    timestamp: new Date(now - i * 300000).toISOString(),
                    network_in: Math.random() * 500 + 100,
                    network_out: Math.random() * 250 + 50,
                    cpu_usage: Math.random() * 40 + 20,
                    memory_usage: Math.random() * 30 + 50
                });
            }
        });

        this.ingestMetrics(demoMetrics);
    }

    updateBandwidthChart() {
        if (!this.charts.bandwidth) return;
        const chart = this.charts.bandwidth;
        const timeline = this.getUnifiedTimeline();

        chart.data.labels = timeline.map(ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        chart.data.datasets = [];

        Object.entries(this.metricHistory).forEach(([deviceId, history]) => {
            const color = this.getColorForDevice(deviceId);
            const dataMap = new Map(history.map(m => [m.timestamp, m]));
            const labelBase = this.deviceNames[deviceId] || `Device ${deviceId}`;

            chart.data.datasets.push({
                label: `${labelBase} (Download)`,
                data: timeline.map(ts => (dataMap.get(ts)?.network_in ?? null)),
                borderColor: color,
                backgroundColor: this.withAlpha(color, 0.12),
                fill: true,
                tension: 0.35,
                borderWidth: 2
            });

            chart.data.datasets.push({
                label: `${labelBase} (Upload)`,
                data: timeline.map(ts => (dataMap.get(ts)?.network_out ?? null)),
                borderColor: color,
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.35,
                borderWidth: 2,
                borderDash: [6, 4]
            });
        });

        chart.update();
    }

    updateLaptopChart() {
        const chart = this.charts.laptop;
        if (!chart) return;

        const laptopId = this.resolveLaptopDeviceId();
        if (!laptopId) {
            chart.data.labels = [];
            chart.data.datasets.forEach(dataset => { dataset.data = []; });
            chart.update();
            return;
        }

        const history = this.metricHistory[laptopId];
        if (!history || history.length === 0) {
            chart.data.labels = [];
            chart.data.datasets.forEach(dataset => { dataset.data = []; });
            chart.update();
            return;
        }

        const sorted = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        chart.data.labels = sorted.map(item => new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        if (chart.data.datasets[0]) {
            chart.data.datasets[0].data = sorted.map(item => item.cpu_usage ?? null);
        }
        if (chart.data.datasets[1]) {
            chart.data.datasets[1].data = sorted.map(item => item.memory_usage ?? null);
        }
        chart.update();
    }

    resolveLaptopDeviceId() {
        if (this.laptopDeviceId && this.metricHistory[this.laptopDeviceId]) {
            return this.laptopDeviceId;
        }

        const entry = Object.entries(this.deviceNames).find(([, name]) => 
            typeof name === 'string' && name.toLowerCase().includes('laptop')
        );

        if (entry) {
            const [deviceId] = entry;
            this.laptopDeviceId = deviceId;
            return deviceId;
        }

        return null;
    }

    updateCpuTrendChart() {
        if (!this.charts.cpuTrend) return;
        const chart = this.charts.cpuTrend;
        const timeline = this.getUnifiedTimeline();

        chart.data.labels = timeline.map(ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        chart.data.datasets = [];

        Object.entries(this.metricHistory).forEach(([deviceId, history]) => {
            const color = this.getColorForDevice(deviceId);
            const dataMap = new Map(history.map(m => [m.timestamp, m]));
            const labelBase = this.deviceNames[deviceId] || `Device ${deviceId}`;

            chart.data.datasets.push({
                label: `${labelBase} CPU`,
                data: timeline.map(ts => (dataMap.get(ts)?.cpu_usage ?? null)),
                borderColor: color,
                backgroundColor: this.withAlpha(color, 0.15),
                fill: true,
                tension: 0.35,
                borderWidth: 2
            });
        });
        
        chart.update();
    }

    getUnifiedTimeline() {
        const allTimestamps = Object.values(this.metricHistory)
            .flatMap(history => history.map(m => m.timestamp));
        const unique = Array.from(new Set(allTimestamps));
        unique.sort((a, b) => new Date(a) - new Date(b));
        return unique.slice(-this.maxHistoryPoints);
    }

    getColorForDevice(deviceId) {
        if (!this.paletteMap[deviceId]) {
            const index = Object.keys(this.paletteMap).length % this.colorPalette.length;
            this.paletteMap[deviceId] = this.colorPalette[index];
        }
        return this.paletteMap[deviceId];
    }

    withAlpha(hexColor, alpha) {
        const trimmed = hexColor.replace('#', '');
        if (trimmed.length !== 6) return hexColor;
        const r = parseInt(trimmed.slice(0, 2), 16);
        const g = parseInt(trimmed.slice(2, 4), 16);
        const b = parseInt(trimmed.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}

// Initialize charts
const netPulseCharts = new NetPulseCharts();
window.netPulseCharts = netPulseCharts;