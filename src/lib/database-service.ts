/**
 * Database Service for Cloudflare D1
 * Converted from SQLite3 to work with Cloudflare D1 database
 */
export class DatabaseService {
  private db: D1Database
  private isInitialized: boolean = false

  constructor(database: D1Database) {
    this.db = database
  }

  /**
   * Initialize the database connection (no-op for D1)
   */
  async initialize() {
    if (this.isInitialized) return
    this.isInitialized = true
    console.log('📊 Database service initialized (D1)')
  }

  /**
   * Get global statistics for the dashboard
   */
  async getGlobalStatistics() {
    if (!this.isInitialized) await this.initialize()
    
    try {
      const query = `
        SELECT 
          COUNT(*) as total_rides,
          COALESCE(SUM(distance), 0) as total_distance,
          COALESCE(SUM(total_calories), 0) as total_calories,
          COALESCE(SUM(duration), 0) as total_duration,
          COALESCE(AVG(average_speed), 0) as avg_speed,
          COALESCE(SUM(elevation_gain), 0) as total_elevation_gain,
          COALESCE(AVG(total_calories / NULLIF(distance, 0)), 0) as avg_calories_per_km,
          MIN(ride_date) as first_ride,
          MAX(ride_date) as last_ride
        FROM rides
      `
      
      const result = await this.db.prepare(query).first()
      
      if (!result || result.total_rides === 0) {
        return {
          hasData: false,
          totalRides: 0,
          totalDistance: 0,
          totalCalories: 0,
          totalTime: 0,
          avgSpeed: 0,
          totalElevation: 0,
          avgCaloriesPerKm: 0,
          firstRide: null,
          lastRide: null
        }
      }

      return {
        hasData: true,
        totalRides: result.total_rides,
        totalDistance: parseFloat(result.total_distance?.toString() || '0').toFixed(1),
        totalCalories: Math.round(result.total_calories || 0),
        totalTime: this.formatTotalTime(result.total_duration || 0),
        avgSpeed: parseFloat(result.avg_speed?.toString() || '0').toFixed(1),
        totalElevation: Math.round(result.total_elevation_gain || 0),
        avgCaloriesPerKm: Math.round(result.avg_calories_per_km || 0),
        firstRide: result.first_ride ? new Date(result.first_ride).toLocaleDateString('en-GB') : null,
        lastRide: result.last_ride ? new Date(result.last_ride).toLocaleDateString('en-GB') : null
      }
    } catch (error) {
      console.error('Error getting global statistics:', error)
      return { hasData: false, error: error.message }
    }
  }

  /**
   * Get recent rides for display
   */
  async getRecentRides(limit: number = 10) {
    if (!this.isInitialized) await this.initialize()
    
    try {
      const query = `
        SELECT id, gpx_filename, ride_date, distance, total_calories, 
               duration, average_speed, elevation_gain
        FROM rides 
        ORDER BY ride_date DESC 
        LIMIT ?
      `
      
      const result = await this.db.prepare(query).bind(limit).all()
      
      return result.results.map((ride: any) => ({
        id: ride.id,
        filename: ride.gpx_filename || 'Unknown',
        date: ride.ride_date ? new Date(ride.ride_date).toLocaleDateString('en-GB') : 'Unknown',
        distance: parseFloat(ride.distance || 0).toFixed(1),
        calories: Math.round(ride.total_calories || 0),
        duration: this.formatDuration(ride.duration || 0),
        avgSpeed: parseFloat(ride.average_speed || 0).toFixed(1),
        elevationGain: Math.round(ride.elevation_gain || 0)
      }))
    } catch (error) {
      console.error('Error getting recent rides:', error)
      return []
    }
  }

