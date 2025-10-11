// Global variables for charts
let charts = {};
let currentUser = null;

// Theme management
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// ============= AUTHENTICATION FUNCTIONS =============

// Initialize authentication
async function initializeAuthentication() {
    console.log('🔐 Initializing authentication...');
    
    try {
        const response = await fetch('/api/auth/user');
        const authData = await response.json();
        
        if (authData.authenticated && authData.user) {
            currentUser = authData.user;
            showAuthenticatedState(authData.user);
            console.log('✅ User authenticated:', authData.user.name);
        } else {
            showUnauthenticatedState();
            console.log('ℹ️ User not authenticated');
        }
    } catch (error) {
        console.error('❌ Authentication check failed:', error);
        showUnauthenticatedState();
    }
}

// Show authenticated user state
function showAuthenticatedState(user) {
    const authLoading = document.getElementById('authLoading');
    const notAuthenticated = document.getElementById('notAuthenticated');
    const authenticated = document.getElementById('authenticated');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userAvatar = document.getElementById('userAvatar');
    const userAvatarLarge = document.getElementById('userAvatarLarge');
    const adminMenuItems = document.getElementById('adminMenuItems');
    
    // Hide loading and not authenticated states
    authLoading.classList.add('hidden');
    notAuthenticated.classList.add('hidden');
    
    // Show authenticated state
    authenticated.classList.remove('hidden');
    authenticated.classList.add('flex');
    
    // Set user info
    userName.textContent = user.name;
    userEmail.textContent = user.email;
    
    // Set user avatars
    const avatarUrl = user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=570df8&color=fff`;
    userAvatar.src = avatarUrl;
    userAvatarLarge.src = avatarUrl;
    
    // Show admin menu items if user is admin
    if (user.is_admin) {
        // User dropdown menu items
        const adminMenuConfig = document.getElementById('adminMenuConfig');
        const adminMenuDatabase = document.getElementById('adminMenuDatabase');
        const adminMenuInvite = document.getElementById('adminMenuInvite');
        if (adminMenuConfig) adminMenuConfig.classList.remove('hidden');
        if (adminMenuDatabase) adminMenuDatabase.classList.remove('hidden');
        if (adminMenuInvite) adminMenuInvite.classList.remove('hidden');
        
        // Desktop navigation links
        const desktopConfigLink = document.getElementById('desktopConfigLink');
        const desktopDatabaseLink = document.getElementById('desktopDatabaseLink');
        if (desktopConfigLink) desktopConfigLink.classList.remove('hidden');
        if (desktopDatabaseLink) desktopDatabaseLink.classList.remove('hidden');
        
        // Mobile navigation links
        const mobileAdminLinks = document.getElementById('mobileAdminLinks');
        const mobileAdminLinks2 = document.getElementById('mobileAdminLinks2');
        if (mobileAdminLinks) mobileAdminLinks.classList.remove('hidden');
        if (mobileAdminLinks2) mobileAdminLinks2.classList.remove('hidden');
    }
    
    // Show upload section when authenticated
    const uploadSection = document.getElementById('upload');
    if (uploadSection) {
        uploadSection.classList.remove('hidden');
    }
    
    // Show upload navigation links
    showUploadNavLinks();
    
    // Remove sample data label if present
    removeSampleDataLabel();
}

// Show unauthenticated state
function showUnauthenticatedState() {
    const authLoading = document.getElementById('authLoading');
    const notAuthenticated = document.getElementById('notAuthenticated');
    const authenticated = document.getElementById('authenticated');
    
    // Hide loading and authenticated states
    authLoading.classList.add('hidden');
    authenticated.classList.add('hidden');
    
    // Show not authenticated state
    notAuthenticated.classList.remove('hidden');
    
    // Hide upload section when not authenticated
    const uploadSection = document.getElementById('upload');
    if (uploadSection) {
        uploadSection.classList.add('hidden');
    }
    
    // Hide upload navigation links
    hideUploadNavLinks();
    
    // Add sample data label to statistics section
    addSampleDataLabel();
}

// Check if user is authenticated
function isAuthenticated() {
    return currentUser !== null;
}

// Check if user is admin
function isAdmin() {
    return currentUser && currentUser.is_admin;
}

// Add sample data label to statistics section
function addSampleDataLabel() {
    const statsSection = document.getElementById('stats');
    if (!statsSection) return;
    
    // Check if label already exists
    if (document.getElementById('sampleDataLabel')) return;
    
    // Find the flex container that holds the title
    const titleContainer = statsSection.querySelector('.flex.justify-between');
    if (titleContainer) {
        const label = document.createElement('div');
        label.id = 'sampleDataLabel';
        label.className = 'badge badge-warning gap-2';
        label.innerHTML = '<i class="fas fa-exclamation-triangle"></i>Using Sample Data';
        titleContainer.appendChild(label);
    }
}

// Remove sample data label from statistics section
function removeSampleDataLabel() {
    const label = document.getElementById('sampleDataLabel');
    if (label) {
        label.remove();
    }
}

// Hide upload navigation links
function hideUploadNavLinks() {
    // Hide all navigation links to upload section
    document.querySelectorAll('a[href="#upload"]').forEach(link => {
        link.style.display = 'none';
    });
}

// Show upload navigation links
function showUploadNavLinks() {
    // Show all navigation links to upload section
    document.querySelectorAll('a[href="#upload"]').forEach(link => {
        link.style.display = '';
    });
}

// Require authentication for sensitive operations
function requireAuth(operation = 'perform this action') {
    if (!isAuthenticated()) {
        showMessage(`Please sign in to ${operation}`, 'warning');
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
        return false;
    }
    return true;
}

// Require admin privileges
function requireAdmin(operation = 'perform this action') {
    if (!requireAuth(operation)) {
        return false;
    }
    
    if (!isAdmin()) {
        showMessage(`Administrator privileges required to ${operation}`, 'error');
        return false;
    }
    
    return true;
}

// Load saved theme on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, initializing application...');
    console.log('Chart.js available:', typeof Chart !== 'undefined');
    
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    
    // Initialize authentication first
    initializeAuthentication();
    
    // Initialize all functionality
    initializeFileUpload();
    initializeCharts();
    initializeDatePickers();
    initializeWeatherForecast();
    initializeDashboard();
    initializeInvitationForm();
    initializeProfileForm();
    
    // Load real data from database or fallback to sample data
    loadDatabaseData();
    
});

// Initialize dashboard functionality
function initializeDashboard() {
    const refreshButton = document.getElementById('refreshDashboard');
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            refreshDashboardData();
        });
    }
}

// Refresh dashboard data (called after GPX upload)
function refreshDashboardData() {
    console.log('Refreshing dashboard data...');
    
    // Show loading state
    updateDatabaseStatus('loading', 'Refreshing...');
    
    // Reload dashboard data
    loadDatabaseData();
}

// File Upload Functionality
function initializeFileUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('gpxFile');
    const clearButton = document.getElementById('clearFile');
    const form = document.getElementById('gpxUploadForm');
    
    // Click to browse
    dropZone.addEventListener('click', () => fileInput.click());
    
    // Drag and drop events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.toLowerCase().endsWith('.gpx')) {
            fileInput.files = files;
            updateDropZoneText(files[0].name);
            console.log('📎 File dropped:', files[0].name, 'Size:', files[0].size, 'bytes');
        } else {
            console.warn('⚠️ Invalid file dropped. Only .gpx files are allowed.');
            showMessage('Please select a valid GPX file', 'error');
        }
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            updateDropZoneText(file.name);
            console.log('📎 File selected:', file.name, 'Size:', file.size, 'bytes');
        }
    });
    
    // Clear file button
    clearButton.addEventListener('click', () => {
        fileInput.value = '';
        resetDropZoneText();
        console.log('🛑 File cleared');
    });
    
    // Add form validation before HTMX submission
    if (form) {
        form.addEventListener('htmx:before-request', function(evt) {
            console.log('🚀 Upload starting...');
            
            const files = fileInput.files;
            if (!files || files.length === 0) {
                console.error('❌ No file selected for upload');
                showMessage('Please select a GPX file before uploading', 'error');
                evt.preventDefault();
                return false;
            }
            
            const file = files[0];
            if (!file.name.toLowerCase().endsWith('.gpx')) {
                console.error('❌ Invalid file type:', file.name);
                showMessage('Please select a valid GPX file', 'error');
                evt.preventDefault();
                return false;
            }
            
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                console.error('❌ File too large:', file.size, 'bytes');
                showMessage('File is too large. Maximum size is 10MB', 'error');
                evt.preventDefault();
                return false;
            }
            
            console.log('✅ File validation passed:', file.name);
            
            // Show a warning if the filename looks like a common duplicate pattern
            if (isLikelyDuplicateFilename(file.name)) {
                console.warn('⚠️ Filename suggests possible duplicate');
                showMessage('This filename suggests it might be a duplicate. The system will check when uploading.', 'warning');
            }
        });
        
        // Handle successful upload
        form.addEventListener('htmx:after-request', function(evt) {
            if (evt.detail.xhr.status === 200) {
                console.log('✅ Upload successful');
                refreshDashboardData();
                // Clear the form
                fileInput.value = '';
                resetDropZoneText();
            } else if (evt.detail.xhr.status === 409) {
                console.warn('⚠️ Duplicate file detected');
                // Clear the form even for duplicates
                fileInput.value = '';
                resetDropZoneText();
                
                // Show a more prominent message for duplicates
                setTimeout(() => {
                    const alertElement = document.querySelector('#upload-result .alert-warning');
                    if (alertElement) {
                        alertElement.classList.add('animate-pulse');
                        setTimeout(() => {
                            alertElement.classList.remove('animate-pulse');
                        }, 2000);
                    }
                }, 100);
            } else {
                console.error('❌ Upload failed with status:', evt.detail.xhr.status);
                console.error('Response:', evt.detail.xhr.responseText);
                // Clear the form on other errors too
                fileInput.value = '';
                resetDropZoneText();
            }
        });
    }
}

function updateDropZoneText(fileName) {
    const dropZoneContent = document.getElementById('dropZoneContent');
    dropZoneContent.innerHTML = `
        <i class="fas fa-file-alt text-4xl text-success"></i>
        <div>
            <p class="text-lg font-semibold text-success">File Selected</p>
            <p class="text-base-content/70">${fileName}</p>
        </div>
        <div class="text-sm text-base-content/50">
            Click "Upload & Analyze" to process
        </div>
    `;
}

function resetDropZoneText() {
    const dropZoneContent = document.getElementById('dropZoneContent');
    dropZoneContent.innerHTML = `
        <i class="fas fa-cloud-upload-alt text-4xl text-base-content/50"></i>
        <div>
            <p class="text-lg font-semibold">Drop your GPX file here</p>
            <p class="text-base-content/70">or click to browse</p>
        </div>
        <div class="text-sm text-base-content/50">
            Supported format: .gpx (Max 10MB)
        </div>
    `;
}

// Date Picker Functionality
function initializeDatePickers() {
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    // Set default dates (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    endDate.value = today.toISOString().split('T')[0];
    startDate.value = thirtyDaysAgo.toISOString().split('T')[0];
}

function setQuickRange(days) {
    if (!days) return;
    
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (parseInt(days) * 24 * 60 * 60 * 1000));
    
    document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
    document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
    
    // Trigger the form submission
    checkAndSubmitDateRange();
}

// Check if both dates are selected and submit the form
function checkAndSubmitDateRange() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const form = document.getElementById('dateFilterForm');
    
    console.log('📅 Date range check:', { startDate, endDate });
    
    if (startDate && endDate) {
        // Validate that start date is not after end date
        if (new Date(startDate) > new Date(endDate)) {
            showMessage('Start date cannot be after end date', 'error');
            return;
        }
        
        console.log('✅ Both dates selected, triggering filter...');
        
        // Trigger the HTMX request
        if (typeof htmx !== 'undefined') {
            htmx.trigger(form, 'submit');
        } else {
            console.warn('HTMX not available, falling back to manual request');
            // Fallback to manual fetch if HTMX is not available
            filterDataManually(startDate, endDate);
        }
    } else {
        console.log('⏳ Waiting for both dates to be selected');
    }
}

// Fallback function to filter data manually if HTMX fails
async function filterDataManually(startDate, endDate) {
    try {
        const response = await fetch(`/filter-data?startDate=${startDate}&endDate=${endDate}`);
        const html = await response.text();
        
        const statsContent = document.getElementById('stats-content');
        if (statsContent && response.ok) {
            statsContent.innerHTML = html;
            console.log('✅ Data filtered successfully');
        } else {
            showMessage('Error filtering data', 'error');
        }
    } catch (error) {
        console.error('Error filtering data:', error);
        showMessage('Error filtering data', 'error');
    }
}

// Chart Initialization with retry mechanism
function initializeCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not available, retrying in 200ms...');
        setTimeout(initializeCharts, 200);
        return;
    }
    
    try {
        console.log('Initializing charts...');
        initializeCaloriesChart();
        initializeDistanceChart();
        initializeSpeedChart();
        initializeElevationChart();
        initializeTemperatureChart();
        initializeWindChart();
        console.log('✅ Charts initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing charts:', error);
        // Retry once after a delay
        setTimeout(() => {
            try {
                initializeCharts();
            } catch (retryError) {
                console.error('❌ Chart initialization failed on retry:', retryError);
            }
        }, 1000);
    }
}

function initializeCaloriesChart() {
    const ctx = document.getElementById('caloriesChart').getContext('2d');
    charts.calories = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Calories Burned',
                data: [],
                borderColor: 'rgb(99, 102, 241)',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Calories'
                    }
                }
            }
        }
    });
}

function initializeDistanceChart() {
    const ctx = document.getElementById('distanceChart').getContext('2d');
    charts.distance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Distance (km)',
                data: [],
                backgroundColor: 'rgba(34, 197, 94, 0.8)',
                borderColor: 'rgb(34, 197, 94)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Distance (km)'
                    }
                }
            }
        }
    });
}

function initializeSpeedChart() {
    const ctx = document.getElementById('speedChart').getContext('2d');
    charts.speed = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Average Speed',
                    data: [],
                    borderColor: 'rgb(251, 191, 36)',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Max Speed',
                    data: [],
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Speed (km/h)'
                    }
                }
            }
        }
    });
}

function initializeElevationChart() {
    const ctx = document.getElementById('elevationChart').getContext('2d');
    charts.elevation = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Elevation (m)',
                data: [],
                borderColor: 'rgb(168, 85, 247)',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Distance (km)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Elevation (m)'
                    }
                }
            }
        }
    });
}

function initializeTemperatureChart() {
    const ctx = document.getElementById('temperatureChart').getContext('2d');
    charts.temperature = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: [],
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Hour'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                }
            }
        }
    });
}

function initializeWindChart() {
    const ctx = document.getElementById('windChart').getContext('2d');
    charts.wind = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Wind Speed (km/h)',
                    data: [],
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Precipitation (%)',
                    data: [],
                    type: 'line',
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: false,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Hour'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Wind Speed (km/h)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Precipitation (%)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                    max: 100
                }
            }
        }
    });
}

// Weather Forecast
function initializeWeatherForecast() {
    generateForecastCards();
}

function generateForecastCards() {
    const container = document.getElementById('forecastContainer');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const icons = ['fa-sun', 'fa-cloud-sun', 'fa-cloud', 'fa-cloud-rain', 'fa-cloud-sun', 'fa-sun', 'fa-cloud'];
    const temps = [22, 19, 16, 14, 18, 24, 26];
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Partly Cloudy', 'Sunny', 'Hot'];
    
    container.innerHTML = '';
    
    for (let i = 0; i < 7; i++) {
        const forecastCard = document.createElement('div');
        forecastCard.className = 'card bg-base-100 shadow-md p-3 text-center';
        forecastCard.innerHTML = `
            <div class="text-sm font-semibold mb-2">${days[i]}</div>
            <i class="fas ${icons[i]} text-2xl text-primary mb-2"></i>
            <div class="text-lg font-bold">${temps[i]}°</div>
            <div class="text-xs text-base-content/70">${conditions[i]}</div>
        `;
        container.appendChild(forecastCard);
    }
}

// Weather Location Management
let currentWeatherLocation = 'Milan,IT'; // Default fallback
let currentLocationCoordinates = { lat: 45.4642, lon: 9.1900 }; // Milan coordinates
let geocodingDebounceTimer = null;

// Initialize weather location input
async function initializeWeatherLocationInput() {
    const input = document.getElementById('weatherLocationInput');
    if (!input) return;
    
    try {
        // Load default location from configuration
        const config = await loadConfiguration();
        const defaultLocation = config.find(c => c.key === 'default_location');
        if (defaultLocation) {
            currentWeatherLocation = defaultLocation.value;
            // Set input value to just the city name (remove country code)
            const cityName = defaultLocation.value.split(',')[0];
            input.value = cityName;
        } else {
            // Set default value
            input.value = 'Milan';
        }
        
        // Get coordinates for the default location
        await geocodeLocation(input.value);
        
    } catch (error) {
        console.error('Error initializing weather location input:', error);
        input.value = 'Milan';
        currentWeatherLocation = 'Milan,IT';
        currentLocationCoordinates = { lat: 45.4642, lon: 9.1900 };
    }
}

// Geocode location using backend API
async function geocodeLocation(locationName) {
    if (!locationName || locationName.length < 2) {
        return null;
    }
    
    const statusDiv = document.getElementById('locationStatus');
    
    try {
        // Show loading state
        if (statusDiv) {
            statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin text-primary"></i>';
        }
        
        console.log(`🌍 Geocoding location: ${locationName}`);
        
        // Call backend geocoding API
        const response = await fetch(
            `/api/geocode?location=${encodeURIComponent(locationName)}`,
            { 
                timeout: 8000,
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        if (!response.ok) {
            throw new Error(`Geocoding API error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Location not found');
        }
        
        const locationData = result.data;
        
        // Update current location data
        currentWeatherLocation = `${locationData.name},${locationData.country}`;
        currentLocationCoordinates = { lat: locationData.lat, lon: locationData.lon };
        
        // Show appropriate status based on data source
        if (statusDiv) {
            if (result.demo) {
                statusDiv.innerHTML = '<i class="fas fa-info-circle text-warning"></i>';
                statusDiv.title = result.warning || 'Using demo data (API key required for live geocoding)';
            } else {
                statusDiv.innerHTML = '<i class="fas fa-check text-success"></i>';
                statusDiv.title = '';
            }
        }
        
        console.log(`✅ Location found:`, locationData);
        return locationData;
        
    } catch (error) {
        console.error('Error geocoding location:', error);
        
        // Show error state
        if (statusDiv) {
            statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle text-error"></i>';
            statusDiv.title = `Error: ${error.message}`;
        }
        
        // Fallback to demo data for common locations
        const demoData = getDemoLocationData(locationName);
        if (demoData) {
            currentWeatherLocation = demoData.name + ',' + demoData.country;
            currentLocationCoordinates = { lat: demoData.lat, lon: demoData.lon };
            
            if (statusDiv) {
                statusDiv.innerHTML = '<i class="fas fa-info-circle text-warning"></i>';
                statusDiv.title = 'Using local demo data (geocoding service unavailable)';
            }
            
            return demoData;
        }
        
        return null;
    }
}

