// Environmental Monitoring JavaScript with Zone Management
class EnvironmentalMonitor {
    constructor() {
        this.charts = {};
        this.zones = [];
        this.selectedZones = new Set();
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.zoneIdCounter = 1000;
        this.init();
    }

    init() {
        this.initializeCharts();
        this.loadZoneData();
        this.setupEventListeners();
        this.updateDateTime();
        this.setupChartControls(); // Add this line
        // (no global instantiation here — the page bootstraps the instance at DOMContentLoaded)
    }

    // Helper to attach an event listener only once per element/key
    addListenerOnce(element, key, event, handler) {
        if (!element) return;
        const safeKey = `npEnv_${String(key || '')}`.replace(/[^a-zA-Z0-9_]/g, '_');
        if (element.dataset && element.dataset[safeKey]) return;
        element.addEventListener(event, handler);
        try { element.dataset[safeKey] = 'true'; } catch (e) { /* ignore */ }
    }

    initializeCharts() {
        this.initTemperatureChart();
        this.initHumidityChart();
        this.initUPSChart();
        this.initZoneChart();
    }

    initTemperatureChart() {
        const ctx = document.getElementById('temperatureChart');
        if (!ctx) return;

        this.charts.temperature = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generateTimeLabels(24),
                datasets: [{
                    label: 'Temperature (°C)',
                    data: this.generateTemperatureData(),
                    borderColor: '#e53e3e',
                    backgroundColor: 'rgba(229, 62, 62, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#e53e3e',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: this.getChartOptions('Temperature Trends - Last 24 Hours')
        });
    }

    initHumidityChart() {
        const ctx = document.getElementById('humidityChart');
        if (!ctx) return;

        this.charts.humidity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generateTimeLabels(24),
                datasets: [{
                    label: 'Humidity (%)',
                    data: this.generateHumidityData(),
                    borderColor: '#3182ce',
                    backgroundColor: 'rgba(49, 130, 206, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3182ce',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: this.getChartOptions('Humidity Levels - Last 24 Hours')
        });
    }

    initUPSChart() {
        const ctx = document.getElementById('upsChart');
        if (!ctx) return;

        this.charts.ups = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generateTimeLabels(24),
                datasets: [{
                    label: 'UPS Battery (%)',
                    data: this.generateUPSData(),
                    borderColor: '#38a169',
                    backgroundColor: 'rgba(56, 161, 105, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#38a169',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: this.getChartOptions('UPS Battery Status - Last 24 Hours')
        });
    }

