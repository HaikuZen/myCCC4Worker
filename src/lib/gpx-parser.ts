import { parseString } from 'xml2js'
import { createLogger } from './logger'
import { WeatherService } from './weather'
const logger = createLogger('GPXParser')

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
  id?: string
  Distance?: number // in meters
  TimerTime?: number // in seconds
  MovingTime?: number // in seconds
  StoppedTime?: number  // in seconds
  MaxSpeed?: number // in m/s
  points: TrackPoint[]
  segmentCount: number
}

interface Summary {
  riderWeight?: number // in kg
  distance: number
  totalTime: number
  movingTime: number
  avgSpeed: number
  maxSpeed: number
  elevationGain: number
  elevationLoss: number
  distanceClimb: number
  distanceDescent: number
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
  intensityMetrics?: {
    variabilityIndex?: number,
    intensityFactor?: number ,
    trainingStressScore?: number
  }
  elevationenanced?: boolean
  hasWeatherData?: boolean
  weatherProvider?: string
  weather?: {
    temperature?: number
    humidity?: number
    windSpeed?: number
    windDirection?: number
    conditions?: string
    location?: string
  }
}

interface Segment {
  type: 'climb' | 'descent' | 'flat'
  distance: number
  elevationChange: number
  avgGradient: number
  maxGradient: number
  startIndex: number
  endIndex: number
  duration?: number
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
  async parseFromText(xmlContent: string): Promise<any> {
    try {
      logger.debug('Starting GPX parsing' + (xmlContent.length > 100 ? `(length: ${xmlContent.length})` : `: ${xmlContent}`))
      const result = await this.parseStringPromise(xmlContent)
      logger.debug(`GPX parsing completed ${result ? 'successfully' : 'with no result'}`)
      //return this.extractCyclingData(result, riderWeight)
      return result;
    } catch (error) {
      throw new Error(`GPX parsing failed: ${(error as any).message}`)
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
  async extractCyclingData(gpxData: any, riderWeight: number = 0, weatherService?: WeatherService): Promise<GPXData> {
    const tracks = this.extractTracks(gpxData)
    if (tracks.length === 0) {
      throw new Error('No track data found in GPX file')
    }

    logger.debug(`Tracks Distance: ${tracks[0].Distance}, TimerTime: ${tracks[0].TimerTime}, MovingTime: ${tracks[0].MovingTime}, StoppedTime: ${tracks[0].StoppedTime}, MaxSpeed: ${tracks[0].MaxSpeed}  `)

    const allPoints = tracks.reduce((acc, track) => acc.concat(track.points), [] as TrackPoint[])
    
    
    const segments = this.identifySegments(allPoints)

    const summary = this.calculateSummary(allPoints, segments);
    summary.riderWeight = riderWeight;  
    
    
    const metadata = this.extractMetadata(gpxData)
    
    if (!metadata.bounds) {
      metadata.bounds = this.calculateBounds(allPoints) // Use calculated bounds if metadata bounds are missing
    }
    
    const analysis = await this.performDetailedAnalysis(allPoints, summary, metadata.bounds, weatherService)
    
    logger.debug(`Analysis: ${JSON.stringify(analysis)}`)
    
    return {
      metadata: metadata,
      summary: summary,
      tracks: tracks,
      points: allPoints,
      analysis: analysis,
      segments: segments
    }
  }

  private calculateBounds(points: TrackPoint[]) {
    if (points.length === 0) {
      return undefined;
    }
    let minLat = points[0].lat;
    let maxLat = points[0].lat;
    let minLon = points[0].lon;
    let maxLon = points[0].lon;
    points.forEach(point => { 
      if (point.lat < minLat) minLat = point.lat;
      if (point.lat > maxLat) maxLat = point.lat;
      if (point.lon < minLon) minLon = point.lon;
      if (point.lon > maxLon) maxLon = point.lon;
    });
    return { minLat, maxLat, minLon, maxLon };
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
        id: track.extensions?.['opentracks:trackid'] ,
        Distance: track.extensions?.['gpxtrkx:TrackStatsExtension']?.['gpxtrkx:Distance'] ? parseFloat(track.extensions['gpxtrkx:TrackStatsExtension']?.['gpxtrkx:Distance']) : undefined,
        TimerTime: track.extensions?.['gpxtrkx:TrackStatsExtension']?.['gpxtrkx:TimerTime'] ? parseFloat(track.extensions['gpxtrkx:TrackStatsExtension']?.['gpxtrkx:TimerTime']) : undefined,
        MovingTime: track.extensions?.['gpxtrkx:TrackStatsExtension']?.['gpxtrkx:MovingTime'] ? parseFloat(track.extensions['gpxtrkx:TrackStatsExtension']?.['gpxtrkx:MovingTime']) : undefined,
        StoppedTime: track.extensions?.['gpxtrkx:TrackStatsExtension']?.['gpxtrkx:StoppedTime'] ? parseFloat(track.extensions['gpxtrkx:TrackStatsExtension']?.['gpxtrkx:StoppedTime']) : undefined,
        MaxSpeed: track.extensions?.['gpxtrkx:TrackStatsExtension']?.['gpxtrkx:MaxSpeed'] ? parseFloat(track.extensions['gpxtrkx:TrackStatsExtension']?.['gpxtrkx:MaxSpeed']) : undefined,
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
    if(extensions['opentracks:accuracy_horizontal']){
      parsed.accuracy_horizontal = parseFloat(extensions['opentracks:accuracy_horizontal'])
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
   * Calculate comprehensive track summary
   */
  private calculateSummary(points: TrackPoint[], segments: Segment[]): Summary {
    if (points.length === 0) {
      return this.getEmptySummary();
    }

    if (points.length === 1) {
      return this.getSinglePointSummary(points[0]);
    }

    // Configuration for moving detection
    const config = {
      minMovingSpeed: 0.5,        // m/s (1.8 km/h) - below this is considered stopped
      speedSmoothingWindow: 5,    // Points to average for speed calculation
      elevationThreshold: 1       // Minimum elevation change to count (meters)
    };

    // Calculate basic metrics
    const distance = this.calculateTotalDistance(points);
    const timeMetrics = this.calculateTimeMetrics(points);
    const speedMetrics = this.calculateSpeedMetrics(points, config);
    const elevationMetrics = this.calculateElevationMetrics(points, config.elevationThreshold);

  
    let climb = 0, descent = 0, distanceDescent = 0, distanceClimb = 0;
    for (let i = 0; i < segments.length; i++) {
      if(segments[i].type === 'climb') { 
        distanceClimb += segments[i].distance;
        climb += segments[i].elevationChange; 
      }
      if(segments[i].type === 'descent') { 
        descent += segments[i].elevationChange;
        distanceDescent += segments[i].distance;
      }
    }
        
    return {
      distance: Math.round(distance * 1000) / 1000000, // Convert to km and round to nearest meter                
      totalTime: timeMetrics.totalTime,
      movingTime: timeMetrics.movingTime,
      avgSpeed: Math.round(speedMetrics.avgSpeed * 1000) / 1000 * 3.6,         // Convert to km/h and round to nearest 0.1 km/h
      maxSpeed: Math.round(speedMetrics.maxSpeed * 1000) / 1000 * 3.6,       // Convert to km/h and round to nearest 0.1 km/h
      elevationGain: climb,
      elevationLoss: descent,
      distanceClimb: distanceClimb,
      distanceDescent: distanceDescent,
      maxElevation: elevationMetrics.maxElevation,
      minElevation: elevationMetrics.minElevation,
      startTime: timeMetrics.startTime,
      endTime: timeMetrics.endTime,
    };
  }
  
  /**
   * Calculate total distance traveled
   */
  private calculateTotalDistance(points: TrackPoint[]): number {
    let totalDistance = 0;
    
    for (let i = 1; i < points.length; i++) {
      totalDistance += this.calculateDistance(points[i - 1], points[i]);
    }
    
    return totalDistance;
  }

  /**
   * Calculate time-related metrics
   */
  private calculateTimeMetrics(points: TrackPoint[]) {
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    
    // Time boundaries
    const startTime = firstPoint.time;
    const endTime = lastPoint.time;
    
    let totalTime = 0;
    let movingTime = 0;
    
    if (startTime && endTime) {
      totalTime = (endTime.getTime() - startTime.getTime()) / 1000; // seconds
      
      // Calculate moving time by analyzing speed/movement
      movingTime = this.calculateMovingTime(points);
    }
    
    return {
      totalTime,
      movingTime,
      startTime,
      endTime
    };
  }

  /**
   * Calculate moving time (excluding stops)
   */
  private calculateMovingTime(points: TrackPoint[]): number {
    if (points.length < 2) return 0;
    
    let movingTime = 0;
 
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1];
      const currPoint = points[i];
      
      if (prevPoint.time && currPoint.time) {
        const segmentTime = (currPoint.time.getTime() - prevPoint.time.getTime()) / 1000
        const distance = this.calculateDistance(prevPoint, currPoint)
        //logger.debug(`Segment ${i}: distance=${distance} Time=${segmentTime}s`)
        if (distance > 0.5) { //  Consider moving if distance > 0.5m
              movingTime += segmentTime
        }
      }
    }
    
    return movingTime;
  }

  /**
   * Calculate speed-related metrics
   */
  private calculateSpeedMetrics(points: TrackPoint[], config: any) {
    let maxSpeed = 0;
    let totalMovingDistance = 0;
    let totalMovingTime = 0;
    let avgDistance = 0;
    const speeds: number[] = [];
    
    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1];
      const currPoint = points[i];
      
      if (!prevPoint.time || !currPoint.time) continue;
      
      const timeDiff = (currPoint.time.getTime() - prevPoint.time.getTime()) / 1000; // seconds
      if (timeDiff <= 0) continue;
      
      const distance = this.calculateDistance(prevPoint, currPoint);
      
      
      if(avgDistance == 0) 
        avgDistance = distance      
      else if(Math.abs(((avgDistance+distance)/2)-distance) > 2*avgDistance) continue; // ignore spikes
      else avgDistance = (avgDistance+distance)/2; // running average distance between points

      const instantSpeed = distance / timeDiff; // m/s
      
      //logger.debug(`Point ${i}: distance=${distance.toFixed(2)}m, timeDiff=${timeDiff.toFixed(2)}s, instantSpeed=${instantSpeed.toFixed(2)}m/s speedExt=${currPoint.extensions?.speed} avgDistance=${avgDistance.toFixed(2)}m`);

      // Use provided speed from extensions if available and reasonable, otherwise calculate
      let pointSpeed = instantSpeed;
      if (currPoint.extensions?.speed !== undefined && 
          currPoint.extensions.speed >= 0 && 
          currPoint.extensions.speed < 200) {
            pointSpeed = currPoint.extensions.speed;
      }
      
      speeds.push(pointSpeed);
      maxSpeed = Math.max(maxSpeed, pointSpeed);
      // logger.debug(`Point ${i}: Max speed=${maxSpeed.toFixed(2)}m/s  `);
      // Accumulate for average (only when moving)
      if (pointSpeed >= config.minMovingSpeed) {
        totalMovingDistance += distance;
        totalMovingTime += timeDiff;
      }
    }
    
    // Calculate average speed based on moving time and distance
    const avgSpeed = totalMovingTime > 0 ? totalMovingDistance / totalMovingTime : 0;
    
    return {
      avgSpeed,
      maxSpeed,
      speeds
    };
  }