// Demo location data for common cities (fallback when no API key)
function getDemoLocationData(locationName) {
    const demoLocations = {
        'milan': { name: 'Milan', country: 'IT', lat: 45.4642, lon: 9.1900 },
        'london': { name: 'London', country: 'GB', lat: 51.5074, lon: -0.1278 },
        'paris': { name: 'Paris', country: 'FR', lat: 48.8566, lon: 2.3522 },
        'berlin': { name: 'Berlin', country: 'DE', lat: 52.5200, lon: 13.4050 },
        'madrid': { name: 'Madrid', country: 'ES', lat: 40.4168, lon: -3.7038 },
        'rome': { name: 'Rome', country: 'IT', lat: 41.9028, lon: 12.4964 },
        'amsterdam': { name: 'Amsterdam', country: 'NL', lat: 52.3676, lon: 4.9041 },
        'barcelona': { name: 'Barcelona', country: 'ES', lat: 41.3851, lon: 2.1734 },
        'vienna': { name: 'Vienna', country: 'AT', lat: 48.2082, lon: 16.3738 },
        'prague': { name: 'Prague', country: 'CZ', lat: 50.0755, lon: 14.4378 },
        'new york': { name: 'New York', country: 'US', lat: 40.7128, lon: -74.0060 },
        'los angeles': { name: 'Los Angeles', country: 'US', lat: 34.0522, lon: -118.2437 },
        'chicago': { name: 'Chicago', country: 'US', lat: 41.8781, lon: -87.6298 },
        'toronto': { name: 'Toronto', country: 'CA', lat: 43.6532, lon: -79.3832 },
        'sydney': { name: 'Sydney', country: 'AU', lat: -33.8688, lon: 151.2093 },
        'tokyo': { name: 'Tokyo', country: 'JP', lat: 35.6762, lon: 139.6503 },
        'singapore': { name: 'Singapore', country: 'SG', lat: 1.3521, lon: 103.8198 }
    };
    
    const key = locationName.toLowerCase().trim();
    return demoLocations[key] || null;
}

// Check if weather API key is configured
async function isWeatherAPIConfigured() {
    try {
        const config = await loadConfiguration();
        const apiKeyConfig = config.find(c => c.key === 'weather_api_key');
        return apiKeyConfig && apiKeyConfig.value && apiKeyConfig.value.length > 0;
    } catch (error) {
        console.error('Error checking weather API configuration:', error);
        return false;
    }
}

// Load configuration from database
async function loadConfiguration() {
    try {
        const response = await fetch('/api/configuration');
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Error loading configuration:', error);
    }
    return [];
}

// Save location configuration
async function saveLocationConfiguration(location) {
    try {
        const response = await fetch('/api/configuration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: 'default_location',
                value: location,
                value_type: 'string',
                description: 'Default location for weather forecast',
                category: 'weather'
            })
        });
        
        if (!response.ok) {
            console.warn('Failed to save location configuration');
        }
    } catch (error) {
        console.error('Error saving location configuration:', error);
    }
}

