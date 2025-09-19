import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { GPXParser } from './lib/gpx-parser'
import { DatabaseService } from './lib/database-service'

type Bindings = {
  DB: D1Database
  ASSETS: { fetch: any }
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS
app.use('/*', cors())

// Initialize services
const gpxParser = new GPXParser()

// Serve static files from the web directory
app.get('/', serveStatic({ path: './index.html' }))
app.get('/database', serveStatic({ path: './database.html' }))
app.get('/database.html', serveStatic({ path: './database.html' }))
app.get('/debug.html', serveStatic({ path: './debug.html' }))
app.get('/debug-upload.html', serveStatic({ path: './debug-upload.html' }))

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
    console.error('Error getting dashboard data:', error)
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
    console.log(`🔍 Checking for duplicate: ${fileName}`)
    const duplicateCheck = await dbService.checkDuplicateByFilename(fileName)
    if (duplicateCheck) {
      console.log('❌ Duplicate file detected by filename:', fileName)
      const errorMessage = `File "${fileName}" already exists in the database (uploaded on ${new Date(duplicateCheck.ride_date).toLocaleDateString('en-GB')}).`
      
      return c.html(`
        <div class="alert alert-warning">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          <span>${errorMessage}</span>
        </div>
      `, 409)
    }
    
    // Parse the GPX file from text content
    console.log('📋 Parsing GPX file:', fileName)
    const data = await gpxParser.parseFromText(fileContent)
    console.log('✅ GPX file parsed successfully')
    
    // Do a content-based duplicate check
    const gpxDataForCheck = {
      distance: data.summary.distance,
      duration: data.summary.totalTime / 60, // Convert seconds to minutes
      startTime: data.summary.startTime
    }
    const contentDuplicateCheck = await dbService.checkForDuplicate(fileName, gpxDataForCheck)
    
    if (contentDuplicateCheck.isDuplicate) {
      console.log(`❌ Duplicate content detected: ${contentDuplicateCheck.type}`)
      const errorMessage = `A ride with similar content already exists: "${contentDuplicateCheck.existing.gpx_filename}" (${contentDuplicateCheck.existing.distance}km, ${Math.round(contentDuplicateCheck.existing.duration)} minutes).`
      
      return c.html(`
        <div class="alert alert-warning">
          <i class="fas fa-exclamation-triangle mr-2"></i>
          <span>${errorMessage}</span>
        </div>
      `, 409)
    }
    
    // Save to database
    console.log('💾 Saving to database...')
    const rideId = await dbService.saveGPXAnalysis(data, fileName)
    console.log(`✅ Saved ride analysis to database with ID: ${rideId}`)
    
    const fileSize = (file.size / 1024).toFixed(1)
    return c.html(generateUploadResponse(data, fileName, fileSize))
    
  } catch (error) {
    console.error('Upload error:', error)
    return c.html(`
      <div class="alert alert-error">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        <span>Error processing file: ${error.message}</span>
      </div>
    `, 500)
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
    console.error('Error filtering data:', error.message)
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
    console.error('Error getting database overview:', error)
    return c.json({ error: error.message }, 500)
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
    console.error('Error getting configuration:', error.message)
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