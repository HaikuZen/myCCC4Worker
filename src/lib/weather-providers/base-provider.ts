import { createLogger, Logger } from '../logger'

export interface CurrentWeather {
  temp: number
  condition: string
  humidity: number
  wind: number
  pressure: number
  visibility: number
  uvIndex: number
  precipitationChance: number
}

export interface HourlyWeather {
  hour: number
  temp: number
  windSpeed: number
  precipitation: number
  condition: string
}

export interface DailyWeather {
  day: string
  temp: number
  condition: string
  icon: string
}

export interface WeatherData {
  current: CurrentWeather
  tempRange: { min: number; max: number }
  windRange: { min: number; max: number }
  hourlyData: HourlyWeather[]
  dailyForecast: DailyWeather[]
}

export interface WeatherProviderConfig {
  apiKey: string
  timeout?: number
}

/**
 * Interface that all weather providers must implement
 */
export interface IWeatherProvider {
  readonly name: string
  
  /**
   * Maximum number of days of historical weather data supported
   * 0 means historical weather is not supported
   */
  readonly historicalDaysSupported: number
  
  /**
   * Get weather data for given coordinates
   */
  getWeather(lat: number, lon: number): Promise<WeatherData>
  
  /**
   * Get historical weather data for a specific date
   * @param lat Latitude
   * @param lon Longitude
   * @param date Date to get weather for
   * @returns Weather data for the specified date
   * @throws Error if historical weather is not supported or date is out of range
   */
  getHistoricalWeather(lat: number, lon: number, date: Date): Promise<WeatherData>
  
  /**
   * Check if the provider is configured and ready to use
   */
  isConfigured(): boolean
  
  /**
   * Check if historical weather is supported for the given date
   * @param date Date to check
   * @returns true if historical weather is available for this date
   */
  supportsHistoricalDate(date: Date): boolean
}

/**
 * Abstract base class for weather providers
 * Provides common functionality and utilities
 */
export abstract class WeatherProviderBase implements IWeatherProvider {
  protected config: WeatherProviderConfig
  protected log: Logger
  
  abstract readonly name: string
  abstract readonly historicalDaysSupported: number
  
  constructor(config: WeatherProviderConfig) {
    this.config = {
      timeout: 8000, // Default 8 second timeout
      ...config
    }
    this.log = createLogger(`WeatherProvider:${this.name}`)
  }
  
  abstract getWeather(lat: number, lon: number): Promise<WeatherData>
  abstract getHistoricalWeather(lat: number, lon: number, date: Date): Promise<WeatherData>
  
  isConfigured(): boolean {
    return !!this.config.apiKey && this.config.apiKey.length > 0
  }
  
  /**
   * Check if historical weather is supported for the given date
   */
  supportsHistoricalDate(date: Date): boolean {
    if (this.historicalDaysSupported === 0) {
      return false
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    
    const daysDiff = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24))
    
    return daysDiff >= 0 && daysDiff <= this.historicalDaysSupported
  }
  
  /**
   * Make HTTP request with timeout and error handling
   */
  protected async fetchWithTimeout(url: string, timeoutMs?: number): Promise<Response> {
    const timeout = timeoutMs || this.config.timeout || 8000
    
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeout)
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return response
    } catch (error: any) {
      if (error.name === 'TimeoutError') {
        throw new Error(`Request timeout after ${timeout}ms`)
      }
      throw error
    }
  }
  
  /**
   * Map weather condition to FontAwesome icon
   */
  protected mapConditionToIcon(condition: string): string {
    const conditionLower = condition.toLowerCase()
    
    if (conditionLower.includes('clear') || conditionLower.includes('sunny')) {
      return 'fa-sun'
    } else if (conditionLower.includes('few clouds') || conditionLower.includes('partly')) {
      return 'fa-cloud-sun'
    } else if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) {
      return 'fa-cloud'
    } else if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) {
      return 'fa-cloud-rain'
    } else if (conditionLower.includes('thunder') || conditionLower.includes('storm')) {
      return 'fa-bolt'
    } else if (conditionLower.includes('snow') || conditionLower.includes('sleet')) {
      return 'fa-snowflake'
    } else if (conditionLower.includes('mist') || conditionLower.includes('fog') || conditionLower.includes('haze')) {
      return 'fa-smog'
    }
    
    return 'fa-cloud' // Default fallback
  }
  
  /**
   * Capitalize each word in a string
   */
  protected capitalizeWords(str: string): string {
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }
  
  /**
   * Get day name from date
   */
  protected getDayName(date: Date): string {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
  }
  
  /**
   * Convert meters per second to kilometers per hour
   */
  protected msToKmh(ms: number): number {
    return Math.round(ms * 3.6)
  }
  
  /**
   * Convert miles per hour to kilometers per hour
   */
  protected mphToKmh(mph: number): number {
    return Math.round(mph * 1.60934)
  }
}