// Load weather data for a specific location
async function loadWeatherData(location = null) {
    const selectedLocation = location || currentWeatherLocation;
    console.log(`🌤️ Loading weather data for: ${selectedLocation}`);
    
    try {
        // Call backend weather API
        const apiUrl = currentLocationCoordinates 
            ? `/api/weather?lat=${currentLocationCoordinates.lat}&lon=${currentLocationCoordinates.lon}&location=${encodeURIComponent(selectedLocation)}`
            : `/api/weather?location=${encodeURIComponent(selectedLocation)}`;
            
        const response = await fetch(apiUrl, {
            timeout: 10000,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Weather API error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to get weather data');
        }
        
        // Update weather display with API data
        updateWeatherDisplay(result.data, result.demo, result.warning);
        
        // Update current location display
        document.getElementById('currentLocation').textContent = selectedLocation.split(',')[0];
        
        // Update weather provider badge
        updateWeatherProviderBadge(result.provider, result.demo);
        
        console.log(`✅ Weather data loaded successfully (demo: ${result.demo}, provider: ${result.provider || 'unknown'})`);
        
    } catch (error) {
        console.error('Error loading weather data:', error);
        // Fallback to sample weather data
        loadSampleWeatherData(selectedLocation);
    }
}

// Map weather conditions to FontAwesome icons
function getWeatherIcon(condition) {
    if (!condition) return 'fa-sun';
    
    const conditionLower = condition.toLowerCase();
    
    // Handle different weather conditions
    if (conditionLower.includes('clear') || conditionLower.includes('sunny')) {
        return 'fa-sun';
    } else if (conditionLower.includes('partly cloudy') || conditionLower.includes('few clouds')) {
        return 'fa-cloud-sun';
    } else if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) {
        return 'fa-cloud';
    } else if (conditionLower.includes('rain') || conditionLower.includes('shower') || conditionLower.includes('drizzle')) {
        return 'fa-cloud-rain';
    } else if (conditionLower.includes('thunderstorm') || conditionLower.includes('storm')) {
        return 'fa-bolt';
    } else if (conditionLower.includes('snow') || conditionLower.includes('blizzard')) {
        return 'fa-snowflake';
    } else if (conditionLower.includes('mist') || conditionLower.includes('fog') || conditionLower.includes('haze')) {
        return 'fa-smog';
    } else if (conditionLower.includes('wind')) {
        return 'fa-wind';
    } else if (conditionLower.includes('hot') || conditionLower.includes('warm')) {
        return 'fa-sun';
    } else if (conditionLower.includes('cold') || conditionLower.includes('cool')) {
        return 'fa-snowflake';
    } else {
        // Default fallback based on temperature if available
        return 'fa-cloud';
    }
}

// Update weather display with API data
function updateWeatherDisplay(weatherData, isDemo = false, warning = null) {
    console.log('📊 Updating weather display with:', weatherData);
    
    const { current, tempRange, windRange, hourlyData, dailyForecast } = weatherData;
    
    // Update current weather display
    if (current) {
        document.getElementById('currentTemp').textContent = `${current.temp}°C`;
        document.getElementById('currentCondition').textContent = current.condition;
        document.getElementById('visibility').textContent = current.visibility || '10';
        document.getElementById('humidity').textContent = current.humidity || '65';
        document.getElementById('windSpeed').textContent = current.wind || '12';
        document.getElementById('pressure').textContent = current.pressure || '1013';
        document.getElementById('uvIndex').textContent = current.uvIndex || '6';
        document.getElementById('rainChance').textContent = current.precipitationChance || '30';
        
        // Update current weather icon based on condition
        const currentIconElement = document.getElementById('currentIcon');
        if (currentIconElement) {
            const iconClass = getWeatherIcon(current.condition);
            currentIconElement.className = `fas ${iconClass}`;
            console.log(`🌡️ Updated current weather icon to: ${iconClass} for condition: ${current.condition}`);
        }
    }
    
    // Update forecast cards
    if (dailyForecast && dailyForecast.length > 0) {
        updateForecastCards(dailyForecast);
    }
    
    // Update weather charts with API data
    if (hourlyData && hourlyData.length > 0) {
        updateWeatherChartsWithAPIData(hourlyData, tempRange, windRange);
    } else {
        // Fallback to generated chart data if no hourly data
        const mockWeather = {
            temp: current.temp,
            tempRange: tempRange,
            windRange: windRange,
            wind: current.wind,
            precipitationChance: current.precipitationChance
        };
        updateWeatherCharts(currentWeatherLocation, mockWeather);
    }
    
    // Show warning if API is in demo mode or has issues
    if (warning) {
        console.warn('⚠️ Weather API warning:', warning);
    }
    
    if (isDemo) {
        console.info('🎭 Using demo weather data');
    }
}

// Update weather provider badge display
function updateWeatherProviderBadge(providerName, isDemo = false) {
    const badge = document.getElementById('weatherProviderBadge');
    const nameElement = document.getElementById('weatherProviderName');
    
    if (!badge || !nameElement) return;
    
    if (providerName) {
        // Capitalize provider name for display
        const displayName = providerName.charAt(0).toUpperCase() + providerName.slice(1);
        nameElement.textContent = displayName;
        badge.style.display = '';
        
        // Add demo indicator if needed
        if (isDemo) {
            badge.classList.add('badge-warning');
            badge.title = 'Using demo data (API key required for live weather)';
        } else {
            badge.classList.remove('badge-warning');
            badge.title = `Weather data provided by ${displayName}`;
        }
    } else {
        badge.style.display = 'none';
    }
}

// Update forecast cards with API data
function updateForecastCards(dailyForecast) {
    const container = document.getElementById('forecastContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    dailyForecast.slice(0, 7).forEach(forecast => {
        const forecastCard = document.createElement('div');
        forecastCard.className = 'card bg-base-100 shadow-md p-3 text-center';
        forecastCard.innerHTML = `
            <div class="text-sm font-semibold mb-2">${forecast.day}</div>
            <i class="fas ${forecast.icon} text-2xl text-primary mb-2"></i>
            <div class="text-lg font-bold">${forecast.temp}°</div>
            <div class="text-xs text-base-content/70">${forecast.condition}</div>
        `;
        container.appendChild(forecastCard);
    });
}

// Update weather charts with real API hourly data
function updateWeatherChartsWithAPIData(hourlyData, tempRange, windRange) {
    if (!charts || !charts.temperature || !charts.wind) {
        console.warn('Weather charts not initialized yet');
        return;
    }
    
    console.log('🌡️ Updating weather charts with API data');
    
    // Prepare data arrays for charts
    const hourlyLabels = [];
    const temperatureData = [];
    const windSpeedData = [];
    const precipitationData = [];
    
    // Process hourly data (extend to 24 hours if needed)
    const currentHour = new Date().getHours();
    
    for (let i = 0; i < 24; i++) {
        const hour = (currentHour + i) % 24;
        hourlyLabels.push(`${hour}:00`);
        
        if (i < hourlyData.length) {
            // Use real API data
            const data = hourlyData[i];
            temperatureData.push(data.temp);
            windSpeedData.push(data.windSpeed);
            precipitationData.push(Math.max(0, Math.min(100, data.precipitation || 0)));
        } else {
            // Extrapolate for remaining hours
            const lastData = hourlyData[hourlyData.length - 1];
            const tempVariation = tempRange ? (tempRange.max - tempRange.min) / 4 : 5;
            const windVariation = windRange ? (windRange.max - windRange.min) / 4 : 5;
            
            // Create natural temperature curve
            const tempOffset = tempVariation * Math.sin((hour - 6) / 24 * Math.PI * 2) * 0.6;
            const windOffset = (Math.random() - 0.5) * windVariation;
            
            temperatureData.push(Math.round((lastData.temp + tempOffset) * 10) / 10);
            windSpeedData.push(Math.max(0, Math.round(lastData.windSpeed + windOffset)));
            precipitationData.push(Math.max(0, Math.min(100, (lastData.precipitation || 30) + (Math.random() - 0.5) * 20)));
        }
    }
    
    // Update temperature chart
    if (charts.temperature) {
        charts.temperature.data.labels = hourlyLabels;
        charts.temperature.data.datasets[0].data = temperatureData;
        charts.temperature.update('none');
    }
    
    // Update wind chart
    if (charts.wind) {
        charts.wind.data.labels = hourlyLabels;
        charts.wind.data.datasets[0].data = windSpeedData;
        
        // Update precipitation dataset if it exists
        if (charts.wind.data.datasets[1]) {
            charts.wind.data.datasets[1].data = precipitationData;
        }
        
        charts.wind.update('none');
    }
    
    console.log('✅ Weather charts updated with API data');
}

// Load sample weather data
function loadSampleWeatherData(location = 'London,GB') {
    // Generate sample weather based on location (simplified)
    const locationWeather = {
        'London,GB': { 
            temp: 18, condition: 'Cloudy', humidity: 75, wind: 15,
            tempRange: { min: 12, max: 22 }, windRange: { min: 8, max: 25 }, precipitationChance: 70
        },
        'Milan,IT': { 
            temp: 24, condition: 'Sunny', humidity: 60, wind: 8,
            tempRange: { min: 18, max: 30 }, windRange: { min: 3, max: 15 }, precipitationChance: 20
        },
        'Paris,FR': { 
            temp: 20, condition: 'Partly Cloudy', humidity: 68, wind: 12,
            tempRange: { min: 15, max: 25 }, windRange: { min: 6, max: 20 }, precipitationChance: 45
        },
        'Berlin,DE': { 
            temp: 16, condition: 'Overcast', humidity: 72, wind: 18,
            tempRange: { min: 10, max: 22 }, windRange: { min: 12, max: 28 }, precipitationChance: 60
        },
        'Madrid,ES': { 
            temp: 28, condition: 'Hot', humidity: 45, wind: 6,
            tempRange: { min: 22, max: 35 }, windRange: { min: 2, max: 12 }, precipitationChance: 10
        },
        'Amsterdam,NL': { 
            temp: 17, condition: 'Windy', humidity: 78, wind: 22,
            tempRange: { min: 12, max: 20 }, windRange: { min: 15, max: 30 }, precipitationChance: 65
        },
        'Rome,IT': { 
            temp: 26, condition: 'Warm', humidity: 55, wind: 7,
            tempRange: { min: 20, max: 32 }, windRange: { min: 3, max: 14 }, precipitationChance: 25
        },
        'Barcelona,ES': { 
            temp: 25, condition: 'Pleasant', humidity: 62, wind: 10,
            tempRange: { min: 19, max: 29 }, windRange: { min: 5, max: 18 }, precipitationChance: 30
        },
        'Vienna,AT': { 
            temp: 19, condition: 'Mild', humidity: 65, wind: 11,
            tempRange: { min: 13, max: 25 }, windRange: { min: 6, max: 18 }, precipitationChance: 40
        },
        'Prague,CZ': { 
            temp: 17, condition: 'Cool', humidity: 70, wind: 13,
            tempRange: { min: 11, max: 23 }, windRange: { min: 8, max: 20 }, precipitationChance: 50
        },
        'New York,US': { 
            temp: 22, condition: 'Variable', humidity: 68, wind: 14,
            tempRange: { min: 16, max: 28 }, windRange: { min: 8, max: 22 }, precipitationChance: 40
        },
        'Los Angeles,US': { 
            temp: 27, condition: 'Sunny', humidity: 50, wind: 5,
            tempRange: { min: 21, max: 32 }, windRange: { min: 2, max: 10 }, precipitationChance: 5
        },
        'Chicago,US': { 
            temp: 20, condition: 'Breezy', humidity: 72, wind: 16,
            tempRange: { min: 14, max: 26 }, windRange: { min: 10, max: 25 }, precipitationChance: 45
        },
        'Toronto,CA': { 
            temp: 18, condition: 'Fresh', humidity: 68, wind: 12,
            tempRange: { min: 12, max: 24 }, windRange: { min: 7, max: 18 }, precipitationChance: 35
        },
        'Sydney,AU': { 
            temp: 23, condition: 'Pleasant', humidity: 60, wind: 15,
            tempRange: { min: 17, max: 28 }, windRange: { min: 10, max: 25 }, precipitationChance: 30
        },
        'Tokyo,JP': { 
            temp: 21, condition: 'Humid', humidity: 75, wind: 9,
            tempRange: { min: 16, max: 26 }, windRange: { min: 5, max: 15 }, precipitationChance: 55
        },
        'Singapore,SG': { 
            temp: 30, condition: 'Tropical', humidity: 85, wind: 8,
            tempRange: { min: 26, max: 34 }, windRange: { min: 4, max: 12 }, precipitationChance: 75
        }
    };
    
    const weather = locationWeather[location] || locationWeather['London,GB'];
    
    // Update weather display
    document.getElementById('currentTemp').textContent = `${weather.temp}°C`;
    document.getElementById('currentCondition').textContent = weather.condition;
    document.getElementById('currentLocation').textContent = location.split(',')[0];
    document.getElementById('visibility').textContent = '10';
    document.getElementById('humidity').textContent = weather.humidity;
    document.getElementById('windSpeed').textContent = weather.wind;
    document.getElementById('pressure').textContent = '1013';
    document.getElementById('uvIndex').textContent = '6';
    document.getElementById('rainChance').textContent = weather.precipitationChance;
    
    // Update current weather icon based on condition
    const currentIconElement = document.getElementById('currentIcon');
    if (currentIconElement) {
        const iconClass = getWeatherIcon(weather.condition);
        currentIconElement.className = `fas ${iconClass}`;
        console.log(`🌡️ Updated current weather icon to: ${iconClass} for condition: ${weather.condition}`);
    }
    
    // Generate location-based forecast
    generateLocationForecast(location);
    
// Update weather charts with location-specific data
    updateWeatherCharts(location, weather);
}

