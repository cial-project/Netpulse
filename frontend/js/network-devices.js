// Fetch and render real network devices from backend

document.addEventListener('DOMContentLoaded', function() {
    loadNetworkDevices();
});

async function loadNetworkDevices() {
    const tableBody = document.querySelector('.devices-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://127.0.0.1:8000/api/auth/devices/', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            tableBody.innerHTML = '<tr><td colspan="7">Failed to load devices</td></tr>';
            return;
        }
        const devices = await response.json();
        if (!Array.isArray(devices) || devices.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">No devices found</td></tr>';
            return;
        }
        tableBody.innerHTML = '';
        devices.forEach(device => {
            const status = device.is_active ? 'online' : 'offline';
            tableBody.innerHTML += `
                <tr>
                    <td>${device.name}</td>
                    <td>${device.device_type}</td>
                    <td>${device.ip_address}</td>
                    <td><span class="status-badge ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
                    <td>-</td>
                    <td>-</td>
                    <td>
                        <button class="action-btn view-btn"><i class="fas fa-eye"></i></button>
                        <button class="action-btn config-btn"><i class="fas fa-cog"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="7">Error loading devices</td></tr>';
    }
}
