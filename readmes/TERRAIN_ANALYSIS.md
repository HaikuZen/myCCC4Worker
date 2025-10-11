# Terrain Analysis Feature

## Overview

The terrain analysis feature automatically identifies and classifies terrain types along cycling routes using geographic and topographical APIs. This provides insights into the riding conditions and environment throughout the journey.

## Terrain Types

The system can identify the following terrain types:

| Terrain Type | Description | Examples |
|--------------|-------------|----------|
| **Urban** | Cities, towns, built-up areas | Downtown areas, city centers |
| **Suburban** | Residential areas, outskirts | Neighborhoods, residential zones |
| **Rural** | Countryside, farmland | Agricultural areas, villages |
| **Forest** | Wooded areas | Woods, forested paths |
| **Mountain** | High elevation, mountainous terrain | Alpine routes, mountain passes |
| **Coastal** | Near coastline, beaches | Seaside paths, beach roads |
| **Desert** | Arid, sandy areas | Desert routes, sand dunes |
| **Grassland** | Plains, meadows | Open fields, prairies |
| **Wetland** | Marshes, swamps | Wetland areas, marshes |
| **Industrial** | Industrial zones | Factory areas, warehouses |
| **Park** | Parks, recreational areas | City parks, gardens |
| **Water** | Lakes, rivers (riding along) | Lakeside paths, riverside routes |
| **Unknown** | Unable to determine | Areas without classification data |

## Data Sources

### Primary: OpenStreetMap Overpass API

**API**: `https://overpass-api.de/api/interpreter`
- **Cost**: Free, no API key required
- **Usage**: Land use classification, natural features
- **Rate Limits**: Fair use policy (handled with 1-second delays between batches)

**Data Retrieved**:
- `landuse` tags: residential, commercial, industrial, forest, farmland, etc.
- `natural` tags: wood, forest, water, beach, coastline, grassland, wetland, etc.
- `leisure` tags: park, garden, etc.
- `place` tags: city, town, village, hamlet, etc.

### Fallback: Elevation-Based Classification

When API calls fail or are disabled, the system uses elevation data:
- **> 2000m**: Mountain (high confidence)
- **1000-2000m**: Mountain (medium confidence)
- **500-1000m**: Rural
- **< 50m**: Coastal
- **50-500m**: Rural

## Analysis Process

### 1. Point Sampling

To reduce API calls and processing time:
- Route points are sampled at regular intervals (default: every 20th point)
- Always includes first and last point
- Sampling interval configurable via `sampleInterval` parameter

Example: 1000 points → 50 sampled points

### 2. Batch Processing

- Points processed in batches of 10
- 1-second delay between batches for rate limiting
- Prevents overwhelming external APIs

### 3. Terrain Classification

For each sampled point:

1. **Query OpenStreetMap Overpass API**
   - Search 100m radius around point
   - Retrieve land use and natural feature tags
   - Classify based on tags

2. **Fallback to Elevation** (if API fails)
   - Use elevation data for basic classification
   - Lower confidence scores

3. **Create Terrain Segments**
   - Group consecutive points with same terrain type
   - Calculate distance for each segment
   - Track confidence score

### 4. Segment Merging

Adjacent segments with the same terrain type are merged:
- Reduces fragmentation
- Combines distance
- Averages confidence scores

### 5. Summary Calculation

- **Dominant Terrain**: Terrain type with longest distance
- **Distribution**: Distance (meters) per terrain type
- **Percentages**: Percentage of route per terrain type
- **Elevation Profile**: Min, max, range, average slope

## Configuration

```typescript
const terrainService = new TerrainService({
  // OpenStreetMap Overpass API URL
  overpassApiUrl: 'https://overpass-api.de/api/interpreter',
  
  // Sample interval - analyze every N points
  sampleInterval: 20,
  
  // Enable/disable API calls (for testing or offline mode)
  enableApiCalls: true
})
```

## Integration with GPX Parser

The terrain analysis is automatically performed during GPX analysis:

