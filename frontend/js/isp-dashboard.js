
const ispCharts = {};
const ispHistory = {}; // { ispId: { labels: [], loss: [], up: [], down: [] } }
const MAX_HISTORY = 20;

document.addEventListener('DOMContentLoaded', () => {
    loadISPs();
    updateCurrentDateTime();

    // Refresh button
    document.getElementById('refresh-isps').addEventListener('click', () => {
        probeAllISPs();
    });

    // Add ISP Modal Logic
    const modal = document.getElementById('add-isp-modal');
    const btn = document.getElementById('add-isp-btn');
    const span = document.getElementsByClassName('close-modal')[0];
    const form = document.getElementById('add-isp-form');

    if (btn) btn.onclick = () => modal.style.display = "block";
    if (span) span.onclick = () => modal.style.display = "none";
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
    }

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('isp-name').value;
            const host = document.getElementById('isp-host').value;
            await addNewISP(name, host);
            modal.style.display = "none";
            form.reset();
        };
    }

    // Auto-refresh every 10 seconds
    setInterval(probeAllISPs, 10000);

    // Update time every second
    setInterval(updateCurrentDateTime, 1000);
});

function updateCurrentDateTime() {
    const now = new Date();
    const el = document.getElementById('current-date-time');
    if (el) el.textContent = now.toLocaleString();
}

async function addNewISP(name, host) {
    try {
        const response = await apiFetch('/isps/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                host: host,
                is_active: true
            })
        });

        if (response && response.ok) {
            loadISPs(); // Reload grid
        } else {
            alert('Failed to add ISP. Please check the backend logs.');
        }
    } catch (e) {
        console.error(e);
        alert('Error adding ISP');
    }
}

async function loadISPs() {
    const grid = document.getElementById('isp-grid');
    grid.innerHTML = '<div class="loading">Loading ISPs...</div>';

    try {
        const response = await apiFetch('/isps/');
        if (!response) return;

        const isps = await response.json();

        if (isps.length === 0) {
            grid.innerHTML = '<div class="no-data">No ISPs configured. Click "Add ISP" to start monitoring.</div>';
            return;
        }

        grid.innerHTML = '';
        isps.forEach(isp => {
            // Map backend fields to frontend expected fields
            const ispData = {
                id: isp.id,
                name: isp.name,
                host: isp.host,
                status: isp.packet_loss === 100 ? 'offline' : 'online', // Simple status inference
                packet_loss: isp.packet_loss,
                upstream_mbps: isp.upstream_mbps,
                downstream_mbps: isp.downstream_mbps
            };

            grid.appendChild(createISPCard(ispData));
            initISPChart(isp.id);

            if (!ispHistory[isp.id]) {
                ispHistory[isp.id] = { labels: [], loss: [], up: [], down: [] };
            }

            // Update with initial data if available
            if (isp.last_checked) {
                updateISPUI(ispData);
            } else {
                probeISP(isp.id);
            }
        });

    } catch (error) {
        console.error('Error loading ISPs:', error);

        // Fallback mock data for CIAL demonstration
        console.log('Using fallback ISP data');
        const fallbackIsps = [
            { id: 101, name: 'Asianet Fiber', host: '115.112.x.x', packet_loss: 0, upstream_mbps: 150, downstream_mbps: 300, status: 'online' },
            { id: 102, name: 'BSNL MPLS', host: '210.212.x.x', packet_loss: 0.5, upstream_mbps: 50, downstream_mbps: 100, status: 'online' },
            { id: 103, name: 'Jio Business', host: '49.204.x.x', packet_loss: 100, upstream_mbps: 0, downstream_mbps: 0, status: 'offline' }
        ];

        grid.innerHTML = '';
        fallbackIsps.forEach(isp => {
            grid.appendChild(createISPCard(isp));
            initISPChart(isp.id);
            if (!ispHistory[isp.id]) {
                ispHistory[isp.id] = { labels: [], loss: [], up: [], down: [] };
            }
            updateISPUI(isp);
        });
    }
}

// Image mapping for providers (mock)
const providerLogos = {
    'asianet': 'fa-globe-asia',
    'bsnl': 'fa-network-wired',
    'jio': 'fa-satellite-dish',
    'default': 'fa-globe'
};

