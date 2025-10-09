# myCCC - Cycling Calories Calculator (Cloudflare Workers Edition)

A modern, serverless web application for comprehensive cycling analytics and calorie calculation. Built for Cloudflare Workers using Hono.js and D1 database, it provides a fast, globally distributed cycling analysis platform with beautiful visualizations, detailed ride breakdowns, weather integration, and intelligent data management.

## ✨ What's New in v2.0

- 🔐 **Invitation-Only Authentication**: Enhanced security with admin-controlled access - only invited users can join
- ✨ **Automatic Account Creation**: User accounts created automatically on first login with valid invitation
- 🔐 **Google OAuth2 Authentication**: Secure user authentication with Google accounts and session management
- 📧 **User Invitation System**: Admin-only email invitations with multiple email providers (Gmail, MailChannels, Resend)
- 👥 **User-Specific Rides**: Each ride is now associated with the user who uploaded it, ensuring data privacy
- 🔬 **Detailed Ride Analysis Modal**: Click any ride to view comprehensive analysis with interactive charts
- 📊 **Enhanced Dashboard**: Improved statistics with monthly summaries and performance trends  
- 🌤️ **Live Weather Integration**: Real-time weather data and 7-day forecasts
- 👤 **User Management**: Role-based access with admin privileges for database management
- 🎨 **Modern UI Redesign**: Beautiful interface with DaisyUI components and smooth animations
- 📱 **Mobile Responsive**: Optimized experience across all devices
- ⚡ **Performance Optimizations**: Faster loading with lazy loading and efficient data fetching

## Features

### Core Functionality
- ⚡ **Serverless**: Runs on Cloudflare Workers for global performance
- 🌐 **Modern Web Interface**: Responsive web application built with DaisyUI and TailwindCSS
- 📊 **Interactive Dashboard**: Comprehensive cycling statistics with real-time charts
- 📁 **Smart File Upload**: Drag & drop GPX upload with instant analysis
- 💾 **D1 Database**: Cloudflare D1 database for scalable, globally distributed storage
- 🔍 **Intelligent Duplicate Detection**: Prevents duplicate rides by filename and content analysis

### Data Analysis & Visualization  
- 📈 **Rich Data Visualization**: Interactive charts for distance, calories, speed, elevation, and trends
- 🔬 **Detailed Ride Analysis**: Individual ride breakdowns with elevation profiles, speed curves, and performance metrics
- 📱 **Responsive Charts**: Chart.js powered visualizations that work on all devices
- 📋 **Clickable Statistics Table**: Click any ride to view detailed analysis in an interactive modal
- 🎯 **Performance Trends**: Track improvements over time with comparative analytics
- 📊 **Monthly Summaries**: Aggregated statistics by month with visual indicators

### Weather & Environmental Data
- 🌤️ **Live Weather Integration**: Real-time weather data and 7-day forecasts
- 🌍 **Smart Geocoding**: Convert location names to coordinates with OpenWeatherMap API
- 🌡️ **Environmental Factors**: Temperature, humidity, wind speed, and UV index tracking
- 🎨 **Dynamic Weather UI**: Weather-appropriate icons and styling

### Data Management
- 📁 **GPX Storage & Backup**: Original GPX files preserved in database with download capability
- 🗃️ **Advanced Database Management**: Built-in web interface for data management
- 💾 **Data Export**: Export ride data as CSV or download original GPX files
- 🔧 **Configuration Management**: Customizable settings stored in database
- 🧹 **Database Optimization**: Built-in tools for database cleanup and optimization

### Authentication & Security
- 🔐 **Invitation-Only Access**: Only invited users can create accounts - enhanced security and access control
- 📧 **Admin-Managed Invitations**: Admins send email invitations with unique tokens and role assignment
- ✨ **Auto-Account Creation**: User accounts created automatically on first login with valid invitation
- 🔐 **Google OAuth2**: Secure user authentication with Google accounts and session management
- ⚡ **Auto-Configuration**: Automatic redirect URI detection - no hardcoded URLs
- 👤 **User Profiles**: Rich user profiles with avatars, names, and role-based permissions
- 👥 **User Data Isolation**: Each user sees only their own rides and statistics
- 🛡️ **Session Security**: HttpOnly cookies, CSRF protection, and automatic session cleanup (7-day sessions)
- 🔒 **Role-Based Access**: Admin privileges for sensitive operations like database management
- 🚪 **Protected Routes**: Authentication required for uploads and data management
- 🔄 **Session Cleanup**: Automatic expired session removal

