import { createLogger } from './logger'

const logger = createLogger('TerrainService')

/**
 * Terrain types that can be identified
 */
export type TerrainType = 
  | 'urban'           // Cities, towns, built-up areas
  | 'suburban'        // Residential areas, outskirts
  | 'rural'           // Countryside, farmland
  | 'forest'          // Wooded areas
  | 'mountain'        // High elevation, mountainous terrain
  | 'coastal'         // Near coastline, beaches
  | 'desert'          // Arid, sandy areas
  | 'grassland'       // Plains, meadows
  | 'wetland'         // Marshes, swamps
  | 'industrial'      // Industrial zones
  | 'park'            // Parks, recreational areas
  | 'water'           // Lakes, rivers (if riding along)
  | 'unknown'         // Unable to determine

/**
 * Terrain segment with type and characteristics
 */
export interface TerrainSegment {
  startIndex: number
  endIndex: number
  distance: number          // Distance in meters
  terrainType: TerrainType
  elevation: number         // Average elevation in meters
  confidence: number        // 0-1 confidence score
  characteristics?: {
    population?: number     // Population density if available
    landcover?: string      // Detailed land cover type
    slope?: number          // Average slope in degrees
  }
}

/**
 * Overall terrain analysis result
 */
export interface TerrainAnalysis {
  segments: TerrainSegment[]
  summary: {
    dominantTerrain: TerrainType
    terrainDistribution: Record<TerrainType, number> // Distance in meters per terrain type
    terrainPercentages: Record<TerrainType, number>  // Percentage of route per terrain type
  }
  elevationProfile: {
    min: number
    max: number
    range: number
    avgSlope: number
  }
}

/**
 * Point with coordinates and optional elevation
 */
interface RoutePoint {
  lat: number
  lon: number
  elevation?: number
}

/**
 * Configuration for terrain analysis
 */
export interface TerrainServiceConfig {
  // OpenStreetMap Overpass API (free, no key required)
  overpassApiUrl?: string
  
  // OpenTopoData API (free, no key required)
  openTopoDataUrl?: string
  
  // Sample interval - analyze every N points (default: 10)
  sampleInterval?: number
  
  // Enable API calls (can be disabled for testing)
  enableApiCalls?: boolean
  
  // API request timeout in milliseconds (default: 15000)
  apiTimeout?: number
  
  // Delay between API requests in milliseconds (default: 1500)
  apiDelay?: number
  
  // Batch size for processing points (default: 5)
  batchSize?: number
  
  // Query radius in meters (default: 100)
  queryRadius?: number
}

/**
 * Service for analyzing terrain types along a route
 */
export class TerrainService {
  private config: TerrainServiceConfig
  private log = createLogger('TerrainService')

  constructor(config: TerrainServiceConfig = {}) {
    this.config = {
      overpassApiUrl: config.overpassApiUrl || 'https://overpass-api.de/api/interpreter',
      openTopoDataUrl: config.openTopoDataUrl || 'https://api.opentopodata.org/v1',
      sampleInterval: config.sampleInterval || 10,
      enableApiCalls: config.enableApiCalls !== false,
      apiTimeout: config.apiTimeout || 15000,        // 15 seconds timeout
      apiDelay: config.apiDelay || 1500,             // 1.5 seconds between requests
      batchSize: config.batchSize || 5,              // Process 5 points at a time
      queryRadius: config.queryRadius || 100         // 100 meters radius
    }
  }

