# Google OAuth2 Authentication Setup Guide

This guide will help you set up Google OAuth2 authentication for your Cycling Calories Calculator.

## Quick Start Checklist

- [ ] Google Cloud Console project created
- [ ] OAuth2 credentials configured
- [ ] Redirect URIs added to Google Console
- [ ] Secrets set in Cloudflare Workers
- [ ] Database schema initialized
- [ ] Application deployed and tested
- [ ] First user made admin (if needed)

## Prerequisites

- A Google account
- Your Cloudflare Worker deployed and accessible via a URL
- Wrangler CLI installed and configured
- Basic understanding of OAuth2 flow (helpful but not required)

## Step 1: Create Google Cloud Console Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it

## Step 2: Configure OAuth2 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Configure the consent screen if prompted:
   - Choose "External" user type
   - Fill in the required fields:
     - App name: "Cycling Calories Calculator"
     - User support email: Your email
     - Developer contact information: Your email
   - Add scopes: `openid`, `email`, `profile`
   - Add test users (your Gmail account)

4. Create OAuth 2.0 Client ID:
   - Application type: "Web application"
   - Name: "Cycling Calculator Web Client"
   - Authorized redirect URIs: 
     - `https://your-worker-name.your-subdomain.workers.dev/auth/callback`
     - For local development: `http://localhost:8787/auth/callback`

## Step 3: Configure Cloudflare Secrets

After creating the OAuth2 credentials, you'll get a Client ID and Client Secret.

### Set the secrets using Wrangler CLI:

```bash
# Set Google OAuth2 credentials
wrangler secret put GOOGLE_CLIENT_ID
# Paste your Client ID when prompted

wrangler secret put GOOGLE_CLIENT_SECRET  
# Paste your Client Secret when prompted

wrangler secret put JWT_SECRET
# Enter a strong random string for JWT signing (e.g., generated with openssl rand -base64 32)
```

### For Development (Optional)

You can set these in `wrangler.jsonc` vars for development, but **never commit secrets to version control**:

```json
{
  "vars": {
    "GOOGLE_CLIENT_ID": "your-client-id.apps.googleusercontent.com",
    "GOOGLE_CLIENT_SECRET": "your-client-secret",
    "JWT_SECRET": "your-jwt-secret"
  }
}
```

## Step 4: Configure Redirect URI (Optional)

The application automatically detects the redirect URI from the incoming request. However, you can explicitly set it for better control:

### Option A: Automatic Detection (Recommended)

No configuration needed! The app will automatically construct the redirect URI:
- **Production**: `https://your-actual-worker-url.workers.dev/auth/callback`
- **Local Dev**: `http://localhost:8787/auth/callback`

### Option B: Explicit Configuration

For production environments with custom domains, set an explicit redirect URI:

```bash
# Set explicit redirect URI (optional)
wrangler secret put REDIRECT_URI
# Enter: https://your-custom-domain.com/auth/callback
```

### Important Notes

- The redirect URI in Google Console **must exactly match** the one used by your app
- Always add **both** production and development URIs to Google Console
- Format must be: `protocol://host/auth/callback` (no trailing slash)

## Step 5: Update Database Schema

The database schema includes authentication tables. Apply the schema:

```bash
# For local development
npm run db:init

# For production
npm run db:init:remote
```

### Verify Database Tables

After initialization, verify the authentication tables were created:
- `users` - User profiles from Google OAuth2
- `sessions` - Active user sessions

You can verify using:
```bash
wrangler d1 execute cycling-data --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```

## Step 6: Deploy and Test

### Local Development Testing

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:8787`
3. Click the "Sign In" button in the top-right corner
4. Test the Google OAuth flow with your Gmail account

### Production Deployment

1. Verify all secrets are set:
   ```bash
   wrangler secret list
   ```
   Should show: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`

2. Deploy your application:
   ```bash
   npm run deploy
   ```

3. Visit your production URL
4. Test authentication with the same Google account

### First User Setup

The first user to sign in will be a regular user. To make them an admin:

```bash
# Get the user's ID from the database
wrangler d1 execute cycling-data --remote --command="SELECT id, email FROM users;"

# Make the user an admin (replace USER_ID with actual ID)
wrangler d1 execute cycling-data --remote --command="UPDATE users SET is_admin = 1 WHERE id = USER_ID;"
```

## Security Features

The authentication system includes:

