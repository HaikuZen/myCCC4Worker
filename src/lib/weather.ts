import { createLogger } from './logger'
import {
  IWeatherProvider,
  WeatherData,
  CurrentWeather,
  HourlyWeather,
  DailyWeather,
  OpenWeatherMapProvider,
  WeatherAPIProvider,
  WeatherBitProvider,
  VisualCrossingProvider
} from './weather-providers'

export { WeatherData, CurrentWeather, HourlyWeather, DailyWeather } from './weather-providers'

export interface LocationData {
  name: string
  country: string
  lat: number
  lon: number
  state?: string | null
}

export type WeatherProviderType = 'openweathermap' | 'weatherapi' | 'weatherbit' | 'visualcrossing'

export interface WeatherServiceConfig {
  provider: WeatherProviderType
  apiKeys: {
    openweathermap?: string
    weatherapi?: string
    weatherbit?: string
    visualcrossing?: string
  }
  geocodingApiKey?: string // OpenWeatherMap key for geocoding (default)
}

export class WeatherService {
  private provider: IWeatherProvider
  private geocodingApiKey: string | undefined
  private log = createLogger('WeatherService')
  private config: WeatherServiceConfig

  constructor(config: WeatherServiceConfig | string) {
    // Backwards compatibility: accept string API key
    if (typeof config === 'string') {
      this.config = {
        provider: 'openweathermap',
        apiKeys: { openweathermap: config },
        geocodingApiKey: config
      }
    } else {
      this.config = config
    }

    // Set geocoding API key (default to OpenWeatherMap)
    this.geocodingApiKey = this.config.geocodingApiKey || this.config.apiKeys.openweathermap

    // Initialize weather provider
    this.provider = this.createProvider(this.config.provider, this.config.apiKeys)
    
    this.log.info(`WeatherService initialized with provider: ${this.config.provider}`)
  }

  /**
   * Factory method to create weather provider instances
   */
  private createProvider(providerType: WeatherProviderType, apiKeys: any): IWeatherProvider {
    const providerKey = apiKeys[providerType]
    
    if (!providerKey) {
      this.log.warn(`No API key configured for ${providerType}, falling back to OpenWeatherMap`)
      return new OpenWeatherMapProvider({ apiKey: apiKeys.openweathermap || '' })
    }

    switch (providerType) {
      case 'openweathermap':
        return new OpenWeatherMapProvider({ apiKey: providerKey })
      case 'weatherapi':
        return new WeatherAPIProvider({ apiKey: providerKey })
      case 'weatherbit':
        return new WeatherBitProvider({ apiKey: providerKey })
      case 'visualcrossing':
        return new VisualCrossingProvider({ apiKey: providerKey })
      default:
        this.log.warn(`Unknown provider ${providerType}, falling back to OpenWeatherMap`)
        return new OpenWeatherMapProvider({ apiKey: apiKeys.openweathermap || '' })
    }
  }