  /**
   * Get rides within date range
   */
  async getRidesInDateRange(startDate: string, endDate: string, limit?: number) {
    if (!this.isInitialized) await this.initialize()
    
    try {
      let query = `
        SELECT id, gpx_filename, ride_date, distance, total_calories, 
               duration, average_speed, elevation_gain
        FROM rides 
        WHERE ride_date >= ? AND ride_date <= ?
        ORDER BY ride_date DESC
      `
      
      const params = [new Date(startDate).toISOString(), new Date(endDate).toISOString()]
      
      if (limit) {
        query += ' LIMIT ?'
        params.push(limit.toString())
      }
      
      const result = await this.db.prepare(query).bind(...params).all()
      const rides = result.results
      
      const totalDistance = rides.reduce((sum: number, ride: any) => sum + (ride.distance || 0), 0)
      const totalCalories = rides.reduce((sum: number, ride: any) => sum + (ride.total_calories || 0), 0)
      const totalDuration = rides.reduce((sum: number, ride: any) => sum + (ride.duration || 0), 0)
      const avgSpeed = rides.length > 0 ? rides.reduce((sum: number, ride: any) => sum + (ride.average_speed || 0), 0) / rides.length : 0
      const totalElevation = rides.reduce((sum: number, ride: any) => sum + (ride.elevation_gain || 0), 0)

      return {
        rides: rides.map((ride: any) => ({
          id: ride.id,
          filename: ride.gpx_filename || 'Unknown',
          date: ride.ride_date ? new Date(ride.ride_date).toLocaleDateString('en-GB') : 'Unknown',
          distance: parseFloat(ride.distance || 0).toFixed(1),
          calories: Math.round(ride.total_calories || 0),
          duration: this.formatDuration(ride.duration || 0),
          avgSpeed: parseFloat(ride.average_speed || 0).toFixed(1),
          elevationGain: Math.round(ride.elevation_gain || 0)
        })),
        summary: {
          count: rides.length,
          totalDistance: parseFloat(totalDistance.toString()).toFixed(1),
          totalCalories: Math.round(totalCalories),
          totalTime: this.formatTotalTime(totalDuration),
          avgSpeed: parseFloat(avgSpeed.toString()).toFixed(1),
          totalElevation: Math.round(totalElevation)
        }
      }
    } catch (error) {
      console.error('Error getting rides in date range:', error)
      return { rides: [], summary: null, error: error.message }
    }
  }

  /**
   * Get chart data for visualization
   */
  async getChartData(startDate = '1999-01-01', endDate = '2999-12-31') {
    if (!this.isInitialized) await this.initialize()
    
    try {
      const query = `
        SELECT ride_date, distance, total_calories, average_speed, elevation_gain
        FROM rides 
        WHERE ride_date >= ? AND ride_date <= ?
        ORDER BY ride_date
      `
      
      const result = await this.db.prepare(query)
        .bind(new Date(startDate).toISOString(), new Date(endDate).toISOString())
        .all()
      
      const rides = result.results
      
      // Group rides by date
      const dateGroups: Record<string, any> = {}
      rides.forEach((ride: any) => {
        const dateKey = ride.ride_date ? new Date(ride.ride_date).toDateString() : 'Unknown'
        if (!dateGroups[dateKey]) {
          dateGroups[dateKey] = {
            date: dateKey,
            distance: 0,
            calories: 0,
            rides: 0,
            avgSpeed: 0,
            elevation: 0
          }
        }
        dateGroups[dateKey].distance += ride.distance || 0
        dateGroups[dateKey].calories += ride.total_calories || 0
        dateGroups[dateKey].rides += 1
        dateGroups[dateKey].avgSpeed += ride.average_speed || 0
        dateGroups[dateKey].elevation += ride.elevation_gain || 0
      })

      // Calculate averages and format data
      const chartData = Object.values(dateGroups).map((group: any) => ({
        date: group.date,
        distance: parseFloat(group.distance.toFixed(1)),
        calories: Math.round(group.calories),
        rides: group.rides,
        avgSpeed: parseFloat((group.avgSpeed / group.rides).toFixed(1)),
        elevation: Math.round(group.elevation)
      }))

      // Sort by date
      chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      return chartData
    } catch (error) {
      console.error('Error getting chart data:', error)
      return []
    }
  }

  /**
   * Get monthly summary data
   */
  async getMonthlySummary() {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // Get rides from the last 12 months
      const endDate = new Date()
      const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1)
      
      const query = `
        SELECT ride_date, distance, total_calories, elevation_gain
        FROM rides 
        WHERE ride_date >= ? AND ride_date <= ?
        ORDER BY ride_date
      `
      
      const result = await this.db.prepare(query)
        .bind(startDate.toISOString(), endDate.toISOString())
        .all()
      
      const rides = result.results
      
      // Group by month
      const monthGroups: Record<string, any> = {}
      rides.forEach((ride: any) => {
        if (ride.ride_date) {
          const date = new Date(ride.ride_date)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          
          if (!monthGroups[monthKey]) {
            monthGroups[monthKey] = {
              month: monthKey,
              distance: 0,
              calories: 0,
              rides: 0,
              elevation: 0
            }
          }
          
          monthGroups[monthKey].distance += ride.distance || 0
          monthGroups[monthKey].calories += ride.total_calories || 0
          monthGroups[monthKey].rides += 1
          monthGroups[monthKey].elevation += ride.elevation_gain || 0
        }
      })

