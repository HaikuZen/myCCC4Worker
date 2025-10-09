# User Invitation System

This document describes the user invitation system implemented for the Cycling Calories Calculator.

## Overview

The invitation system allows administrators to invite new users to the platform via email. Invitations are sent using MailChannels (free for Cloudflare Workers) and include a unique token that expires after 7 days.

## Features

- **Admin-only access**: Only administrators can send invitations
- **Email-based invitations**: Invitations are sent via email with a unique link
- **Role assignment**: Invite users as regular users or administrators
- **Custom messages**: Include a personal message with the invitation
- **Expiration**: Invitations automatically expire after 7 days
- **Duplicate prevention**: Prevents sending invitations to existing users or duplicate pending invitations
- **Beautiful email templates**: Responsive HTML email templates with plain text fallback

## Setup

### 1. Database Migration

Run the migration to add the invitations table to your database:

```bash
# For local development
wrangler d1 execute cycling-data --local --file=./migrations/001_add_invitations.sql

# For production
wrangler d1 execute cycling-data --remote --file=./migrations/001_add_invitations.sql
```

Or apply the changes from `schema.sql` if setting up a new database.

### 2. Email Configuration

Configure the following environment variables in your `wrangler.jsonc` or as Cloudflare secrets:

```json
{
  "vars": {
    "FROM_EMAIL": "noreply@yourdomain.com",
    "FROM_NAME": "Cycling Calories Calculator",
    "APP_URL": "https://your-worker-url.workers.dev"
  }
}
```

Or set as secrets:
```bash
wrangler secret put FROM_EMAIL
wrangler secret put FROM_NAME
wrangler secret put APP_URL
```

### 3. MailChannels Setup (Production)

For production use with a custom domain:

1. **Verify your domain** with MailChannels (if using custom domain)
2. **Add DNS records**:
   - SPF record: `v=spf1 a mx include:relay.mailchannels.net ~all`
   - DKIM record: Follow MailChannels documentation

Learn more: https://support.mailchannels.com/hc/en-us/articles/4565898358413

**Note**: MailChannels works out-of-the-box on `*.workers.dev` domains without DNS setup.

## Usage

### Frontend (Admin User)

1. Log in as an administrator
2. Click on your user avatar in the top right
3. Select "Invite User" from the dropdown menu
4. Fill in the invitation form:
   - **Email**: The recipient's email address
   - **Role**: Choose "User" or "Administrator"
   - **Message** (optional): Add a personal message
5. Click "Send Invitation"

### API Endpoints

#### Send Invitation

```http
POST /api/admin/invitations
Authorization: Required (Admin only)
Content-Type: application/json

{
  "email": "newuser@example.com",
  "role": "user",
  "message": "Welcome to our cycling platform!"
}
```

Response:
```json
{
  "success": true,
  "message": "Invitation sent successfully to newuser@example.com"
}
```

#### List All Invitations

```http
GET /api/admin/invitations
Authorization: Required (Admin only)
```

Response:
```json
{
  "success": true,
  "invitations": [
    {
      "id": 1,
      "email": "user@example.com",
      "role": "user",
      "status": "pending",
      "created_at": "2025-10-05T12:00:00Z",
      "expires_at": "2025-10-12T12:00:00Z",
      "invited_by_name": "Admin User",
      "invited_by_email": "admin@example.com"
    }
  ]
}
```

#### Delete/Revoke Invitation

```http
DELETE /api/admin/invitations/:id
Authorization: Required (Admin only)
```

Response:
```json
{
  "success": true,
  "message": "Invitation deleted"
}
```

## Email Template

The invitation email includes:

- Personalized greeting
- Inviter's name
- Role assignment badge
- Personal message (if provided)
- Call-to-action button with unique invitation link
- Platform features overview
- Expiration notice
- Professional footer

The email is fully responsive and includes both HTML and plain text versions.

## Database Schema

```sql
CREATE TABLE invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'pending',
    message TEXT,
    invited_by INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invited_by) REFERENCES users (id) ON DELETE CASCADE
);
```

### Fields

- **id**: Auto-incrementing primary key
- **email**: The invited user's email address
- **token**: Unique 64-character hex token for the invitation link
- **role**: The role to assign ('user' or 'admin')
- **status**: Invitation status ('pending', 'accepted', 'expired', 'revoked')
- **message**: Optional personal message from the inviter
- **invited_by**: Foreign key to the user who sent the invitation
- **expires_at**: ISO 8601 datetime when the invitation expires (7 days from creation)
- **accepted_at**: ISO 8601 datetime when the invitation was accepted (nullable)
- **created_at**: ISO 8601 datetime when the invitation was created

## Security Features

1. **Admin-only access**: Only administrators can send invitations
2. **Secure tokens**: 256-bit random tokens generated using `crypto.getRandomValues()`
3. **Expiration**: All invitations expire after 7 days
4. **Duplicate prevention**: Checks for existing users and pending invitations
5. **Email validation**: Server-side email format validation
6. **Input sanitization**: All inputs are sanitized before storage

## Error Handling

The system handles various error scenarios:

- Invalid email format
- User already exists
- Pending invitation already exists
- Email sending failures (invitation is still created in DB)
- Database errors
- Network errors

All errors provide clear feedback to the administrator.

## Future Enhancements

Potential improvements for the invitation system:

1. **Invitation acceptance page**: Create `/accept-invitation?token=xxx` page for users to accept invitations
2. **Invitation expiration cleanup**: Background job to clean up expired invitations
3. **Resend invitations**: Allow admins to resend expired or failed invitations
4. **Invitation analytics**: Track invitation acceptance rates
5. **Batch invitations**: Allow sending multiple invitations at once
6. **Email templates customization**: Allow admins to customize email templates
7. **Alternative email providers**: Support for SendGrid, AWS SES, etc.

## Troubleshooting

### Email not sending

1. Check environment variables are set correctly
2. Verify MailChannels DNS records (for custom domains)
3. Check Cloudflare Workers logs for errors
4. Ensure FROM_EMAIL is from a verified domain (for custom domains)

### Invitation link not working

1. Verify APP_URL is set correctly
2. Check token hasn't expired
3. Ensure invitation acceptance endpoint is implemented

### Permission denied

1. Verify user has admin role (`is_admin = 1` in database)
2. Check authentication session is valid
3. Verify admin middleware is working

## Support

For issues or questions about the invitation system, please check:

- Application logs in Cloudflare Workers dashboard
- MailChannels documentation: https://support.mailchannels.com
- Cloudflare Workers documentation: https://developers.cloudflare.com/workers/
