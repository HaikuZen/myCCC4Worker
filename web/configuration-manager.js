/**
 * Configuration Manager
 * Handles configuration settings for admin users
 */


function showMainContent(userData) {
    document.getElementById('authLoading').classList.add('hidden');
    document.getElementById('accessDenied').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
    
    // Update user profile
    if (userData) {
        const userProfile = document.getElementById('userProfile');
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const userRole = document.getElementById('userRole');
        
        if (userProfile) userProfile.classList.remove('hidden');
        if (userAvatar) userAvatar.src = userData.picture || '';
        if (userName) userName.textContent = userData.name || userData.email;
        if (userRole) userRole.textContent = userData.is_admin ? 'Administrator' : 'User';
    }
    
    // Load configuration data
    loadConfigurationData();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication first
    const userData = await checkAuthentication();
    if (userData) {
        initializeConfiguration();
        showMainContent(userData)
    } else {
        showAccessDenied();
    }   
});

// Configuration Management Functions
function initializeConfiguration() {
    const refreshButton = document.getElementById('refreshConfig');
    const saveAllButton = document.getElementById('saveAllConfig');
    
    if (refreshButton) {
        refreshButton.addEventListener('click', loadConfigurationData);
    }
    
    if (saveAllButton) {
        saveAllButton.addEventListener('click', saveAllConfigurationChanges);
    }
}

