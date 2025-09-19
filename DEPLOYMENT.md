# Deployment Guide - myCCC Cloudflare Workers

This guide will help you deploy the myCCC Cycling Calories Calculator to Cloudflare Workers.

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Installed via `npm install -g wrangler` (optional, as it's included in devDependencies)
3. **Node.js**: Version 18 or higher

## Step-by-Step Deployment

### 1. Initial Setup

```bash
# Clone and setup
git clone <your-repo>
cd myCCC
npm install
```

### 2. Cloudflare Authentication

```bash
# Login to Cloudflare (this will open a browser)
npx wrangler login
```

### 3. Create D1 Database

```bash
# Create the D1 database
npx wrangler d1 create cycling-data
```

This will output something like:
```
Created database cycling-data
database_id = "your-database-id-here"
```

### 4. Update Configuration

Update the `wrangler.toml` file with your database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cycling-data"
database_id = "your-database-id-here"  # Replace with actual ID from step 3
```

### 5. Initialize Database Schema

```bash
# Initialize local database for development
npx wrangler d1 execute cycling-data --local --file=./schema.sql

# Initialize remote database for production
npx wrangler d1 execute cycling-data --remote --file=./schema.sql
```

### 6. Development Testing

```bash
# Start local development server
npm run dev
```

Visit the local URL to test your application.

### 7. Deploy to Production

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## Configuration Options

### Environment Variables

You can set environment variables in `wrangler.toml`:

```toml
[vars]
ENVIRONMENT = "production"
MAX_FILE_SIZE = "10485760"  # 10MB in bytes
```

### Custom Domain (Optional)

To use a custom domain:

1. Add your domain to Cloudflare
2. In the Cloudflare dashboard, go to Workers & Pages
3. Click on your worker
4. Go to Settings → Triggers
5. Add your custom domain

### Database Management

Access your D1 database:

```bash
# View database info
npx wrangler d1 info cycling-data

# Execute queries
npx wrangler d1 execute cycling-data --command="SELECT COUNT(*) FROM rides"
```

## Monitoring and Logs

- **Analytics**: Available in Cloudflare dashboard under Workers & Pages
- **Real-time logs**: `npx wrangler tail`
- **Error tracking**: Cloudflare dashboard provides error logs and metrics

## Scaling Considerations

- **D1 Limits**: 
  - 25M reads/month (free tier)
  - 50K writes/month (free tier)
  - 5GB storage (free tier)
- **Worker Limits**:
  - 100K requests/day (free tier)
  - 10ms CPU time per request

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Verify database ID in `wrangler.toml`
   - Ensure schema is initialized

2. **File Upload Issues**:
   - Check file size limits
   - Verify MIME type handling

3. **TypeScript Errors**:
   - Ensure all dependencies are installed
   - Check `tsconfig.json` configuration

### Useful Commands

```bash
# View worker logs in real-time
npx wrangler tail

# Check D1 database
npx wrangler d1 info cycling-data

# List all workers
npx wrangler list

# Delete worker (if needed)
npx wrangler delete
```

## Security

- All data is processed on Cloudflare's edge network
- D1 database is encrypted at rest
- HTTPS is enforced by default
- No sensitive data is logged

## Support

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [Hono.js Documentation](https://hono.dev/)

---

**Note**: Remember to update the database ID in your `wrangler.toml` file with the actual ID generated when you create your D1 database.