import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger, logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import { GPXParser } from './lib/gpx-parser'
import { DatabaseService } from './lib/database-service'
import { createLogger } from './lib/logger'
import { WeatherService } from './lib/weather'

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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    const riderWeight = await dbService.getRiderWeight()
    // Parse the GPX file from text content
    log.info('📋 Parsing GPX file:', fileName)
    const xmlData = await gpxParser.parseFromText(fileContent)
    const data = await gpxParser.extractCyclingData(xmlData, riderWeight)
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
  const log = createLogger('API:Analyze')
  try {
    const formData = await c.req.formData()
    const file = formData.get('gpxFile') as File

    
    log.debug(`Received file: ${file ? file.name : 'none'}`) 
    
    const skipSaveToDB = c.req.query('skipSaveToDB') != null

    if (!file) {
      return c.json({ error: 'No file uploaded' }, 400)
    }
    
    const fileContent = await file.text()
    const xmlData = await gpxParser.parseFromText(fileContent) 
    
    const data = await gpxParser.extractCyclingData(xmlData, 75) // Default rider weight 75kg
    
    if(!skipSaveToDB) 
      try {
       // Save to database
        const dbService = new DatabaseService(c.env.DB)
        await dbService.initialize()            
        await dbService.saveGPXAnalysis(data, file.name)
      } catch (dbError) {        
        log.warn('Failed to save to database:', dbError)
      }    
    return c.json(data)
  } catch (error) {
    log.error('Error analyzing GPX file:', error) 
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    
    // Initialize weather service with API key
    const weatherService = new WeatherService(c.env.WEATHER_API_KEY)
    
    // Use the weather service to geocode the location
    const result = await weatherService.geocodeLocation(locationName)
    
    if (!result.success) {
      return c.json({ error: result.error }, 404)
    }
    
    return c.json(result)
  } catch (error) {
    const log = createLogger('API:Geocode')
    log.error('Error geocoding location:', error)
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
    
    // Initialize weather service with API key
    const weatherService = new WeatherService(c.env.WEATHER_API_KEY)
    
    // Use the weather service to get weather data
    const result = await weatherService.getWeather({ lat, lon, location })
    
    if (!result.success) {
      return c.json({ error: result.error }, 400)
    }
    
    return c.json(result)
  } catch (error) {
    const log = createLogger('API:Weather')
    log.error('Error getting weather data:', error)
    return c.json({ error: `Weather API failed: ${error.message}` }, 500)
  }
})




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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    return c.json({ error: (error as Error).message }, 500)
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
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    const { summary } = filteredData;
    
    if (!summary || filteredData.rides.length === 0) {
        return `
            <div class="alert alert-info mb-6">
                <i class="fas fa-info-circle mr-2"></i>
                <span>No rides found from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}</span>
            </div>
            
            <div class="text-center py-8">
                <i class="fas fa-bicycle text-6xl text-base-content/30 mb-4"></i>
                <p class="text-lg text-base-content/70">No cycling data available for the selected period</p>
                <p class="text-sm text-base-content/50">Upload some GPX files to see your progress!</p>
            </div>
        `;
    }
    
    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="stat bg-primary/10 rounded-lg">
                <div class="stat-figure text-primary">
                    <i class="fas fa-fire text-2xl"></i>
                </div>
                <div class="stat-title">Total Calories</div>
                <div class="stat-value text-primary">${parseInt(summary.totalCalories).toLocaleString()}</div>
                <div class="stat-desc">Burned in ${summary.count} ride${summary.count > 1 ? 's' : ''}</div>
            </div>
            
            <div class="stat bg-secondary/10 rounded-lg">
                <div class="stat-figure text-secondary">
                    <i class="fas fa-route text-2xl"></i>
                </div>
                <div class="stat-title">Total Distance</div>
                <div class="stat-value text-secondary">${summary.totalDistance} km</div>
                <div class="stat-desc">Kilometers covered</div>
            </div>
            
            <div class="stat bg-accent/10 rounded-lg">
                <div class="stat-figure text-accent">
                    <i class="fas fa-clock text-2xl"></i>
                </div>
                <div class="stat-title">Total Time</div>
                <div class="stat-value text-accent">${summary.totalTime}</div>
                <div class="stat-desc">Hours of cycling</div>
            </div>
            
            <div class="stat bg-info/10 rounded-lg">
                <div class="stat-figure text-info">
                    <i class="fas fa-tachometer-alt text-2xl"></i>
                </div>
                <div class="stat-title">Avg Speed</div>
                <div class="stat-value text-info">${summary.avgSpeed} km/h</div>
                <div class="stat-desc">Average speed</div>
            </div>
        </div>

        <div class="alert alert-success mb-6">
            <i class="fas fa-check-circle mr-2"></i>
            <span>Found ${summary.count} ride${summary.count > 1 ? 's' : ''} from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}</span>
        </div>
        
        <!-- Recent Rides List -->
        <div class="card bg-base-50 mb-6">
            <div class="card-body">
                <h3 class="card-title mb-4">Rides in Selected Period</h3>
                <div class="overflow-x-auto">
                    <table class="table table-zebra w-full">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Distance</th>
                                <th>Duration</th>
                                <th>Calories</th>
                                <th>Avg Speed</th>
                                <th>Elevation</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredData.rides.slice(0, 10).map(ride => `
                                <tr>
                                    <td>${ride.date}</td>
                                    <td>${ride.distance} km</td>
                                    <td>${ride.duration}</td>
                                    <td>${ride.calories} cal</td>
                                    <td>${ride.avgSpeed} km/h</td>
                                    <td>${ride.elevationGain} m</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ${filteredData.rides.length > 10 ? `
                    <div class="text-center mt-4">
                        <span class="text-sm text-base-content/70">Showing 10 of ${filteredData.rides.length} rides</span>
                    </div>
                ` : ''}
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="card bg-base-50">
                <div class="card-body">
                    <h3 class="card-title">Calories Burned Over Time</h3>
                    <div class="chart-container">
                        <canvas id="caloriesChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="card bg-base-50">
                <div class="card-body">
                    <h3 class="card-title">Distance Covered</h3>
                    <div class="chart-container">
                        <canvas id="distanceChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
        
        <script>
            setTimeout(() => {
                if (typeof loadDatabaseChartData === 'function') {
                    // Load real data from database
                    fetch('/api/chart-data?startDate=${startDate}&endDate=${endDate}')
                        .then(response => response.json())
                        .then(data => loadDatabaseChartData(data))
                        .catch(() => {
                            // Fallback to sample data
                            if (typeof loadSampleChartData === 'function') {
                                loadSampleChartData();
                            }
                        });
                } else if (typeof loadSampleChartData === 'function') {
                    loadSampleChartData();
                }
            }, 100);
        </script>
    `;
}

export default app