// Update weather charts with location-specific data
function updateWeatherCharts(location, weather) {
    if (!charts || !charts.temperature || !charts.wind) {
        console.warn('Weather charts not initialized yet');
        return;
    }
    
    console.log(`🌡️ Updating weather charts for: ${location}`);
    
    // Generate 24-hour temperature and wind data
    const hourlyLabels = [];
    const temperatureData = [];
    const windSpeedData = [];
    const precipitationData = [];
    
    const currentHour = new Date().getHours();
    
    for (let i = 0; i < 24; i++) {
        const hour = (currentHour + i) % 24;
        hourlyLabels.push(`${hour}:00`);
        
        // Generate realistic temperature curve based on location
        const baseTemp = weather.temp;
        const tempRange = weather.tempRange;
        const tempVariation = (tempRange.max - tempRange.min) / 2;
        
        // Create a natural temperature curve (cooler at night, warmer in afternoon)
        let hourlyTemp = baseTemp + tempVariation * Math.sin((hour - 6) / 24 * Math.PI * 2) * 0.8;
        
        // Add some randomness for realism
        hourlyTemp += (Math.random() - 0.5) * 3;
        
        // Clamp to realistic range
        hourlyTemp = Math.max(tempRange.min, Math.min(tempRange.max, hourlyTemp));
        temperatureData.push(Math.round(hourlyTemp * 10) / 10);
        
        // Generate wind speed data
        const baseWind = weather.wind;
        const windRange = weather.windRange;
        
        // Wind typically varies throughout the day
        let hourlyWind = baseWind + (windRange.max - windRange.min) * 0.3 * Math.sin((hour - 12) / 24 * Math.PI * 2);
        hourlyWind += (Math.random() - 0.5) * windRange.max * 0.2;
        
        // Clamp to realistic range
        hourlyWind = Math.max(windRange.min, Math.min(windRange.max, hourlyWind));
        windSpeedData.push(Math.round(hourlyWind));
        
        // Generate precipitation probability
        const basePrecip = weather.precipitationChance;
        let hourlyPrecip = basePrecip + (Math.random() - 0.5) * 30;
        
        // Add some pattern - higher chance in late afternoon/evening for many locations
        if (hour >= 15 && hour <= 19) {
            hourlyPrecip += 15;
        }
        
        // Clamp to 0-100 range
        hourlyPrecip = Math.max(0, Math.min(100, hourlyPrecip));
        precipitationData.push(Math.round(hourlyPrecip));
    }
    
    // Update temperature chart
    if (charts.temperature) {
        charts.temperature.data.labels = hourlyLabels;
        charts.temperature.data.datasets[0].data = temperatureData;
        charts.temperature.update('none'); // Use 'none' for immediate update without animation
    }
    
    // Update wind chart
    if (charts.wind) {
        charts.wind.data.labels = hourlyLabels;
        charts.wind.data.datasets[0].data = windSpeedData;
        
        // Only update precipitation dataset if it exists
        if (charts.wind.data.datasets[1]) {
            charts.wind.data.datasets[1].data = precipitationData;
        }
        
        charts.wind.update('none'); // Use 'none' for immediate update without animation
    }
    
    console.log(`✅ Weather charts updated with data for ${location}`);
}

// Generate forecast based on location
function generateLocationForecast(location = 'London,GB') {
    const container = document.getElementById('forecastContainer');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Base weather patterns by location
    const locationPatterns = {
        'London,GB': {
            icons: ['fa-cloud', 'fa-cloud-rain', 'fa-cloud', 'fa-cloud-sun', 'fa-sun', 'fa-cloud', 'fa-cloud-rain'],
            temps: [18, 15, 17, 20, 22, 19, 16],
            conditions: ['Cloudy', 'Light Rain', 'Overcast', 'Partly Cloudy', 'Sunny', 'Cloudy', 'Showers']
        },
        'Milan,IT': {
            icons: ['fa-sun', 'fa-sun', 'fa-cloud-sun', 'fa-cloud', 'fa-cloud-sun', 'fa-sun', 'fa-sun'],
            temps: [24, 26, 23, 21, 25, 27, 28],
            conditions: ['Sunny', 'Hot', 'Partly Cloudy', 'Cloudy', 'Sunny', 'Very Hot', 'Sunny']
        },
        'Paris,FR': {
            icons: ['fa-cloud-sun', 'fa-cloud', 'fa-cloud-rain', 'fa-sun', 'fa-cloud-sun', 'fa-cloud', 'fa-sun'],
            temps: [20, 18, 16, 22, 21, 19, 23],
            conditions: ['Partly Cloudy', 'Cloudy', 'Light Rain', 'Sunny', 'Fair', 'Overcast', 'Clear']
        },
        'Berlin,DE': {
            icons: ['fa-cloud', 'fa-cloud', 'fa-cloud-rain', 'fa-cloud-rain', 'fa-cloud-sun', 'fa-cloud', 'fa-sun'],
            temps: [16, 14, 12, 15, 18, 17, 20],
            conditions: ['Overcast', 'Cold', 'Rainy', 'Showers', 'Improving', 'Cloudy', 'Fair']
        },
        'Madrid,ES': {
            icons: ['fa-sun', 'fa-sun', 'fa-sun', 'fa-cloud-sun', 'fa-sun', 'fa-sun', 'fa-sun'],
            temps: [28, 30, 32, 29, 31, 33, 29],
            conditions: ['Hot', 'Very Hot', 'Scorching', 'Warm', 'Hot', 'Blazing', 'Sunny']
        },
        'Amsterdam,NL': {
            icons: ['fa-cloud', 'fa-cloud-rain', 'fa-wind', 'fa-cloud-rain', 'fa-cloud-sun', 'fa-cloud', 'fa-wind'],
            temps: [17, 15, 14, 16, 19, 18, 16],
            conditions: ['Cloudy', 'Rainy', 'Windy', 'Wet', 'Brighter', 'Overcast', 'Breezy']
        },
        'Rome,IT': {
            icons: ['fa-sun', 'fa-sun', 'fa-cloud-sun', 'fa-sun', 'fa-cloud-sun', 'fa-sun', 'fa-sun'],
            temps: [26, 28, 25, 27, 24, 29, 30],
            conditions: ['Warm', 'Hot', 'Pleasant', 'Sunny', 'Nice', 'Very Hot', 'Blazing']
        },
        'Barcelona,ES': {
            icons: ['fa-sun', 'fa-cloud-sun', 'fa-sun', 'fa-cloud-sun', 'fa-sun', 'fa-sun', 'fa-cloud-sun'],
            temps: [25, 23, 27, 24, 26, 28, 25],
            conditions: ['Sunny', 'Pleasant', 'Hot', 'Nice', 'Warm', 'Very Hot', 'Fair']
        },
        'Vienna,AT': {
            icons: ['fa-cloud-sun', 'fa-cloud', 'fa-cloud-rain', 'fa-sun', 'fa-cloud-sun', 'fa-cloud', 'fa-sun'],
            temps: [19, 17, 15, 21, 20, 18, 22],
            conditions: ['Mild', 'Cool', 'Rainy', 'Pleasant', 'Fair', 'Overcast', 'Sunny']
        },
        'Prague,CZ': {
            icons: ['fa-cloud', 'fa-cloud-rain', 'fa-cloud', 'fa-cloud-sun', 'fa-sun', 'fa-cloud', 'fa-cloud-rain'],
            temps: [17, 14, 16, 19, 21, 18, 15],
            conditions: ['Cool', 'Chilly', 'Overcast', 'Improving', 'Nice', 'Cloudy', 'Wet']
        },
        'New York,US': {
            icons: ['fa-cloud-sun', 'fa-cloud', 'fa-cloud-rain', 'fa-sun', 'fa-cloud-sun', 'fa-cloud', 'fa-sun'],
            temps: [22, 20, 18, 24, 23, 21, 25],
            conditions: ['Variable', 'Cloudy', 'Rainy', 'Clear', 'Pleasant', 'Overcast', 'Sunny']
        },
        'Los Angeles,US': {
            icons: ['fa-sun', 'fa-sun', 'fa-sun', 'fa-sun', 'fa-cloud-sun', 'fa-sun', 'fa-sun'],
            temps: [27, 29, 31, 28, 26, 30, 32],
            conditions: ['Sunny', 'Hot', 'Very Hot', 'Warm', 'Pleasant', 'Scorching', 'Blazing']
        },
        'Chicago,US': {
            icons: ['fa-cloud', 'fa-wind', 'fa-cloud-rain', 'fa-cloud-sun', 'fa-sun', 'fa-cloud', 'fa-wind'],
            temps: [20, 18, 16, 22, 24, 19, 17],
            conditions: ['Cloudy', 'Windy', 'Stormy', 'Clearing', 'Pleasant', 'Overcast', 'Breezy']
        },
        'Toronto,CA': {
            icons: ['fa-cloud-sun', 'fa-cloud', 'fa-cloud-rain', 'fa-sun', 'fa-cloud-sun', 'fa-cloud', 'fa-sun'],
            temps: [18, 16, 14, 20, 19, 17, 21],
            conditions: ['Fresh', 'Cool', 'Wet', 'Pleasant', 'Nice', 'Cloudy', 'Clear']
        },
        'Sydney,AU': {
            icons: ['fa-sun', 'fa-cloud-sun', 'fa-sun', 'fa-cloud-sun', 'fa-sun', 'fa-cloud-sun', 'fa-sun'],
            temps: [23, 21, 25, 22, 24, 20, 26],
            conditions: ['Pleasant', 'Nice', 'Warm', 'Fair', 'Sunny', 'Cool', 'Hot']
        },
        'Tokyo,JP': {
            icons: ['fa-cloud', 'fa-cloud-rain', 'fa-cloud', 'fa-cloud-sun', 'fa-sun', 'fa-cloud-rain', 'fa-cloud'],
            temps: [21, 19, 20, 23, 25, 18, 22],
            conditions: ['Humid', 'Wet', 'Muggy', 'Clearing', 'Pleasant', 'Rainy', 'Sticky']
        },
        'Singapore,SG': {
            icons: ['fa-cloud-rain', 'fa-sun', 'fa-cloud-rain', 'fa-cloud-sun', 'fa-cloud-rain', 'fa-sun', 'fa-cloud-rain'],
            temps: [30, 32, 29, 31, 28, 33, 30],
            conditions: ['Tropical', 'Hot', 'Stormy', 'Humid', 'Wet', 'Scorching', 'Steamy']
        }
    };
    
    const pattern = locationPatterns[location] || locationPatterns['London,GB'];
    container.innerHTML = '';
    
    for (let i = 0; i < 7; i++) {
        const forecastCard = document.createElement('div');
        forecastCard.className = 'card bg-base-100 shadow-md p-3 text-center';
        forecastCard.innerHTML = `
            <div class="text-sm font-semibold mb-2">${days[i]}</div>
            <i class="fas ${pattern.icons[i]} text-2xl text-primary mb-2"></i>
            <div class="text-lg font-bold">${pattern.temps[i]}°</div>
            <div class="text-xs text-base-content/70">${pattern.conditions[i]}</div>
        `;
        container.appendChild(forecastCard);
    }
}