- **Secure session management** with HttpOnly cookies
- **CSRF protection** with SameSite cookies
- **Session expiration** (7 days by default)
- **Admin role support** for sensitive operations
- **Automatic session cleanup** for expired sessions

## User Roles

- **Regular users**: Can upload GPX files, view their own data
- **Admins**: Can access database management, configuration settings

To make a user an admin, manually update the `is_admin` field in the users table to `1`.

## Troubleshooting

### Common Issues

1. **"Error 400: redirect_uri_mismatch"**
   
   **Cause**: The redirect URI doesn't match what's configured in Google Console
   
   **Solutions**:
   - Check Google Console authorized redirect URIs
   - Verify the URL format is exact: `https://your-domain.com/auth/callback` (no trailing slash)
   - Add both local and production URLs:
     - Local: `http://localhost:8787/auth/callback`
     - Production: Your actual Worker URL + `/auth/callback`
   - If using custom domain, set explicit `REDIRECT_URI` secret

2. **"Authentication failed" or "Invalid client"**
   
   **Cause**: Incorrect OAuth2 credentials
   
   **Solutions**:
   - Verify secrets are set correctly:
     ```bash
     wrangler secret list
     ```
   - Ensure Client ID ends with `.apps.googleusercontent.com`
   - Re-create credentials if needed and update secrets
   - Check Worker logs:
     ```bash
     wrangler tail
     ```

3. **"User not authenticated" after successful login**
   
   **Cause**: Session or cookie issues
   
   **Solutions**:
   - Enable cookies in your browser
   - Check for CORS issues (ensure same domain)
   - Verify JWT_SECRET is set:
     ```bash
     wrangler secret list | grep JWT_SECRET
     ```
   - Check database has authentication tables:
     ```bash
     wrangler d1 execute cycling-data --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'sessions');"
     ```

4. **"Cannot read session" or session expires immediately**
   
   **Cause**: Cookie configuration or HTTPS issues
   
   **Solutions**:
   - In production, ensure you're accessing via HTTPS
   - Check browser console for cookie errors
   - Verify session was created in database:
     ```bash
     wrangler d1 execute cycling-data --remote --command="SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5;"
     ```

5. **Login button doesn't appear or shows loading forever**
   
   **Cause**: JavaScript or API errors
   
   **Solutions**:
   - Open browser console (F12) and check for errors
   - Verify `/api/auth/user` endpoint responds:
     ```bash
     curl https://your-worker-url.workers.dev/api/auth/user
     ```
   - Check that `app.js` loaded correctly
   - Clear browser cache and reload

### Logs and Debugging

Check your Worker logs for authentication errors:

```bash
wrangler tail
```

## Production Considerations

1. **Domain Verification**: For production, verify your domain with Google
2. **Rate Limiting**: Google has rate limits on OAuth requests
3. **Session Security**: Consider shorter session durations for high-security environments
4. **Backup Authentication**: Consider implementing backup admin access methods
5. **Privacy Policy**: Update your privacy policy to mention Google OAuth usage

## Environment Variables Reference

### Required Secrets

| Secret                  | Description                               | Example                                 | How to Set                                  |
|-------------------------|-------------------------------------------|-----------------------------------------|---------------------------------------------|
| `GOOGLE_CLIENT_ID`      | OAuth2 Client ID from Google Console      | `123456789.apps.googleusercontent.com`  | `wrangler secret put GOOGLE_CLIENT_ID`      |
| `GOOGLE_CLIENT_SECRET`  | OAuth2 Client Secret from Google Console  | `GOCSPX-abc123...`                      | `wrangler secret put GOOGLE_CLIENT_SECRET`  |
| `JWT_SECRET`            | Random string for session signing         | `openssl rand -base64 32`               | `wrangler secret put JWT_SECRET`            |

### Optional Secrets

| Secret         | Description                 | Default Behavior           | When to Use                     |
|----------------|-----------------------------|----------------------------|---------------------------------|
| `REDIRECT_URI` | Explicit OAuth callback URL | Auto-detected from request | Custom domains, complex routing |

### Verification

```bash
# List all secrets
wrangler secret list

# Expected output:
Secret Name
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
JWT_SECRET
```

## Next Steps

Once authentication is working:

1. Customize the login page styling in `src/index.ts`
2. Add user profile management features
3. Implement additional role-based access controls
4. Set up monitoring for authentication errors
5. Consider adding other OAuth providers (GitHub, Microsoft, etc.)
6. Configure session duration and cleanup policies
