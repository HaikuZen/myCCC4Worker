import { parseString } from 'xml2js'

interface TrackPoint {
  lat: number
  lon: number
  elevation?: number
  time?: Date
  trackIndex: number
  segmentIndex: number
  pointIndex: number
  extensions?: {
    heartRate?: number
    cadence?: number
    speed?: number
    power?: number
    temperature?: number
  }
}

interface Track {
  name: string
  points: TrackPoint[]
  segmentCount: number
}

interface Summary {
  distance: number
  totalTime: number
  movingTime: number
  avgSpeed: number
  maxSpeed: number
  elevationGain: number
  elevationLoss: number
  maxElevation?: number
  minElevation?: number
  startTime?: Date
  endTime?: Date
}

interface Analysis {
  caloriesBurned: {
    estimated: number
    method: string
    breakdown: {
      base?: number
      elevation?: number
      power?: number
      heartRate?: number
    }
  }
  averageHeartRate?: number
  averagePower?: number
  speedZones?: Record<string, number>
  heartRateZones?: Record<string, number>
  powerZones?: {
    average: number
    maximum: number
    normalizedPower?: number
  }
}

interface Segment {
  type: 'climb' | 'descent' | 'flat'
  distance: number
  elevationChange: number
  avgGradient: number
  maxGradient: number
}

interface ElevationCalculationOptions {
  minThreshold?: number           // Minimum elevation change to count (meters)
  smoothingWindow?: number        // Moving average window size
  maxElevationChangeRate?: number // Maximum elevation change per data point (meters)
}

interface GPXData {
  metadata: {
    name: string
    description: string
    author: string
    time?: Date
    bounds?: {
      minLat: number
      maxLat: number
      minLon: number
      maxLon: number
    }
  }
  summary: Summary
  tracks: Track[]
  points: TrackPoint[]
  analysis: Analysis
  segments: Segment[]
}

/**
 * Comprehensive GPX Parser for Cycling Analytics
 * Converted to TypeScript for Cloudflare Workers
 */
export class GPXParser {
  /**
   * Parse GPX content from text
   */
  async parseFromText(xmlContent: string): Promise<GPXData> {
    try {
      const result = await this.parseStringPromise(xmlContent)
      return this.extractCyclingData(result)
    } catch (error) {
      throw new Error(`GPX parsing failed: ${error.message}`)
    }
  }

  /**
   * Parse XML string using xml2js
   */
  private parseStringPromise(xmlContent: string): Promise<any> {
    return new Promise((resolve, reject) => {
      parseString(xmlContent, {
        explicitArray: false,
        ignoreAttrs: false,
        attrkey: 'attr'
      }, (err, result) => {
        if (err) reject(err)
        else resolve(result)
      })
    })
  }

  /**
   * Extract comprehensive cycling data from parsed GPX
   */
  private extractCyclingData(gpxData: any): GPXData {
    const tracks = this.extractTracks(gpxData)
    if (tracks.length === 0) {
      throw new Error('No track data found in GPX file')
    }

    const allPoints = tracks.reduce((acc, track) => acc.concat(track.points), [] as TrackPoint[])
    
    return {
      metadata: this.extractMetadata(gpxData),
      summary: this.calculateSummary(allPoints),
      tracks: tracks,
      points: allPoints,
      analysis: this.performDetailedAnalysis(allPoints),
      segments: this.identifySegments(allPoints)
    }
  }

  /**
   * Extract metadata from GPX file
   */
  private extractMetadata(gpxData: any) {
    const metadata = gpxData.gpx?.metadata || {}
    return {
      name: metadata.name || 'Unnamed Track',
      description: metadata.desc || '',
      author: metadata.author?.name || 'Unknown',
      time: metadata.time ? new Date(metadata.time) : undefined,
      bounds: metadata.bounds ? {
        minLat: parseFloat(metadata.bounds.attr?.minlat || 0),
        maxLat: parseFloat(metadata.bounds.attr?.maxlat || 0),
        minLon: parseFloat(metadata.bounds.attr?.minlon || 0),
        maxLon: parseFloat(metadata.bounds.attr?.maxlon || 0)
      } : undefined
    }
  }

