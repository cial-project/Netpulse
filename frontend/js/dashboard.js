// Utility: Format date as "Month Day, Year"
function formatDate(date) {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Set current date
document.getElementById('current-date').textContent = formatDate(new Date());

// 1. User Info
fetch('/api/user/')
    .then(res => res.json())
    .then(data => {
        document.getElementById('sidebar-username').textContent = data.username;
        document.getElementById('sidebar-userrole').textContent = data.role;
        document.getElementById('header-username').textContent = data.username;
    });

// 2. KPIs
fetch('/api/kpi/')
    .then(res => res.json())
    .then(data => {
        document.getElementById('kpi-devices-status').textContent = data.devices_status;
        document.getElementById('kpi-active-alerts').textContent = data.active_alerts;
        document.getElementById('kpi-avg-temperature').textContent = data.avg_temperature;
        document.getElementById('kpi-ups-status').textContent = data.ups_status;
        document.getElementById('kpi-bandwidth').textContent = data.bandwidth;
        document.getElementById('kpi-throughput').textContent = data.throughput;
        document.getElementById('kpi-latency').textContent = data.latency;
        document.getElementById('kpi-jitter').textContent = data.jitter;
    });

// 3. AI Insights
fetch('/api/ai-insights/')
    .then(res => res.json())
    .then(data => {
        const insightsDiv = document.getElementById('ai-insights');
        insightsDiv.innerHTML = '';
        data.insights.forEach(insight => {
            const p = document.createElement('p');
            p.textContent = insight;
            insightsDiv.appendChild(p);
        });
    });

// 4. Map Zones
fetch('/api/map/')
    .then(res => res.json())
    .then(data => {
        const mapZones = document.getElementById('map-zones');
        mapZones.innerHTML = '';
        data.zones.forEach(zone => {
            const zoneDiv = document.createElement('div');
            zoneDiv.className = 'map-zone';
            zoneDiv.style.top = zone.top;
            zoneDiv.style.left = zone.left;
            zoneDiv.innerHTML = `
                <div class="zone-point ${zone.status}"></div>
                <span class="zone-label">${zone.label}</span>
            `;
            mapZones.appendChild(zoneDiv);
        });

        // Legend
        const legend = document.getElementById('map-legend');
        legend.innerHTML = '';
        data.legend.forEach(item => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = `<div class="legend-color ${item.status}"></div><span>${item.label} (${item.count})</span>`;
            legend.appendChild(legendItem);
        });
    });

// 5. Stats Section
fetch('/api/stats/')
    .then(res => res.json())
    .then(data => {
        // Temperature
        document.getElementById('stat-temperature').innerHTML = `${data.temperature.value} <span>°C</span>`;
        document.getElementById('stat-temperature-bar').style.width = data.temperature.progress;
        document.getElementById('stat-temperature-comp').innerHTML = data.temperature.comparison;

        // Humidity
        document.getElementById('stat-humidity').innerHTML = `${data.humidity.value} <span>%</span>`;
        document.getElementById('stat-humidity-bar').style.width = data.humidity.progress;
        document.getElementById('stat-humidity-comp').innerHTML = data.humidity.comparison;

        // Passenger Systems
        document.getElementById('stat-passenger-systems').innerHTML = `${data.passenger_systems.value}<span>%</span>`;
        document.getElementById('stat-passenger-bar').style.width = data.passenger_systems.progress;
        document.getElementById('stat-passenger-comp').innerHTML = data.passenger_systems.comparison;
    });

// 6. Notifications Count
fetch('/api/notifications/count/')
    .then(res => res.json())
    .then(data => {
        const badge = document.getElementById('notification-badge');
        if (badge) {
            badge.textContent = data.count > 0 ? data.count : '';
        }
    });