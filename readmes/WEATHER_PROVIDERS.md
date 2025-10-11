# Weather Providers

The Cycling Calories Calculator now supports multiple weather providers, giving you flexibility to choose the best API for your needs. The system uses a provider pattern that makes it easy to switch between providers without changing your application code.

## Supported Providers

### 1. OpenWeatherMap (Default)
- **Website**: https://openweathermap.org/
- **Free Tier**: 1,000 calls/day, 60 calls/minute
- **Features**:
  - Current weather
  - 5-day / 3-hour forecast
  - Reliable geocoding
  - Good global coverage
- **Limitations**:
  - No UV index in free tier
  - Limited hourly data (3-hour intervals)
- **Best For**: General purpose, geocoding, legacy compatibility

### 2. WeatherAPI.com
- **Website**: https://www.weatherapi.com/
- **Free Tier**: 1,000,000 calls/month
- **Features**:
  - Current weather with UV index
  - Hourly forecast data
  - 7-day forecast
  - Excellent free tier limits
- **Limitations**:
  - Rate limits may apply
- **Best For**: High-volume applications, UV data requirements

### 3. Weatherbit.io
- **Website**: https://www.weatherbit.io/
- **Free Tier**: 500 calls/day
- **Features**:
  - Current weather with UV index
  - 16-day daily forecast
  - Accurate data
- **Limitations**:
  - Hourly forecast requires paid plan
  - Lower daily limit
- **Best For**: Accurate daily forecasts, UV data

### 4. Visual Crossing
- **Website**: https://www.visualcrossing.com/
- **Free Tier**: 1,000 records/day
- **Features**:
  - Unified timeline API
  - Historical and forecast data
  - Comprehensive hourly data
  - Good data quality
- **Limitations**:
  - Record-based pricing (each day/hour counts as a record)
- **Best For**: Historical weather analysis, detailed forecasts

## Configuration

### Environment Variables

#### Basic Configuration (Legacy - Backwards Compatible)
```bash
# Just set this for OpenWeatherMap (default provider)
WEATHER_API_KEY=your_openweathermap_key
```

#### Multi-Provider Configuration
```bash
# Choose your provider
WEATHER_PROVIDER=weatherapi  # Options: openweathermap, weatherapi, weatherbit, visualcrossing

# Provide API keys for the providers you want to use
OPENWEATHERMAP_API_KEY=your_owm_key  # Used for geocoding by default
WEATHERAPI_KEY=your_weatherapi_key
WEATHERBIT_KEY=your_weatherbit_key
VISUALCROSSING_KEY=your_visualcrossing_key
```

### Wrangler Configuration

Add to your `wrangler.toml`:

```toml
[vars]
WEATHER_PROVIDER = "weatherapi"

# For local development, add to .dev.vars:
# OPENWEATHERMAP_API_KEY=your_key_here
# WEATHERAPI_KEY=your_key_here
# etc.
```

For production, use Wrangler secrets:

```bash
# Set API keys as secrets
wrangler secret put OPENWEATHERMAP_API_KEY
wrangler secret put WEATHERAPI_KEY
wrangler secret put WEATHERBIT_KEY
wrangler secret put VISUALCROSSING_KEY
```

## Getting API Keys

### OpenWeatherMap
1. Go to https://openweathermap.org/api
2. Sign up for a free account
3. Navigate to API Keys section
4. Generate a new key
5. Wait ~10 minutes for activation

### WeatherAPI.com
1. Go to https://www.weatherapi.com/signup.aspx
2. Sign up for a free account
3. Your API key will be displayed on the dashboard
4. Key is active immediately

### Weatherbit.io
1. Go to https://www.weatherbit.io/account/create
2. Create a free account
3. Go to Account > API Key
4. Copy your key
5. Key is active immediately

### Visual Crossing
1. Go to https://www.visualcrossing.com/sign-up
2. Create a free account
3. Go to Account page
4. Copy your API key
5. Key is active immediately

## Usage in Code

### Basic Usage (Automatic)
The Weather Service is automatically configured based on your environment variables. You don't need to change any code:

```typescript
// The WeatherService automatically uses the configured provider
const weatherService = createWeatherService(env)
const weather = await weatherService.getWeather({ location: 'Milan,IT' })
```

### Advanced Usage (Manual Configuration)
You can manually configure the Weather Service if needed:

