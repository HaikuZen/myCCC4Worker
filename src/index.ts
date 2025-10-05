import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger, logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import { GPXParser } from './lib/gpx-parser'
import { DatabaseService } from './lib/database-service'
import { createLogger } from './lib/logger'
import { WeatherService } from './lib/weather'
import { AuthService, User } from './lib/auth'

type Bindings = {
  DB: D1Database
  ASSETS: { fetch: any }
  WEATHER_API_KEY?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  JWT_SECRET?: string
  REDIRECT_URI?: string
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
app.get('/database', requireAuth, requireAdmin, serveStatic({ path: './database.html' }))
app.get('/database.html', serveStatic({ path: './database.html' }))
app.get('/configuration', requireAuth, requireAdmin, serveStatic({ path: './configuration.html' }))
app.get('/configuration.html', serveStatic({ path: './configuration.html' }))
app.get('/debug.html', serveStatic({ path: './test/debug.html' }))
app.get('/debug-upload.html', serveStatic({ path: './test/debug-upload.html' }))
app.get('/test-weather.html', serveStatic({ path: './test/test-weather.html' }))
app.get('/test-gpx-analyzer.html', serveStatic({ path: './test/test-gpx-analyzer.html' }))
app.get('/index-tests.html', serveStatic({ path: './test/index-tests.html' }))

// Static assets
app.get('/styles.css', serveStatic({ path: './styles.css' }))
app.get('/app.js', serveStatic({ path: './app.js' }))
app.get('/auth.js', serveStatic({ path: './auth.js' }))
app.get('/database-manager.js', serveStatic({ path: './database-manager.js' }))
app.get('/configuration-manager.js', serveStatic({ path: './configuration-manager.js' }))
app.get('/index-new.js', serveStatic({ path: './index-new.js' }))

// Test files - serve from ./test/ subdirectory
app.get('/test/', serveStatic({ path: './test/index.html' }))
app.get('/test/index.html', serveStatic({ path: './test/index.html' }))
app.get('/test/*', serveStatic({ root: './test' }))

// API Routes
app.get('/api/dashboard', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User
    const userId = user?.id || null
    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const globalStats = await dbService.getGlobalStatistics(userId)
    const recentRides = await dbService.getRecentRides(5, userId)
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

app.get('/api/rides', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User
    const userId = user?.id || null
    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const limit = parseInt(c.req.query('limit') || '10')
    const rides = await dbService.getRecentRides(limit, userId)
    return c.json(rides)
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500)
  }
})