  /**
   * Extract track segments and points
   */
  private extractTracks(gpxData: any): Track[] {
    const gpxTracks = gpxData.gpx?.trk || []
    const tracksArray = Array.isArray(gpxTracks) ? gpxTracks : [gpxTracks]
    
    return tracksArray.map((track, trackIndex) => {
      const segments = Array.isArray(track.trkseg) ? track.trkseg : [track.trkseg]
      const points: TrackPoint[] = []
      
      segments.forEach((segment, segIndex) => {
        if (segment?.trkpt) {
          const segmentPoints = Array.isArray(segment.trkpt) ? segment.trkpt : [segment.trkpt]
          
          segmentPoints.forEach((point, pointIndex) => {
            const trackPoint = this.parseTrackPoint(point, trackIndex, segIndex, pointIndex)
            if (trackPoint) points.push(trackPoint)
          })
        }
      })
      
      return {
        name: track.name || `Track ${trackIndex + 1}`,
        points: points,
        segmentCount: segments.length
      }
    })
  }

  /**
   * Parse individual track point with extensions
   */
  private parseTrackPoint(point: any, trackIndex: number, segmentIndex: number, pointIndex: number): TrackPoint | null {
    const lat = parseFloat(point.attr?.lat)
    const lon = parseFloat(point.attr?.lon)
    
    if (isNaN(lat) || isNaN(lon)) return null

    const trackPoint: TrackPoint = {
      lat,
      lon,
      elevation: point.ele ? parseFloat(point.ele) : undefined,
      time: point.time ? new Date(point.time) : undefined,
      trackIndex,
      segmentIndex,
      pointIndex
    }

    // Extract extensions (heart rate, cadence, power, etc.)
    if (point.extensions) {
      trackPoint.extensions = this.parseExtensions(point.extensions)
    }

    return trackPoint
  }

  /**
   * Parse GPX extensions for additional data
   */
  private parseExtensions(extensions: any) {
    const parsed: any = {}
    
    // Handle different extension formats
    if (extensions.TrackPointExtension || extensions.tpe) {
      const tpe = extensions.TrackPointExtension || extensions.tpe
      parsed.heartRate = tpe.hr ? parseInt(tpe.hr) : undefined
      parsed.cadence = tpe.cad ? parseInt(tpe.cad) : undefined
      parsed.speed = tpe.speed ? parseFloat(tpe.speed) : undefined
      parsed.power = tpe.power ? parseFloat(tpe.power) : undefined
      parsed.temperature = tpe.atemp ? parseFloat(tpe.atemp) : undefined
    }

    // Handle Garmin extensions
    if (extensions['gpxtpx:TrackPointExtension']) {
      const garmin = extensions['gpxtpx:TrackPointExtension']
      parsed.heartRate = garmin['gpxtpx:hr'] ? parseInt(garmin['gpxtpx:hr']) : undefined
      parsed.cadence = garmin['gpxtpx:cad'] ? parseInt(garmin['gpxtpx:cad']) : undefined
      parsed.speed = garmin['gpxtpx:speed'] ? parseFloat(garmin['gpxtpx:speed']) : undefined
      parsed.power = garmin['gpxtpx:power'] ? parseFloat(garmin['gpxtpx:power']) : undefined
    }

    return parsed
  }

  /**
   * Improved elevation gain calculation with GPS noise filtering
   * 
   * This algorithm provides more accurate results than simple point-to-point
   * differences by filtering out GPS noise and unrealistic elevation changes.
   */
  private calculateElevationGainImproved(
    points: TrackPoint[], 
    options: ElevationCalculationOptions = {}
  ): { elevationGain: number; elevationLoss: number } {
    const {
      minThreshold = 3,           // Minimum elevation change to count (meters)
      smoothingWindow = 3,        // Moving average window size  
      maxElevationChangeRate = 50 // Maximum elevation change per data point (meters)
    } = options

    // Extract elevation points
    const elevationPoints = points
      .filter(p => p.elevation !== undefined)
      .map(p => p.elevation!)

    if (elevationPoints.length < 2) {
      return { elevationGain: 0, elevationLoss: 0 }
    }

    // Step 1: Apply smoothing to reduce GPS noise
    const smoothedElevations = this.applySmoothingFilter(elevationPoints, smoothingWindow)

    // Step 2: Remove unrealistic elevation changes
    const filteredElevations = this.removeElevationOutliers(smoothedElevations, maxElevationChangeRate)

    // Step 3: Calculate elevation gain/loss with minimum threshold
    let totalElevationGain = 0
    let totalElevationLoss = 0

    for (let i = 1; i < filteredElevations.length; i++) {
      const prevEle = filteredElevations[i - 1]
      const currEle = filteredElevations[i]
      
      const elevationChange = currEle - prevEle
      const absChange = Math.abs(elevationChange)
      
      // Only count changes above the threshold
      if (absChange >= minThreshold) {
        if (elevationChange > 0) {
          totalElevationGain += elevationChange
        } else {
          totalElevationLoss += absChange
        }
      }
    }

    return {
      elevationGain: totalElevationGain,
      elevationLoss: totalElevationLoss
    }
  }

