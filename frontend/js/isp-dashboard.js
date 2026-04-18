
const ispCharts = {};
const ispHistory = {}; // { ispId: { labels: [], loss: [], latency: [] } }
const MAX_HISTORY = 30;

document.addEventListener('DOMContentLoaded', () => {
    loadISPs();
    updateCurrentDateTime();

    // Refresh button
    const refreshBtn = document.getElementById('refresh-isps');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            probeAllISPs();
        });
    }

    // Add ISP Modal Logic
    const modal = document.getElementById('add-isp-modal');
    const btn = document.getElementById('add-isp-btn');
    const span = document.querySelector('.close-modal');
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
            body: JSON.stringify({ name, host, is_active: true })
        });

        if (response && response.status === 201) {
            loadISPs(); // Reload grid
        } else {
            alert('Failed to add ISP.');
        }
    } catch (e) {
        console.error(e);
        alert('Error adding ISP');
    }
}

async function loadISPs() {
    const grid = document.getElementById('isp-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading">Loading ISP Infrastructure...</div>';

    try {
        const response = await apiFetch('/isps/');
        if (!response) return;

        const data = await response.json();
        const isps = Array.isArray(data) ? data : (data.results || []);

        if (isps.length === 0) {
            grid.innerHTML = '<div class="no-data">No ISPs monitoring. Click "Add ISP" to start.</div>';
            return;
        }

        grid.innerHTML = '';
        for (const isp of isps) {
            grid.appendChild(createISPCard(isp));
            initISPChart(isp.id);

            // Fetch History for Chart
            loadISPHistory(isp.id);
        }

    } catch (error) {
        console.error('Error loading ISPs:', error);
        grid.innerHTML = '<div class="error">Failed to load ISPs.</div>';
    }
}

async function loadISPHistory(id) {
    try {
        const response = await apiFetch(`/isps/${id}/trends/?hours=1`);
        if (!response) return;
        
        const data = await response.json();
        if (data.historical) {
            ispHistory[id] = { labels: [], latency: [], loss: [] };
            data.historical.forEach(point => {
                const time = new Date(point.x).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                ispHistory[id].labels.push(time);
                ispHistory[id].latency.push(point.latency);
                ispHistory[id].loss.push(point.loss);
            });
            updateISPChart(id);
        }
    } catch (e) {
        console.error(`Failed to load history for ISP ${id}`, e);
    }
}

function createISPCard(isp) {
    const div = document.createElement('div');
    div.className = 'isp-detailed-card';
    div.id = `isp-card-${isp.id}`;

    const loss = isp.packet_loss != null ? isp.packet_loss.toFixed(1) : '--';
    const latency = isp.latency_ms != null ? isp.latency_ms.toFixed(0) : '--';
    
    div.innerHTML = `
        <div class="isp-card-main">
            <div class="isp-info-col">
                <div class="provider-header">
                    <div class="provider-icon"><i class="fas fa-globe"></i></div>
                    <div>
                        <h3 class="provider-title">${isp.name}</h3>
                        <p class="plan-info">Target: ${isp.host}</p>
                    </div>
                </div>
                
                <div class="isp-details-grid">
                    <div class="detail-item">
                        <span class="detail-label">Latency</span>
                        <span class="detail-value" id="latency-${isp.id}">${latency} ms</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Pkt Loss</span>
                        <span class="detail-value" id="loss-${isp.id}">${loss} %</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Downstream</span>
                        <span class="detail-value" id="down-${isp.id}">${isp.downstream_mbps || 0} Mbps</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Status</span>
                        <span class="status-pill ${isp.packet_loss < 100 ? 'online' : 'offline'}" id="status-${isp.id}">
                            ${isp.packet_loss < 100 ? 'ONLINE' : 'OFFLINE'}
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="isp-chart-col">
                <div class="chart-label">Latency (ms) History</div>
                <div class="isp-chart-wrapper">
                    <canvas id="chart-${isp.id}"></canvas>
                </div>
            </div>
        </div>
    `;
    return div;
}

function initISPChart(id) {
    const canvas = document.getElementById(`chart-${id}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ispCharts[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Latency',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { 
                    beginAtZero: true,
                    ticks: { display: true, font: { size: 9 } },
                    grid: { display: false }
                }
            }
        }
    });
}

function updateISPChart(id) {
    const chart = ispCharts[id];
    const history = ispHistory[id];
    if (chart && history) {
        chart.data.labels = history.labels;
        chart.data.datasets[0].data = history.latency;
        chart.update('none');
    }
}

async function probeAllISPs() {
    try {
        await apiFetch('/isps/probe_all/', { method: 'POST' });
        console.log('Global ISP probe triggered');
    } catch (e) {
        console.error('Failed to trigger global probe', e);
    }
}

// Global update function called by WebSocket or Polling
function updateISPUI(data) {
    const id = data.isp_id || data.id;
    const card = document.getElementById(`isp-card-${id}`);
    if (!card) return;

    // Update Elements
    const elLat = document.getElementById(`latency-${id}`);
    const elLoss = document.getElementById(`loss-${id}`);
    const elDown = document.getElementById(`down-${id}`);
    const elStatus = document.getElementById(`status-${id}`);

    if (elLat) elLat.textContent = `${data.latency_ms?.toFixed(0) || 0} ms`;
    if (elLoss) elLoss.textContent = `${data.packet_loss?.toFixed(1) || 0} %`;
    if (elDown) elDown.textContent = `${data.downstream_mbps?.toFixed(1) || 0} Mbps`;

    if (elStatus) {
        const isOnline = data.packet_loss < 100;
        elStatus.className = `status-pill ${isOnline ? 'online' : 'offline'}`;
        elStatus.textContent = isOnline ? 'ONLINE' : 'OFFLINE';
    }

    // Update History & Chart
    if (!ispHistory[id]) ispHistory[id] = { labels: [], latency: [], loss: [] };
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    ispHistory[id].labels.push(now);
    ispHistory[id].latency.push(data.latency_ms || 0);
    ispHistory[id].loss.push(data.packet_loss || 0);

    if (ispHistory[id].labels.length > MAX_HISTORY) {
        ispHistory[id].labels.shift();
        ispHistory[id].latency.shift();
        ispHistory[id].loss.shift();
    }

    updateISPChart(id);
}

// Expose for WebSocket
window.updateISPUI = updateISPUI;
