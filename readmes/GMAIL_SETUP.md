# Gmail SMTP Email Integration Guide

## Overview

This guide explains how to configure Gmail SMTP with nodemailer to send emails from your Cycling Calories Calculator application. The implementation supports three email providers:

1. **Gmail** (via nodemailer) - Personal Gmail accounts or Google Workspace
2. **MailChannels** - Free for Cloudflare Workers (default)
3. **Resend** - Modern developer email API

## Why Use Gmail?

✅ **Advantages**:
- Free for personal use (up to 500 emails/day for regular Gmail)
- Reliable and well-established
- Works with both personal Gmail and Google Workspace accounts
- Good deliverability rates
- No additional API service required

❌ **Limitations**:
- Requires App Password setup (2-Step Verification needed)
- Daily sending limits (500/day for free Gmail, higher for Workspace)
- Not ideal for high-volume transactional emails
- Requires SMTP credentials management

## Prerequisites

Before you begin, ensure you have:

1. A Gmail account or Google Workspace account
2. 2-Step Verification enabled on your Google account
3. Node.js 18+ installed
4. Cloudflare Workers environment set up

## Step-by-Step Setup

### Step 1: Enable 2-Step Verification

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** in the left sidebar
3. Under "Signing in to Google," click **2-Step Verification**
4. Follow the prompts to enable 2-Step Verification if not already enabled

### Step 2: Generate Gmail App Password

1. Visit https://myaccount.google.com/apppasswords
   - Or go to Google Account → Security → 2-Step Verification → App passwords
2. You may need to sign in again
3. Select app: Choose **"Mail"** or **"Other (Custom name)"**
4. Select device: Choose **"Other (Custom name)"** and enter: `Cycling Calculator`
5. Click **Generate**
6. Google will display a 16-character password (e.g., `abcd efgh ijkl mnop`)
7. **IMPORTANT**: Copy this password immediately - you won't be able to see it again!

### Step 3: Configure Environment Variables

#### For Local Development

1. Copy the example environment file:
```bash
cp .dev.vars.example .dev.vars
```

2. Edit `.dev.vars` and set your Gmail credentials:

```bash
# Email Configuration
EMAIL_PROVIDER=gmail
FROM_EMAIL=your-email@gmail.com
FROM_NAME=Cycling Calories Calculator
APP_URL=http://localhost:8787

# Gmail SMTP Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_PASSWORD=abcd efgh ijkl mnop  # Your 16-character App Password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

3. **CRITICAL**: Add `.dev.vars` to `.gitignore` to prevent committing secrets:
```bash
echo ".dev.vars" >> .gitignore
```

#### For Production (Cloudflare Workers)

Set secrets using Wrangler CLI:

```bash
# Set Gmail password as a secret
wrangler secret put GMAIL_PASSWORD
# When prompted, paste your 16-character App Password

# Set other variables in wrangler.toml [vars] section
# (Non-sensitive values only!)
```

### Step 4: Update Your Code

The email service is now configured to use Gmail. Update your code to initialize the email service:

```typescript
import { EmailService } from './lib/email-service'

// Read from environment variables
const emailConfig = {
  provider: 'gmail',
  from_email: env.FROM_EMAIL || 'noreply@example.com',
  from_name: env.FROM_NAME || 'Cycling Calculator',
  app_url: env.APP_URL || 'http://localhost:8787',
  gmail_user: env.GMAIL_USER,
  gmail_password: env.GMAIL_PASSWORD,
  smtp_host: env.SMTP_HOST || 'smtp.gmail.com',
  smtp_port: parseInt(env.SMTP_PORT || '587'),
  smtp_secure: env.SMTP_SECURE === 'true',
}

const emailService = new EmailService(emailConfig)
```

### Step 5: Test Email Sending

You can test the email service using the test endpoint:

```bash
# Start the dev server
npm run dev

# Send a test email
curl -X POST http://localhost:8787/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"to_email": "test@example.com"}' \
  -H "Cookie: session_id=YOUR_SESSION_ID"
```

Or use the built-in test method:

```typescript
// Test email sending
const success = await emailService.sendTestEmail('recipient@example.com')
if (success) {
  console.log('✅ Test email sent successfully!')
} else {
  console.error('❌ Failed to send test email')
}
```

## SMTP Configuration Options

### Option 1: STARTTLS (Recommended)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Best for**: Most use cases, better compatibility

### Option 2: SSL/TLS
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
```