  /**
   * Apply moving average smoothing to elevation data
   */
  private applySmoothingFilter(elevations: number[], windowSize: number): number[] {
    if (windowSize <= 1) return [...elevations]
    
    const smoothed: number[] = []
    const halfWindow = Math.floor(windowSize / 2)
    
    for (let i = 0; i < elevations.length; i++) {
      const start = Math.max(0, i - halfWindow)
      const end = Math.min(elevations.length, i + halfWindow + 1)
      const window = elevations.slice(start, end)
      const average = window.reduce((sum, val) => sum + val, 0) / window.length
      smoothed.push(average)
    }
    
    return smoothed
  }

  /**
   * Remove unrealistic elevation changes (GPS errors)
   */
  private removeElevationOutliers(elevations: number[], maxChangeRate: number): number[] {
    const filtered = [elevations[0]] // Keep first point
    
    for (let i = 1; i < elevations.length; i++) {
      const prevEle = filtered[filtered.length - 1]
      const currEle = elevations[i]
      const change = Math.abs(currEle - prevEle)
      
      if (change <= maxChangeRate) {
        filtered.push(currEle)
      } else {
        // Use interpolated value instead of the outlier
        const interpolated = prevEle + (currEle - prevEle) * 0.5
        filtered.push(interpolated)
      }
    }
    
    return filtered
  }

  /**
   * Calculate comprehensive ride summary
   */
  private calculateSummary(points: TrackPoint[]): Summary {
    if (points.length < 2) {
      return {
        distance: 0,
        totalTime: 0,
        movingTime: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        elevationGain: 0,
        elevationLoss: 0
      }
    }

    const validPoints = points.filter(p => p.lat && p.lon)
    let totalDistance = 0
    let maxSpeed = 0
    let maxElevation = -Infinity
    let minElevation = Infinity

    const speeds: number[] = []
    const elevations: number[] = []
    const validTimePoints = validPoints.filter(p => p.time)

    // Calculate elevation gain/loss using improved algorithm
    const elevationResults = this.calculateElevationGainImproved(validPoints)
    const totalElevationGain = elevationResults.elevationGain
    const totalElevationLoss = elevationResults.elevationLoss

    for (let i = 1; i < validPoints.length; i++) {
      const prev = validPoints[i - 1]
      const curr = validPoints[i]

      // Calculate distance segment
      const segmentDistance = this.calculateDistance(prev, curr)
      totalDistance += segmentDistance

      // Track elevation range (using original values)
      if (prev.elevation !== undefined && curr.elevation !== undefined) {
        maxElevation = Math.max(maxElevation, curr.elevation)
        minElevation = Math.min(minElevation, curr.elevation)
        elevations.push(curr.elevation)
      }

      // Calculate speed if we have time data
      if (prev.time && curr.time && segmentDistance > 0) {
        const timeDiff = (curr.time.getTime() - prev.time.getTime()) / 1000 // seconds
        if (timeDiff > 0) {
          const speed = (segmentDistance / 1000) / (timeDiff / 3600) // km/h
          speeds.push(speed)
          maxSpeed = Math.max(maxSpeed, speed)
        }
      }
    }

    // Calculate time-based statistics
    let totalTime = 0
    let movingTime = 0
    let startTime: Date | undefined
    let endTime: Date | undefined

    if (validTimePoints.length >= 2) {
      startTime = validTimePoints[0].time
      endTime = validTimePoints[validTimePoints.length - 1].time
      
      if (startTime && endTime) {
        totalTime = (endTime.getTime() - startTime.getTime()) / 1000 // seconds
        
        // Calculate moving time (exclude stops > 30 seconds)
        movingTime = totalTime
        for (let i = 1; i < validTimePoints.length; i++) {
          const prev = validTimePoints[i - 1]
          const curr = validTimePoints[i]
          if (prev.time && curr.time) {
            const segmentTime = (curr.time.getTime() - prev.time.getTime()) / 1000
            if (segmentTime > 30) { // Consider stops > 30 seconds
              movingTime -= Math.max(0, segmentTime - 30)
            }
          }
        }
      }
    }

    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0

    return {
      distance: totalDistance / 1000, // Convert to km
      totalTime,
      movingTime,
      avgSpeed,
      maxSpeed,
      elevationGain: totalElevationGain,
      elevationLoss: totalElevationLoss,
      maxElevation: maxElevation !== -Infinity ? maxElevation : undefined,
      minElevation: minElevation !== Infinity ? minElevation : undefined,
      startTime,
      endTime
    }
  }