// Sample Data Loading
function loadSampleData() {
    // Update global stats in dashboard
    updateGlobalStatElements('2,847', '125.3 km', '15', '8.5h');
    updateDatabaseStatus('error', 'Using sample data');
    
    // Initialize weather location input if not already done
    const locationInput = document.getElementById('weatherLocationInput');
    if (locationInput && !locationInput.value) {
        initializeWeatherLocationInput();
    }
    
    // Load weather data for current location
    loadWeatherData();
    
    // Load sample chart data
    loadSampleChartData();
}

function loadSampleChartData() {
    if (typeof Chart === 'undefined' || !charts || !charts.calories) {
        console.warn('Charts not initialized yet, skipping sample data loading');
        return;
    }
    
    // Sample data for the last 7 days
    const dates = [];
    const calories = [];
    const distances = [];
    const avgSpeeds = [];
    const maxSpeeds = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }));
        calories.push(Math.floor(Math.random() * 500) + 200);
        distances.push(Math.floor(Math.random() * 30) + 10);
        avgSpeeds.push(Math.floor(Math.random() * 10) + 12);
        maxSpeeds.push(Math.floor(Math.random() * 15) + 20);
    }
    
    // Update calories chart
    charts.calories.data.labels = dates;
    charts.calories.data.datasets[0].data = calories;
    charts.calories.update();
    
    // Update distance chart
    charts.distance.data.labels = dates;
    charts.distance.data.datasets[0].data = distances;
    charts.distance.update();
    
    // Update speed chart
    charts.speed.data.labels = dates;
    charts.speed.data.datasets[0].data = avgSpeeds;
    // Only update max speed dataset if it exists
    if (charts.speed.data.datasets[1]) {
        charts.speed.data.datasets[1].data = maxSpeeds;
    }
    charts.speed.update();
    
    // Sample elevation data
    const elevationData = [];
    const distancePoints = [];
    for (let i = 0; i <= 20; i++) {
        distancePoints.push(i);
        elevationData.push(Math.sin(i / 3) * 100 + 200 + Math.random() * 50);
    }
    
    charts.elevation.data.labels = distancePoints;
    charts.elevation.data.datasets[0].data = elevationData;
    charts.elevation.update();
    
    // Only update weather charts if they don't have location-specific data
    // Check if weather charts have been updated with location data
    const hasLocationWeatherData = charts.temperature.data.labels.length > 0 && 
                                   charts.temperature.data.labels[0].includes(':');
    
    if (!hasLocationWeatherData) {
        // Sample weather data (fallback)
        const hourlyDates = [];
        const temperatures = [];
        const windSpeeds = [];
        const precipitation = [];
        
        for (let i = 0; i < 24; i++) {
            hourlyDates.push(`${i}:00`);
            temperatures.push(15 + Math.sin((i - 6) / 24 * Math.PI * 2) * 8 + Math.random() * 3);
            windSpeeds.push(Math.random() * 15 + 5);
            precipitation.push(Math.random() * 80);
        }
        
        charts.temperature.data.labels = hourlyDates;
        charts.temperature.data.datasets[0].data = temperatures;
        charts.temperature.update();
        
        charts.wind.data.labels = hourlyDates;
        charts.wind.data.datasets[0].data = windSpeeds;
        // Only update precipitation dataset if it exists
        if (charts.wind.data.datasets[1]) {
            charts.wind.data.datasets[1].data = precipitation;
        }
        charts.wind.update();
    } else {
        console.log('📊 Skipping weather chart update - location-specific data already loaded');
    }
}

// HTMX Event Handlers
document.body.addEventListener('htmx:beforeRequest', function(evt) {
    console.log('HTMX Request starting:', evt.detail.requestConfig.path);
});

document.body.addEventListener('htmx:afterRequest', function(evt) {
    console.log('HTMX Request completed:', evt.detail.requestConfig.path);
    
    // Handle successful upload
    if (evt.detail.requestConfig.path === '/upload' && evt.detail.successful) {
        // Refresh charts with new database data
        setTimeout(() => {
            console.log('📋 Upload successful, refreshing dashboard data...');
            loadDatabaseData();
        }, 1000);
    }
    
    // Handle successful filter-data request
    if (evt.detail.requestConfig.path === '/filter-data' && evt.detail.successful) {
        console.log('✅ Filter data request completed, reinitializing charts...');
        // Wait a bit for the DOM to update, then reinitialize charts
        setTimeout(() => {
            initializeChartsInFilteredContent();
        }, 100);
    }
});

// Function to initialize charts in the filtered content
function initializeChartsInFilteredContent() {
    try {
        // Check if chart canvases exist in the filtered content
        const caloriesCanvas = document.querySelector('#stats-content #caloriesChart');
        const distanceCanvas = document.querySelector('#stats-content #distanceChart');
        
        if (caloriesCanvas && distanceCanvas) {
            console.log('Reinitializing charts in filtered content...');
            
            // Destroy existing charts if they exist to prevent conflicts
            if (charts.calories) charts.calories.destroy();
            if (charts.distance) charts.distance.destroy();
            
            // Initialize new charts for the filtered content
            const caloriesCtx = caloriesCanvas.getContext('2d');
            const distanceCtx = distanceCanvas.getContext('2d');
            
            charts.calories = new Chart(caloriesCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Calories Burned',
                        data: [],
                        borderColor: 'rgb(99, 102, 241)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: true, title: { display: true, text: 'Date' } },
                        y: { beginAtZero: true, title: { display: true, text: 'Calories' } }
                    }
                }
            });
            
            charts.distance = new Chart(distanceCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Distance (km)',
                        data: [],
                        backgroundColor: 'rgba(34, 197, 94, 0.8)',
                        borderColor: 'rgb(34, 197, 94)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: true, title: { display: true, text: 'Date' } },
                        y: { beginAtZero: true, title: { display: true, text: 'Distance (km)' } }
                    }
                }
            });
            
            console.log('✅ Charts reinitialized successfully');
            
            // Load sample data for the charts (this will be replaced by actual filtered data later)
            loadSampleChartData();
        } else {
            console.log('No chart canvases found in filtered content');
        }
    } catch (error) {
        console.error('❌ Error reinitializing charts:', error);
    }
}

document.body.addEventListener('htmx:responseError', function(evt) {
    console.error('HTMX Error:', evt.detail);
    
    // Show error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error mt-4';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle mr-2"></i>
        <span>Error processing request. Please try again.</span>
    `;
    
    const targetElement = document.getElementById(evt.detail.target.id);
    if (targetElement) {
        targetElement.innerHTML = '';
        targetElement.appendChild(errorDiv);
    }
});

// Utility Functions
function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

function formatDate(date) {
    return new Intl.DateTimeFormat('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

// Helper function to detect likely duplicate filenames
function isLikelyDuplicateFilename(filename) {
    const duplicatePatterns = [
        /\s*\(\d+\)\.gpx$/i,        // filename (1).gpx, filename (2).gpx
        /\s*-\s*copy\.gpx$/i,       // filename - copy.gpx
        /\s*copy\.gpx$/i,          // filename copy.gpx
        /\s*\d+\.gpx$/i,           // filename1.gpx, filename2.gpx
        /\s*-\s*\d+\.gpx$/i        // filename-1.gpx, filename-2.gpx
    ];
    
    return duplicatePatterns.some(pattern => pattern.test(filename));
}

// Debounced location search function
function debouncedLocationSearch(callback, delay = 1000) {
    return function(locationName) {
        clearTimeout(geocodingDebounceTimer);
        geocodingDebounceTimer = setTimeout(() => {
            callback(locationName);
        }, delay);
    };
}

// Location search handler
const handleLocationSearch = debouncedLocationSearch(async (locationName) => {
    if (!locationName || locationName.length < 2) {
        return;
    }
    
    console.log(`🔍 Searching for location: ${locationName}`);
    
    const locationData = await geocodeLocation(locationName);
    if (locationData) {
        console.log(`📍 Location updated to: ${currentWeatherLocation}`);
        
        // Save to configuration
        // await saveLocationConfiguration(currentWeatherLocation);
        
        // Load weather data for new location
        loadWeatherData(currentWeatherLocation);
        
        // Show feedback
        const btn = document.getElementById('refreshWeatherBtn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check text-success"></i>';
            setTimeout(() => {
                btn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            }, 1500);
        }
    }
});

// Weather Location Event Handlers
document.addEventListener('DOMContentLoaded', function() {
    // Initialize weather location input
    initializeWeatherLocationInput();
    
    // Location input event handlers
    const locationInput = document.getElementById('weatherLocationInput');
    if (locationInput) {
        // Input event for real-time search (debounced)
        locationInput.addEventListener('input', function(e) {
            const value = e.target.value.trim();
            
            // Reset status icon to search
            const statusDiv = document.getElementById('locationStatus');
            if (statusDiv && value.length > 0) {
                statusDiv.innerHTML = '<i class="fas fa-search text-base-content/50"></i>';
                statusDiv.title = '';
            }
            
            // Trigger debounced search
            if (value.length >= 2) {
                handleLocationSearch(value);
            }
        });
        
        // Enter key to trigger immediate search
        locationInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = e.target.value.trim();
                
                if (value.length >= 2) {
                    // Cancel debounced search and do immediate search
                    clearTimeout(geocodingDebounceTimer);
                    handleLocationSearch.call(this, value);
                }
            }
        });
        
        // Focus and blur events for better UX
        locationInput.addEventListener('focus', function() {
            this.select(); // Select all text when focused
        });
        
        locationInput.addEventListener('blur', function() {
            const value = this.value.trim();
            if (value.length === 0) {
                // Reset to current location name if empty
                const cityName = currentWeatherLocation.split(',')[0];
                this.value = cityName;
            }
        });
    }
    
    // Refresh weather button event
    const refreshBtn = document.getElementById('refreshWeatherBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            console.log('🔄 Refreshing weather data...');
            loadWeatherData(currentWeatherLocation);
            
            // Animate refresh button
            this.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
            setTimeout(() => {
                this.innerHTML = '<i class="fas fa-sync-alt"></i>';
            }, 1000);
        });
    }
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Load data from database or fallback to sample data
async function loadDatabaseData() {
    console.log('📊 Loading database data...');
    updateDatabaseStatus('loading', 'Loading data...');
    
    try {
        const response = await fetch('/api/dashboard');
        console.log('API Response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Database data received:', data);
            displayDatabaseStatistics(data.statistics);
            loadDatabaseChartData(data.chartData);
            displayRecentRides(data.recentRides);
            displayPerformanceTrends(data.trends);
            
            // Load weather data for current location
            loadWeatherData();
            
            console.log('✅ Database data loaded successfully');
        } else {
            throw new Error(`API responded with status ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        updateDatabaseStatus('error', 'Connection failed');
        loadSampleData();
    }
}

