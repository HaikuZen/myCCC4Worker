// Global variables for charts
let charts = {};

// Theme management
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

// Load saved theme on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, initializing application...');
    console.log('Chart.js available:', typeof Chart !== 'undefined');
    
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    
    // Initialize all functionality
    initializeFileUpload();
    initializeCharts();
    initializeDatePickers();
    initializeWeatherForecast();
    initializeDashboard();
    initializeConfiguration();
    
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
        
        console.log(`✅ Weather data loaded successfully (demo: ${result.demo})`);
        
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

// Configuration Management
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
            <div class="card bg-base-50 mb-6">
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
        <div class="card bg-base-50">
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
    
    // Auto-load configuration on first visit to section
    const configSection = document.getElementById('configuration');
    if (configSection && !configSection.dataset.loaded) {
        configSection.dataset.loaded = 'true';
    }
}

// Create input element for a configuration item
function createConfigurationInput(config) {
    const isPassword = config.key.toLowerCase().includes('key') || config.key.toLowerCase().includes('password');
    
    let inputElement;
    switch (config.value_type) {
        case 'boolean':
            inputElement = `
                <input type="checkbox" 
                       class="toggle toggle-primary" 
                       data-config-key="${config.key}"
                       data-config-type="${config.value_type}"
                       ${config.value ? 'checked' : ''}
                       onchange="markConfigurationChanged()">
            `;
            break;
        case 'number':
            inputElement = `
                <input type="number" 
                       class="input input-bordered" 
                       data-config-key="${config.key}"
                       data-config-type="${config.value_type}"
                       value="${config.value}"
                       onchange="markConfigurationChanged()">
            `;
            break;
        default:
            inputElement = `
                <input type="${isPassword ? 'password' : 'text'}" 
                       class="input input-bordered" 
                       data-config-key="${config.key}"
                       data-config-type="${config.value_type}"
                       value="${config.value}"
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
    if (!confirm(`Are you sure you want to delete the configuration '${key}'?`)) {
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

// Load configuration when configuration section becomes visible
const configSection = document.getElementById('configuration');
if (configSection) {
    // Use Intersection Observer to load config when section comes into view
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.loaded) {
                loadConfigurationData();
                entry.target.dataset.loaded = 'true';
            }
        });
    }, { threshold: 0.1 });
    
    observer.observe(configSection);
}

// Responsive chart resize handler
window.addEventListener('resize', function() {
    Object.values(charts).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
            chart.resize();
        }
    });
});
