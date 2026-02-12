class NetPulseCharts {
    constructor() {
        this.charts = {};
        this.metricHistory = {}; // deviceId -> [{ timestamp, network_in, network_out, cpu_usage, memory_usage }]
        this.deviceNames = {}; // deviceId -> name
        this.maxHistoryPoints = 50;
        this.colorPalette = [
            '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
            '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1'
        ];
        this.paletteMap = {};
        this.lastUpdate = null;
        this.fallbackTimer = null;
        this.laptopDeviceId = null;
        this.renderThrottleMs = 15000;
        this.lastRender = {};
        this.pendingRender = {};
        this.hasRealMetrics = false;
    }

    initCharts() {
        console.log('Charts initialization - checking for canvas elements');

        // New Main Traffic Chart
        if (document.getElementById('trafficChartMain')) {
            this.initTrafficChart();
        }

        console.log('Charts initialized for available canvases');
    }

    initTrafficChart() {
        const ctx = document.getElementById('trafficChartMain');
        if (!ctx) return;

        this.charts.traffic = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Inbound',
                        data: [],
                        borderColor: '#10b981', // Emerald 500
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0
                    },
                    {
                        label: 'Outbound',
                        data: [],
                        borderColor: '#3b82f6', // Blue 500
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }, // Custom legend in HTML
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#a0aec0', maxTicksLimit: 8 }
                    },
                    y: {
                        grid: { borderDash: [2, 4], color: '#edf2f7' },
                        ticks: { color: '#a0aec0', callback: (val) => val + ' Mbps' }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    ingestMetrics(metrics) {
        if (!Array.isArray(metrics) || metrics.length === 0) return;

        // Simplify for demo: Aggregate total traffic or pick a primary device
        // We'll aggregate all traffic for the "Main Traffic" chart
        const now = new Date();
        const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let totalIn = 0;
        let totalOut = 0;
        let count = 0;

        metrics.forEach(m => {
            totalIn += Number(m.network_in ?? m.bandwidth_in ?? 0);
            totalOut += Number(m.network_out ?? m.bandwidth_out ?? 0);
            count++;
        });

        if (count === 0) return;

        // Update Traffic Chart
        if (this.charts.traffic) {
            const chart = this.charts.traffic;

            // Add new data point
            chart.data.labels.push(timestamp);
            chart.data.datasets[0].data.push(totalIn); // Inbound
            chart.data.datasets[1].data.push(totalOut); // Outbound

            // Keep max 20 points
            if (chart.data.labels.length > 20) {
                chart.data.labels.shift();
                chart.data.datasets[0].data.shift();
                chart.data.datasets[1].data.shift();
            }

            chart.update('none');

            // Also update the summary table below the chart
            this.updateChartSummary(metrics);
        }
    }

    updateChartSummary(metrics) {
        const table = document.getElementById('table-chart-summary');
        if (!table || !table.tBodies[0]) return;

        // Take top 3 active interfaces
        const active = metrics.slice(0, 3);

        table.tBodies[0].innerHTML = active.map(m => `
            <tr>
                <td>${m.device_name || 'Interface'}</td>
                <td style="color:#48bb78">${(m.network_in || 0).toFixed(1)} Mbps</td>
                <td style="color:#4299e1">${(m.network_out || 0).toFixed(1)} Mbps</td>
                <td>${((m.network_in || 0) + (m.network_out || 0)).toFixed(1)} Mbps</td>
                <td>${Math.min(100, Math.round((((m.network_in || 0) + (m.network_out || 0)) / 1000) * 100))}%</td>
            </tr>
        `).join('');
    }

    startFallbackUpdates() {
        // Minimal fallback if no websocket
        if (this.fallbackTimer) return;
        this.fallbackTimer = setInterval(() => {
            // Mock data if needed
            const mockMetrics = [
                { device_name: 'Gi1/0/1', network_in: Math.random() * 800, network_out: Math.random() * 800 },
                { device_name: 'Gi1/0/2', network_in: Math.random() * 600, network_out: Math.random() * 600 },
            ];
            this.ingestMetrics(mockMetrics);
        }, 3000);
    }
}

// Initialize charts
const netPulseCharts = new NetPulseCharts();
window.netPulseCharts = netPulseCharts;