// Display global statistics from database
function displayDatabaseStatistics(stats) {
    if (!stats || !stats.hasData) {
        // Update global stats display with zero values
        updateGlobalStatElements('0', '0 km', '0', '0h');
        updateDatabaseStatus('connected', 'No data yet');
        
        // Add a banner to encourage data upload to dashboard content
        const dashboardContent = document.getElementById('dashboard-content');
        if (dashboardContent) {
            dashboardContent.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-bicycle text-8xl text-base-content/20 mb-6"></i>
                    <h3 class="text-2xl font-bold mb-4">No Cycling Data Yet</h3>
                    <p class="text-base-content/70 mb-6">Upload your first GPX file to start tracking your cycling progress!</p>
                    <a href="#upload" class="btn btn-primary">
                        <i class="fas fa-upload mr-2"></i>
                        Upload Your First GPX File
                    </a>
                </div>
            `;
        }
        return;
    }
    
    // Update global statistics in header
    updateGlobalStatElements(
        parseInt(stats.totalCalories).toLocaleString(),
        `${stats.totalDistance} km`,
        stats.totalRides.toString(),
        stats.totalTime
    );
    updateDatabaseStatus('connected', 'Data loaded');
    
    // Update dashboard content with summary stats
    const dashboardContent = document.getElementById('dashboard-content');
    if (dashboardContent) {
        dashboardContent.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="card bg-gradient-to-r from-primary to-primary-focus text-primary-content">
                    <div class="card-body">
                        <h3 class="card-title text-white">
                            <i class="fas fa-fire mr-2"></i>
                            Performance Summary
                        </h3>
                        <div class="grid grid-cols-2 gap-4 mt-4">
                            <div class="text-center">
                                <div class="text-2xl font-bold">${stats.totalRides}</div>
                                <div class="text-xs opacity-80">Total Rides</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-bold">${parseInt(stats.totalElevation).toLocaleString()}m</div>
                                <div class="text-xs opacity-80">Elevation Climbed</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-bold">${stats.avgCaloriesPerKm}</div>
                                <div class="text-xs opacity-80">Cal/km Avg</div>
                            </div>
                            <div class="text-center">
                                <div class="text-2xl font-bold">${stats.avgSpeed}</div>
                                <div class="text-xs opacity-80">km/h Avg</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card bg-base-200">
                    <div class="card-body">
                        <h3 class="card-title">
                            <i class="fas fa-calendar-alt mr-2 text-secondary"></i>
                            Activity Period
                        </h3>
                        <div class="space-y-2 mt-4">
                            <div class="flex justify-between items-center">
                                <span class="text-sm opacity-70">First Ride:</span>
                                <span class="font-semibold">${stats.firstRide || 'N/A'}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm opacity-70">Latest Ride:</span>
                                <span class="font-semibold">${stats.lastRide || 'N/A'}</span>
                            </div>
                            <div class="divider my-2"></div>
                            <div class="text-center">
                                <div class="text-lg font-bold text-accent">
                                    ${Math.round((stats.totalCalories / stats.totalRides) || 0)}
                                </div>
                                <div class="text-xs opacity-70">Avg Calories per Ride</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card bg-base-200">
                    <div class="card-body">
                        <h3 class="card-title">
                            <i class="fas fa-chart-line mr-2 text-info"></i>
                            Quick Actions
                        </h3>
                        <div class="space-y-3 mt-4">
                            <a href="#upload" class="btn btn-primary btn-sm w-full">
                                <i class="fas fa-upload mr-2"></i>
                                Upload New GPX
                            </a>
                            <a href="#stats" class="btn btn-outline btn-sm w-full">
                                <i class="fas fa-chart-bar mr-2"></i>
                                View Detailed Stats
                            </a>
                            <a href="#configuration" class="btn btn-outline btn-sm w-full">
                                <i class="fas fa-cog mr-2"></i>
                                Settings
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Load chart data from database
function loadDatabaseChartData(chartData) {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not available, skipping chart data loading');
        return;
    }
    
    if (!chartData || chartData.length === 0) {
        console.log('📊 No chart data available, loading sample data');
        loadSampleChartData();
        return;
    }
    
    console.log('📊 Loading database chart data:', chartData);
    
    const dates = chartData.map(d => {
        // Handle different date formats that might come from the database
        let date;
        if (d.date === 'Unknown') {
            date = new Date();
        } else if (typeof d.date === 'string' && d.date.includes(' ')) {
            // Handle toDateString() format like "Mon Oct 05 2020"
            date = new Date(d.date);
        } else {
            // Handle other date formats
            date = new Date(d.date);
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.warn('Invalid date in chart data:', d.date);
            date = new Date();
        }
        
        return date.toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: '2-digit'
        });
    });
    const calories = chartData.map(d => d.calories);
    const distances = chartData.map(d => d.distance);
    const speeds = chartData.map(d => d.avgSpeed);
    const elevations = chartData.map(d => d.elevation);
    
    console.log('📊 Chart data mapping:', {
        dates: dates,
        calories: calories,
        distances: distances,
        speeds: speeds,
        elevations: elevations
    });
    
    // Update charts with real data
    if (charts.calories) {
        charts.calories.data.labels = dates;
        charts.calories.data.datasets[0].data = calories;
        charts.calories.update();
    }
    
    if (charts.distance) {
        charts.distance.data.labels = dates;
        charts.distance.data.datasets[0].data = distances;
        charts.distance.update();
    }
    
    if (charts.speed) {
        charts.speed.data.labels = dates;
        charts.speed.data.datasets[0].data = speeds;
        // Remove max speed for now as we don't have that in the database summary
        charts.speed.data.datasets = [charts.speed.data.datasets[0]];
        charts.speed.update();
    }
    
    // For elevation, create a simple profile based on cumulative elevation
    if (charts.elevation) {
        const elevationProfile = [];
        let cumulativeDistance = 0;
        chartData.forEach((point, index) => {
            elevationProfile.push(point.elevation || 0);
        });
        
        charts.elevation.data.labels = chartData.map((_, index) => index * 5); // Approximate km markers
        charts.elevation.data.datasets[0].data = elevationProfile;
        charts.elevation.update();
    }
}

// Display recent rides
function displayRecentRides(rides) {
    if (!rides || rides.length === 0) return;
    
    const ridesHtml = `
        <div class="card bg-base-50 mt-6">
            <div class="card-body">
                <h3 class="card-title mb-4">
                    <i class="fas fa-history text-primary mr-2"></i>
                    Recent Rides
                </h3>
                <div class="overflow-x-auto">
                    <table class="table table-zebra w-full">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Distance</th>
                                <th>Duration</th>
                                <th>Calories</th>
                                <th>avg Speed</th>
                                <th>Elevation gain</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rides.map(ride => `
                                <tr>
                                    <td>${ride.date}</td>
                                    <td>${ride.distance} km</td>
                                    <td>${ride.duration}</td>
                                    <td>${ride.calories} cal</td>
                                    <td>${ride.avgSpeed} km/h</td>
                                    <td>${ride.elevationGain || 0} m</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    // Add to dashboard content
    const dashboardContent = document.getElementById('dashboard-content');
    if (dashboardContent) {
        dashboardContent.insertAdjacentHTML('beforeend', ridesHtml);
    }
}

// Display performance trends
function displayPerformanceTrends(trends) {
    if (!trends) return;
    
    const trendsHtml = `
        <div class="card bg-base-50 mt-6">
            <div class="card-body">
                <h3 class="card-title mb-4">
                    <i class="fas fa-trending-up text-primary mr-2"></i>
                    Performance Trends (Last 90 Days)
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="stat">
                        <div class="stat-title">Average Speed</div>
                        <div class="stat-value text-sm">${trends.speed.second.toFixed(1)} km/h</div>
                        <div class="stat-desc ${
                            trends.speed.change > 0 ? 'text-success' : 
                            trends.speed.change < 0 ? 'text-error' : 'text-base-content/70'
                        }">
                            <i class="fas fa-arrow-${trends.speed.change > 0 ? 'up' : trends.speed.change < 0 ? 'down' : 'right'}"></i>
                            ${trends.speed.change > 0 ? '+' : ''}${trends.speed.change.toFixed(1)}%
                        </div>
                    </div>
                    
                    <div class="stat">
                        <div class="stat-title">Average Distance</div>
                        <div class="stat-value text-sm">${trends.distance.second.toFixed(1)} km</div>
                        <div class="stat-desc ${
                            trends.distance.change > 0 ? 'text-success' : 
                            trends.distance.change < 0 ? 'text-error' : 'text-base-content/70'
                        }">
                            <i class="fas fa-arrow-${trends.distance.change > 0 ? 'up' : trends.distance.change < 0 ? 'down' : 'right'}"></i>
                            ${trends.distance.change > 0 ? '+' : ''}${trends.distance.change.toFixed(1)}%
                        </div>
                    </div>
                    
                    <div class="stat">
                        <div class="stat-title">Calories/km Efficiency</div>
                        <div class="stat-value text-sm">${trends.caloriesPerKm.second.toFixed(0)} cal/km</div>
                        <div class="stat-desc ${
                            trends.caloriesPerKm.change < 0 ? 'text-success' : 
                            trends.caloriesPerKm.change > 0 ? 'text-warning' : 'text-base-content/70'
                        }">
                            <i class="fas fa-arrow-${trends.caloriesPerKm.change > 0 ? 'up' : trends.caloriesPerKm.change < 0 ? 'down' : 'right'}"></i>
                            ${trends.caloriesPerKm.change > 0 ? '+' : ''}${trends.caloriesPerKm.change.toFixed(1)}%
                        </div>
                    </div>
                </div>
                <div class="text-xs text-base-content/60 mt-4">
                    💡 Trends compare the second half of your recent rides with the first half
                </div>
            </div>
        </div>
    `;
    
    // Add to dashboard content
    const dashboardContent = document.getElementById('dashboard-content');
    if (dashboardContent) {
        dashboardContent.insertAdjacentHTML('beforeend', trendsHtml);
    }
}

// Update the global statistics elements in the dashboard
function updateGlobalStatElements(calories, distance, rides, time) {
    const caloriesEl = document.getElementById('globalTotalCalories');
    const distanceEl = document.getElementById('globalTotalDistance');
    const ridesEl = document.getElementById('globalTotalRides');
    const timeEl = document.getElementById('globalTotalTime');
    
    if (caloriesEl) caloriesEl.textContent = calories;
    if (distanceEl) distanceEl.textContent = distance;
    if (ridesEl) ridesEl.textContent = rides;
    if (timeEl) timeEl.textContent = time;
}

// Update database connection status indicator
function updateDatabaseStatus(status, message) {
    const statusIndicator = document.getElementById('dbStatus');
    const statusText = document.getElementById('dbStatusText');
    if (!statusIndicator) return;
    
    // Remove all status classes
    statusIndicator.classList.remove('badge-success', 'badge-warning', 'badge-error', 'opacity-50');
    
    // Add appropriate status class and update content
    switch(status) {
        case 'connected':
            statusIndicator.classList.add('badge-success');
            if (statusText) statusText.textContent = message || 'Connected';
            break;
        case 'loading':
            statusIndicator.classList.add('badge-warning', 'opacity-50');
            if (statusText) statusText.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>' + (message || 'Loading...');
            break;
        case 'error':
            statusIndicator.classList.add('badge-error');
            if (statusText) statusText.textContent = message || 'Error';
            break;
        default:
            statusIndicator.classList.add('badge-warning');
            if (statusText) statusText.textContent = message || 'Unknown';
    }
}

// Show toast-style message to user
function showMessage(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'} fixed top-4 right-4 z-50 max-w-sm shadow-lg`;
    toast.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 4 seconds
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// Display analysis results from GPX upload
function displayResults(data) {
    if (!data) return;
    
    // Update the results section in the UI
    const resultsContainer = document.getElementById('results-content') || document.getElementById('stats-content');
    if (!resultsContainer) return;
    
    const resultHtml = `
        <div class="card bg-base-100 mt-6 border border-primary/20">
            <div class="card-body">
                <h3 class="card-title text-primary mb-4">
                    <i class="fas fa-chart-line mr-2"></i>
                    Latest Analysis Results
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="stat bg-base-200/50 rounded-lg p-4">
                        <div class="stat-title text-sm">Calories Burned</div>
                        <div class="stat-value text-lg text-primary">${data.calories || 0}</div>
                    </div>
                    <div class="stat bg-base-200/50 rounded-lg p-4">
                        <div class="stat-title text-sm">Distance</div>
                        <div class="stat-value text-lg">${data.distance || 0} km</div>
                    </div>
                    <div class="stat bg-base-200/50 rounded-lg p-4">
                        <div class="stat-title text-sm">Duration</div>
                        <div class="stat-value text-lg">${data.duration || 'N/A'}</div>
                    </div>
                    <div class="stat bg-base-200/50 rounded-lg p-4">
                        <div class="stat-title text-sm">Avg Speed</div>
                        <div class="stat-value text-lg">${data.avgSpeed || 0} km/h</div>
                    </div>
                </div>
                ${data.elevation ? `
                    <div class="mt-4 p-3 bg-base-200/30 rounded-lg">
                        <div class="text-sm font-medium mb-1">Elevation Gain</div>
                        <div class="text-lg">${data.elevation} m</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Insert at the beginning of results container
    resultsContainer.insertAdjacentHTML('afterbegin', resultHtml);
}

// ============= CONFIGURATION MANAGEMENT =============
// Configuration has been moved to a dedicated admin-only page at /configuration
// All configuration management functions are now in configuration-manager.js
// This includes:
// - loadConfigurationData()
// - displayConfiguration()
// - createConfigurationInput()
// - getCategoryIcon()
// - formatConfigKey()
// - markConfigurationChanged()
// - saveAllConfigurationChanges()
// - addNewConfiguration()
// - deleteConfiguration()

// Configuration section observer removed - configuration moved to dedicated page

// Responsive chart resize handler
window.addEventListener('resize', function() {
    Object.values(charts).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
            chart.resize();
        }
    });
});

