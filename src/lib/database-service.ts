import { createLogger } from './logger'
import { CyclingDatabase, GlobalStatistics, RideRecord } from './cycling-database'

/**
 * Database Service - Database-agnostic service layer
 * Delegates all database operations to CyclingDatabase implementation
 */
export class DatabaseService extends CyclingDatabase{

  private logger = createLogger('DatabaseService')

  constructor(database: D1Database ) {
    super(database) 
    this.logger.info('DatabaseService initialized with provided database instance.') 
  }

  
  /**
   * Get global statistics for the dashboard
   */
  async  getGlobalStatistics() {
     
    try {
      const result = await super.getGlobalStatisticsFromDB()
      
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
      this.logger.error('Error getting global statistics:', error)
      return { hasData: false, error: error.message }
    }
  }

    /**
   * Get rider weight from configuration
   */
  async getRiderWeight() {
    const defaultWeight = 70 // Default weight in kg if not set
    try {
      const config = await super.getConfig('default_rider_weight')
      const weight = config && config.value ? parseFloat(config.value) : defaultWeight
      return isNaN(weight) ? defaultWeight : weight
    } catch (error) {
      this.logger.error('Error getting rider weight:', error)
      return defaultWeight
    } 
  }
  /**
   * Get recent rides for display
   */
  async getRecentRides(limit: number = 10) {
     
    try {
      const rides = await super.getRecentRidesFromDB(limit)
      
      return rides.map((ride: RideRecord) => ({
        id: ride.id,
        filename: ride.gpx_filename || 'Unknown',
        date: ride.ride_date ? new Date(ride.ride_date).toLocaleDateString('en-GB') : 'Unknown',
        distance: parseFloat(ride.distance?.toString() || '0').toFixed(1),
        calories: Math.round(ride.total_calories || 0),
        duration: this.formatDuration(ride.duration || 0),
        avgSpeed: parseFloat(ride.average_speed?.toString() || '0').toFixed(1),
        elevationGain: Math.round(ride.elevation_gain || 0)
      }))
    } catch (error) {
      this.logger.error('Error getting recent rides:', error)
      return []
    }
  }

  /**
   * Get rides within date range
   */
  async getRidesInDateRange(startDate: string, endDate: string, limit?: number) {
    
    try {
      const rides = await super.getRidesInDateRangeFromDB(
        new Date(startDate),
        new Date(endDate),
        limit
      )
      
      const totalDistance = rides.reduce((sum: number, ride: RideRecord) => sum + (ride.distance || 0), 0)
      const totalCalories = rides.reduce((sum: number, ride: RideRecord) => sum + (ride.total_calories || 0), 0)
      const totalDuration = rides.reduce((sum: number, ride: RideRecord) => sum + (ride.duration || 0), 0)
      const avgSpeed = rides.length > 0 ? rides.reduce((sum: number, ride: RideRecord) => sum + (ride.average_speed || 0), 0) / rides.length : 0
      const totalElevation = rides.reduce((sum: number, ride: RideRecord) => sum + (ride.elevation_gain || 0), 0)

      return {
        rides: rides.map((ride: RideRecord) => ({
          id: ride.id,
          filename: ride.gpx_filename || 'Unknown',
          date: ride.ride_date ? new Date(ride.ride_date).toLocaleDateString('en-GB') : 'Unknown',
          distance: parseFloat(ride.distance?.toString() || '0').toFixed(1),
          calories: Math.round(ride.total_calories || 0),
          duration: this.formatDuration(ride.duration || 0),
          avgSpeed: parseFloat(ride.average_speed?.toString() || '0').toFixed(1),
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
      this.logger.error('Error getting rides in date range:', error)
      return { rides: [], summary: null, error: error.message }
    }
  }

  /**
   * Get chart data for visualization
   */
  async getChartData(startDate = '1999-01-01', endDate = '2999-12-31') {
    
    try {
      const rides = await super.getRidesForChart(
        new Date(startDate),
        new Date(endDate)
      )
      
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
      this.logger.error('Error getting chart data:', error)
      return []
    }
  }

  /**
   * Get monthly summary data
   */
  async getMonthlySummary() {
    
    try {
      // Get rides from the last 12 months
      const endDate = new Date()
      const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1)
      
      const rides = await super.getRidesForMonthlySummary(startDate, endDate)
      
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
      this.logger.error('Error getting monthly summary:', error)
      return []
    }
  }

  /**
   * Get performance trends
   */
  async getPerformanceTrends(days: number = 90) {
    
    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))
      
      const rides = await super.getRidesForTrends(startDate, endDate)
      
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
      this.logger.error('Error getting performance trends:', error)
      return null
    }
  }

  /**
   * Save analyzed GPX data to database
   */
  async saveGPXAnalysis(analysisData: any, gpxFilename: string, riderWeight: number = 70): Promise<number> {
    
    
    try {
      const rideId = await super.saveGPXAnalysis(analysisData, gpxFilename, riderWeight)
      this.logger.info(`💾 Saved ride analysis to database with ID: ${rideId}`)
      return rideId
    } catch (error) {
      this.logger.error('Error saving GPX analysis:', error)
      throw error
    }
  }

  /**
   * Check if a GPX file already exists by filename
   */
  async checkDuplicateByFilename(filename: string) {
    
    
    try {
      return await super.checkDuplicateByFilename(filename)
    } catch (error) {
      this.logger.error('Error checking duplicate by filename:', error)
      throw error
    }
  }

  /**
   * Check if a GPX file already exists by content hash
   */
  async checkDuplicateByContent(distance: number, duration: number, startTime: string) {
    
    
    try {
      return await super.checkDuplicateByContent(distance, duration, startTime)
    } catch (error) {
      this.logger.error('Error checking duplicate by content:', error)
      throw error
    }
  }

  /**
   * Comprehensive duplicate check
   */
  async checkForDuplicate(filename: string, gpxData: any) {
    
    
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
      this.logger.error('Error checking for duplicates:', error)
      throw error
    }
  }

  /**
   * Get all configuration settings
   */
  async getAllConfiguration() {
    
    try {
      const configs = await super.getAllConfiguration()
      
      // Add parsed_value field for compatibility
      return configs.map((config: any) => ({
        ...config,
        parsed_value: config.value
      }))
    } catch (error) {
      this.logger.error('Error getting all configuration:', error)
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