    initZoneChart() {
        const ctx = document.getElementById('zoneChart');
        if (!ctx) return;

        this.charts.zone = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Server Room A', 'Check-in Area', 'Security Screening', 'Control Tower', 'Baggage Handling', 'Gate A5'],
                datasets: [{
                    label: 'Temperature (°C)',
                    data: [24.2, 21.8, 23.1, 22.5, 25.7, 26.3],
                    backgroundColor: '#e53e3e',
                    borderColor: '#c53030',
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
                }]
            },
            options: this.getChartOptions('Zone Temperature Comparison', 'bar')
        });
    }

    getChartOptions(title, type = 'line') {
        const baseOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: { 
                        size: 16, 
                        weight: 'bold' 
                    },
                    padding: 20,
                    color: '#2d3748'
                },
                legend: {
                    position: 'bottom',
                    labels: { 
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 10,
                    cornerRadius: 4,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                if (label.includes('Temperature')) {
                                    label += context.parsed.y + '°C';
                                } else if (label.includes('Humidity') || label.includes('UPS')) {
                                    label += context.parsed.y + '%';
                                }
                            }
                            return label;
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
                        color: '#718096',
                        maxTicksLimit: 12
                    }
                },
                y: {
                    beginAtZero: type === 'bar',
                    grid: { 
                        color: 'rgba(0, 0, 0, 0.1)',
                        drawBorder: false
                    },
                    ticks: { 
                        color: '#718096',
                        callback: function(value) {
                            if (type === 'bar') {
                                return value + '°C';
                            }
                            return value;
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        };

        return baseOptions;
    }

    generateTimeLabels(hours) {
        const labels = [];
        const now = new Date();
        
        for (let i = hours; i >= 0; i--) {
            const time = new Date(now);
            time.setHours(time.getHours() - i);
            
            // Format as HH:MM
            const hoursStr = time.getHours().toString().padStart(2, '0');
            const minutesStr = time.getMinutes().toString().padStart(2, '0');
            
            labels.push(`${hoursStr}:${minutesStr}`);
        }
        
        return labels;
    }

    generateTemperatureData() {
        const data = [];
        for (let i = 0; i <= 24; i++) {
            // Simulate daily temperature pattern - cooler at night, warmer during day
            const hour = (new Date().getHours() - (24 - i) + 24) % 24;
            const baseTemp = 22 + Math.sin((hour - 6) * Math.PI / 12) * 3;
            const variation = (Math.random() - 0.5) * 2;
            data.push(Number((baseTemp + variation).toFixed(1)));
        }
        return data;
    }

    generateHumidityData() {
        const data = [];
        for (let i = 0; i <= 24; i++) {
            // Simulate humidity variations - higher at night, lower during day
            const hour = (new Date().getHours() - (24 - i) + 24) % 24;
            const baseHumidity = 50 + Math.sin((hour + 6) * Math.PI / 12) * 15;
            const variation = (Math.random() - 0.5) * 8;
            const humidity = baseHumidity + variation;
            data.push(Math.max(30, Math.min(80, Math.round(humidity))));
        }
        return data;
    }

    generateUPSData() {
        const data = [];
        let current = 95;
        for (let i = 0; i <= 24; i++) {
            // Simulate realistic battery discharge with some recovery
            const hour = (new Date().getHours() - (24 - i) + 24) % 24;
            
            // Discharge faster during business hours (9 AM - 5 PM)
            const isBusinessHours = hour >= 9 && hour <= 17;
            const dischargeRate = isBusinessHours ? 0.3 : 0.1;
            
            // Add some random variation
            const variation = (Math.random() - 0.5) * 0.5;
            
            current = Math.max(80, current - dischargeRate + variation);
            data.push(Number(current.toFixed(1)));
        }
        return data;
    }

    setupChartControls() {
        // Temperature chart time range
        const tempTimeRange = document.getElementById('temp-time-range');
        if (tempTimeRange) {
            tempTimeRange.addEventListener('change', (e) => {
                this.updateTemperatureChart(e.target.value);
            });
        }

        // Humidity chart time range
        const humidityTimeRange = document.getElementById('humidity-time-range');
        if (humidityTimeRange) {
            humidityTimeRange.addEventListener('change', (e) => {
                this.updateHumidityChart(e.target.value);
            });
        }

        // UPS chart time range
        const upsTimeRange = document.getElementById('ups-time-range');
        if (upsTimeRange) {
            upsTimeRange.addEventListener('change', (e) => {
                this.updateUPSChart(e.target.value);
            });
        }

        // Zone chart metric selection
        const metricSelect = document.getElementById('metric-select');
        if (metricSelect) {
            metricSelect.addEventListener('change', (e) => {
                this.updateZoneChart(e.target.value);
            });
        }
    }

    updateTemperatureChart(range) {
        if (!this.charts.temperature) return;

        let hours, title;
        switch(range) {
            case '1h': hours = 1; title = 'Last 1 Hour'; break;
            case '6h': hours = 6; title = 'Last 6 Hours'; break;
            case '12h': hours = 12; title = 'Last 12 Hours'; break;
            case '24h': hours = 24; title = 'Last 24 Hours'; break;
            case '7d': hours = 168; title = 'Last 7 Days'; break;
            case '30d': hours = 720; title = 'Last 30 Days'; break;
            default: hours = 24; title = 'Last 24 Hours';
        }

        this.charts.temperature.data.labels = this.generateTimeLabels(hours);
        this.charts.temperature.data.datasets[0].data = this.generateTemperatureDataForRange(hours);
        this.charts.temperature.options.plugins.title.text = `Temperature Trends - ${title}`;
        this.charts.temperature.update();
    }

    updateHumidityChart(range) {
        if (!this.charts.humidity) return;

        let hours, title;
        switch(range) {
            case '1h': hours = 1; title = 'Last 1 Hour'; break;
            case '6h': hours = 6; title = 'Last 6 Hours'; break;
            case '12h': hours = 12; title = 'Last 12 Hours'; break;
            case '24h': hours = 24; title = 'Last 24 Hours'; break;
            case '7d': hours = 168; title = 'Last 7 Days'; break;
            case '30d': hours = 720; title = 'Last 30 Days'; break;
            default: hours = 24; title = 'Last 24 Hours';
        }

        this.charts.humidity.data.labels = this.generateTimeLabels(hours);
        this.charts.humidity.data.datasets[0].data = this.generateHumidityDataForRange(hours);
        this.charts.humidity.options.plugins.title.text = `Humidity Levels - ${title}`;
        this.charts.humidity.update();
    }

    updateUPSChart(range) {
        if (!this.charts.ups) return;

        let hours, title;
        switch(range) {
            case '1h': hours = 1; title = 'Last 1 Hour'; break;
            case '6h': hours = 6; title = 'Last 6 Hours'; break;
            case '12h': hours = 12; title = 'Last 12 Hours'; break;
            case '24h': hours = 24; title = 'Last 24 Hours'; break;
            case '7d': hours = 168; title = 'Last 7 Days'; break;
            case '30d': hours = 720; title = 'Last 30 Days'; break;
            default: hours = 24; title = 'Last 24 Hours';
        }

        this.charts.ups.data.labels = this.generateTimeLabels(hours);
        this.charts.ups.data.datasets[0].data = this.generateUPSDataForRange(hours);
        this.charts.ups.options.plugins.title.text = `UPS Battery Status - ${title}`;
        this.charts.ups.update();
    }

    generateTemperatureDataForRange(hours) {
        const data = [];
        for (let i = 0; i <= hours; i++) {
            const baseTemp = 22 + Math.sin((i / hours) * Math.PI * 2) * 4;
            const variation = (Math.random() - 0.5) * 2;
            data.push(Number((baseTemp + variation).toFixed(1)));
        }
        return data;
    }

    generateHumidityDataForRange(hours) {
        const data = [];
        for (let i = 0; i <= hours; i++) {
            const baseHumidity = 50 + Math.sin((i / hours) * Math.PI * 2 + Math.PI) * 15;
            const variation = (Math.random() - 0.5) * 8;
            const humidity = baseHumidity + variation;
            data.push(Math.max(30, Math.min(80, Math.round(humidity))));
        }
        return data;
    }

    generateUPSDataForRange(hours) {
        const data = [];
        let current = 95;
        for (let i = 0; i <= hours; i++) {
            // Simulate discharge based on time range
            const dischargeRate = hours <= 24 ? 0.2 : 0.05;
            const variation = (Math.random() - 0.5) * 0.5;
            
            current = Math.max(75, current - dischargeRate + variation);
            data.push(Number(current.toFixed(1)));
        }
        return data;
    }

    updateZoneChart(metric) {
        if (!this.charts.zone) return;

        const zones = ['Server Room A', 'Check-in Area', 'Security Screening', 'Control Tower', 'Baggage Handling', 'Gate A5'];
        let data, label, color;

        if (metric === 'temperature') {
            data = [24.2, 21.8, 23.1, 22.5, 25.7, 26.3];
            label = 'Temperature (°C)';
            color = '#e53e3e';
        } else {
            data = [42, 48, 45, 43, 52, 49];
            label = 'Humidity (%)';
            color = '#3182ce';
        }

        this.charts.zone.data.datasets[0] = {
            label: label,
            data: data,
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
        };

        this.charts.zone.options.plugins.title.text = `Zone ${metric === 'temperature' ? 'Temperature' : 'Humidity'} Comparison`;
        
        // Update Y-axis label
        this.charts.zone.options.scales.y.ticks.callback = function(value) {
            return value + (metric === 'temperature' ? '°C' : '%');
        };

        this.charts.zone.update();
    }

    // ... REST OF YOUR EXISTING CODE REMAINS THE SAME ...
    // (loadZoneData, renderZoneTable, updatePagination, updateStats, setupEventListeners, 
    // filterZones, refreshAIInsights, toggleSelectAllZones, toggleZoneSelection, 
    // getCurrentPageZoneIds, updateDeleteButton, setupModal, showZoneDetails, 
    // showAddZoneModal, setupAddZoneModal, saveNewZone, deleteSelectedZones, 
    // deleteSingleZone, showNotification, updateDateTime)

    async loadZoneData() {
        try {
            // Try to fetch zones from backend API
            const zonesResp = await apiFetch('/zones/');
            if (zonesResp && zonesResp.ok) {
                const zonesData = await zonesResp.json();

                // Map the returned zones to the table structure. If a zone key matches dc1/dc2/dr
                // we'll try to pull temperature/humidity values from the dashboard KPI endpoint.
                let kpi = null;
                try {
                    const kpiResp = await apiFetch('/dashboard/kpi/');
                    if (kpiResp && kpiResp.ok) kpi = await kpiResp.json();
                } catch (e) {
                    // ignore KPI fetch errors, we'll fallback to defaults
                }

                this.zones = zonesData.map((z, idx) => {
                    // Default placeholders
                    let temp = 22.5, humidity = 45, ups = null, status = 'normal';

                    const key = (z.key || '').toLowerCase();
                    if (kpi) {
                        if (key === 'dc1') {
                            temp = parseFloat(String(kpi.dc1_temperature || '').replace('°C','')) || temp;
                            humidity = parseInt(String(kpi.dc1_humidity || '').replace('% Humidity','')) || humidity;
                        } else if (key === 'dc2') {
                            temp = parseFloat(String(kpi.dc2_temperature || '').replace('°C','')) || temp;
                            humidity = parseInt(String(kpi.dc2_humidity || '').replace('% Humidity','')) || humidity;
                        } else if (key === 'dr') {
                            temp = parseFloat(String(kpi.dr_temperature || '').replace('°C','')) || temp;
                            humidity = parseInt(String(kpi.dr_humidity || '').replace('% Humidity','')) || humidity;
                        }
                    }

                    return {
                        id: z.id,
                        name: z.name,
                        temp: Number(temp),
                        humidity: Number(humidity),
                        ups: ups,
                        status: status,
                        lastChecked: 'Just now',
                        type: 'zone',
                        thresholds: { temp: 28, humidity: 60 }
                    };
                });

                this.zoneIdCounter = this.zones.length ? Math.max(...this.zones.map(z => z.id)) + 1 : 1000;
                this.currentPage = 1;
                this.renderZoneTable();
                this.updateStats();
                return;
            }

            // Fallback to simulated zone data if API not available
            this.zones = [
                { id: 1, name: 'Server Room A', temp: 24.2, humidity: 42, ups: 95, status: 'normal', lastChecked: '2 minutes ago', type: 'server', thresholds: { temp: 28, humidity: 60 } },
                { id: 2, name: 'Check-in Area', temp: 21.8, humidity: 48, ups: null, status: 'normal', lastChecked: '5 minutes ago', type: 'public', thresholds: { temp: 26, humidity: 65 } },
                { id: 3, name: 'Security Screening', temp: 23.1, humidity: 45, ups: null, status: 'normal', lastChecked: '3 minutes ago', type: 'public', thresholds: { temp: 26, humidity: 65 } },
                { id: 4, name: 'Control Tower', temp: 22.5, humidity: 43, ups: 88, status: 'warning', lastChecked: '4 minutes ago', type: 'critical', thresholds: { temp: 25, humidity: 55 } },
                { id: 5, name: 'Baggage Handling', temp: 25.7, humidity: 52, ups: null, status: 'warning', lastChecked: '6 minutes ago', type: 'operations', thresholds: { temp: 27, humidity: 70 } },
                { id: 6, name: 'Gate A5', temp: 26.3, humidity: 49, ups: null, status: 'critical', lastChecked: '8 minutes ago', type: 'public', thresholds: { temp: 26, humidity: 65 } },
                { id: 7, name: 'IT Closet B2', temp: 23.8, humidity: 38, ups: 92, status: 'normal', lastChecked: '7 minutes ago', type: 'server', thresholds: { temp: 28, humidity: 60 } }
            ];

            this.zoneIdCounter = Math.max(...this.zones.map(z => z.id)) + 1;
            this.renderZoneTable();
            this.updateStats();

        } catch (error) {
            console.error('Error loading zone data:', error);
        }
    }

    renderZoneTable() {
        const tbody = document.getElementById('zones-tbody');
        if (!tbody) return;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const currentZones = this.zones.slice(startIndex, endIndex);

        tbody.innerHTML = currentZones.map(zone => `
            <tr class="${this.selectedZones.has(zone.id) ? 'selected' : ''}">
                <td>
                    <input type="checkbox" class="zone-checkbox" data-zone-id="${zone.id}" 
                           ${this.selectedZones.has(zone.id) ? 'checked' : ''}>
                </td>
                <td>${zone.name}</td>
                <td>${zone.temp}°C</td>
                <td>${zone.humidity}%</td>
                <td>${zone.ups ? zone.ups + '%' : 'N/A'}</td>
                <td><span class="status-badge ${zone.status}">${zone.status.charAt(0).toUpperCase() + zone.status.slice(1)}</span></td>
                <td>${zone.lastChecked}</td>
                <td>
                    <button class="action-btn view-btn" data-zone-id="${zone.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn config-btn" data-zone-id="${zone.id}">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="action-btn delete-btn" data-zone-id="${zone.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        this.updatePagination();
        this.updateDeleteButton();
    }

    updatePagination() {
        const totalPages = Math.ceil(this.zones.length / this.itemsPerPage);
        document.getElementById('page-info').textContent = `Page ${this.currentPage} of ${totalPages}`;
        document.getElementById('rows-info').textContent = `Showing ${Math.min(this.itemsPerPage, this.zones.length)} of ${this.zones.length} zones`;

        document.getElementById('prev-page').disabled = this.currentPage === 1;
        document.getElementById('next-page').disabled = this.currentPage === totalPages;
    }

    updateStats() {
        const temps = this.zones.map(z => z.temp);
        const humidities = this.zones.map(z => z.humidity);
        const upsValues = this.zones.map(z => z.ups).filter(Boolean);
        const warnings = this.zones.filter(z => z.status === 'warning' || z.status === 'critical').length;

        document.getElementById('avg-temperature').textContent = 
            `${(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)}°`;
        document.getElementById('avg-humidity').textContent = 
            `${Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length)}%`;
        document.getElementById('ups-capacity').textContent = 
            upsValues.length ? `${Math.round(upsValues.reduce((a, b) => a + b, 0) / upsValues.length)}%` : 'N/A';
        document.getElementById('env-warnings').textContent = warnings;
        document.getElementById('env-alert-count').textContent = warnings;
    }

    setupEventListeners() {
        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderZoneTable();
            }
        });

        document.getElementById('next-page').addEventListener('click', () => {
            if (this.currentPage < Math.ceil(this.zones.length / this.itemsPerPage)) {
                this.currentPage++;
                this.renderZoneTable();
            }
        });

        // Filters
        const zoneFilterEl = document.getElementById('zone-filter');
        const statusFilterEl = document.getElementById('status-filter');
        this.addListenerOnce(zoneFilterEl, 'zone-filter-change', 'change', (e) => this.filterZones());
        this.addListenerOnce(statusFilterEl, 'status-filter-change', 'change', (e) => this.filterZones());

        // Search
        document.getElementById('zone-search').addEventListener('input', (e) => {
            this.filterZones();
        });

        // Refresh insights
        this.addListenerOnce(document.getElementById('refresh-insights'), 'refresh-insights', 'click', () => this.refreshAIInsights());

        // Add Zone Button
        this.addListenerOnce(document.getElementById('add-zone-btn'), 'add-zone-click', 'click', () => this.showAddZoneModal());

        // Delete Selected Zones Button
        this.addListenerOnce(document.getElementById('delete-zone-btn'), 'delete-zones-click', 'click', () => this.deleteSelectedZones());

        // Select All Checkbox
        this.addListenerOnce(document.getElementById('select-all-zones'), 'select-all-change', 'change', (e) => this.toggleSelectAllZones(e.target.checked));

        // Individual Zone Checkboxes
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('zone-checkbox')) {
                this.toggleZoneSelection(e.target);
            }
        });

        // Individual Delete Buttons (delegated)
        this.addListenerOnce(document, 'delegated-delete-click', 'click', (e) => {
            const del = e.target.closest && e.target.closest('.delete-btn');
            if (del) {
                const zoneId = parseInt(del.dataset.zoneId);
                this.deleteSingleZone(zoneId);
            }
        });

        // View buttons for zone details (delegated)
        this.addListenerOnce(document, 'delegated-view-click', 'click', (e) => {
            const view = e.target.closest && e.target.closest('.view-btn');
            if (view) {
                const zoneId = parseInt(view.dataset.zoneId);
                this.showZoneDetails(zoneId);
            }
        });

        // Export data button
        this.addListenerOnce(document.getElementById('export-data'), 'export-data-click', 'click', () => this.exportData());

        // Modal setup
        this.setupModal();
    }

    filterZones() {
        const zoneFilter = document.getElementById('zone-filter').value;
        const statusFilter = document.getElementById('status-filter').value;
        const searchTerm = document.getElementById('zone-search').value.toLowerCase();

        // Reset to full dataset first (in a real app, you'd reload from server)
        this.loadZoneData().then(() => {
            let filteredZones = this.zones;

            if (zoneFilter !== 'all') {
                const nf = String(zoneFilter).toLowerCase().replace(/[^a-z0-9]+/g, '');
                filteredZones = filteredZones.filter(zone => {
                    const nameNorm = String(zone.name).toLowerCase().replace(/[^a-z0-9]+/g, '');
                    const typeNorm = String(zone.type || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
                    return nameNorm.includes(nf) || typeNorm === nf || typeNorm.includes(nf);
                });
            }

            if (statusFilter !== 'all') {
                filteredZones = filteredZones.filter(zone => zone.status === statusFilter);
            }

            if (searchTerm) {
                filteredZones = filteredZones.filter(zone => 
                    zone.name.toLowerCase().includes(searchTerm)
                );
            }

            this.zones = filteredZones;
            this.currentPage = 1;
            this.renderZoneTable();
            this.updateStats();
        });
    }

    refreshAIInsights() {
        const insights = [
            "Temperature rising in Server Room A. Predicted to exceed threshold in 2 hours.",
            "Humidity levels stable across all zones. Optimal conditions maintained.",
            "UPS battery in Control Tower showing gradual discharge. Maintenance recommended.",
            "All environmental parameters within normal operating ranges.",
            "Baggage handling area temperature approaching warning threshold."
        ];
        
        const randomInsight = insights[Math.floor(Math.random() * insights.length)];
        document.getElementById('ai-insight-text').textContent = randomInsight;

        // Show refresh animation
        const btn = document.getElementById('refresh-insights');
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        }, 1000);
    }

    toggleSelectAllZones(selectAll) {
        const currentPageZones = this.getCurrentPageZoneIds();
        
        if (selectAll) {
            currentPageZones.forEach(id => this.selectedZones.add(id));
        } else {
            currentPageZones.forEach(id => this.selectedZones.delete(id));
        }
        
        this.renderZoneTable();
        this.updateDeleteButton();
    }

    toggleZoneSelection(checkbox) {
        const zoneId = parseInt(checkbox.dataset.zoneId);
        
        if (checkbox.checked) {
            this.selectedZones.add(zoneId);
        } else {
            this.selectedZones.delete(zoneId);
            document.getElementById('select-all-zones').checked = false;
        }
        
        this.updateDeleteButton();
    }

    getCurrentPageZoneIds() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return this.zones.slice(startIndex, endIndex).map(zone => zone.id);
    }

    updateDeleteButton() {
        const deleteBtn = document.getElementById('delete-zone-btn');
        const selectAllCheckbox = document.getElementById('select-all-zones');
        const currentPageZones = this.getCurrentPageZoneIds();
        
        // Update select all checkbox state
        const allSelected = currentPageZones.length > 0 && 
                           currentPageZones.every(id => this.selectedZones.has(id));
        selectAllCheckbox.checked = allSelected;
        selectAllCheckbox.indeterminate = !allSelected && currentPageZones.some(id => this.selectedZones.has(id));
        
        // Update delete button
        deleteBtn.disabled = this.selectedZones.size === 0;
        deleteBtn.innerHTML = this.selectedZones.size > 1 ? 
            `<i class="fas fa-trash"></i> Delete Selected (${this.selectedZones.size})` : 
            '<i class="fas fa-trash"></i> Delete Selected';
    }

    setupModal() {
        const modal = document.getElementById('zone-modal');
        const closeBtn = document.getElementById('close-modal');
        const modalClose = document.querySelector('.modal-close');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        if (modalClose) {
            modalClose.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
    }

    showZoneDetails(zoneId) {
        const zone = this.zones.find(z => z.id === zoneId);
        if (!zone) return;

        const modal = document.getElementById('zone-modal');
        const modalTitle = document.getElementById('modal-title');
        const zoneDetails = document.getElementById('zone-details');

        if (modalTitle) modalTitle.textContent = `Zone Details: ${zone.name}`;
        
        if (zoneDetails) {
            zoneDetails.innerHTML = `
                <div class="detail-row">
                    <span class="detail-label">Zone Type:</span>
                    <span class="detail-value">${zone.type.charAt(0).toUpperCase() + zone.type.slice(1)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Temperature:</span>
                    <span class="detail-value">${zone.temp}°C <span class="detail-status ${zone.status}">(${zone.status.charAt(0).toUpperCase() + zone.status.slice(1)})</span></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Humidity:</span>
                    <span class="detail-value">${zone.humidity}% <span class="detail-status ${zone.status}">(${zone.status === 'normal' ? 'Normal' : 'Check'})</span></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">UPS Status:</span>
                    <span class="detail-value">${zone.ups ? zone.ups + '%' : 'N/A'} <span class="detail-status ${zone.ups > 90 ? 'normal' : 'warning'}">(${zone.ups > 90 ? 'Optimal' : 'Monitor'})</span></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Last Updated:</span>
                    <span class="detail-value">${zone.lastChecked}</span>
                </div>
            `;
        }

        if (modal) modal.style.display = 'flex';
    }

    showAddZoneModal() {
        const modalHtml = `
            <div class="modal-overlay" id="add-zone-modal">
                <div class="modal modal-large">
                    <div class="modal-header">
                        <h3>Add New Monitoring Zone</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="add-zone-form">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="zone-name">Zone Name *</label>
                                    <input type="text" id="zone-name" required 
                                           placeholder="e.g., Server Room B">
                                </div>
                                <div class="form-group">
                                    <label for="zone-type">Zone Type *</label>
                                    <select id="zone-type" required>
                                        <option value="">Select zone type...</option>
                                        <option value="server">Server Room</option>
                                        <option value="public">Public Area</option>
                                        <option value="operations">Operations</option>
                                        <option value="critical">Critical Infrastructure</option>
                                        <option value="storage">Storage Area</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="initial-temp">Initial Temperature (°C)</label>
                                    <input type="number" id="initial-temp" value="22.0" step="0.1" 
                                           min="-10" max="50" placeholder="22.0">
                                </div>
                                <div class="form-group">
                                    <label for="initial-humidity">Initial Humidity (%)</label>
                                    <input type="number" id="initial-humidity" value="45" 
                                           min="0" max="100" placeholder="45">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="zone-location">Location Description</label>
                                <input type="text" id="zone-location" 
                                       placeholder="e.g., Terminal 1, Level 2">
                            </div>
                            
                            <div class="threshold-settings">
                                <h4>Alert Thresholds</h4>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="temp-warning">Temperature Warning (°C)</label>
                                        <input type="number" id="temp-warning" value="26" 
                                               min="0" max="50" placeholder="26">
                                    </div>
                                    <div class="form-group">
                                        <label for="temp-critical">Temperature Critical (°C)</label>
                                        <input type="number" id="temp-critical" value="28" 
                                               min="0" max="50" placeholder="28">
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="humidity-warning">Humidity Warning (%)</label>
                                        <input type="number" id="humidity-warning" value="60" 
                                               min="0" max="100" placeholder="60">
                                    </div>
                                    <div class="form-group">
                                        <label for="humidity-critical">Humidity Critical (%)</label>
                                        <input type="number" id="humidity-critical" value="70" 
                                               min="0" max="100" placeholder="70">
                                    </div>
                                </div>
                            </div>
                            
                            <div id="add-zone-error" class="error-message"></div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn secondary" id="cancel-add-zone">Cancel</button>
                        <button class="btn primary" id="save-zone">Add Zone</button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('add-zone-modal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.setupAddZoneModal();
    }

    setupAddZoneModal() {
        const modal = document.getElementById('add-zone-modal');
        const closeBtn = document.getElementById('cancel-add-zone');
        const modalClose = modal.querySelector('.modal-close');
        const saveBtn = document.getElementById('save-zone');
        const form = document.getElementById('add-zone-form');

        // Show modal
        modal.style.display = 'flex';

        // Close modal
        const closeModal = () => {
            modal.style.display = 'none';
            setTimeout(() => modal.remove(), 300);
        };

        // Attach handlers idempotently
        this.addListenerOnce(closeBtn, 'close-add-zone', 'click', closeModal);
        this.addListenerOnce(modalClose, 'modal-close-add-zone', 'click', closeModal);
        this.addListenerOnce(modal, 'modal-click-close', 'click', (e) => { if (e.target === modal) closeModal(); });

        // Save zone (idempotent)
        this.addListenerOnce(saveBtn, 'save-zone-click', 'click', () => this.saveNewZone());

        // Enter key support on the form
        this.addListenerOnce(form, 'add-zone-enter', 'keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.saveNewZone();
            }
        });
    }

    saveNewZone() {
        const name = document.getElementById('zone-name').value.trim();
        const type = document.getElementById('zone-type').value;
        const temp = parseFloat(document.getElementById('initial-temp').value) || 22.0;
        const humidity = parseInt(document.getElementById('initial-humidity').value) || 45;
        const tempWarning = parseInt(document.getElementById('temp-warning').value) || 26;
        const tempCritical = parseInt(document.getElementById('temp-critical').value) || 28;
        const humidityWarning = parseInt(document.getElementById('humidity-warning').value) || 60;
        const humidityCritical = parseInt(document.getElementById('humidity-critical').value) || 70;

        // Validation
        if (!name || !type) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Check if zone name already exists
        if (this.zones.some(zone => zone.name.toLowerCase() === name.toLowerCase())) {
            this.showNotification('Zone name already exists', 'error');
            return;
        }

        // Create new zone
        const newZone = {
            id: this.zoneIdCounter++,
            name: name,
            temp: temp,
            humidity: humidity,
            ups: type === 'server' ? 95 : null,
            status: 'normal',
            lastChecked: 'Just now',
            type: type,
            thresholds: {
                temp: tempCritical,
                humidity: humidityCritical
            }
        };

        // Add to zones array
        this.zones.unshift(newZone);
        
        // Close modal
        document.getElementById('add-zone-modal').style.display = 'none';
        
        // Show success message
        this.showNotification(`Zone "${name}" added successfully`, 'success');
        
        // Refresh table
        this.currentPage = 1;
        this.renderZoneTable();
        this.updateStats();
        
        // Update charts
        this.updateZoneChart(document.getElementById('metric-select').value);
    }

    deleteSelectedZones() {
        if (this.selectedZones.size === 0) return;

        const zoneNames = this.zones
            .filter(zone => this.selectedZones.has(zone.id))
            .map(zone => zone.name);

        const message = this.selectedZones.size === 1 ?
            `Are you sure you want to delete zone "${zoneNames[0]}"?` :
            `Are you sure you want to delete ${this.selectedZones.size} selected zones?`;

        if (!confirm(message + '\n\nThis action cannot be undone.')) {
            return;
        }

        // Delete zones
        this.zones = this.zones.filter(zone => !this.selectedZones.has(zone.id));
        this.selectedZones.clear();
        
        // Show success message
        this.showNotification(
            `Deleted ${zoneNames.length} zone${zoneNames.length > 1 ? 's' : ''} successfully`, 
            'success'
        );
        
        // Refresh table
        this.currentPage = 1;
        this.renderZoneTable();
        this.updateStats();
    }

    deleteSingleZone(zoneId) {
        const zone = this.zones.find(z => z.id === zoneId);
        if (!zone) return;

        if (!confirm(`Are you sure you want to delete zone "${zone.name}"?\n\nThis action cannot be undone.`)) {
            return;
        }

        this.zones = this.zones.filter(z => z.id !== zoneId);
        this.selectedZones.delete(zoneId);
        
        this.showNotification(`Zone "${zone.name}" deleted successfully`, 'success');
        this.renderZoneTable();
        this.updateStats();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        });

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    exportData() {
        try {
            if (!this.zones || this.zones.length === 0) {
                this.showNotification('No environmental data to export', 'info');
                return;
            }

            const rows = this.zones.map(z => ({
                id: z.id,
                name: z.name,
                temperature: z.temp,
                humidity: z.humidity,
                ups: z.ups || '',
                status: z.status,
                lastChecked: z.lastChecked
            }));

            const headers = Object.keys(rows[0]);
            const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => {
                const v = r[h] === null || r[h] === undefined ? '' : String(r[h]);
                // Escape quotes
                return `"${v.replace(/"/g, '""')}"`;
            }).join(','))).join('\n');

            const csvContent = '\ufeff' + csv;
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `environmental-data-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.showNotification('Environmental data exported', 'success');
        } catch (err) {
            console.error('Export failed:', err);
            this.showNotification('Failed to export data', 'error');
        }
    }

    updateDateTime() {
        const now = new Date();
        const dateElement = document.getElementById('current-date');
        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
    }

    // Accept metric updates pushed from websocket and update charts in-place
    updateMetrics(metrics = {}) {
        try {
            // Temperature updates (prefer explicit keys if present)
            const tempVal = metrics.temperature || metrics.dc1_temperature || metrics.dc_temperature || null;
            if (tempVal !== null && this.charts.temperature) {
                const chart = this.charts.temperature;
                // slide window: remove first, push new
                if (Array.isArray(chart.data.datasets[0].data)) {
                    chart.data.datasets[0].data.shift();
                    chart.data.datasets[0].data.push(Number(tempVal));
                }
                // shift labels and add current time label
                if (Array.isArray(chart.data.labels)) {
                    chart.data.labels.shift();
                    const now = new Date();
                    chart.data.labels.push(`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`);
                }
                chart.update();
            }

            // Humidity updates
            const humVal = metrics.humidity || metrics.dc1_humidity || null;
            if (humVal !== null && this.charts.humidity) {
                const chart = this.charts.humidity;
                if (Array.isArray(chart.data.datasets[0].data)) {
                    chart.data.datasets[0].data.shift();
                    chart.data.datasets[0].data.push(Number(humVal));
                }
                if (Array.isArray(chart.data.labels)) {
                    chart.data.labels.shift();
                    const now = new Date();
                    chart.data.labels.push(`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`);
                }
                chart.update();
            }

            // UPS battery
            const upsVal = metrics.ups_battery || metrics.ups || null;
            if (upsVal !== null && this.charts.ups) {
                const chart = this.charts.ups;
                if (Array.isArray(chart.data.datasets[0].data)) {
                    chart.data.datasets[0].data.shift();
                    chart.data.datasets[0].data.push(Number(upsVal));
                }
                if (Array.isArray(chart.data.labels)) {
                    chart.data.labels.shift();
                    const now = new Date();
                    chart.data.labels.push(`${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`);
                }
                chart.update();
            }

        } catch (e) {
            console.error('Failed to apply metric update to environmental charts', e);
        }
    }
}

// Initialize when page loads (robust to late script load)
(function initEnv() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { window.envApp = new EnvironmentalMonitor(); });
    } else {
        window.envApp = new EnvironmentalMonitor();
    }
})();