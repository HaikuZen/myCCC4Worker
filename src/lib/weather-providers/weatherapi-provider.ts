import {
  WeatherProviderBase,
  WeatherData,
  CurrentWeather,
  HourlyWeather,
  DailyWeather,
  WeatherProviderConfig
} from './base-provider'

/**
 * WeatherAPI.com weather provider
 * Provides comprehensive weather data including UV index
 * API Docs: https://www.weatherapi.com/docs/
 * Free tier: 1,000,000 calls/month
 */
export class WeatherAPIProvider extends WeatherProviderBase {
  readonly name = 'WeatherAPI'
  readonly historicalDaysSupported = 365 // Free tier: up to 7 days, paid plans: up to 1 year
  
  constructor(config: WeatherProviderConfig) {
    super(config)
  }
  
  async getWeather(lat: number, lon: number): Promise<WeatherData> {
    this.log.info(`Fetching weather data for coordinates: ${lat}, ${lon}`)
    
    try {
      // WeatherAPI forecast endpoint includes current weather + forecast
      const url = `https://api.weatherapi.com/v1/forecast.json?key=${this.config.apiKey}&q=${lat},${lon}&days=7&aqi=no&alerts=no`
      const response = await this.fetchWithTimeout(url)
      const data = await response.json()
      
      return this.transformWeatherData(data)
    } catch (error: any) {
      this.log.error('Error fetching weather data:', error)
      throw new Error(`WeatherAPI error: ${error.message}`)
    }
  }
  
  async getHistoricalWeather(lat: number, lon: number, date: Date): Promise<WeatherData> {
    this.log.info(`Fetching historical weather data for coordinates: ${lat}, ${lon}, date: ${date.toISOString()}`)
    
    if (!this.supportsHistoricalDate(date)) {
      throw new Error(`WeatherAPI history only supports last ${this.historicalDaysSupported} days. Date ${date.toISOString()} is out of range.`)
    }
    
    try {
      // Format date as YYYY-MM-DD
      const dateStr = date.toISOString().split('T')[0]
      
      // WeatherAPI historical endpoint
      const url = `https://api.weatherapi.com/v1/history.json?key=${this.config.apiKey}&q=${lat},${lon}&dt=${dateStr}`
      const response = await this.fetchWithTimeout(url)
      const data = await response.json()
      
      return this.transformHistoricalData(data)
    } catch (error: any) {
      this.log.error('Error fetching historical weather data:', error)
      throw new Error(`WeatherAPI historical error: ${error.message}`)
    }
  }
  
  /**
   * Transform WeatherAPI response to standard WeatherData format
   */
  private transformWeatherData(data: any): WeatherData {
    const current = data.current
    const forecast = data.forecast
    
    // Transform current weather
    const currentWeather: CurrentWeather = {
      temp: Math.round(current.temp_c),
      condition: current.condition.text,
      humidity: current.humidity,
      wind: Math.round(current.wind_kph),
      pressure: Math.round(current.pressure_mb),
      visibility: Math.round(current.vis_km),
      uvIndex: current.uv || 0,
      precipitationChance: forecast.forecastday[0]?.day?.daily_chance_of_rain || 0
    }
    
    // Transform hourly forecast (next 24 hours)
    const hourlyData: HourlyWeather[] = []
    const now = new Date()
    
    // Get today's and tomorrow's hourly data
    for (const day of forecast.forecastday.slice(0, 2)) {
      for (const hour of day.hour) {
        const hourDate = new Date(hour.time)
        
        // Only include future hours
        if (hourDate >= now && hourlyData.length < 24) {
          hourlyData.push({
            hour: hourDate.getHours(),
            temp: Math.round(hour.temp_c),
            windSpeed: Math.round(hour.wind_kph),
            precipitation: hour.chance_of_rain || hour.chance_of_snow || 0,
            condition: hour.condition.text
          })
        }
      }
    }
    
    // Calculate temperature and wind ranges from hourly data
    const temps = hourlyData.map(h => h.temp)
    const winds = hourlyData.map(h => h.windSpeed)
    
    const tempRange = {
      min: Math.min(currentWeather.temp, ...temps, forecast.forecastday[0]?.day?.mintemp_c || 0) - 2,
      max: Math.max(currentWeather.temp, ...temps, forecast.forecastday[0]?.day?.maxtemp_c || 0) + 2
    }
    
    const windRange = {
      min: Math.max(0, Math.min(currentWeather.wind, ...winds) - 5),
      max: Math.max(currentWeather.wind, ...winds, forecast.forecastday[0]?.day?.maxwind_kph || 0) + 5
    }
    
    // Transform daily forecast (7 days)
    const dailyForecast: DailyWeather[] = []
    
    for (const day of forecast.forecastday) {
      const date = new Date(day.date)
      const icon = this.mapConditionToIcon(day.day.condition.text)
      
      dailyForecast.push({
        day: this.getDayName(date),
        temp: Math.round(day.day.avgtemp_c),
        condition: day.day.condition.text,
        icon
      })
    }
    
    return {
      current: currentWeather,
      tempRange,
      windRange,
      hourlyData,
      dailyForecast
    }
  }
  
  /**
   * Transform historical weather data
   */
  private transformHistoricalData(data: any): WeatherData {
    const forecastDay = data.forecast.forecastday[0]
    const dayData = forecastDay.day
    
    // Use day average as "current" for historical data
    const currentWeather: CurrentWeather = {
      temp: Math.round(dayData.avgtemp_c),
      condition: dayData.condition.text,
      humidity: Math.round(dayData.avghumidity),
      wind: Math.round(dayData.maxwind_kph),
      pressure: 1013, // Not available in day summary
      visibility: Math.round(dayData.avgvis_km),
      uvIndex: dayData.uv || 0,
      precipitationChance: dayData.daily_chance_of_rain || 0
    }
    
    // Transform hourly data for the historical day
    const hourlyData: HourlyWeather[] = []
    for (const hour of forecastDay.hour) {
      const hourDate = new Date(hour.time)
      hourlyData.push({
        hour: hourDate.getHours(),
        temp: Math.round(hour.temp_c),
        windSpeed: Math.round(hour.wind_kph),
        precipitation: hour.chance_of_rain || hour.chance_of_snow || 0,
        condition: hour.condition.text
      })
    }
    
    const temps = hourlyData.map(h => h.temp)
    const winds = hourlyData.map(h => h.windSpeed)
    
    const tempRange = {
      min: Math.round(dayData.mintemp_c) - 2,
      max: Math.round(dayData.maxtemp_c) + 2
    }
    
    const windRange = {
      min: Math.max(0, Math.min(...winds) - 5),
      max: Math.round(dayData.maxwind_kph) + 5
    }
    
    // For historical data, daily forecast just contains the queried day
    const date = new Date(forecastDay.date)
    const dailyForecast: DailyWeather[] = [{
      day: this.getDayName(date),
      temp: Math.round(dayData.avgtemp_c),
      condition: dayData.condition.text,
      icon: this.mapConditionToIcon(dayData.condition.text)
    }]
    
    return {
      current: currentWeather,
      tempRange,
      windRange,
      hourlyData,
      dailyForecast
    }
  }
}