  /**
   * Geocode a location name to get coordinates
   * Always uses OpenWeatherMap geocoding API as it's reliable and free
   */
  async geocodeLocation(locationName: string): Promise<{ success: boolean; data?: LocationData; demo?: boolean; error?: string }> {
    if (!locationName || locationName.length < 2) {
      return { success: false, error: 'Location parameter is required and must be at least 2 characters long' }
    }

    // Log geocoding request
    this.log.info(`🌍 Geocoding location: ${locationName}`)

    if (!this.geocodingApiKey) {
      this.log.warn('No weather API key found in environment, using demo mode')
      const demoData = this.getDemoLocationData(locationName)
      if (demoData) {
        return { success: true, data: demoData, demo: true }
      } else {
        return { success: false, error: 'Location not found in demo data and no API key configured', demo: true }
      }
    }

    try {
      const apiUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(locationName)}&limit=1&appid=${this.geocodingApiKey}`
      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`)
      }

      const data = await response.json()

      if (data.length === 0) {
        // Fallback to demo data if API returns no results
        const demoData = this.getDemoLocationData(locationName)
        if (demoData) {
          this.log.info('No API results found, falling back to demo data')
          return { success: true, data: demoData, demo: true }
        }
        return { success: false, error: 'Location not found' }
      }

      const location = data[0]
      const locationData: LocationData = {
        name: location.name,
        country: location.country,
        lat: location.lat,
        lon: location.lon,
        state: location.state || null
      }

      //this.log.info(`✅ Location found:`, locationData)

      return { success: true, data: locationData, demo: false }
    } catch (error) {
      this.log.error('Error geocoding location:', error)

      // Fallback to demo data for common locations
      const demoData = this.getDemoLocationData(locationName)
      if (demoData) {
        this.log.info('API error, falling back to demo data')
        return {
          success: true,
          data: demoData,
          demo: true
        }
      }

      return { success: false, error: `Geocoding failed: ${error.message}` }
    }
  }

  /**
   * Get historical weather data for coordinates on a specific date
   */
  async getHistoricalWeather(params: { lat: string; lon: string; date: Date }): Promise<{ success: boolean; data?: WeatherData; demo?: boolean; warning?: string; error?: string }> {
    const { lat, lon, date } = params
    
    this.log.info(`🕐 Getting historical weather data for: ${lat},${lon} on ${date.toISOString()}`)
    
    if (!this.provider.isConfigured()) {
      this.log.warn('Weather provider not configured, cannot fetch historical data')
      return { success: false, error: 'Weather provider not configured', demo: true }
    }
    
    // Check if provider supports historical weather for this date
    if (!this.provider.supportsHistoricalDate(date)) {
      const msg = `Provider ${this.provider.name} does not support historical data for ${date.toISOString()} (max: ${this.provider.historicalDaysSupported} days)`
      this.log.warn(msg)
      return { success: false, error: msg, demo: false }
    }
    
    try {
      const weatherData = await this.provider.getHistoricalWeather(
        parseFloat(lat),
        parseFloat(lon),
        date
      )
      
      this.log.info(`✅ Historical weather data retrieved successfully from ${this.provider.name}`)
      
      return { success: true, data: weatherData, demo: false }
    } catch (error) {
      this.log.error('Error getting historical weather data:', error)
      return {
        success: false,
        error: `Historical weather API error: ${error.message}`,
        demo: false
      }
    }
  }
  
  /**
   * Check if historical weather is supported for a given date
   */
  supportsHistoricalDate(date: Date): boolean {
    if (!this.provider.isConfigured()) {
      return false
    }
    return this.provider.supportsHistoricalDate(date)
  }
  
  /**
   * Get the maximum number of days of historical data supported
   */
  getHistoricalDaysSupported(): number {
    return this.provider.historicalDaysSupported
  }
  
  /**
   * Get weather data for coordinates or location
   */
  async getWeather(params: { lat?: string; lon?: string; location?: string }): Promise<{ success: boolean; data?: WeatherData; demo?: boolean; warning?: string; error?: string }> {
    const { lat, lon, location } = params

    if ((!lat || !lon) && !location) {
      return { success: false, error: 'Either coordinates (lat, lon) or location parameter is required' }
    }

    this.log.info(`🌤️ Getting weather data for: ${location || `${lat},${lon}`}`)

    if (!this.provider.isConfigured()) {
      this.log.warn('Weather provider not configured, using demo weather data')
      const demoData = this.getDemoWeatherData(location || 'London,GB')
      return { success: true, data: demoData, demo: true }
    }

    try {
      let weatherLat = lat
      let weatherLon = lon

      // If location is provided but no coordinates, geocode first
      if (location && (!lat || !lon)) {
        const geocodeResult = await this.geocodeLocation(location)
        if (geocodeResult.success && geocodeResult.data) {
          weatherLat = geocodeResult.data.lat.toString()
          weatherLon = geocodeResult.data.lon.toString()
        }
      }

      if (!weatherLat || !weatherLon) {
        throw new Error('Could not determine coordinates for weather data')
      }

      // Get weather data from provider
      const weatherData = await this.provider.getWeather(
        parseFloat(weatherLat),
        parseFloat(weatherLon)
      )

      this.log.info(`✅ Weather data retrieved successfully from ${this.provider.name}`)

      return { success: true, data: weatherData, demo: false }
    } catch (error) {
      this.log.error('Error getting weather data:', error)

      // Fallback to demo data
      const demoData = this.getDemoWeatherData(location || 'London,GB')
      return {
        success: true,
        data: demoData,
        demo: true,
        warning: `API error: ${error.message}`
      }
    }
  }


  /**
   * Get demo weather data for testing/fallback
   */
  private getDemoWeatherData(location: string): WeatherData {
    const locationWeather: Record<string, any> = {
      'London,GB': {
        temp: 18, condition: 'Cloudy', humidity: 75, wind: 15,
        tempRange: { min: 12, max: 22 }, windRange: { min: 8, max: 25 }, precipitationChance: 70,
        pressure: 1013, visibility: 10, uvIndex: 6
      },
      'Milan,IT': {
        temp: 24, condition: 'Sunny', humidity: 60, wind: 8,
        tempRange: { min: 18, max: 30 }, windRange: { min: 3, max: 15 }, precipitationChance: 20,
        pressure: 1015, visibility: 15, uvIndex: 8
      },
      'Paris,FR': {
        temp: 20, condition: 'Partly Cloudy', humidity: 68, wind: 12,
        tempRange: { min: 15, max: 25 }, windRange: { min: 6, max: 20 }, precipitationChance: 45,
        pressure: 1012, visibility: 12, uvIndex: 7
      },
      'Berlin,DE': {
        temp: 16, condition: 'Overcast', humidity: 72, wind: 18,
        tempRange: { min: 10, max: 22 }, windRange: { min: 12, max: 28 }, precipitationChance: 60,
        pressure: 1008, visibility: 8, uvIndex: 5
      },
      'Madrid,ES': {
        temp: 28, condition: 'Hot', humidity: 45, wind: 6,
        tempRange: { min: 22, max: 35 }, windRange: { min: 2, max: 12 }, precipitationChance: 10,
        pressure: 1020, visibility: 20, uvIndex: 9
      }
    }

    const weather = locationWeather[location] || locationWeather['London,GB']

    // Generate demo hourly data
    const hourlyData: HourlyWeather[] = []
    for (let i = 0; i < 24; i++) {
      const hour = (new Date().getHours() + i) % 24
      const tempVariation = Math.sin((hour - 6) / 24 * Math.PI * 2) * (weather.tempRange.max - weather.tempRange.min) / 4
      hourlyData.push({
        hour,
        temp: Math.round(weather.temp + tempVariation + (Math.random() - 0.5) * 3),
        windSpeed: Math.round(weather.wind + (Math.random() - 0.5) * 10),
        precipitation: Math.round(weather.precipitationChance + (Math.random() - 0.5) * 30),
        condition: weather.condition
      })
    }

    // Generate demo daily forecast
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const icons = ['fa-sun', 'fa-cloud-sun', 'fa-cloud', 'fa-cloud-rain', 'fa-cloud-sun', 'fa-sun', 'fa-cloud']
    const dailyForecast: DailyWeather[] = []

    for (let i = 0; i < 7; i++) {
      dailyForecast.push({
        day: days[i],
        temp: Math.round(weather.temp + (Math.random() - 0.5) * 6),
        condition: weather.condition,
        icon: icons[i]
      })
    }

    return {
      current: {
        temp: weather.temp,
        condition: weather.condition,
        humidity: weather.humidity,
        wind: weather.wind,
        pressure: weather.pressure,
        visibility: weather.visibility,
        uvIndex: weather.uvIndex,
        precipitationChance: weather.precipitationChance
      },
      tempRange: weather.tempRange,
      windRange: weather.windRange,
      hourlyData,
      dailyForecast
    }
  }

  /**
   * Get demo location data for testing/fallback
   */
  private getDemoLocationData(locationName: string): LocationData | null {
    const demoLocations: Record<string, LocationData> = {
      'milan': { name: 'Milan', country: 'IT', lat: 45.4642, lon: 9.1900 },
      'london': { name: 'London', country: 'GB', lat: 51.5074, lon: -0.1278 },
      'paris': { name: 'Paris', country: 'FR', lat: 48.8566, lon: 2.3522 },
      'berlin': { name: 'Berlin', country: 'DE', lat: 52.5200, lon: 13.4050 },
      'madrid': { name: 'Madrid', country: 'ES', lat: 40.4168, lon: -3.7038 },
      'rome': { name: 'Rome', country: 'IT', lat: 41.9028, lon: 12.4964 },
      'amsterdam': { name: 'Amsterdam', country: 'NL', lat: 52.3676, lon: 4.9041 },
      'barcelona': { name: 'Barcelona', country: 'ES', lat: 41.3851, lon: 2.1734 },
      'vienna': { name: 'Vienna', country: 'AT', lat: 48.2082, lon: 16.3738 },
      'prague': { name: 'Prague', country: 'CZ', lat: 50.0755, lon: 14.4378 },
      'new york': { name: 'New York', country: 'US', lat: 40.7128, lon: -74.0060 },
      'los angeles': { name: 'Los Angeles', country: 'US', lat: 34.0522, lon: -118.2437 },
      'chicago': { name: 'Chicago', country: 'US', lat: 41.8781, lon: -87.6298 },
      'toronto': { name: 'Toronto', country: 'CA', lat: 43.6532, lon: -79.3832 },
      'sydney': { name: 'Sydney', country: 'AU', lat: -33.8688, lon: 151.2093 },
      'tokyo': { name: 'Tokyo', country: 'JP', lat: 35.6762, lon: 139.6503 },
      'singapore': { name: 'Singapore', country: 'SG', lat: 1.3521, lon: 103.8198 }
    }

    const key = locationName.toLowerCase().trim()
    return demoLocations[key] || null
  }

  /**
   * Get the name of the configured weather provider
   */
  getProviderName(): string {
    return this.provider.name
  }
}