  /**
   * Analyze terrain along a route defined by track points
   */
  async analyzeRoute(points: RoutePoint[]): Promise<TerrainAnalysis> {
    if (points.length === 0) {
      return this.getEmptyAnalysis()
    }

    this.log.info(`🗺️ Analyzing terrain for route with ${points.length} points`)

    // Sample points to reduce API calls
    const sampledPoints = this.samplePoints(points, this.config.sampleInterval!)
    this.log.info(`📍 Sampled ${sampledPoints.length} points for terrain analysis`)

    // Analyze terrain at sampled points
    const terrainSegments: TerrainSegment[] = []
    
    if (this.config.enableApiCalls) {
      try {
        // Batch process points in groups to avoid overwhelming APIs
        const batchSize = this.config.batchSize!
        for (let i = 0; i < sampledPoints.length; i += batchSize) {
          const batch = sampledPoints.slice(i, Math.min(i + batchSize, sampledPoints.length))
          
          // Analyze this batch
          const batchResults = await Promise.all(
            batch.map(point => this.analyzePointTerrain(point))
          )
          
          // Create segments from batch results
          batchResults.forEach((terrain, idx) => {
            const pointIdx = i + idx
            const startIdx = pointIdx * this.config.sampleInterval!
            const endIdx = Math.min(
              (pointIdx + 1) * this.config.sampleInterval!,
              points.length - 1
            )
            
            const segment: TerrainSegment = {
              startIndex: startIdx,
              endIndex: endIdx,
              distance: this.calculateSegmentDistance(points, startIdx, endIdx),
              terrainType: terrain.type,
              elevation: batch[idx].elevation || 0,
              confidence: terrain.confidence
            }
            
            terrainSegments.push(segment)
          })
          
          // Rate limiting - wait between batches
          if (i + batchSize < sampledPoints.length) {
            await this.sleep(this.config.apiDelay!) // Configurable delay between batches
          }
        }
      } catch (error) {
        this.log.error('Error during terrain analysis, falling back to elevation-based analysis:', error)
        return this.fallbackElevationAnalysis(points)
      }
    } else {
      // Fallback to elevation-based analysis when API calls are disabled
      return this.fallbackElevationAnalysis(points)
    }

    // Merge similar adjacent segments
    const mergedSegments = this.mergeAdjacentSegments(terrainSegments)

    // Calculate summary statistics
    const summary = this.calculateSummary(mergedSegments, points)

    // Calculate elevation profile
    const elevationProfile = this.calculateElevationProfile(points)

    this.log.info(`✅ Terrain analysis complete: ${mergedSegments.length} segments identified`)
    this.log.info(`📊 Dominant terrain: ${summary.dominantTerrain}`)

    return {
      segments: mergedSegments,
      summary,
      elevationProfile
    }
  }

  /**
   * Analyze terrain type at a specific point using various APIs
   */
  private async analyzePointTerrain(point: RoutePoint): Promise<{ type: TerrainType; confidence: number }> {
    try {
      // Try OpenStreetMap Overpass API for land use data with retry
      
      //logger.debug(`Querying Overpass API for point (${point.lat}, ${point.lon})`)
      const osmData = await this.queryOverpassAPIWithRetry(point, 0)
      
      if (osmData) {
        return osmData
      }

      // Fallback to elevation-based classification
      return this.classifyByElevation(point)
    } catch (error) {
      this.log.debug(`Error analyzing point (${point.lat}, ${point.lon}):`, error)
      return { type: 'unknown', confidence: 0.3 }
    }
  }

