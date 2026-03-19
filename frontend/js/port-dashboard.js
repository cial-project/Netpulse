
// Port Dashboard Logic
let charts = {};
const MAX_HISTORY = 10;

document.addEventListener('DOMContentLoaded', () => {
    // Check auth
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize
    fetchPorts();
    updateDateTime();
    updateAlertCount(); // Add alert count update

    // Periodic Refresh
    setInterval(updateAlertCount, 30000);

    // Event Listeners
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });

    // Add Port Modal
    window.openModal = function () {
        document.getElementById('addPortModal').style.display = 'block';
    }
    window.closeModal = function () {
        document.getElementById('addPortModal').style.display = 'none';
    }

    const addForm = document.getElementById('addPortForm');
    if (addForm) {
        addForm.addEventListener('submit', handleAddPort);
    }

    // Search
    document.getElementById('port-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.port-card');
        cards.forEach(card => {
            const name = card.dataset.name.toLowerCase();
            const device = card.dataset.device.toLowerCase();
            if (name.includes(term) || device.includes(term)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    });
});

function updateDateTime() {
    // If there's a time element
    setInterval(() => {
        // ...
    }, 1000);
}

async function fetchPorts() {
    try {
        const response = await apiFetch('/ports/');
        if (response && response.ok) {
            const data = await response.json();
            // Handle DRF paginated responses
            const ports = Array.isArray(data) ? data : (data.results || []);
            renderPorts(ports);
            // Start polling real data exactly once
            startRealTimeTrafficPolling();
            return;
        }
        throw new Error('Response not ok');
    } catch (error) {
        console.error('Error fetching ports:', error);

        // Fallback mock data for CIAL demonstration
        console.log('Using fallback Port data');
        const fallbackPorts = [
            { id: 201, name: 'GigabitEthernet1/0/1', device_name: 'Core-Router-01', ip_address: '10.0.0.1', status: 'up', utilization_in: 45, utilization_out: 30, bps_in: 450000000, bps_out: 300000000 },
            { id: 202, name: 'GigabitEthernet1/0/2', device_name: 'Core-Router-01', ip_address: '10.0.0.1', status: 'up', utilization_in: 12, utilization_out: 85, bps_in: 120000000, bps_out: 850000000 },
            { id: 203, name: 'TenGigabitEthernet0/1', device_name: 'Dist-Switch-A1', ip_address: '10.0.1.5', status: 'up', utilization_in: 5, utilization_out: 10, bps_in: 500000000, bps_out: 1000000000 },
            { id: 204, name: 'GigabitEthernet0/24', device_name: 'sw-access-01', ip_address: '10.0.5.10', status: 'down', utilization_in: 0, utilization_out: 0, bps_in: 0, bps_out: 0 }
        ];

        renderPorts(fallbackPorts);

        // Mock simulation for fallback ports
        fallbackPorts.forEach(port => {
            setInterval(() => {
                const mockData = {
                    utilization_in: Math.floor(Math.random() * 100),
                    utilization_out: Math.floor(Math.random() * 100)
                };
                updateCard(port.id, mockData);
            }, 3000);
        });
    }
}

function renderPorts(ports) {
    const gridIt = document.getElementById('portGrid-it');
    const gridConf = document.getElementById('portGrid-conf');
    const gridLounges = document.getElementById('portGrid-lounges');
    const gridOther = document.getElementById('portGrid-other');
    
    if (gridIt) gridIt.innerHTML = '';
    if (gridConf) gridConf.innerHTML = '';
    if (gridLounges) gridLounges.innerHTML = '';
    if (gridOther) gridOther.innerHTML = '';

    // Update the port count label
    const portCountLabel = document.getElementById('port-count-label');
    if (portCountLabel) {
        portCountLabel.textContent = `${ports.length} port${ports.length !== 1 ? 's' : ''} monitored`;
    }

    ports.forEach(port => {
        const card = document.createElement('div');
        card.className = 'port-card'; // We'll style this in dashboard.css
        card.dataset.name = port.name;
        card.dataset.device = port.device_name;

        card.innerHTML = `
            <div class="port-header">
                <div>
                    <div class="port-name">${port.name}</div>
                    <div class="device-name">
                        ${port.device_name} 
                        ${port.ip_address ? `<small>(${port.ip_address})</small>` : ''}
                    </div>
                </div>
                <span class="status-badge status-${port.status === 'up' ? 'success' : 'danger'}">
                    ${port.status.toUpperCase()}
                </span>
            </div>
            
            <div class="port-metrics-grid">
                <!-- Inbound -->
                <div class="metric-block">
                    <div class="metric-title">Inbound</div>
                    <div class="metric-row">
                        <span>Util</span>
                        <span id="util-in-${port.id}" class="font-bold">${port.utilization_in}%</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill" id="bar-in-${port.id}" style="width: ${port.utilization_in}%"></div>
                    </div>
                    <div class="metric-row small">
                        <span id="bps-in-${port.id}">${formatBps(port.bps_in)}</span>
                        <span class="text-gray">Traffic</span>
                    </div>
                </div>

                <!-- Outbound -->
                <div class="metric-block">
                    <div class="metric-title">Outbound</div>
                    <div class="metric-row">
                        <span>Util</span>
                        <span id="util-out-${port.id}" class="font-bold">${port.utilization_out}%</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill" id="bar-out-${port.id}" style="width: ${port.utilization_out}%"></div>
                    </div>
                    <div class="metric-row small">
                        <span id="bps-out-${port.id}">${formatBps(port.bps_out)}</span>
                        <span class="text-gray">Traffic</span>
                    </div>
                </div>
            </div>

            <div class="chart-container-port">
                <canvas id="chart-${port.id}"></canvas>
            </div>
        `;
        
        const lowerName = port.name.toLowerCase();
        if (lowerName.includes('meeting') || lowerName.includes('it room') || lowerName.includes('it m')) {
            if (gridIt) gridIt.appendChild(card);
        } else if (lowerName.includes('conference') || lowerName.includes('hall')) {
            if (gridConf) gridConf.appendChild(card);
        } else if (lowerName.includes('lounge')) {
            if (gridLounges) gridLounges.appendChild(card);
        } else {
            if (gridOther) gridOther.appendChild(card);
        }
        
        initChart(port.id);
    });
}