```typescript
// In performDetailedAnalysis method
const terrainService = new TerrainService({
  sampleInterval: 20,
  enableApiCalls: true
});

const routePoints = points.map(p => ({
  lat: p.lat,
  lon: p.lon,
  elevation: p.elevation
}));

const terrainResult = await terrainService.analyzeRoute(routePoints);
```

## Output Structure

### Terrain Analysis Result

```typescript
interface TerrainAnalysis {
  segments: TerrainSegment[]
  summary: {
    dominantTerrain: TerrainType
    terrainDistribution: Record<TerrainType, number>  // meters
    terrainPercentages: Record<TerrainType, number>   // percentage
  }
  elevationProfile: {
    min: number          // meters
    max: number          // meters
    range: number        // meters
    avgSlope: number     // degrees
  }
}
```

### Terrain Segment

```typescript
interface TerrainSegment {
  startIndex: number        // Starting point index
  endIndex: number          // Ending point index
  distance: number          // Segment distance in meters
  terrainType: TerrainType  // Type of terrain
  elevation: number         // Average elevation in meters
  confidence: number        // 0-1 confidence score
}
```

### Example Output

```json
{
  "segments": [
    {
      "startIndex": 0,
      "endIndex": 150,
      "distance": 2340,
      "terrainType": "urban",
      "elevation": 125,
      "confidence": 0.8
    },
    {
      "startIndex": 151,
      "endIndex": 450,
      "distance": 8750,
      "terrainType": "rural",
      "elevation": 342,
      "confidence": 0.7
    }
  ],
  "summary": {
    "dominantTerrain": "rural",
    "terrainDistribution": {
      "urban": 2340,
      "rural": 8750,
      "forest": 3210
    },
    "terrainPercentages": {
      "urban": 16.3,
      "rural": 61.0,
      "forest": 22.7
    }
  },
  "elevationProfile": {
    "min": 95,
    "max": 456,
    "range": 361,
    "avgSlope": 2.4
  }
}
```

## Performance Considerations

### API Call Reduction

- **Sampling**: Only analyze every Nth point
- **Batching**: Process multiple points together
- **Rate Limiting**: 1-second delays between batches
- **Caching**: Results stored with ride data

### Typical Performance

For a 50km route with 1000 GPS points:
- **Sampled Points**: 50 (with interval=20)
- **API Calls**: 50 queries
- **Processing Time**: ~60 seconds (including rate limiting)
- **Batches**: 5 batches of 10 queries each

### Optimization Tips

1. **Increase Sample Interval** (faster, less accurate)
   ```typescript
   sampleInterval: 50  // Analyze every 50th point
   ```

2. **Disable API Calls** (instant, elevation-based only)
   ```typescript
   enableApiCalls: false
   ```

3. **Smaller Routes** are faster
   - Short urban rides: ~10-15 seconds
   - Long mountain rides: ~90-120 seconds

## Error Handling

The system is designed to be fault-tolerant:

1. **API Failures**: Falls back to elevation-based classification
2. **Network Errors**: Continues with available data
3. **Invalid Data**: Marks segments as 'unknown'
4. **Timeout**: 5-second timeout per API call

Errors are logged but don't prevent ride analysis from completing.

## Use Cases

### 1. Route Planning
- Identify terrain variety in planned routes
- Estimate difficulty based on terrain types
- Find routes with specific terrain preferences

### 2. Training Analysis
- Track training across different terrains
- Analyze performance by terrain type
- Plan terrain-specific workouts

### 3. Equipment Selection
- Choose appropriate bike/tires based on terrain
- Plan gear needs (lights for forest, sunscreen for desert)
- Estimate maintenance needs

### 4. Performance Insights
- Compare speeds across different terrains
- Analyze calorie burn by terrain type
- Identify terrain-specific strengths/weaknesses

### 5. Route Categorization
- Automatic tagging of rides by dominant terrain
- Filter rides by terrain type
- Search for similar terrain routes

## Future Enhancements

### Potential Improvements

