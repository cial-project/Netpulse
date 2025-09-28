// Alerts & Incidents Management JavaScript - CORRECTED VERSION
class AlertsManager {
    constructor() {
        this.charts = {};
        this.alerts = [];
        this.filteredAlerts = [];
        this.selectedAlerts = new Set();
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.alertIdCounter = 1000;
        this.init();
    }

    init() {
        this.initializeChart();
        this.loadAlertsData();
        this.setupEventListeners();
        this.updateDateTime();
        this.setupModals(); // Initialize modals once
    }

    initializeChart() {
        const ctx = document.getElementById('alertTrendChart');
        if (!ctx) return;

        this.charts.trends = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Sep 7', 'Sep 8', 'Sep 9', 'Sep 10', 'Sep 11', 'Sep 12', 'Sep 13'],
                datasets: [
                    {
                        label: 'Critical Alerts',
                        data: [12, 9, 11, 11, 13, 14, 15],
                        backgroundColor: '#e53e3e',
                        borderColor: '#c53030',
                        borderWidth: 1
                    },
                    {
                        label: 'Warning Alerts',
                        data: [10, 8, 9, 9, 11, 12, 13],
                        backgroundColor: '#d69e2e',
                        borderColor: '#b7791f',
                        borderWidth: 1
                    },
                    {
                        label: 'Info Alerts',
                        data: [7, 5, 6, 7, 8, 9, 10],
                        backgroundColor: '#3182ce',
                        borderColor: '#2b6cb0',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Alert Trends - Last 7 Days',
                        font: { size: 16, weight: 'bold' },
                        padding: 20
                    },
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(0,0,0,0.1)' }
                    },
                    y: {
                        grid: { color: 'rgba(0,0,0,0.1)' },
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Alerts'
                        }
                    }
                }
            }
        });

        // Add chart time range functionality
        this.setupChartControls();
    }

    setupChartControls() {
        const trendTimeRange = document.getElementById('trend-time-range');
        if (trendTimeRange) {
            trendTimeRange.addEventListener('change', (e) => {
                this.updateTrendChart(e.target.value);
            });
        }
    }

    updateTrendChart(range) {
        if (!this.charts.trends) return;

        let days, title;
        switch(range) {
            case '7d': days = 7; title = 'Last 7 Days'; break;
            case '30d': days = 30; title = 'Last 30 Days'; break;
            case '90d': days = 90; title = 'Last 90 Days'; break;
            default: days = 7; title = 'Last 7 Days';
        }

        // Generate new labels and data
        const labels = this.generateChartLabels(days);
        const newData = this.generateTrendData(days);
        
        this.charts.trends.data.labels = labels;
        this.charts.trends.data.datasets[0].data = newData.critical;
        this.charts.trends.data.datasets[1].data = newData.warning;
        this.charts.trends.data.datasets[2].data = newData.info;
        this.charts.trends.options.plugins.title.text = `Alert Trends - ${title}`;
        this.charts.trends.update();
    }

    generateChartLabels(days) {
        const labels = [];
        const now = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        
        return labels;
    }

    generateTrendData(days) {
        return {
            critical: Array.from({length: days}, () => Math.floor(Math.random() * 20) + 5),
            warning: Array.from({length: days}, () => Math.floor(Math.random() * 15) + 3),
            info: Array.from({length: days}, () => Math.floor(Math.random() * 10) + 1)
        };
    }

    async loadAlertsData() {
        try {
            // Simulated alerts data - MORE COMPREHENSIVE DATA
            this.alerts = [
                { 
                    id: 1, 
                    timestamp: new Date('2023-09-13T13:25:42'), 
                    type: 'Network', 
                    severity: 'critical', 
                    device: 'Switch-T1-A', 
                    description: 'Network switch offline - affecting multiple cameras in Terminal 1',
                    status: 'open',
                    acknowledged: false
                },
                { 
                    id: 2, 
                    timestamp: new Date('2023-09-13T12:48:15'), 
                    type: 'Environmental', 
                    severity: 'critical', 
                    device: 'Gate A5', 
                    description: 'Temperature exceeding threshold (26.3°C)',
                    status: 'in-progress',
                    acknowledged: true
                },
                { 
                    id: 3, 
                    timestamp: new Date('2023-09-13T11:32:58'), 
                    type: 'Security', 
                    severity: 'warning', 
                    device: 'CAM-T1-015', 
                    description: 'Camera offline for 4+ hours',
                    status: 'open',
                    acknowledged: false
                },
                { 
                    id: 4, 
                    timestamp: new Date('2023-09-13T10:15:23'), 
                    type: 'Environmental', 
                    severity: 'warning', 
                    device: 'Control Tower', 
                    description: 'UPS battery below 90% capacity',
                    status: 'open',
                    acknowledged: false
                },
                { 
                    id: 5, 
                    timestamp: new Date('2023-09-13T09:42:10'), 
                    type: 'Fire Safety', 
                    severity: 'warning', 
                    device: 'Extinguisher BP-08', 
                    description: 'Maintenance overdue - last checked Jun 15, 2023',
                    status: 'open',
                    acknowledged: false
                },
                { 
                    id: 6, 
                    timestamp: new Date('2023-09-12T16:30:15'), 
                    type: 'System', 
                    severity: 'info', 
                    device: 'Backup Server', 
                    description: 'Weekly backup completed successfully',
                    status: 'resolved',
                    acknowledged: true
                },
                { 
                    id: 7, 
                    timestamp: new Date('2023-09-12T14:22:33'), 
                    type: 'Network', 
                    severity: 'info', 
                    device: 'Router-Gate-A', 
                    description: 'Scheduled reboot completed',
                    status: 'resolved',
                    acknowledged: true
                },
                { 
                    id: 8, 
                    timestamp: new Date('2023-09-11T08:15:42'), 
                    type: 'Environmental', 
                    severity: 'critical', 
                    device: 'Server Room A', 
                    description: 'Air conditioning unit failure detected',
                    status: 'resolved',
                    acknowledged: true
                }
            ];

            this.alertIdCounter = Math.max(...this.alerts.map(a => a.id)) + 1;
            this.filteredAlerts = [...this.alerts]; // Initialize filtered alerts
            this.renderAlertsTable();
            this.updateStats();

        } catch (error) {
            console.error('Error loading alerts data:', error);
            this.showNotification('Failed to load alerts data', 'error');
        }
    }

    renderAlertsTable() {
        const tbody = document.getElementById('alerts-tbody');
        if (!tbody) return;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const currentAlerts = this.filteredAlerts.slice(startIndex, endIndex);

        if (currentAlerts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="no-alerts">
                        <i class="fas fa-inbox"></i>
                        <div>No alerts found matching your criteria</div>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = currentAlerts.map(alert => `
                <tr class="${alert.severity} ${this.selectedAlerts.has(alert.id) ? 'selected' : ''}">
                    <td>
                        <input type="checkbox" class="alert-checkbox" data-alert-id="${alert.id}" 
                               ${this.selectedAlerts.has(alert.id) ? 'checked' : ''}>
                    </td>
                    <td>
                        ${alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<br>
                        <span class="date">${alert.timestamp.toLocaleDateString()}</span>
                    </td>
                    <td>${alert.type}</td>
                    <td><span class="severity-badge ${alert.severity}">${alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}</span></td>
                    <td>${alert.device}</td>
                    <td class="alert-description">${alert.description}</td>
                    <td><span class="status-badge ${alert.status}">${this.formatStatus(alert.status)}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view-btn" data-alert-id="${alert.id}" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn acknowledge-btn" data-alert-id="${alert.id}" 
                                    ${alert.acknowledged || alert.status === 'resolved' ? 'disabled' : ''}
                                    title="Acknowledge Alert">
                                <i class="fas fa-check-circle"></i>
                            </button>
                            <button class="action-btn resolve-btn" data-alert-id="${alert.id}" 
                                    ${alert.status === 'resolved' ? 'disabled' : ''}
                                    title="Resolve Alert">
                                <i class="fas fa-flag-checkered"></i>
                            </button>
                            <button class="action-btn delete-btn" data-alert-id="${alert.id}" title="Delete Alert">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        this.updatePagination();
        this.updateActionButtons();
    }

    formatStatus(status) {
        return status.replace('-', ' ').split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredAlerts.length / this.itemsPerPage);
        const pageInfo = document.getElementById('page-info');
        const rowsInfo = document.getElementById('rows-info');
        const prevPage = document.getElementById('prev-page');
        const nextPage = document.getElementById('next-page');

        if (pageInfo) pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        if (rowsInfo) rowsInfo.textContent = `Showing ${Math.min(this.itemsPerPage, this.filteredAlerts.length)} of ${this.filteredAlerts.length} alerts`;

        if (prevPage) prevPage.disabled = this.currentPage === 1;
        if (nextPage) nextPage.disabled = this.currentPage === totalPages || totalPages === 0;
    }

    updateStats() {
        const critical = this.filteredAlerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length;
        const warning = this.filteredAlerts.filter(a => a.severity === 'warning' && a.status !== 'resolved').length;
        const info = this.filteredAlerts.filter(a => a.severity === 'info' && a.status !== 'resolved').length;
        const resolvedToday = this.filteredAlerts.filter(a => a.status === 'resolved' && this.isToday(a.timestamp)).length;

        const criticalEl = document.getElementById('critical-alerts');
        const warningEl = document.getElementById('warning-alerts');
        const infoEl = document.getElementById('info-alerts');
        const resolvedEl = document.getElementById('resolved-today');
        const alertCountEl = document.getElementById('alert-count');

        if (criticalEl) criticalEl.textContent = critical;
        if (warningEl) warningEl.textContent = warning;
        if (infoEl) infoEl.textContent = info;
        if (resolvedEl) resolvedEl.textContent = resolvedToday;
        if (alertCountEl) alertCountEl.textContent = critical + warning + info;
    }

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    setupEventListeners() {
        // Pagination
        this.setupPagination();
        
        // Filters
        this.setupFilters();
        
        // Action Buttons
        this.setupActionButtons();
        
        // Selection
        this.setupSelection();
        
        // Refresh insights
        this.setupInsights();
        
        // Enter key support
        this.setupKeyboard();
    }

    setupPagination() {
        const prevPage = document.getElementById('prev-page');
        const nextPage = document.getElementById('next-page');

        if (prevPage) {
            prevPage.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderAlertsTable();
                }
            });
        }

        if (nextPage) {
            nextPage.addEventListener('click', () => {
                if (this.currentPage < Math.ceil(this.filteredAlerts.length / this.itemsPerPage)) {
                    this.currentPage++;
                    this.renderAlertsTable();
                }
            });
        }
    }

    setupFilters() {
        const severityFilter = document.getElementById('severity-filter');
        const statusFilter = document.getElementById('status-filter');
        const typeFilter = document.getElementById('type-filter');
        const dateFilter = document.getElementById('date-filter');
        const alertSearch = document.getElementById('alert-search');
        const clearFilters = document.getElementById('clear-filters');

        // Remove any existing event listeners by cloning elements
        this.replaceElementWithClone(severityFilter);
        this.replaceElementWithClone(statusFilter);
        this.replaceElementWithClone(typeFilter);
        this.replaceElementWithClone(dateFilter);
        this.replaceElementWithClone(alertSearch);
        this.replaceElementWithClone(clearFilters);

        // Add new event listeners
        if (severityFilter) severityFilter.addEventListener('change', () => this.filterAlerts());
        if (statusFilter) statusFilter.addEventListener('change', () => this.filterAlerts());
        if (typeFilter) typeFilter.addEventListener('change', () => this.filterAlerts());
        if (dateFilter) dateFilter.addEventListener('change', () => this.filterAlerts());
        if (alertSearch) alertSearch.addEventListener('input', () => this.filterAlerts());
        if (clearFilters) clearFilters.addEventListener('click', () => this.clearFilters());
    }

    replaceElementWithClone(element) {
        if (!element) return;
        const clone = element.cloneNode(true);
        element.parentNode.replaceChild(clone, element);
    }

    setupActionButtons() {
        // New Incident Button - FIXED
        const newIncidentBtn = document.getElementById('new-incident-btn');
        if (newIncidentBtn) {
            newIncidentBtn.addEventListener('click', () => {
                this.showNewIncidentModal();
            });
        }

        // Bulk Action Buttons
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        const bulkResolveBtn = document.getElementById('bulk-resolve-btn');
        const applyBulkAction = document.getElementById('apply-bulk-action');
        const exportAlerts = document.getElementById('export-alerts');

        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', () => {
                this.deleteSelectedAlerts();
            });
        }

        if (bulkResolveBtn) {
            bulkResolveBtn.addEventListener('click', () => {
                this.resolveSelectedAlerts();
            });
        }

        if (applyBulkAction) {
            applyBulkAction.addEventListener('click', () => {
                this.applyBulkAction();
            });
        }

        if (exportAlerts) {
            exportAlerts.addEventListener('click', () => {
                this.exportAlerts();
            });
        }

        // Individual alert actions - using event delegation
        document.addEventListener('click', (e) => {
            this.handleAlertActions(e);
        });
    }

    handleAlertActions(e) {
        // Individual alert actions
        if (e.target.closest('.view-btn')) {
            const alertId = parseInt(e.target.closest('.view-btn').dataset.alertId);
            this.showAlertDetails(alertId);
            return;
        }

        if (e.target.closest('.acknowledge-btn')) {
            const alertId = parseInt(e.target.closest('.acknowledge-btn').dataset.alertId);
            this.acknowledgeAlert(alertId);
            return;
        }

        if (e.target.closest('.resolve-btn')) {
            const alertId = parseInt(e.target.closest('.resolve-btn').dataset.alertId);
            this.resolveAlert(alertId);
            return;
        }

        if (e.target.closest('.delete-btn')) {
            const alertId = parseInt(e.target.closest('.delete-btn').dataset.alertId);
            this.deleteAlert(alertId);
            return;
        }
    }

    setupSelection() {
        const selectAllAlerts = document.getElementById('select-all-alerts');
        if (selectAllAlerts) {
            selectAllAlerts.addEventListener('change', (e) => {
                this.toggleSelectAllAlerts(e.target.checked);
            });
        }

        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('alert-checkbox')) {
                this.toggleAlertSelection(e.target);
            }
        });
    }

    setupInsights() {
        const refreshInsights = document.getElementById('refresh-insights');
        if (refreshInsights) {
            refreshInsights.addEventListener('click', () => this.refreshAIInsights());
        }
    }

    setupKeyboard() {
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.closest('#new-incident-form')) {
                e.preventDefault();
                this.saveNewIncident();
            }
        });
    }

    filterAlerts() {
        const severityFilter = document.getElementById('severity-filter')?.value || 'all';
        const statusFilter = document.getElementById('status-filter')?.value || 'all';
        const typeFilter = document.getElementById('type-filter')?.value || 'all';
        const dateFilter = document.getElementById('date-filter')?.value || '7d';
        const searchTerm = document.getElementById('alert-search')?.value.toLowerCase() || '';

        console.log('Filtering alerts with:', { severityFilter, statusFilter, typeFilter, dateFilter, searchTerm });

        // Start with all alerts
        let filteredAlerts = [...this.alerts];

        // Apply filters
        if (severityFilter !== 'all') {
            filteredAlerts = filteredAlerts.filter(alert => alert.severity === severityFilter);
        }

        if (statusFilter !== 'all') {
            filteredAlerts = filteredAlerts.filter(alert => alert.status === statusFilter);
        }

        if (typeFilter !== 'all') {
            filteredAlerts = filteredAlerts.filter(alert => alert.type === typeFilter);
        }

        if (dateFilter !== 'all') {
            filteredAlerts = this.filterByDate(filteredAlerts, dateFilter);
        }

        if (searchTerm) {
            filteredAlerts = filteredAlerts.filter(alert => 
                alert.description.toLowerCase().includes(searchTerm) ||
                alert.device.toLowerCase().includes(searchTerm) ||
                alert.type.toLowerCase().includes(searchTerm)
            );
        }

        this.filteredAlerts = filteredAlerts;
        this.currentPage = 1;
        this.selectedAlerts.clear();
        this.renderAlertsTable();
        this.updateStats();
    }

    filterByDate(alerts, dateFilter) {
        const now = new Date();
        switch(dateFilter) {
            case 'today':
                return alerts.filter(alert => this.isToday(alert.timestamp));
            case '24h':
                const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                return alerts.filter(alert => alert.timestamp > yesterday);
            case '7d':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return alerts.filter(alert => alert.timestamp > weekAgo);
            case '30d':
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                return alerts.filter(alert => alert.timestamp > monthAgo);
            default:
                return alerts;
        }
    }

    clearFilters() {
        const severityFilter = document.getElementById('severity-filter');
        const statusFilter = document.getElementById('status-filter');
        const typeFilter = document.getElementById('type-filter');
        const dateFilter = document.getElementById('date-filter');
        const alertSearch = document.getElementById('alert-search');

        if (severityFilter) severityFilter.value = 'all';
        if (statusFilter) statusFilter.value = 'all';
        if (typeFilter) typeFilter.value = 'all';
        if (dateFilter) dateFilter.value = '7d';
        if (alertSearch) alertSearch.value = '';
        
        this.filterAlerts();
    }

    toggleSelectAllAlerts(selectAll) {
        const currentPageAlerts = this.getCurrentPageAlertIds();
        
        if (selectAll) {
            currentPageAlerts.forEach(id => this.selectedAlerts.add(id));
        } else {
            currentPageAlerts.forEach(id => this.selectedAlerts.delete(id));
        }
        
        this.renderAlertsTable();
        this.updateActionButtons();
    }

    toggleAlertSelection(checkbox) {
        const alertId = parseInt(checkbox.dataset.alertId);
        
        if (checkbox.checked) {
            this.selectedAlerts.add(alertId);
        } else {
            this.selectedAlerts.delete(alertId);
            const selectAllCheckbox = document.getElementById('select-all-alerts');
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
        }
        
        this.updateActionButtons();
    }

    getCurrentPageAlertIds() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return this.filteredAlerts.slice(startIndex, endIndex).map(alert => alert.id);
    }

    updateActionButtons() {
        const deleteBtn = document.getElementById('bulk-delete-btn');
        const resolveBtn = document.getElementById('bulk-resolve-btn');
        const selectAllCheckbox = document.getElementById('select-all-alerts');
        const currentPageAlerts = this.getCurrentPageAlertIds();
        
        // Update select all checkbox state
        if (selectAllCheckbox) {
            const allSelected = currentPageAlerts.length > 0 && 
                               currentPageAlerts.every(id => this.selectedAlerts.has(id));
            selectAllCheckbox.checked = allSelected;
            selectAllCheckbox.indeterminate = !allSelected && currentPageAlerts.some(id => this.selectedAlerts.has(id));
        }
        
        // Update action buttons
        const hasSelection = this.selectedAlerts.size > 0;
        if (deleteBtn) deleteBtn.disabled = !hasSelection;
        if (resolveBtn) resolveBtn.disabled = !hasSelection;
        
        if (deleteBtn) {
            deleteBtn.innerHTML = this.selectedAlerts.size > 1 ? 
                `<i class="fas fa-trash"></i> Delete Selected (${this.selectedAlerts.size})` : 
                '<i class="fas fa-trash"></i> Delete Selected';
        }
            
        if (resolveBtn) {
            resolveBtn.innerHTML = this.selectedAlerts.size > 1 ? 
                `<i class="fas fa-check"></i> Resolve Selected (${this.selectedAlerts.size})` : 
                '<i class="fas fa-check"></i> Resolve Selected';
        }
    }

    setupModals() {
        this.createNewIncidentModal();
        this.createAlertDetailsModal();
        this.setupModalEventListeners();
    }

    createNewIncidentModal() {
        if (document.getElementById('new-incident-modal')) return;

        const modalHtml = `
            <div class="modal-overlay" id="new-incident-modal">
                <div class="modal modal-large">
                    <div class="modal-header">
                        <h3>Create New Incident</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="new-incident-form">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="incident-title">Title *</label>
                                    <input type="text" id="incident-title" required placeholder="Brief description of the incident">
                                </div>
                                <div class="form-group">
                                    <label for="incident-severity">Severity *</label>
                                    <select id="incident-severity" required>
                                        <option value="">Select severity...</option>
                                        <option value="critical">Critical</option>
                                        <option value="warning">Warning</option>
                                        <option value="info">Info</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="incident-type">Type *</label>
                                    <select id="incident-type" required>
                                        <option value="">Select type...</option>
                                        <option value="network">Network</option>
                                        <option value="environmental">Environmental</option>
                                        <option value="security">Security</option>
                                        <option value="system">System</option>
                                        <option value="hardware">Hardware</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="incident-device">Affected Device/Zone</label>
                                    <select id="incident-device">
                                        <option value="">Select device/zone...</option>
                                        <option value="Core-Router-01">Core-Router-01</option>
                                        <option value="Switch-T1-A">Switch-T1-A</option>
                                        <option value="Server Room A">Server Room A</option>
                                        <option value="Control Tower">Control Tower</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="incident-description">Description *</label>
                                <textarea id="incident-description" required rows="4" placeholder="Detailed description of the incident..."></textarea>
                            </div>
                            
                            <div class="form-group">
                                <label for="incident-notes">Additional Notes</label>
                                <textarea id="incident-notes" rows="3" placeholder="Any additional information..."></textarea>
                            </div>
                            
                            <div id="incident-error" class="error-message"></div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn secondary" id="cancel-incident">Cancel</button>
                        <button class="btn primary" id="save-incident">Create Incident</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    createAlertDetailsModal() {
        if (document.getElementById('alert-modal')) return;

        const modalHtml = `
            <div class="modal-overlay" id="alert-modal">
                <div class="modal modal-large">
                    <div class="modal-header">
                        <h3 id="modal-title">Alert Details</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="alert-details" id="alert-details"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn secondary" id="close-modal">Close</button>
                        <button class="btn warning" id="acknowledge-alert">Acknowledge</button>
                        <button class="btn primary" id="resolve-alert">Resolve</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    setupModalEventListeners() {
        // New Incident Modal
        const cancelIncident = document.getElementById('cancel-incident');
        const saveIncident = document.getElementById('save-incident');
        const newIncidentModal = document.getElementById('new-incident-modal');
        const newIncidentClose = newIncidentModal?.querySelector('.modal-close');

        if (cancelIncident) {
            cancelIncident.addEventListener('click', () => this.closeNewIncidentModal());
        }

        if (saveIncident) {
            saveIncident.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveNewIncident();
            });
        }

        if (newIncidentClose) {
            newIncidentClose.addEventListener('click', () => this.closeNewIncidentModal());
        }

        if (newIncidentModal) {
            newIncidentModal.addEventListener('click', (e) => {
                if (e.target === newIncidentModal) {
                    this.closeNewIncidentModal();
                }
            });
        }

        // Alert Details Modal
        const closeModal = document.getElementById('close-modal');
        const acknowledgeAlert = document.getElementById('acknowledge-alert');
        const resolveAlert = document.getElementById('resolve-alert');
        const alertModal = document.getElementById('alert-modal');
        const alertModalClose = alertModal?.querySelector('.modal-close');

        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeAlertModal());
        }

        if (acknowledgeAlert) {
            acknowledgeAlert.addEventListener('click', () => {
                const alertId = parseInt(alertModal.dataset.alertId);
                this.acknowledgeAlert(alertId);
                this.closeAlertModal();
            });
        }

        if (resolveAlert) {
            resolveAlert.addEventListener('click', () => {
                const alertId = parseInt(alertModal.dataset.alertId);
                this.resolveAlert(alertId);
                this.closeAlertModal();
            });
        }

        if (alertModalClose) {
            alertModalClose.addEventListener('click', () => this.closeAlertModal());
        }

        if (alertModal) {
            alertModal.addEventListener('click', (e) => {
                if (e.target === alertModal) {
                    this.closeAlertModal();
                }
            });
        }
    }

    showNewIncidentModal() {
        const modal = document.getElementById('new-incident-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('new-incident-form').reset();
            this.hideError();
        }
    }

    closeNewIncidentModal() {
        const modal = document.getElementById('new-incident-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    saveNewIncident() {
        const title = document.getElementById('incident-title')?.value.trim() || '';
        const severity = document.getElementById('incident-severity')?.value || '';
        const type = document.getElementById('incident-type')?.value || '';
        const device = document.getElementById('incident-device')?.value || '';
        const description = document.getElementById('incident-description')?.value.trim() || '';
        const notes = document.getElementById('incident-notes')?.value.trim() || '';

        console.log('Saving new incident:', { title, severity, type, device, description, notes });

        // Validation
        if (!title || !severity || !type || !description) {
            this.showError('Please fill in all required fields');
            return;
        }

        // Create new incident
        const newAlert = {
            id: this.alertIdCounter++,
            timestamp: new Date(),
            type: type,
            severity: severity,
            device: device || 'N/A',
            description: description,
            status: 'open',
            acknowledged: false,
            notes: notes,
            title: title
        };

        // Add to alerts array
        this.alerts.unshift(newAlert);
        
        // Update filtered alerts
        this.filteredAlerts.unshift(newAlert);
        
        // Close modal
        this.closeNewIncidentModal();
        
        // Show success message
        this.showNotification(`New incident "${title}" created successfully`, 'success');
        
        // Refresh table
        this.currentPage = 1;
        this.renderAlertsTable();
        this.updateStats();
    }

    deleteSelectedAlerts() {
        if (this.selectedAlerts.size === 0) return;

        const selectedCount = this.selectedAlerts.size;
        const alertDescriptions = this.alerts
            .filter(alert => this.selectedAlerts.has(alert.id))
            .map(alert => alert.description.substring(0, 50) + '...');

        const message = selectedCount === 1 ?
            `Are you sure you want to delete this alert?` :
            `Are you sure you want to delete ${selectedCount} selected alerts?`;

        if (!confirm(message + '\n\nThis action cannot be undone.')) {
            return;
        }

        // Delete alerts from both arrays
        this.alerts = this.alerts.filter(alert => !this.selectedAlerts.has(alert.id));
        this.filteredAlerts = this.filteredAlerts.filter(alert => !this.selectedAlerts.has(alert.id));
        
        // Show success message with stored count
        this.showNotification(`Deleted ${selectedCount} alert${selectedCount > 1 ? 's' : ''} successfully`, 'success');
        
        this.selectedAlerts.clear();
        this.currentPage = 1;
        this.renderAlertsTable();
        this.updateStats();
    }

    resolveSelectedAlerts() {
        if (this.selectedAlerts.size === 0) return;

        const selectedCount = this.selectedAlerts.size;

        this.alerts.forEach(alert => {
            if (this.selectedAlerts.has(alert.id)) {
                alert.status = 'resolved';
                alert.acknowledged = true;
            }
        });

        this.filteredAlerts.forEach(alert => {
            if (this.selectedAlerts.has(alert.id)) {
                alert.status = 'resolved';
                alert.acknowledged = true;
            }
        });

        this.showNotification(`Resolved ${selectedCount} alert${selectedCount > 1 ? 's' : ''} successfully`, 'success');

        this.selectedAlerts.clear();
        this.renderAlertsTable();
        this.updateStats();
    }

    applyBulkAction() {
        const actionSelect = document.getElementById('bulk-action');
        const action = actionSelect?.value || '';
        
        if (!action || this.selectedAlerts.size === 0) return;

        switch(action) {
            case 'resolve':
                this.resolveSelectedAlerts();
                break;
            case 'acknowledge':
                this.acknowledgeSelectedAlerts();
                break;
            case 'delete':
                this.deleteSelectedAlerts();
                break;
        }

        if (actionSelect) actionSelect.value = '';
    }

    acknowledgeSelectedAlerts() {
        const selectedCount = this.selectedAlerts.size;

        this.alerts.forEach(alert => {
            if (this.selectedAlerts.has(alert.id)) {
                alert.acknowledged = true;
                if (alert.status === 'open') {
                    alert.status = 'in-progress';
                }
            }
        });

        this.filteredAlerts.forEach(alert => {
            if (this.selectedAlerts.has(alert.id)) {
                alert.acknowledged = true;
                if (alert.status === 'open') {
                    alert.status = 'in-progress';
                }
            }
        });

        this.showNotification(`Acknowledged ${selectedCount} alert${selectedCount > 1 ? 's' : ''}`, 'success');

        this.selectedAlerts.clear();
        this.renderAlertsTable();
        this.updateStats();
    }

    showAlertDetails(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) return;

        const modal = document.getElementById('alert-modal');
        const modalTitle = document.getElementById('modal-title');
        const alertDetails = document.getElementById('alert-details');

        // Store alert ID in modal for button handlers
        modal.dataset.alertId = alertId;
        
        if (modalTitle) modalTitle.textContent = `Alert Details: ${alert.type} Issue`;
        
        if (alertDetails) {
            alertDetails.innerHTML = `
                <div class="detail-row">
                    <span class="detail-label">Timestamp:</span>
                    <span class="detail-value">${alert.timestamp.toLocaleString()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Severity:</span>
                    <span class="detail-value"><span class="severity-badge ${alert.severity}">${alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}</span></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">${alert.type}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Device/Zone:</span>
                    <span class="detail-value">${alert.device}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value"><span class="status-badge ${alert.status}">${this.formatStatus(alert.status)}</span></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Acknowledged:</span>
                    <span class="detail-value">${alert.acknowledged ? 'Yes' : 'No'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${alert.description}</span>
                </div>
                ${alert.notes ? `
                <div class="detail-row">
                    <span class="detail-label">Notes:</span>
                    <span class="detail-value">${alert.notes}</span>
                </div>
                ` : ''}
            `;
        }

        // Update modal buttons state
        const acknowledgeBtn = document.getElementById('acknowledge-alert');
        const resolveBtn = document.getElementById('resolve-alert');

        if (acknowledgeBtn) acknowledgeBtn.disabled = alert.acknowledged || alert.status === 'resolved';
        if (resolveBtn) resolveBtn.disabled = alert.status === 'resolved';

        if (modal) modal.style.display = 'flex';
    }

    closeAlertModal() {
        const modal = document.getElementById('alert-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    acknowledgeAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            if (alert.status === 'open') {
                alert.status = 'in-progress';
            }
            this.showNotification('Alert acknowledged successfully', 'success');
            this.renderAlertsTable();
            this.updateStats();
        }
    }

    resolveAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.status = 'resolved';
            alert.acknowledged = true;
            this.showNotification('Alert resolved successfully', 'success');
            this.renderAlertsTable();
            this.updateStats();
        }
    }

    deleteAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) return;

        if (!confirm(`Are you sure you want to delete this alert?\n\n"${alert.description.substring(0, 50)}..."\n\nThis action cannot be undone.`)) {
            return;
        }

        this.alerts = this.alerts.filter(a => a.id !== alertId);
        this.filteredAlerts = this.filteredAlerts.filter(a => a.id !== alertId);
        this.selectedAlerts.delete(alertId);
        
        this.showNotification('Alert deleted successfully', 'success');
        this.renderAlertsTable();
        this.updateStats();
    }

    exportAlerts() {
        const csvContent = this.convertToCSV(this.filteredAlerts);
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alerts-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showNotification('Alerts exported successfully', 'success');
    }

    convertToCSV(alerts) {
        const headers = ['Timestamp', 'Type', 'Severity', 'Device', 'Description', 'Status', 'Acknowledged'];
        const rows = alerts.map(alert => [
            alert.timestamp.toISOString(),
            alert.type,
            alert.severity,
            alert.device,
            `"${alert.description.replace(/"/g, '""')}"`,
            alert.status,
            alert.acknowledged ? 'Yes' : 'No'
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    refreshAIInsights() {
        const insights = [
            "Multiple temperature alerts in Terminal 1 may be related to HVAC system issue.",
            "Network device failures appear to be clustered around Switch-T1-A.",
            "Critical alerts have increased by 25% compared to last week.",
            "Most unresolved alerts are related to environmental monitoring.",
            "Alert response time has improved by 15% this month."
        ];
        
        const randomInsight = insights[Math.floor(Math.random() * insights.length)];
        const insightText = document.getElementById('ai-insight-text');
        if (insightText) insightText.textContent = randomInsight;

        // Show refresh animation
        const btn = document.getElementById('refresh-insights');
        if (btn) {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                btn.innerHTML = originalHtml;
            }, 1000);
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('incident-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    hideError() {
        const errorDiv = document.getElementById('incident-error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        });

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    updateDateTime() {
        const now = new Date();
        const dateElement = document.getElementById('current-date');
        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    new AlertsManager();
});