# 🌐 Web Application

This directory contains the web interface for the Cycling Calories Calculator. It provides a browser-based dashboard for uploading GPX files, viewing analytics, managing data, and configuring the application.

## 📁 Contents

### **Main Files**
- **`index-new.js`** - Express.js web server with all routes and API endpoints
- **`index.html`** - Main dashboard HTML page with sections for upload, stats, weather, and configuration
- **`app.js`** - Frontend JavaScript with Chart.js integration, weather management, and UI interactions
- **`styles.css`** - Custom styling and responsive design

### **Additional Pages**
- **`database.html`** - Database management interface for viewing and editing stored data
- **`database-manager.js`** - Frontend JavaScript for database CRUD operations
- **`debug.html`** - Debug page for development and troubleshooting
- **`debug-upload.html`** - Specialized upload testing interface

### **Test Suite** 
- **`test/`** - Comprehensive test suite (see `test/README.md`)
  - Interactive HTML tests for upload, charts, location search
  - Unit tests for database, GPX parsing, calculations
  - Test index page at `test/index.html`

## 🚀 Quick Start

### Start the Web Server
```bash
# From project root
npm start
# or
npm run web
# or 
node index-new.js --web
```

The server will start on **http://localhost:8000** by default.

### Development Mode
```bash
npm run web-dev  # Uses nodemon for auto-restart
```

## 🏗️ Architecture

### **Backend (Express.js)**
- **File Upload**: Multer-based GPX file processing with duplicate detection
- **Database API**: RESTful endpoints for rides, statistics, configuration
- **Real-time Processing**: GPX parsing and calorie calculation
- **Static Serving**: Serves HTML, CSS, JS, and test files

### **Frontend (Vanilla JS)**
- **Chart.js Integration**: Dynamic charts for calories, distance, speed, elevation
- **HTMX**: Seamless file upload and form interactions without page reloads  
- **Weather Integration**: Location-based weather with OpenWeatherMap geocoding
- **Responsive Design**: Works on desktop and mobile devices

### **Key Features**
- 📊 **Interactive Dashboard** with real-time data visualization
- 📤 **Drag & Drop Upload** with progress feedback and duplicate prevention  
- 🌍 **Location Search** using OpenWeatherMap geocoding API
- ⚙️ **Configuration Management** with database persistence
- 📈 **Advanced Analytics** with date filtering and trend analysis
- 🗄️ **Database Browser** for direct data access and management

## ⛰️ Elevation Gain Algorithm

The application uses a sophisticated elevation gain calculation algorithm that processes GPX elevation data with noise filtering and realistic speed limits to provide accurate climbing metrics.

### **Algorithm Overview**

The elevation gain calculation works by:
1. **Data Filtering**: Removes GPS noise and unrealistic data points
2. **Segment Analysis**: Processes elevation changes between consecutive GPS points
3. **Cumulative Calculation**: Sums only positive elevation changes (climbing)

### **Key Features**

- **GPS Noise Filtering**: Filters out time segments < 2 seconds or > 5 minutes to eliminate GPS accuracy issues
- **Distance Validation**: Ignores segments shorter than 2 meters to reduce GPS drift impact
- **Speed Limits**: Realistic speed filtering (1-70 km/h) removes GPS errors that create impossible speeds
- **Elevation Smoothing**: Only counts elevation changes when both previous and current points have valid elevation data

### **Technical Implementation**

```javascript
// Core elevation gain calculation
if (prev.elevation !== null && curr.elevation !== null) {
    const elevationChange = curr.elevation - prev.elevation;
    if (elevationChange > 0) {
        totalElevationGain += elevationChange; // Only sum positive changes
    } else {
        totalElevationLoss += Math.abs(elevationChange); // Track descents separately
    }
}
```

### **Speed and Time Filtering**

To ensure elevation data quality, the algorithm applies realistic constraints:

- **Time Filtering**: `if (timeDiff < 2 || timeDiff > 300) continue;`
- **Speed Filtering**: `if (speed >= 1 && speed <= 70 && segmentDistance >= 0.002)`
- **Distance Filtering**: Minimum segment distance of 2 meters

### **Benefits**

