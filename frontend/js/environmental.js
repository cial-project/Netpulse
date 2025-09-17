document.addEventListener('DOMContentLoaded', function() {
    // Utility: Format date as "Month Day, Year"
    function formatDate(date) {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    // Set current date
    document.getElementById('current-date').textContent = formatDate(new Date());

    // Fetch stats overview
    fetch('/api/environmental/stats/')
        .then(res => res.json())
        .then(data => {
            document.getElementById('avg-temperature').textContent = data.avg_temperature + "°";
            document.getElementById('avg-humidity').textContent = data.avg_humidity + "%";
            document.getElementById('avg-ups').textContent = data.avg_ups + "%";
            document.getElementById('env-warnings').textContent = data.env_warnings;
            if (data.notifications) {
                document.getElementById('notification-badge').textContent = data.notifications;
            }
        });

    // Fetch AI Insight
    function loadInsight() {
        fetch('/api/environmental/ai-insight/')
            .then(res => res.json())
            .then(data => {
                document.getElementById('ai-insight-content').innerHTML = `
                    <div class="insight-icon"><i class="fas fa-temperature-high"></i></div>
                    <div class="insight-text"><p>${data.insight}</p></div>
                `;
            });
    }
    loadInsight();
    document.getElementById('refresh-insight').addEventListener('click', loadInsight);

    // Fetch and render environmental table
    function loadTable() {
        fetch('/api/environmental/zones/')
            .then(res => res.json())
            .then(data => {
                const tbody = document.getElementById('environment-table-body');
                tbody.innerHTML = '';
                data.zones.forEach(zone => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${zone.name}</td>
                            <td>${zone.temperature}</td>
                            <td>${zone.humidity}</td>
                            <td>${zone.ups_battery || 'N/A'}</td>
                            <td><span class="status-badge ${zone.status.toLowerCase()}">${zone.status}</span></td>
                            <td>${zone.last_checked}</td>
                            <td>
                                <button class="action-btn view-btn" data-zone='${JSON.stringify(zone)}'><i class="fas fa-eye"></i></button>
                                <button class="action-btn config-btn" data-zone-id="${zone.id}"><i class="fas fa-cog"></i></button>
                            </td>
                        </tr>
                    `;
                });
                // Update rows info
                document.getElementById('rows-info').textContent = `Showing ${data.zones.length} of ${data.total_zones} zones`;
            });
    }
    loadTable();

    // Table filter events (optional, backend should support filtering)
    document.getElementById('zone-filter').addEventListener('change', loadTable);
    document.getElementById('status-filter').addEventListener('change', loadTable);

    // Export button (optional, implement as needed)
    document.getElementById('export-btn').addEventListener('click', function() {
        window.open('/api/environmental/export/', '_blank');
    });

    // Modal functionality
    document.getElementById('environment-table-body').addEventListener('click', function(e) {
        if (e.target.closest('.view-btn')) {
            const zone = JSON.parse(e.target.closest('.view-btn').getAttribute('data-zone'));
            document.getElementById('modal-zone-title').textContent = `Zone Details: ${zone.name}`;
            document.getElementById('modal-body').innerHTML = `
                <div class="zone-details">
                    <div class="detail-row">
                        <span class="detail-label">Zone Type:</span>
                        <span class="detail-value">${zone.type}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Temperature:</span>
                        <span class="detail-value">${zone.temperature} <span class="detail-status ${zone.temp_status.toLowerCase()}">(${zone.temp_status})</span></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Humidity:</span>
                        <span class="detail-value">${zone.humidity} <span class="detail-status ${zone.humidity_status.toLowerCase()}">(${zone.humidity_status})</span></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">UPS Status:</span>
                        <span class="detail-value">${zone.ups_battery || 'N/A'} <span class="detail-status ${zone.ups_status ? zone.ups_status.toLowerCase() : ''}">${zone.ups_status ? '(' + zone.ups_status + ')' : ''}</span></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Last Updated:</span>
                        <span class="detail-value">${zone.last_checked}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Monitoring Since:</span>
                        <span class="detail-value">${zone.monitoring_since}</span>
                    </div>
                </div>
                <div class="threshold-settings">
                    <h4>Alert Thresholds</h4>
                    <div class="threshold-row">
                        <span class="threshold-label">Temperature Warning:</span>
                        <div class="threshold-value">${zone.temp_warning}°C</div>
                    </div>
                    <div class="threshold-row">
                        <span class="threshold-label">Temperature Critical:</span>
                        <div class="threshold-value">${zone.temp_critical}°C</div>
                    </div>
                    <div class="threshold-row">
                        <span class="threshold-label">Humidity Warning:</span>
                        <div class="threshold-value">${zone.humidity_warning}%</div>
                    </div>
                    <div class="threshold-row">
                        <span class="threshold-label">Humidity Critical:</span>
                        <div class="threshold-value">${zone.humidity_critical}%</div>
                    </div>
                </div>
            `;
            document.getElementById('zone-modal').style.display = 'flex';
        }
    });
    document.getElementById('modal-close-btn').addEventListener('click', function() {
        document.getElementById('zone-modal').style.display = 'none';
    });
    document.getElementById('modal-cancel-btn').addEventListener('click', function() {
        document.getElementById('zone-modal').style.display = 'none';
    });

    // Charts
    function renderChart(canvasId, apiUrl, label, color) {
        fetch(apiUrl)
            .then(res => res.json())
            .then(data => {
                if (window.Chart) {
                    new Chart(document.getElementById(canvasId).getContext('2d'), {
                        type: 'line',
                        data: {
                            labels: data.labels,
                            datasets: [{
                                label: label,
                                data: data.values,
                                borderColor: color,
                                fill: false
                            }]
                        }
                    });
                }
            });
    }
    renderChart('temperature-chart', '/api/environmental/temperature-trend/', 'Temperature (°C)', '#e67e22');
    renderChart('humidity-chart', '/api/environmental/humidity-trend/', 'Humidity (%)', '#3498db');
    renderChart('ups-chart', '/api/environmental/ups-trend/', 'UPS Battery (%)', '#27ae60');
    renderChart('zone-comparison-chart', '/api/environmental/zone-comparison/', 'Zone Comparison', '#9b59b6');
});