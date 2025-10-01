# myCCC - Cycling Calories Calculator (Cloudflare Workers Edition)

This is a serverless web application version of the Cycling Calories Calculator, built for Cloudflare Workers using Hono.js and D1 database. It provides a fast, globally distributed cycling calorie calculation service with comprehensive data storage, weather integration, and modular TypeScript architecture.

## Features

- ⚡ **Serverless**: Runs on Cloudflare Workers for global performance
- 🌐 **Web Interface**: Modern web application for analyzing cycling data
- 📊 **Dashboard**: View statistics and charts of your cycling activities  
- 📁 **File Upload**: Upload and analyze GPX files with drag & drop
- 💾 **D1 Database**: Cloudflare D1 database for scalable data storage
- 🔍 **Duplicate Detection**: Automatically detects duplicate rides by filename and content
- 📈 **Data Visualization**: Charts for distance, calories, speed, and elevation
- 🌤️ **Weather Service**: Modular weather service with geocoding and forecast data
- 📁 **GPX Storage**: Original GPX files stored in database with download capability
- 🗃️ **Database Management**: Built-in database management interface
- 🚀 **Fast & Global**: Edge computing for minimal latency worldwide
- 🎯 **TypeScript**: Fully typed codebase with modern development practices
- 📝 **Structured Logging**: Comprehensive logging throughout the application

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create D1 database:**
   ```bash
   npx wrangler d1 create myccc-db
   ```
   Then update `wrangler.jsonc` with your database ID.

