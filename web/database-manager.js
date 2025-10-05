// Database Manager JavaScript
let currentTable = '';
let currentRecord = null;
let currentUser = null;
let redirectTimer = null;
let redirectCountdown = 5;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🗄️ Database Manager initializing...');
    
    // Check authentication first
    const user = await checkAuthentication();
    
    if (user) {
        // User is authenticated and has admin access
        showMainContent();
        initializeEventListeners();
        loadDatabaseOverview();
        updateDatabaseStatus();
    } else {
        // User doesn't have access
        showAccessDenied();
    }
});


// Show main content (user has access)
function showMainContent() {
    const authLoading = document.getElementById('authLoading');
    const accessDenied = document.getElementById('accessDenied');
    const mainContent = document.getElementById('mainContent');
    
    // Clear any existing redirect timer
    if (redirectTimer) {
        clearInterval(redirectTimer);
        redirectTimer = null;
    }
    
    if (authLoading) authLoading.classList.add('hidden');
    if (accessDenied) accessDenied.classList.add('hidden');
    if (mainContent) mainContent.classList.remove('hidden');
}



// Start redirect countdown
function startRedirectCountdown() {
    redirectCountdown = 60;
    updateCountdownDisplay();
    
    redirectTimer = setInterval(() => {
        redirectCountdown--;
        updateCountdownDisplay();
        
        if (redirectCountdown <= 0) {
            clearInterval(redirectTimer);
            window.location.href = '/';
        }
    }, 1000);
}

// Update countdown display
function updateCountdownDisplay() {
    const countdownElement = document.getElementById('redirectCountdown');
    if (countdownElement) {
        countdownElement.textContent = redirectCountdown;
        
        // Add animation effect
        countdownElement.classList.remove('animate-pulse');
        void countdownElement.offsetWidth; // Trigger reflow
        countdownElement.classList.add('animate-pulse');
    }
}

// Cancel redirect (globally available)
window.cancelRedirect = function() {
    if (redirectTimer) {
        clearInterval(redirectTimer);
        redirectTimer = null;
        
        const countdownElement = document.getElementById('redirectCountdown');
        if (countdownElement) {
            countdownElement.textContent = '∞';
            countdownElement.classList.remove('animate-pulse');
        }
        
        // Update button to show redirect was cancelled
        const cancelBtn = event.target.closest('button');
        if (cancelBtn) {
            cancelBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Redirect Cancelled';
            cancelBtn.classList.remove('btn-outline');
            cancelBtn.classList.add('btn-success');
            cancelBtn.disabled = true;
        }
        
        console.log('Auto-redirect cancelled by user');
    }
}

// ============= END AUTHENTICATION FUNCTIONS =============

// Initialize all event listeners
function initializeEventListeners() {
    // Overview refresh
    document.getElementById('refreshOverview').addEventListener('click', loadDatabaseOverview);
    
    // Table selection
    document.getElementById('tableSelect').addEventListener('change', function(e) {
        currentTable = e.target.value;
        if (currentTable) {
            loadTableData(currentTable);
        } else {
            clearTableContent();
        }
    });
    
    // Table actions
    document.getElementById('refreshTable').addEventListener('click', function() {
        if (currentTable) loadTableData(currentTable);
    });
    
    document.getElementById('exportTable').addEventListener('click', function() {
        if (currentTable) exportTable(currentTable);
    });
    
    // Quick actions
    document.getElementById('cleanupOrphans').addEventListener('click', function() {
        confirmAction('Clean up orphaned records? This will remove calorie breakdown records without matching rides.', cleanupOrphanedRecords);
    });
    
    document.getElementById('optimizeDb').addEventListener('click', function() {
        confirmAction('Optimize database? This will rebuild the database file to reduce size.', optimizeDatabase);
    });
    
    document.getElementById('backupDb').addEventListener('click', createBackup);
    document.getElementById('showDbInfo').addEventListener('click', showDatabaseInfo);
    
    // SQL Query interface
    document.getElementById('executeSql').addEventListener('click', executeSqlQuery);
    document.getElementById('clearSql').addEventListener('click', function() {
        document.getElementById('sqlQuery').value = '';
        document.getElementById('sql-result').classList.add('hidden');
    });
    
    // Keyboard shortcuts
    document.getElementById('sqlQuery').addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            executeSqlQuery();
        }
    });
    
    // Modal actions
    document.getElementById('saveEdit').addEventListener('click', saveEditedRecord);
}