### Privacy & Compliance
- 🍪 **GDPR Cookie Consent**: Full GDPR-compliant cookie consent banner with granular controls
- 🔐 **Email Privacy**: User emails masked in database with SHA-256 hashing
- 🔒 **Data Privacy**: Rides are associated with users - each user sees only their own data
- ✅ **Privacy by Design**: Essential cookies only by default, opt-in for analytics
- 🎯 **Granular Control**: Users can customize cookie preferences by category
- 📋 **Audit Trail**: Consent timestamp and version tracking for compliance
- 🌍 **International Compliance**: Supports GDPR, ePrivacy, CCPA, LGPD, and POPIA regulations

### Technical Excellence
- 🚀 **Edge Computing**: Minimal latency worldwide with Cloudflare's global network
- 🎯 **Full TypeScript**: Completely typed codebase with modern development practices
- 📝 **Comprehensive Logging**: Structured logging throughout the application
- 🎨 **Modern UI/UX**: Beautiful interface with DaisyUI components and smooth animations
- ⚡ **Performance Optimized**: Lazy loading, efficient data fetching, and responsive design

## Invitation-Only Access

> ⚠️ **Important**: This application uses invitation-only authentication. New users must be invited by an administrator.

### For Administrators:
1. Access the configuration page after logging in
2. Navigate to the "User Invitations" section
3. Enter the email address and select role (user or admin)
4. Click "Send Invitation"
5. User receives email with invitation link

### For New Users:
1. Receive invitation email from administrator
2. Click the invitation link in the email
3. Click "Sign In with Google" on the welcome page
4. Use the invited email address to authenticate
5. Account is created automatically
6. Start using the application immediately

📚 **Detailed Documentation**: See [`readmes/INVITATION_LOGIN_FLOW.md`](readmes/INVITATION_LOGIN_FLOW.md) for complete system documentation.

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

3. **Configure Google OAuth2 Authentication:**
   Set up Google OAuth2 for secure user authentication:
   ```bash
   # Set Google OAuth2 credentials as secrets
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put JWT_SECRET
   
   # (Optional) Set explicit redirect URI for custom domains
   npx wrangler secret put REDIRECT_URI
   ```
   
   **📋 Important**: Follow the detailed setup guide in [`AUTHENTICATION_SETUP.md`](AUTHENTICATION_SETUP.md) to:
   - Create Google Cloud Console project
   - Configure OAuth2 credentials and redirect URIs
   - Set up authentication secrets
   
   **✨ Note**: The app automatically detects redirect URIs - no hardcoding needed!

