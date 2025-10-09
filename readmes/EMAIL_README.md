# Email Service Documentation

This directory contains documentation for the email service implementation in the Cycling Calories Calculator application.

## 📚 Documentation Files

### Quick Start
- **[EMAIL_QUICKSTART.md](./EMAIL_QUICKSTART.md)** - 5-minute setup guide
  - Quick Gmail setup instructions
  - Basic usage examples
  - Common troubleshooting
  - Perfect for getting started quickly

### Complete Guide
- **[GMAIL_SETUP.md](./GMAIL_SETUP.md)** - Comprehensive Gmail integration guide
  - Detailed step-by-step setup
  - All configuration options
  - Complete troubleshooting guide
  - Security best practices
  - FAQ section
  - 474 lines of detailed documentation

### Implementation Details
- **[GMAIL_INTEGRATION_SUMMARY.md](./GMAIL_INTEGRATION_SUMMARY.md)** - Technical implementation summary
  - What was changed and why
  - Complete list of modified files
  - Code examples
  - Feature comparison
  - Production deployment guide

### Configuration
- **[.dev.vars.example](./.dev.vars.example)** - Environment variables template
  - Copy to `.dev.vars` for local development
  - Contains all required configuration options
  - Includes helpful comments and defaults

## 🚀 Getting Started

### 1. Choose Your Path

**I want to get started ASAP** → Start with [EMAIL_QUICKSTART.md](./EMAIL_QUICKSTART.md)

**I want to understand everything** → Start with [GMAIL_SETUP.md](./GMAIL_SETUP.md)

**I want technical details** → Start with [GMAIL_INTEGRATION_SUMMARY.md](./GMAIL_INTEGRATION_SUMMARY.md)

### 2. Basic Setup (3 steps)

```bash
# 1. Copy environment template
cp .dev.vars.example .dev.vars

# 2. Get Gmail App Password
# Visit: https://myaccount.google.com/apppasswords

# 3. Edit .dev.vars with your credentials
# Then run: npm run dev
```

## 📧 Email Providers

The application supports three email providers:

### Gmail (NEW)
- **Best for**: Personal projects, development, small teams
- **Requires**: Gmail App Password
- **Limits**: 500 emails/day (personal), 2,000/day (Workspace)
- **Setup**: See [GMAIL_SETUP.md](./GMAIL_SETUP.md)

### MailChannels (Default)
- **Best for**: Production on Cloudflare Workers
- **Requires**: Nothing! Free for Cloudflare Workers
- **Limits**: Unlimited (fair use)
- **Setup**: Just set `EMAIL_PROVIDER=mailchannels`

### Resend
- **Best for**: Developers, transactional emails
- **Requires**: Resend API key
- **Limits**: 3,000 emails/month (free tier)
- **Setup**: Get API key from https://resend.com

## 🔄 Quick Provider Switch

```bash
# Use Gmail
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_PASSWORD=your-app-password

# Use MailChannels (default)
EMAIL_PROVIDER=mailchannels

# Use Resend
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxx
```

## 📖 What Each File Contains

| File | Purpose | Lines | Best For |
|------|---------|-------|----------|
| EMAIL_QUICKSTART.md | Quick setup | 142 | Beginners, quick reference |
| GMAIL_SETUP.md | Complete guide | 474 | Detailed setup, troubleshooting |
| GMAIL_INTEGRATION_SUMMARY.md | Tech details | 436 | Developers, implementation details |
| .dev.vars.example | Config template | 70 | Local development setup |

## 🔧 Configuration Reference

### Required Variables (for Gmail)
```bash
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_PASSWORD=your-16-char-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME=Your App Name
APP_URL=http://localhost:8787
```

### Optional Variables
```bash
SMTP_HOST=smtp.gmail.com      # Default: smtp.gmail.com
SMTP_PORT=587                  # Default: 587
SMTP_SECURE=false              # Default: false
```

## 🧪 Testing

### Quick Test
```bash
npm run dev
# Look for: ✅ Gmail SMTP connection verified successfully
```