function initChart(portId) {
    const canvas = document.getElementById(`chart-${portId}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    charts[portId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(MAX_HISTORY).fill(''),
            datasets: [{
                label: 'In',
                data: Array(MAX_HISTORY).fill(0),
                borderColor: '#2f855a', // Dark Green
                backgroundColor: 'rgba(47, 133, 90, 0.05)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: true
            }, {
                label: 'Out',
                data: Array(MAX_HISTORY).fill(0),
                borderColor: '#68d391', // Light Green
                backgroundColor: 'rgba(104, 211, 145, 0.05)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { display: false },
                y: { display: false, min: 0, max: 100 }
            },
            animation: false
        }
    });
}

let trafficPollInterval = null;
function startRealTimeTrafficPolling() {
    if (trafficPollInterval) return;
    trafficPollInterval = setInterval(async () => {
        try {
            // Fetch real up-to-date port traffic
            const response = await apiFetch('/ports/');
            if (response && response.ok) {
                const data = await response.json();
                const updatedPorts = Array.isArray(data) ? data : (data.results || []);
                updatedPorts.forEach(port => {
                    const elData = {
                        utilization_in: parseInt(port.utilization_in) || 0,
                        utilization_out: parseInt(port.utilization_out) || 0
                    };
                    updateCard(port.id, elData);
                });
            }
        } catch (error) {
            console.error('Real-time Port Traffic Error:', error);
        }
    }, 5000); // 5s poll for more real-time feel
}

async function updateAlertCount() {
    try {
        const response = await apiFetch('/alerts/summary/');
        if (response && response.ok) {
            const data = await response.json();
            const badge = document.getElementById('port-alert-count');
            if (badge) {
                badge.innerText = data.critical_alerts || 0;
                badge.style.display = data.critical_alerts > 0 ? 'flex' : 'none';
            }
        }
    } catch (e) {
        console.error('Error updating alert count:', e);
    }
}

function updateCard(portId, data) {
    // Text updates
    const elUtilIn = document.getElementById(`util-in-${portId}`);
    const elUtilOut = document.getElementById(`util-out-${portId}`);

    if (elUtilIn) elUtilIn.innerText = data.utilization_in + '%';
    if (elUtilOut) elUtilOut.innerText = data.utilization_out + '%';

    // Bars
    const barIn = document.getElementById(`bar-in-${portId}`);
    const barOut = document.getElementById(`bar-out-${portId}`);
    if (barIn) barIn.style.width = data.utilization_in + '%';
    if (barOut) barOut.style.width = data.utilization_out + '%';

    // Chart
    const chart = charts[portId];
    if (chart) {
        chart.data.datasets[0].data.push(data.utilization_in);
        chart.data.datasets[0].data.shift();
        chart.data.datasets[1].data.push(data.utilization_out);
        chart.data.datasets[1].data.shift();
        chart.update();
    }
}

function formatBps(bps) {
    if (bps >= 1000000000) return (bps / 1000000000).toFixed(1) + 'G';
    if (bps >= 1000000) return (bps / 1000000).toFixed(1) + 'M';
    if (bps >= 1000) return (bps / 1000).toFixed(1) + 'K';
    return bps;
}

async function handleAddPort(e) {
    e.preventDefault();
    const name = document.getElementById('portName').value;
    const deviceName = document.getElementById('deviceName').value;
    const ipAddress = document.getElementById('ipAddress').value;
    const capacity = document.getElementById('capacity').value;

    try {
        const response = await apiFetch('/ports/', {
            method: 'POST',
            body: JSON.stringify({
                name,
                device_name: deviceName,
                ip_address: ipAddress,
                capacity_mbps: capacity,
                status: 'up'
            })
        });

        if (response && response.ok) {
            closeModal();
            fetchPorts();
            e.target.reset();
        } else {
            alert('Failed to add port');
        }
    } catch (error) {
        console.error('Error adding port:', error);
        alert('Error adding port');
    }
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = 'login.html';
}