      return Object.values(monthGroups).map((month: any) => ({
        month: month.month,
        distance: parseFloat(month.distance.toFixed(1)),
        calories: Math.round(month.calories),
        rides: month.rides,
        elevation: Math.round(month.elevation)
      })).sort((a, b) => a.month.localeCompare(b.month))
    } catch (error) {
      console.error('Error getting monthly summary:', error)
      return []
    }
  }

  /**
   * Get performance trends
   */
  async getPerformanceTrends(days: number = 90) {
    if (!this.isInitialized) await this.initialize()
    
    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))
      
      const query = `
        SELECT average_speed, total_calories, distance, duration
        FROM rides 
        WHERE ride_date >= ? AND ride_date <= ?
        ORDER BY ride_date
      `
      
      const result = await this.db.prepare(query)
        .bind(startDate.toISOString(), endDate.toISOString())
        .all()
      
      const rides = result.results
      
      if (rides.length === 0) return null

      // Calculate trends
      const halfPoint = Math.floor(rides.length / 2)
      const firstHalf = rides.slice(0, halfPoint)
      const secondHalf = rides.slice(halfPoint)

      const getAverage = (rides: any[], field: string) => {
        const sum = rides.reduce((acc, ride) => acc + (ride[field] || 0), 0)
        return rides.length > 0 ? sum / rides.length : 0
      }

      const trends = {
        speed: {
          first: getAverage(firstHalf, 'average_speed'),
          second: getAverage(secondHalf, 'average_speed'),
          change: 0
        },
        caloriesPerKm: {
          first: firstHalf.reduce((sum, r) => sum + ((r.total_calories || 0) / (r.distance || 1)), 0) / (firstHalf.length || 1),
          second: secondHalf.reduce((sum, r) => sum + ((r.total_calories || 0) / (r.distance || 1)), 0) / (secondHalf.length || 1),
          change: 0
        },
        distance: {
          first: getAverage(firstHalf, 'distance'),
          second: getAverage(secondHalf, 'distance'),
          change: 0
        }
      }

      // Calculate percentage changes
      Object.keys(trends).forEach(key => {
        const trend = (trends as any)[key]
        if (trend.first > 0) {
          trend.change = ((trend.second - trend.first) / trend.first) * 100
        }
      })

      return trends
    } catch (error) {
      console.error('Error getting performance trends:', error)
      return null
    }
  }

  /**
   * Save analyzed GPX data to database
   */
  async saveGPXAnalysis(analysisData: any, gpxFilename: string, riderWeight: number = 70): Promise<number> {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // Transform the GPX parser output to match the expected database format
      const insertRideSQL = `
        INSERT INTO rides (
          gpx_filename, rider_weight, ride_date,
          distance, duration, elevation_gain, average_speed,
          start_latitude, start_longitude,
          total_calories, base_calories, elevation_calories,
          wind_adjustment, environmental_adjustment, base_met,
          calories_per_km, calories_per_hour,
          wind_speed, wind_direction, humidity, temperature,
          pressure, weather_source,
          elevation_enhanced, has_elevation_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `

      const rideData = [
        gpxFilename,
        riderWeight,
        analysisData.summary.startTime ? analysisData.summary.startTime.toISOString() : null,
        analysisData.summary.distance,
        analysisData.summary.totalTime / 60, // Convert to minutes
        analysisData.summary.elevationGain,
        analysisData.summary.avgSpeed,
        analysisData.points[0]?.lat || 0,
        analysisData.points[0]?.lon || 0,
        analysisData.analysis.caloriesBurned.estimated,
        analysisData.analysis.caloriesBurned.breakdown.base || 0,
        analysisData.analysis.caloriesBurned.breakdown.elevation || 0,
        0, // wind adjustment
        0, // environmental adjustment
        0, // base MET
        Math.round(analysisData.analysis.caloriesBurned.estimated / analysisData.summary.distance),
        Math.round(analysisData.analysis.caloriesBurned.estimated / (analysisData.summary.totalTime / 3600)),
        0, // wind speed
        0, // wind direction
        50, // humidity
        20, // temperature
        1013, // pressure
        'default', // weather source
        false, // elevation enhanced
        analysisData.summary.elevationGain > 0 // has elevation data
      ]

      const result = await this.db.prepare(insertRideSQL).bind(...rideData).run()
      
      if (result.success) {
        console.log(`💾 Saved ride analysis to database with ID: ${result.meta.last_row_id}`)
        return result.meta.last_row_id as number
      } else {
        throw new Error('Failed to insert ride data')
      }
    } catch (error) {
      console.error('Error saving GPX analysis:', error)
      throw error
    }
  }

  /**
   * Check if a GPX file already exists by filename
   */
  async checkDuplicateByFilename(filename: string) {
    if (!this.isInitialized) await this.initialize()
    
    try {
      const query = 'SELECT id, gpx_filename, ride_date FROM rides WHERE gpx_filename = ?'
      const result = await this.db.prepare(query).bind(filename).first()
      return result || null
    } catch (error) {
      console.error('Error checking duplicate by filename:', error)
      throw error
    }
  }

  /**
   * Check if a GPX file already exists by content hash
   */
  async checkDuplicateByContent(distance: number, duration: number, startTime: string) {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // Check for rides with same distance, duration, and start time (within 1 minute)
      const query = `
        SELECT id, gpx_filename, ride_date, distance, duration 
        FROM rides 
        WHERE ABS(distance - ?) < 0.01 
        AND ABS(duration - ?) < 1 
        AND ABS(julianday(ride_date) - julianday(?)) < (1.0 / 1440)
        LIMIT 1
      `
      
      const result = await this.db.prepare(query).bind(distance, duration, startTime).first()
      return result || null
    } catch (error) {
      console.error('Error checking duplicate by content:', error)
      throw error
    }
  }

  /**
   * Comprehensive duplicate check
   */
  async checkForDuplicate(filename: string, gpxData: any) {
    if (!this.isInitialized) await this.initialize()
    
    try {
      // First check by filename
      const filenameMatch = await this.checkDuplicateByFilename(filename)
      if (filenameMatch) {
        return {
          isDuplicate: true,
          type: 'filename',
          existing: filenameMatch,
          message: `A file with the name "${filename}" already exists in the database.`
        }
      }
      
      // Then check by content (distance, duration, start time)
      if (gpxData && gpxData.distance && gpxData.duration && gpxData.startTime) {
        const contentMatch = await this.checkDuplicateByContent(
          gpxData.distance,
          gpxData.duration,
          gpxData.startTime.toISOString()
        )
        
        if (contentMatch) {
          return {
            isDuplicate: true,
            type: 'content',
            existing: contentMatch,
            message: `A ride with similar content already exists: "${contentMatch.gpx_filename}" (${contentMatch.distance}km, ${Math.round(contentMatch.duration)} minutes).`
          }
        }
      }
      
      return {
        isDuplicate: false,
        type: null,
        existing: null,
        message: null
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error)
      throw error
    }
  }

  /**
   * Get all configuration settings
   */
  async getAllConfiguration() {
    if (!this.isInitialized) await this.initialize()
    
    try {
      const query = `
        SELECT key, value, value_type, description, category, updated_at, created_at
        FROM configuration 
        ORDER BY category, key
      `
      
      const result = await this.db.prepare(query).all()
      
      // Parse values based on type
      const configs = result.results.map((row: any) => {
        let parsedValue
        switch (row.value_type) {
          case 'number':
            parsedValue = parseFloat(row.value)
            break
          case 'boolean':
            parsedValue = row.value === 'true'
            break
          case 'json':
            try {
              parsedValue = JSON.parse(row.value)
            } catch {
              parsedValue = row.value
            }
            break
          default:
            parsedValue = row.value
        }
        
        return {
          ...row,
          parsed_value: parsedValue
        }
      })
      
      return configs
    } catch (error) {
      console.error('Error getting all configuration:', error)
      throw error
    }
  }

  /**
   * Helper method to format duration in minutes to readable string
   */
  formatDuration(minutes: number): string {
    if (!minutes) return '0m'
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  /**
   * Helper method to format total time in minutes to readable string
   */
  formatTotalTime(minutes: number): string {
    if (!minutes) return '0h'
    const hours = Math.floor(minutes / 60)
    const remainingMins = Math.floor(minutes % 60)
    
    if (hours >= 24) {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return `${days}d ${remainingHours}h`
    }
    
    return hours > 0 ? `${hours}h ${remainingMins}m` : `${remainingMins}m`
  }
}