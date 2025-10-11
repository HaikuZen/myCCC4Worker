# Weather Service Factory Fix

## Date
October 11, 2025

## Issue

The `createWeatherService` function was incorrectly reading **both** the weather provider **and** API keys from the database configuration. This was not the intended behavior.

### Previous Behavior (Incorrect)
```typescript
// ❌ Old behavior - reading API keys from database
const owmConfig = await dbService.getConfig('openweathermap_api_key')
const weatherApiConfig = await dbService.getConfig('weatherapi_key')
const weatherbitConfig = await dbService.getConfig('weatherbit_key')
// ... etc

if (owmConfig && owmConfig.value) {
  apiKeys.openweathermap = owmConfig.value  // ❌ Overriding environment variable
}
```

### Correct Behavior

**API keys should ALWAYS come from environment variables** for security reasons. Only the **provider selection** should be configurable via database.

## Solution

### Updated Function Logic

**Provider Selection Priority** (in order):
1. **Database configuration** (`weather_provider` key) - if present and valid
2. **Environment variable** (`WEATHER_PROVIDER`)
3. **Default value** (`openweathermap`)

**API Keys** (always):
- Always read from environment variables (`OPENWEATHERMAP_API_KEY`, `WEATHERAPI_KEY`, etc.)
- Never read from database
- Supports legacy `WEATHER_API_KEY` for backwards compatibility

### Code Changes

**File**: `src/index.ts` (Lines 51-111)

```typescript
// Helper function to create WeatherService with proper configuration
// Reads weather_provider from database (if present), API keys always from environment
async function createWeatherService(env: Bindings, db?: D1Database): Promise<WeatherService> {
  const log = createLogger('WeatherService:Factory')
  
  // ✅ API keys always come from environment variables
  const apiKeys = {
    openweathermap: env.OPENWEATHERMAP_API_KEY || env.WEATHER_API_KEY,
    weatherapi: env.WEATHERAPI_KEY,
    weatherbit: env.WEATHERBIT_KEY,
    visualcrossing: env.VISUALCROSSING_KEY
  }
  
  // Provider selection priority:
  // 1. Database configuration (weather_provider key)
  // 2. Environment variable (WEATHER_PROVIDER)
  // 3. Default to 'openweathermap'
  let provider: string = env.WEATHER_PROVIDER || 'openweathermap'
  
  // ✅ Try to get provider from database configuration if available
  if (db) {
    try {
      const dbService = new DatabaseService(db)
      await dbService.initialize()
      
      // Get weather provider from database config
      const providerConfig = await dbService.getConfig('weather_provider')
      if (providerConfig && providerConfig.value) {
        const dbProvider = providerConfig.value.toLowerCase().trim()
        
        // ✅ Validate provider is one of the supported types
        const validProviders = ['openweathermap', 'weatherapi', 'weatherbit', 'visualcrossing']
        if (validProviders.includes(dbProvider)) {
          provider = dbProvider
          log.info(`Using weather provider from database: ${provider}`)
        } else {
          log.warn(`Invalid provider in database: ${dbProvider}, using ${provider}`)
        }
      }
    } catch (error) {
      log.warn('Could not read weather provider from database, using environment/default:', error)
    }
  }
  
  // Use OpenWeatherMap key for geocoding (it's free and reliable)
  const geocodingApiKey = apiKeys.openweathermap
  
  // Log selected configuration
  log.info(`Weather service configured with provider: ${provider}`)
  
  // Backwards compatibility: if only WEATHER_API_KEY is provided, use simple constructor
  if (env.WEATHER_API_KEY && !apiKeys.openweathermap) {
    return new WeatherService(env.WEATHER_API_KEY)
  }
  
  return new WeatherService({
    provider: provider as any,
    apiKeys,
    geocodingApiKey
  })
}
```

## Key Improvements

### 1. Security ✅
- **API keys never stored in database** - they remain in secure environment variables/secrets
- Prevents accidental exposure through database dumps or UI
- Follows security best practices

### 2. Provider Validation ✅
- **Validates provider string** from database
- Only accepts valid provider types: `openweathermap`, `weatherapi`, `weatherbit`, `visualcrossing`
- Case-insensitive matching with trimming
- Falls back to environment/default if invalid

### 3. Clear Priority System ✅
```
Provider Selection:
1. Database config (weather_provider) → Most flexible
2. Environment variable (WEATHER_PROVIDER) → Deployment-level config
3. Default (openweathermap) → Safe fallback

API Keys:
Always from environment variables → Secure
```

### 4. Better Error Handling ✅
- Graceful fallback if database read fails
- Clear warning logs for invalid providers
- Informative success logs

### 5. Simplified Logic ✅
- Removed 40+ lines of database key-reading code
- Cleaner, more maintainable
- Single responsibility: provider selection from DB, keys from env

## Usage Examples

### Example 1: Default Configuration
```bash
# Environment variables only
OPENWEATHERMAP_API_KEY=abc123

# Result:
# Provider: openweathermap (default)
# API Key: abc123 (from env)
```

### Example 2: Environment Provider Override
```bash
# Environment variables
WEATHER_PROVIDER=weatherapi
WEATHERAPI_KEY=xyz789
OPENWEATHERMAP_API_KEY=abc123  # Still needed for geocoding

# Result:
# Provider: weatherapi (from env)
# API Keys: weatherapi=xyz789, openweathermap=abc123 (both from env)
```