// Load configuration data from server
async function loadConfigurationData() {
    const loadingElement = document.getElementById('config-loading');
    const contentElement = document.getElementById('config-content');
    
    if (loadingElement) loadingElement.classList.remove('hidden');
    if (contentElement) contentElement.classList.add('hidden');
    
    try {
        const response = await fetch('/api/configuration');
        if (!response.ok) {
            throw new Error('Failed to load configuration');
        }
        
        const configs = await response.json();
        displayConfiguration(configs);
        
        if (loadingElement) loadingElement.classList.add('hidden');
        if (contentElement) contentElement.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading configuration:', error);
        showMessage('Failed to load configuration: ' + error.message, 'error');
        
        if (loadingElement) {
            loadingElement.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-exclamation-triangle text-4xl text-error mb-4"></i>
                    <p class="text-error">Failed to load configuration</p>
                    <button class="btn btn-outline btn-sm mt-2" onclick="loadConfigurationData()">Try Again</button>
                </div>
            `;
        }
    }
}

// Display configuration in organized categories
function displayConfiguration(configs) {
    const contentElement = document.getElementById('config-content');
    if (!contentElement) return;
    
    // Group configurations by category
    const categories = {};
    configs.forEach(config => {
        const category = config.category || 'general';
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push(config);
    });
    
    // Create HTML for each category
    let html = '';
    for (const [categoryName, categoryConfigs] of Object.entries(categories)) {
        const categoryTitle = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
        const categoryIcon = getCategoryIcon(categoryName);
        
        html += `
            <div class="card bg-base-50 mb-6 config-card">
                <div class="card-body">
                    <h3 class="card-title mb-4">
                        <i class="${categoryIcon} text-primary mr-2"></i>
                        ${categoryTitle} Settings
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        `;
        
        categoryConfigs.forEach(config => {
            html += createConfigurationInput(config);
        });
        
        html += `
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add button to add new configuration
    html += `
        <div class="card bg-base-50 config-card">
            <div class="card-body">
                <h3 class="card-title mb-4">
                    <i class="fas fa-plus text-primary mr-2"></i>
                    Add New Setting
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text font-medium">Key</span>
                        </label>
                        <input type="text" id="newConfigKey" class="input input-bordered" placeholder="e.g., new_setting">
                    </div>
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text font-medium">Value</span>
                        </label>
                        <input type="text" id="newConfigValue" class="input input-bordered" placeholder="Enter value">
                    </div>
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text font-medium">Type</span>
                        </label>
                        <select id="newConfigType" class="select select-bordered">
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="boolean">Boolean</option>
                        </select>
                    </div>
                    <div class="form-control md:col-span-2">
                        <label class="label">
                            <span class="label-text font-medium">Description</span>
                        </label>
                        <input type="text" id="newConfigDescription" class="input input-bordered" placeholder="Brief description">
                    </div>
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text font-medium">Category</span>
                        </label>
                        <select id="newConfigCategory" class="select select-bordered">
                            <option value="general">General</option>
                            <option value="rider">Rider</option>
                            <option value="api">API</option>
                            <option value="weather">Weather</option>
                            <option value="processing">Processing</option>
                            <option value="physics">Physics</option>
                            <option value="system">System</option>
                            <option value="export">Export</option>
                        </select>
                    </div>
                </div>
                <div class="mt-4">
                    <button class="btn btn-primary" onclick="addNewConfiguration()">
                        <i class="fas fa-plus mr-2"></i>
                        Add Configuration
                    </button>
                </div>
            </div>
        </div>
    `;
    
    contentElement.innerHTML = html;
    
    // Show quick actions section
    const quickActions = document.getElementById('quickActions');
    if (quickActions) {
        quickActions.classList.remove('hidden');
    }
}

// Create input element for a configuration item
function createConfigurationInput(config) {
    const isPassword = config.key.toLowerCase().includes('key') || config.key.toLowerCase().includes('password') || config.key.toLowerCase().includes('secret');
    
    let inputElement;
    switch (config.value_type) {
        case 'boolean':
            inputElement = `
                <input type="checkbox" 
                       class="toggle toggle-primary config-input" 
                       data-config-key="${config.key}"
                       data-config-type="${config.value_type}"
                       ${config.value === 'true' || config.value === true ? 'checked' : ''}
                       onchange="markConfigurationChanged()">
            `;
            break;
        case 'number':
            inputElement = `
                <input type="number" 
                       class="input input-bordered config-input" 
                       data-config-key="${config.key}"
                       data-config-type="${config.value_type}"
                       value="${config.value}"
                       onchange="markConfigurationChanged()">
            `;
            break;
        default:
            inputElement = `
                <input type="${isPassword ? 'password' : 'text'}" 
                       class="input input-bordered config-input" 
                       data-config-key="${config.key}"
                       data-config-type="${config.value_type}"
                       value="${config.value}"
                       ${isPassword ? 'placeholder="Enter to change (hidden)"' : ''}
                       onchange="markConfigurationChanged()">
            `;
    }
    
    return `
        <div class="form-control">
            <div class="flex justify-between items-center mb-2">
                <label class="label p-0">
                    <span class="label-text font-medium">${formatConfigKey(config.key)}</span>
                </label>
                <button class="btn btn-ghost btn-xs text-error" 
                        onclick="deleteConfiguration('${config.key}')"
                        title="Delete this setting">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            ${inputElement}
            ${config.description ? `
                <div class="label">
                    <span class="label-text-alt text-base-content/60">${config.description}</span>
                </div>
            ` : ''}
            <div class="text-xs text-base-content/40 mt-1">
                Type: ${config.value_type} | Updated: ${new Date(config.updated_at).toLocaleString('en-GB')}
            </div>
        </div>
    `;
}

// Helper functions
function getCategoryIcon(category) {
    const icons = {
        general: 'fas fa-cog',
        rider: 'fas fa-user',
        api: 'fas fa-plug',
        weather: 'fas fa-cloud-sun',
        processing: 'fas fa-microchip',
        physics: 'fas fa-atom',
        system: 'fas fa-server',
        export: 'fas fa-download'
    };
    return icons[category] || 'fas fa-cog';
}

function formatConfigKey(key) {
    return key.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function markConfigurationChanged() {
    const saveButton = document.getElementById('saveAllConfig');
    if (saveButton) {
        saveButton.disabled = false;
        saveButton.classList.add('btn-warning');
        saveButton.classList.remove('btn-primary');
    }
}

// Save all configuration changes
async function saveAllConfigurationChanges() {
    const saveButton = document.getElementById('saveAllConfig');
    const configInputs = document.querySelectorAll('[data-config-key]');
    
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
    }
    
    const updates = [];
    configInputs.forEach(input => {
        const key = input.dataset.configKey;
        const type = input.dataset.configType;
        let value;
        
        if (type === 'boolean') {
            value = input.checked;
        } else if (type === 'number') {
            value = parseFloat(input.value) || 0;
        } else {
            value = input.value;
        }
        
        updates.push({ key, value, type });
    });
    
    try {
        for (const update of updates) {
            const response = await fetch(`/api/configuration/${update.key}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ value: update.value, value_type: update.type })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to update ${update.key}`);
            }
        }
        
        showMessage('Configuration saved successfully!', 'success');
        
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.classList.remove('btn-warning');
            saveButton.classList.add('btn-primary');
            saveButton.innerHTML = '<i class="fas fa-save mr-2"></i>Save All Changes';
        }
        
        // Reload to show updated timestamps
        setTimeout(() => {
            loadConfigurationData();
        }, 1000);
        
    } catch (error) {
        console.error('Error saving configuration:', error);
        showMessage('Failed to save configuration: ' + error.message, 'error');
        
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fas fa-save mr-2"></i>Save All Changes';
        }
    }
}

