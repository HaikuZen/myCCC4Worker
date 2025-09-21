import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import { GPXParser } from './lib/gpx-parser'
import { DatabaseService } from './lib/database-service'
import { createLogger } from './lib/logger'

type Bindings = {
  DB: D1Database
  ASSETS: { fetch: any }
  WEATHER_API_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable logging
app.use('/*', honoLogger())

// Enable CORS
app.use('/*', cors())

// Initialize services
const gpxParser = new GPXParser()

// Serve static files from the web directory
app.get('/', serveStatic({ path: './index.html' }))
app.get('/database', serveStatic({ path: './database.html' }))
app.get('/database.html', serveStatic({ path: './database.html' }))
app.get('/debug.html', serveStatic({ path: './test/debug.html' }))
app.get('/debug-upload.html', serveStatic({ path: './test/debug-upload.html' }))
app.get('/test-weather.html', serveStatic({ path: './test/test-weather.html' }))
app.get('/test-gpx-analyzer.html', serveStatic({ path: './test/test-gpx-analyzer.html' }))
app.get('/index-tests.html', serveStatic({ path: './test/index-tests.html' }))

// Static assets
app.get('/styles.css', serveStatic({ path: './styles.css' }))
app.get('/app.js', serveStatic({ path: './app.js' }))
app.get('/database-manager.js', serveStatic({ path: './database-manager.js' }))
app.get('/index-new.js', serveStatic({ path: './index-new.js' }))

// Test files - serve from ./test/ subdirectory
app.get('/test/', serveStatic({ path: './test/index.html' }))
app.get('/test/index.html', serveStatic({ path: './test/index.html' }))
app.get('/test/*', serveStatic({ root: './test' }))

// API Routes
app.get('/api/dashboard', async (c) => {
  try {
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const globalStats = await dbService.getGlobalStatistics()
    const recentRides = await dbService.getRecentRides(5)
    const chartData = await dbService.getChartData()
    const monthlyData = await dbService.getMonthlySummary()
    const trends = await dbService.getPerformanceTrends()
    
    return c.json({
      statistics: globalStats,
      recentRides,
      chartData,
      monthlyData,
      trends
    })
  } catch (error) {
    const log = createLogger('API:Dashboard')
    log.error('Error getting dashboard data:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.get('/api/rides', async (c) => {
  try {
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const limit = parseInt(c.req.query('limit') || '10')
    const rides = await dbService.getRecentRides(limit)
    return c.json(rides)
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

app.get('/api/chart-data', async (c) => {
  try {
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')
    const chartData = await dbService.getChartData(startDate, endDate)
    return c.json(chartData)
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

// GPX Upload endpoint
app.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('gpxFile') as File
    
    if (!file) {
      return c.html(`
        <div class="alert alert-error">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          <span>No file uploaded or invalid file type</span>
        </div>
      `, 400)
    }

    const fileName = file.name
    const fileContent = await file.text()
    
    // Initialize database service
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    // Check for duplicates
    const log = createLogger('Upload')
    log.info(`🔍 Checking for duplicate: ${fileName}`)
    const duplicateCheck = await dbService.checkDuplicateByFilename(fileName)
    if (duplicateCheck) {
      log.warn('❌ Duplicate file detected by filename:', fileName)
      const errorMessage = `File "${fileName}" already exists in the database (uploaded on ${new Date(duplicateCheck.ride_date).toLocaleDateString('en-GB')}).`
      
      return c.html(`
        <div class="alert alert-warning">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          <span>${errorMessage}</span>
        </div>
      `, 409)
    }
    
    // Parse the GPX file from text content
    log.info('📋 Parsing GPX file:', fileName)
    const data = await gpxParser.parseFromText(fileContent)
    log.info('✅ GPX file parsed successfully')
    
    // Do a content-based duplicate check
    const gpxDataForCheck = {
      distance: data.summary.distance,
      duration: data.summary.totalTime / 60, // Convert seconds to minutes
      startTime: data.summary.startTime
    }
    const contentDuplicateCheck = await dbService.checkForDuplicate(fileName, gpxDataForCheck)
    
    if (contentDuplicateCheck.isDuplicate) {
      log.warn(`❌ Duplicate content detected: ${contentDuplicateCheck.type}`)
      const errorMessage = `A ride with similar content already exists: "${contentDuplicateCheck.existing.gpx_filename}" (${contentDuplicateCheck.existing.distance}km, ${Math.round(contentDuplicateCheck.existing.duration)} minutes).`
      
      return c.html(`
        <div class="alert alert-warning">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          <span>${errorMessage}</span>
        </div>
      `, 409)
    }
    
    // Save to database
    log.info('💾 Saving to database...')
    const rideId = await dbService.saveGPXAnalysis(data, fileName)
    log.info(`✅ Saved ride analysis to database with ID: ${rideId}`)
    
    const fileSize = (file.size / 1024).toFixed(1)
    return c.html(generateUploadResponse(data, fileName, fileSize))
    
  } catch (error) {
    const log = createLogger('Upload')
    log.error('Upload error:', error)
    return c.html(`
      <div class="alert alert-error">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        <span>Error processing file: ${error.message}</span>
      </div>
    `, 500)
  }
})

// API endpoint for CLI integration
app.post('/api/analyze', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('gpxFile') as File
    
    if (!file) {
      return c.json({ error: 'No file uploaded' }, 400)
    }
    
    const fileContent = await file.text()
    const data = await gpxParser.parseFromText(fileContent)
    
    // Save to database
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    try {
      await dbService.saveGPXAnalysis(data, file.name)
    } catch (dbError) {
      const log = createLogger('API:Analyze')
      log.warn('Failed to save to database:', dbError)
    }
    
    return c.json(data)
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

// Data filtering endpoint
app.get('/filter-data', async (c) => {
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')
  
  if (!startDate || !endDate) {
    return c.html(`
      <div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        <span>Please select both start and end dates</span>
      </div>
    `, 400)
  }
  
  try {
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const filteredData = await dbService.getRidesInDateRange(startDate, endDate)
    return c.html(generateFilteredDataFromDB(filteredData, startDate, endDate))
  } catch (error) {
    const log = createLogger('Filter')
    log.error('Error filtering data:', error.message)
    // Fallback to mock data
    const mockData = generateFilteredData(startDate, endDate)
    return c.html(mockData)
  }
})

// Database management routes
app.get('/api/database/overview', async (c) => {
  try {
    const dbService = new DatabaseService(c.env.DB)    
    await dbService.initialize()
    
    const stats = await dbService.getGlobalStatistics()
    
    return c.json({
      totalRides: stats.totalRides || 0,
      databaseSize: 'N/A (D1)',
      lastModified: new Date().toLocaleDateString('en-GB')
    })
  } catch (error) {
    const log = createLogger('API:Database')
    log.error('Error getting database overview:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Database table API endpoints
app.get('/api/database/table/:tableName', async (c) => {
  try {
    const tableName = c.req.param('tableName')
    const validTables = ['rides', 'calorie_breakdown', 'configuration']
    
    if (!validTables.includes(tableName)) {
      return c.json({ error: 'Invalid table name' }, 400)
    }
    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const data = await dbService.getTableData(tableName)
    return c.json(data)
  } catch (error) {
    const log = createLogger('API:Database:Table')
    log.error('Error getting table data:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.put('/api/database/table/:tableName/:recordId', async (c) => {
  try {
    const tableName = c.req.param('tableName')
    const recordId = c.req.param('recordId')
    const updateData = await c.req.json()
    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const result = await dbService.updateRecord(tableName, recordId, updateData)
    return c.json({ success: true, changes: result.changes })
  } catch (error) {
    const log = createLogger('API:Database:Update')
    log.error('Error updating record:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.delete('/api/database/table/:tableName/:recordId', async (c) => {
  try {
    const tableName = c.req.param('tableName')
    const recordId = c.req.param('recordId')
    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const result = await dbService.deleteRecord(tableName, recordId)
    return c.json({ success: true, changes: result.changes })
  } catch (error) {
    const log = createLogger('API:Database:Delete')
    log.error('Error deleting record:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Additional database management endpoints
app.post('/api/database/query', async (c) => {
  try {
    const { query } = await c.req.json()
    
    if (!query) {
      return c.json({ error: 'Query is required' }, 400)
    }
    
    // Basic safety check - prevent certain dangerous operations
    const lowerQuery = query.toLowerCase().trim()
    if (lowerQuery.includes('drop table') || lowerQuery.includes('drop database')) {
      return c.json({ error: 'DROP operations are not allowed' }, 400)
    }
    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const result = await dbService.executeQuery(query)
    return c.json(result)
  } catch (error) {
    const log = createLogger('API:Database:Query')
    log.error('Error executing query:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.get('/api/database/export/:tableName', async (c) => {
  try {
    const tableName = c.req.param('tableName')
    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const csv = await dbService.exportTableToCsv(tableName)
    
    return c.text(csv, 200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${tableName}_export.csv"`
    })
  } catch (error) {
    const log = createLogger('API:Database:Export')
    log.error('Error exporting table:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.post('/api/database/cleanup', async (c) => {
  try {
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const result = await dbService.cleanupOrphanedRecords()
    return c.json({ deletedRecords: result.changes || 0 })
  } catch (error) {
    const log = createLogger('API:Database:Cleanup')
    log.error('Error during cleanup:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.post('/api/database/optimize', async (c) => {
  try {
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    await dbService.optimizeDatabase()
    return c.json({ success: true, message: 'Database optimized successfully' })
  } catch (error) {
    const log = createLogger('API:Database:Optimize')
    log.error('Error optimizing database:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.post('/api/database/backup', async (c) => {
  try {
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const backupPath = await dbService.createBackup()
    
    // For Cloudflare Workers, we can't serve files directly
    // This would need to be handled differently in the cloud environment
    return c.json({ 
      success: true, 
      message: 'Backup created successfully',
      path: backupPath
    })
  } catch (error) {
    const log = createLogger('API:Database:Backup')
    log.error('Error creating backup:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.get('/api/database/info', async (c) => {
  try {
    const dbService = new DatabaseService(c.env.DB)
    const log = createLogger('API:Database:Info')
    log.info(`info dbService: ${JSON.stringify(c)}`)
  
    await dbService.initialize()
    
    const info = await dbService.getDatabaseInfo()
    return c.json(info)
  } catch (error) {
    const log = createLogger('API:Database:Info')
    log.error('Error getting database info:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.get('/api/database/initializeDefaultConfig', async (c) => {
  try {
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const defaults = await dbService.initializeDefaultConfig()
    return c.json(defaults)
  } catch (error) {
    const log = createLogger('API:Database:initializeDefaultConfig')
    log.error('Error getting database initializeDefaultConfig:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.get('/api/database/initialize', async (c) => {
  try {
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize(true) // Force re-initialization
    
    const info = await dbService.getDatabaseInfo()
    return c.json(info)
  } catch (error) {
    const log = createLogger('API:Database:initialize')
    log.error('Error getting database initialize:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Check for potential duplicates endpoint
app.post('/api/check-duplicate', async (c) => {
  try {
    const { filename } = await c.req.json()
    
    if (!filename) {
      return c.json({ error: 'Filename is required' }, 400)
    }
    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const duplicate = await dbService.checkDuplicateByFilename(filename)
    return c.json({
      isDuplicate: !!duplicate,
      existing: duplicate || null
    })
  } catch (error) {
    const log = createLogger('API:CheckDuplicate')
    log.error('Error checking duplicate:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Geocoding API endpoint
app.get('/api/geocode', async (c) => {
  const locationName = c.req.query('location')
  
  if (!locationName || locationName.length < 2) {
    return c.json({ error: 'Location parameter is required and must be at least 2 characters long' }, 400)
  }
  
  try {
    const log = createLogger('API:Geocode')
    log.info(`🌍 Geocoding location: ${locationName}`)
    
    // Get API key from environment variable
    const apiKey = c.env.WEATHER_API_KEY
    
    if (!apiKey) {
      log.warn('No weather API key found in environment, using demo mode')
      // Return demo data for common cities
      const demoData = getDemoLocationData(locationName)
      if (demoData) {
        return c.json({
          success: true,
          data: demoData,
          demo: true
        })
      } else {
        return c.json({ 
          error: 'Location not found in demo data and no API key configured',
          demo: true 
        }, 404)
      }
    }
    
    // Call OpenWeatherMap Geocoding API
    const apiUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(locationName)}&limit=1&appid=${apiKey}`
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })
    
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.length === 0) {
      // Fallback to demo data if API returns no results
      const demoData = getDemoLocationData(locationName)
      if (demoData) {
        log.info('No API results found, falling back to demo data')
        return c.json({
          success: true,
          data: demoData,
          demo: true
        })
      }
      return c.json({ error: 'Location not found' }, 404)
    }
    
    const location = data[0]
    const locationData = {
      name: location.name,
      country: location.country,
      lat: location.lat,
      lon: location.lon,
      state: location.state || null
    }
    
    log.info(`✅ Location found:`, locationData)
    
    return c.json({
      success: true,
      data: locationData,
      demo: false
    })
    
  } catch (error) {
    const log = createLogger('API:Geocode')
    log.error('Error geocoding location:', error)
    
    // Fallback to demo data for common locations
    const demoData = getDemoLocationData(locationName)
    if (demoData) {
      log.info('API error, falling back to demo data')
      return c.json({
        success: true,
        data: demoData,
        demo: true,
        warning: `API error: ${error.message}`
      })
    }
    
    return c.json({ error: `Geocoding failed: ${error.message}` }, 500)
  }
})

// Weather API endpoint
app.get('/api/weather', async (c) => {
  const lat = c.req.query('lat')
  const lon = c.req.query('lon')
  const location = c.req.query('location')
  
  if ((!lat || !lon) && !location) {
    return c.json({ error: 'Either coordinates (lat, lon) or location parameter is required' }, 400)
  }
  
  try {
    const log = createLogger('API:Weather')
    log.info(`🌤️ Getting weather data for: ${location || `${lat},${lon}`}`)
    
    // Get API key from environment variable
    const apiKey = c.env.WEATHER_API_KEY
    
    if (!apiKey) {
      log.warn('No weather API key found in environment, using demo weather data')
      // Return demo weather data based on location
      const demoData = getDemoWeatherData(location || 'London,GB')
      return c.json({
        success: true,
        data: demoData,
        demo: true
      })
    }
    
    let weatherLat = lat
    let weatherLon = lon
    
    // If location is provided but no coordinates, geocode first
    if (location && (!lat || !lon)) {
      const geocodeUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`
      const geocodeResponse = await fetch(geocodeUrl, {
        signal: AbortSignal.timeout(5000)
      })
      
      if (geocodeResponse.ok) {
        const geocodeData = await geocodeResponse.json()
        if (geocodeData.length > 0) {
          weatherLat = geocodeData[0].lat.toString()
          weatherLon = geocodeData[0].lon.toString()
        }
      }
    }
    
    if (!weatherLat || !weatherLon) {
      throw new Error('Could not determine coordinates for weather data')
    }
    
    // Get current weather data
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${weatherLat}&lon=${weatherLon}&appid=${apiKey}&units=metric`
    const currentResponse = await fetch(currentWeatherUrl, {
      signal: AbortSignal.timeout(8000)
    })
    
    if (!currentResponse.ok) {
      throw new Error(`Current weather API error: ${currentResponse.status}`)
    }
    
    const currentWeather = await currentResponse.json()
    
    // Get hourly forecast data
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${weatherLat}&lon=${weatherLon}&appid=${apiKey}&units=metric`
    const forecastResponse = await fetch(forecastUrl, {
      signal: AbortSignal.timeout(8000)
    })
    
    if (!forecastResponse.ok) {
      throw new Error(`Forecast API error: ${forecastResponse.status}`)
    }
    
    const forecastWeather = await forecastResponse.json()
    
    // Process the weather data
    const weatherData = processWeatherData(currentWeather, forecastWeather)
    
    log.info(`✅ Weather data retrieved successfully`)
    
    return c.json({
      success: true,
      data: weatherData,
      demo: false
    })
    
  } catch (error) {
    const log = createLogger('API:Weather')
    log.error('Error getting weather data:', error)
    
    // Fallback to demo data
    const demoData = getDemoWeatherData(location || 'London,GB')
    return c.json({
      success: true,
      data: demoData,
      demo: true,
      warning: `API error: ${error.message}`
    })
  }
})

// Process OpenWeatherMap API response into frontend-compatible format
function processWeatherData(currentWeather: any, forecastWeather: any) {
  const current = {
    temp: Math.round(currentWeather.main.temp),
    condition: currentWeather.weather[0].description.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' '),
    humidity: currentWeather.main.humidity,
    wind: Math.round(currentWeather.wind.speed * 3.6), // Convert m/s to km/h
    pressure: currentWeather.main.pressure,
    visibility: currentWeather.visibility ? Math.round(currentWeather.visibility / 1000) : 10,
    uvIndex: 6, // UV index not available in current weather API
    precipitationChance: 0 // Will be calculated from forecast data
  }
  
  // Process hourly forecast data (next 24 hours)
  const hourlyData = []
  const now = new Date()
  
  for (let i = 0; i < Math.min(8, forecastWeather.list.length); i++) {
    const forecast = forecastWeather.list[i]
    const forecastDate = new Date(forecast.dt * 1000)
    
    hourlyData.push({
      hour: forecastDate.getHours(),
      temp: Math.round(forecast.main.temp),
      windSpeed: Math.round(forecast.wind.speed * 3.6), // Convert m/s to km/h
      precipitation: forecast.pop ? Math.round(forecast.pop * 100) : 0, // Probability of precipitation
      condition: forecast.weather[0].description
    })
  }
  
  // Calculate average precipitation chance for current conditions
  const avgPrecipitation = hourlyData.reduce((sum, h) => sum + h.precipitation, 0) / hourlyData.length
  current.precipitationChance = Math.round(avgPrecipitation)
  
  // Generate temperature and wind ranges based on forecast data
  const temps = hourlyData.map(h => h.temp)
  const winds = hourlyData.map(h => h.windSpeed)
  
  const tempRange = {
    min: Math.min(current.temp, ...temps) - 2,
    max: Math.max(current.temp, ...temps) + 2
  }
  
  const windRange = {
    min: Math.max(0, Math.min(current.wind, ...winds) - 5),
    max: Math.max(current.wind, ...winds) + 5
  }
  
  // Generate 7-day forecast from available data
  const dailyForecast = []
  const processedDays = new Set()
  
  for (const forecast of forecastWeather.list) {
    const forecastDate = new Date(forecast.dt * 1000)
    const dayKey = forecastDate.toDateString()
    
    if (!processedDays.has(dayKey) && dailyForecast.length < 7) {
      processedDays.add(dayKey)
      
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][forecastDate.getDay()]
      const condition = forecast.weather[0].main
      
      // Map weather conditions to FontAwesome icons
      let icon = 'fa-sun'
      switch (condition.toLowerCase()) {
        case 'clear':
          icon = 'fa-sun'
          break
        case 'clouds':
          icon = forecast.weather[0].description.includes('few') ? 'fa-cloud-sun' : 'fa-cloud'
          break
        case 'rain':
        case 'drizzle':
          icon = 'fa-cloud-rain'
          break
        case 'thunderstorm':
          icon = 'fa-bolt'
          break
        case 'snow':
          icon = 'fa-snowflake'
          break
        case 'mist':
        case 'fog':
          icon = 'fa-smog'
          break
        default:
          icon = 'fa-cloud'
      }
      
      dailyForecast.push({
        day: dayName,
        temp: Math.round(forecast.main.temp),
        condition: forecast.weather[0].description.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        icon: icon
      })
    }
  }
  
  return {
    current,
    tempRange,
    windRange,
    hourlyData,
    dailyForecast
  }
}

// Demo weather data helper function
function getDemoWeatherData(location: string) {
  const locationWeather: Record<string, any> = {
    'London,GB': { 
      temp: 18, condition: 'Cloudy', humidity: 75, wind: 15,
      tempRange: { min: 12, max: 22 }, windRange: { min: 8, max: 25 }, precipitationChance: 70,
      pressure: 1013, visibility: 10, uvIndex: 6
    },
    'Milan,IT': { 
      temp: 24, condition: 'Sunny', humidity: 60, wind: 8,
      tempRange: { min: 18, max: 30 }, windRange: { min: 3, max: 15 }, precipitationChance: 20,
      pressure: 1015, visibility: 15, uvIndex: 8
    },
    'Paris,FR': { 
      temp: 20, condition: 'Partly Cloudy', humidity: 68, wind: 12,
      tempRange: { min: 15, max: 25 }, windRange: { min: 6, max: 20 }, precipitationChance: 45,
      pressure: 1012, visibility: 12, uvIndex: 7
    },
    'Berlin,DE': { 
      temp: 16, condition: 'Overcast', humidity: 72, wind: 18,
      tempRange: { min: 10, max: 22 }, windRange: { min: 12, max: 28 }, precipitationChance: 60,
      pressure: 1008, visibility: 8, uvIndex: 5
    },
    'Madrid,ES': { 
      temp: 28, condition: 'Hot', humidity: 45, wind: 6,
      tempRange: { min: 22, max: 35 }, windRange: { min: 2, max: 12 }, precipitationChance: 10,
      pressure: 1020, visibility: 20, uvIndex: 9
    }
  }
  
  const weather = locationWeather[location] || locationWeather['London,GB']
  
  // Generate demo hourly data
  const hourlyData = []
  for (let i = 0; i < 24; i++) {
    const hour = (new Date().getHours() + i) % 24
    const tempVariation = Math.sin((hour - 6) / 24 * Math.PI * 2) * (weather.tempRange.max - weather.tempRange.min) / 4
    hourlyData.push({
      hour,
      temp: Math.round(weather.temp + tempVariation + (Math.random() - 0.5) * 3),
      windSpeed: Math.round(weather.wind + (Math.random() - 0.5) * 10),
      precipitation: Math.round(weather.precipitationChance + (Math.random() - 0.5) * 30),
      condition: weather.condition
    })
  }
  
  // Generate demo daily forecast
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const icons = ['fa-sun', 'fa-cloud-sun', 'fa-cloud', 'fa-cloud-rain', 'fa-cloud-sun', 'fa-sun', 'fa-cloud']
  const dailyForecast = []
  
  for (let i = 0; i < 7; i++) {
    dailyForecast.push({
      day: days[i],
      temp: Math.round(weather.temp + (Math.random() - 0.5) * 6),
      condition: weather.condition,
      icon: icons[i]
    })
  }
  
  return {
    current: {
      temp: weather.temp,
      condition: weather.condition,
      humidity: weather.humidity,
      wind: weather.wind,
      pressure: weather.pressure,
      visibility: weather.visibility,
      uvIndex: weather.uvIndex,
      precipitationChance: weather.precipitationChance
    },
    tempRange: weather.tempRange,
    windRange: weather.windRange,
    hourlyData,
    dailyForecast
  }
}

// Demo location data helper function
function getDemoLocationData(locationName: string) {
  const demoLocations: Record<string, any> = {
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
  }
  
  const key = locationName.toLowerCase().trim()
  return demoLocations[key] || null
}

// Configuration API endpoints
app.get('/api/configuration', async (c) => {
  try {
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const config = await dbService.getAllConfiguration()
    return c.json(config)
  } catch (error) {
    const log = createLogger('API:Config')
    log.error('Error getting configuration:', error.message)
    return c.json({ error: error.message }, 500)
  }
})

app.put('/api/configuration/:key', async (c) => {
  try {
    const key = c.req.param('key')
    const { value, value_type } = await c.req.json()
    
    if (!value && value !== false && value !== 0) {
      return c.json({ error: 'Value is required' }, 400)
    }
    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const result = await dbService.updateConfiguration(key, value, value_type)
    if (result.changes === 0) {
      return c.json({ error: 'Configuration key not found' }, 404)
    }
    
    return c.json({ success: true, message: 'Configuration updated successfully' })
  } catch (error) {
    const log = createLogger('API:Config:Update')
    log.error('Error updating configuration:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.post('/api/configuration', async (c) => {
  try {
    const { key, value, value_type, description, category } = await c.req.json()
    
    if (!key || (!value && value !== false && value !== 0)) {
      return c.json({ error: 'Key and value are required' }, 400)
    }
    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    await dbService.addConfiguration(key, value, value_type || 'string', description || '', category || 'general')
    return c.json({ success: true, message: 'Configuration added successfully' })
  } catch (error) {
    const log = createLogger('API:Config:Add')
    log.error('Error adding configuration:', error)
    return c.json({ error: error.message }, 500)
  }
})

app.delete('/api/configuration/:key', async (c) => {
  try {
    const key = c.req.param('key')
    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const result = await dbService.deleteConfiguration(key)
    
    if (result.changes === 0) {
      return c.json({ error: 'Configuration key not found' }, 404)
    }
    
    return c.json({ success: true, message: 'Configuration deleted successfully' })
  } catch (error) {
    const log = createLogger('API:Config:Delete')
    log.error('Error deleting configuration:', error)
    return c.json({ error: error.message }, 500)
  }
})

// Helper functions
function generateUploadResponse(data: any, fileName: string, fileSize: string): string {
  const summary = data.summary
  const calories = data.analysis.caloriesBurned.estimated
  
  return `
    <div class="alert alert-success mb-4">
      <i class="fas fa-check-circle mr-2"></i>
      <span>GPX file "${fileName}" (${fileSize}KB) processed successfully!</span>
    </div>
    
    <div class="stats stats-vertical lg:stats-horizontal shadow">
      <div class="stat bg-primary/10">
        <div class="stat-figure text-primary">
          <i class="fas fa-route text-2xl"></i>
        </div>
        <div class="stat-title">Distance</div>
        <div class="stat-value text-primary">${summary.distance.toFixed(1)} km</div>
        <div class="stat-desc">Total distance covered</div>
      </div>
      
      <div class="stat bg-secondary/10">
        <div class="stat-figure text-secondary">
          <i class="fas fa-fire text-2xl"></i>
        </div>
        <div class="stat-title">Calories</div>
        <div class="stat-value text-secondary">${calories}</div>
        <div class="stat-desc">Estimated calories burned</div>
      </div>
      
      <div class="stat bg-accent/10">
        <div class="stat-figure text-accent">
          <i class="fas fa-clock text-2xl"></i>
        </div>
        <div class="stat-title">Duration</div>
        <div class="stat-value text-accent">${formatTime(summary.totalTime)}</div>
        <div class="stat-desc">Total riding time</div>
      </div>
      
      <div class="stat bg-info/10">
        <div class="stat-figure text-info">
          <i class="fas fa-tachometer-alt text-2xl"></i>
        </div>
        <div class="stat-title">Avg Speed</div>
        <div class="stat-value text-info">${summary.avgSpeed.toFixed(1)} km/h</div>
        <div class="stat-desc">Average speed</div>
      </div>
    </div>
  `
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function generateFilteredData(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  
  const totalCalories = Math.floor(Math.random() * daysDiff * 500 + daysDiff * 200)
  const totalDistance = Math.floor(Math.random() * daysDiff * 30 + daysDiff * 10)
  const totalTime = (Math.random() * daysDiff * 2 + daysDiff * 0.5).toFixed(1)
  const avgSpeed = (totalDistance / parseFloat(totalTime)).toFixed(1)
  
  return `
    <div class="alert alert-info mb-6">
      <i class="fas fa-info-circle mr-2"></i>
      <span>Showing mock data from ${start.toLocaleDateString('en-GB')} to ${end.toLocaleDateString('en-GB')} (${daysDiff} days)</span>
    </div>
  `
}

function generateFilteredDataFromDB(filteredData: any, startDate: string, endDate: string): string {
  // Implementation similar to the original but simplified for this example
  return `
    <div class="alert alert-success mb-6">
      <i class="fas fa-check-circle mr-2"></i>
      <span>Found ${filteredData.rides.length} rides</span>
    </div>
  `
}

export default app