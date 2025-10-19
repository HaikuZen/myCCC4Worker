import { createLogger } from './logger'
import { CyclingDatabase, GlobalStatistics, GpxDataResult, RideRecord } from './cycling-database'
import type { User, GoogleUserInfo } from './auth'

/**
 * Database Service - Database-agnostic service layer
 * Delegates all database operations to CyclingDatabase implementation
 */
export class DatabaseService extends CyclingDatabase{

  private logger = createLogger('DatabaseService')

  constructor(database: D1Database ) {
    super(database) 
    //this.logger.info('DatabaseService initialized with provided database instance.') 
  }

  /**
   * Mask email address for privacy
   * Example: john.doe@example.com -> j***e@e***e.com
   */
  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) {
      return email
    }

    const [localPart, domain] = email.split('@')
    
    // Mask local part: keep first and last character, mask the rest
    let maskedLocal = localPart
    if (localPart.length > 2) {
      maskedLocal = localPart[0] + '*'.repeat(Math.min(localPart.length - 2, 3)) + localPart[localPart.length - 1]
    } else if (localPart.length === 2) {
      maskedLocal = localPart[0] + '*'
    } else {
      maskedLocal = '*'
    }

    // Mask domain: keep first character and TLD, mask the rest
    const domainParts = domain.split('.')
    if (domainParts.length >= 2) {
      const domainName = domainParts[0]
      const tld = domainParts.slice(1).join('.')
      
      let maskedDomain = domainName
      if (domainName.length > 2) {
        maskedDomain = domainName[0] + '*'.repeat(Math.min(domainName.length - 2, 3)) + domainName[domainName.length - 1]
      } else if (domainName.length === 2) {
        maskedDomain = domainName[0] + '*'
      } else {
        maskedDomain = '*'
      }
      
      return `${maskedLocal}@${maskedDomain}.${tld}`
    }

    return `${maskedLocal}@${domain}`
  }

  /**
   * Hash email for unique identification while preserving privacy
   * Uses SHA-256 to create a one-way hash
   */
  private async hashEmail(email: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(email.toLowerCase().trim())
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  
  /**
   * Get global statistics for the dashboard
   */
  async  getGlobalStatistics(userId?: number | null) {
     
    try {
      const result = await super.getGlobalStatisticsFromDB(userId)
      
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
  async getRecentRides(limit: number = 10, userId?: number | null) {
     
    try {
      const rides = await super.getRecentRidesFromDB(limit, userId)
      
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
  async getRidesInDateRange(startDate: string, endDate: string, limit?: number, userId?: number | null) {
    
    try {
      const rides = await super.getRidesInDateRangeFromDB(
        new Date(startDate),
        new Date(endDate),
        limit,
        userId
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
  async saveGPXAnalysis(analysisData: any, gpxFilename: string, riderWeight: number = 70, gpxData: string | null = null, userId: number | null = null): Promise<number> {
    
    
    try {
      const rideId = await super.saveGPXAnalysis(analysisData, gpxFilename, riderWeight, gpxData, userId)
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

  /**
   * Get GPX file content by ride ID
   */
  async getGpxData(rideId: number): Promise<GpxDataResult | null> {
    try {
      return await super.getGpxData(rideId)
    } catch (error) {
      this.logger.error('Error getting GPX data:', error)
      throw error
    }
  }

  /**
   * Find user by Google ID or email hash
   */
  async findUserByGoogleIdOrEmail(googleId: string, email: string): Promise<User | null> {
    try {
      // Hash the email for comparison
      const emailHash = await this.hashEmail(email)
      
      const user = await this.db
        .prepare('SELECT * FROM users WHERE google_id = ? OR email_hash = ?')
        .bind(googleId, emailHash)
        .first<User>()
      
      return user || null
    } catch (error) {
      this.logger.error('Error finding user by Google ID or email:', error)
      throw error
    }
  }

  /**
   * Update user's last login time
   */
  async updateUserLastLogin(userId: number): Promise<void> {
    try {
      const now = new Date().toISOString()
      await this.db
        .prepare('UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?')
        .bind(now, now, userId)
        .run()
      
      this.logger.info(`Updated last login for user ${userId}`)
    } catch (error) {
      this.logger.error('Error updating user last login:', error)
      throw error
    }
  }

  /**
   * Create a new user from Google OAuth data
   * Stores masked email and email hash for privacy
   */
  async createUserFromGoogleData(googleUser: GoogleUserInfo): Promise<User> {
    try {
      const now = new Date().toISOString()
      const maskedEmail = this.maskEmail(googleUser.email)
      const emailHash = await this.hashEmail(googleUser.email)
      
      const result = await this.db
        .prepare(`
          INSERT INTO users (google_id, email, email_hash, name, picture, last_login)
          VALUES (?, ?, ?, ?, ?, ?) 
        `) // Empty string for picture 
        .bind(
          googleUser.id,
          maskedEmail,
          emailHash,
          googleUser.name,
          //googleUser.picture || null,
          null,
          now
        )
        .run()
      
      if (!result.success || !result.meta.last_row_id) {
        throw new Error('Failed to create user')
      }
      
      const newUser = await this.db
        .prepare('SELECT * FROM users WHERE id = ?')
        .bind(result.meta.last_row_id)
        .first<User>()
      
      if (!newUser) {
        throw new Error('Failed to retrieve created user')
      }
      
      this.logger.info(`New user created: ${maskedEmail} (ID: ${newUser.id})`)
      return newUser
    } catch (error) {
      this.logger.error('Error creating user from Google data:', error)
      throw error
    }
  }

  /**
   * Find or create user from Google OAuth data
   */
  async findOrCreateUser(googleUser: GoogleUserInfo): Promise<User> {
    try {
      // Check if user already exists
      const existingUser = await this.findUserByGoogleIdOrEmail(googleUser.id, googleUser.email)
      
      if (existingUser) {
        // Update last login
        await this.updateUserLastLogin(existingUser.id)
        this.logger.info(`User ${existingUser.email} logged in`)
        return existingUser
      }
      
      // Create new user
      const newUser = await this.createUserFromGoogleData(googleUser)
      return newUser
    } catch (error) {
      this.logger.error('Error finding or creating user:', error)
      throw error
    }
  }

  // ============= INVITATION MANAGEMENT =============

  /**
   * Check if a user with the given email already exists
   */
  async findUserByEmail(email: string): Promise<User | null> {
    try {
      const emailHash = await this.hashEmail(email)
      const user = await this.db
        .prepare('SELECT * FROM users WHERE email_hash = ?')
        .bind(emailHash)
        .first<User>()
      
      return user || null
    } catch (error) {
      this.logger.error('Error finding user by email:', error)
      throw error
    }
  }

  /**
   * Update user role (admin status)
   */
  async updateUserRole(userId: number, isAdmin: boolean): Promise<boolean> {
    try {
      const now = new Date().toISOString()
      const result = await this.db
        .prepare('UPDATE users SET is_admin = ?, updated_at = ? WHERE id = ?')
        .bind(isAdmin ? 1 : 0, now, userId)
        .run()
      
      if (result.success) {
        this.logger.info(`Updated user ${userId} admin status to ${isAdmin}`)
        return true
      }
      
      return false
    } catch (error) {
      this.logger.error('Error updating user role:', error)
      throw error
    }
  }

  /**
   * Check if a pending invitation already exists for the given email
   */
  async findPendingInvitation(email: string): Promise<any | null> {
    try {
      const invitation = await this.db
        .prepare('SELECT id, status, expires_at FROM invitations WHERE email = ? AND status = "pending"')
        .bind(email.trim())
        .first()
      
      return invitation || null
    } catch (error) {
      this.logger.error('Error finding pending invitation:', error)
      throw error
    }
  }

  /**
   * Create a new invitation
   */
  async createInvitation(
    email: string,
    token: string,
    role: string,
    message: string | null,
    invitedBy: number,
    expiresAt: string
  ): Promise<boolean> {
    try {
      const result = await this.db
        .prepare(
          `INSERT INTO invitations (email, token, role, status, message, invited_by, expires_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?)`
        )
        .bind(email.trim(), token, role, message, invitedBy, expiresAt)
        .run()
      
      if (result.success) {
        this.logger.info(`Invitation created for ${email} by user ${invitedBy}`)
        return true
      }
      
      return false
    } catch (error) {
      this.logger.error('Error creating invitation:', error)
      throw error
    }
  }

  /**
   * Get all invitations with inviter information
   */
  async getAllInvitations(): Promise<any[]> {
    try {
      const invitations = await this.db
        .prepare(
          `SELECT 
            i.id, i.email, i.role, i.status, i.created_at, i.expires_at, i.accepted_at,
            u.name as invited_by_name, u.email as invited_by_email
           FROM invitations i
           LEFT JOIN users u ON i.invited_by = u.id
           ORDER BY i.created_at DESC
           LIMIT 100`
        )
        .all()
      
      return invitations.results || []
    } catch (error) {
      this.logger.error('Error getting invitations:', error)
      throw error
    }
  }

  /**
   * Get invitation by token
   */
  async getInvitationByToken(token: string): Promise<any | null> {
    try {
      const invitation = await this.db
        .prepare(
          `SELECT * FROM invitations WHERE token = ? AND status = 'pending'`
        )
        .bind(token)
        .first()
      
      return invitation || null
    } catch (error) {
      this.logger.error('Error getting invitation by token:', error)
      throw error
    }
  }

  /**
   * Mark invitation as accepted
   */
  async acceptInvitation(invitationId: number): Promise<boolean> {
    try {
      const now = new Date().toISOString()
      const result = await this.db
        .prepare(
          `UPDATE invitations SET status = 'accepted', accepted_at = ? WHERE id = ?`
        )
        .bind(now, invitationId)
        .run()
      
      if (result.success) {
        this.logger.info(`Invitation ${invitationId} marked as accepted`)
        return true
      }
      
      return false
    } catch (error) {
      this.logger.error('Error accepting invitation:', error)
      throw error
    }
  }

  /**
   * Delete invitation by ID
   */
  async deleteInvitation(invitationId: number): Promise<boolean> {
    try {
      const result = await this.db
        .prepare('DELETE FROM invitations WHERE id = ?')
        .bind(invitationId)
        .run()
      
      if (result.success) {
        this.logger.info(`Invitation ${invitationId} deleted`)
        return true
      }
      
      return false
    } catch (error) {
      this.logger.error('Error deleting invitation:', error)
      throw error
    }
  }

  /**
   * Check if an invitation is expired
   */
  isInvitationExpired(expiresAt: string): boolean {
    const expirationDate = new Date(expiresAt)
    const now = new Date()
    return expirationDate <= now
  }

  /**
   * Clean up expired invitations
   */
  async cleanupExpiredInvitations(): Promise<number> {
    try {
      const now = new Date().toISOString()
      const result = await this.db
        .prepare(
          `UPDATE invitations SET status = 'expired' 
           WHERE status = 'pending' AND expires_at < ?`
        )
        .bind(now)
        .run()
      
      const rowsAffected = result.meta?.changes || 0
      if (rowsAffected > 0) {
        this.logger.info(`Marked ${rowsAffected} expired invitations`)
      }
      
      return rowsAffected
    } catch (error) {
      this.logger.error('Error cleaning up expired invitations:', error)
      throw error
    }
  }

  // ============= PROFILE MANAGEMENT =============

  /**
   * Get user profile by user ID
   */
  async getProfile(userId: number): Promise<any | null> {
    try {
      const profile = await this.db
        .prepare('SELECT * FROM profiles WHERE user_id = ?')
        .bind(userId)
        .first()
      
      return profile || null
    } catch (error) {
      this.logger.error('Error getting profile:', error)
      throw error
    }
  }

  /**
   * Create a new profile for user
   */
  async createProfile(
    userId: number,
    nickname?: string,
    weight?: number,
    cyclingType?: string
  ): Promise<any> {
    try {
      const now = new Date().toISOString()
      const result = await this.db
        .prepare(
          `INSERT INTO profiles (user_id, nickname, weight, cycling_type, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(userId, nickname || null, weight || null, cyclingType || null, now, now)
        .run()
      
      if (!result.success || !result.meta.last_row_id) {
        throw new Error('Failed to create profile')
      }
      
      const newProfile = await this.db
        .prepare('SELECT * FROM profiles WHERE id = ?')
        .bind(result.meta.last_row_id)
        .first()
      
      this.logger.info(`Profile created for user ${userId}`)
      return newProfile
    } catch (error) {
      this.logger.error('Error creating profile:', error)
      throw error
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: number,
    nickname?: string,
    weight?: number,
    cyclingType?: string
  ): Promise<boolean> {
    try {
      const now = new Date().toISOString()
      
      // Check if profile exists
      const existingProfile = await this.getProfile(userId)
      
      if (!existingProfile) {
        // Create new profile if it doesn't exist
        await this.createProfile(userId, nickname, weight, cyclingType)
        return true
      }
      
      // Update existing profile
      const result = await this.db
        .prepare(
          `UPDATE profiles 
           SET nickname = ?, weight = ?, cycling_type = ?, updated_at = ?
           WHERE user_id = ?`
        )
        .bind(nickname || null, weight || null, cyclingType || null, now, userId)
        .run()
      
      if (result.success) {
        this.logger.info(`Profile updated for user ${userId}`)
        return true
      }
      
      return false
    } catch (error) {
      this.logger.error('Error updating profile:', error)
      throw error
    }
  }

  /**
   * Delete user profile
   */
  async deleteProfile(userId: number): Promise<boolean> {
    try {
      const result = await this.db
        .prepare('DELETE FROM profiles WHERE user_id = ?')
        .bind(userId)
        .run()
      
      if (result.success) {
        this.logger.info(`Profile deleted for user ${userId}`)
        return true
      }
      
      return false
    } catch (error) {
      this.logger.error('Error deleting profile:', error)
      throw error
    }
  }
}