3. **Configure Weather API (Optional):**
   For live geocoding functionality, set up your OpenWeatherMap API key:
   ```bash
   # Set as secret (recommended for production)
   npx wrangler secret put WEATHER_API_KEY
   # Or add to wrangler.jsonc for development (not recommended for production)
   ```
   Get your free API key from [OpenWeatherMap](https://openweathermap.org/api).
   Without an API key, the app will use demo geocoding data for common cities.

4. **Initialize database schema:**
   ```bash
   npm run db:init
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```
   The app will be available at http://localhost:8787

6. **Deploy to Cloudflare:**
   ```bash
   npm run deploy
   ```

## Available Scripts

- `npm run dev` - Start Wrangler development server
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run db:create` - Create a new D1 database
- `npm run db:init` - Initialize local database schema
- `npm run db:init:remote` - Initialize remote database schema
- `npm run build` - Build and validate the worker (dry-run)

## Project Structure

```
myCCC/
├── src/                       # TypeScript source code
│   ├── index.ts              # Main Cloudflare Worker entry point
│   └── lib/                  # Core libraries
│       ├── gpx-parser.ts     # GPX file parsing with TypeScript
│       ├── database-service.ts # D1 database operations
│       ├── cycling-database.ts # Legacy database compatibility
│       ├── weather.ts        # Weather service module
│       └── logger.ts         # Structured logging utility
├── web/                       # Static web application files
│   ├── index.html            # Main page
│   ├── database.html         # Database management page
│   ├── styles.css            # Application styles
│   ├── app.js                # Main JavaScript application
│   ├── database-manager.js   # Database management scripts
│   └── test/                 # Web-based tests
├── wrangler.jsonc             # Cloudflare Workers configuration
├── schema.sql                 # Database schema
├── database.js                # D1-compatible database class
└── package.json               # Dependencies and scripts
```

## Usage

1. **Upload GPX Files**: Use the web interface to upload your cycling GPX files
   - Files are automatically stored in the database for backup
   - Duplicate detection prevents accidental re-uploads
2. **View Analytics**: Check the dashboard for statistics and charts
   - Real-time weather data integration (when API key is configured)
   - Interactive charts and performance trends
3. **Manage Data**: Use the database management interface to view and manage your rides
   - Download original GPX files anytime
   - Edit ride data and configuration settings
4. **Filter Data**: Filter rides by date range to analyze specific periods
5. **Export Data**: Export ride data as CSV or download original GPX files

## Database

The application uses Cloudflare D1 (SQLite-compatible) to store:
- Ride data (distance, duration, calories, elevation, etc.)
- Original GPX file content as BLOB data for backup and re-analysis
- Calorie breakdown information with detailed factors
- Application configuration with typed values
- Performance trends and analytics

D1 provides a serverless SQLite database that scales automatically and is globally distributed.

## Weather Service

The application includes a modular weather service (`src/lib/weather.ts`) that provides:

- **Geocoding**: Convert location names to coordinates using OpenWeatherMap API
- **Weather Data**: Current conditions and forecasts with structured data
- **Demo Mode**: Fallback demo data for development without API keys
- **TypeScript Support**: Fully typed interfaces for all weather data structures
- **Error Handling**: Graceful fallback to demo data on API failures

### Weather API Integration
The weather service integrates with OpenWeatherMap to provide:
- Real-time weather conditions
- 5-day/3-hour forecasts
- Location geocoding
- Weather icon mapping

Demo data is available for major cities when no API key is configured, making the application fully functional for development and testing.

## GPX File Storage

Starting with the latest version, the application stores original GPX files in the database:

- **BLOB Storage**: GPX content stored as binary data in the database
- **Data Integrity**: Original files preserved for backup and re-analysis
- **Download Capability**: Retrieve original GPX files via REST API
- **No External Dependencies**: Self-contained storage without file system requirements
- **Compression Ready**: BLOB format supports future compression implementations

### GPX Storage Benefits
- **Backup & Recovery**: Never lose your original ride data
- **Re-analysis**: Reprocess rides with different parameters or algorithms
- **Data Portability**: Export your complete ride data including original files
- **Offline Capability**: All data self-contained in the database

## API Endpoints

The Cloudflare Workers application provides several API endpoints:

### Data API
- `GET /api/dashboard` - Complete dashboard data with statistics, recent rides, chart data, monthly summary, and trends
- `GET /api/rides?limit={n}` - Recent rides (default limit: 10)
- `GET /api/chart-data?startDate={date}&endDate={date}` - Chart data for visualization with optional date filtering
- `GET /filter-data?startDate={date}&endDate={date}` - Filtered ride data by date range
- `GET /api/geocode?location={name}` - Geocode location names to coordinates (requires WEATHER_API_KEY or falls back to demo data)
- `GET /api/weather?location={name}` or `GET /api/weather?lat={lat}&lon={lon}` - Get current weather and forecast data with dynamic weather icons (requires WEATHER_API_KEY or falls back to demo data)

### Upload & Processing
- `POST /upload` - Upload and analyze GPX files (with duplicate detection)
  - Supports drag & drop file uploads
  - Automatic duplicate detection by filename and content
  - Stores original GPX file content in database
  - Returns detailed analysis with calories, distance, duration, speed
- `POST /api/analyze` - CLI-compatible GPX analysis endpoint
  - Optional database storage with `skipSaveToDB` parameter
  - Stores original GPX content when saved to database

### File Management
- `GET /api/rides/{rideId}/gpx` - Download original GPX file by ride ID
  - Returns GPX file with proper content-type headers
  - Uses original filename or fallback naming

### Database Management
- `GET /api/database/overview` - Database statistics and overview
- `GET /api/configuration` - Get all configuration settings
- `GET /api/database/table/{tableName}` - View table data (rides, calorie_breakdown, configuration)
- `PUT /api/database/table/{tableName}/{recordId}` - Update database records
- `DELETE /api/database/table/{tableName}/{recordId}` - Delete database records
- `GET /api/database/export/{tableName}` - Export table data as CSV
- `POST /api/database/query` - Execute custom SELECT queries
- `POST /api/database/cleanup` - Clean orphaned records
- `POST /api/database/optimize` - Optimize database performance

### Static Routes
- `GET /` - Main application dashboard
- `GET /database` - Database management interface
- `GET /debug.html` - Debug interface
- `GET /test/` - Test interface

## Technology Stack

- **Runtime**: Cloudflare Workers (V8 JavaScript engine)
- **Framework**: Hono.js (fast web framework for edge computing)
- **Database**: Cloudflare D1 (SQLite-compatible serverless database)
- **Language**: TypeScript with full type safety
- **Build Tool**: Wrangler CLI (Cloudflare's development toolkit)
- **Frontend**: Vanilla JavaScript with TailwindCSS (via CDN)

## Requirements

- Node.js >= 18.0.0
- Cloudflare account (free tier available)
- Modern web browser with JavaScript enabled

## Development

### Local Development
The application runs in Wrangler's local development environment, which simulates the Cloudflare Workers runtime:

```bash
npm run dev
```

This starts a local server at `http://localhost:8787` with:
- Hot reloading for TypeScript changes
- Local D1 database instance
- Full Workers API compatibility

### Database Management
- Use `/database` route for web-based database management
- Run `wrangler d1 execute cycling-data --local --command="SELECT * FROM rides;"` for direct database queries
- Schema changes are managed via `schema.sql`

### Debugging
- Structured logging throughout the application
- Debug interface available at `/debug.html`
- Test interface at `/test/`

## Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

This will:
1. Build the TypeScript source code
2. Deploy to Cloudflare Workers
3. Set up D1 database bindings
4. Configure static asset serving

Your app will be available at `https://your-worker-name.your-subdomain.workers.dev`

## License

MIT License

---

Converted from Express.js + SQLite to Cloudflare Workers + D1 for serverless, globally distributed cycling analytics.
