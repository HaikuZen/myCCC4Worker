import { createLogger } from './logger'

export interface LocationData {
  name: string
  country: string
  lat: number
  lon: number
  state?: string | null
}

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

export class WeatherService {
  private apiKey: string | undefined
  private log = createLogger('WeatherService')

  constructor(apiKey?: string) {
    this.apiKey = apiKey
  }

  /**
   * Geocode a location name to get coordinates
   */
  async geocodeLocation(locationName: string): Promise<{ success: boolean; data?: LocationData; demo?: boolean; error?: string }> {
    if (!locationName || locationName.length < 2) {
      return { success: false, error: 'Location parameter is required and must be at least 2 characters long' }
    }

    this.log.info(`🌍 Geocoding location: ${locationName}`)

    if (!this.apiKey) {
      this.log.warn('No weather API key found in environment, using demo mode')
      const demoData = this.getDemoLocationData(locationName)
      if (demoData) {
        return { success: true, data: demoData, demo: true }
      } else {
        return { success: false, error: 'Location not found in demo data and no API key configured', demo: true }
      }
    }

    try {
      const apiUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(locationName)}&limit=1&appid=${this.apiKey}`
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

      this.log.info(`✅ Location found:`, locationData)

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
   * Get weather data for coordinates or location
   */
  async getWeather(params: { lat?: string; lon?: string; location?: string }): Promise<{ success: boolean; data?: WeatherData; demo?: boolean; warning?: string; error?: string }> {
    const { lat, lon, location } = params

    if ((!lat || !lon) && !location) {
      return { success: false, error: 'Either coordinates (lat, lon) or location parameter is required' }
    }

    this.log.info(`🌤️ Getting weather data for: ${location || `${lat},${lon}`}`)

    if (!this.apiKey) {
      this.log.warn('No weather API key found in environment, using demo weather data')
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

      // Get current weather data
      const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${weatherLat}&lon=${weatherLon}&appid=${this.apiKey}&units=metric`
      const currentResponse = await fetch(currentWeatherUrl, {
        signal: AbortSignal.timeout(8000)
      })

      if (!currentResponse.ok) {
        throw new Error(`Current weather API error: ${currentResponse.status}`)
      }

      const currentWeather = await currentResponse.json()

      // Get hourly forecast data
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${weatherLat}&lon=${weatherLon}&appid=${this.apiKey}&units=metric`
      const forecastResponse = await fetch(forecastUrl, {
        signal: AbortSignal.timeout(8000)
      })

      if (!forecastResponse.ok) {
        throw new Error(`Forecast API error: ${forecastResponse.status}`)
      }

      const forecastWeather = await forecastResponse.json()

      // Process the weather data
      const weatherData = this.processWeatherData(currentWeather, forecastWeather)

      this.log.info(`✅ Weather data retrieved successfully`)

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
   * Process OpenWeatherMap API response into frontend-compatible format
   */
  private processWeatherData(currentWeather: any, forecastWeather: any): WeatherData {
    const current: CurrentWeather = {
      temp: Math.round(currentWeather.main.temp),
      condition: currentWeather.weather[0].description.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' '),
      humidity: currentWeather.main.humidity,
      wind: Math.round(currentWeather.wind.speed * 3.6), // Convert m/s to km/h
      pressure: currentWeather.main.pressure,
      visibility: currentWeather.visibility ? Math.round(currentWeather.visibility / 1000) : 10,
      uvIndex: 6, // UV index not available in current weather API
      precipitationChance: 0 // Will be calculated from forecast data
    }

    // Process hourly forecast data (next 24 hours)
    const hourlyData: HourlyWeather[] = []

    for (let i = 0; i < Math.min(8, forecastWeather.list.length); i++) {
      const forecast = forecastWeather.list[i]
      const forecastDate = new Date(forecast.dt * 1000)

      hourlyData.push({
        hour: forecastDate.getHours(),
        temp: Math.round(forecast.main.temp),
        windSpeed: Math.round(forecast.wind.speed * 3.6), // Convert m/s to km/h
        precipitation: forecast.pop ? Math.round(forecast.pop * 100) : 0, // Probability of precipitation
        condition: forecast.weather[0].description
      })
    }

    // Calculate average precipitation chance for current conditions
    const avgPrecipitation = hourlyData.reduce((sum, h) => sum + h.precipitation, 0) / hourlyData.length
    current.precipitationChance = Math.round(avgPrecipitation)

    // Generate temperature and wind ranges based on forecast data
    const temps = hourlyData.map(h => h.temp)
    const winds = hourlyData.map(h => h.windSpeed)

    const tempRange = {
      min: Math.min(current.temp, ...temps) - 2,
      max: Math.max(current.temp, ...temps) + 2
    }

    const windRange = {
      min: Math.max(0, Math.min(current.wind, ...winds) - 5),
      max: Math.max(current.wind, ...winds) + 5
    }

    // Generate 7-day forecast from available data
    const dailyForecast: DailyWeather[] = []
    const processedDays = new Set()

    for (const forecast of forecastWeather.list) {
      const forecastDate = new Date(forecast.dt * 1000)
      const dayKey = forecastDate.toDateString()

      if (!processedDays.has(dayKey) && dailyForecast.length < 7) {
        processedDays.add(dayKey)

        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][forecastDate.getDay()]
        const condition = forecast.weather[0].main

        // Map weather conditions to FontAwesome icons
        let icon = 'fa-sun'
        switch (condition.toLowerCase()) {
          case 'clear':
            icon = 'fa-sun'
            break
          case 'clouds':
            icon = forecast.weather[0].description.includes('few') ? 'fa-cloud-sun' : 'fa-cloud'
            break
          case 'rain':
          case 'drizzle':
            icon = 'fa-cloud-rain'
            break
          case 'thunderstorm':
            icon = 'fa-bolt'
            break
          case 'snow':
            icon = 'fa-snowflake'
            break
          case 'mist':
          case 'fog':
            icon = 'fa-smog'
            break
          default:
            icon = 'fa-cloud'
        }

        dailyForecast.push({
          day: dayName,
          temp: Math.round(forecast.main.temp),
          condition: forecast.weather[0].description.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' '),
          icon: icon
        })
      }
    }

    return {
      current,
      tempRange,
      windRange,
      hourlyData,
      dailyForecast
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
}