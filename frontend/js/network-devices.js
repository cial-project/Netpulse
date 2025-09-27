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
    
    tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading devices...</td></tr>';

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

function renderDevicesTable(devices) {
    const tableBody = document.querySelector('.devices-table tbody');
    if (!devices || devices.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No devices found. Add some devices to get started.</td></tr>';
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

// Event delegation for action buttons
function setupEventDelegation() {
    // Remove any existing event listeners from the table
    const table = document.querySelector('.devices-table');
    const newTable = table.cloneNode(true);
    table.parentNode.replaceChild(newTable, table);
    
    // Add single event listener to the table body
    document.querySelector('.devices-table tbody').addEventListener('click', (e) => {
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
    
    // Clone to remove existing listeners
    if (statusFilter) {
        const newStatusFilter = statusFilter.cloneNode(true);
        statusFilter.parentNode.replaceChild(newStatusFilter, statusFilter);
        newStatusFilter.addEventListener('change', filterDevices);
    }
    
    if (typeFilter) {
        const newTypeFilter = typeFilter.cloneNode(true);
        typeFilter.parentNode.replaceChild(newTypeFilter, typeFilter);
        newTypeFilter.addEventListener('change', filterDevices);
    }
}

function filterDevices() {
    const statusFilter = document.getElementById('status-filter').value;
    const typeFilter = document.getElementById('type-filter').value;
    
    const rows = document.querySelectorAll('.devices-table tbody tr');
    
    rows.forEach(row => {
        const status = row.classList.contains('online') ? 'online' : 'offline';
        const type = row.querySelector('.device-type-badge').textContent.toLowerCase();
        
        const statusMatch = statusFilter === 'all' || status === statusFilter;
        const typeMatch = typeFilter === 'all' || type === typeFilter;
        
        row.style.display = statusMatch && typeMatch ? '' : 'none';
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

    // Remove any existing event listeners by cloning
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);
    
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    // Get fresh references
    const freshAddBtn = document.querySelector('.add-device-btn');
    const freshForm = document.getElementById('add-device-form');
    const freshCloseBtn = document.querySelector('.modal-close');

    // Track modal state
    let isModalOpen = false;

    // Open modal
    freshAddBtn.addEventListener('click', () => {
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
    });

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

    if (freshCloseBtn) {
        freshCloseBtn.addEventListener('click', closeModal);
    }

    // Close modal when clicking outside
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });

    // Form submission with duplicate prevention
    freshForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        if (isAddingDevice) {
            console.log('Device addition already in progress');
            return;
        }
        
        await addNewDevice();
    });
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
            
        } else {
            // Error handling
            const errorData = await response.json();
            
            if (errorDiv) {
                errorDiv.textContent = errorData.detail || 'Failed to add device.';
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
    startAutoRefresh();
    
    console.log('✅ Network Devices page initialized');
});