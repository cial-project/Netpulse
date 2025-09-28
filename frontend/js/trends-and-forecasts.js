// trends-and-forecasts.js
class TrendsAndForecasts {
    constructor() {
        this.charts = {};
        this.currentMetric = 'bandwidth';
        this.currentTimeRange = '7d';
        this.initializeCharts();
        this.setupEventListeners();
        this.loadData();
    }

    initializeCharts() {
        this.initializeMainChart();
        this.initializeComparisonChart();
        this.initializeAlertTrendsChart();
        this.initializeSeasonalChart();
        this.initializeAnomalyChart();
    }

    initializeMainChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.main) {
            this.charts.main.destroy();
        }

        this.charts.main = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Historical Data',
                        data: [],
                        borderColor: '#3182ce',
                        backgroundColor: 'rgba(49, 130, 206, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#3182ce',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    },
                    {
                        label: 'AI Forecast',
                        data: [],
                        borderColor: '#d69e2e',
                        backgroundColor: 'rgba(214, 158, 46, 0.1)',
                        borderWidth: 3,
                        borderDash: [5, 5],
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#d69e2e',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Bandwidth Usage Trends & Forecast',
                        font: { 
                            size: 16, 
                            weight: 'bold',
                            family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                        },
                        padding: 20,
                        color: '#212529'
                    },
                    legend: {
                        position: 'bottom',
                        labels: { 
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        cornerRadius: 6,
                        bodyFont: {
                            family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: { 
                                day: 'MMM d',
                                hour: 'MMM d HH:mm'
                            }
                        },
                        title: { 
                            display: true, 
                            text: 'Date',
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                                weight: 'bold'
                            },
                            color: '#495057'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            },
                            color: '#6c757d'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: { 
                            display: true, 
                            text: 'Bandwidth (Mbps)',
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                                weight: 'bold'
                            },
                            color: '#495057'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            },
                            color: '#6c757d',
                            callback: function(value) {
                                return value + ' Mbps';
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    initializeComparisonChart() {
        const ctx = document.getElementById('comparisonChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.comparison) {
            this.charts.comparison.destroy();
        }

        const deviceData = {
            labels: ['Core-Router-01', 'Switch-T1-A', 'Firewall-Main', 'AP-Terminal-B'],
            datasets: [{
                label: 'Average Bandwidth (Mbps)',
                data: [450, 320, 280, 190],
                backgroundColor: [
                    'rgba(49, 130, 206, 0.8)',
                    'rgba(56, 161, 105, 0.8)',
                    'rgba(214, 158, 46, 0.8)',
                    'rgba(229, 62, 62, 0.8)'
                ],
                borderColor: [
                    '#3182ce',
                    '#38a169',
                    '#d69e2e',
                    '#e53e3e'
                ],
                borderWidth: 2,
                borderRadius: 4,
                borderSkipped: false,
            }]
        };

        this.charts.comparison = new Chart(ctx, {
            type: 'bar',
            data: deviceData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 10,
                        cornerRadius: 4,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y} Mbps`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            },
                            color: '#495057'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            },
                            color: '#6c757d',
                            callback: function(value) {
                                return value + ' Mbps';
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    initializeAlertTrendsChart() {
        const ctx = document.getElementById('alertTrendsChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.alertTrends) {
            this.charts.alertTrends.destroy();
        }

        const alertData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
            datasets: [
                {
                    label: 'Critical Alerts',
                    data: [12, 15, 8, 22, 18, 14, 16],
                    borderColor: '#e53e3e',
                    backgroundColor: 'rgba(229, 62, 62, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#e53e3e',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                },
                {
                    label: 'Warning Alerts',
                    data: [25, 30, 22, 35, 28, 32, 29],
                    borderColor: '#d69e2e',
                    backgroundColor: 'rgba(214, 158, 46, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#d69e2e',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }
            ]
        };

        this.charts.alertTrends = new Chart(ctx, {
            type: 'line',
            data: alertData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 10,
                        cornerRadius: 4
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            },
                            color: '#6c757d'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            },
                            color: '#6c757d',
                            stepSize: 10
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    initializeSeasonalChart() {
        const ctx = document.getElementById('seasonalChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.seasonal) {
            this.charts.seasonal.destroy();
        }

        const seasonalData = {
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
            datasets: [{
                label: 'Daily Bandwidth Pattern (Mbps)',
                data: [120, 80, 350, 480, 420, 280],
                borderColor: '#3182ce',
                backgroundColor: 'rgba(49, 130, 206, 0.2)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#3182ce',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5
            }]
        };

        this.charts.seasonal = new Chart(ctx, {
            type: 'line',
            data: seasonalData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 10,
                        cornerRadius: 4,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y} Mbps`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            },
                            color: '#6c757d'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            },
                            color: '#6c757d',
                            callback: function(value) {
                                return value + ' Mbps';
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    initializeAnomalyChart() {
        const ctx = document.getElementById('anomalyChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.anomaly) {
            this.charts.anomaly.destroy();
        }

        const normalData = this.generateNormalData(80);
        const anomalyData = this.generateAnomalyData(8);

        this.charts.anomaly = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Normal Patterns',
                        data: normalData,
                        backgroundColor: 'rgba(49, 130, 206, 0.7)',
                        borderColor: '#3182ce',
                        borderWidth: 1,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    },
                    {
                        label: 'Anomalies Detected',
                        data: anomalyData,
                        backgroundColor: 'rgba(229, 62, 62, 0.8)',
                        borderColor: '#e53e3e',
                        borderWidth: 2,
                        pointRadius: 6,
                        pointHoverRadius: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 10,
                        cornerRadius: 4,
                        callbacks: {
                            label: function(context) {
                                const point = context.raw;
                                return `${context.dataset.label}: Bandwidth=${point.x.toFixed(1)}Mbps, Response=${point.y.toFixed(1)}ms`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Bandwidth Usage (Mbps)',
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                                weight: 'bold'
                            },
                            color: '#495057'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            },
                            color: '#6c757d'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Response Time (ms)',
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                                weight: 'bold'
                            },
                            color: '#495057'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                            },
                            color: '#6c757d'
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    setupEventListeners() {
        // Filter changes
        const metricType = document.getElementById('metric-type');
        const timeRange = document.getElementById('time-range');
        const clearFilters = document.getElementById('clear-filters');
        const refreshChart = document.getElementById('refresh-chart');
        const refreshInsights = document.getElementById('refresh-insights');

        if (metricType) {
            metricType.addEventListener('change', (e) => {
                this.currentMetric = e.target.value;
                this.loadData();
            });
        }

        if (timeRange) {
            timeRange.addEventListener('change', (e) => {
                this.currentTimeRange = e.target.value;
                this.loadData();
            });
        }

        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                this.clearFilters();
            });
        }

        if (refreshChart) {
            refreshChart.addEventListener('click', () => {
                this.loadData();
            });
        }

        if (refreshInsights) {
            refreshInsights.addEventListener('click', () => {
                this.loadAIInsights();
            });
        }

        // Chart filter changes
        const chartFilters = document.querySelectorAll('.chart-filter');
        chartFilters.forEach(filter => {
            filter.addEventListener('change', (e) => {
                this.updateSmallCharts();
            });
        });
    }

    async loadData() {
        this.showLoading();
        
        try {
            // Simulate API call
            const data = await this.fetchTrendData();
            this.updateCharts(data);
            this.updateStats(data);
            this.updateForecastTable(data);
            this.loadAIInsights();
        } catch (error) {
            console.error('Error loading trend data:', error);
            this.showError();
        }
    }

    async fetchTrendData() {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        return {
            historical: this.generateHistoricalData(),
            forecast: this.generateForecastData(),
            stats: {
                current: 245.7,
                trend: 'up',
                peak: 520.3,
                accuracy: '92%'
            }
        };
    }

    generateHistoricalData() {
        const data = [];
        const now = new Date();
        const points = this.getDataPointsForRange();
        
        for (let i = points; i >= 0; i--) {
            const date = new Date(now);
            
            // Adjust date based on time range
            if (this.currentTimeRange === '1h' || this.currentTimeRange === '6h') {
                date.setMinutes(date.getMinutes() - i * (this.currentTimeRange === '1h' ? 5 : 20));
            } else if (this.currentTimeRange === '24h') {
                date.setHours(date.getHours() - i);
            } else {
                date.setDate(date.getDate() - i);
            }
            
            // Simulate realistic data with some noise
            const baseValue = 200 + Math.sin(i * 0.3) * 120;
            const noise = (Math.random() - 0.5) * 60;
            const value = Math.max(50, baseValue + noise);
            
            data.push({
                x: date.getTime(),
                y: Math.round(value)
            });
        }
        
        return data;
    }

    generateForecastData() {
        const data = [];
        const now = new Date();
        const historical = this.generateHistoricalData();
        const lastValue = historical[historical.length - 1].y;
        
        for (let i = 1; i <= 7; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() + i);
            
            // Simple forecast based on trend with some randomness
            const trend = 8 + (Math.random() * 6);
            const value = lastValue + (trend * i) + (Math.random() - 0.5) * 25;
            
            data.push({
                x: date.getTime(),
                y: Math.max(50, Math.round(value)),
                confidence: Math.round(85 + (Math.random() * 12))
            });
        }
        
        return data;
    }

    getDataPointsForRange() {
        const ranges = {
            '1h': 12,    // 5-minute intervals
            '6h': 18,    // 20-minute intervals
            '24h': 24,   // 1-hour intervals
            '7d': 28,    // 6-hour intervals
            '30d': 30,   // 1-day intervals
            '90d': 45    // 2-day intervals
        };
        return ranges[this.currentTimeRange] || 28;
    }

    updateCharts(data) {
        // Update main chart
        if (this.charts.main) {
            this.charts.main.data.datasets[0].data = data.historical;
            this.charts.main.data.datasets[1].data = data.forecast;
            
            // Update chart title based on metric
            const metricTitles = {
                'bandwidth': 'Bandwidth Usage',
                'cpu': 'CPU Usage',
                'memory': 'Memory Usage',
                'temperature': 'Temperature',
                'humidity': 'Humidity',
                'alerts': 'Alert Trends'
            };
            
            const unit = this.currentMetric === 'bandwidth' ? 'Mbps' : 
                        this.currentMetric === 'temperature' ? '°C' :
                        this.currentMetric === 'humidity' ? '%' : '%';
            
            this.charts.main.options.plugins.title.text = 
                `${metricTitles[this.currentMetric]} Trends & Forecast`;
            
            this.charts.main.options.scales.y.title.text = 
                `${metricTitles[this.currentMetric]} (${unit})`;
            
            this.charts.main.update();
        }
    }

    updateStats(data) {
        const currentValue = document.getElementById('current-value');
        const trendDirection = document.getElementById('trend-direction');
        const peakValue = document.getElementById('peak-value');
        const forecastAccuracy = document.getElementById('forecast-accuracy');

        if (currentValue) currentValue.textContent = data.stats.current + ' Mbps';
        if (trendDirection) {
            trendDirection.textContent = data.stats.trend === 'up' ? 'Increasing ↑' : 'Decreasing ↓';
            trendDirection.className = `stat-value ${data.stats.trend === 'up' ? 'high' : 'low'}`;
        }
        if (peakValue) peakValue.textContent = data.stats.peak + ' Mbps';
        if (forecastAccuracy) forecastAccuracy.textContent = data.stats.accuracy;
    }

    updateForecastTable(data) {
        const tbody = document.getElementById('forecast-table-body');
        if (!tbody) return;

        let rows = '';
        
        // Show last 5 historical points and forecast
        const historicalToShow = data.historical.slice(-5);
        const forecastToShow = data.forecast.slice(0, 5);
        
        // Historical data
        historicalToShow.forEach(point => {
            const date = new Date(point.x);
            rows += `
                <tr>
                    <td>${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td>${point.y} Mbps</td>
                    <td>--</td>
                    <td>--</td>
                    <td>--</td>
                    <td><span class="trend-neutral">-</span></td>
                </tr>
            `;
        });
        
        // Forecast data
        forecastToShow.forEach(forecast => {
            const date = new Date(forecast.x);
            const variance = Math.round((Math.random() - 0.3) * 15); // Simulated variance
            
            rows += `
                <tr>
                    <td>${date.toLocaleDateString()}</td>
                    <td>--</td>
                    <td>${forecast.y} Mbps</td>
                    <td>${forecast.confidence}%</td>
                    <td>${variance}%</td>
                    <td><span class="trend-${variance >= 0 ? 'up' : 'down'}">${variance >= 0 ? '↑' : '↓'}</span></td>
                </tr>
            `;
        });

        tbody.innerHTML = rows;
    }

    updateSmallCharts() {
        // Update comparison chart with random data
        if (this.charts.comparison) {
            const newData = this.charts.comparison.data.datasets[0].data.map(() => 
                Math.floor(Math.random() * 300) + 150
            );
            this.charts.comparison.data.datasets[0].data = newData;
            this.charts.comparison.update();
        }
        
        // Update seasonal chart
        if (this.charts.seasonal) {
            const basePattern = [120, 80, 350, 480, 420, 280];
            const newData = basePattern.map(value => 
                Math.max(50, value + (Math.random() - 0.5) * 100)
            );
            this.charts.seasonal.data.datasets[0].data = newData;
            this.charts.seasonal.update();
        }
    }

    async loadAIInsights() {
        const insightsDiv = document.getElementById('ai-insights');
        if (!insightsDiv) return;

        insightsDiv.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Generating AI insights...</p>';

        // Simulate AI processing
        await new Promise(resolve => setTimeout(resolve, 1200));

        const insights = [
            "Bandwidth usage shows consistent growth of 8% week-over-week",
            "Peak usage occurs between 14:00-16:00 daily - consider load balancing",
            "Forecast predicts 15% increase in next 7 days due to seasonal patterns",
            "No critical anomalies detected in recent network patterns",
            "Memory usage remains stable across all core devices",
            "Temperature sensors show optimal operating conditions"
        ];

        // Take 3 random insights
        const selectedInsights = insights.sort(() => 0.5 - Math.random()).slice(0, 3);
        
        insightsDiv.innerHTML = selectedInsights.map(insight => 
            `<p>• ${insight}</p>`
        ).join('');
    }

    clearFilters() {
        document.getElementById('metric-type').value = 'bandwidth';
        document.getElementById('time-range').value = '7d';
        document.getElementById('device-select').value = 'all';
        document.getElementById('forecast-period').value = '7d';
        this.currentMetric = 'bandwidth';
        this.currentTimeRange = '7d';
        this.loadData();
    }

    showLoading() {
        // Show loading state in stats
        document.getElementById('current-value').textContent = '...';
        document.getElementById('trend-direction').textContent = '...';
        document.getElementById('peak-value').textContent = '...';
        document.getElementById('forecast-accuracy').textContent = '...';
    }

    showError() {
        // Show error state
        document.getElementById('current-value').textContent = 'Error';
        document.getElementById('trend-direction').textContent = 'Error';
        document.getElementById('peak-value').textContent = 'Error';
        document.getElementById('forecast-accuracy').textContent = 'Error';
    }

    generateNormalData(count) {
        const data = [];
        for (let i = 0; i < count; i++) {
            data.push({
                x: 100 + Math.random() * 400, // Bandwidth 100-500 Mbps
                y: 20 + Math.random() * 80    // Response time 20-100 ms
            });
        }
        return data;
    }

    generateAnomalyData(count) {
        const data = [];
        for (let i = 0; i < count; i++) {
            data.push({
                x: 300 + Math.random() * 300, // High bandwidth 300-600 Mbps
                y: 150 + Math.random() * 150   // High response time 150-300 ms
            });
        }
        return data;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Wait for DOM to be fully ready
    setTimeout(() => {
        window.trendsApp = new TrendsAndForecasts();
    }, 100);
    
    // Update current date
    const currentDate = document.getElementById('current-date');
    if (currentDate) {
        currentDate.textContent = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
});

// Add CSS for trend indicators
const style = document.createElement('style');
style.textContent = `
    .trend-up { color: #28a745; font-weight: bold; }
    .trend-down { color: #dc3545; font-weight: bold; }
    .trend-neutral { color: #6c757d; }
    
    .stat-value.high { color: #28a745; }
    .stat-value.medium { color: #ffc107; }
    .stat-value.low { color: #dc3545; }
    
    .loading { color: #6c757d; font-style: italic; }
`;
document.head.appendChild(style);