  /**
   * Query Overpass API with retry logic and exponential backoff
   */
  private async queryOverpassAPIWithRetry(point: RoutePoint, maxRetries: number): Promise<{ type: TerrainType; confidence: number } | null> {
    let lastError: any = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.queryOverpassAPI(point)
        if (result) return result
        
        // If we got no result but no error, don't retry
        return null
      } catch (error: any) {
        lastError = error
        
        // Don't retry on final attempt
        if (attempt < maxRetries) {
          // Exponential backoff: 2s, 4s, 8s...
          const backoffMs = Math.pow(2, attempt + 1) * 1000
          this.log.debug(`Overpass API attempt ${attempt + 1} failed, retrying in ${backoffMs}ms...`)
          await this.sleep(backoffMs)
        }
      }
    }
    
    // All retries failed
    this.log.warn(`Overpass API failed after ${maxRetries + 1} attempts:`, lastError?.message)
    return null
  }

  /**
   * Query OpenStreetMap Overpass API for land use and natural features
   */
  private async queryOverpassAPI(point: RoutePoint): Promise<{ type: TerrainType; confidence: number } | null> {
    try {
      // Query for surrounding area with configurable radius
      const radius = this.config.queryRadius!
      const serverTimeout = Math.floor((this.config.apiTimeout! - 2000) / 1000) // Server timeout slightly less than client
      
      const query = `
        [out:json][timeout:${serverTimeout}];
        (
          way(around:${radius},${point.lat},${point.lon})["landuse"];
          way(around:${radius},${point.lat},${point.lon})["natural"];
          way(around:${radius},${point.lat},${point.lon})["leisure"];
          way(around:${radius},${point.lat},${point.lon})["place"];
        );
        out tags;
      `
      //logger.debug(`Overpass API query: ${query.trim()}`)

      // Send POST request to Overpass API  
      const response = await fetch(this.config.overpassApiUrl!, {
        method: 'POST',
        body: query,
        signal: AbortSignal.timeout(this.config.apiTimeout!)
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      
      if (!data.elements || data.elements.length === 0) {
        return null
      }

      // Analyze tags to determine terrain type
      const tags = data.elements[0].tags
      const terrainType = this.classifyFromOSMTags(tags)
      
      return {
        type: terrainType,
        confidence: 0.8
      }
    } catch (error) {
      this.log.debug('Overpass API error:', error)
      return null
    }
  }

  /**
   * Classify terrain from OpenStreetMap tags
   */
  private classifyFromOSMTags(tags: Record<string, string>): TerrainType {
    // Landuse classification
    if (tags.landuse) {
      const landuse = tags.landuse.toLowerCase()
      if (landuse.includes('residential')) return 'suburban'
      if (landuse.includes('commercial') || landuse.includes('retail')) return 'urban'
      if (landuse.includes('industrial')) return 'industrial'
      if (landuse.includes('forest') || landuse.includes('wood')) return 'forest'
      if (landuse.includes('farmland') || landuse.includes('farm')) return 'rural'
      if (landuse.includes('meadow') || landuse.includes('grass')) return 'grassland'
    }

    // Natural features
    if (tags.natural) {
      const natural = tags.natural.toLowerCase()
      if (natural.includes('wood') || natural.includes('forest')) return 'forest'
      if (natural.includes('water') || natural.includes('lake')) return 'water'
      if (natural.includes('beach') || natural.includes('coastline')) return 'coastal'
      if (natural.includes('grassland') || natural.includes('heath')) return 'grassland'
      if (natural.includes('wetland') || natural.includes('marsh')) return 'wetland'
      if (natural.includes('sand') || natural.includes('dune')) return 'desert'
    }

    // Leisure areas
    if (tags.leisure) {
      if (tags.leisure.includes('park') || tags.leisure.includes('garden')) return 'park'
    }

    // Place classification
    if (tags.place) {
      const place = tags.place.toLowerCase()
      if (place.includes('city') || place.includes('town')) return 'urban'
      if (place.includes('village') || place.includes('hamlet')) return 'rural'
    }

    return 'unknown'
  }

  /**
   * Classify terrain based on elevation (fallback method)
   */
  private classifyByElevation(point: RoutePoint): { type: TerrainType; confidence: number } {
    if (!point.elevation) {
      return { type: 'unknown', confidence: 0.2 }
    }

    const elevation = point.elevation

    // Simple elevation-based classification
    if (elevation > 2000) {
      return { type: 'mountain', confidence: 0.7 }
    } else if (elevation > 1000) {
      return { type: 'mountain', confidence: 0.6 }
    } else if (elevation > 500) {
      return { type: 'rural', confidence: 0.5 }
    } else if (elevation < 50) {
      return { type: 'coastal', confidence: 0.4 }
    } else {
      return { type: 'rural', confidence: 0.4 }
    }
  }

  /**
   * Fallback elevation-based analysis when API calls fail or are disabled
   */
  private fallbackElevationAnalysis(points: RoutePoint[]): TerrainAnalysis {
    this.log.info('Using elevation-based terrain classification')
    
    const segments: TerrainSegment[] = []
    let currentTerrain: TerrainType = 'unknown'
    let segmentStart = 0

    for (let i = 0; i < points.length; i++) {
      const terrain = this.classifyByElevation(points[i])
      
      // Start new segment if terrain type changes
      if (terrain.type !== currentTerrain && i > 0) {
        segments.push({
          startIndex: segmentStart,
          endIndex: i - 1,
          distance: this.calculateSegmentDistance(points, segmentStart, i - 1),
          terrainType: currentTerrain,
          elevation: points[Math.floor((segmentStart + i - 1) / 2)].elevation || 0,
          confidence: 0.5
        })
        
        segmentStart = i
        currentTerrain = terrain.type
      } else if (i === 0) {
        currentTerrain = terrain.type
      }
    }

    // Add final segment
    if (segmentStart < points.length - 1) {
      segments.push({
        startIndex: segmentStart,
        endIndex: points.length - 1,
        distance: this.calculateSegmentDistance(points, segmentStart, points.length - 1),
        terrainType: currentTerrain,
        elevation: points[Math.floor((segmentStart + points.length - 1) / 2)].elevation || 0,
        confidence: 0.5
      })
    }

    const mergedSegments = this.mergeAdjacentSegments(segments)
    const summary = this.calculateSummary(mergedSegments, points)
    const elevationProfile = this.calculateElevationProfile(points)

    return {
      segments: mergedSegments,
      summary,
      elevationProfile
    }
  }

  /**
   * Sample points from route at regular intervals
   */
  private samplePoints(points: RoutePoint[], interval: number): RoutePoint[] {
    const sampled: RoutePoint[] = []
    for (let i = 0; i < points.length; i += interval) {
      sampled.push(points[i])
    }
    // Always include the last point
    if (sampled[sampled.length - 1] !== points[points.length - 1]) {
      sampled.push(points[points.length - 1])
    }
    return sampled
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(p1: RoutePoint, p2: RoutePoint): number {
    const R = 6371000 // Earth's radius in meters
    const lat1 = p1.lat * Math.PI / 180
    const lat2 = p2.lat * Math.PI / 180
    const deltaLat = (p2.lat - p1.lat) * Math.PI / 180
    const deltaLon = (p2.lon - p1.lon) * Math.PI / 180

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  /**
   * Calculate total distance of a segment
   */
  private calculateSegmentDistance(points: RoutePoint[], startIdx: number, endIdx: number): number {
    let distance = 0
    for (let i = startIdx; i < endIdx; i++) {
      distance += this.calculateDistance(points[i], points[i + 1])
    }
    return distance
  }

  /**
   * Merge adjacent segments with the same terrain type
   */
  private mergeAdjacentSegments(segments: TerrainSegment[]): TerrainSegment[] {
    if (segments.length <= 1) return segments

    const merged: TerrainSegment[] = []
    let current = segments[0]

    for (let i = 1; i < segments.length; i++) {
      if (segments[i].terrainType === current.terrainType) {
        // Merge with current segment
        current = {
          ...current,
          endIndex: segments[i].endIndex,
          distance: current.distance + segments[i].distance,
          elevation: (current.elevation + segments[i].elevation) / 2,
          confidence: (current.confidence + segments[i].confidence) / 2
        }
      } else {
        // Push current and start new segment
        merged.push(current)
        current = segments[i]
      }
    }
    merged.push(current)

    return merged
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(segments: TerrainSegment[], points: RoutePoint[]): TerrainAnalysis['summary'] {
    const terrainDistribution: Record<string, number> = {}
    const terrainPercentages: Record<string, number> = {}
    
    let totalDistance = 0
    
    // Calculate total distance and distribution
    segments.forEach(segment => {
      const terrain = segment.terrainType
      terrainDistribution[terrain] = (terrainDistribution[terrain] || 0) + segment.distance
      totalDistance += segment.distance
    })

    // Calculate percentages
    Object.keys(terrainDistribution).forEach(terrain => {
      terrainPercentages[terrain] = totalDistance > 0 
        ? (terrainDistribution[terrain] / totalDistance) * 100 
        : 0
    })

    // Find dominant terrain
    let dominantTerrain: TerrainType = 'unknown'
    let maxDistance = 0
    Object.entries(terrainDistribution).forEach(([terrain, distance]) => {
      if (distance > maxDistance) {
        maxDistance = distance
        dominantTerrain = terrain as TerrainType
      }
    })

    return {
      dominantTerrain,
      terrainDistribution: terrainDistribution as Record<TerrainType, number>,
      terrainPercentages: terrainPercentages as Record<TerrainType, number>
    }
  }

  /**
   * Calculate elevation profile statistics
   */
  private calculateElevationProfile(points: RoutePoint[]): TerrainAnalysis['elevationProfile'] {
    const elevations = points.filter(p => p.elevation !== undefined).map(p => p.elevation!)
    
    if (elevations.length === 0) {
      return { min: 0, max: 0, range: 0, avgSlope: 0 }
    }

    const min = Math.min(...elevations)
    const max = Math.max(...elevations)
    const range = max - min

    // Calculate average slope
    let totalSlope = 0
    let slopeCount = 0
    for (let i = 1; i < points.length; i++) {
      if (points[i].elevation !== undefined && points[i - 1].elevation !== undefined) {
        const elevationChange = points[i].elevation! - points[i - 1].elevation!
        const distance = this.calculateDistance(points[i - 1], points[i])
        if (distance > 0) {
          totalSlope += Math.abs((elevationChange / distance) * 100)
          slopeCount++
        }
      }
    }
    const avgSlope = slopeCount > 0 ? totalSlope / slopeCount : 0

    return { min, max, range, avgSlope }
  }

  /**
   * Get empty analysis result
   */
  private getEmptyAnalysis(): TerrainAnalysis {
    return {
      segments: [],
      summary: {
        dominantTerrain: 'unknown',
        terrainDistribution: {},
        terrainPercentages: {}
      },
      elevationProfile: {
        min: 0,
        max: 0,
        range: 0,
        avgSlope: 0
      }
    }
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