### Send Test Email
Use the admin panel or curl:
```bash
curl -X POST http://localhost:8787/api/admin/invitations \
  -H "Content-Type: application/json" \
  -H "Cookie: session_id=YOUR_SESSION" \
  -d '{"email": "test@example.com", "role": "user"}'
```

## 🚨 Common Issues

### "Invalid login" error
→ Use App Password, not regular password  
→ Enable 2-Step Verification first  
→ See [GMAIL_SETUP.md](./GMAIL_SETUP.md#troubleshooting)

### Connection timeout
→ Check firewall settings  
→ Try port 465 with SMTP_SECURE=true  
→ See [GMAIL_SETUP.md](./GMAIL_SETUP.md#troubleshooting)

### Emails not received
→ Check spam folder  
→ Verify FROM_EMAIL is correct  
→ See [GMAIL_SETUP.md](./GMAIL_SETUP.md#troubleshooting)

## 🔐 Security

**IMPORTANT**: Never commit `.dev.vars` to git!

```bash
# Verify it's in .gitignore
cat .gitignore | grep dev.vars

# Should show:
# .dev.vars
# .dev.vars.local
```

For production, use Wrangler secrets:
```bash
wrangler secret put GMAIL_PASSWORD
```

## 📊 Feature Comparison

| Feature | Gmail | MailChannels | Resend |
|---------|-------|--------------|--------|
| Cost | Free | Free | Free tier |
| Setup Time | 5 min | 0 min | 2 min |
| Daily Limit | 500-2,000 | Unlimited* | 3,000/mo |
| Reliability | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Configuration | Medium | Easy | Easy |

*Subject to fair use policy

## 🎯 Recommendations

### For Development
✅ **Use Gmail** - Easy to set up, good for testing

### For Production
✅ **Use MailChannels** - Free, unlimited, designed for Cloudflare Workers  
✅ **Use Resend** - Modern API, good developer experience

### For High Volume
✅ **Use Google Workspace + Gmail** - 2,000 emails/day  
✅ **Use Resend Paid Plan** - Higher limits, better support

## 📦 Package Details

The implementation uses:
- **nodemailer** (^7.0.6) - SMTP client for Node.js
- **@types/nodemailer** (^7.0.2) - TypeScript definitions

Fully compatible with:
- Cloudflare Workers
- Node.js 18+
- TypeScript 5+

## 🔗 External Resources

- [Gmail SMTP Settings](https://support.google.com/mail/answer/7126229)
- [Google App Passwords](https://support.google.com/accounts/answer/185833)
- [Nodemailer Documentation](https://nodemailer.com/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Resend](https://resend.com)

## 📝 Code Examples

### Initialize Email Service
```typescript
import { EmailService } from './lib/email-service'

const emailService = new EmailService({
  provider: 'gmail',
  from_email: env.FROM_EMAIL,
  from_name: env.FROM_NAME,
  app_url: env.APP_URL,
  gmail_user: env.GMAIL_USER,
  gmail_password: env.GMAIL_PASSWORD,
})
```

### Send Invitation
```typescript
await emailService.sendInvitationEmail({
  to_email: 'user@example.com',
  to_name: 'John Doe',
  inviter_name: 'Admin',
  invitation_token: 'abc123',
  role: 'user'
})
```

### Send Test Email
```typescript
const success = await emailService.sendTestEmail('test@example.com')
```

## 🆘 Need Help?

1. **Quick questions** → Check [EMAIL_QUICKSTART.md](./EMAIL_QUICKSTART.md)
2. **Setup issues** → See [GMAIL_SETUP.md](./GMAIL_SETUP.md)
3. **Technical details** → Read [GMAIL_INTEGRATION_SUMMARY.md](./GMAIL_INTEGRATION_SUMMARY.md)
4. **Configuration** → Review [.dev.vars.example](./.dev.vars.example)

## ✅ Status

- ✅ Gmail integration complete
- ✅ All providers working
- ✅ Documentation complete
- ✅ Production ready

---

**Last Updated**: 2025-10-05  
**Version**: 1.0.0  
**Status**: Production Ready 🚀
