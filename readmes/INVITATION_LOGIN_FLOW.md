# Invitation-Only Login System

## Overview

The Cycling Calories Calculator now uses an **invitation-only** authentication system. Users can only access the application if they have been invited by an administrator.

## Key Features

- ✅ **Invitation-only access**: Users must have a pending invitation to create an account
- ✅ **Automatic account creation**: Accounts are created automatically during first login
- ✅ **Email validation**: System ensures invited email matches Google account
- ✅ **Role assignment**: Admin privileges automatically granted if specified in invitation
- ✅ **Simple user experience**: No manual acceptance step - just sign in with Google

## How It Works

### Admin Sends Invitation

1. Admin accesses the configuration page
2. Enters user's email address and selects role (user or admin)
3. System sends invitation email with unique token link
4. Invitation expires after 7 days

### User Receives Invitation

User receives an email with a link like:
```
https://yourapp.com/accept-invitation?token=abc123...
```

### User Clicks Invitation Link

When clicking the link, the system shows a welcome page explaining:
- They've been invited to join
- They need to sign in with the invited email address
- Their account will be created automatically
- Instructions for next steps

### User Signs In with Google

1. User clicks "Sign In with Google"
2. Authenticates with Google OAuth
3. System checks:
   - Does user already exist? → Log them in
   - Do they have a pending invitation? → Create account + log in
   - No invitation found? → Show "Invitation Required" page

### Automatic Account Creation

If user has a valid pending invitation:
1. System creates user account from Google profile data
2. Assigns role specified in invitation (user or admin)
3. Marks invitation as accepted
4. Creates session and logs user in
5. Redirects to dashboard

## User Flow Diagram

```
[User] → Click invitation link
         ↓
[System] → Validate token & check expiration
         ↓
[System] → Show welcome page with instructions
         ↓
[User] → Click "Sign In with Google"
         ↓
[Google OAuth] → Authenticate user
         ↓
[System] → Check if user exists in database
         ├── YES → Update last login → Create session → Dashboard
         └── NO → Check for pending invitation
                  ├── YES → Create account → Assign role → Accept invitation → Create session → Dashboard
                  └── NO → Show "Invitation Required" page
```

## API Endpoints

### `/accept-invitation?token={token}`

**Method**: `GET`

**Purpose**: Validates invitation and shows welcome page with sign-in instructions

**Responses**:

- `200 OK` - Valid invitation, shows welcome page
- `200 OK` - Already accepted, shows sign-in prompt
- `400 Bad Request` - Invalid or missing token
- `404 Not Found` - Invitation not found
- `410 Gone` - Invitation expired

### `/auth/callback`

**Method**: `GET`

**Purpose**: OAuth callback that handles Google authentication

**Flow**:
1. Receives authorization code from Google
2. Exchanges code for access token
3. Retrieves user info from Google
4. Checks if user exists in database:
   - **User exists**: Updates last login, creates session
   - **User doesn't exist**: 
     - Checks for pending invitation
     - **Has invitation**: Creates account, assigns role, accepts invitation, creates session
     - **No invitation**: Shows "Invitation Required" page with instructions

## Database Operations

### On First Login with Invitation

```sql
-- 1. Check for pending invitation
SELECT * FROM invitations 
WHERE email = ? AND status = 'pending' AND expires_at > ?

-- 2. Create user account
INSERT INTO users (google_id, email, email_hash, name, picture, last_login)
VALUES (?, ?, ?, ?, ?, ?)

-- 3. Assign admin role (if specified)
UPDATE users SET is_admin = 1 WHERE id = ?

-- 4. Mark invitation as accepted
UPDATE invitations 
SET status = 'accepted', accepted_at = ? 
WHERE id = ?

-- 5. Create session
INSERT INTO sessions (id, user_id, expires_at)
VALUES (?, ?, ?)
```

## Security Considerations

### Email Validation

- System compares email from Google OAuth with invitation email
- Email hashing ensures privacy while enabling validation
- Users cannot accept invitations for other email addresses

### Invitation Expiration

- Invitations expire after 7 days
- Expired invitations cannot be used to create accounts
- Admin must send new invitation for expired ones

### OAuth Security

- Uses Google OAuth 2.0 for authentication
- No passwords stored in application
- Session-based authentication with HTTP-only cookies
- Sessions expire after 7 days

### Role Assignment

- Admin role only granted if explicitly specified in invitation
- Role cannot be escalated by user
- Only admins can send invitations

## Error Handling

### Invitation Not Found

**Shown when**:
- Token doesn't exist
- Token was deleted

**User action**: Contact admin for new invitation

### Invitation Expired

**Shown when**:
- More than 7 days since invitation sent

**User action**: Contact admin for new invitation

### Invitation Already Accepted

**Shown when**:
- User clicks invitation link again after accepting

**User action**: Click "Sign In" to log in

### Invitation Required

**Shown when**:
- User tries to log in without invitation
- No pending invitation found for their email

**User action**: Contact admin to request invitation

## Code Examples

### Checking for Pending Invitation in OAuth Callback

```typescript
// Find user in database
let user = await dbService.findUserByGoogleIdOrEmail(googleUser.id, googleUser.email)

if (!user) {
  // Check if they have a pending invitation
  const pendingInvitation = await dbService.findPendingInvitation(googleUser.email)
  
  if (pendingInvitation && !dbService.isInvitationExpired(pendingInvitation.expires_at)) {
    // Create account from Google data
    user = await dbService.createUserFromGoogleData(googleUser)
    
    // Set admin role if needed
    if (pendingInvitation.role === 'admin') {
      await dbService.updateUserRole(user.id, true)
    }
    
    // Mark invitation as accepted
    await dbService.acceptInvitation(pendingInvitation.id)
  } else {
    // Show invitation required page
    return showInvitationRequiredPage()
  }
}
```