  /**
   * Calculate elevation-related metrics
   */
  private calculateElevationMetrics(points: TrackPoint[], elevationThreshold: number) {
    const elevationPoints = points.filter(p => p.elevation !== undefined);
    
    if (elevationPoints.length === 0) {
      return {
        gain: 0,
        loss: 0,
        maxElevation: undefined,
        minElevation: undefined
      };
    }
    
    // Find min/max elevation
    let maxElevation = elevationPoints[0].elevation!;
    let minElevation = elevationPoints[0].elevation!;
    
    for (const point of elevationPoints) {
      maxElevation = Math.max(maxElevation, point.elevation!);
      minElevation = Math.min(minElevation, point.elevation!);
    }
    
    // Calculate cumulative gain and loss
    let elevationGain = 0;
    let elevationLoss = 0;
    
    // Use smoothed elevation data for more accurate gain/loss calculation
    const smoothedElevations = this.smoothElevationForSummary(elevationPoints);
    
    for (let i = 1; i < smoothedElevations.length; i++) {
      const elevationChange = smoothedElevations[i] - smoothedElevations[i - 1];
      
      // Only count significant changes
      if (Math.abs(elevationChange) >= elevationThreshold) {
        if (elevationChange > 0) {
          elevationGain += elevationChange;
        } else {
          elevationLoss += Math.abs(elevationChange);
        }
      }
    }
    
    return {
      gain: elevationGain,
      loss: elevationLoss,
      maxElevation: Math.round(maxElevation * 100) / 100,
      minElevation: Math.round(minElevation * 100) / 100
    };
  }