### Example 3: Database Provider Override (Recommended)
```sql
-- Set provider in database
INSERT INTO configuration (key, value, type) 
VALUES ('weather_provider', 'weatherapi', 'string')
ON CONFLICT(key) DO UPDATE SET value = 'weatherapi';
```

```bash
# Environment variables
WEATHERAPI_KEY=xyz789
OPENWEATHERMAP_API_KEY=abc123

# Result:
# Provider: weatherapi (from database - highest priority!)
# API Keys: weatherapi=xyz789, openweathermap=abc123 (from env)
```

### Example 4: Invalid Database Value
```sql
-- Set invalid provider in database
INSERT INTO configuration (key, value) 
VALUES ('weather_provider', 'invalid_provider');
```

```bash
# Environment variables
WEATHER_PROVIDER=weatherapi
WEATHERAPI_KEY=xyz789

# Result:
# Warning: Invalid provider in database
# Provider: weatherapi (falls back to env)
# API Key: xyz789 (from env)
```

## Configuration Matrix

| Database `weather_provider` | Env `WEATHER_PROVIDER`  | Result Provider  | Notes                              |
|-----------------------------|-------------------------|------------------|------------------------------------|
| `weatherapi` (valid)        | `openweathermap`        | `weatherapi`     | Database takes priority            |
| `invalid_name`              | `weatherapi`            | `weatherapi`     | Invalid DB value ignored, uses env |
| `weatherapi` (valid)        | (not set)               | `weatherapi`     | Database used                      |
| (not set)                   | `weatherapi`            | `weatherapi`     | Environment used                   |
| (not set)                   | (not set)               | `openweathermap` | Default used                       |

## Database Schema

Only the `weather_provider` key is relevant:

```sql
-- Example configuration entry
INSERT INTO configuration (key, value, type, description) VALUES 
('weather_provider', 'weatherapi', 'string', 'Weather API provider selection');

-- API keys should NOT be in database
-- ❌ Don't do this:
-- INSERT INTO configuration (key, value) VALUES ('weatherapi_key', 'secret123');
```

## Migration Notes

### If you had API keys in the database

1. **Remove them from database** (they're ignored now anyway):
```sql
DELETE FROM configuration 
WHERE key IN (
  'openweathermap_api_key',
  'weatherapi_key', 
  'weatherbit_key',
  'visualcrossing_key',
  'weather_api_key'
);
```

2. **Ensure API keys are in environment/secrets**:
```bash
# Check secrets are set
wrangler secret list

# Set if missing
wrangler secret put OPENWEATHERMAP_API_KEY
wrangler secret put WEATHERAPI_KEY
# etc.
```

3. **Optionally set provider in database**:
```sql
INSERT INTO configuration (key, value, type) 
VALUES ('weather_provider', 'weatherapi', 'string')
ON CONFLICT(key) DO UPDATE SET value = 'weatherapi';
```

## Benefits

✅ **Security**: API keys never in database  
✅ **Flexibility**: Easy to change provider via database/config UI  
✅ **Simplicity**: Cleaner code, single responsibility  
✅ **Validation**: Invalid providers caught and rejected  
✅ **Backwards Compatible**: Legacy `WEATHER_API_KEY` still works  
✅ **Clear Logs**: Know exactly where config comes from  

## Testing

### Test 1: Verify Provider Selection
```bash
# Set database provider
wrangler d1 execute myccc-db --local --command="
  INSERT INTO configuration (key, value, type) 
  VALUES ('weather_provider', 'weatherapi', 'string')
  ON CONFLICT(key) DO UPDATE SET value = 'weatherapi';
"

# Start dev server
npm run dev

# Check logs - should see:
# "Using weather provider from database: weatherapi"
# "Weather service configured with provider: weatherapi"
```

### Test 2: Verify API Keys from Environment
```bash
# Set in .dev.vars
echo "WEATHERAPI_KEY=test_key_123" >> .dev.vars
echo "OPENWEATHERMAP_API_KEY=test_owm_456" >> .dev.vars

# Start server and test weather endpoint
curl "http://localhost:8787/api/weather?location=London"

# Should use WeatherAPI (from DB) with test_key_123 (from env)
```

### Test 3: Verify Invalid Provider Fallback
```bash
# Set invalid provider
wrangler d1 execute myccc-db --local --command="
  UPDATE configuration SET value = 'invalid_provider' 
  WHERE key = 'weather_provider';
"

# Check logs - should see:
# "Invalid provider in database: invalid_provider, using openweathermap"
```

## Related Files

- **`src/index.ts`** (Lines 51-111) - Factory function implementation
- **`src/lib/weather.ts`** - WeatherService class
- **`src/lib/weather-providers/`** - Provider implementations
- **`readmes/WEATHER_PROVIDERS.md`** - Provider comparison guide

## Summary

The `createWeatherService` function now correctly:
1. ✅ Reads **only** the `weather_provider` key from database
2. ✅ **Always** reads API keys from environment variables
3. ✅ Validates provider values
4. ✅ Has clear priority system (database → env → default)
5. ✅ Provides better logging and error handling

This change improves security (API keys not in DB), maintains flexibility (provider selectable via config UI), and simplifies the code significantly.
