# Quick Start: Testing Invitation System

Follow these steps to test the invitation system locally:

## 1. Update Database Schema

Run the migration to add the invitations table:

```bash
wrangler d1 execute cycling-data --local --file=./migrations/001_add_invitations.sql
```

Or if you prefer to recreate the entire database:

```bash
wrangler d1 execute cycling-data --local --file=./schema.sql
```

## 2. Configure Environment Variables (Optional for Local Testing)

For local development, you can add these to your `wrangler.jsonc` under the `vars` section:

```json
{
  "vars": {
    "FROM_EMAIL": "noreply@localhost",
    "FROM_NAME": "Cycling Calories Calculator (Dev)",
    "APP_URL": "http://localhost:8787"
  }
}
```

**Note**: MailChannels may not work in local development mode. The system will still create invitations in the database, but emails won't be sent. For full email testing, deploy to Cloudflare Workers.

## 3. Start Development Server

```bash
npm run dev
```

## 4. Test the Invitation Flow

### 4.1. Login as Admin

1. Navigate to `http://localhost:8787`
2. Click "Sign In" and authenticate with Google
3. Make sure your user has admin privileges (`is_admin = 1` in the users table)

To set admin privileges manually in D1:

```bash
# Get your user ID first
wrangler d1 execute cycling-data --local --command "SELECT id, email FROM users"

# Set admin flag (replace USER_ID with your actual user ID)
wrangler d1 execute cycling-data --local --command "UPDATE users SET is_admin = 1 WHERE id = USER_ID"
```

### 4.2. Send an Invitation

1. Click on your user avatar (top right)
2. Select "Invite User" from the dropdown
3. Fill in the form:
   - **Email**: Enter any valid email address
   - **Role**: Select "User" or "Administrator"
   - **Message**: Add an optional personal message
4. Click "Send Invitation"

### 4.3. Verify in Database

Check if the invitation was created:

```bash
wrangler d1 execute cycling-data --local --command "SELECT * FROM invitations ORDER BY created_at DESC LIMIT 5"
```

### 4.4. View All Invitations via API

Use curl or your browser to fetch invitations:

```bash
# Get your session cookie first, then:
curl -b "session_id=YOUR_SESSION_ID" http://localhost:8787/api/admin/invitations
```

## 5. Testing Email Sending (Production Only)

MailChannels typically only works when deployed to Cloudflare Workers. To test email sending:

### 5.1. Deploy to Workers

```bash
wrangler deploy
```

### 5.2. Set Environment Variables

```bash
wrangler secret put FROM_EMAIL
# Enter: noreply@yourdomain.com

wrangler secret put FROM_NAME
# Enter: Cycling Calories Calculator

wrangler secret put APP_URL
# Enter: https://your-worker-name.workers.dev
```

### 5.3. Run Migration on Production Database

```bash
wrangler d1 execute cycling-data --remote --file=./migrations/001_add_invitations.sql
```

### 5.4. Send Test Invitation

1. Access your deployed worker URL
2. Login as admin
3. Send an invitation to your email address
4. Check your email inbox (including spam folder)

## 6. Frontend Files Modified

The invitation system works with the following files:

- **`web/index.html`**: 
  - Added "Invite User" menu item in admin dropdown
  - Added invitation modal with form

- **`web/app.js`**: 
  - Added invitation functions
  - Added form submission handling
  - Added admin menu visibility logic

## 7. Backend Files Created/Modified

- **`src/lib/email-service.ts`**: Email service using MailChannels
- **`src/index.ts`**: 
  - Added invitation API endpoints
  - Added helper functions for token generation
  - Updated Bindings type
- **`schema.sql`**: Added invitations table and indexes
- **`migrations/001_add_invitations.sql`**: Migration file
- **`wrangler.jsonc`**: Added email configuration documentation

## 8. Common Issues & Solutions

### Issue: "Admin access required" error

**Solution**: Make sure your user has `is_admin = 1` in the database:

```bash
wrangler d1 execute cycling-data --local --command "UPDATE users SET is_admin = 1 WHERE email = 'your@email.com'"
```

### Issue: Invitation modal not showing

**Solution**: 
1. Clear browser cache
2. Hard refresh (Ctrl+F5)
3. Check browser console for JavaScript errors

### Issue: "Failed to send invitation" but invitation created

**Solution**: This is expected in local development. MailChannels only works in production (deployed to Workers).

### Issue: Email not received in production

**Solution**: 
1. Check spam/junk folder
2. Verify environment variables are set correctly
3. Check Cloudflare Workers logs for errors
4. If using custom domain, verify DNS records for MailChannels

## 9. Testing Checklist

- [ ] Database migration applied successfully
- [ ] Can see "Invite User" option in admin dropdown
- [ ] Invitation modal opens when clicked
- [ ] Form validation works (empty email shows error)
- [ ] Invitation is created in database
- [ ] Success message appears after sending
- [ ] Modal closes automatically after success
- [ ] Cannot send duplicate invitations to same email
- [ ] Cannot invite existing users
- [ ] Email is received (production only)

## 10. Next Steps

After testing the basic functionality:

1. **Deploy to production** for full email testing
2. **Configure DNS** if using custom domain
3. **Create invitation acceptance page** (future enhancement)
4. **Test with real users** to verify the flow
5. **Monitor logs** for any issues

## Support

If you encounter issues:

1. Check the `INVITATION_SYSTEM.md` documentation
2. Review Cloudflare Workers logs
3. Check browser console for errors
4. Verify database schema is correct

For MailChannels support: https://support.mailchannels.com
