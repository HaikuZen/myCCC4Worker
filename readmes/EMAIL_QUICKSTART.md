# Email Service Quick Start

## 🚀 Quick Setup (5 minutes)

### 1. Generate Gmail App Password
1. Go to https://myaccount.google.com/apppasswords
2. Create a new App Password named "Cycling Calculator"
3. Copy the 16-character password

### 2. Configure Environment
```bash
# Copy the example file
cp .dev.vars.example .dev.vars

# Edit .dev.vars with your credentials
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_PASSWORD=your-16-char-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME=Cycling Calculator
APP_URL=http://localhost:8787
```

### 3. Test It!
```bash
# Start the server
npm run dev

# The Gmail connection will be verified automatically on startup
# Look for this log:
# ✅ Gmail SMTP connection verified successfully
```

## 📧 Usage Examples

### Send Invitation Email
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

await emailService.sendInvitationEmail({
  to_email: 'newuser@example.com',
  to_name: 'John Doe',
  inviter_name: 'Admin User',
  invitation_token: 'abc123',
  invitation_message: 'Welcome!',
  role: 'user'
})
```

### Send Test Email
```typescript
const success = await emailService.sendTestEmail('test@example.com')
```

## 🔄 Switch Providers

### Use Gmail
```bash
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_PASSWORD=your-app-password
```

### Use MailChannels (Default)
```bash
EMAIL_PROVIDER=mailchannels
```

### Use Resend
```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxx
```

## ⚙️ SMTP Options

### TLS (Port 587) - Recommended
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

### SSL (Port 465)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
```

## 📊 Limits

- **Personal Gmail**: 500 emails/day
- **Google Workspace**: 2,000 emails/day

## 🛠️ Troubleshooting

### "Invalid login" error
- Use App Password, not regular password
- Enable 2-Step Verification first
- Copy password without spaces

### Connection timeout
- Check firewall settings
- Try port 465 with SMTP_SECURE=true
- Verify internet connection

### Not receiving emails
- Check spam folder
- Verify FROM_EMAIL is correct
- Ensure Gmail account is active

## 📚 Full Documentation

For detailed setup, troubleshooting, and advanced configuration:
- See `GMAIL_SETUP.md` for complete guide
- See `.dev.vars.example` for all configuration options

## 🔒 Security Reminder

✅ **DO**:
- Add `.dev.vars` to `.gitignore`
- Use App Passwords
- Use Wrangler secrets for production

❌ **DON'T**:
- Commit `.dev.vars` to git
- Use your regular Gmail password
- Hardcode credentials in code

---

**Ready to send emails?** Start with `npm run dev` and watch for the connection verification message! 🎉