// Load database overview statistics
async function loadDatabaseOverview() {
    try {
        console.log('Loading database overview...');
        updateDatabaseStatus('loading', 'Loading...');
        
        const response = await fetch('/api/database/overview');
        
        // Check for authentication errors (server-side validation)
        // Server returns 403/401 if user is not authenticated or not admin
        if (response.status === 403 || response.status === 401) {
            console.error('Server rejected request - authentication/authorization failed');
            showAccessDenied();
            return;
        }
        
        const data = await response.json();
        
        if (response.ok) {
            displayOverview(data);
            updateDatabaseStatus('connected', 'Connected');
        } else {
            throw new Error(data.error || 'Failed to load overview');
        }
    } catch (error) {
        console.error('Error loading database overview:', error);
        updateDatabaseStatus('error', 'Connection failed');
        showMessage('Failed to load database overview: ' + error.message, 'error');
    }
}

// Display database overview
function displayOverview(data) {
    const container = document.getElementById('db-overview');
    container.innerHTML = `
        <div class="stat bg-primary/10 rounded-lg">
            <div class="stat-figure text-primary">
                <i class="fas fa-bicycle text-3xl"></i>
            </div>
            <div class="stat-title">Total Rides</div>
            <div class="stat-value text-primary">${data.totalRides || 0}</div>
            <div class="stat-desc">GPX files processed</div>
        </div>
        
        <div class="stat bg-secondary/10 rounded-lg">
            <div class="stat-figure text-secondary">
                <i class="fas fa-database text-3xl"></i>
            </div>
            <div class="stat-title">Database Size</div>
            <div class="stat-value text-secondary">${formatBytes(data.databaseSize || 0)}</div>
            <div class="stat-desc">Total storage used</div>
        </div>
        
        <div class="stat bg-accent/10 rounded-lg">
            <div class="stat-figure text-accent">
                <i class="fas fa-calendar text-3xl"></i>
            </div>
            <div class="stat-title">Last Modified</div>
            <div class="stat-value text-accent text-sm">${data.lastModified || 'Unknown'}</div>
            <div class="stat-desc">Database file</div>
        </div>
    `;
}

// Load table data
async function loadTableData(tableName) {
    try {
        console.log(`Loading table data for: ${tableName}`);
        showTableLoading();
        
        const response = await fetch(`/api/database/table/${tableName}`);
        
        // Check for authentication errors (server-side validation)
        // Server returns 403/401 if user is not authenticated or not admin
        if (response.status === 403 || response.status === 401) {
            console.error('Server rejected request - authentication/authorization failed');
            showAccessDenied();
            return;
        }
        
        const data = await response.json();
        
        if (response.ok) {
            displayTableData(tableName, data);
        } else {
            throw new Error(data.error || 'Failed to load table data');
        }
    } catch (error) {
        console.error('Error loading table data:', error);
        showMessage('Failed to load table data: ' + error.message, 'error');
        clearTableContent();
    }
}

