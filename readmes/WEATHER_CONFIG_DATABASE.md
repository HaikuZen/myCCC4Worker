# Weather Provider Configuration from Database

## Overview

The Cycling Calories Calculator allows you to configure the weather provider and API keys through the database configuration table. This enables **dynamic provider switching without redeployment** and centralized configuration management.

## Configuration Priority

The system uses the following priority order for weather configuration:

1. **Database Configuration** (highest priority) - Settings stored in the `configuration` table
2. **Environment Variables** (fallback) - Cloudflare Worker environment variables
3. **Defaults** (lowest priority) - OpenWeatherMap as default provider

This means you can:
- Set API keys via environment variables for security
- Override provider selection via database for flexibility
- Change providers on-the-fly through the Configuration UI

## Configuration Keys

The following keys are available in the `configuration` table:

### Weather Provider Selection

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `weather_provider` | string | `openweathermap` | Active weather provider |

**Valid values**: `openweathermap`, `weatherapi`, `weatherbit`, `visualcrossing`

### API Keys

| Key | Type | Description |
|-----|------|-------------|
| `openweathermap_api_key` | string | OpenWeatherMap API key (used for geocoding) |
| `weatherapi_key` | string | WeatherAPI.com API key |
| `weatherbit_key` | string | Weatherbit.io API key |
| `visualcrossing_key` | string | Visual Crossing API key |
| `weather_api_key` | string | Legacy key (backwards compatibility) |

### Other Weather Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `weather_api_timeout` | number | 5000 | API request timeout in milliseconds |
| `default_location` | string | Milan,IT | Default location for weather forecasts |

## Usage

### Via Configuration UI (Recommended)

1. **Log in as Admin**
2. **Navigate to Configuration page** (`/configuration`)
3. **Find Weather category**
4. **Update settings**:
   - Set `weather_provider` to your chosen provider
   - Add your API key(s) in the corresponding field(s)
5. **Save changes**

Changes take effect immediately on the next weather API call!

### Via Database Directly

```sql
-- Set weather provider
UPDATE configuration 
SET value = 'weatherapi' 
WHERE key = 'weather_provider';

-- Add WeatherAPI.com API key
UPDATE configuration 
SET value = 'your-api-key-here' 
WHERE key = 'weatherapi_key';

-- Add OpenWeatherMap API key (for geocoding)
UPDATE configuration 
SET value = 'your-owm-key-here' 
WHERE key = 'openweathermap_api_key';
```

### Via API (Programmatic)

```bash
# Update weather provider
curl -X PUT https://your-app.workers.dev/api/configuration/weather_provider \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-session" \
  -d '{"value": "weatherapi", "value_type": "string"}'

# Update API key
curl -X PUT https://your-app.workers.dev/api/configuration/weatherapi_key \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your-session" \
  -d '{"value": "your-api-key", "value_type": "string"}'
```

## Configuration Strategy

### Recommended Approach

For optimal security and flexibility:

1. **Store API keys as environment variables** (secrets):
   ```bash
   wrangler secret put OPENWEATHERMAP_API_KEY
   wrangler secret put WEATHERAPI_KEY
   ```

2. **Store provider selection in database**:
   - Allows switching providers without redeployment
   - Can be changed through the Configuration UI
   - No secrets exposed in database

### Alternative Approach

For simpler management (development/testing):

1. **Store everything in database configuration**:
   - Provider selection AND API keys in database
   - Easy to manage through UI
   - ⚠️ **Warning**: API keys stored in database are less secure

### Hybrid Approach (Best of Both)

1. **API keys in environment** (secure):
   ```bash
   wrangler secret put OPENWEATHERMAP_API_KEY
   wrangler secret put WEATHERAPI_KEY
   wrangler secret put WEATHERBIT_KEY
   wrangler secret put VISUALCROSSING_KEY
   ```

2. **Provider in database** (flexible):
   ```sql
   UPDATE configuration SET value = 'weatherapi' WHERE key = 'weather_provider';
   ```

This gives you **security** (keys as secrets) + **flexibility** (provider switching via UI).

## How It Works

### Service Initialization Flow

```typescript
// 1. createWeatherService is called
async function createWeatherService(env: Bindings, db?: D1Database)

// 2. Read from environment variables (defaults)
provider = env.WEATHER_PROVIDER || 'openweathermap'
apiKeys = { openweathermap: env.OPENWEATHERMAP_API_KEY, ... }

// 3. If database available, override with database config
if (db) {
  const providerConfig = await dbService.getConfig('weather_provider')
  if (providerConfig.value) {
    provider = providerConfig.value  // Database overrides environment!
  }
  
  const apiKeyConfig = await dbService.getConfig('weatherapi_key')
  if (apiKeyConfig.value) {
    apiKeys.weatherapi = apiKeyConfig.value  // Database overrides environment!
  }
}

// 4. Create WeatherService with merged configuration
return new WeatherService({ provider, apiKeys, geocodingApiKey })
```

### Configuration Precedence

For each setting:
```
Database Value (if exists and non-empty)
    ↓ (if empty)
Environment Variable
    ↓ (if not set)
Default Value
```

Example:
- Database `weather_provider` = `weatherapi` → **Uses WeatherAPI**
- Database `weather_provider` = `` (empty) → Checks `env.WEATHER_PROVIDER`
- `env.WEATHER_PROVIDER` = undefined → **Uses default: OpenWeatherMap**