  /**
   * Apply light smoothing for elevation gain/loss calculation
   */
  private smoothElevationForSummary(points: TrackPoint[]): number[] {
    if (points.length <= 3) {
      return points.map(p => p.elevation!);
    }
    
    const smoothed: number[] = [];
    const smoothingFactor = 0.4; // Lighter smoothing for summary
    
    smoothed[0] = points[0].elevation!;
    
    for (let i = 1; i < points.length; i++) {
      smoothed[i] = smoothingFactor * points[i].elevation! + 
                    (1 - smoothingFactor) * smoothed[i - 1];
    }
    
    return smoothed;
  }

  /**
   * Return empty summary for edge cases
   */
  private getEmptySummary(): Summary {
    return {
      distance: 0,
      totalTime: 0,
      movingTime: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      elevationGain: 0,
      elevationLoss: 0,
      distanceClimb: 0,
      distanceDescent: 0,
      maxElevation: undefined,
      minElevation: undefined,
      startTime: undefined,
      endTime: undefined
    };
  }

  /**
   * Return summary for single point
   */
  private getSinglePointSummary(point: TrackPoint): Summary {
    return {
      distance: 0,
      totalTime: 0,
      movingTime: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      elevationGain: 0,
      elevationLoss: 0,
      distanceClimb: 0,
      distanceDescent: 0, 
      maxElevation: point.elevation,
      minElevation: point.elevation,
      startTime: point.time,
      endTime: point.time
    };
  }