**Best for**: Environments requiring encrypted connections from start

## Gmail Sending Limits

### Personal Gmail Account
- **500 emails per day** (rolling 24-hour period)
- Limit resets 24 hours after first email sent
- Exceeding limit results in temporary suspension (24 hours)

### Google Workspace Account
- **2,000 emails per day** for most plans
- Higher limits available for enterprise plans
- Contact Google Workspace support for limit increases

### Best Practices
1. Monitor your sending volume
2. Implement rate limiting in your application
3. Consider using a queue system for bulk emails
4. Use pagination for large user lists

## Troubleshooting

### Error: "Invalid login: 535-5.7.8 Username and Password not accepted"

**Solutions**:
1. Verify 2-Step Verification is enabled
2. Regenerate the App Password
3. Copy the App Password without spaces
4. Ensure you're using the App Password, not your regular password
5. Check if "Less secure app access" is disabled (it should be)

### Error: "Connection timeout"

**Solutions**:
1. Check your internet connection
2. Verify SMTP_HOST and SMTP_PORT are correct
3. Check if your firewall/antivirus is blocking SMTP ports
4. Try using port 465 with SMTP_SECURE=true
5. Verify your network allows outbound SMTP connections

### Error: "Daily sending quota exceeded"

**Solutions**:
1. Wait 24 hours for the quota to reset
2. Upgrade to Google Workspace for higher limits
3. Implement email batching/queueing
4. Consider switching to a dedicated email service (Resend, SendGrid)

### Error: "Email sent but not received"

**Solutions**:
1. Check recipient's spam/junk folder
2. Verify FROM_EMAIL matches GMAIL_USER
3. Add SPF/DKIM records if using custom domain
4. Check Gmail's "Sent" folder to confirm delivery
5. Ask recipient to add your email to contacts/whitelist

### Connection Verification Failed

```typescript
// The service automatically verifies the connection on initialization
// Check the logs for verification status:
// ✅ Gmail SMTP connection verified successfully
// OR
// ❌ Gmail SMTP connection verification failed
```

## Security Best Practices

### 1. Never Commit Secrets
```bash
# Always add to .gitignore
.dev.vars
.env
*.local
secrets.json
```

### 2. Use Environment Variables
```typescript
// ✅ Good - read from environment
const password = process.env.GMAIL_PASSWORD

// ❌ Bad - hardcoded credentials
const password = 'mypassword123'
```

### 3. Rotate App Passwords Regularly
- Generate new App Passwords every 6-12 months
- Revoke old App Passwords when no longer needed
- Use different App Passwords for different applications

### 4. Use Cloudflare Secrets in Production
```bash
# Set as encrypted secret (not plain text in wrangler.toml)
wrangler secret put GMAIL_PASSWORD
```

### 5. Monitor for Unauthorized Access
- Check Google Account activity regularly
- Enable alerts for suspicious activity
- Review "Recent security events" in Google Account

## Switching Between Email Providers

The application supports multiple email providers. To switch:

### Switch to MailChannels (Free, Cloudflare Workers)
```bash
EMAIL_PROVIDER=mailchannels
```

### Switch to Resend
```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

### Switch to Gmail
```bash
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_PASSWORD=your-app-password
```

## Advanced Configuration

### Using Google Workspace with Custom Domain

```bash
# Same configuration as personal Gmail
EMAIL_PROVIDER=gmail
FROM_EMAIL=noreply@yourdomain.com  # Your Workspace email
FROM_NAME=Your Company
GMAIL_USER=noreply@yourdomain.com
GMAIL_PASSWORD=your-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

### Connection Pooling

The Gmail provider uses connection pooling by default for better performance:

```typescript
// Configured automatically in GmailProvider
pool: true,              // Enable connection pooling
maxConnections: 5,       // Max concurrent connections
maxMessages: 100,        // Max messages per connection
```

### Custom SMTP Server

If you're using a different SMTP server (not Gmail):

```bash
EMAIL_PROVIDER=gmail  # Still use the Gmail provider (nodemailer)
FROM_EMAIL=your-email@example.com
GMAIL_USER=your-smtp-username
GMAIL_PASSWORD=your-smtp-password
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
```

## Email Types Supported