  /**
   * Perform detailed analysis of the ride data
   */
  private performDetailedAnalysis(points: TrackPoint[]): Analysis {
    const summary = this.calculateSummary(points)
    
    // Calculate calories using distance and elevation method
    const baseCalories = Math.round(summary.distance * 50) // Base: 50 cal/km
    const elevationCalories = Math.round(summary.elevationGain * 10) // 10 cal per meter climbed
    const totalCalories = baseCalories + elevationCalories

    const analysis: Analysis = {
      caloriesBurned: {
        estimated: totalCalories,
        method: 'distance_elevation',
        breakdown: {
          base: baseCalories,
          elevation: elevationCalories
        }
      }
    }

    // Add heart rate analysis if available
    const heartRates = points.filter(p => p.extensions?.heartRate).map(p => p.extensions!.heartRate!)
    if (heartRates.length > 0) {
      analysis.averageHeartRate = heartRates.reduce((a, b) => a + b, 0) / heartRates.length
    }

    // Add power analysis if available
    const powers = points.filter(p => p.extensions?.power).map(p => p.extensions!.power!)
    if (powers.length > 0) {
      analysis.averagePower = powers.reduce((a, b) => a + b, 0) / powers.length
      analysis.powerZones = {
        average: analysis.averagePower,
        maximum: Math.max(...powers)
      }
    }

    return analysis
  }

  /**
   * Identify climbing and descending segments
   */
  private identifySegments(points: TrackPoint[]): Segment[] {
    const segments: Segment[] = []
    
    // Simplified segment identification
    // In a full implementation, this would be more sophisticated
    const elevationPoints = points.filter(p => p.elevation !== undefined)
    
    if (elevationPoints.length < 10) return segments

    // Find significant elevation changes
    let currentSegment: Partial<Segment> | null = null
    
    for (let i = 5; i < elevationPoints.length - 5; i++) {
      const current = elevationPoints[i]
      const lookBehind = elevationPoints.slice(i - 5, i)
      const lookAhead = elevationPoints.slice(i + 1, i + 6)
      
      const avgElevationBehind = lookBehind.reduce((sum, p) => sum + p.elevation!, 0) / lookBehind.length
      const avgElevationAhead = lookAhead.reduce((sum, p) => sum + p.elevation!, 0) / lookAhead.length
      
      const elevationChange = avgElevationAhead - avgElevationBehind
      
      if (Math.abs(elevationChange) > 10) { // Significant change
        const segmentType: 'climb' | 'descent' | 'flat' = elevationChange > 0 ? 'climb' : 'descent'
        
        if (!currentSegment || currentSegment.type !== segmentType) {
          // Start new segment
          if (currentSegment) {
            segments.push(currentSegment as Segment)
          }
          currentSegment = {
            type: segmentType,
            distance: 0,
            elevationChange: 0,
            avgGradient: 0,
            maxGradient: 0
          }
        }
      }
    }

    return segments
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(point1: TrackPoint, point2: TrackPoint): number {
    const R = 6371000 // Earth's radius in meters
    const lat1Rad = point1.lat * Math.PI / 180
    const lat2Rad = point2.lat * Math.PI / 180
    const deltaLat = (point2.lat - point1.lat) * Math.PI / 180
    const deltaLon = (point2.lon - point1.lon) * Math.PI / 180

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
  }
}