  /**
   * Perform detailed analysis of the ride data
   */
  private async performDetailedAnalysis(
    points: TrackPoint[], 
    summary: Summary, 
    boundaries: {minLat: number, maxLat: number, minLon: number, maxLon: number } | undefined,
    weatherService?: WeatherService
  ): Promise<Analysis> {
    let weather = undefined;
    let hasWeatherData = false;
    
    // Calculate ride location from boundaries
    let lat = 0, lon = 0, location = '';
    if (boundaries) {
      lat = (boundaries.minLat + boundaries.maxLat) / 2;
      lon = (boundaries.minLon + boundaries.maxLon) / 2;
      location = `(${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    }
    
    // Fetch weather data if weatherService is provided and location is valid
    if (weatherService && boundaries) {
      try {
        // Determine if we need historical data
        const rideDate = summary.startTime;
        logger.debug(`Ride date: ${rideDate ? rideDate.toISOString() : 'unknown'}, Current date: ${new Date().toISOString()}`);
        const isHistorical = rideDate ? this.isHistoricalDate(rideDate) : false;
        
        if (isHistorical && rideDate) {
          // Check if provider supports historical data for this date
          if (weatherService.supportsHistoricalDate(rideDate)) {
            logger.info(`Fetching historical weather data for ${location} on ${rideDate.toISOString()}`);
            
            const weatherResult = await weatherService.getHistoricalWeather({
              lat: lat.toString(),
              lon: lon.toString(),
              date: rideDate
            });
            
            if (weatherResult.success && weatherResult.data) {
              weather = weatherResult.data.current;
              hasWeatherData = true;
              logger.info(`Historical weather at ${location}: ${JSON.stringify(weather)}`);
            } else {
              logger.warn(`Historical weather not available: ${weatherResult.error || 'Unknown error'}`);
              hasWeatherData = false;
            }
          } else {
            const maxDays = weatherService.getHistoricalDaysSupported();
            logger.info(`Ride date is historical (${rideDate.toISOString()}), but provider only supports ${maxDays} days of history`);
            hasWeatherData = false;
          }
        } else {
          logger.debug(`Fetching current weather data for location ${location}`);
          
          // Use the weather service to get current weather data
          const weatherResult = await weatherService.getWeather({ 
            lat: lat.toString(), 
            lon: lon.toString(), 
            location 
          });
        
          if (weatherResult.success && weatherResult.data) {
            weather = weatherResult.data.current;
            hasWeatherData = true;
            logger.debug(`Weather at ${location}: ${JSON.stringify(weather)}`);
          } else {
            logger.debug(`No weather data available for ${location}`);
            hasWeatherData = false;
          }
        }
      } catch (error) {
        logger.error('Error fetching weather data:', error);
        hasWeatherData = false;
      }
    } else {
      logger.debug('No weather service provided or invalid location, skipping weather fetch');
      hasWeatherData = false;
    }

    const analysis: Analysis = {
      speedZones: this.analyzeSpeedZones(points),
      heartRateZones: this.analyzeHeartRateZones(points),
      powerZones: this.analyzePowerZones(points),
      intensityMetrics: this.calculateIntensityMetrics(points),
      weather: weather,
      hasWeatherData: hasWeatherData,
      weatherProvider: weatherService ? weatherService.getProviderName() : 'none',
      elevationenanced: false, // Placeholder, will be set if elevation data is enhanced
      caloriesBurned: { estimated: 0, method: 'none', breakdown: {} } // Placeholder, will be calculated below
    }

    // Calculate calories burned
    analysis.caloriesBurned = this.estimateCalories(points, analysis, summary);

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
   * Estimate calories burned during the ride
   * using multiple methods and selecting the most accurate one available.
   */
  private estimateCalories(points:TrackPoint[] , analysis: Analysis, summary: Summary): { estimated: number; method: string; breakdown: { base?: number; elevation?: number; power?: number; heartRate?: number } }  {
    if (points.length === 0 || summary.distance === 0 || summary.movingTime === 0) {
        return {
            estimated: 0,   
            method: 'none', 
            breakdown: {}
        };
    } 

    //TODO: refine calories calculation with rider weight

    logger.debug('Distance: ' + summary.distance.toFixed(2) + ' distanceDescent: ' + summary.distanceDescent.toFixed(2) + ' distanceClimb: ' + summary.distanceClimb.toFixed(2)+ ' elevationGain: ' + summary.elevationGain);
    // Calculate calories using distance and elevation method
    const baseCalories = Math.round((summary.distance*1000-summary.distanceDescent)/1000)*20 // Base: 5 cal/km
    //const elevationCalories = Math.round(summary.elevationGain * 10) // 10 cal per meter climbed
    //const totalCalories = baseCalories + elevationCalories

    // Method 1: Distance and elevation based
    //const baseCalories = summary.distance * 40; // ~40 calories per km
    const elevationCalories = summary.elevationGain * 0.1; // Additional for climbing
  
    // Method 2: Heart rate based (if available)
    let hrCalories = null;
    if (analysis.heartRateZones) {
        // Simplified HR-based calculation
        hrCalories = summary.movingTime / 60 * 8; // ~8 cal/min average
    }
    
    // Method 3: Power based (if available)
    let powerCalories = null;
    if (analysis.powerZones && analysis.powerZones.average) {
        // Power-based: ~3.6 calories per kJ
        const kilojoules = analysis.powerZones.average * (summary.movingTime / 1000);
        powerCalories = kilojoules * 3.6;
    }
      
    // Use most accurate method available
    const estimated = powerCalories || hrCalories || (baseCalories + elevationCalories);
    
    return {
        estimated: Math.round(estimated),
        method: powerCalories ? 'power' : hrCalories ? 'heart_rate' : 'distance_elevation',
        breakdown: {
            base: Math.round(baseCalories),
            elevation: Math.round(elevationCalories),
            heartRate: hrCalories ? Math.round(hrCalories) : undefined,
            power: powerCalories ? Math.round(powerCalories) : undefined
        }
    };
  }  
  /**
   * Calculate intensity metrics
   */
  private calculateIntensityMetrics(points: TrackPoint[]): { variabilityIndex?: number; intensityFactor?: number; trainingStressScore?: number}  {
      const metrics = {
          variabilityIndex: undefined,
          intensityFactor: undefined,
          trainingStressScore: undefined
      };

      // Basic implementation - would need user's FTP for accurate calculations
      return metrics;
  }

  /**
   * Analyze power zones if available
   */
  private analyzePowerZones(points: TrackPoint[]): { average: number; maximum: number; normalizedPower?: number } | undefined {
      const powerValues: number[] = points
          .filter(p => p.extensions && p.extensions.power && p.extensions.power > 0)
          .map(p => p.extensions?.power)
          .filter((p): p is number => p !== undefined);

      if (powerValues.length === 0) return undefined;

      // Calculate basic power statistics
      const avgPower = powerValues.reduce((a, b) => a + b) / powerValues.length;
      const maxPower = Math.max(...powerValues);
      
      return {
          average: avgPower,
          maximum: maxPower,
          normalizedPower: this.calculateNormalizedPower(powerValues)
      };
  }

  /**
   * Calculate normalized power (rolling 30-second average)
   */
  private calculateNormalizedPower(powerValues: number[]): number | undefined {
      if (powerValues.length < 30) return undefined;
      
      const rollingAverages = [];
      for (let i = 0; i <= powerValues.length - 30; i++) {
          const segment = powerValues.slice(i, i + 30);
          const average = segment.reduce((a, b) => a + b) / segment.length;
          rollingAverages.push(Math.pow(average, 4));
      }
      
      const averageFourthPower = rollingAverages.reduce((a, b) => a + b) / rollingAverages.length;
      return Math.pow(averageFourthPower, 0.25);
  }

  /**
   * Analyze heart rate zones if available
   */
  private analyzeHeartRateZones(points: TrackPoint[]): Record<string, number>  {
      const heartRates = points
          .filter(p => p.extensions && p.extensions.heartRate)
          .map(p => p.extensions.heartRate);

      if (heartRates.length === 0) return {};

      // Assuming max HR of 190 for zone calculation (should be configurable)
      const maxHR = 190;
      const zones = {
          'Zone 1 (50-60%)': 0,
          'Zone 2 (60-70%)': 0,
          'Zone 3 (70-80%)': 0,
          'Zone 4 (80-90%)': 0,
          'Zone 5 (90-100%)': 0
      };

      heartRates.forEach(hr => {
          const percentage = (hr / maxHR) * 100;
          if (percentage < 60) zones['Zone 1 (50-60%)']++;
          else if (percentage < 70) zones['Zone 2 (60-70%)']++;
          else if (percentage < 80) zones['Zone 3 (70-80%)']++;
          else if (percentage < 90) zones['Zone 4 (80-90%)']++;
          else zones['Zone 5 (90-100%)']++;
      });

      // Convert to percentages
      Object.keys(zones).forEach(zone => {
          zones[zone] = Math.round((zones[zone] / heartRates.length) * 100);
      });

      return zones;
  }

  /**
   * Analyze speed zones distribution
   */
  private analyzeSpeedZones(points: TrackPoint[]): Record<string, number> {
      const zones = {
          'Recovery (0-15 km/h)': 0,
          'Endurance (15-25 km/h)': 0,
          'Tempo (25-35 km/h)': 0,
          'Threshold (35-45 km/h)': 0,
          'VO2 Max (45+ km/h)': 0
      };

      let totalPoints = 0;

      for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];

          if (prev.time && curr.time) {
              const timeDiff = (curr.time.getTime() - prev.time.getTime()) / 1000;
              
              // Use same filtering as in calculateSummary
              if (timeDiff < 2 || timeDiff > 300) {
                  continue;
              }
              
              const distance = this.calculateDistance(prev, curr);
              const speed = (distance * 3.6) / timeDiff;
              
              // Apply same realistic speed filtering
              if (speed >= 1 && speed <= 70 && distance >= 0.002) {
                  totalPoints++;
                  if (speed < 15) zones['Recovery (0-15 km/h)']++;
                  else if (speed < 25) zones['Endurance (15-25 km/h)']++;
                  else if (speed < 35) zones['Tempo (25-35 km/h)']++;
                  else if (speed < 45) zones['Threshold (35-45 km/h)']++;
                  else zones['VO2 Max (45+ km/h)']++;
              }
          }
      }

      // Convert to percentages
      Object.keys(zones).forEach(zone => {
          zones[zone] = totalPoints > 0 ? Math.round((zones[zone] / totalPoints) * 100) : 0;
      });
      logger.debug(`Speed Zones: ${JSON.stringify(zones)}`);
      return zones;
  }

  /**
   * Identify climbing and descending segments
   */
  private identifySegments(points: TrackPoint[]): Segment[] {
    const segments: Segment[] = []
    
    const elevationPoints = points.filter(p => p.elevation !== undefined)
    
    if (elevationPoints.length < 10) return segments

    // Configuration
    const config = {
      windowSize: 5,
      elevationThreshold: 10, // meters
      gradientThreshold: 2,   // percentage
      minSegmentDistance: 100, // meters
      smoothingFactor: 0.3
    };

    // Step 1: Apply elevation smoothing
    const smoothedPoints = this.smoothElevationData(elevationPoints, config.smoothingFactor);
    
    // Step 2: Calculate gradients between consecutive points
    const gradients = this.calculateGradients(smoothedPoints);
    
    // Step 3: Identify segment boundaries
    const boundaries = this.findSegmentBoundaries(smoothedPoints, gradients, config);
    
    // Step 4: Create segments from boundaries
    for (let i = 0; i < boundaries.length - 1; i++) {
      const startIdx = boundaries[i];
      const endIdx = boundaries[i + 1];
      const segmentPoints = smoothedPoints.slice(startIdx, endIdx + 1);
      
      if (segmentPoints.length < 2) continue;
      
      const segment = this.createSegment(segmentPoints, startIdx, endIdx);
      //logger.debug(`Segment ${i + 1}: Type=${segment.type}, Distance=${segment.distance.toFixed(1)}m, ElevationChange=${segment.elevationChange.toFixed(1)}m, AvgGradient=${segment.avgGradient.toFixed(2)}%, MaxGradient=${segment.maxGradient.toFixed(2)}%`);
      // Filter out segments that are too short
      if (segment.distance >= config.minSegmentDistance) {
        segments.push(segment);
      }
    }
  
    // Step 5: Merge similar adjacent segments
    const mergedSegments = this.mergeAdjacentSegments(segments);
    
    logger.debug(`Identified ${mergedSegments.length} segments`);
    return mergedSegments;
  }

  /**
   * Apply exponential smoothing to elevation data
   */
  private smoothElevationData(points: TrackPoint[], smoothingFactor: number): TrackPoint[] {
    if (points.length === 0) return points;
    
    const smoothed = [...points];
    
    
    smoothed[0] = { ...points[0] };
   

    for (let i = 1; i < points.length; i++) {
      const currentElevation = points[i].elevation!;
      const previousSmoothed = smoothed[i - 1].elevation!;
      
      smoothed[i] = {
        ...points[i],
        elevation: smoothingFactor * currentElevation + (1 - smoothingFactor) * previousSmoothed
      };
      //logger.debug(`smooted[${i}]:  ${smoothed[i].elevation?.toFixed(2)} ${points[i].elevation}`);
    }
    
    return smoothed;
  }  

  /**
   * Find segment boundaries based on gradient changes
   */
  private findSegmentBoundaries(
    points: TrackPoint[], 
    gradients: number[], 
    config: any
  ): number[] {
    const boundaries: number[] = [0]; // Start with first point
    
    let currentSegmentType = this.getSegmentType(gradients[0], config.gradientThreshold);
    
    for (let i = config.windowSize; i < gradients.length - config.windowSize; i++) {
      // Calculate average gradient in window
      const windowStart = Math.max(0, i - config.windowSize);
      const windowEnd = Math.min(gradients.length, i + config.windowSize);
      const windowGradients = gradients.slice(windowStart, windowEnd);
      const avgGradient = windowGradients.reduce((sum, g) => sum + g, 0) / windowGradients.length;
      
      const newSegmentType = this.getSegmentType(avgGradient, config.gradientThreshold);
      
      // Check for segment type change
      if (newSegmentType !== currentSegmentType) {
        boundaries.push(i);
        currentSegmentType = newSegmentType;
      }
    }
    
    boundaries.push(points.length - 1); // End with last point
    return boundaries;
  }

  /**
   * Calculate gradients between consecutive points
   */
  private calculateGradients(points: TrackPoint[]): number[] {
    const gradients: number[] = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const distance = this.calculateDistance(points[i], points[i + 1]);
      const elevationChange = points[i + 1].elevation! - points[i].elevation!;
      
      // Gradient as percentage
      const gradient = distance > 0 ? (elevationChange / distance) * 100 : 0;
      gradients.push(gradient);
    }
    
    return gradients;
  }

  /**
   * Determine segment type based on gradient
   */
  private getSegmentType(gradient: number, threshold: number): 'climb' | 'descent' | 'flat' {
    if (gradient > threshold) return 'climb';
    if (gradient < -threshold) return 'descent';
    return 'flat';
  }

  /**
   * Create a segment from a series of points
   */
  private createSegment(points: TrackPoint[], startIdx: number, endIdx: number): Segment {
    let totalDistance = 0;
    let maxGradient = 0;
    const gradients: number[] = [];
    
    // Calculate distance and gradients
    for (let i = 0; i < points.length - 1; i++) {
      const distance = this.calculateDistance(points[i], points[i + 1]);
      totalDistance += distance;
      
      const elevationChange = points[i + 1].elevation! - points[i].elevation!;
      const gradient = distance > 0 ? Math.abs((elevationChange / distance) * 100) : 0;
      
      gradients.push(gradient);
      maxGradient = Math.max(maxGradient, gradient);
    }
    
    const totalElevationChange = points[points.length - 1].elevation! - points[0].elevation!;
    const avgGradient = totalDistance > 0 ? Math.abs((totalElevationChange / totalDistance) * 100) : 0;
    
    // Determine segment type
    const segmentType = this.getSegmentType(
      totalDistance > 0 ? (totalElevationChange / totalDistance) * 100 : 0,
      2 // Use a stricter threshold for final classification
    );
    
    // Calculate duration if timestamps are available
    let duration: number | undefined;
    if (points[0].time && points[points.length - 1].time) {
      duration = points[points.length - 1].time!.getTime()! - points[0].time.getTime()!;
    }
    
    return {
      type: segmentType,
      distance: totalDistance,
      elevationChange: totalElevationChange, //Math.abs(totalElevationChange),
      avgGradient: avgGradient,
      maxGradient: maxGradient,
      startIndex: startIdx,
      endIndex: endIdx,
      duration: duration
    };
  }

  /**
   * Merge adjacent segments of the same type if they're small
   */
  private mergeAdjacentSegments(segments: Segment[]): Segment[] {
    if (segments.length <= 1) return segments;
    
    const merged: Segment[] = [];
    let current = segments[0];
    
    for (let i = 1; i < segments.length; i++) {
      const next = segments[i];
      
      // Merge if same type and current segment is short
      if (current.type === next.type && current.distance < 200) {
        current = {
          ...current,
          distance: current.distance + next.distance,
          elevationChange: current.elevationChange + next.elevationChange,
          avgGradient: ((current.avgGradient * current.distance) + (next.avgGradient * next.distance)) / (current.distance + next.distance),
          maxGradient: Math.max(current.maxGradient, next.maxGradient),
          endIndex: next.endIndex,
          duration: current.duration && next.duration ? current.duration + next.duration : undefined
        };
      } else {
        merged.push(current);
        current = next;
      }
    }
    
    merged.push(current);
    return merged;
  }  
  /**
   * Calculate distance between two GPS points using Haversine formula
   */
  private calculateDistance(point1: TrackPoint, point2: TrackPoint): number {
    const R = 6371000; // Earth's radius in m
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLon = this.toRadians(point2.lon - point1.lon);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees) {
      return degrees * (Math.PI / 180);
  }
  
  /**
   * Check if a given date is historical (not today)
   * Returns true if the date is before today (start of day)
   */
  private isHistoricalDate(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const rideDate = new Date(date);
    rideDate.setHours(0, 0, 0, 0); // Start of ride date
    
    return rideDate < today;
  }
}