```typescript
import { WeatherService } from './lib/weather'

// Create with specific provider
const weatherService = new WeatherService({
  provider: 'weatherapi',
  apiKeys: {
    openweathermap: process.env.OPENWEATHERMAP_API_KEY,
    weatherapi: process.env.WEATHERAPI_KEY,
    weatherbit: process.env.WEATHERBIT_KEY,
    visualcrossing: process.env.VISUALCROSSING_KEY
  },
  geocodingApiKey: process.env.OPENWEATHERMAP_API_KEY // For geocoding
})

// Get weather data
const result = await weatherService.getWeather({
  lat: '45.464',
  lon: '9.190'
})
```

## Geocoding

**Important**: Geocoding (converting location names to coordinates) always uses OpenWeatherMap, regardless of your chosen weather provider. This is because:
- OpenWeatherMap's geocoding is free and reliable
- It has excellent global coverage
- Consistent behavior across all providers

Make sure you always have an OpenWeatherMap API key configured, even if you use a different provider for weather data.

## Provider Comparison

| Feature         | OpenWeatherMap  | WeatherAPI      | Weatherbit  | Visual Crossing |
|-----------------|-----------------|-----------------|-------------|-----------------|
| Free Calls/Day  | 1,000           | ~33,000         | 500         | 1,000           |
| UV Index        | ❌              | ✅             | ✅          | ✅             |
| Hourly Data     | 3h intervals    | 1h intervals    | Paid only   | 1h intervals    |
| Daily Forecast  | 5 days          | 7 days          | 16 days     | 15 days         |
| Historical Data | Paid            | Limited         | Paid        | ✅              |
| Geocoding       | ✅ Free         | ✅ Included    | ✅ Included | ✅ Included    |
| Global Coverage | ✅ Excellent    | ✅ Excellent   | ✅ Good     | ✅ Good        |

## Migration Guide

### From Single Provider to Multi-Provider

If you're currently using `WEATHER_API_KEY`:

1. **Option 1: Keep using OpenWeatherMap (no changes needed)**
   ```bash
   # Keep your existing setup
   WEATHER_API_KEY=your_openweathermap_key
   ```

2. **Option 2: Switch to new provider**
   ```bash
   # Add new provider configuration
   WEATHER_PROVIDER=weatherapi
   OPENWEATHERMAP_API_KEY=your_owm_key  # For geocoding
   WEATHERAPI_KEY=your_weatherapi_key   # For weather data
   ```

3. **Deploy**
   ```bash
   # Set secrets
   wrangler secret put OPENWEATHERMAP_API_KEY
   wrangler secret put WEATHERAPI_KEY
   
   # Deploy
   npm run deploy
   ```

## Troubleshooting

### Weather Data Not Loading
1. Check that your API key is correctly set
2. Verify the provider name is spelled correctly
3. Check API key limits haven't been exceeded
4. Review Cloudflare Workers logs for errors

### Geocoding Fails
- Ensure OpenWeatherMap API key is set
- Check if the location name is valid
- Wait 10 minutes after creating a new OWM key

### Provider Falls Back to Demo Data
- This happens when no API key is configured
- Check environment variables are set correctly
- Verify secrets are deployed to Cloudflare

## Architecture

### Provider Pattern
The system uses an interface-based provider pattern:

```typescript
// All providers implement this interface
interface IWeatherProvider {
  readonly name: string
  getWeather(lat: number, lon: number): Promise<WeatherData>
  isConfigured(): boolean
}

// WeatherService manages providers
class WeatherService {
  private provider: IWeatherProvider
  private geocodingApiKey: string
  
  // Automatically selects provider based on config
  constructor(config: WeatherServiceConfig)
}
```

### Data Normalization
Each provider transforms its specific API response into a standard `WeatherData` format:

```typescript
interface WeatherData {
  current: CurrentWeather
  tempRange: { min: number; max: number }
  windRange: { min: number; max: number }
  hourlyData: HourlyWeather[]
  dailyForecast: DailyWeather[]
}
```

This ensures your application code works regardless of the provider.

## Best Practices

1. **Always configure OpenWeatherMap** for geocoding
2. **Choose provider based on your needs**:
   - High volume → WeatherAPI
   - UV data required → WeatherAPI or Weatherbit
   - Historical data → Visual Crossing
   - General purpose → OpenWeatherMap
3. **Monitor API usage** to avoid hitting limits
4. **Use demo mode** for development without API keys
5. **Set up error handling** for API failures
6. **Test with multiple providers** before production

## Support

For issues or questions:
1. Check provider documentation links above
2. Review Cloudflare Workers logs
3. Ensure environment variables are set correctly
4. Test with demo mode first

## Future Enhancements

Potential additions:
- Dark Sky API provider (if API access available)
- Meteo API provider
- Custom provider interface for your own weather sources
- Automatic provider fallback
- Provider health monitoring
- Cost optimization based on usage patterns
