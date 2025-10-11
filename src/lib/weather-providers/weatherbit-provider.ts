import {
  WeatherProviderBase,
  WeatherData,
  CurrentWeather,
  HourlyWeather,
  DailyWeather,
  WeatherProviderConfig
} from './base-provider'

/**
 * Weatherbit.io weather provider
 * Provides accurate weather forecasts with good free tier
 * API Docs: https://www.weatherbit.io/api
 * Free tier: 500 calls/day
 */
export class WeatherBitProvider extends WeatherProviderBase {
  readonly name = 'WeatherBit'
  readonly historicalDaysSupported = 730 // Free tier: up to 30 days, paid plans: up to 2 years
  
  constructor(config: WeatherProviderConfig) {
    super(config)
  }
  
  async getWeather(lat: number, lon: number): Promise<WeatherData> {
    this.log.info(`Fetching weather data for coordinates: ${lat}, ${lon}`)
    
    try {
      // Fetch current weather
      const currentUrl = `https://api.weatherbit.io/v2.0/current?lat=${lat}&lon=${lon}&key=${this.config.apiKey}&units=M`
      const currentResponse = await this.fetchWithTimeout(currentUrl)
      const currentData = await currentResponse.json()
      
      // Fetch daily forecast (16 days)
      const forecastUrl = `https://api.weatherbit.io/v2.0/forecast/daily?lat=${lat}&lon=${lon}&key=${this.config.apiKey}&days=7&units=M`
      const forecastResponse = await this.fetchWithTimeout(forecastUrl)
      const forecastData = await forecastResponse.json()
      
      return this.transformWeatherData(currentData, forecastData)
    } catch (error: any) {
      this.log.error('Error fetching weather data:', error)
      throw new Error(`WeatherBit API error: ${error.message}`)
    }
  }
  
  async getHistoricalWeather(lat: number, lon: number, date: Date): Promise<WeatherData> {
    this.log.info(`Fetching historical weather data for coordinates: ${lat}, ${lon}, date: ${date.toISOString()}`)
    
    if (!this.supportsHistoricalDate(date)) {
      throw new Error(`WeatherBit history only supports last ${this.historicalDaysSupported} days. Date ${date.toISOString()} is out of range.`)
    }
    
    try {
      // Format dates for range query (Weatherbit requires start and end date)
      const dateStr = date.toISOString().split('T')[0]
      
      // Weatherbit historical endpoint
      const url = `https://api.weatherbit.io/v2.0/history/daily?lat=${lat}&lon=${lon}&start_date=${dateStr}&end_date=${dateStr}&key=${this.config.apiKey}&units=M`
      const response = await this.fetchWithTimeout(url)
      const data = await response.json()
      
      return this.transformHistoricalData(data)
    } catch (error: any) {
      this.log.error('Error fetching historical weather data:', error)
      throw new Error(`WeatherBit historical error: ${error.message}`)
    }
  }
  
  /**
   * Transform WeatherBit response to standard WeatherData format
   */
  private transformWeatherData(currentData: any, forecastData: any): WeatherData {
    const current = currentData.data[0]
    
    // Transform current weather
    const currentWeather: CurrentWeather = {
      temp: Math.round(current.temp),
      condition: current.weather.description,
      humidity: current.rh,
      wind: Math.round(current.wind_spd * 3.6), // Convert m/s to km/h
      pressure: Math.round(current.pres),
      visibility: Math.round(current.vis),
      uvIndex: Math.round(current.uv || 0),
      precipitationChance: Math.round(current.precip || 0)
    }
    
    // Transform hourly forecast (simulated from daily data since hourly requires paid plan)
    const hourlyData: HourlyWeather[] = []
    const today = forecastData.data[0]
    const tomorrow = forecastData.data[1]
    
    // Generate 24 hourly forecasts by interpolating between daily min/max
    for (let i = 0; i < 24; i++) {
      const hour = (new Date().getHours() + i) % 24
      const dayData = i < 12 ? today : tomorrow
      
      // Interpolate temperature (simple sinusoidal pattern)
      const tempVariation = Math.sin((hour - 6) / 24 * Math.PI * 2) * (dayData.max_temp - dayData.min_temp) / 2
      const temp = Math.round((dayData.max_temp + dayData.min_temp) / 2 + tempVariation)
      
      hourlyData.push({
        hour,
        temp,
        windSpeed: Math.round(dayData.wind_spd * 3.6),
        precipitation: Math.round(dayData.pop || 0),
        condition: dayData.weather.description
      })
    }
    
    // Calculate temperature and wind ranges
    const temps = hourlyData.map(h => h.temp)
    const winds = hourlyData.map(h => h.windSpeed)
    
    const tempRange = {
      min: Math.min(currentWeather.temp, ...temps, today.min_temp) - 2,
      max: Math.max(currentWeather.temp, ...temps, today.max_temp) + 2
    }
    
    const windRange = {
      min: Math.max(0, Math.min(currentWeather.wind, ...winds) - 5),
      max: Math.max(currentWeather.wind, ...winds) + 5
    }
    
    // Transform daily forecast (7 days)
    const dailyForecast: DailyWeather[] = []
    
    for (const day of forecastData.data.slice(0, 7)) {
      const date = new Date(day.datetime)
      const icon = this.mapConditionToIcon(day.weather.description)
      
      dailyForecast.push({
        day: this.getDayName(date),
        temp: Math.round(day.temp),
        condition: day.weather.description,
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
    const dayData = data.data[0]
    
    // Use day average as "current" for historical data
    const currentWeather: CurrentWeather = {
      temp: Math.round(dayData.temp),
      condition: dayData.weather.description,
      humidity: dayData.rh,
      wind: Math.round(dayData.wind_spd * 3.6), // Convert m/s to km/h
      pressure: Math.round(dayData.pres),
      visibility: Math.round(dayData.vis || 10),
      uvIndex: Math.round(dayData.uv || 0),
      precipitationChance: Math.round((dayData.precip / dayData.max_temp) * 100) || 0
    }
    
    // Generate simulated hourly data from daily data
    const hourlyData: HourlyWeather[] = []
    for (let i = 0; i < 24; i++) {
      const tempVariation = Math.sin((i - 6) / 24 * Math.PI * 2) * (dayData.max_temp - dayData.min_temp) / 2
      const temp = Math.round((dayData.max_temp + dayData.min_temp) / 2 + tempVariation)
      
      hourlyData.push({
        hour: i,
        temp,
        windSpeed: Math.round(dayData.wind_spd * 3.6),
        precipitation: Math.round(dayData.pop || 0),
        condition: dayData.weather.description
      })
    }
    
    const temps = hourlyData.map(h => h.temp)
    const winds = hourlyData.map(h => h.windSpeed)
    
    const tempRange = {
      min: Math.round(dayData.min_temp) - 2,
      max: Math.round(dayData.max_temp) + 2
    }
    
    const windRange = {
      min: Math.max(0, Math.min(...winds) - 5),
      max: Math.max(...winds) + 5
    }
    
    // For historical data, daily forecast just contains the queried day
    const date = new Date(dayData.datetime)
    const dailyForecast: DailyWeather[] = [{
      day: this.getDayName(date),
      temp: Math.round(dayData.temp),
      condition: dayData.weather.description,
      icon: this.mapConditionToIcon(dayData.weather.description)
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
