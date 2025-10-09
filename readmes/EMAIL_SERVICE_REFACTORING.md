# Email Service Refactoring: Multi-Provider Support

## Overview

The `EmailService` class has been refactored to support multiple email providers using a provider pattern architecture. This allows you to choose between MailChannels (free for Cloudflare Workers) and Resend (modern email API) without changing your application code.

## Changes Made

### 1. Provider Pattern Implementation

**Architecture:**
```
EmailService (Main Class)
    ↓
EmailProviderInterface (Abstract Interface)
    ↓
├── MailChannelsProvider (Implementation)
└── ResendProvider (Implementation)
```

### 2. New Configuration Options

```typescript
export interface EmailConfig {
  from_email: string
  from_name: string
  app_url: string
  provider?: 'mailchannels' | 'resend'  // NEW
  resend_api_key?: string                // NEW
}
```

### 3. Provider Implementations

#### MailChannelsProvider
- **API**: MailChannels Send API (`https://api.mailchannels.net/tx/v1/send`)
- **Cost**: Free for Cloudflare Workers
- **Best For**: Small to medium projects, development, Cloudflare Workers deployments
- **Limitations**: Requires DNS setup for custom domains in production

#### ResendProvider
- **API**: Resend API (`https://api.resend.com/emails`)
- **Cost**: Pay-as-you-go pricing (100 emails/day free)
- **Best For**: Production applications requiring advanced features
- **Benefits**: Better deliverability, webhooks, analytics, SDKs

### 4. Automatic Provider Selection

The EmailService automatically selects the appropriate provider based on configuration:

```typescript
// Default: MailChannels (no extra config needed)
const emailService = new EmailService({
  from_email: 'noreply@example.com',
  from_name: 'My App',
  app_url: 'https://myapp.com'
})

// Using Resend
const emailService = new EmailService({
  from_email: 'noreply@example.com',
  from_name: 'My App',
  app_url: 'https://myapp.com',
  provider: 'resend',
  resend_api_key: 'your_api_key_here'
})
```

### 5. Fallback Mechanism

If Resend is selected but no API key is provided, the service automatically falls back to MailChannels:

```typescript
if (providerType === 'resend') {
  if (!config.resend_api_key) {
    log.warn('Resend API key not provided, falling back to MailChannels')
    this.provider = new MailChannelsProvider(config.from_email, config.from_name)
  } else {
    this.provider = new ResendProvider(...)
  }
}
```

## Configuration

### Environment Variables

Add these to your Cloudflare Workers environment or `wrangler.jsonc`:

```bash
# Required for all providers
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Your App Name
APP_URL=https://your-worker-url.workers.dev

# Optional: Choose provider (defaults to 'mailchannels')
EMAIL_PROVIDER=resend  # or 'mailchannels'

# Required only if using Resend
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### Setting Secrets with Wrangler

```bash
# Set email configuration
wrangler secret put FROM_EMAIL
wrangler secret put FROM_NAME
wrangler secret put APP_URL

# For Resend
wrangler secret put EMAIL_PROVIDER
wrangler secret put RESEND_API_KEY
```

### Local Development (wrangler.jsonc)

```json
{
  "vars": {
    "FROM_EMAIL": "noreply@localhost",
    "FROM_NAME": "Cycling Calories Calculator (Dev)",
    "APP_URL": "http://localhost:8787",
    "EMAIL_PROVIDER": "mailchannels"
  }
}
```

## Usage Examples

### Sending Invitation Emails

The API remains unchanged - provider selection is automatic:

```typescript
const emailService = createEmailService(c.env, c.req.url)

const sent = await emailService.sendInvitationEmail({
  to_email: 'user@example.com',
  to_name: 'John Doe',
  inviter_name: 'Admin User',
  invitation_token: 'secure_token_here',
  invitation_message: 'Welcome to our platform!',
  role: 'user'
})
```

### Sending Test Emails

```typescript
const emailService = createEmailService(c.env, c.req.url)
const sent = await emailService.sendTestEmail('test@example.com')
```

## Provider Comparison

| Feature | MailChannels | Resend |
|---------|-------------|--------|
| **Cost** | Free for Cloudflare Workers | 100/day free, then pay-as-you-go |
| **Setup Complexity** | Low | Medium |
| **DNS Requirements** | Yes (for custom domains) | Yes |
| **API Key Required** | No | Yes |
| **Deliverability** | Good | Excellent |
| **Analytics** | Basic | Advanced |
| **Webhooks** | No | Yes |
| **SDK Support** | Limited | Extensive |
| **Rate Limits** | Generous | 100/day free tier |
| **Best For** | Development, small projects | Production, enterprise |

## Migration Guide

### From MailChannels to Resend

1. **Get Resend API Key**:
   - Sign up at https://resend.com
   - Verify your domain
   - Get API key from https://resend.com/api-keys

2. **Update Environment Variables**:
   ```bash
   wrangler secret put EMAIL_PROVIDER
   # Enter: resend
   
   wrangler secret put RESEND_API_KEY
   # Enter: your_api_key
   ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

4. **Test**:
   - Send a test invitation
   - Check Resend dashboard for delivery status

### From Resend to MailChannels

1. **Update Environment Variables**:
   ```bash
   wrangler secret put EMAIL_PROVIDER
   # Enter: mailchannels
   ```

2. **Setup DNS** (if using custom domain):
   - Add SPF record: `v=spf1 a mx include:relay.mailchannels.net ~all`
   - Follow MailChannels documentation