// Display table data
function displayTableData(tableName, data) {
    const container = document.getElementById('table-content');
    
    if (!data.rows || data.rows.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-base-content/50">
                <i class="fas fa-inbox text-4xl mb-4"></i>
                <p>No records found in ${tableName} table</p>
            </div>
        `;
        return;
    }
    
    const columns = data.columns;
    const rows = data.rows;
    
    let html = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold">${tableName} (${rows.length} records)</h3>
            <button class="btn btn-sm btn-primary" onclick="addNewRecord('${tableName}')">
                <i class="fas fa-plus mr-2"></i>
                Add New
            </button>
        </div>
        
        <div class="table-container">
            <table class="table table-zebra table-pin-rows w-full">
                <thead>
                    <tr>
                        ${columns.map(col => `<th class="text-center">${col}</th>`).join('')}
                        <th class="text-center">Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    rows.forEach((row, index) => {
        html += '<tr>';
        columns.forEach(col => {
            let value = row[col];
            if (value === null) {
                value = '<span class="text-base-content/50 italic">null</span>';
            } else if (col === 'gpx_data' && typeof value === 'string' && value.includes('<i class="fas')) {
                // Allow HTML rendering for GPX data field icons
                value = value;
            } else if (typeof value === 'string' && value.length > 50) {
                value = `<span title="${escapeHtml(value)}">${escapeHtml(value.substring(0, 50))}...</span>`;
            } else {
                value = escapeHtml(String(value));
            }
            html += `<td class="text-center">${value}</td>`;
        });
        
        html += `
            <td class="text-center">
                <div class="flex gap-1 justify-center">
                    <button class="btn btn-xs btn-outline" onclick="editRecord('${tableName}', ${index})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-xs btn-outline btn-error" onclick="deleteRecord('${tableName}', '${row.id || row[columns[0]]}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Store current data for editing
    window.currentTableData = { tableName, columns, rows };
}

// Edit record
function editRecord(tableName, rowIndex) {
    const data = window.currentTableData;
    if (!data || data.tableName !== tableName) {
        showMessage('Table data not available for editing', 'error');
        return;
    }
    
    const record = data.rows[rowIndex];
    currentRecord = { tableName, record, rowIndex };
    
    showEditModal(tableName, data.columns, record);
}

// Show edit modal
function showEditModal(tableName, columns, record) {
    const form = document.getElementById('editForm');
    
    let html = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
    
    columns.forEach(col => {
        const value = record[col] || '';
        const isId = col.toLowerCase() === 'id';
        const inputType = getInputType(col, value);
        
        html += `
            <div class="form-control">
                <label class="label">
                    <span class="label-text">${col}</span>
                </label>
                ${inputType === 'textarea' ? 
                    `<textarea class="textarea textarea-bordered field-edit" name="${col}" ${isId ? 'readonly' : ''}>${escapeHtml(String(value))}</textarea>` :
                    `<input type="${inputType}" class="input input-bordered field-edit" name="${col}" value="${escapeHtml(String(value))}" ${isId ? 'readonly' : ''}>`
                }
            </div>
        `;
    });
    
    html += '</div>';
    form.innerHTML = html;
    
    document.getElementById('editModal').showModal();
}

// Save edited record
async function saveEditedRecord() {
    if (!currentRecord) return;
    
    const form = document.getElementById('editForm');
    const updatedRecord = {};
    
    // Collect form data
    form.querySelectorAll('input, textarea').forEach(input => {
        updatedRecord[input.name] = input.value;
    });
    
    try {
        const response = await fetch(`/api/database/table/${currentRecord.tableName}/${updatedRecord.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedRecord)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('Record updated successfully', 'success');
            document.getElementById('editModal').close();
            loadTableData(currentRecord.tableName);
            currentRecord = null;
        } else {
            throw new Error(result.error || 'Failed to update record');
        }
    } catch (error) {
        console.error('Error updating record:', error);
        showMessage('Failed to update record: ' + error.message, 'error');
    }
}

// Delete record
function deleteRecord(tableName, recordId) {
    confirmAction(
        `Delete record with ID ${recordId} from ${tableName}? This action cannot be undone.`,
        () => performDeleteRecord(tableName, recordId)
    );
}

// Perform delete record
async function performDeleteRecord(tableName, recordId) {
    try {
        const response = await fetch(`/api/database/table/${tableName}/${recordId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('Record deleted successfully', 'success');
            loadTableData(tableName);
        } else {
            throw new Error(result.error || 'Failed to delete record');
        }
    } catch (error) {
        console.error('Error deleting record:', error);
        showMessage('Failed to delete record: ' + error.message, 'error');
    }
}

// Execute SQL query
async function executeSqlQuery() {
    const query = document.getElementById('sqlQuery').value.trim();
    if (!query) {
        showMessage('Please enter a SQL query', 'warning');
        return;
    }
    
    try {
        console.log('Executing SQL query:', query);
        
        const response = await fetch('/api/database/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displaySqlResult(result);
        } else {
            throw new Error(result.error || 'Query execution failed');
        }
    } catch (error) {
        console.error('Error executing SQL query:', error);
        showMessage('Failed to execute query: ' + error.message, 'error');
    }
}

// Display SQL query result
function displaySqlResult(result) {
    const resultContainer = document.getElementById('sql-result');
    const resultContent = document.getElementById('sql-result-content');
    
    if (result.type === 'select' && result.rows) {
        // Display SELECT results as table
        if (result.rows.length === 0) {
            resultContent.innerHTML = '<p class="text-center py-4 text-base-content/50">Query returned no results</p>';
        } else {
            const columns = Object.keys(result.rows[0]);
            let html = `
                <div class="overflow-x-auto">
                    <table class="table table-zebra w-full">
                        <thead>
                            <tr>${columns.map(col => `<th>${col}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
            `;
            
            result.rows.forEach(row => {
                html += '<tr>';
                columns.forEach(col => {
                    let value = row[col];
                    if (value === null) value = '<em>null</em>';
                    html += `<td>${escapeHtml(String(value))}</td>`;
                });
                html += '</tr>';
            });
            
            html += '</tbody></table></div>';
            html += `<p class="text-sm text-base-content/70 mt-2">${result.rows.length} row(s) returned</p>`;
            resultContent.innerHTML = html;
        }
    } else {
        // Display other query results
        resultContent.innerHTML = `
            <div class="alert alert-success">
                <i class="fas fa-check"></i>
                <div>
                    <div class="font-medium">Query executed successfully</div>
                    <div class="text-sm">${result.message || 'Operation completed'}</div>
                    ${result.changes ? `<div class="text-sm">${result.changes} row(s) affected</div>` : ''}
                </div>
            </div>
        `;
    }
    
    resultContainer.classList.remove('hidden');
}

// Utility functions
function showTableLoading() {
    document.getElementById('table-content').innerHTML = `
        <div class="text-center py-8">
            <span class="loading loading-spinner loading-lg text-primary"></span>
            <p class="mt-2 text-base-content/70">Loading table data...</p>
        </div>
    `;
}

function clearTableContent() {
    document.getElementById('table-content').innerHTML = `
        <div class="text-center py-8 text-base-content/50">
            <i class="fas fa-table text-4xl mb-4"></i>
            <p>Select a table to view its contents</p>
        </div>
    `;
}

function updateDatabaseStatus(status = 'connected', text = 'Connected') {
    const statusElement = document.getElementById('dbStatus');
    const textElement = document.getElementById('dbStatusText');
    
    statusElement.className = 'badge badge-outline';
    
    switch (status) {
        case 'connected':
            statusElement.classList.add('badge-success');
            break;
        case 'loading':
            statusElement.classList.add('badge-warning');
            break;
        case 'error':
            statusElement.classList.add('badge-error');
            break;
    }
    
    textElement.textContent = text;
}

function confirmAction(message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmYes').onclick = function() {
        document.getElementById('confirmModal').close();
        callback();
    };
    document.getElementById('confirmModal').showModal();
}

function showMessage(message, type = 'info') {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} fixed top-4 right-4 w-auto max-w-sm z-50 shadow-lg`;
    
    const icon = type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info';
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (document.body.contains(toast)) {
            document.body.removeChild(toast);
        }
    }, 5000);
}

function getInputType(columnName, value) {
    const col = columnName.toLowerCase();
    
    if (col.includes('date') || col.includes('time')) return 'datetime-local';
    if (col.includes('email')) return 'email';
    if (col.includes('url')) return 'url';
    if (col.includes('password')) return 'password';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string' && value.length > 100) return 'textarea';
    
    return 'text';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function loadTemplate(query) {
    document.getElementById('sqlQuery').value = query;
}

// Export table functionality
async function exportTable(tableName) {
    try {
        const response = await fetch(`/api/database/export/${tableName}`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${tableName}_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showMessage(`Table ${tableName} exported successfully`, 'success');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Export failed');
        }
    } catch (error) {
        console.error('Error exporting table:', error);
        showMessage('Failed to export table: ' + error.message, 'error');
    }
}

// Quick action functions
async function cleanupOrphanedRecords() {
    try {
        const response = await fetch('/api/database/cleanup', { method: 'POST' });
        const result = await response.json();
        
        if (response.ok) {
            showMessage(`Cleanup completed. ${result.deletedRecords} orphaned records removed.`, 'success');
            if (currentTable) loadTableData(currentTable);
        } else {
            throw new Error(result.error || 'Cleanup failed');
        }
    } catch (error) {
        console.error('Error during cleanup:', error);
        showMessage('Cleanup failed: ' + error.message, 'error');
    }
}

async function optimizeDatabase() {
    try {
        const response = await fetch('/api/database/optimize', { method: 'POST' });
        const result = await response.json();
        
        if (response.ok) {
            showMessage('Database optimization completed successfully', 'success');
            loadDatabaseOverview();
        } else {
            throw new Error(result.error || 'Optimization failed');
        }
    } catch (error) {
        console.error('Error optimizing database:', error);
        showMessage('Database optimization failed: ' + error.message, 'error');
    }
}

async function createBackup() {
    try {
        const response = await fetch('/api/database/backup', { method: 'POST' });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cycling_data_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showMessage('Database backup created successfully', 'success');
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Backup failed');
        }
    } catch (error) {
        console.error('Error creating backup:', error);
        showMessage('Backup failed: ' + error.message, 'error');
    }
}

async function showDatabaseInfo() {
    try {
        const response = await fetch('/api/database/info');
        const info = await response.json();
        
        if (response.ok) {
            const modal = document.createElement('dialog');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-box">
                    <h3 class="font-bold text-lg mb-4">
                        <i class="fas fa-info text-primary mr-2"></i>
                        Database Information
                    </h3>
                    
                    <div class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <strong>File Path:</strong><br>
                                <code class="text-sm">${info.filePath}</code>
                            </div>
                            <div>
                                <strong>File Size:</strong><br>
                                ${formatBytes(info.fileSize)}
                            </div>
                        </div>
                        
                        <div>
                            <strong>Tables:</strong><br>
                            ${info.tables.map(table => `
                                <span class="badge badge-outline mr-2">${table.name} (${table.count} records)</span>
                            `).join('')}
                        </div>
                        
                        <div>
                            <strong>SQLite Version:</strong> ${info.sqliteVersion}<br>
                            <strong>Created:</strong> ${info.created}<br>
                            <strong>Last Modified:</strong> ${info.lastModified}
                        </div>
                    </div>
                    
                    <div class="modal-action">
                        <button class="btn" onclick="this.closest('dialog').close(); document.body.removeChild(this.closest('dialog'))">Close</button>
                    </div>
                </div>
                <form method="dialog" class="modal-backdrop">
                    <button></button>
                </form>
            `;
            
            document.body.appendChild(modal);
            modal.showModal();
        } else {
            throw new Error(info.error || 'Failed to get database info');
        }
    } catch (error) {
        console.error('Error getting database info:', error);
        showMessage('Failed to get database info: ' + error.message, 'error');
    }
}