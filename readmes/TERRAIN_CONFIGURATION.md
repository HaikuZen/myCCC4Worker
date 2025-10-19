# Terrain Analysis Configuration Management

## Overview

Terrain analysis parameters can now be fully configured via the database configuration system. This allows administrators to adjust terrain analysis behavior without code changes, through the web configuration interface.

## Configuration Parameters

All terrain analysis settings are stored in the `configuration` table with category `'terrain'`:

| Key                       | Type    | Default   | Description                           |
|---------------------------|---------|-----------|---------------------------------------|
| `terrain_enabled`         | boolean | `true`    | Enable/disable terrain analysis       |
| 
| `terrain_sample_interval` | number  | `30`      | Analyze every N GPS points            |
| `terrain_api_timeout`     | number  | `15000`   | API request timeout (milliseconds)    |
| `terrain_api_delay`       | number  | `2000`    | Delay between batches (milliseconds)  |
| `terrain_batch_size`      | number  | `3`       | Number of requests per batch          |
| `terrain_query_radius`    | number  | `100`     | Query radius (meters)                 |
| `terrain_enable_api`      | boolean | `true`    | Enable Overpass API calls             |

## Database Schema

Configuration entries are automatically created during database initialization:

```sql
INSERT OR IGNORE INTO configuration (key, value, value_type, description, category) VALUES
('terrain_enabled', 'true', 'boolean', 'Enable terrain analysis for rides', 'terrain'),
('overpass_api_url', 'https://overpass-api.de/api/interpreter', 'string', 'Overpass API URL for terrain data', 'terrain'),
('terrain_cache_ttl', '86400', 'number', 'Terrain data cache TTL in seconds', 'terrain'),
('terrain_max_retries', '3', 'number', 'Maximum retries for terrain API calls', 'terrain'),
('terrain_sample_interval', '30', 'number', 'Analyze every N GPS points', 'terrain'),
('terrain_api_timeout', '15000', 'number', 'API request timeout in milliseconds', 'terrain'),
('terrain_api_delay', '2000', 'number', 'Delay between API batches in milliseconds', 'terrain'),
('terrain_batch_size', '3', 'number', 'Number of requests per batch', 'terrain'),
('terrain_query_radius', '100', 'number', 'Query radius in meters', 'terrain'),
('terrain_enable_api', 'true', 'boolean', 'Enable Overpass API calls', 'terrain');
```

## Migration

For existing databases, run the migration:

```bash
# Apply migration
wrangler d1 execute cycling-data --local --file=migrations/0010_add_terrain_config.sql

# For production
wrangler d1 execute cycling-data --remote --file=migrations/0010_add_terrain_config.sql
```

## API Usage

### Get Terrain Configuration

```typescript
// In your handler
const dbService = new DatabaseService(c.env.DB)
await dbService.initialize()

const terrainConfig = await dbService.getTerrainConfig()
// Returns:
// {
//   enabled: true,
//   sampleInterval: 30,
//   apiTimeout: 15000,
//   apiDelay: 2000,
//   batchSize: 3,
//   queryRadius: 100,
//   enableApiCalls: true
// }
```

### Update Terrain Configuration

```typescript
await dbService.setTerrainConfig({
  enabled: true,
  sampleInterval: 50,        // More aggressive sampling
  apiTimeout: 20000,         // Longer timeout
  apiDelay: 3000,            // More conservative delay
  batchSize: 2,              // Smaller batches
  queryRadius: 100,
  enableApiCalls: true
})
```

### Update Individual Parameters

```typescript
// Disable terrain analysis
await dbService.setTerrainConfig({
  enabled: false
})

// Change only batch size
await dbService.setTerrainConfig({
  batchSize: 5
})

// Multiple parameters
await dbService.setTerrainConfig({
  apiTimeout: 20000,
  apiDelay: 3000
})
```

## Integration with GPX Parser

The terrain configuration is automatically loaded and passed to the GPX parser:

```typescript
// In upload endpoint (src/index.ts)
const dbService = new DatabaseService(c.env.DB)
await dbService.initialize()

// Load configuration
const terrainConfig = await dbService.getTerrainConfig()

// Pass to parser
const data = await gpxParser.extractCyclingData(
  xmlData, 
  riderWeight, 
  weatherService,
  terrainConfig  // ← Configuration from database
)
```

The GPX parser uses these settings when creating the TerrainService:

```typescript
// In gpx-parser.ts performDetailedAnalysis
const terrainService = new TerrainService({
  sampleInterval: terrainConfig?.sampleInterval ?? 30,
  enableApiCalls: terrainConfig?.enableApiCalls ?? true,
  apiTimeout: terrainConfig?.apiTimeout ?? 15000,
  apiDelay: terrainConfig?.apiDelay ?? 2000,
  batchSize: terrainConfig?.batchSize ?? 3,
  queryRadius: terrainConfig?.queryRadius ?? 100
})
```

## Web Configuration Interface

Administrators can manage terrain settings via the configuration page:

### Accessing Configuration

1. Log in as admin
2. Navigate to `/configuration` or click "Configuration" in menu
3. Scroll to "Terrain" category
4. Edit values as needed
5. Click "Save" to apply changes

### Configuration UI

The configuration interface displays all terrain settings with:
- **Key**: Configuration parameter name
- **Value**: Current value (editable)
- **Type**: Data type (boolean/number/string)
- **Description**: What the parameter does
- **Category**: Grouped under "terrain"

### Example UI Updates

**Disable Terrain Analysis**:
- Find `terrain_enabled`
- Change value to `false`
- Save

**Adjust Performance**:
- `terrain_sample_interval`: `50` (faster, less accurate)
- `terrain_batch_size`: `5` (faster, may hit rate limits)
- `terrain_api_delay`: `1000` (faster)
- Save all changes