### 1. Invitation Emails
```typescript
await emailService.sendInvitationEmail({
  to_email: 'newuser@example.com',
  to_name: 'New User',
  inviter_name: 'Admin User',
  invitation_token: 'unique-token-here',
  invitation_message: 'Welcome to the team!',
  role: 'user'
})
```

### 2. Test Emails
```typescript
await emailService.sendTestEmail('test@example.com')
```

### 3. Custom Emails (Coming Soon)
Future updates will add support for:
- Password reset emails
- Welcome emails
- Activity notifications
- Weekly summaries

## Monitoring and Logging

The email service includes comprehensive logging:

```typescript
// Success logs
✅ Gmail provider initialized for user@gmail.com via smtp.gmail.com:587
✅ Gmail SMTP connection verified successfully
✅ Email sent successfully via Gmail to recipient@example.com (Message ID: <...>)

// Error logs
❌ Gmail credentials not provided, falling back to MailChannels
❌ Gmail SMTP connection verification failed: Error details...
❌ Gmail error: Error sending email...
```

Monitor these logs in your Cloudflare Workers dashboard or local development console.

## Cost Comparison

| Provider | Cost | Free Tier | Best For |
|----------|------|-----------|----------|
| Gmail | Free | 500 emails/day | Personal projects, low volume |
| Google Workspace | $6-18/mo | 2,000 emails/day | Business, medium volume |
| MailChannels | Free* | Unlimited** | Cloudflare Workers only |
| Resend | Free+ | 3,000 emails/mo | Developers, transactional emails |

\* Free for Cloudflare Workers users  
\** Subject to fair use policy  
+ Free tier with paid plans available

## Migration Guide

### From MailChannels to Gmail

1. Generate Gmail App Password (see Step 2)
2. Update environment variables:
   ```bash
   EMAIL_PROVIDER=gmail
   GMAIL_USER=your-email@gmail.com
   GMAIL_PASSWORD=your-app-password
   ```
3. Restart your application
4. Send a test email to verify

### From Gmail to Another Provider

Simply change `EMAIL_PROVIDER` and remove Gmail-specific variables:

```bash
# Switch to MailChannels
EMAIL_PROVIDER=mailchannels
# Remove: GMAIL_USER, GMAIL_PASSWORD, SMTP_*

# Or switch to Resend
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

## FAQ

### Q: Can I use my regular Gmail password instead of an App Password?
**A**: No, Google disabled "Less secure app access" in 2022. You must use App Passwords.

### Q: Do I need to enable "Less secure app access"?
**A**: No, this option is deprecated. Use App Passwords instead.

### Q: Can I send emails from a different address than GMAIL_USER?
**A**: The FROM_EMAIL can be different from GMAIL_USER, but Gmail will add "via gmail.com" to the sender info unless you configure a custom domain in Gmail settings.

### Q: What happens if I exceed the daily limit?
**A**: Gmail will temporarily block sending for 24 hours. Implement rate limiting to prevent this.

### Q: Can I use this with Gmail API instead of SMTP?
**A**: This implementation uses SMTP. Gmail API support could be added in the future.

### Q: Is nodemailer compatible with Cloudflare Workers?
**A**: Yes, but with limitations. For production, consider using MailChannels (designed for Workers) or Resend. Gmail/nodemailer works best for local development and traditional Node.js environments.

### Q: How do I revoke an App Password?
**A**: Go to https://myaccount.google.com/apppasswords and click the trash icon next to the App Password you want to revoke.

### Q: Can I use this with G Suite/Google Workspace?
**A**: Yes, the setup is identical. Google Workspace accounts have higher sending limits (2,000/day).

## Additional Resources

- [Gmail SMTP Settings](https://support.google.com/mail/answer/7126229)
- [Google App Passwords](https://support.google.com/accounts/answer/185833)
- [Nodemailer Documentation](https://nodemailer.com/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Email Best Practices](https://developers.google.com/gmail/api/guides/sending)

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the application logs for error messages
3. Verify your Gmail App Password is correct
4. Test with the built-in test email functionality
5. Consult the nodemailer documentation for advanced issues

## Next Steps

After setting up Gmail:

1. ✅ Send a test email to verify configuration
2. ✅ Test invitation email flow
3. ✅ Monitor sending volume to stay within limits
4. ✅ Consider implementing email queueing for bulk operations
5. ✅ Set up error alerting for failed email sends

---

**Status**: ✅ Gmail integration complete and ready to use!