// Add new configuration
async function addNewConfiguration() {
    const key = document.getElementById('newConfigKey').value.trim();
    const value = document.getElementById('newConfigValue').value;
    const type = document.getElementById('newConfigType').value;
    const description = document.getElementById('newConfigDescription').value.trim();
    const category = document.getElementById('newConfigCategory').value;
    
    if (!key || !value) {
        showMessage('Key and value are required', 'error');
        return;
    }
    
    try {
        let processedValue = value;
        if (type === 'number') {
            processedValue = parseFloat(value);
            if (isNaN(processedValue)) {
                showMessage('Invalid number value', 'error');
                return;
            }
        } else if (type === 'boolean') {
            processedValue = value.toLowerCase() === 'true';
        }
        
        const response = await fetch('/api/configuration', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                key,
                value: processedValue,
                value_type: type,
                description,
                category
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add configuration');
        }
        
        showMessage('Configuration added successfully!', 'success');
        
        // Clear form
        document.getElementById('newConfigKey').value = '';
        document.getElementById('newConfigValue').value = '';
        document.getElementById('newConfigDescription').value = '';
        document.getElementById('newConfigType').value = 'string';
        document.getElementById('newConfigCategory').value = 'general';
        
        // Reload configuration
        loadConfigurationData();
    } catch (error) {
        console.error('Error adding configuration:', error);
        showMessage('Failed to add configuration: ' + error.message, 'error');
    }
}

// Delete configuration
async function deleteConfiguration(key) {
    if (!confirm(`Are you sure you want to delete the configuration '${key}'?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/configuration/${key}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete configuration');
        }
        
        showMessage('Configuration deleted successfully!', 'success');
        loadConfigurationData();
    } catch (error) {
        console.error('Error deleting configuration:', error);
        showMessage('Failed to delete configuration: ' + error.message, 'error');
    }
}

// Quick Actions
function resetDefaultValues() {
    if (!confirm('Reset all configuration values to defaults?\n\nThis will overwrite all current settings.')) {
        return;
    }
    showMessage('Reset to defaults functionality coming soon!', 'info');
}

function exportConfig() {
    showMessage('Export configuration functionality coming soon!', 'info');
}

function showConfigHistory() {
    showMessage('Configuration history functionality coming soon!', 'info');
}

// Message display function
function showMessage(message, type = 'info') {
    const alertClass = {
        success: 'alert-success',
        error: 'alert-error',
        warning: 'alert-warning',
        info: 'alert-info'
    }[type] || 'alert-info';
    
    const icon = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-triangle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    }[type] || 'fa-info-circle';
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClass} fixed top-4 right-4 max-w-md z-50 animate-pulse`;
    alertDiv.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.transition = 'opacity 0.5s';
        alertDiv.style.opacity = '0';
        setTimeout(() => {
            alertDiv.remove();
        }, 500);
    }, 3000);
}
