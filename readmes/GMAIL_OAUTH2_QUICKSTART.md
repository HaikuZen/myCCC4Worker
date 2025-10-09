# Gmail Email with OAuth 2.0 - Quick Start

## Overview

The application now uses **Gmail OAuth 2.0** for sending emails, leveraging your **existing Google OAuth credentials** (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET). No App Passwords needed!

## ✨ Why This Is Better

✅ **Reuses existing credentials** - No need for separate App Passwords  
✅ **More secure** - OAuth 2.0 is more secure than SMTP passwords  
✅ **Simpler setup** - Just set your Gmail address  
✅ **Better integration** - Uses the same OAuth flow as your app's authentication  

## 🚀 Quick Setup (2 minutes)

### 1. Configure Environment Variables

Edit your `.dev.vars` file:

```bash
# Choose Gmail as email provider
EMAIL_PROVIDER=gmail

# Set the Gmail address to send from
GMAIL_USER=your-email@gmail.com

# That's it! The app will use your existing:
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET
```

### 2. Enable Gmail API (One-time setup)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (the same one you use for OAuth authentication)
3. Navigate to **APIs & Services** → **Library**
4. Search for "Gmail API"
5. Click **Enable**

### 3. Get a Refresh Token (Optional - for production)

For development, the app can work without a refresh token. For production, you need one:

#### Option A: Use OAuth Playground (Recommended)

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) in the top right
3. Check "Use your own OAuth credentials"
4. Enter your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
5. In the left sidebar, scroll to "Gmail API v1"
6. Select `https://www.googleapis.com/auth/gmail.send`
7. Click "Authorize APIs"
8. Sign in with the Gmail account you want to use
9. Click "Exchange authorization code for tokens"
10. Copy the `refresh_token`
11. Add to `.dev.vars`:
    ```bash
    GOOGLE_REFRESH_TOKEN=your-refresh-token-here
    ```

#### Option B: Programmatic Flow (Advanced)

Create a script to get the refresh token - see [Google OAuth 2.0 docs](https://developers.google.com/identity/protocols/oauth2/web-server#offline).

### 4. Test It!

```bash
npm run dev
```

The app will automatically:
- ✅ Use your Google OAuth credentials
- ✅ Authenticate with Gmail API
- ✅ Send emails from your Gmail account

## 📧 Configuration Summary

### Development (.dev.vars)

```bash
# Email Configuration
EMAIL_PROVIDER=gmail
FROM_EMAIL=your-email@gmail.com
FROM_NAME=Your App Name
GMAIL_USER=your-email@gmail.com

# Google OAuth (already configured for authentication)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Optional: For production use
GOOGLE_REFRESH_TOKEN=your-refresh-token
```

### Production (Cloudflare Workers)

```bash
# Set as Wrangler secrets
wrangler secret put GOOGLE_REFRESH_TOKEN

# Set as variables in wrangler.toml
[vars]
EMAIL_PROVIDER = "gmail"
GMAIL_USER = "your-email@gmail.com"
FROM_EMAIL = "your-email@gmail.com"
FROM_NAME = "Your App Name"
```

## 🔍 How It Works

1. **Reuses OAuth Credentials**: Uses your existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
2. **OAuth 2.0 Flow**: Authenticates with Gmail API using OAuth 2.0
3. **Refresh Tokens**: Uses refresh token to get access tokens automatically
4. **Nodemailer**: Sends emails via nodemailer with OAuth 2.0 authentication

## 🆚 Comparison with App Password

| Feature | OAuth 2.0 (NEW) | App Password (OLD) |
|---------|-----------------|---------------------|
| **Setup** | ✅ Reuse existing credentials | ❌ Generate separate password |
| **Security** | ✅ More secure | ⚠️ Less secure |
| **2FA Required** | ✅ Works with 2FA | ⚠️ Requires disabling features |
| **Revocation** | ✅ Easy to revoke | ⚠️ Manual management |
| **Integration** | ✅ Seamless | ❌ Separate system |

## 🐛 Troubleshooting

### "Gmail API not enabled"
**Solution**: Enable Gmail API in your Google Cloud Console (see step 2 above)

### "Invalid grant" error
**Solution**: 
- Check that your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Regenerate your refresh token if it's expired

### "Insufficient permissions"
**Solution**: Make sure you authorized the `gmail.send` scope when getting the refresh token

### Emails not sending
**Solution**:
- Verify `GMAIL_USER` matches the account that authorized the refresh token
- Check that Gmail API is enabled
- Ensure refresh token is valid

## 📊 Sending Limits

- **Personal Gmail**: 500 emails/day
- **Google Workspace**: 2,000 emails/day

Same limits as before, but now with better authentication!

## 🔐 Security Notes

✅ **Refresh tokens are sensitive** - Store them as secrets  
✅ **Use environment variables** - Never hardcode credentials  
✅ **Rotate tokens periodically** - Generate new refresh tokens every 6 months  
✅ **Monitor usage** - Check Google Cloud Console for API usage  

## 📚 Additional Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Nodemailer OAuth 2.0](https://nodemailer.com/smtp/oauth2/)

## 🎉 Benefits

1. **Simpler Setup**: No need to generate and manage App Passwords
2. **Better Security**: OAuth 2.0 is industry standard for API authentication
3. **Unified Credentials**: Uses the same OAuth setup as your app's authentication
4. **Future-Proof**: Gmail is phasing out less secure authentication methods

---

**Ready to send emails?** Just set `EMAIL_PROVIDER=gmail` and `GMAIL_USER` in your `.dev.vars`! 🚀
