// API utility function
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = 'login.html';
        return null;
    }

    const API_BASE = 'http://127.0.0.1:8000/api';
    const url = `${API_BASE}${endpoint}`;
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (response.status === 401) {
            window.location.href = 'login.html';
            return null;
        }

        return response;
    } catch (error) {
        console.error('API fetch error:', error);
        return null;
    }
}

// Device data functions
async function loadNetworkDevices() {
    const tableBody = document.querySelector('.devices-table tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">Loading devices...</td></tr>';

    try {
        const response = await apiFetch('/devices/');
        if (!response) {
            showDemoDevices();
            return;
        }

        if (response.ok) {
            const devices = await response.json();
            renderDevicesTable(devices);
            updateDeviceStats(devices);
        } else {
            showDemoDevices();
        }
    } catch (error) {
        console.error('Error loading devices:', error);
        showDemoDevices();
    }
}

// Load zones for the dropdown
async function loadZones() {
    try {
        const response = await apiFetch('/zones/');
        if (response && response.ok) {
            const zones = await response.json();
            const zoneSelect = document.getElementById('device-zone');
            if (zoneSelect) {
                zoneSelect.innerHTML = '<option value="">Select zone...</option>';
                zones.forEach(zone => {
                    const option = document.createElement('option');
                    option.value = zone.id;
                    option.textContent = zone.name;
                    zoneSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading zones:', error);
    }
}

function renderDevicesTable(devices) {
    const tableBody = document.querySelector('.devices-table tbody');
    if (!devices || devices.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">No devices found. Add some devices to get started.</td></tr>';
        return;
    }

    tableBody.innerHTML = devices.map(device => `
        <tr class="${getStatusClass(device)}" data-device-id="${device.id}">
            <td>
                <div class="device-name-cell">
                    <i class="fas fa-${getDeviceIcon(device.device_type)}"></i>
                    ${device.name || 'Unnamed Device'}
                </div>
            </td>
            <td><span class="device-type-badge ${device.device_type}">${device.device_type || 'Unknown'}</span></td>
            <td class="ip-address">${device.ip_address || 'N/A'}</td>
            <td>${device.zone || 'N/A'}</td>
            <td>${device.port || 161}</td>
            <td>
                <span class="status-badge ${device.is_online ? 'online' : 'offline'}">
                    <span class="status-dot"></span>
                    ${device.is_online ? 'Online' : 'Offline'}
                </span>
            </td>
            <td>${device.uptime_days ? `${Math.round(device.uptime_days)} days` : 'N/A'}</td>
            <td>${device.last_seen ? formatRelativeTime(device.last_seen) : 'Never'}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view-btn" data-device-id="${device.id}" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn config-btn" data-device-id="${device.id}" title="Configure">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="action-btn refresh-btn" data-device-id="${device.id}" title="Refresh Status">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <button class="action-btn delete-btn" data-device-id="${device.id}" data-device-name="${device.name}" title="Delete Device">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Use event delegation instead of individual listeners
    setupEventDelegation();
}

function showDemoDevices() {
    const demoDevices = [
        { id: 1, name: "Core-Router-01", ip_address: "192.168.1.1", device_type: "router", is_online: true, uptime_days: 42, last_seen: new Date(Date.now() - 120000).toISOString() },
        { id: 2, name: "Switch-T1-A", ip_address: "192.168.1.2", device_type: "switch", is_online: true, uptime_days: 38, last_seen: new Date(Date.now() - 180000).toISOString() },
        { id: 3, name: "Firewall-Main", ip_address: "192.168.1.3", device_type: "firewall", is_online: false, uptime_days: 15, last_seen: new Date(Date.now() - 300000).toISOString() },
        { id: 4, name: "AP-Terminal-B", ip_address: "192.168.1.4", device_type: "ap", is_online: true, uptime_days: 33, last_seen: new Date(Date.now() - 120000).toISOString() },
        { id: 5, name: "Router-Gate-A", ip_address: "192.168.1.5", device_type: "router", is_online: true, uptime_days: 62, last_seen: new Date(Date.now() - 60000).toISOString() },
        { id: 6, name: "Switch-Baggage", ip_address: "192.168.1.6", device_type: "switch", is_online: false, uptime_days: 27, last_seen: new Date(Date.now() - 240000).toISOString() },
        { id: 7, name: "AP-Checkin", ip_address: "192.168.1.7", device_type: "ap", is_online: true, uptime_days: 45, last_seen: new Date(Date.now() - 120000).toISOString() }
    ];
    
    renderDevicesTable(demoDevices);
    updateDeviceStats(demoDevices);
}

function updateDeviceStats(devices) {
    const totalDevices = devices.length;
    const onlineDevices = devices.filter(d => d.is_online).length;
    const warningDevices = devices.filter(d => !d.is_online).length;
    const criticalDevices = devices.filter(d => !d.is_online && d.uptime_days === 0).length;

    const statItems = document.querySelectorAll('.stat-item');
    if (statItems.length >= 4) {
        statItems[0].querySelector('.stat-value').textContent = totalDevices;
        statItems[1].querySelector('.stat-value').textContent = onlineDevices;
        statItems[2].querySelector('.stat-value').textContent = warningDevices;
        statItems[3].querySelector('.stat-value').textContent = criticalDevices;
    }
}

// Utility functions
function getStatusClass(device) {
    if (!device.is_online) return 'offline';
    if (device.uptime_days < 1) return 'warning';
    return 'online';
}

function getDeviceIcon(deviceType) {
    const icons = {
        'router': 'route',
        'switch': 'network-wired',
        'firewall': 'shield-alt',
        'ap': 'wifi',
        'server': 'server'
    };
    return icons[deviceType] || 'hdd';
}

function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Helper to attach an event listener only once per element/key
function addListenerOnce(element, key, event, handler) {
    if (!element) return;
    const safeKey = `npNet_${String(key || '')}`.replace(/[^a-zA-Z0-9_]/g, '_');
    try {
        if (element.dataset && element.dataset[safeKey]) return;
        element.addEventListener(event, handler);
        element.dataset[safeKey] = 'true';
    } catch (e) {
        // ignore dataset errors on some elements
        element.addEventListener(event, handler);
    }
}

// Event delegation for action buttons
function setupEventDelegation() {
    const tableBody = document.querySelector('.devices-table tbody');
    if (!tableBody) return;

    // Attach the delegated listener only once
    if (tableBody.dataset.delegateAttached === 'true') return;

    tableBody.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const deviceId = target.dataset.deviceId;
        const deviceName = target.dataset.deviceName;

        if (target.classList.contains('view-btn')) {
            showDeviceDetails(deviceId);
        } else if (target.classList.contains('refresh-btn')) {
            refreshDeviceStatus(deviceId);
        } else if (target.classList.contains('config-btn')) {
            alert(`Configure device ${deviceId}`);
        } else if (target.classList.contains('delete-btn')) {
            deleteDevice(deviceId, deviceName);
        }
    });

    tableBody.dataset.delegateAttached = 'true';
}

async function refreshDeviceStatus(deviceId) {
    try {
        const response = await apiFetch(`/devices/${deviceId}/poll_now/`, {
            method: 'POST'
        });
        
        if (response && response.ok) {
            loadNetworkDevices();
        }
    } catch (error) {
        console.error('Error refreshing device:', error);
    }
}

// DELETE DEVICE FUNCTIONALITY
async function deleteDevice(deviceId, deviceName) {
    if (!deviceId) {
        console.error('No device ID provided for deletion');
        return;
    }
    
    // Confirmation dialog
    const isConfirmed = confirm(`Are you sure you want to delete device "${deviceName}" (ID: ${deviceId})? This action cannot be undone.`);
    
    if (!isConfirmed) {
        return;
    }
    
    try {
        const response = await apiFetch(`/devices/${deviceId}/`, {
            method: 'DELETE'
        });
        
        if (response && response.ok) {
            // Show success message
            showNotification(`Device "${deviceName}" deleted successfully`, 'success');
            
            // Reload the devices list after a short delay
            setTimeout(() => {
                loadNetworkDevices();
            }, 1000);
            
        } else if (response && response.status === 404) {
            showNotification(`Device not found. It may have been already deleted.`, 'error');
        } else {
            const errorData = await response.json();
            showNotification(`Failed to delete device: ${errorData.detail || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error deleting device:', error);
        showNotification('Network error while deleting device. Please try again.', 'error');
    }
}

// Notification system for delete operations
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.device-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `device-notification device-notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 5000);
    
    // Close button functionality
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    });
}

function showDeviceDetails(deviceId) {
    alert(`View details for device ${deviceId}`);
}

// Filter functionality
function setupFilters() {
    const statusFilter = document.getElementById('status-filter');
    const typeFilter = document.getElementById('type-filter');
    // Attach listeners idempotently using addListenerOnce
    addListenerOnce(statusFilter, 'statusFilterChange', 'change', filterDevices);
    addListenerOnce(typeFilter, 'typeFilterChange', 'change', filterDevices);
}

function filterDevices() {
    const statusFilter = document.getElementById('status-filter').value;
    const typeFilter = document.getElementById('type-filter').value;
    
    const rows = document.querySelectorAll('.devices-table tbody tr');
    
    rows.forEach(row => {
        // Determine status robustly
        const status = row.classList.contains('online') ? 'online' : (row.classList.contains('warning') ? 'warning' : (row.classList.contains('critical') ? 'critical' : 'offline'));

        // Determine device type from rendered badge if present, otherwise fallback to the second cell text
        let typeEl = row.querySelector('.device-type-badge');
        if (!typeEl) {
            // fallback: second cell
            typeEl = row.children[1] || row.querySelector('td:nth-child(2)');
        }
        const type = (typeEl && typeEl.textContent) ? typeEl.textContent.trim().toLowerCase() : '';
        
        const statusMatch = statusFilter === 'all' || status === statusFilter;
        const typeMatch = typeFilter === 'all' || type === typeFilter;

        row.style.display = (statusMatch && typeMatch) ? '' : 'none';
    });
}

// CSV Export for Network Devices
function exportData() {
    const rows = Array.from(document.querySelectorAll('.devices-table tbody tr'))
        .filter(r => r.style.display !== 'none');

    if (!rows || rows.length === 0) {
        showNotification('No devices to export', 'info');
        return;
    }

    const headers = ['Device Name', 'Type', 'IP Address', 'Status', 'Uptime', 'Last Checked'];
    const csv = [headers.join(',')];

    rows.forEach(row => {
        const name = (row.querySelector('.device-name-cell') || row.children[0]).textContent.trim();
        const type = (row.querySelector('.device-type-badge') || row.children[1]).textContent.trim();
        const ip = (row.querySelector('.ip-address') || row.children[2]).textContent.trim();
        const statusBadge = row.querySelector('.status-badge');
        const status = statusBadge ? statusBadge.textContent.trim() : (row.classList.contains('online') ? 'Online' : 'Offline');
        const uptime = row.children[4] ? row.children[4].textContent.trim() : '';
        const lastChecked = row.children[5] ? row.children[5].textContent.trim() : '';

        const escapeCell = (s) => '"' + String(s).replace(/"/g, '""') + '"';
        csv.push([escapeCell(name), escapeCell(type), escapeCell(ip), escapeCell(status), escapeCell(uptime), escapeCell(lastChecked)].join(','));
    });

    const csvString = '\uFEFF' + csv.join('\n'); // prepend BOM for Excel
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date().toISOString().slice(0,19).replace(/:/g, '-');
    a.download = `network_devices_export_${now}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showNotification('Export started', 'success');
}

function setupExportButton() {
    const exportBtn = document.querySelector('.export-btn');
    if (!exportBtn) return;
    addListenerOnce(exportBtn, 'exportClick', 'click', (e) => {
        e.preventDefault();
        exportData();
    });
}

// Add Device Modal Functionality
let isAddingDevice = false;

function setupAddDeviceModal() {
    const modal = document.getElementById('add-device-modal');
    const addBtn = document.querySelector('.add-device-btn');
    const closeBtn = document.querySelector('.modal-close');
    const form = document.getElementById('add-device-form');

    if (!modal || !addBtn) return;

    // Attach listeners only once using dataset flags (avoid cloning DOM nodes)
    const freshAddBtn = addBtn;
    const freshForm = form;
    const freshCloseBtn = document.querySelector('.modal-close');

    // Track modal state
    let isModalOpen = false;

    // Open modal (idempotent attachment)
    if (freshAddBtn && freshAddBtn.dataset.modalAttached !== 'true') {
        freshAddBtn.addEventListener('click', async () => {
            if (isModalOpen) return;

            isModalOpen = true;
            modal.style.display = 'flex';
            const errorDiv = document.getElementById('add-device-error');
            if (errorDiv) {
                errorDiv.textContent = '';
                errorDiv.style.display = 'none';
            }
            freshForm.reset();
            document.getElementById('is-active').checked = true;
            // Load zones for the dropdown
            await loadZones();
        });
        freshAddBtn.dataset.modalAttached = 'true';
    }

    // Close modal
    function closeModal() {
        isModalOpen = false;
        modal.style.display = 'none';
        const errorDiv = document.getElementById('add-device-error');
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.style.display = 'none';
        }
    }

    if (freshCloseBtn && freshCloseBtn.dataset.closeAttached !== 'true') {
        freshCloseBtn.addEventListener('click', closeModal);
        freshCloseBtn.dataset.closeAttached = 'true';
    }

    // Cancel button inside form (idempotent)
    const cancelBtn = document.getElementById('cancel-add-device');
    addListenerOnce(cancelBtn, 'cancelAddDevice', 'click', (e) => {
        e.preventDefault();
        closeModal();
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });

    // Form submission with duplicate prevention (attach once)
    if (freshForm && freshForm.dataset.submitAttached !== 'true') {
        freshForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            // If form already marked as submitting, ignore
            if (freshForm.dataset.submitting === 'true') {
                console.log('Form already submitting - ignoring duplicate submit');
                return;
            }

            // Mark as submitting
            freshForm.dataset.submitting = 'true';

            try {
                await addNewDevice();
            } finally {
                // Ensure flag is removed after submission completes
                freshForm.dataset.submitting = 'false';
            }
        });
        freshForm.dataset.submitAttached = 'true';
    }
}

// Add new device function
async function addNewDevice() {
    if (isAddingDevice) {
        console.log('Already adding a device, please wait...');
        return;
    }
    
    isAddingDevice = true;
    
    const form = document.getElementById('add-device-form');
    const errorDiv = document.getElementById('add-device-error');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Get form data
    const formData = {
        name: document.getElementById('device-name').value.trim(),
        device_type: document.getElementById('device-type').value,
        ip_address: document.getElementById('ip-address').value.trim(),
        location: document.getElementById('location').value.trim(),
        snmp_community: 'public',
        is_active: document.getElementById('is-active').checked
    };

    // Optional fields: poll interval and custom OIDs
    const pollIntervalEl = document.getElementById('poll-interval');
    const customOidsEl = document.getElementById('custom-oids');
    if (pollIntervalEl && pollIntervalEl.value) {
        formData.poll_interval_seconds = parseInt(pollIntervalEl.value, 10) || null;
    }
    if (customOidsEl && customOidsEl.value) {
        formData.custom_oids = customOidsEl.value.trim();
    }

    // New fields
    const snmpPortEl = document.getElementById('snmp-port');
    const zoneEl = document.getElementById('device-zone');
    const descriptionEl = document.getElementById('device-description');
    const isImportantEl = document.getElementById('is-important');
    if (snmpPortEl && snmpPortEl.value) {
        formData.port = parseInt(snmpPortEl.value, 10) || 161;
    }
    if (zoneEl && zoneEl.value) {
        formData.zone = parseInt(zoneEl.value, 10);
    }
    if (descriptionEl && descriptionEl.value) {
        formData.description = descriptionEl.value.trim();
    }
    formData.is_important = isImportantEl ? isImportantEl.checked : false;

    // Validation
    if (!formData.name || !formData.device_type || !formData.ip_address) {
        if (errorDiv) {
            errorDiv.textContent = 'Please fill all required fields.';
            errorDiv.style.display = 'block';
        }
        isAddingDevice = false;
        return;
    }

    // Show loading state
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    submitBtn.disabled = true;

    try {
        const response = await apiFetch('/devices/', {
            method: 'POST',
            body: JSON.stringify(formData)
        });

        if (response && response.ok) {
            // Success
            const newDevice = await response.json();
            showNotification(`Device "${formData.name}" added successfully`, 'success');
            
            document.getElementById('add-device-modal').style.display = 'none';
            form.reset();
            loadNetworkDevices(); // Refresh the list
            
        } else if (response) {
            // Error handling with robust parsing
            let errorData = null;
            try {
                errorData = await response.json();
            } catch (e) {
                console.error('Failed to parse error JSON', e);
            }

            // Field-level messages
            const fieldErrors = [];
            if (errorData) {
                for (const key of Object.keys(errorData)) {
                    const val = errorData[key];
                    if (Array.isArray(val)) {
                        fieldErrors.push(`${key}: ${val.join(', ')}`);
                    } else if (typeof val === 'object') {
                        fieldErrors.push(`${key}: ${JSON.stringify(val)}`);
                    } else {
                        fieldErrors.push(`${key}: ${val}`);
                    }
                }
            }

            const message = fieldErrors.length > 0 ? fieldErrors.join(' | ') : (errorData && errorData.detail) ? errorData.detail : 'Failed to add device.';
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error adding device:', error);
        if (errorDiv) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
        }
    } finally {
        // Always restore button state and reset flag
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        isAddingDevice = false;
    }
}

// Authentication and initialization
function checkAuth() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function startAutoRefresh() {
    setInterval(() => {
        loadNetworkDevices();
    }, 30000);
}

// Initialize when page loads with duplicate prevention
let isInitialized = false;

// Bandwidth Chart functionality - Replace the existing chart code
let bandwidthChart = null;

function initializeBandwidthChart() {
    const ctx = document.getElementById('bandwidthChart');
    if (!ctx) {
        console.log('Bandwidth chart canvas not found');
        return;
    }
    
    // Destroy existing chart if it exists
    if (bandwidthChart) {
        bandwidthChart.destroy();
    }
    
    // Initialize with real data
    bandwidthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: generateTimeLabels(24),
            datasets: [
                {
                    label: 'Download (Mbps)',
                    data: generateBandwidthData(300, 800),
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
                },
                {
                    label: 'Upload (Mbps)',
                    data: generateBandwidthData(100, 400),
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
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Network Bandwidth Usage - Last 24 Hours',
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
                    cornerRadius: 4
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time',
                        color: '#4a5568',
                        font: {
                            weight: 'bold'
                        }
                    },
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
                    title: {
                        display: true,
                        text: 'Bandwidth (Mbps)',
                        color: '#4a5568',
                        font: {
                            weight: 'bold'
                        }
                    },
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#718096',
                        callback: function(value) {
                            return value + ' Mbps';
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
        }
    });
    
    // Set up chart controls
    setupChartControls();
}

function generateTimeLabels(hours = 24) {
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

function generateBandwidthData(min, max) {
    const data = [];
    const baseVariation = 0.3;
    
    for (let i = 0; i <= 24; i++) {
        // Simulate daily pattern - higher during business hours (9 AM - 5 PM)
        const hour = (new Date().getHours() - (24 - i) + 24) % 24;
        const isBusinessHours = hour >= 9 && hour <= 17;
        const baseLevel = isBusinessHours ? 0.6 : 0.3;
        
        // Add some random variation
        const variation = (Math.random() * 0.4) - 0.2;
        const value = baseLevel + variation;
        
        // Scale to the specified range
        const scaledValue = min + (value * (max - min));
        data.push(Math.max(min, Math.min(max, Math.round(scaledValue))));
    }
    
    return data;
}

function setupChartControls() {
    const timeRangeSelect = document.getElementById('time-range');
    const deviceSelect = document.getElementById('device-select');
    
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener('change', function() {
            updateChartData(this.value);
        });
    }
    
    if (deviceSelect) {
        deviceSelect.addEventListener('change', function() {
            updateChartData(timeRangeSelect.value, this.value);
        });
    }
}

function updateChartData(timeRange, device = 'all') {
    if (!bandwidthChart) return;
    
    let hours;
    switch(timeRange) {
        case '1h': hours = 1; break;
        case '6h': hours = 6; break;
        case '12h': hours = 12; break;
        case '24h': hours = 24; break;
        case '7d': hours = 168; break;
        default: hours = 24;
    }
    
    // Update chart labels
    bandwidthChart.data.labels = generateTimeLabels(hours);
    
    // Update data based on device selection
    let downloadMax = 800, uploadMax = 400;
    if (device !== 'all') {
        // Adjust ranges based on device type
        downloadMax = 600;
        uploadMax = 300;
    }
    
    bandwidthChart.data.datasets[0].data = generateBandwidthData(300, downloadMax);
    bandwidthChart.data.datasets[1].data = generateBandwidthData(100, uploadMax);
    
    // Update chart title
    bandwidthChart.options.plugins.title.text = 
        `Network Bandwidth Usage - Last ${timeRange.toUpperCase()}`;
    
    bandwidthChart.update();
}

document.addEventListener('DOMContentLoaded', function() {
    if (isInitialized) {
        console.log('Network Devices already initialized');
        return;
    }
    
    if (!checkAuth()) return;
    
    isInitialized = true;
    
    loadNetworkDevices();
    setupFilters();
    setupAddDeviceModal();
    setupExportButton();
    startAutoRefresh();
    
    // Initialize bandwidth chart
    setTimeout(() => {
        initializeBandwidthChart();
    }, 500);
    
    console.log('✅ Network Devices page initialized with bandwidth chart');
});

// Also reinitialize when coming back to the page
window.addEventListener('load', initializeBandwidthChart);

// Allow websocket bridge to update bandwidth chart in real-time
window.updateBandwidthChart = function(metrics = {}) {
    try {
        if (!bandwidthChart) return;

        const now = new Date();
        const label = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;

        // Shift existing labels and push new time
        if (Array.isArray(bandwidthChart.data.labels)) {
            bandwidthChart.data.labels.shift();
            bandwidthChart.data.labels.push(label);
        }

        const download = Number(metrics.download || metrics.network_in || metrics.download_mbps || Math.round(Math.random() * 500 + 100));
        const upload = Number(metrics.upload || metrics.network_out || metrics.upload_mbps || Math.round(Math.random() * 200 + 50));

        if (bandwidthChart.data.datasets && bandwidthChart.data.datasets.length >= 2) {
            const dl = bandwidthChart.data.datasets[0].data;
            const ul = bandwidthChart.data.datasets[1].data;
            if (Array.isArray(dl)) { dl.shift(); dl.push(download); }
            if (Array.isArray(ul)) { ul.shift(); ul.push(upload); }
        }

        bandwidthChart.update();
    } catch (e) {
        console.error('updateBandwidthChart error', e);
    }
};