// ========== RIDE ANALYSIS FUNCTIONALITY ==========

// Global variables for ride analysis
let currentRideId = null;
let rideAnalysisCharts = {};

// Show ride analysis modal (globally available)
window.showRideAnalysis = async function(rideId, filename) {
    console.log(`🔍 Showing analysis for ride ${rideId}: ${filename}`);
    console.log('showRideAnalysis function called with:', { rideId, filename });
    
    currentRideId = rideId;
    
    // Open the modal (DaisyUI checkbox method)
    const modalToggle = document.getElementById('rideAnalysisModalToggle');
    if (modalToggle) {
        modalToggle.checked = true;
    }
    
    // Update modal title
    const title = document.getElementById('rideAnalysisTitle');
    const subtitle = document.getElementById('rideAnalysisSubtitle');
    title.textContent = filename || `Ride #${rideId}`;
    subtitle.textContent = 'Loading detailed analysis...';
    
    // Show loading state
    showRideAnalysisLoading(true);
    
    try {
        // Fetch ride analysis data
        const response = await fetch(`/api/rides/${rideId}/analysis`);
        
        if (!response.ok) {
            throw new Error(`Failed to load ride analysis: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Ride analysis data:', data);
        
        // Display the analysis
        displayRideAnalysis(data);
        
    } catch (error) {
        console.error('Error loading ride analysis:', error);
        showRideAnalysisError(error.message);
    }
};

// Close ride analysis modal (DaisyUI method)
window.closeRideAnalysisModal = function() {
    const modalToggle = document.getElementById('rideAnalysisModalToggle');
    if (modalToggle) {
        modalToggle.checked = false;
    }
};

// Show/hide loading state
function showRideAnalysisLoading(show) {
    const loading = document.getElementById('rideAnalysisLoading');
    const content = document.getElementById('rideAnalysisContent');
    
    if (show) {
        loading.classList.remove('hidden');
        content.classList.add('hidden');
    } else {
        loading.classList.add('hidden');
        content.classList.remove('hidden');
    }
}

// Show error state
function showRideAnalysisError(message) {
    const loading = document.getElementById('rideAnalysisLoading');
    const subtitle = document.getElementById('rideAnalysisSubtitle');
    
    loading.innerHTML = `
        <div class="text-center py-12">
            <i class="fas fa-exclamation-triangle text-error text-4xl mb-4"></i>
            <h4 class="text-xl font-semibold text-error mb-2">Analysis Error</h4>
            <p class="text-base-content/70">${message}</p>
            <button class="btn btn-outline btn-sm mt-4" onclick="closeRideAnalysisModal()">
                <i class="fas fa-times mr-2"></i>Close
            </button>
        </div>
    `;
    
    subtitle.textContent = 'Failed to load ride data';
}

// Display ride analysis data
function displayRideAnalysis(data) {
    const { rideInfo, analysis } = data;
    const { summary, metadata } = analysis;
    
    // Update subtitle
    const subtitle = document.getElementById('rideAnalysisSubtitle');
    subtitle.textContent = `${summary.distance.toFixed(2)}km • ${formatTime(summary.totalTime)} • ${analysis.analysis.caloriesBurned.estimated} calories`;
    
    // Display basic statistics
    displayRideBasicStats(summary, analysis.analysis);
    
    // Display detailed analysis table
    displayRideDetailedAnalysis(analysis);
    
    // Display segments
    displayRideSegments(analysis.segments);
    
    // Create charts
    createRideAnalysisCharts(analysis);
    
    // Hide loading and show content
    showRideAnalysisLoading(false);
}

// Display basic statistics
function displayRideBasicStats(summary, analysis) {
    const basicStats = document.getElementById('rideBasicStats');
    
    const stats = [
        {
            icon: 'fa-route',
            value: summary.distance.toFixed(2),
            unit: 'km',
            label: 'Distance'
        },
        {
            icon: 'fa-clock',
            value: formatTime(summary.totalTime),
            unit: '',
            label: 'Total Time'
        },
        {
            icon: 'fa-tachometer-alt',
            value: summary.avgSpeed.toFixed(1),
            unit: 'km/h',
            label: 'Avg Speed'
        },
        {
            icon: 'fa-rocket',
            value: summary.maxSpeed.toFixed(1),
            unit: 'km/h',
            label: 'Max Speed'
        },
        {
            icon: 'fa-mountain',
            value: Math.round(summary.elevationGain),
            unit: 'm',
            label: 'Elevation Gain'
        },
        {
            icon: 'fa-arrow-down',
            value: Math.round(summary.elevationLoss),
            unit: 'm',
            label: 'Elevation Loss'
        },
        {
            icon: 'fa-fire',
            value: analysis.caloriesBurned.estimated,
            unit: 'kcal',
            label: 'Calories Burned'
        },
        {
            icon: 'fa-running',
            value: formatTime(summary.movingTime),
            unit: '',
            label: 'Moving Time'
        }
    ];

    basicStats.innerHTML = stats.map(stat => `
        <div class="stat bg-base-100 rounded-lg border border-base-300">
            <div class="stat-figure text-primary">
                <i class="fas ${stat.icon}"></i>
            </div>
            <div class="stat-value text-sm">${stat.value}</div>
            <div class="stat-desc text-xs text-primary">${stat.unit}</div>
            <div class="stat-title text-xs">${stat.label}</div>
        </div>
    `).join('');
}

// Display detailed analysis table
function displayRideDetailedAnalysis(data) {
    const detailedAnalysis = document.getElementById('rideDetailedAnalysis');
    
    const rows = [
        ['Track Points', data.points.length.toLocaleString()],
        ['Number of Tracks', data.tracks.length],
        ['Total Segments', data.tracks.reduce((sum, track) => sum + track.segmentCount, 0)],
        ['Max Elevation', data.summary.maxElevation ? `${Math.round(data.summary.maxElevation)}m` : 'N/A'],
        ['Min Elevation', data.summary.minElevation ? `${Math.round(data.summary.minElevation)}m` : 'N/A'],
        ['Start Time', data.summary.startTime ? new Date(data.summary.startTime).toLocaleString() : 'N/A'],
        ['End Time', data.summary.endTime ? new Date(data.summary.endTime).toLocaleString() : 'N/A'],
        ['Calorie Method', data.analysis.caloriesBurned.method],
        ['Base Calories', data.analysis.caloriesBurned.breakdown.base || 0],
        ['Elevation Calories', data.analysis.caloriesBurned.breakdown.elevation || 0],
        ['Average Heart Rate', data.analysis.averageHeartRate ? `${Math.round(data.analysis.averageHeartRate)} bpm` : 'N/A'],
        ['Average Power', data.analysis.averagePower ? `${Math.round(data.analysis.averagePower)} W` : 'N/A']
    ];

    detailedAnalysis.innerHTML = `
        <thead>
            <tr><th>Property</th><th>Value</th></tr>
        </thead>
        <tbody>
            ${rows.map(([key, value]) => `
                <tr><td><strong>${key}</strong></td><td>${value}</td></tr>
            `).join('')}
        </tbody>
    `;
}

// Display route segments
function displayRideSegments(segments) {
    const segmentsList = document.getElementById('rideSegmentsList');
    
    if (!segments || segments.length === 0) {
        segmentsList.innerHTML = '<p class="text-center text-base-content/50 py-8">No route segments identified in this ride.</p>';
        return;
    }

    segmentsList.innerHTML = segments.map((segment, index) => `
        <div class="card bg-base-100 mb-2 border border-base-300">
            <div class="card-body p-4">
                <div class="flex justify-between items-center">
                    <div class="flex items-center">
                        <i class="fas ${segment.type === 'climb' ? 'fa-arrow-up text-error' : segment.type === 'descent' ? 'fa-arrow-down text-success' : 'fa-minus text-warning'} mr-2"></i>
                        <span class="font-semibold">Segment ${index + 1} - ${segment.type.charAt(0).toUpperCase() + segment.type.slice(1)}</span>
                    </div>
                    <div class="text-right text-sm text-base-content/70">
                        <div>${segment.distance.toFixed(2)}m</div>
                        <div>${segment.elevationChange > 0 ? '+' : ''}${Math.round(segment.elevationChange)}m</div>
                    </div>
                </div>
                <div class="mt-2 text-sm text-base-content/70">
                    <span>Avg Gradient: ${segment.avgGradient.toFixed(1)}%</span>
                    <span class="ml-4">Max Gradient: ${segment.maxGradient.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Create ride analysis charts
function createRideAnalysisCharts(data) {
    // Clean up existing charts
    Object.values(rideAnalysisCharts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    rideAnalysisCharts = {};
    
    // Create elevation chart
    createRideElevationChart(data);
    
    // Create speed chart
    createRideSpeedChart(data);
    
    // Create heart rate chart (if available)
    if (data.analysis.averageHeartRate) {
        createRideHeartRateChart(data);
        document.getElementById('rideHeartRateContainer').style.display = 'block';
        document.getElementById('rideExtensionsSection').classList.remove('hidden');
    }
    
    // Create power chart (if available)
    if (data.analysis.averagePower) {
        createRidePowerChart(data);
        document.getElementById('ridePowerContainer').style.display = 'block';
        document.getElementById('rideExtensionsSection').classList.remove('hidden');
    }
}

// Create elevation chart
function createRideElevationChart(data) {
    const ctx = document.getElementById('rideElevationChart').getContext('2d');
    
    // Sample elevation data from points (take every 10th point to avoid too many data points)
    const elevationPoints = data.points
        .filter((point, index) => index % 10 === 0 && point.elevation !== undefined)
        .map((point, index) => ({
            x: index * (data.summary.distance / data.points.length * 10), // Approximate distance
            y: point.elevation
        }));

    rideAnalysisCharts.elevation = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Elevation (m)',
                data: elevationPoints,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Distance (km)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Elevation (m)'
                    }
                }
            }
        }
    });
}