## Migration

### From Environment-Only to Database Config

1. **Check current environment setup**:
   ```bash
   wrangler secret list
   ```

2. **Run migration to add config keys**:
   ```bash
   wrangler d1 execute cycling-data --remote \
     --file=migrations/add-weather-provider-config.sql
   ```

3. **Set provider in database** (optional):
   ```sql
   UPDATE configuration 
   SET value = 'weatherapi' 
   WHERE key = 'weather_provider';
   ```

4. **Keep API keys as secrets** (recommended):
   - No changes needed to secrets
   - Database config is used for provider selection only

### For Existing Databases

If you already have a database, the migration script will:
- ✅ Add new configuration keys
- ✅ Update categories for existing keys
- ✅ Preserve existing values
- ✅ Remove obsolete keys

## Benefits

### 1. Dynamic Provider Switching
- **No redeployment needed** to change weather provider
- Switch providers through Configuration UI
- Test different providers easily

### 2. Centralized Management
- All settings in one place
- Easy to backup and restore
- Version control for configuration

### 3. Security Options
- Choose your security model
- Keep secrets in environment if preferred
- Or manage everything in database for convenience

### 4. Easy Testing
- Test different providers quickly
- Compare provider quality
- No code changes needed

### 5. Multi-Environment Support
- Different providers per environment
- Development can use different provider than production
- Same codebase, different configuration

## Troubleshooting

### Provider Not Switching

**Check configuration table**:
```sql
SELECT * FROM configuration WHERE key LIKE 'weather%';
```

**Verify value is set**:
```sql
SELECT key, value FROM configuration WHERE key = 'weather_provider';
```

**Expected output**: `weatherapi` (or your chosen provider)

### API Key Not Working

**Priority check**:
1. Is the key in database? `SELECT value FROM configuration WHERE key = 'weatherapi_key';`
2. Is the key in environment? Check Wrangler secrets
3. Is the key valid? Test directly with provider's API

**Check logs**:
```bash
wrangler tail
```

Look for:
- `Using weather provider from database: weatherapi`
- `Using WeatherAPI key from database`

### Configuration Not Loading

**Verify database connection**:
```bash
wrangler d1 execute cycling-data --remote --command="SELECT 1"
```

**Check migration status**:
```sql
SELECT COUNT(*) FROM configuration WHERE key = 'weather_provider';
```

Should return: `1`

### Falls Back to Demo Data

This means no valid API key is configured:

1. **Check database config**:
   ```sql
   SELECT key, value FROM configuration 
   WHERE key IN ('weather_provider', 'openweathermap_api_key', 'weatherapi_key');
   ```

2. **Check environment**:
   ```bash
   wrangler secret list
   ```

3. **Set at least one API key**:
   ```bash
   wrangler secret put OPENWEATHERMAP_API_KEY
   ```

## Security Best Practices

### ✅ DO

- Store API keys as Cloudflare Worker secrets
- Use database for provider selection only
- Regularly rotate API keys
- Monitor API usage to detect unauthorized access
- Use environment-specific keys (dev vs prod)

### ❌ DON'T

- Store production API keys in database (use secrets instead)
- Commit API keys to version control
- Share API keys between environments
- Use the same key across multiple applications
- Expose configuration table to non-admin users

## Examples

### Scenario 1: Switch from OpenWeatherMap to WeatherAPI

**Current**: Using OpenWeatherMap (default)

**Goal**: Switch to WeatherAPI for better free tier

**Steps**:
1. Get WeatherAPI key: https://www.weatherapi.com/signup.aspx
2. Add as secret: `wrangler secret put WEATHERAPI_KEY`
3. Update database:
   ```sql
   UPDATE configuration SET value = 'weatherapi' WHERE key = 'weather_provider';
   ```
4. Test: Visit weather page and check data

**No redeployment needed!** ✅

### Scenario 2: Temporary Provider Testing

**Goal**: Test Weatherbit for a day without permanent change

**Steps**:
1. Add Weatherbit key: `wrangler secret put WEATHERBIT_KEY`
2. Switch provider in database:
   ```sql
   UPDATE configuration SET value = 'weatherbit' WHERE key = 'weather_provider';
   ```
3. Test weather features
4. Switch back:
   ```sql
   UPDATE configuration SET value = 'openweathermap' WHERE key = 'weather_provider';
   ```

### Scenario 3: Multi-Tenant with Different Providers

**Goal**: Different providers for different user groups (future feature)

**Approach**:
- Store provider preference in user profile
- Pass user preference to `createWeatherService`
- Override database default with user preference

*Note: This requires additional implementation*

## Future Enhancements

Potential improvements:
- Per-user provider preferences
- Provider health monitoring
- Automatic fallback if primary provider fails
- Cost tracking per provider
- Usage analytics dashboard
- Provider performance metrics

## Related Documentation

- [Weather Providers Overview](WEATHER_PROVIDERS.md)
- [Configuration Management](../CONFIGURATION.md)
- [User Profile Feature](USER_PROFILE_FEATURE.md)

## Support

If you encounter issues:
1. Check this documentation
2. Review Cloudflare Workers logs: `wrangler tail`
3. Verify database configuration
4. Test API keys directly with provider
5. Check provider status pages