function createISPCard(isp) {
    const div = document.createElement('div');
    div.className = 'isp-detailed-card';
    div.id = `isp-card-${isp.id}`;

    const normalizedName = isp.name.toLowerCase();
    const logoIcon = providerLogos[normalizedName] || providerLogos.default;
    if (normalizedName.includes('asianet')) logoIcon = 'fa-globe-asia';
    // ^ duplicate logic but safe

    // Mock interface logic
    let iface = 'GigabitEthernet1/0/1';
    if (normalizedName.includes('bsnl')) iface = 'GigabitEthernet1/0/2';
    if (normalizedName.includes('jio')) iface = 'GigabitEthernet1/0/3';

    // Mock Gateway
    const gateway = isp.host ? isp.host.replace(/\d+$/, '1') : '192.168.1.1';

    div.innerHTML = `
        <div class="isp-card-main">
            <div class="isp-info-col">
                <div class="provider-header">
                    <div class="provider-icon"><i class="fas ${logoIcon}"></i></div>
                    <div>
                        <h3 class="provider-title">${isp.name}</h3>
                        <p class="plan-info">${isp.plan_upload_mbps || 100}Mbps Upload / ${isp.plan_download_mbps || 100}Mbps Download</p>
                    </div>
                </div>
                
                <div class="isp-details-grid">
                    <div class="detail-item">
                        <span class="detail-label">Static IP</span>
                        <span class="detail-value">${isp.host}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Gateway</span>
                        <span class="detail-value">${gateway}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Interface</span>
                        <span class="detail-value">${iface}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Status</span>
                        <span class="status-pill ${isp.status === 'online' ? 'online' : 'offline'}">${isp.status.toUpperCase()}</span>
                    </div>
                </div>
            </div>
            
            <div class="isp-chart-col">
                <div class="chart-label">Usage History</div>
                <div class="isp-chart-wrapper">
                    <canvas id="chart-${isp.id}"></canvas>
                </div>
            </div>
        </div>
    `;
    return div;
}

function initISPChart(id) {
    const ctx = document.getElementById(`chart-${id}`).getContext('2d');
    ispCharts[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Usage',
                    data: [],
                    borderColor: '#2f855a', // Dark Green
                    backgroundColor: 'rgba(47, 133, 90, 0.05)',
                    fill: 'start',
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
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: { display: false },
                y: {
                    display: false,
                    min: 0
                }
            },
            elements: {
                point: { radius: 0 }
            }
        }
    });
}

async function probeAllISPs() {
    const cards = document.querySelectorAll('.isp-detailed-card');
    const promises = [];
    for (const card of cards) {
        const id = card.id.replace('isp-card-', '');
        promises.push(probeISP(id));
    }
    await Promise.allSettled(promises);
}

async function probeISP(id) {
    try {
        const response = await apiFetch(`/isps/${id}/probe/`, { method: 'POST' });
        if (response && response.ok) {
            const data = await response.json();
            if (data.success && data.result) {
                updateISPUI({
                    id: id,
                    ...data.result
                });
            }
        }
    } catch (e) {
        console.error(`Error probing ISP ${id}:`, e);
    }
}

function updateISPUI(data) {
    const id = data.id;

    // Update text values
    const loss = data.packet_loss !== null && data.packet_loss !== undefined ? `${Number(data.packet_loss).toFixed(1)} %` : '--';
    const down = data.downstream_mbps !== null && data.downstream_mbps !== undefined ? `${Number(data.downstream_mbps).toFixed(1)} Mbps` : '--';
    const up = data.upstream_mbps !== null && data.upstream_mbps !== undefined ? `${Number(data.upstream_mbps).toFixed(1)} Mbps` : '--';

    const elLoss = document.getElementById(`loss-${id}`);
    const elDown = document.getElementById(`down-${id}`);
    const elUp = document.getElementById(`up-${id}`);

    if (elLoss) elLoss.textContent = loss;
    if (elDown) elDown.textContent = down;
    if (elUp) elUp.textContent = up;

    // Update Status Badge
    const statusBadge = document.getElementById(`status-${id}`);
    if (statusBadge) {
        if (data.packet_loss < 100) {
            statusBadge.className = 'status-badge status-online';
            statusBadge.textContent = 'Online';
        } else {
            statusBadge.className = 'status-badge status-offline';
            statusBadge.textContent = 'Offline';
        }
    }

    // Update Chart
    const chart = ispCharts[id];
    const history = ispHistory[id];

    if (chart && history) {
        const now = new Date().toLocaleTimeString();

        history.labels.push(now);
        history.loss.push(data.packet_loss || 0);
        history.up.push(data.upstream_mbps || 0);
        history.down.push(data.downstream_mbps || 0);

        if (history.labels.length > MAX_HISTORY) {
            history.labels.shift();
            history.loss.shift();
            history.up.shift();
            history.down.shift();
        }

        chart.data.labels = history.labels;
        chart.data.datasets[0].data = history.down;

        chart.update('none');
    }
}
