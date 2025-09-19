# myCCC - Cycling Calories Calculator (Cloudflare Workers Edition)

This is a serverless web application version of the Cycling Calories Calculator, built for Cloudflare Workers using Hono.js and D1 database. It provides a fast, globally distributed cycling calorie calculation service.

## Features

- ⚡ **Serverless**: Runs on Cloudflare Workers for global performance
- 🌐 **Web Interface**: Modern web application for analyzing cycling data
- 📊 **Dashboard**: View statistics and charts of your cycling activities  
- 📁 **File Upload**: Upload and analyze GPX files
- 💾 **D1 Database**: Cloudflare D1 database for scalable data storage
- 🔍 **Duplicate Detection**: Automatically skips duplicate rides
- 📈 **Data Visualization**: Charts for distance, calories, speed, and elevation
- 🗃️ **Database Management**: Built-in database management interface
- 🚀 **Fast & Global**: Edge computing for minimal latency worldwide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create D1 database:**
   ```bash
   npm run db:create
   ```

3. **Initialize database schema:**
   ```bash
   npm run db:init
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Deploy to Cloudflare:**
   ```bash
   npm run deploy
   ```

## Available Scripts

- `npm start` - Start the web server
- `npm run dev` - Start with nodemon for development
- `npm run init-db` - Initialize the SQLite database
- `npm run init-db:force` - Force reinitialize the database
- `npm test` - Show test information

## Project Structure

```
myCCC/
├── web/                    # Web application files
│   ├── index-new.js       # Main web server
│   ├── index.html         # Main page
│   ├── database.html      # Database management page
│   ├── styles.css         # Application styles
│   └── test/              # Web-based tests
├── lib/                   # Core libraries
│   ├── gpx-parser.js      # GPX file parsing
│   └── database-service.js # Database operations
├── database.js            # Database connection
├── init-db.js            # Database initialization
├── schema.sql            # Database schema
└── uploads/              # Temporary upload directory
```

## Usage

1. **Upload GPX Files**: Use the web interface to upload your cycling GPX files
2. **View Analytics**: Check the dashboard for statistics and charts
3. **Manage Data**: Use the database management interface to view and manage your rides
4. **Filter Data**: Filter rides by date range to analyze specific periods

## Database

The application uses SQLite to store:
- Ride data (distance, duration, calories, etc.)
- Calorie breakdown information
- Application configuration

Database file is created as `cycling_data.db` in the project root.

## API Endpoints

The web application provides several API endpoints:

- `GET /api/dashboard` - Dashboard statistics
- `GET /api/rides` - Recent rides
- `GET /api/chart-data` - Chart data for visualization
- `POST /upload` - Upload and analyze GPX files
- `GET /database` - Database management interface

## Requirements

- Node.js >= 14.0.0
- Modern web browser with JavaScript enabled

## License

MIT License

---

Extracted from the full cycling-calories-calculator project for web-only usage.