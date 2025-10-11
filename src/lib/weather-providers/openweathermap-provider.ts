import {
  WeatherProviderBase,
  WeatherData,
  CurrentWeather,
  HourlyWeather,
  DailyWeather,
  WeatherProviderConfig
} from './base-provider'

/**
 * OpenWeatherMap weather provider
 * Supports both current weather and forecast data
 * API Docs: https://openweathermap.org/api
 */
export class OpenWeatherMapProvider extends WeatherProviderBase {
  readonly name = 'OpenWeatherMap'
  readonly historicalDaysSupported = 5 // Free tier: limited to 5 days (via forecast history)
  
  constructor(config: WeatherProviderConfig) {
    super(config)
  }
  
  async getWeather(lat: number, lon: number): Promise<WeatherData> {
    this.log.info(`Fetching weather data for coordinates: ${lat}, ${lon}`)
    
    try {
      // Fetch current weather
      const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.config.apiKey}&units=metric`
      const currentResponse = await this.fetchWithTimeout(currentUrl)
      const currentData = await currentResponse.json()
      
      // Fetch forecast data (5 day / 3 hour)
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${this.config.apiKey}&units=metric`
      const forecastResponse = await this.fetchWithTimeout(forecastUrl)
      const forecastData = await forecastResponse.json()
      
      return this.transformWeatherData(currentData, forecastData)
    } catch (error: any) {
      this.log.error('Error fetching weather data:', error)
      throw new Error(`OpenWeatherMap API error: ${error.message}`)
    }
  }
  
  async getHistoricalWeather(lat: number, lon: number, date: Date): Promise<WeatherData> {
    this.log.info(`Fetching historical weather data for coordinates: ${lat}, ${lon}, date: ${date.toISOString()}`)
    
    if (!this.supportsHistoricalDate(date)) {
      throw new Error(`OpenWeatherMap free tier only supports last 5 days of history. Date ${date.toISOString()} is out of range.`)
    }
    
    try {
      // For OpenWeatherMap, historical data requires Time Machine API (paid)
      // For free tier, we can use current weather as approximation for recent dates
      // or return forecast data if within range
      const timestamp = Math.floor(date.getTime() / 1000)
      
      // Note: Historical data endpoint requires paid subscription
      // https://openweathermap.org/history
      // const url = `https://api.openweathermap.org/data/2.5/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${timestamp}&appid=${this.config.apiKey}&units=metric`
      
      // For free tier, fallback to current weather with date approximation
      this.log.warn('OpenWeatherMap historical weather requires paid subscription. Falling back to current weather.')
      
      // Return current weather as best approximation
      return await this.getWeather(lat, lon)
    } catch (error: any) {
      this.log.error('Error fetching historical weather data:', error)
      throw new Error(`OpenWeatherMap historical API error: ${error.message}`)
    }
  }
  
  /**
   * Transform OpenWeatherMap API response to standard WeatherData format
   */
  private transformWeatherData(currentData: any, forecastData: any): WeatherData {
    // Transform current weather
    const current: CurrentWeather = {
      temp: Math.round(currentData.main.temp),
      condition: this.capitalizeWords(currentData.weather[0].description),
      humidity: currentData.main.humidity,
      wind: this.msToKmh(currentData.wind.speed),
      pressure: currentData.main.pressure,
      visibility: currentData.visibility ? Math.round(currentData.visibility / 1000) : 10,
      uvIndex: 6, // UV index not available in free tier
      precipitationChance: 0 // Will be calculated from forecast
    }
    
    // Transform hourly forecast (next 24 hours from 3-hour intervals)
    const hourlyData: HourlyWeather[] = []
    for (let i = 0; i < Math.min(8, forecastData.list.length); i++) {
      const forecast = forecastData.list[i]
      const forecastDate = new Date(forecast.dt * 1000)
      
      hourlyData.push({
        hour: forecastDate.getHours(),
        temp: Math.round(forecast.main.temp),
        windSpeed: this.msToKmh(forecast.wind.speed),
        precipitation: forecast.pop ? Math.round(forecast.pop * 100) : 0,
        condition: this.capitalizeWords(forecast.weather[0].description)
      })
    }
    
    // Calculate average precipitation chance
    const avgPrecipitation = hourlyData.reduce((sum, h) => sum + h.precipitation, 0) / hourlyData.length
    current.precipitationChance = Math.round(avgPrecipitation)
    
    // Calculate temperature and wind ranges
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
    
    // Transform daily forecast (extract one forecast per day)
    const dailyForecast: DailyWeather[] = []
    const processedDays = new Set<string>()
    
    for (const forecast of forecastData.list) {
      const forecastDate = new Date(forecast.dt * 1000)
      const dayKey = forecastDate.toDateString()
      
      if (!processedDays.has(dayKey) && dailyForecast.length < 7) {
        processedDays.add(dayKey)
        
        const condition = forecast.weather[0].main
        const icon = this.mapConditionToIcon(condition)
        
        dailyForecast.push({
          day: this.getDayName(forecastDate),
          temp: Math.round(forecast.main.temp),
          condition: this.capitalizeWords(forecast.weather[0].description),
          icon
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
}