1. **Additional Data Sources**
   - Google Maps API integration
   - Mapbox terrain data
   - OpenTopoData for enhanced elevation

2. **Advanced Classification**
   - Road surface type (paved, gravel, dirt)
   - Traffic density estimation
   - Vegetation coverage details

3. **Performance Optimization**
   - Redis caching for common routes
   - Pre-computed terrain data for popular areas
   - Parallel API requests (with rate limit management)

4. **UI Visualization**
   - Terrain map overlay on route
   - Color-coded segments
   - Terrain-based route comparison

5. **Machine Learning**
   - Train model on historical classifications
   - Improve confidence scores
   - Predict terrain from GPS patterns

## Configuration Management

### Database Configuration

Add terrain analysis settings to the configuration table:

```sql
INSERT INTO configuration (key, value, value_type, description, category) VALUES
('terrain_analysis_enabled', 'true', 'boolean', 'Enable terrain analysis for rides', 'terrain'),
('terrain_sample_interval', '20', 'number', 'Sample interval for terrain analysis', 'terrain'),
('terrain_api_calls_enabled', 'true', 'boolean', 'Enable external API calls for terrain data', 'terrain');
```

### Environment Variables

For production deployment, consider:

```bash
# Disable terrain analysis for faster processing
TERRAIN_ANALYSIS_ENABLED=false

# Increase sampling for faster analysis
TERRAIN_SAMPLE_INTERVAL=50

# Disable API calls (elevation-only mode)
TERRAIN_API_CALLS_ENABLED=false
```

## Privacy & Data Usage

- **No Personal Data**: Only GPS coordinates are sent to external APIs
- **Public APIs**: Uses free, public OpenStreetMap data
- **No Tracking**: Queries are anonymous and not logged
- **Compliance**: GDPR-compliant (no personal data shared)

## Testing

### Manual Testing

```typescript
// Test with sample route
const terrainService = new TerrainService({
  sampleInterval: 10,
  enableApiCalls: true
});

const testPoints = [
  { lat: 45.4642, lon: 9.1900, elevation: 122 },  // Milan (urban)
  { lat: 45.5000, lon: 9.2500, elevation: 234 },  // Outskirts (suburban)
  { lat: 45.6000, lon: 9.3500, elevation: 456 },  // Hills (rural)
  // ... more points
];

const result = await terrainService.analyzeRoute(testPoints);
console.log('Dominant terrain:', result.summary.dominantTerrain);
console.log('Segments:', result.segments.length);
```

### Unit Tests

Test cases to implement:
- Urban route classification
- Mountain route with elevation fallback
- Mixed terrain accuracy
- API failure handling
- Empty route handling

## Troubleshooting

### Common Issues

**Issue**: All terrain classified as 'unknown'
- **Cause**: API failures or no OSM data
- **Solution**: Check network connectivity, verify OSM data exists for area

**Issue**: Processing takes too long
- **Cause**: Large number of points, low sample interval
- **Solution**: Increase `sampleInterval` to 30 or 50

**Issue**: Inaccurate classification
- **Cause**: Low-quality GPS data, sparse OSM coverage
- **Solution**: Use elevation-based fallback, improve GPS accuracy

**Issue**: API rate limiting errors
- **Cause**: Too many requests too quickly
- **Solution**: Increase delay between batches, reduce sample rate

## Related Documentation

- **GPX Parser**: [`gpx-parser.ts`](../src/lib/gpx-parser.ts) - Main analysis integration
- **Terrain Service**: [`terrain-service.ts`](../src/lib/terrain-service.ts) - Core terrain analysis
- **Weather Integration**: [`WEATHER_INTEGRATION.md`](WEATHER_INTEGRATION.md) - Similar API integration

## Version History

- **v1.0** (2025-01-11): Initial terrain analysis implementation
  - OpenStreetMap Overpass API integration
  - Elevation-based fallback
  - 12 terrain types supported
  - Automatic segment detection and merging
  - Performance optimizations with sampling and batching