app.get('/api/chart-data', requireAuth, async (c) => {
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
app.post('/upload', requireAuth, async (c) => {
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
    
    // Get user from context
    const user = c.get('user') as User
    const userId = user?.id || null
    
    // Save to database
    log.info('💾 Saving to database...')
    const rideId = await dbService.saveGPXAnalysis(data, fileName, riderWeight, fileContent, userId)
    log.info(`✅ Saved ride analysis to database with ID: ${rideId} for user ${userId}`)
    
    const fileSize = (file.size / 1024).toFixed(1)
    return c.html(generateUploadResponse(data, fileName, fileSize))
    
  } catch (error) {
    const log = createLogger('Upload')
    log.error('Upload error:', error)
    return c.html(`
      <div class="alert alert-error">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        <span>Error processing file: ${(error as Error).message}</span>
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
        await dbService.saveGPXAnalysis(data, file.name, 75, fileContent)
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
app.get('/filter-data', requireAuth, async (c) => {
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
    const user = c.get('user') as User
    const userId = user?.id || null
    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const filteredData = await dbService.getRidesInDateRange(startDate, endDate, undefined, userId)
    return c.html(generateFilteredDataFromDB(filteredData, startDate, endDate))
  } catch (error) {
    const log = createLogger('Filter')
    log.error('Error filtering data:', (error as Error).message)
    // Fallback to mock data
    const mockData = generateFilteredData(startDate, endDate)
    return c.html(mockData)
  }
})

// Database management routes
app.get('/api/database/overview', requireAuth, requireAdmin, async (c) => {
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
app.get('/api/database/table/:tableName', requireAuth, requireAdmin, async (c) => {
  try {
    const tableName = c.req.param('tableName')
    const validTables = ['rides', 'users', 'sessions', 'calorie_breakdown', 'configuration']
    
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

app.put('/api/database/table/:tableName/:recordId', requireAuth, requireAdmin, async (c) => {
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

app.delete('/api/database/table/:tableName/:recordId', requireAuth, requireAdmin, async (c) => {
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
app.post('/api/database/query', requireAuth, requireAdmin, async (c) => {
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

app.get('/api/database/export/:tableName', requireAuth, requireAdmin, async (c) => {
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

app.post('/api/database/cleanup', requireAuth, requireAdmin, async (c) => {
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

app.post('/api/database/optimize', requireAuth, requireAdmin, async (c) => {
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

app.post('/api/database/backup', requireAuth, requireAdmin, async (c) => {
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

app.get('/api/database/info', requireAuth, requireAdmin, async (c) => {
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

app.get('/api/database/initializeDefaultConfig', requireAuth, requireAdmin, async (c) => {
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

app.get('/api/database/initialize', requireAuth, requireAdmin, async (c) => {
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
app.post('/api/check-duplicate', requireAuth, async (c) => {
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
    return c.json({ error: `Geocoding failed: ${(error as Error).message}` }, 500)
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
    return c.json({ error: `Weather API failed: ${(error as Error).message}` }, 500)
  }
})


// GPX download endpoint
app.get('/api/rides/:rideId/gpx', requireAuth, async (c) => {
  try {
    const rideId = parseInt(c.req.param('rideId'))
    
    if (isNaN(rideId)) {
      return c.json({ error: 'Invalid ride ID' }, 400)
    }
    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const gpxData = await dbService.getGpxData(rideId)
    
    if (!gpxData) {
      return c.json({ error: 'GPX data not found for this ride' }, 404)
    }
    
    // Get ride information for filename
    const rides = await dbService.getRecentRides(1000) // Get all to find the specific one
    const ride = rides.find(r => r.id === rideId)
    const filename = ride?.filename || `ride_${rideId}.gpx`
    
    return c.text(gpxData, 200, {
      'Content-Type': 'application/gpx+xml',
      'Content-Disposition': `attachment; filename="${filename}"`
    })
  } catch (error) {
    const log = createLogger('API:GPX:Download')
    log.error('Error downloading GPX file:', error)
    return c.json({ error: (error as Error).message }, 500)
  }
})

// Ride analysis endpoint
app.get('/api/rides/:rideId/analysis', requireAuth, async (c) => {
  try {
    const rideId = parseInt(c.req.param('rideId'))
    
    if (isNaN(rideId)) {
      return c.json({ error: 'Invalid ride ID' }, 400)
    }
    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const gpxData = await dbService.getGpxData(rideId)
    
    if (!gpxData) {
      return c.json({ error: 'GPX data not found for this ride' }, 404)
    }
    
    // Re-analyze the GPX data to get comprehensive analysis
    const gpxParser = new GPXParser()
    const xmlData = await gpxParser.parseFromText(gpxData)
    const riderWeight = await dbService.getRiderWeight()
    const analysisData = await gpxParser.extractCyclingData(xmlData, riderWeight)
    
    // Get basic ride info from database
    const rides = await dbService.getRecentRides(1000)
    const rideInfo = rides.find(r => r.id === rideId)
    
    return c.json({
      rideId: rideId,
      rideInfo: rideInfo,
      analysis: analysisData
    })
  } catch (error) {
    const log = createLogger('API:Ride:Analysis')
    log.error('Error getting ride analysis:', error)
    return c.json({ error: (error as Error).message }, 500)
  }
})

// Configuration API endpoints
app.get('/api/configuration', requireAuth, requireAdmin, async (c) => {
  
  try {    
    const dbService = new DatabaseService(c.env.DB)
    await dbService.initialize()
    
    const config = await dbService.getAllConfiguration()
    return c.json(config)
  } catch (error) {
    const log = createLogger('API:Config')
    log.error('Error getting configuration:', (error as Error).message)
    return c.json({ error: (error as Error).message }, 500)
  }
})

app.put('/api/configuration/:key', requireAuth, requireAdmin, async (c) => {
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

app.post('/api/configuration', requireAuth, requireAdmin, async (c) => {
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

app.delete('/api/configuration/:key', requireAuth, requireAdmin, async (c) => {
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

// ============= AUTHENTICATION ROUTES =============

// Authentication middleware
async function requireAuth(c: any, next: Function) {
  const log = createLogger('Auth:Middleware')
  try {
    const authService = createAuthService(c.env, c.req.url)
    const sessionId = authService.extractSessionFromCookie(c.req.header('Cookie'))
    const user = await authService.validateSession(sessionId)
   
    log.info(`Authenticated user: ${user ? JSON.stringify(user) : 'none'}`)
   
    if (!user) {
      return c.redirect('/login')
    }
    
    c.set('user', user)
    await next()
  } catch (error) {    
    log.error('Authentication error:', error)
    return c.redirect('/login')
  }
}

// Admin middleware
async function requireAdmin(c: any, next: Function) {
  const user = c.get('user')
  if (!user || !user.is_admin) {
    return c.json({ error: 'Admin access required' }, 403)
  }
  await next()
}

// Create auth service helper
function createAuthService(env: Bindings, requestUrl?: string): AuthService {
  const log = createLogger('Auth:Service')
  // Determine redirect URI from environment variable or request URL
  let redirectUri = env.REDIRECT_URI || ''
  log.info(`Using redirect URI: ${redirectUri}`)
  // If no explicit redirect URI is set, construct from request URL
  if (!redirectUri && requestUrl) {
    const url = new URL(requestUrl)
    redirectUri = `${url.protocol}//${url.host}/auth/callback`
  }
  
  // Fallback for local development
  if (!redirectUri) {
    redirectUri = 'http://localhost:8787/auth/callback'
  }
  
  const config = {
    google_client_id: env.GOOGLE_CLIENT_ID || '',
    google_client_secret: env.GOOGLE_CLIENT_SECRET || '',
    redirect_uri: redirectUri,
    jwt_secret: env.JWT_SECRET || 'default-secret'
  }
  
  // Create DatabaseService for user operations
  const dbService = new DatabaseService(env.DB)
  
  return new AuthService(env.DB, config, dbService)
}

// Login page
app.get('/login', (c) => {
  const authService = createAuthService(c.env, c.req.url)
  const googleAuthUrl = authService.getGoogleAuthUrl()
  
  return c.html(`
    <!DOCTYPE html>
    <html lang="en" data-theme="light">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login - Cycling Calories Calculator</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/daisyui@4.4.19/dist/full.min.css" rel="stylesheet" type="text/css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    </head>
    <body class="bg-base-200 min-h-screen flex items-center justify-center">
        <div class="card w-96 bg-base-100 shadow-xl">
            <div class="card-body items-center text-center">
                <i class="fas fa-bicycle text-6xl text-primary mb-4"></i>
                <h2 class="card-title text-2xl mb-2">Welcome Back!</h2>
                <p class="text-base-content/70 mb-6">Sign in to access your cycling analytics</p>
                
                <div class="card-actions justify-center w-full">
                    <a href="${googleAuthUrl}" class="btn btn-primary btn-wide">
                        <i class="fab fa-google mr-2"></i>
                        Sign in with Google
                    </a>
                </div>
                
                <div class="text-sm text-base-content/50 mt-4">
                    <p>We use Google OAuth for secure authentication.</p>
                    <p>No passwords stored on our servers.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `)
})

// OAuth callback
app.get('/auth/callback', async (c) => {
  const log = createLogger('Auth:Callback')
  try {
    const code = c.req.query('code')
    const error = c.req.query('error')
    
    log.info(`OAuth callback received. Code: ${code}, Error: ${error}`)

    if (error) {
      log.error('OAuth error:', error)
      return c.redirect('/login?error=oauth_failed')
    }
    
    if (!code) {
      log.error('No authorization code received')
      return c.redirect('/login?error=no_code')
    }
    
    const authService = createAuthService(c.env, c.req.url)
    
    // Exchange code for token
    const accessToken = await authService.exchangeCodeForToken(code)
    
    // Get user info from Google
    const googleUser = await authService.getGoogleUserInfo(accessToken)
    
    // Find or create user in database
    const user = await authService.findOrCreateUser(googleUser)
    
    // Create session
    const sessionId = await authService.createSession(user.id)
    
    // Set cookie and redirect
    const response = c.redirect('/')
    response.headers.set('Set-Cookie', authService.createSessionCookie(sessionId))
    
    log.info(`User ${user.email} authenticated successfully`)
    return response
  } catch (error) {
    log.error('OAuth callback error:', error)
    return c.redirect('/login?error=auth_failed')
  }
})

// Logout
app.post('/auth/logout', async (c) => {
  try {
    const authService = createAuthService(c.env, c.req.url)
    const sessionId = authService.extractSessionFromCookie(c.req.header('Cookie'))
    
    if (sessionId) {
      await authService.deleteSession(sessionId)
    }
    
    const response = c.redirect('/login')
    response.headers.set('Set-Cookie', authService.createLogoutCookie())
    return response
  } catch (error) {
    const log = createLogger('Auth:Logout')
    log.error('Logout error:', error)
    return c.redirect('/login')
  }
})

// Current user info API
app.get('/api/auth/user', async (c) => {
  try {
    const authService = createAuthService(c.env, c.req.url)
    const sessionId = authService.extractSessionFromCookie(c.req.header('Cookie'))
    const user = await authService.validateSession(sessionId)
    
    if (!user) {
      return c.json({ authenticated: false })
    }
    
    return c.json({ 
      authenticated: true, 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        picture: user.picture,
        is_admin: user.is_admin
      }
    })
  } catch (error) {
    return c.json({ authenticated: false })
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
                                <th>Analysis</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredData.rides.slice(0, 10).map(ride => `
                                <tr class="hover:bg-base-200 cursor-pointer transition-colors ride-row" 
                                    data-ride-id="${ride.id}" 
                                    onclick="console.log('Row clicked:', ${ride.id}); showRideAnalysis(${ride.id}, ${ride.filename ? `'${ride.filename}'` : 'null'})">
                                    <td>${ride.date}</td>
                                    <td>${ride.distance} km</td>
                                    <td>${ride.duration}</td>
                                    <td>${ride.calories} cal</td>
                                    <td>${ride.avgSpeed} km/h</td>
                                    <td>${ride.elevationGain} m</td>
                                    <td class="text-center">
                                        <i class="fas fa-chart-line text-primary hover:opacity-100 transition-opacity" title="View detailed analysis"></i>
                                    </td>
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