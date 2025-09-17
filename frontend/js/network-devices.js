document.addEventListener('DOMContentLoaded', function() {
    // Fetch stats
    fetch('/api/network-devices/stats/')
        .then(res => res.json())
        .then(data => {
            document.getElementById('stat-total-devices').textContent = data.total;
            document.getElementById('stat-online').textContent = data.online;
            document.getElementById('stat-warning').textContent = data.warning;
            document.getElementById('stat-critical').textContent = data.critical;
        });

    // Fetch AI Insight
    function loadInsight() {
        fetch('/api/network-devices/ai-insight/')
            .then(res => res.json())
            .then(data => {
                document.getElementById('ai-insight-content').innerHTML = `
                    <div class="insight-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="insight-text"><p>${data.insight}</p></div>
                `;
            });
    }
    loadInsight();
    document.getElementById('refresh-insight').addEventListener('click', loadInsight);

    // Fetch devices table
    function loadDevices() {
        fetch('/api/network-devices/list/')
            .then(res => res.json())
            .then(data => {
                const tbody = document.getElementById('devices-table-body');
                tbody.innerHTML = '';
                data.devices.forEach(device => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${device.name}</td>
                            <td>${device.type}</td>
                            <td>${device.ip}</td>
                            <td><span class="status-badge ${device.status.toLowerCase()}">${device.status}</span></td>
                            <td>${device.uptime}</td>
                            <td>${device.last_checked}</td>
                            <td>
                                <button class="action-btn view-btn" data-device="${device.id}"><i class="fas fa-eye"></i></button>
                                <button class="action-btn config-btn" data-device="${device.id}"><i class="fas fa-cog"></i></button>
                            </td>
                        </tr>
                    `;
                });
            });
    }
    loadDevices();

    // Fetch and render bandwidth chart using Chart.js
    fetch('/api/network-devices/bandwidth/')
        .then(res => res.json())
        .then(data => {
            if (window.Chart) {
                new Chart(document.getElementById('bandwidth-chart').getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: data.labels,
                        datasets: [{
                            label: 'Bandwidth (Mbps)',
                            data: data.values,
                            borderColor: '#007bff',
                            fill: false
                        }]
                    }
                });
            }
        });
});