# Invitation Acceptance Flow

## Overview

The `/accept-invitation` endpoint allows users who have been invited to the Cycling Calories Calculator to accept their invitation and gain access to the application.

## Key Features

- **Token-based validation**: Uses secure invitation tokens sent via email
- **User authentication required**: Only registered Google users can accept invitations
- **Email matching**: Ensures the logged-in user's email matches the invitation recipient
- **Automatic role assignment**: Grants admin privileges if specified in the invitation
- **Expiration handling**: Checks and enforces invitation expiration dates
- **User-friendly error pages**: Provides clear guidance for various error scenarios

## Endpoint Details

### URL
```
GET /accept-invitation?token={invitation_token}
```

### Query Parameters
- `token` (required): The invitation token sent via email

## User Flow

1. **User clicks invitation link** in email (e.g., `https://yourapp.com/accept-invitation?token=abc123...`)

2. **System validates token**:
   - Checks if token exists in database
   - Verifies token status is 'pending'
   - Confirms token has not expired

3. **Authentication check**:
   - If user is NOT logged in → Shows "Sign In Required" page
   - If user IS logged in → Proceeds to email verification

4. **Email verification**:
   - Compares logged-in user's email with invitation email
   - If mismatch → Shows "Email Mismatch" page with sign-out option
   - If match → Proceeds to accept invitation

5. **Invitation acceptance**:
   - Updates user role to admin if invitation specifies admin role
   - Marks invitation as accepted in database
   - Shows success page with auto-redirect to dashboard

## Response Pages

### Invalid Invitation (400)
Shown when the token parameter is missing or empty.

### Invitation Not Found (404)
Shown when:
- Token doesn't exist in database
- Invitation has already been accepted
- Invitation status is not 'pending'

### Invitation Expired (410)
Shown when the invitation's expiration date has passed.

### Sign In Required (401)
Shown when user is not authenticated with Google.
- Displays the invitation recipient's email address
- Provides "Sign In with Google" button
- Reminds user to use the correct Google account

### Email Mismatch (403)
Shown when the logged-in user's email doesn't match the invitation email.
- Shows both the invitation email and logged-in email
- Provides "Sign Out" button to switch accounts
- Link to return to home page

### Success (200)
Shown when invitation is successfully accepted.
- Confirms acceptance
- Shows admin status if granted
- Auto-redirects to dashboard after 3 seconds
- Provides immediate "Go to Dashboard Now" button

### Error (500)
Shown when an unexpected server error occurs during processing.

## Database Operations

### Queries Made
1. `getInvitationByToken(token)` - Retrieves invitation details
2. `isInvitationExpired(expiresAt)` - Checks expiration status
3. `validateSession(sessionId)` - Verifies user authentication
4. `updateUserRole(userId, isAdmin)` - Updates user privileges (if needed)
5. `acceptInvitation(invitationId)` - Marks invitation as accepted

### Database Updates
- Updates `users.is_admin` if invitation grants admin role
- Updates `users.updated_at` timestamp
- Sets `invitations.status = 'accepted'`
- Sets `invitations.accepted_at` to current timestamp

## Security Considerations

### Email Matching Enforcement
- The system strictly validates that the logged-in user's email matches the invitation email
- This prevents users from accepting invitations meant for others

### Token Validation
- Tokens are validated at multiple levels:
  - Existence in database
  - Pending status only
  - Not expired
  - Secure random generation (32 bytes, hex encoded)

### Authentication Requirement
- Users must be authenticated via Google OAuth before accepting
- Only registered users with existing accounts can accept invitations
- Sessions are validated before processing

### Admin Role Handling
- Admin privileges are only granted if:
  - The invitation explicitly specifies the admin role
  - The user's email matches the invitation
  - The user successfully accepts the invitation

## Code Examples

### Backend Implementation

```typescript
// Accept invitation endpoint
app.get('/accept-invitation', async (c) => {
  const token = c.req.query('token')
  
  // Validate token
  const invitation = await dbService.getInvitationByToken(token)
  
  // Check expiration
  if (dbService.isInvitationExpired(invitation.expires_at)) {
    return showExpiredPage()
  }
  
  // Verify user authentication
  const user = await authService.validateSession(sessionId)
  if (!user) {
    return showSignInRequiredPage()
  }
  
  // Verify email match
  if (user.email !== invitation.email) {
    return showEmailMismatchPage()
  }
  
  // Accept invitation and update role if needed
  if (invitation.role === 'admin') {
    await dbService.updateUserRole(user.id, true)
  }
  await dbService.acceptInvitation(invitation.id)
  
  return showSuccessPage()
})
```

### Email Link Format

Invitation emails contain a link in this format:

```
https://yourapp.com/accept-invitation?token=64_character_hex_token
```

Example:
```
https://cycling-calc.example.com/accept-invitation?token=a1b2c3d4e5f6789...
```