4. **Configure Weather API (Optional):**
   For live geocoding functionality, set up your OpenWeatherMap API key:
   ```bash
   # Set as secret (recommended for production)
   npx wrangler secret put WEATHER_API_KEY
   # Or add to wrangler.jsonc for development (not recommended for production)
   ```
   Get your free API key from [OpenWeatherMap](https://openweathermap.org/api).
   Without an API key, the app will use demo geocoding data for common cities.

5. **Configure Email for Invitations (Optional):**
   The application supports **three email providers** for sending invitation emails:
   
   **Option 1: Gmail (via SMTP)**
   Perfect for development and personal projects:
   ```bash
   # For local development - create .dev.vars file
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars with your Gmail credentials
   
   # For production - set as secrets
   npx wrangler secret put GMAIL_PASSWORD
   ```
   
   📧 **Quick Gmail Setup** (2 minutes):
   1. Enable Gmail API in Google Cloud Console
   2. Set `EMAIL_PROVIDER=gmail` and `GMAIL_USER` in `.dev.vars`
   3. Uses your existing OAuth credentials - no App Password needed!
   4. See [`readmes/GMAIL_OAUTH2_QUICKSTART.md`](readmes/GMAIL_OAUTH2_QUICKSTART.md) for details
   
   **Option 2: MailChannels (Default)**
   Free for Cloudflare Workers, works out-of-the-box:
   ```bash
   # Set email configuration (no API key needed)
   npx wrangler secret put FROM_EMAIL
   npx wrangler secret put FROM_NAME
   npx wrangler secret put APP_URL
   ```
   
   **Option 3: Resend**
   Modern email API for developers:
   ```bash
   # Set Resend API key
   npx wrangler secret put RESEND_API_KEY
   ```
   
   📚 **Email Documentation**:
   - Gmail OAuth 2.0: [`readmes/GMAIL_OAUTH2_QUICKSTART.md`](readmes/GMAIL_OAUTH2_QUICKSTART.md) (2-minute setup)
   - Email Service: [`readmes/EMAIL_README.md`](readmes/EMAIL_README.md) (overview)
   - Original System: [`readmes/INVITATION_SYSTEM.md`](readmes/INVITATION_SYSTEM.md)

6. **Initialize database schema:**
   ```bash
   npm run db:init
   ```

7. **Start development server:**
   ```bash
   npm run dev
   ```
   The app will be available at http://localhost:8787

8. **Deploy to Cloudflare:**
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
│       ├── auth.ts           # Google OAuth2 authentication service
│       ├── email-service.ts  # Email service for invitations (Gmail/MailChannels/Resend)
│       ├── weather.ts        # Weather service module
│       └── logger.ts         # Structured logging utility
├── web/                       # Static web application files
│   ├── index.html            # Main page with authentication UI
│   ├── database.html         # Database management page (admin only)
│   ├── configuration.html    # Configuration management page (admin only)
│   ├── styles.css            # Application styles
│   ├── app.js                # Main JavaScript with authentication
│   ├── cookie-consent.js     # GDPR cookie consent management
│   ├── database-manager.js   # Database management scripts
│   ├── configuration-manager.js # Configuration management scripts
│   └── test/                 # Web-based tests
├── wrangler.jsonc             # Cloudflare Workers configuration
├── schema.sql                 # Database schema with auth & invitation tables
├── database.js                # D1-compatible database class
├── migrations/                # Database migrations
│   ├── 0001_add_email_hash.sql # Email privacy migration
│   ├── 0002_add_user_id_to_rides.sql # User-ride association
│   ├── 001_add_invitations.sql # User invitation system
│   └── README.md             # Migration documentation
├── AUTHENTICATION_SETUP.md    # Google OAuth2 setup guide
├── PRIVACY_IMPLEMENTATION.md  # Email privacy documentation
├── USER_RIDE_ASSOCIATION.md   # User-ride relationship documentation
├── GDPR_COOKIE_COMPLIANCE.md  # Cookie consent documentation
├── readmes/                   # Documentation files
│   ├── INVITATION_LOGIN_FLOW.md # Invitation-only authentication system (NEW!)
│   ├── GMAIL_OAUTH2_QUICKSTART.md # Gmail OAuth 2.0 setup (2 minutes)
│   ├── EMAIL_README.md        # Email service overview
│   ├── INVITATION_ACCEPTANCE.md # Invitation technical details
│   └── ... (other documentation)
├── .dev.vars.example          # Environment variables template
└── package.json               # Dependencies and scripts
```

## Usage

### Authentication
**Invitation-Only System**: The application uses an invitation-only authentication system for enhanced security.

#### For New Users:
1. **Request Invitation**: Contact an administrator to request access
2. **Receive Email**: You'll receive an invitation email with a unique link
3. **Click Invitation Link**: The link shows a welcome page with instructions
4. **Sign In with Google**: Click "Sign In with Google" using the invited email address
5. **Automatic Account Creation**: Your account is created automatically on first login
6. **Dashboard Access**: You're immediately logged in and redirected to your dashboard

#### For Existing Users:
1. **Sign In**: Click the "Sign In" button in the top-right corner
2. **Google OAuth**: Authenticate using your Google account
3. **User Profile**: Your name, email, and avatar will appear in the navbar
4. **Admin Access**: Administrators can access database management and send invitations

**Note**: Users without a valid invitation cannot create accounts. Contact an administrator for access.

### Getting Started
1. **Upload GPX Files**: Use the modern web interface to upload your cycling GPX files
   - **Authentication required**: Sign in with Google to access upload functionality
   - **Personal rides**: Each uploaded ride is automatically linked to your account
   - Drag & drop multiple files or click to browse
   - Files are automatically stored in the database for backup and future analysis
   - Intelligent duplicate detection prevents accidental re-uploads
   - Instant analysis with detailed calorie, distance, and performance calculations

2. **Explore Your Dashboard**: Comprehensive overview of your cycling activities
   - **Personal Statistics**: View your own rides and performance metrics
   - **Interactive Charts**: Distance, calories, speed, and elevation trends over time
   - **Monthly Summaries**: Aggregated statistics with visual progress indicators
   - **Performance Trends**: Track improvements with comparative analytics
   - **Live Weather**: Current conditions and 7-day forecasts for your location

### Advanced Features
3. **Detailed Ride Analysis**: Click on any ride in the statistics table to open detailed analysis
   - **Elevation Profiles**: Interactive elevation vs. distance charts
   - **Speed Analysis**: Speed variations throughout your ride
   - **Performance Metrics**: Comprehensive breakdown of calories, power, and efficiency
   - **Route Segments**: Detailed segment analysis with performance data
   - **Environmental Data**: Weather conditions and their impact on performance

4. **User Invitations** (🔒 Admin Only): Control access to the platform
   - **Invitation-Only Access**: Only invited users can create accounts
   - **Automatic Account Creation**: Accounts created during first login with valid invitation
   - **Multiple Email Providers**: Choose between Gmail, MailChannels, or Resend
   - **Gmail OAuth 2.0**: Uses existing Google OAuth credentials - no App Password needed!
   - **Email Invitations**: Send professional invitation emails with unique tokens
   - **Role Assignment**: Invite users as regular users or administrators  
   - **Personal Messages**: Include custom messages with invitations
   - **Automatic Expiration**: Invitations expire after 7 days for security
   - **Duplicate Prevention**: System checks for existing users and pending invitations
   - **Beautiful Emails**: Responsive HTML email templates with clear instructions
   - Access via configuration page or user avatar menu → "Invite User"

5. **Data Management**: Powerful tools for managing your cycling data
   - **Database Interface**: Built-in web interface for viewing and editing data
   - **GPX Downloads**: Retrieve original GPX files anytime
   - **Data Export**: Export ride data as CSV for external analysis
   - **Configuration**: Customize settings and preferences
   - **Database Optimization**: Tools for maintaining optimal performance

6. **Filtering & Analysis**: Advanced data filtering capabilities
   - Filter rides by date range for specific period analysis
   - Compare performance across different time periods
   - Track seasonal patterns and improvements

## Database

The application uses Cloudflare D1 (SQLite-compatible) to store:
- **Ride data**: Distance, duration, calories, elevation, speed, and performance metrics
- **User associations**: Each ride is linked to the user who uploaded it for data privacy
- **GPX files**: Original GPX file content as BLOB data for backup and re-analysis
- **User accounts**: Google OAuth2 user profiles with roles and permissions
- **Sessions**: Secure session management with automatic cleanup
- **Configuration**: Application settings with typed values and categories
- **Analytics**: Calorie breakdown details and performance trends

D1 provides a serverless SQLite database that scales automatically and is globally distributed.

### Database Tables
- `rides` - Core ride data and GPX storage with user associations
- `users` - User profiles from Google OAuth2
- `sessions` - Secure session management
- `invitations` - User invitation system with email tokens
- `calorie_breakdown` - Detailed calorie calculation factors
- `configuration` - Application settings and preferences

### User Data Privacy
- Each ride in the `rides` table includes a `user_id` column linking to the `users` table
- Queries automatically filter rides by the authenticated user
- Foreign key constraints with `ON DELETE CASCADE` ensure data cleanup
- Admin users can view all data for management purposes

See [`USER_RIDE_ASSOCIATION.md`](USER_RIDE_ASSOCIATION.md) for detailed implementation documentation.

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

### Authentication API
- `GET /login` - Google OAuth2 login page
- `GET /auth/callback` - OAuth2 callback handler with automatic account creation for invited users
- `GET /accept-invitation?token={token}` - Validate invitation and show welcome page with sign-in instructions
- `POST /auth/logout` - User logout and session cleanup
- `GET /api/auth/user` - Current user information and authentication status

### Data API (🔐 Authentication Required)
- `GET /api/dashboard` - Complete dashboard data with user-specific statistics, recent rides, chart data, monthly summary, and trends
- `GET /api/rides?limit={n}` - Recent rides for the authenticated user (default limit: 10)
- `GET /api/rides/{rideId}/analysis` - **NEW**: Detailed ride analysis with elevation profiles, speed analysis, and comprehensive metrics
- `GET /api/chart-data?startDate={date}&endDate={date}` - Chart data for visualization with optional date filtering (user-specific)
- `GET /filter-data?startDate={date}&endDate={date}` - Filtered ride data by date range (user-specific)
- `GET /api/geocode?location={name}` - Geocode location names to coordinates (requires WEATHER_API_KEY or falls back to demo data)
- `GET /api/weather?location={name}` or `GET /api/weather?lat={lat}&lon={lon}` - Get current weather and forecast data with dynamic weather icons (requires WEATHER_API_KEY or falls back to demo data)

**Note**: All ride-related endpoints automatically filter data to show only the authenticated user's rides, ensuring data privacy and security.

### Upload & Processing (🔐 Authentication Required)
- `POST /upload` - Upload and analyze GPX files (with duplicate detection)
  - Supports drag & drop file uploads
  - Automatic duplicate detection by filename and content
  - Associates ride with authenticated user
  - Stores original GPX file content in database
  - Returns detailed analysis with calories, distance, duration, speed
- `POST /api/analyze` - CLI-compatible GPX analysis endpoint
  - Optional database storage with `skipSaveToDB` parameter
  - Stores original GPX content when saved to database

### File Management
- `GET /api/rides/{rideId}/gpx` - Download original GPX file by ride ID
  - Returns GPX file with proper content-type headers
  - Uses original filename or fallback naming

### Database Management (🔒 Admin Access Required)
- `GET /api/database/overview` - Database statistics and overview
- `GET /api/configuration` - Get all configuration settings
- `GET /api/database/table/{tableName}` - View table data (rides, calorie_breakdown, configuration, users, sessions, invitations)
- `PUT /api/database/table/{tableName}/{recordId}` - Update database records
- `DELETE /api/database/table/{tableName}/{recordId}` - Delete database records
- `GET /api/database/export/{tableName}` - Export table data as CSV
- `POST /api/database/query` - Execute custom SELECT queries
- `POST /api/database/cleanup` - Clean orphaned records
- `POST /api/database/optimize` - Optimize database performance

### User Invitations (🔒 Admin Access Required)
- `POST /api/admin/invitations` - Send invitation email to new user
  - Required fields: `email`, optional: `role` (user|admin), `message`
  - Sends beautiful HTML email via Gmail/MailChannels/Resend
  - Generates secure 256-bit token with 7-day expiration
  - Validates email format and checks for duplicates
  - **Note**: Account creation happens automatically when user signs in with Google
- `GET /api/admin/invitations` - List all invitations
  - Returns invitation details with inviter information
  - Shows status: pending, accepted, expired, revoked
- `DELETE /api/admin/invitations/{id}` - Revoke/delete invitation
- `GET /accept-invitation?token={token}` - Invitation acceptance page (public)
  - Validates invitation token and expiration
  - Shows welcome page with sign-in instructions
  - Redirects to login where account is created automatically

### Static Routes
- `GET /` - Main application dashboard
- `GET /login` - Google OAuth2 authentication page
- `GET /database` - Database management interface (🔒 Admin only)
- `GET /debug.html` - Debug interface
- `GET /test/` - Test interface

## Technology Stack

### Backend & Infrastructure
- **Runtime**: Cloudflare Workers (V8 JavaScript engine)
- **Framework**: Hono.js (fast web framework for edge computing)
- **Database**: Cloudflare D1 (SQLite-compatible serverless database)
- **Language**: TypeScript with full type safety and modern ES features
- **Build Tool**: Wrangler CLI (Cloudflare's development toolkit)
- **Email**: Multiple providers supported:
  - **Gmail** via nodemailer with OAuth 2.0 - Reuses existing Google OAuth credentials
  - **MailChannels** API - Free for Cloudflare Workers
  - **Resend** API - Modern developer email service
- **APIs**: OpenWeatherMap integration for live weather data

### Frontend & UI
- **Core**: Modern Vanilla JavaScript with ES6+ features
- **Styling**: DaisyUI + TailwindCSS for beautiful, responsive design
- **Charts**: Chart.js for interactive data visualizations
- **Icons**: Font Awesome for comprehensive iconography
- **Responsive**: Mobile-first design that works on all devices
- **Architecture**: Component-based JavaScript with modular design

## Authentication Configuration

### Automatic Redirect URI Detection

The application automatically constructs the OAuth2 redirect URI based on the incoming request:
- **Production**: Detects your actual Worker URL
- **Development**: Uses `http://localhost:8787/auth/callback`
- **Custom Domains**: Set explicit `REDIRECT_URI` secret if needed

No hardcoded URLs to update! Just configure your Google OAuth2 credentials and you're ready.

### Required Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `GOOGLE_CLIENT_ID` | OAuth2 Client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | OAuth2 Client Secret | Yes |
| `JWT_SECRET` | Session signing key | Yes |
|| `REDIRECT_URI` | Explicit callback URL | Optional |
|| `WEATHER_API_KEY` | OpenWeatherMap API | Optional |
|| `EMAIL_PROVIDER` | Email provider (gmail/mailchannels/resend) | Optional* |
|| `FROM_EMAIL` | Invitation sender email | Optional* |
|| `FROM_NAME` | Invitation sender name | Optional* |
|| `APP_URL` | Application URL for links | Optional* |
|| `GMAIL_USER` | Gmail address for sending | Optional** |
|| `GOOGLE_REFRESH_TOKEN` | OAuth refresh token for Gmail | Optional** |
|| `RESEND_API_KEY` | Resend API key | Optional*** |

*Required for invitation system. Defaults provided for development.  
**Required only if `EMAIL_PROVIDER=gmail`. Uses existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. See [`readmes/GMAIL_OAUTH2_QUICKSTART.md`](readmes/GMAIL_OAUTH2_QUICKSTART.md).  
***Required only if `EMAIL_PROVIDER=resend`.

See [`readmes/AUTHENTICATION_SETUP.md`](readmes/AUTHENTICATION_SETUP.md) for authentication configuration.  
See [`readmes/EMAIL_README.md`](readmes/EMAIL_README.md) for email provider setup.

## Requirements

### Development & Deployment
- Node.js >= 18.0.0
- Cloudflare account (free tier available)
- Modern web browser with JavaScript enabled
- Wrangler CLI (`npm install -g wrangler`)

### Authentication Setup
- Google Cloud Console account (free)
- Google OAuth2 application configured
- Gmail account for testing authentication

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

### Authentication Development
- Login page available at `/login` with Google OAuth2 integration
- User authentication state managed via secure sessions
- Admin users can access `/database` for data management
- Test authentication with any Gmail account during development

### Debugging
- Structured logging throughout the application
- Debug interface available at `/debug.html`
- Test interface at `/test/`
- Authentication logs available via `wrangler tail` for troubleshooting OAuth issues

## Deployment

Deploy to Cloudflare Workers:

### Prerequisites

1. **Configure Google OAuth2** (see [`AUTHENTICATION_SETUP.md`](AUTHENTICATION_SETUP.md))
2. **Set secrets** before first deployment

### Deployment Steps

```bash
# 1. Verify secrets are set
wrangler secret list

# 2. If not set, configure authentication secrets
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put JWT_SECRET

# 3. Deploy the application
npm run deploy
```

### What Happens During Deployment

1. TypeScript source code builds with authentication
2. Deploys to Cloudflare Workers global network
3. D1 database bindings configured (auth tables included)
4. Static assets served from edge
5. OAuth2 authentication enabled
6. Redirect URI automatically detected from Worker URL

Your app will be available at: `https://your-worker-name.your-subdomain.workers.dev`

### Post-Deployment

1. **Add redirect URI to Google Console**:
   - Go to Google Cloud Console > APIs & Services > Credentials
   - Add: `https://your-actual-worker-url.workers.dev/auth/callback`

2. **Test authentication**:
   - Visit your Worker URL
   - Click "Sign In"
   - Complete Google OAuth flow

3. **Create the first admin user**:
   
   Since the app is invitation-only, you need to manually create the first admin:
   
   ```bash
   # Temporarily bypass invitation check by adding a pending invitation
   wrangler d1 execute cycling-data --remote --command="INSERT INTO invitations (email, token, role, status, invited_by, expires_at) VALUES ('your-email@gmail.com', 'temp-token-123', 'admin', 'pending', 1, datetime('now', '+7 days'));"
   
   # Sign in with that email - account will be created automatically
   # Then clean up the temporary invitation
   wrangler d1 execute cycling-data --remote --command="DELETE FROM invitations WHERE token = 'temp-token-123';"
   
   # Verify admin status
   wrangler d1 execute cycling-data --remote --command="SELECT id, email, is_admin FROM users;"
   ```
   
   **Alternative method** (if you already have a user account):
   ```bash
   wrangler d1 execute cycling-data --remote --command="SELECT id, email FROM users;"
   wrangler d1 execute cycling-data --remote --command="UPDATE users SET is_admin = 1 WHERE id = YOUR_USER_ID;"
   ```

## License

MIT License

---

Converted from Express.js + SQLite to Cloudflare Workers + D1 for serverless, globally distributed cycling analytics.