3. **Deploy**:
   ```bash
   npm run deploy
   ```

## Setup Instructions

### MailChannels Setup

#### For `*.workers.dev` Domains
No additional setup required! It works out of the box.

#### For Custom Domains
1. Add SPF record to your DNS:
   ```
   TXT @ v=spf1 a mx include:relay.mailchannels.net ~all
   ```

2. Add DKIM records (optional but recommended):
   - Follow: https://support.mailchannels.com/hc/en-us/articles/4565898358413

3. Verify your domain with MailChannels

### Resend Setup

1. **Sign Up**: https://resend.com

2. **Add Domain**:
   - Go to https://resend.com/domains
   - Click "Add Domain"
   - Enter your domain name

3. **Add DNS Records**:
   Resend will provide records similar to:
   ```
   TXT @ v=DKIM1; k=rsa; p=MIGfMA0GCSq...
   TXT _dmarc v=DMARC1; p=none
   ```

4. **Get API Key**:
   - Go to https://resend.com/api-keys
   - Create a new API key
   - Copy and save it securely

5. **Configure Environment**:
   ```bash
   wrangler secret put EMAIL_PROVIDER
   # Enter: resend
   
   wrangler secret put RESEND_API_KEY
   # Paste your API key
   ```

## Testing

### Test MailChannels Provider

```bash
# Set provider to mailchannels
wrangler secret put EMAIL_PROVIDER
# Enter: mailchannels

# Deploy and test
npm run deploy

# Send test email via API or admin interface
```

### Test Resend Provider

```bash
# Set provider to resend
wrangler secret put EMAIL_PROVIDER
# Enter: resend

wrangler secret put RESEND_API_KEY
# Enter: your_resend_api_key

# Deploy and test
npm run deploy
```

### Verify Provider Selection

Check Cloudflare Workers logs to see which provider is being used:

```
EmailService: Email service configured with provider: resend, from: noreply@yourdomain.com
```

or

```
EmailService: Using MailChannels email provider
```

## Logging

The service provides comprehensive logging for debugging:

```typescript
// Provider selection
log.info('Using MailChannels email provider')
log.info('Using Resend email provider')

// Email sending
log.info(`✅ Email sent successfully via MailChannels to user@example.com`)
log.info(`✅ Email sent successfully via Resend to user@example.com (ID: abc123)`)

// Errors
log.error(`❌ MailChannels failed: 400 Invalid sender`)
log.error(`❌ Resend failed: 401 {"message":"Invalid API key"}`)

// Warnings
log.warn('Resend API key not provided, falling back to MailChannels')
```

## Error Handling

Both providers handle errors gracefully:

```typescript
try {
  const sent = await emailService.sendInvitationEmail(data)
  if (!sent) {
    // Email failed - check logs for details
    // Application continues, invitation is still saved in DB
  }
} catch (error) {
  // Unexpected error
  log.error('Email service error:', error)
}
```

## Benefits of Refactoring

### 1. **Flexibility**
- Easy to switch between providers
- Add new providers without changing application code
- Provider-specific configuration isolated

### 2. **Maintainability**
- Clear separation of concerns
- Each provider in its own class
- Easy to test providers independently

### 3. **Reliability**
- Automatic fallback mechanism
- Comprehensive error handling
- Detailed logging for debugging

### 4. **Extensibility**
- Easy to add new providers (SendGrid, AWS SES, etc.)
- Common interface ensures consistency
- Provider-specific features can be exposed

### 5. **Production Ready**
- Support for enterprise email provider (Resend)
- Better deliverability options
- Advanced features available when needed

## Future Enhancements

Potential additions to the email service:

1. **More Providers**:
   - SendGrid
   - AWS SES
   - Postmark
   - Mailgun

2. **Advanced Features**:
   - Email templates
   - Attachment support
   - CC/BCC support
   - Email scheduling
   - Batch sending

3. **Monitoring**:
   - Delivery tracking
   - Bounce handling
   - Open/click tracking
   - Email analytics dashboard

4. **Retry Logic**:
   - Automatic retry on failure
   - Exponential backoff
   - Fallback to secondary provider

5. **Testing**:
   - Email preview in development
   - Test mode (no actual sending)
   - Email capture for testing

## Files Modified

### `src/lib/email-service.ts`
- Added `EmailProvider` type
- Added `EmailProviderInterface` interface
- Created `MailChannelsProvider` class
- Created `ResendProvider` class
- Refactored `EmailService` to use provider pattern
- Updated configuration interface
- Added provider selection logic

### `src/index.ts`
- Updated `Bindings` type with new email variables
- Updated `createEmailService()` function
- Added provider selection logic

### `wrangler.jsonc`
- Updated email configuration documentation
- Added Resend setup instructions
- Added environment variable examples

## Conclusion

The refactored EmailService provides a flexible, maintainable solution for sending emails from your Cloudflare Workers application. The provider pattern allows easy switching between email services and provides a foundation for adding more providers in the future.

**Key Takeaways**:
- ✅ Multiple provider support (MailChannels + Resend)
- ✅ Automatic provider selection
- ✅ Fallback mechanism
- ✅ No application code changes required
- ✅ Comprehensive logging and error handling
- ✅ Production-ready with enterprise options
- ✅ Easy to extend with new providers

Your invitation system is now more robust and production-ready! 🎉
