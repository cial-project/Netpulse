// reports.js
class ReportsManager {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 3;
        this.selectedReports = new Set();
        this.initializeEventListeners();
        this.initializeCharts();
        this.updateStats();
    }

    initializeEventListeners() {
        // Report generation
        document.getElementById('generate-report').addEventListener('click', () => {
            this.generateReport();
        });

        document.getElementById('preview-report').addEventListener('click', () => {
            this.previewReport();
        });

        document.getElementById('quick-report').addEventListener('click', () => {
            this.generateQuickReport();
        });

        document.getElementById('schedule-report').addEventListener('click', () => {
            this.scheduleReport();
        });

        document.getElementById('close-preview').addEventListener('click', () => {
            this.closePreview();
        });

        // Table interactions
        document.getElementById('select-all-reports').addEventListener('change', (e) => {
            this.toggleSelectAllReports(e.target.checked);
        });

        document.getElementById('apply-bulk-action').addEventListener('click', () => {
            this.applyBulkAction();
        });

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => {
            this.previousPage();
        });

        document.getElementById('next-page').addEventListener('click', () => {
            this.nextPage();
        });

        // Search and filters
        document.getElementById('search-reports').addEventListener('input', (e) => {
            this.searchReports(e.target.value);
        });

        document.getElementById('report-status-filter').addEventListener('change', (e) => {
            this.filterReports();
        });

        document.getElementById('report-type-filter').addEventListener('change', (e) => {
            this.filterReports();
        });

        // Action buttons
        this.initializeActionButtons();
        
        // Update current date
        this.updateCurrentDate();
    }

    initializeCharts() {
        // Initialize preview charts (will be shown when preview is opened)
        this.previewCharts = {};
    }

    initializeActionButtons() {
        // Delegated event listeners for dynamic content
        document.addEventListener('click', (e) => {
            const target = e.target.closest('.action-btn');
            if (!target) return;

            const row = target.closest('tr');
            const reportId = row?.dataset?.reportId;

            if (target.classList.contains('download-btn')) {
                this.downloadReport(reportId);
            } else if (target.classList.contains('view-btn')) {
                this.viewReport(reportId);
            } else if (target.classList.contains('share-btn')) {
                this.shareReport(reportId);
            } else if (target.classList.contains('delete-btn')) {
                this.deleteReport(reportId);
            } else if (target.classList.contains('retry-btn')) {
                this.retryReport(reportId);
            } else if (target.classList.contains('edit-btn')) {
                this.editSchedule(reportId);
            }
        });

        // Checkbox changes
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('report-checkbox')) {
                this.toggleReportSelection(e.target);
            }
        });
    }

    generateReport() {
        const template = document.getElementById('report-template').value;
        const title = document.getElementById('report-title').value;
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;
        const format = document.getElementById('report-format').value;

        if (!template || !title) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Show loading state
        const generateBtn = document.getElementById('generate-report');
        const originalText = generateBtn.innerHTML;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        generateBtn.disabled = true;

        // Simulate report generation
        setTimeout(() => {
            this.showNotification('Report generated successfully!', 'success');
            this.addNewReportToTable({
                title: title,
                type: template,
                period: `${this.formatDate(dateFrom)} - ${this.formatDate(dateTo)}`,
                format: format,
                size: this.generateFileSize(),
                status: 'completed'
            });
            
            // Reset button
            generateBtn.innerHTML = originalText;
            generateBtn.disabled = false;
            
            // Update stats
            this.updateStats();
        }, 2000);
    }

    generateQuickReport() {
        const quickTemplates = [
            { title: 'Last 24 Hours Summary', template: 'daily-summary', days: 1 },
            { title: 'Weekly Performance Review', template: 'weekly-performance', days: 7 },
            { title: 'Monthly Audit Report', template: 'monthly-audit', days: 30 }
        ];

        const randomTemplate = quickTemplates[Math.floor(Math.random() * quickTemplates.length)];
        
        // Set form values
        document.getElementById('report-template').value = randomTemplate.template;
        document.getElementById('report-title').value = randomTemplate.title;
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - randomTemplate.days);
        
        document.getElementById('date-from').value = startDate.toISOString().split('T')[0];
        document.getElementById('date-to').value = endDate.toISOString().split('T')[0];
        
        this.showNotification(`Quick report template "${randomTemplate.title}" loaded`, 'info');
    }

    previewReport() {
        const previewSection = document.getElementById('preview-section');
        const template = document.getElementById('report-template').value;
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;

        if (!template) {
            this.showNotification('Please select a report template first', 'error');
            return;
        }

        // Update preview content
        document.getElementById('preview-period').textContent = 
            `${this.formatDate(dateFrom)} - ${this.formatDate(dateTo)}`;
        
        // Generate random preview data
        document.getElementById('preview-devices').textContent = 
            Math.floor(Math.random() * 20) + 30;
        document.getElementById('preview-alerts').textContent = 
            Math.floor(Math.random() * 100) + 100;
        document.getElementById('preview-uptime').textContent = 
            (95 + Math.random() * 4).toFixed(1) + '%';

        // Show preview charts
        this.initializePreviewCharts();

        // Show preview section
        previewSection.style.display = 'block';
        previewSection.scrollIntoView({ behavior: 'smooth' });
    }

    initializePreviewCharts() {
        const ctx1 = document.getElementById('previewChart1');
        const ctx2 = document.getElementById('previewChart2');

        if (ctx1 && !this.previewCharts.chart1) {
            this.previewCharts.chart1 = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Network Usage (Mbps)',
                        data: [450, 520, 480, 610, 550, 320, 280],
                        backgroundColor: 'rgba(49, 130, 206, 0.8)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        }

        if (ctx2 && !this.previewCharts.chart2) {
            this.previewCharts.chart2 = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Critical', 'Warning', 'Info', 'Resolved'],
                    datasets: [{
                        data: [12, 25, 45, 120],
                        backgroundColor: [
                            '#e53e3e',
                            '#d69e2e',
                            '#3182ce',
                            '#38a169'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }
    }

    closePreview() {
        document.getElementById('preview-section').style.display = 'none';
    }

    scheduleReport() {
        const template = document.getElementById('report-template').value;
        const title = document.getElementById('report-title').value;

        if (!template || !title) {
            this.showNotification('Please fill in report template and title', 'error');
            return;
        }

        this.showNotification('Report schedule created successfully!', 'success');
        
        // In a real app, this would save to backend
        console.log('Scheduling report:', { template, title });
    }

    downloadReport(reportId) {
        this.showNotification('Downloading report...', 'info');
        // Simulate download
        setTimeout(() => {
            this.showNotification('Report downloaded successfully!', 'success');
        }, 1000);
    }

    viewReport(reportId) {
        this.showNotification('Opening report viewer...', 'info');
        // In real app, this would open a report viewer modal
    }

    shareReport(reportId) {
        this.showNotification('Share options opened...', 'info');
        // In real app, this would open share dialog
    }

    deleteReport(reportId) {
        if (confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
            const row = document.querySelector(`tr[data-report-id="${reportId}"]`);
            if (row) {
                row.style.opacity = '0.5';
                setTimeout(() => {
                    row.remove();
                    this.updateStats();
                    this.showNotification('Report deleted successfully', 'success');
                }, 500);
            }
        }
    }

    retryReport(reportId) {
        this.showNotification('Retrying report generation...', 'info');
        // Simulate retry
        setTimeout(() => {
            this.showNotification('Report generated successfully!', 'success');
            // Update row status
            const row = document.querySelector(`tr[data-report-id="${reportId}"]`);
            if (row) {
                const statusCell = row.querySelector('.status-badge');
                statusCell.textContent = 'Completed';
                statusCell.className = 'status-badge completed';
                
                const actionsCell = row.querySelector('.action-buttons');
                actionsCell.innerHTML = `
                    <button class="action-btn download-btn" title="Download Report">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn view-btn" title="View Report">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn share-btn" title="Share Report">
                        <i class="fas fa-share"></i>
                    </button>
                    <button class="action-btn delete-btn" title="Delete Report">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
            }
        }, 2000);
    }

    editSchedule(scheduleId) {
        this.showNotification('Opening schedule editor...', 'info');
        // In real app, this would open schedule editor
    }

    toggleSelectAllReports(checked) {
        const checkboxes = document.querySelectorAll('.report-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            this.toggleReportSelection(checkbox);
        });
    }

    toggleReportSelection(checkbox) {
        const reportId = checkbox.closest('tr').dataset.reportId;
        if (checkbox.checked) {
            this.selectedReports.add(reportId);
        } else {
            this.selectedReports.delete(reportId);
        }
        
        // Update select all checkbox
        const allCheckboxes = document.querySelectorAll('.report-checkbox');
        const selectAll = document.getElementById('select-all-reports');
        selectAll.checked = allCheckboxes.length > 0 && 
                           Array.from(allCheckboxes).every(cb => cb.checked);
        selectAll.indeterminate = !selectAll.checked && 
                                Array.from(allCheckboxes).some(cb => cb.checked);
    }

    applyBulkAction() {
        const action = document.getElementById('bulk-action').value;
        if (!action) {
            this.showNotification('Please select a bulk action', 'error');
            return;
        }

        if (this.selectedReports.size === 0) {
            this.showNotification('Please select reports to perform bulk action', 'error');
            return;
        }

        switch (action) {
            case 'download':
                this.showNotification(`Downloading ${this.selectedReports.size} reports...`, 'info');
                break;
            case 'delete':
                if (confirm(`Are you sure you want to delete ${this.selectedReports.size} reports?`)) {
                    this.showNotification(`Deleting ${this.selectedReports.size} reports...`, 'info');
                    // In real app, delete selected reports
                }
                break;
            case 'share':
                this.showNotification(`Sharing ${this.selectedReports.size} reports...`, 'info');
                break;
        }

        // Clear selection
        this.selectedReports.clear();
        document.querySelectorAll('.report-checkbox').forEach(cb => cb.checked = false);
        document.getElementById('select-all-reports').checked = false;
        document.getElementById('bulk-action').value = '';
    }

    searchReports(query) {
        const rows = document.querySelectorAll('#reports-table-body tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
        });
    }

    filterReports() {
        const statusFilter = document.getElementById('report-status-filter').value;
        const typeFilter = document.getElementById('report-type-filter').value;
        
        const rows = document.querySelectorAll('#reports-table-body tr');
        rows.forEach(row => {
            const status = row.querySelector('.status-badge').textContent.toLowerCase();
            const type = row.querySelector('.report-type-badge').textContent.toLowerCase();
            
            const statusMatch = statusFilter === 'all' || status.includes(statusFilter);
            const typeMatch = typeFilter === 'all' || type.includes(typeFilter);
            
            row.style.display = statusMatch && typeMatch ? '' : 'none';
        });
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updatePagination();
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.updatePagination();
        }
    }

    updatePagination() {
        document.querySelector('.page-number').textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        document.getElementById('prev-page').disabled = this.currentPage === 1;
        document.getElementById('next-page').disabled = this.currentPage === this.totalPages;
        
        // In real app, this would fetch new page data
        this.showNotification(`Loading page ${this.currentPage}...`, 'info');
    }

    addNewReportToTable(report) {
        const tbody = document.getElementById('reports-table-body');
        const newRow = document.createElement('tr');
        newRow.dataset.reportId = Date.now().toString();
        
        const fileIcon = report.format === 'excel' ? 'fa-file-excel' : 
                        report.format === 'pdf' ? 'fa-file-pdf' : 'fa-file-alt';
        
        const fileColor = report.format === 'excel' ? '#28a745' : 
                         report.format === 'pdf' ? '#dc3545' : '#3182ce';
        
        newRow.innerHTML = `
            <td class="select-col">
                <input type="checkbox" class="report-checkbox">
            </td>
            <td>
                <div class="report-name-cell">
                    <i class="fas ${fileIcon}" style="color: ${fileColor}"></i>
                    <div>
                        <div class="report-title">${report.title}</div>
                        <div class="report-period">${report.period}</div>
                    </div>
                </div>
            </td>
            <td><span class="report-type-badge ${report.type.split('-')[0]}">${this.formatReportType(report.type)}</span></td>
            <td>${new Date().toLocaleDateString()}<br><span class="report-time">${new Date().toLocaleTimeString()}</span></td>
            <td>User</td>
            <td>${report.size}</td>
            <td><span class="status-badge ${report.status}">${report.status.charAt(0).toUpperCase() + report.status.slice(1)}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn download-btn" title="Download Report">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn view-btn" title="View Report">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn share-btn" title="Share Report">
                        <i class="fas fa-share"></i>
                    </button>
                    <button class="action-btn delete-btn" title="Delete Report">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.insertBefore(newRow, tbody.firstChild);
    }

    updateStats() {
        const rows = document.querySelectorAll('#reports-table-body tr');
        const total = rows.length;
        const completed = Array.from(rows).filter(row => 
            row.querySelector('.status-badge').classList.contains('completed')
        ).length;
        const pending = Array.from(rows).filter(row => 
            row.querySelector('.status-badge').classList.contains('pending')
        ).length;
        const failed = Array.from(rows).filter(row => 
            row.querySelector('.status-badge').classList.contains('failed')
        ).length;

        document.getElementById('total-reports').textContent = total;
        document.getElementById('completed-reports').textContent = completed;
        document.getElementById('pending-reports').textContent = pending;
        document.getElementById('failed-reports').textContent = failed;
    }

    updateCurrentDate() {
        document.getElementById('current-date').textContent = 
            new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    formatReportType(type) {
        const types = {
            'daily-summary': 'Summary',
            'weekly-performance': 'Performance',
            'monthly-audit': 'Audit',
            'incident-analysis': 'Incidents',
            'capacity-planning': 'Capacity',
            'custom': 'Custom'
        };
        return types[type] || type;
    }

    generateFileSize() {
        const sizes = ['1.2 MB', '2.4 MB', '3.7 MB', '5.1 MB', '1.8 MB', '4.3 MB'];
        return sizes[Math.floor(Math.random() * sizes.length)];
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        // Add styles if not already added
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 1000;
                    transform: translateX(400px);
                    transition: transform 0.3s ease;
                    max-width: 400px;
                }
                .notification.show {
                    transform: translateX(0);
                }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1rem 1.25rem;
                }
                .notification-close {
                    background: none;
                    border: none;
                    font-size: 1.25rem;
                    cursor: pointer;
                    color: #6c757d;
                    margin-left: auto;
                }
                .notification-info { border-left: 4px solid #3182ce; }
                .notification-success { border-left: 4px solid #28a745; }
                .notification-error { border-left: 4px solid #dc3545; }
                .notification-warning { border-left: 4px solid #ffc107; }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        });
    }

    getNotificationIcon(type) {
        const icons = {
            'info': 'info-circle',
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle'
        };
        return icons[type] || 'info-circle';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.reportsManager = new ReportsManager();
});