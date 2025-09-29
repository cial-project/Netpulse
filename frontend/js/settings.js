// settings.js
class SettingsManager {
    constructor() {
        this.currentTab = 'general';
        this.unsavedChanges = false;
        this.initializeEventListeners();
        this.loadSettings();
        this.updateCurrentDate();
    }

    initializeEventListeners() {
        // Tab navigation - with null check
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                if (tabName) {
                    this.switchTab(tabName);
                }
            });
        });

        // Form changes - only bind to existing elements
        const formElements = document.querySelectorAll('input, select, textarea');
        if (formElements.length > 0) {
            formElements.forEach(element => {
                element.addEventListener('change', () => {
                    this.unsavedChanges = true;
                    this.updateSaveButton();
                });
            });
        }

        // Save and reset - with null checks
        const saveBtn = document.getElementById('save-settings');
        const resetBtn = document.getElementById('reset-settings');
        const cancelBtn = document.getElementById('cancel-changes');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetSettings();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.cancelChanges();
            });
        }

        // Search functionality
        const searchInput = document.getElementById('search-settings');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchSettings(e.target.value);
            });
        }

        // Backup operations
        const backupBtn = document.getElementById('backup-now');
        const restoreBtn = document.getElementById('restore-backup');
        const exportBtn = document.getElementById('export-config');

        if (backupBtn) {
            backupBtn.addEventListener('click', () => {
                this.createBackup();
            });
        }

        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => {
                this.restoreBackup();
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportConfiguration();
            });
        }

        // User management
        const addUserBtn = document.getElementById('add-user');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                this.addUser();
            });
        }

        // Toggle switches
        document.querySelectorAll('.toggle-switch input').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                this.toggleChannel(e.target);
            });
        });

        // Action buttons
        this.initializeActionButtons();
    }

    switchTab(tabName) {
        // Update navigation - with null checks
        const navButtons = document.querySelectorAll('.nav-btn');
        const targetNavButton = document.querySelector(`[data-tab="${tabName}"]`);
        const targetTab = document.getElementById(`${tabName}-tab`);

        // Check if elements exist before manipulating them
        if (!targetNavButton || !targetTab) {
            console.error(`Tab elements not found for: ${tabName}`);
            return;
        }

        // Remove active class from all nav buttons
        navButtons.forEach(btn => {
            if (btn && btn.classList) {
                btn.classList.remove('active');
            }
        });

        // Add active class to target nav button
        targetNavButton.classList.add('active');

        // Hide all tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            if (tab && tab.classList) {
                tab.classList.remove('active');
            }
        });

        // Show target tab
        targetTab.classList.add('active');

        this.currentTab = tabName;
        
        // Scroll to top of settings content
        const settingsContent = document.querySelector('.settings-content');
        if (settingsContent) {
            settingsContent.scrollTop = 0;
        }
    }

    loadSettings() {
        // Load settings from localStorage or use defaults
        try {
            const savedSettings = localStorage.getItem('netpulse-settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                this.applySettings(settings);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
        
        this.unsavedChanges = false;
        this.updateSaveButton();
    }

    applySettings(settings) {
        // Apply settings to form elements with null checks
        Object.keys(settings).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                try {
                    if (element.type === 'checkbox') {
                        element.checked = settings[key];
                    } else {
                        element.value = settings[key];
                    }
                } catch (error) {
                    console.error(`Error applying setting for ${key}:`, error);
                }
            }
        });
    }

    saveSettings() {
        const settings = this.collectSettings();
        
        // Show loading state - with null check
        const saveBtn = document.getElementById('save-settings');
        if (!saveBtn) return;

        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        saveBtn.disabled = true;

        // Simulate API call
        setTimeout(() => {
            try {
                // Save to localStorage (in real app, this would be an API call)
                localStorage.setItem('netpulse-settings', JSON.stringify(settings));
                
                this.unsavedChanges = false;
                this.updateSaveButton();
                
                // Show success message
                this.showNotification('Settings saved successfully!', 'success');
            } catch (error) {
                console.error('Error saving settings:', error);
                this.showNotification('Error saving settings', 'error');
            } finally {
                // Restore button
                saveBtn.innerHTML = originalText;
                saveBtn.disabled = false;
            }
        }, 1000);
    }

    collectSettings() {
        const settings = {};
        
        // Collect all form values with null checks
        document.querySelectorAll('input, select, textarea').forEach(element => {
            if (element && element.id) {
                try {
                    if (element.type === 'checkbox') {
                        settings[element.id] = element.checked;
                    } else if (element.type === 'number') {
                        settings[element.id] = parseFloat(element.value) || 0;
                    } else {
                        settings[element.id] = element.value;
                    }
                } catch (error) {
                    console.error(`Error collecting setting for ${element.id}:`, error);
                }
            }
        });

        return settings;
    }

    resetSettings() {
        if (confirm('Are you sure you want to reset all settings to their default values? This action cannot be undone.')) {
            try {
                // Clear saved settings
                localStorage.removeItem('netpulse-settings');
                
                // Reload page to reset form values
                location.reload();
            } catch (error) {
                console.error('Error resetting settings:', error);
                this.showNotification('Error resetting settings', 'error');
            }
        }
    }

    cancelChanges() {
        if (this.unsavedChanges) {
            if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
                this.loadSettings();
            }
        }
    }

    updateSaveButton() {
        const saveBtn = document.getElementById('save-settings');
        if (!saveBtn) return;

        if (this.unsavedChanges) {
            saveBtn.disabled = false;
            saveBtn.classList.add('primary');
        } else {
            saveBtn.disabled = true;
            saveBtn.classList.remove('primary');
        }
    }

    searchSettings(query) {
        const searchTerm = query.toLowerCase();
        const sections = document.querySelectorAll('.settings-section');
        let foundResults = false;
        
        sections.forEach(section => {
            if (!section) return;
            
            const sectionText = section.textContent.toLowerCase();
            if (sectionText.includes(searchTerm)) {
                section.style.display = 'block';
                foundResults = true;
                
                // Highlight matching elements
                this.highlightMatches(section, searchTerm);
            } else {
                section.style.display = 'none';
            }
        });

        // Show no results message if needed
        this.toggleNoResultsMessage(!foundResults && searchTerm.length > 0);
    }

    toggleNoResultsMessage(show) {
        let noResultsMsg = document.getElementById('no-results-message');
        
        if (show && !noResultsMsg) {
            noResultsMsg = document.createElement('div');
            noResultsMsg.id = 'no-results-message';
            noResultsMsg.className = 'no-results';
            noResultsMsg.innerHTML = `
                <i class="fas fa-search"></i>
                <h4>No settings found</h4>
                <p>Try adjusting your search terms</p>
            `;
            
            const settingsContent = document.querySelector('.settings-content');
            if (settingsContent) {
                settingsContent.appendChild(noResultsMsg);
            }
        } else if (!show && noResultsMsg) {
            noResultsMsg.remove();
        }
    }

    highlightMatches(section, searchTerm) {
        if (!section) return;

        // Remove existing highlights
        const existingHighlights = section.querySelectorAll('.highlight');
        existingHighlights.forEach(el => {
            if (el.parentNode) {
                el.parentNode.replaceChild(document.createTextNode(el.textContent), el);
            }
        });

        // Add highlights to matching text
        const walker = document.createTreeWalker(
            section,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        const nodesToReplace = [];

        while (node = walker.nextNode()) {
            if (node.textContent.toLowerCase().includes(searchTerm)) {
                nodesToReplace.push(node);
            }
        }

        nodesToReplace.forEach(node => {
            const span = document.createElement('span');
            span.className = 'highlight';
            
            const regex = new RegExp(searchTerm, 'gi');
            span.innerHTML = node.textContent.replace(regex, match => 
                `<mark style="background: #ffeb3b; padding: 2px 4px; border-radius: 2px;">${match}</mark>`
            );
            
            if (node.parentNode) {
                node.parentNode.replaceChild(span, node);
            }
        });
    }

    createBackup() {
        const backupBtn = document.getElementById('backup-now');
        if (!backupBtn) return;

        const originalText = backupBtn.innerHTML;
        backupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Backup...';
        backupBtn.disabled = true;

        setTimeout(() => {
            try {
                this.showNotification('System backup created successfully!', 'success');
                
                // Add to backup list
                this.addBackupToList({
                    name: 'Manual Backup',
                    date: new Date(),
                    size: '1.2 GB',
                    status: 'success'
                });
            } catch (error) {
                console.error('Error creating backup:', error);
                this.showNotification('Error creating backup', 'error');
            } finally {
                backupBtn.innerHTML = originalText;
                backupBtn.disabled = false;
            }
        }, 2000);
    }

    restoreBackup() {
        this.showNotification('Please select a backup file to restore...', 'info');
        // In real app, this would open a file picker
    }

    exportConfiguration() {
        try {
            const settings = this.collectSettings();
            const dataStr = JSON.stringify(settings, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = 'netpulse-config.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification('Configuration exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting configuration:', error);
            this.showNotification('Error exporting configuration', 'error');
        }
    }

    addUser() {
        this.showNotification('Opening user creation form...', 'info');
        // In real app, this would open a user creation modal
    }

    toggleChannel(toggle) {
        if (!toggle) return;

        const channelCard = toggle.closest('.channel-card');
        if (!channelCard) return;

        const channelSettings = channelCard.querySelector('.channel-settings');
        if (!channelSettings) return;
        
        if (toggle.checked) {
            channelSettings.style.display = 'flex';
            this.showNotification('Notification channel enabled', 'success');
        } else {
            channelSettings.style.display = 'none';
            this.showNotification('Notification channel disabled', 'info');
        }
    }

    initializeActionButtons() {
        // User action buttons
        document.addEventListener('click', (e) => {
            const target = e.target.closest('.action-btn');
            if (!target) return;

            const row = target.closest('tr');
            const userName = row?.querySelector('.user-name')?.textContent;

            if (target.classList.contains('edit-btn')) {
                this.editUser(userName);
            } else if (target.classList.contains('delete-btn')) {
                this.deleteUser(userName);
            }
        });

        // Integration action buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.integration-actions .btn')) {
                const btn = e.target.closest('.btn');
                const integration = btn.closest('.integration-card');
                const integrationName = integration?.querySelector('h4')?.textContent;
                
                if (!integrationName) return;
                
                if (btn.classList.contains('primary')) {
                    this.connectIntegration(integrationName);
                } else if (btn.classList.contains('danger')) {
                    this.disconnectIntegration(integrationName);
                } else if (btn.classList.contains('secondary')) {
                    this.configureIntegration(integrationName);
                }
            }
        });
    }

    editUser(userName) {
        if (!userName) return;
        this.showNotification(`Editing user: ${userName}`, 'info');
        // In real app, this would open user edit modal
    }

    deleteUser(userName) {
        if (!userName) return;
        
        if (confirm(`Are you sure you want to delete user "${userName}"?`)) {
            this.showNotification(`User "${userName}" deleted successfully`, 'success');
            // In real app, this would make API call to delete user
        }
    }

    connectIntegration(integrationName) {
        if (!integrationName) return;
        this.showNotification(`Connecting to ${integrationName}...`, 'info');
        // In real app, this would open OAuth flow or configuration
    }

    disconnectIntegration(integrationName) {
        if (!integrationName) return;
        
        if (confirm(`Are you sure you want to disconnect ${integrationName}?`)) {
            this.showNotification(`${integrationName} disconnected successfully`, 'success');
            // In real app, this would make API call to disconnect
        }
    }

    configureIntegration(integrationName) {
        if (!integrationName) return;
        this.showNotification(`Configuring ${integrationName}...`, 'info');
        // In real app, this would open configuration modal
    }

    addBackupToList(backup) {
        if (!backup) return;
        
        const backupList = document.querySelector('.backup-list');
        if (!backupList) return;

        const backupItem = document.createElement('div');
        backupItem.className = `backup-item ${backup.status}`;
        
        const icon = backup.status === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
        const dateStr = backup.date.toLocaleDateString() + ', ' + backup.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        backupItem.innerHTML = `
            <i class="fas ${icon}"></i>
            <div class="backup-info">
                <div class="backup-name">${backup.name}</div>
                <div class="backup-date">${dateStr}</div>
            </div>
            <div class="backup-size">${backup.size}</div>
        `;
        
        backupList.insertBefore(backupItem, backupList.firstChild);
    }

    updateCurrentDate() {
        const dateElement = document.getElementById('current-date');
        if (dateElement) {
            dateElement.textContent = new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        }
    }

    showNotification(message, type = 'info') {
        if (!message) return;

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
                .no-results {
                    text-align: center;
                    padding: 3rem 2rem;
                    color: #6c757d;
                }
                .no-results i {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                    color: #e9ecef;
                }
                .no-results h4 {
                    margin-bottom: 0.5rem;
                    color: #495057;
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);

        // Close button
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            });
        }
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

// Initialize when page loads with error handling
document.addEventListener('DOMContentLoaded', function() {
    try {
        window.settingsManager = new SettingsManager();
        console.log('Settings manager initialized successfully');
    } catch (error) {
        console.error('Error initializing settings manager:', error);
    }
});