- **Accuracy**: Eliminates GPS noise that can artificially inflate elevation gain
- **Consistency**: Provides reliable elevation metrics across different GPS devices
- **Performance**: Efficient processing of large GPX files with thousands of data points
- **Realism**: Speed filtering ensures only realistic cycling segments contribute to elevation calculations

### **Display in Interface**

Elevation gain appears in multiple places:
- 📊 **Dashboard Summary**: Total elevation climbed across all rides
- 📋 **Recent Rides Table**: Elevation gain column showing meters climbed per ride
- 📈 **Detailed Analysis**: Elevation profile charts and segment breakdowns
- 🔥 **Calorie Calculations**: Higher elevation gain increases estimated calories burned

### **Accuracy Notes**

- **GPS Limitations**: Elevation accuracy depends on GPS device quality and satellite reception
- **Barometric Data**: Some devices provide barometric elevation which is more accurate than GPS elevation
- **Smoothing Trade-offs**: Filtering removes noise but may slightly underestimate elevation gain on very steep, short climbs

The algorithm prioritizes accuracy and consistency over raw GPS data, providing cyclists with reliable elevation metrics for training analysis and performance tracking.

## 🔗 API Endpoints

### **Core Functionality**
- `POST /upload` - GPX file upload and processing
- `GET /api/dashboard` - Dashboard statistics and chart data
- `GET /api/rides` - Ride history and details
- `GET /filter-data` - Filtered data by date range

### **Configuration**
- `GET /api/configuration` - Get all configuration settings
- `POST /api/configuration` - Add new configuration setting
- `PUT /api/configuration/:key` - Update configuration setting
- `DELETE /api/configuration/:key` - Delete configuration setting

### **Database Management**
- `GET /api/database/overview` - Database overview and statistics
- `GET /api/database/table/:tableName` - Get table data
- `POST /api/database/query` - Execute custom SQL queries

## 🎯 Usage Examples

### **Basic Upload**
1. Open http://localhost:8000
2. Drag GPX file to upload area or click to browse
3. View results in dashboard with charts and statistics
4. Data automatically saved to database

### **Location Weather**
1. Click on location input in weather section
2. Type city name (e.g., "Paris", "Tokyo", "New York")  
3. Weather data updates automatically for that location
4. Location preference saved to configuration

### **Data Management**
1. Navigate to http://localhost:8000/database.html
2. Browse rides, view detailed breakdowns
3. Edit or delete entries as needed
4. Export data to JSON format

### **Testing**
1. Navigate to http://localhost:8000/test/
2. Run interactive tests for upload, charts, location search
3. Use browser DevTools to inspect network requests
4. Check console for detailed debugging information

## ⚙️ Configuration

The web application uses database configuration for settings:
- **Weather API Key**: OpenWeatherMap API key for live weather data
- **Default Location**: User's preferred location for weather forecasts  
- **Rider Weight**: Default weight for calorie calculations
- **Processing Options**: Elevation enhancement and calculation preferences

Configure via the web interface Configuration section or database management page.

## 🔧 Development

### **File Structure**
```
web/
├── index-new.js      # Main server
├── index.html        # Dashboard  
├── app.js           # Frontend logic
├── styles.css       # Styling
├── database.html    # DB management
├── database-manager.js  # DB frontend
├── debug*.html      # Debug pages
└── test/           # Test suite
    ├── index.html      # Test dashboard  
    ├── README.md       # Test documentation
    └── test-*.html     # Individual tests
```

### **Adding New Features**
1. **Backend**: Add routes to `index-new.js`
2. **Frontend**: Update `app.js` and HTML templates
3. **Testing**: Create test files in `test/` directory
4. **Documentation**: Update this README

### **Database Integration**
The web app uses the shared `DatabaseService` from `../lib/database-service.js` with the database file located in the project root (`../cycling_data.db`).

## 📊 Performance

- **File Upload**: Supports up to 10MB GPX files
- **Database**: SQLite with optimized indexes for performance
- **Charts**: Efficient Chart.js with animation controls
- **Real-time**: WebSocket-ready architecture for live updates

---

**🚴‍♂️ Part of the Cycling Calories Calculator v2.0**  
**📂 Located in**: `/web/`  
**🌐 Access via**: http://localhost:8000