**Handle Timeouts**:
- `terrain_api_timeout`: `20000` (20 seconds)
- `terrain_api_delay`: `3000` (3 second delay)
- `terrain_batch_size`: `2` (smaller batches)
- Save

## Configuration Presets

### Production (Balanced)
```typescript
{
  enabled: true,
  sampleInterval: 30,
  apiTimeout: 15000,
  apiDelay: 2000,
  batchSize: 3,
  queryRadius: 100,
  enableApiCalls: true
}
```
**Performance**: ~60-80s for 50km route
**Reliability**: High (few timeouts)

### Fast Mode
```typescript
{
  enabled: true,
  sampleInterval: 50,
  apiTimeout: 10000,
  apiDelay: 1000,
  batchSize: 5,
  queryRadius: 50,
  enableApiCalls: true
}
```
**Performance**: ~30-40s for 50km route
**Reliability**: Medium (some timeouts possible)

### Conservative (Most Reliable)
```typescript
{
  enabled: true,
  sampleInterval: 30,
  apiTimeout: 20000,
  apiDelay: 3000,
  batchSize: 2,
  queryRadius: 100,
  enableApiCalls: true
}
```
**Performance**: ~90-120s for 50km route
**Reliability**: Very high (minimal timeouts)

### Offline Mode
```typescript
{
  enabled: true,
  enableApiCalls: false
}
```
**Performance**: Instant (elevation-only)
**Reliability**: 100% (no API calls)

## Monitoring & Logging

The system logs terrain configuration usage:

```
🗺️ Starting terrain analysis
🗺️ Analyzing terrain for route with 1000 points
📍 Sampled 33 points for terrain analysis
✅ Terrain analysis complete: rural (5 segments)
```

If disabled:
```
🗺️ Terrain analysis disabled via configuration
```

## Troubleshooting

### Issue: Terrain analysis always disabled

**Check**:
```sql
SELECT key, value FROM configuration WHERE key = 'terrain_enabled';
```

**Fix**:
```sql
UPDATE configuration SET value = 'true' WHERE key = 'terrain_enabled';
```

### Issue: Changes not taking effect

**Cause**: Configuration cached in memory
**Solution**: Restart application or wait for next ride analysis

### Issue: All terrain classified as 'unknown'

**Check API settings**:
```sql
SELECT key, value FROM configuration 
WHERE key IN ('terrain_enable_api', 'terrain_api_timeout');
```

**Solutions**:
- Enable API calls: `terrain_enable_api = true`
- Increase timeout: `terrain_api_timeout = 20000`
- Check network connectivity

### Issue: Frequent timeouts

**Adjust settings**:
```typescript
await dbService.setTerrainConfig({
  apiTimeout: 20000,    // Longer timeout
  apiDelay: 3000,       // More conservative
  batchSize: 2          // Smaller batches
})
```

## Best Practices

### 1. Start Conservative
Begin with default settings and adjust based on actual performance:
- Monitor logs for timeout patterns
- Track processing times
- Adjust incrementally

### 2. Environment-Specific Settings

**Development**:
```typescript
{
  enabled: true,
  enableApiCalls: false  // Use elevation-only for speed
}
```

**Staging**:
```typescript
{
  enabled: true,
  sampleInterval: 50,    // Faster testing
  enableApiCalls: true
}
```

**Production**:
```typescript
{
  enabled: true,
  sampleInterval: 30,    // Balanced accuracy/speed
  apiTimeout: 15000,
  apiDelay: 2000,
  batchSize: 3,
  enableApiCalls: true
}
```

### 3. Traffic-Based Adjustment

**Low Traffic** (0-100 rides/day):
- Use default settings
- Enable API calls

**Medium Traffic** (100-500 rides/day):
- Increase `sampleInterval` to 40-50
- Consider caching popular routes

**High Traffic** (500+ rides/day):
- Disable API calls: `enableApiCalls: false`
- Use elevation-only classification
- Or run local Overpass instance

### 4. Time-of-Day Optimization

**Peak Hours** (9 AM - 5 PM EU time):
```typescript
{
  apiTimeout: 20000,
  apiDelay: 3000,
  batchSize: 2
}
```

**Off-Peak Hours**:
```typescript
{
  apiTimeout: 15000,
  apiDelay: 1500,
  batchSize: 5
}
```

## Programmatic Access

### Read Configuration

```typescript
// Get all terrain config
const config = await dbService.getTerrainConfig()

// Check if enabled
if (config.enabled) {
  // Perform terrain analysis
}

// Get specific value
const timeout = config.apiTimeout
```

### Update Configuration

```typescript
// Update multiple settings
await dbService.setTerrainConfig({
  sampleInterval: 40,
  apiDelay: 2500
})

// Toggle feature
await dbService.setTerrainConfig({
  enabled: false
})
```

### Direct SQL Access

```sql
-- Read
SELECT * FROM configuration WHERE category = 'terrain';

-- Update
UPDATE configuration 
SET value = '50' 
WHERE key = 'terrain_sample_interval';

-- Disable
UPDATE configuration 
SET value = 'false' 
WHERE key = 'terrain_enabled';
```

## Related Documentation

- **Terrain Analysis**: [`TERRAIN_ANALYSIS.md`](TERRAIN_ANALYSIS.md) - Feature overview
- **Overpass API**: [`OVERPASS_API_GUIDE.md`](OVERPASS_API_GUIDE.md) - Rate limits and best practices
- **Configuration System**: Database configuration architecture

## Version History

- **v1.0** (2025-01-11): Initial terrain configuration system
  - 7 configurable parameters
  - Database integration
  - Web UI support
  - Migration script
