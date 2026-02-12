
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
            const ports = await response.json();
            renderPorts(ports);
            // Start polling (simulation)
            ports.forEach(port => {
                simulateTraffic(port.id);
            });
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
    const grid = document.getElementById('portGrid');
    grid.innerHTML = '';

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
                        <span>${formatBps(port.bps_in)}</span>
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
                        <span>${formatBps(port.bps_out)}</span>
                        <span class="text-gray">Traffic</span>
                    </div>
                </div>
            </div>

            <div class="chart-container-port">
                <canvas id="chart-${port.id}"></canvas>
            </div>
        `;
        grid.appendChild(card);
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

async function simulateTraffic(portId) {
    // If we have a backend simulation endpoint, use it. Otherwise, mock locally or poll.
    // The previous code polled `/ports/${portId}/simulate/`. We'll keep that if it exists.

    setInterval(async () => {
        try {
            const response = await apiFetch(`/ports/${portId}/simulate/`, { method: 'POST' });
            if (response && response.ok) {
                const result = await response.json();
                if (result.data) {
                    updateCard(portId, result.data);
                }
            }
        } catch (error) {
            // console.error('Sim error', error);
        }
    }, 3000);
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