### Validating Invitation Token

```typescript
// Get invitation by token
const invitation = await dbService.db
  .prepare('SELECT * FROM invitations WHERE token = ?')
  .bind(token)
  .first()

// Check status
if (invitation.status === 'accepted') {
  return showAlreadyAcceptedPage()
}

// Check expiration
if (dbService.isInvitationExpired(invitation.expires_at)) {
  return showExpiredPage()
}

// Valid invitation - show welcome page
return showWelcomePage(invitation)
```

## Testing Scenarios

### Scenario 1: New User with Invitation

1. Admin sends invitation to `user@example.com`
2. User receives email with invitation link
3. User clicks link → sees welcome page
4. User clicks "Sign In with Google"
5. User authenticates with `user@example.com`
6. **Expected**: Account created automatically, logged in, redirected to dashboard

### Scenario 2: User Without Invitation

1. User navigates to `/login`
2. User clicks "Sign In with Google"
3. User authenticates with `unregistered@example.com`
4. **Expected**: "Invitation Required" page shown with instructions

### Scenario 3: User with Expired Invitation

1. User receives invitation
2. Waits more than 7 days
3. Clicks invitation link
4. **Expected**: "Invitation Expired" page shown

### Scenario 4: User Clicks Invitation Link Twice

1. User accepts invitation and creates account
2. User clicks same invitation link again
3. **Expected**: "Already Accepted" page with sign-in button

### Scenario 5: Wrong Google Account

1. User has invitation for `alice@example.com`
2. User signs in with `bob@example.com`
3. **Expected**: "Invitation Required" page (no matching invitation)

### Scenario 6: Admin Invitation

1. Admin sends invitation with admin role
2. User completes sign-in process
3. **Expected**: Account created with admin privileges, can access admin pages

## Admin Responsibilities

### Sending Invitations

1. Access configuration page (admin only)
2. Enter user email address (must be valid)
3. Select role (user or admin)
4. Optional: Add personal message
5. Click "Send Invitation"

### Managing Invitations

- View all invitations (pending, accepted, expired)
- Delete/revoke pending invitations
- Resend expired invitations
- Monitor invitation acceptance rates

### Best Practices

- ✅ Verify email address before sending invitation
- ✅ Use personal messages for context
- ✅ Send invitations for specific roles based on needs
- ✅ Cleanup expired invitations regularly
- ✅ Monitor for suspicious login attempts

## Troubleshooting

### User reports "Invitation Required" error

**Check**:
1. Has invitation been sent?
2. Is invitation still pending (not expired)?
3. Does email match exactly?
4. Is user using correct Google account?

**Solution**: Send new invitation if needed

### User can't complete sign-in

**Check**:
1. Is Google OAuth configured correctly?
2. Are environment variables set?
3. Is redirect URI correct?
4. Are sessions working?

**Solution**: Check application logs and configuration

### Invitation email not received

**Check**:
1. Is email provider configured?
2. Are API keys valid?
3. Is email in spam folder?
4. Is email address correct?

**Solution**: Check email service logs, resend invitation

## Logging

The system logs the following events:

```
[INFO] Creating account for invited user: user@example.com
[INFO] Granted admin role to new user 123
[INFO] ✅ Invitation auto-accepted for user@example.com during first login
[INFO] Valid invitation found for: user@example.com, redirecting to login
[WARN] Login attempt by non-invited user: unauthorized@example.com
[ERROR] OAuth callback error: <error details>
```

## Migration from Open Registration

If migrating from a system with open registration:

1. **Update OAuth callback**: Replace `findOrCreateUser` with invitation check
2. **Notify existing users**: No action needed for existing accounts
3. **Send invitations**: For any pending user requests
4. **Update documentation**: Inform users of invitation-only policy
5. **Monitor**: Watch for users attempting to register without invitations

## Benefits

### Security
- ✅ Prevents unauthorized access
- ✅ Admin controls who can join
- ✅ Audit trail of all invitations

### User Experience
- ✅ Simple one-click account creation
- ✅ No manual registration forms
- ✅ Automatic role assignment
- ✅ Clear error messages and guidance

### Administration
- ✅ Easy invitation management
- ✅ Role-based access control
- ✅ Email-based user validation
- ✅ Invitation expiration management

## Future Enhancements

Potential improvements:

1. **Custom expiration periods**: Allow admins to set per-invitation expiration
2. **Invitation templates**: Pre-defined messages for different user types
3. **Bulk invitations**: Send multiple invitations at once
4. **Invitation analytics**: Track acceptance rates and timing
5. **Whitelist domains**: Auto-approve users from specific email domains
6. **Re-invitation**: Automatic resend for expired invitations
7. **Welcome workflow**: Multi-step onboarding after account creation
8. **Invitation preview**: Show what invitation email looks like before sending

## Related Documentation

- [Authentication Setup](./AUTHENTICATION_SETUP.md) - Google OAuth configuration
- [Email Service](./EMAIL_README.md) - Email provider setup
- [Security](../SECURITY.md) - Security architecture
- [Invitation Acceptance](./INVITATION_ACCEPTANCE.md) - Original detailed flow (deprecated)

## Summary

The invitation-only login system provides a secure, user-friendly way to control access to the Cycling Calories Calculator. By automatically creating accounts during first login, the system eliminates manual registration steps while maintaining strict access control through admin-managed invitations.