## Testing Scenarios

### Happy Path
1. Admin sends invitation to `user@example.com`
2. User receives email with invitation link
3. User clicks link (not logged in)
4. System shows "Sign In Required" page
5. User clicks "Sign In with Google"
6. User authenticates with `user@example.com`
7. System redirects back to invitation acceptance
8. System validates email match
9. System accepts invitation and updates role
10. User sees success page and is redirected to dashboard

### Error Scenarios

#### Expired Token
1. User clicks old invitation link (> 7 days)
2. System shows "Invitation Expired" page
3. User must contact admin for new invitation

#### Wrong Account
1. User clicks invitation link for `alice@example.com`
2. User is logged in as `bob@example.com`
3. System shows "Email Mismatch" page
4. User clicks "Sign Out"
5. User signs in with correct account

#### Invalid Token
1. User clicks tampered or invalid link
2. System shows "Invitation Not Found" page
3. User can return to home page

## Database Schema

### Invitations Table

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

CREATE INDEX idx_invitations_token ON invitations (token);
CREATE INDEX idx_invitations_email ON invitations (email);
CREATE INDEX idx_invitations_status ON invitations (status);
CREATE INDEX idx_invitations_expires ON invitations (expires_at);
```

## Related Documentation

- [Authentication Setup](./AUTHENTICATION_SETUP.md) - Google OAuth configuration
- [Security](../SECURITY.md) - Security architecture and best practices
- [Email Service](./EMAIL_README.md) - Email provider configuration for invitations

## Future Enhancements

Potential improvements for the invitation system:

1. **Return URL parameter**: Allow redirecting user to a specific page after acceptance
2. **Invitation preview**: Show invitation details before accepting
3. **Multi-step acceptance**: Add confirmation step before final acceptance
4. **Custom expiration periods**: Allow admins to set custom expiration times
5. **Resend invitation**: Allow resending invitations to the same email
6. **Invitation analytics**: Track acceptance rates and times
7. **Bulk invitations**: Accept multiple invitations at once
8. **Remember me**: Store accepted invitation in local storage to skip re-acceptance

## Troubleshooting

### User can't accept invitation

**Problem**: User clicks link but sees "Invitation Not Found"

**Possible causes**:
- Invitation was already accepted
- Invitation was deleted by admin
- Token was modified or corrupted

**Solution**: Admin should send a new invitation

---

**Problem**: User sees "Email Mismatch"

**Possible causes**:
- User is logged in with different Google account
- Email was forwarded to another user

**Solution**: Sign out and sign in with correct Google account that matches invitation email

---

**Problem**: User sees "Invitation Expired"

**Possible causes**:
- More than 7 days passed since invitation was sent
- System clock issue

**Solution**: Admin should send a new invitation

---

**Problem**: User sees "Sign In Required" repeatedly

**Possible causes**:
- Session cookies are blocked
- Browser privacy settings prevent cookie storage
- Session expired

**Solution**: 
- Enable cookies for the site
- Try different browser
- Contact admin if issue persists

## API Response Examples

### Success Response (HTML)
```html
<!DOCTYPE html>
<html>
  <head>
    <title>Invitation Accepted</title>
    <script>
      setTimeout(() => window.location.href = '/';, 3000);
    </script>
  </head>
  <body>
    <h2>Invitation Accepted!</h2>
    <p>Welcome to Cycling Calories Calculator!</p>
    <p>You have been granted admin access.</p>
    <p>Redirecting to dashboard in 3 seconds...</p>
    <a href="/">Go to Dashboard Now</a>
  </body>
</html>
```

### Error Response (HTML)
```html
<!DOCTYPE html>
<html>
  <head>
    <title>Invitation Not Found</title>
  </head>
  <body>
    <h2>Invitation Not Found</h2>
    <p>This invitation link is invalid or has already been used.</p>
    <a href="/">Go to Home</a>
  </body>
</html>
```

## Monitoring and Logging

The endpoint logs the following events:

- `API:AcceptInvitation` - Start of invitation acceptance
- Token validation attempts
- Invitation expiration checks
- Email mismatch attempts
- Successful acceptances with user email and role
- Errors during processing

Example log entries:

```
[INFO] API:AcceptInvitation - User not authenticated, redirecting to login for invitation: user@example.com
[INFO] API:AcceptInvitation - Accepting invitation for user user@example.com with role: admin
[INFO] DatabaseService - Updated user 123 admin status to true
[INFO] DatabaseService - Invitation 45 marked as accepted
[INFO] API:AcceptInvitation - ✅ Invitation accepted successfully for user@example.com
[WARN] API:AcceptInvitation - Invitation not found or already used for token: a1b2c3d4...
[WARN] API:AcceptInvitation - User bob@example.com tried to accept invitation for alice@example.com
[ERROR] API:AcceptInvitation - Error accepting invitation: <error details>
```