// Create speed chart
function createRideSpeedChart(data) {
    const ctx = document.getElementById('rideSpeedChart').getContext('2d');
    
    // Generate sample speed data (in a real implementation, you'd extract this from GPX)
    const speedData = [];
    for (let i = 0; i < 50; i++) {
        speedData.push({
            x: i * (data.summary.distance / 50),
            y: Math.max(0, data.summary.avgSpeed + (Math.random() - 0.5) * 10)
        });
    }

    rideAnalysisCharts.speed = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Speed (km/h)',
                data: speedData,
                borderColor: 'rgb(16, 185, 129)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: false,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Distance (km)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Speed (km/h)'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// Create heart rate chart
function createRideHeartRateChart(data) {
    const ctx = document.getElementById('rideHeartRateChart').getContext('2d');
    
    // Generate sample heart rate data
    const hrData = [];
    const avgHR = data.analysis.averageHeartRate;
    for (let i = 0; i < 50; i++) {
        hrData.push({
            x: i * (data.summary.distance / 50),
            y: Math.max(60, avgHR + (Math.random() - 0.5) * 40)
        });
    }

    rideAnalysisCharts.heartRate = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Heart Rate (bpm)',
                data: hrData,
                borderColor: 'rgb(239, 68, 68)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: false,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Distance (km)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Heart Rate (bpm)'
                    }
                }
            }
        }
    });
}

// Create power chart
function createRidePowerChart(data) {
    const ctx = document.getElementById('ridePowerChart').getContext('2d');
    
    // Generate sample power data
    const powerData = [];
    const avgPower = data.analysis.averagePower;
    for (let i = 0; i < 50; i++) {
        powerData.push({
            x: i * (data.summary.distance / 50),
            y: Math.max(0, avgPower + (Math.random() - 0.5) * 100)
        });
    }

    rideAnalysisCharts.power = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Power (W)',
                data: powerData,
                borderColor: 'rgb(245, 158, 11)',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                fill: false,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Distance (km)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Power (W)'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// Download GPX file for current ride
function downloadRideGPX() {
    if (currentRideId) {
        window.open(`/api/rides/${currentRideId}/gpx`, '_blank');
    }
}

// Format time utility function
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

// ============= INVITATION FUNCTIONS =============

// Open invitation modal
function openInvitationModal() {
    // Check if user is admin
    if (!requireAdmin('send invitations')) {
        return;
    }
    
    // Reset form
    const form = document.getElementById('invitationForm');
    if (form) {
        form.reset();
    }
    
    // Hide status messages
    hideInvitationMessages();
    
    // Open modal
    const modalToggle = document.getElementById('invitationModalToggle');
    if (modalToggle) {
        modalToggle.checked = true;
    }
}

// Close invitation modal
function closeInvitationModal() {
    const modalToggle = document.getElementById('invitationModalToggle');
    if (modalToggle) {
        modalToggle.checked = false;
    }
}

// Hide invitation status messages
function hideInvitationMessages() {
    const successMsg = document.getElementById('invitationSuccess');
    const errorMsg = document.getElementById('invitationError');
    
    if (successMsg) successMsg.classList.add('hidden');
    if (errorMsg) errorMsg.classList.add('hidden');
}

// Show invitation success message
function showInvitationSuccess(message = 'Invitation sent successfully!') {
    const successMsg = document.getElementById('invitationSuccess');
    const errorMsg = document.getElementById('invitationError');
    
    if (errorMsg) errorMsg.classList.add('hidden');
    if (successMsg) {
        successMsg.classList.remove('hidden');
        const span = successMsg.querySelector('span');
        if (span) span.textContent = message;
    }
}

// Show invitation error message
function showInvitationError(message = 'Failed to send invitation') {
    const successMsg = document.getElementById('invitationSuccess');
    const errorMsg = document.getElementById('invitationError');
    const errorMessageSpan = document.getElementById('invitationErrorMessage');
    
    if (successMsg) successMsg.classList.add('hidden');
    if (errorMsg) {
        errorMsg.classList.remove('hidden');
    }
    if (errorMessageSpan) {
        errorMessageSpan.textContent = message;
    }
}

// Handle invitation form submission
async function handleInvitationSubmit(event) {
    event.preventDefault();
    
    // Check if user is admin
    if (!requireAdmin('send invitations')) {
        return;
    }
    
    // Get form data
    const email = document.getElementById('inviteEmail')?.value;
    const role = document.getElementById('inviteRole')?.value;
    const message = document.getElementById('inviteMessage')?.value;
    
    // Validate email
    if (!email || !email.trim()) {
        showInvitationError('Please enter an email address');
        return;
    }
    
    // Hide previous messages
    hideInvitationMessages();
    
    // Disable submit button
    const submitBtn = document.getElementById('sendInvitationBtn');
    const originalBtnText = submitBtn?.innerHTML;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading loading-spinner loading-sm mr-2"></span>Sending...';
    }
    
    try {
        const response = await fetch('/api/admin/invitations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email.trim(),
                role: role || 'user',
                message: message?.trim() || ''
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showInvitationSuccess(result.message || 'Invitation sent successfully!');
            
            // Reset form after 2 seconds and close modal
            setTimeout(() => {
                const form = document.getElementById('invitationForm');
                if (form) form.reset();
                hideInvitationMessages();
                closeInvitationModal();
            }, 10000);
        } else {
            showInvitationError(result.error || 'Failed to send invitation');
        }
    } catch (error) {
        console.error('Error sending invitation:', error);
        showInvitationError('Network error. Please try again.');
    } finally {
        // Re-enable submit button
        if (submitBtn && originalBtnText) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
}

// Initialize invitation form
function initializeInvitationForm() {
    const form = document.getElementById('invitationForm');
    if (form) {
        form.addEventListener('submit', handleInvitationSubmit);
    }
}

// ============= PROFILE FUNCTIONS =============

// Open profile modal and load current profile data
async function openProfileModal() {
    // Reset form
    const form = document.getElementById('profileForm');
    if (form) {
        form.reset();
    }
    
    // Hide status messages
    hideProfileMessages();
    
    // Open modal
    const modalToggle = document.getElementById('profileModalToggle');
    if (modalToggle) {
        modalToggle.checked = true;
    }
    
    // Load current profile data
    await loadProfileData();
}

// Close profile modal
function closeProfileModal() {
    const modalToggle = document.getElementById('profileModalToggle');
    if (modalToggle) {
        modalToggle.checked = false;
    }
}

// Hide profile status messages
function hideProfileMessages() {
    const successMsg = document.getElementById('profileSuccess');
    const errorMsg = document.getElementById('profileError');
    
    if (successMsg) successMsg.classList.add('hidden');
    if (errorMsg) errorMsg.classList.add('hidden');
}

// Show profile success message
function showProfileSuccess(message = 'Profile updated successfully!') {
    const successMsg = document.getElementById('profileSuccess');
    const errorMsg = document.getElementById('profileError');
    
    if (errorMsg) errorMsg.classList.add('hidden');
    if (successMsg) {
        successMsg.classList.remove('hidden');
        const span = successMsg.querySelector('span');
        if (span) span.textContent = message;
    }
}

// Show profile error message
function showProfileError(message = 'Failed to update profile') {
    const successMsg = document.getElementById('profileSuccess');
    const errorMsg = document.getElementById('profileError');
    const errorMessageSpan = document.getElementById('profileErrorMessage');
    
    if (successMsg) successMsg.classList.add('hidden');
    if (errorMsg) {
        errorMsg.classList.remove('hidden');
    }
    if (errorMessageSpan) {
        errorMessageSpan.textContent = message;
    }
}

// Load profile data from API
async function loadProfileData() {
    try {
        const response = await fetch('/api/profile');
        
        if (!response.ok) {
            throw new Error('Failed to load profile');
        }
        
        const profile = await response.json();
        
        // Populate form fields
        const nicknameInput = document.getElementById('profileNickname');
        const weightInput = document.getElementById('profileWeight');
        const cyclingTypeSelect = document.getElementById('profileCyclingType');
        
        if (nicknameInput) nicknameInput.value = profile.nickname || '';
        if (weightInput) weightInput.value = profile.weight || '';
        if (cyclingTypeSelect) {
            if (profile.cycling_type) {
                cyclingTypeSelect.value = profile.cycling_type;
            } else {
                cyclingTypeSelect.selectedIndex = 0; // Reset to placeholder
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showProfileError('Failed to load profile data');
    }
}

// Handle profile form submission
async function handleProfileSubmit(event) {
    event.preventDefault();
    
    // Get form data
    const nickname = document.getElementById('profileNickname')?.value;
    const weight = document.getElementById('profileWeight')?.value;
    const cyclingType = document.getElementById('profileCyclingType')?.value;
    
    // Hide previous messages
    hideProfileMessages();
    
    // Disable submit button
    const submitBtn = document.getElementById('saveProfileBtn');
    const originalBtnText = submitBtn?.innerHTML;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading loading-spinner loading-sm mr-2"></span>Saving...';
    }
    
    try {
        const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nickname: nickname?.trim() || null,
                weight: weight ? parseFloat(weight) : null,
                cycling_type: cyclingType || null
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showProfileSuccess(result.message || 'Profile updated successfully!');
            
            // Close modal after 2 seconds
            setTimeout(() => {
                hideProfileMessages();
                closeProfileModal();
            }, 2000);
        } else {
            showProfileError(result.error || 'Failed to update profile');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showProfileError('Network error. Please try again.');
    } finally {
        // Re-enable submit button
        if (submitBtn && originalBtnText) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
}

// Initialize profile form
function initializeProfileForm() {
    const form = document.getElementById('profileForm');
    if (form) {
        form.addEventListener('submit', handleProfileSubmit);
    }
}
