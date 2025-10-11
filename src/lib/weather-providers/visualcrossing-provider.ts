import {
  WeatherProviderBase,
  WeatherData,
  CurrentWeather,
  HourlyWeather,
  DailyWeather,
  WeatherProviderConfig
} from './base-provider'

/**
 * Visual Crossing weather provider
 * Provides comprehensive historical and forecast weather data
 * API Docs: https://www.visualcrossing.com/resources/documentation/weather-api/
 * Free tier: 1000 records/day
 */
export class VisualCrossingProvider extends WeatherProviderBase {
  readonly name = 'VisualCrossing'
  readonly historicalDaysSupported = 36500 // Supports many years of historical data (100+ years)
  
  constructor(config: WeatherProviderConfig) {
    super(config)
  }
  
  async getWeather(lat: number, lon: number): Promise<WeatherData> {
    this.log.info(`Fetching weather data for coordinates: ${lat}, ${lon}`)
    
    try {
      // Visual Crossing uses a unified timeline API that includes current, hourly, and daily
      const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lon}?unitGroup=metric&key=${this.config.apiKey}&contentType=json&include=hours,days,current`
      const response = await this.fetchWithTimeout(url)
      const data = await response.json()
      
      return this.transformWeatherData(data)
    } catch (error: any) {
      this.log.error('Error fetching weather data:', error)
      throw new Error(`Visual Crossing API error: ${error.message}`)
    }
  }
  
  async getHistoricalWeather(lat: number, lon: number, date: Date): Promise<WeatherData> {
    this.log.info(`Fetching historical weather data for coordinates: ${lat}, ${lon}, date: ${date.toISOString()}`)
    
    if (!this.supportsHistoricalDate(date)) {
      throw new Error(`Visual Crossing history date ${date.toISOString()} is out of range.`)
    }
    
    try {
      // Format date as YYYY-MM-DD
      const dateStr = date.toISOString().split('T')[0]
      
      // Visual Crossing timeline API with specific date
      const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lon}/${dateStr}/${dateStr}?unitGroup=metric&key=${this.config.apiKey}&contentType=json&include=hours,days`
      const response = await this.fetchWithTimeout(url)
      const data = await response.json()
      
      return this.transformHistoricalData(data)
    } catch (error: any) {
      this.log.error('Error fetching historical weather data:', error)
      throw new Error(`Visual Crossing historical error: ${error.message}`)
    }
  }
  
  /**
   * Transform Visual Crossing response to standard WeatherData format
   */
  private transformWeatherData(data: any): WeatherData {
    const current = data.currentConditions
    const days = data.days
    
    // Transform current weather
    const currentWeather: CurrentWeather = {
      temp: Math.round(current.temp),
      condition: current.conditions || 'Unknown',
      humidity: Math.round(current.humidity),
      wind: Math.round(current.windspeed),
      pressure: Math.round(current.pressure),
      visibility: Math.round(current.visibility || 10),
      uvIndex: Math.round(current.uvindex || 0),
      precipitationChance: Math.round(current.precipprob || 0)
    }
    
    // Transform hourly forecast (next 24 hours)
    const hourlyData: HourlyWeather[] = []
    const now = new Date()
    
    // Get today's and tomorrow's hours
    for (const day of days.slice(0, 2)) {
      if (day.hours) {
        for (const hour of day.hours) {
          const hourDate = new Date(`${day.datetime}T${hour.datetime}`)
          
          // Only include future hours
          if (hourDate >= now && hourlyData.length < 24) {
            hourlyData.push({
              hour: hourDate.getHours(),
              temp: Math.round(hour.temp),
              windSpeed: Math.round(hour.windspeed),
              precipitation: Math.round(hour.precipprob || 0),
              condition: hour.conditions || 'Unknown'
            })
          }
        }
      }
    }
    
    // Calculate temperature and wind ranges
    const temps = hourlyData.map(h => h.temp)
    const winds = hourlyData.map(h => h.windSpeed)
    
    const tempRange = {
      min: Math.min(currentWeather.temp, ...temps, days[0]?.tempmin || 0) - 2,
      max: Math.max(currentWeather.temp, ...temps, days[0]?.tempmax || 0) + 2
    }
    
    const windRange = {
      min: Math.max(0, Math.min(currentWeather.wind, ...winds) - 5),
      max: Math.max(currentWeather.wind, ...winds, days[0]?.windspeed || 0) + 5
    }
    
    // Transform daily forecast (7 days)
    const dailyForecast: DailyWeather[] = []
    
    for (const day of days.slice(0, 7)) {
      const date = new Date(day.datetime)
      const icon = this.mapConditionToIcon(day.conditions)
      
      dailyForecast.push({
        day: this.getDayName(date),
        temp: Math.round(day.temp),
        condition: day.conditions,
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
    const day = data.days[0]
    
    // Use day average as "current" for historical data
    const currentWeather: CurrentWeather = {
      temp: Math.round(day.temp),
      condition: day.conditions || 'Unknown',
      humidity: Math.round(day.humidity),
      wind: Math.round(day.windspeed),
      pressure: Math.round(day.pressure),
      visibility: Math.round(day.visibility || 10),
      uvIndex: Math.round(day.uvindex || 0),
      precipitationChance: Math.round(day.precipprob || 0)
    }
    
    // Transform hourly data for the historical day
    const hourlyData: HourlyWeather[] = []
    if (day.hours) {
      for (const hour of day.hours) {
        const hourDate = new Date(`${day.datetime}T${hour.datetime}`)
        hourlyData.push({
          hour: hourDate.getHours(),
          temp: Math.round(hour.temp),
          windSpeed: Math.round(hour.windspeed),
          precipitation: Math.round(hour.precipprob || 0),
          condition: hour.conditions || 'Unknown'
        })
      }
    }
    
    const temps = hourlyData.map(h => h.temp)
    const winds = hourlyData.map(h => h.windSpeed)
    
    const tempRange = {
      min: Math.round(day.tempmin) - 2,
      max: Math.round(day.tempmax) + 2
    }
    
    const windRange = {
      min: Math.max(0, Math.min(...winds) - 5),
      max: Math.round(day.windspeed) + 5
    }
    
    // For historical data, daily forecast just contains the queried day
    const date = new Date(day.datetime)
    const dailyForecast: DailyWeather[] = [{
      day: this.getDayName(date),
      temp: Math.round(day.temp),
      condition: day.conditions,
      icon: this.mapConditionToIcon(day.conditions)
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
