# Security Architecture

## Overview

The Cycling Calories Calculator implements a **multi-layer security architecture** with server-side enforcement as the primary protection mechanism. Client-side checks are purely for user experience and can be bypassed without compromising actual security.

## Core Principle

🔒 **SECURITY IS ENFORCED SERVER-SIDE** 🔒

All sensitive operations are protected by server-side middleware that validates:
1. User is authenticated (valid session)
2. User has appropriate permissions (admin status)

**Client-side checks** are used ONLY to provide better UX by showing appropriate UI states before attempting server requests.

## Authentication Layer

### Session Management

- **Type**: Secure HTTP-only cookies
- **Duration**: 7 days
- **Storage**: Database-backed sessions
- **Security Features**:
  - HttpOnly flag (prevents JavaScript access)
  - Secure flag (HTTPS only in production)
  - SameSite=Strict (CSRF protection)
  - Cryptographically secure session IDs

### Server-Side Validation

Every protected route validates:

```typescript
// Authentication middleware
async function requireAuth(c: any, next: Function) {
  const authService = createAuthService(c.env, c.req.url)
  const sessionId = authService.extractSessionFromCookie(c.req.header('Cookie'))
  const user = await authService.validateSession(sessionId)
  
  if (!user) {
    return c.redirect('/login')  // No valid session
  }
  
  c.set('user', user)  // Store user in context
  await next()
}

// Admin authorization middleware
async function requireAdmin(c: any, next: Function) {
  const user = c.get('user')
  if (!user || !user.is_admin) {
    return c.json({ error: 'Admin access required' }, 403)
  }
  await next()
}
```

## Protected Endpoints

### Public Routes (No Authentication Required)

- `GET /` - Main dashboard
- `GET /login` - Login page
- `GET /auth/callback` - OAuth callback handler
- `GET /api/auth/user` - Check authentication status

### Authenticated Routes (requireAuth)

- `GET /api/dashboard` - Dashboard data
- `GET /api/rides` - Ride list
- `GET /api/rides/{id}/analysis` - Ride analysis
- `POST /upload` - GPX file upload
- `POST /api/analyze` - GPX analysis

### Admin-Only Routes (requireAuth + requireAdmin)

#### Page Access
- `GET /database` - Database management interface

#### Database API
- `GET /api/database/overview`
- `GET /api/database/table/:tableName`
- `PUT /api/database/table/:tableName/:recordId`
- `DELETE /api/database/table/:tableName/:recordId`
- `POST /api/database/query`
- `GET /api/database/export/:tableName`
- `POST /api/database/cleanup`
- `POST /api/database/optimize`
- `POST /api/database/backup`
- `GET /api/database/info`
- `GET /api/database/initializeDefaultConfig`
- `GET /api/database/initialize`

#### Configuration API
- `GET /api/configuration` - Read-only, all authenticated users
- `PUT /api/configuration/:key` - **Admin only**
- `POST /api/configuration` - **Admin only**
- `DELETE /api/configuration/:key` - **Admin only**

## Client-Side Security (UX Layer)

### Purpose

Client-side authentication checks serve ONLY these purposes:
1. Show appropriate UI (login vs authenticated vs admin)
2. Prevent unnecessary server requests
3. Provide immediate feedback to users

### What Client-Side Cannot Do

❌ **Cannot grant actual access** - Server validates every request
❌ **Cannot bypass authentication** - Session cookie required
❌ **Cannot elevate privileges** - Admin status checked server-side
❌ **Cannot access protected data** - API returns 403 without proper auth

### Example: Database Page

```javascript
// CLIENT-SIDE (UX only)
async function checkAuthentication() {
    const response = await fetch('/api/auth/user');
    const authData = await response.json();
    
    if (authData.authenticated && authData.user.is_admin) {
        showMainContent();  // Show UI
    } else {
        showAccessDenied();  // Show error
    }
}
```

**What happens if bypassed:**
1. User manipulates JavaScript to call `showMainContent()`
2. UI appears (local only)
3. User attempts to fetch data: `fetch('/api/database/overview')`
4. **Server validates session and admin status**
5. **Server returns 403 Forbidden**
6. No data is exposed

## Server-Side Enforcement

### Request Flow

```
1. Client Request
   ↓
2. Server receives request
   ↓
3. requireAuth middleware
   - Extract session cookie
   - Validate session in database
   - Check session not expired
   - Load user object
   ↓
4. requireAdmin middleware (if route requires admin)
   - Check user.is_admin === true
   - Return 403 if false
   ↓
5. Route handler (only if authorized)
   - Process request
   - Return data
```

### Validation Points

Every protected route validates:

1. **Session Cookie Exists**
   ```typescript
   const sessionId = authService.extractSessionFromCookie(c.req.header('Cookie'))
   if (!sessionId) return c.redirect('/login')
   ```

2. **Session is Valid and Not Expired**
   ```typescript
   const user = await authService.validateSession(sessionId)
   // Query: SELECT * FROM sessions JOIN users WHERE id = ? AND expires_at > NOW()
   if (!user) return c.redirect('/login')
   ```

3. **User Has Required Permissions**
   ```typescript
   if (!user.is_admin) return c.json({ error: 'Admin required' }, 403)
   ```

## Attack Scenarios & Defenses

### Scenario 1: JavaScript Manipulation

**Attack**: User uses browser DevTools to manipulate JavaScript and bypass client-side checks.

**Result**: 
- ✅ UI may appear
- ❌ Server rejects all API requests with 403
- ❌ No data access gained

**Defense**: Server-side validation on every request.

### Scenario 2: Direct API Calls

**Attack**: User directly calls API endpoints using curl, Postman, or fetch.

```bash
curl https://worker-url/api/database/overview
```

**Result**:
- ❌ No session cookie = 401 Unauthorized
- ❌ Non-admin session = 403 Forbidden
- ❌ No data returned

**Defense**: requireAuth + requireAdmin middleware on all sensitive endpoints.

### Scenario 3: Cookie Theft

**Attack**: Attacker steals session cookie via XSS or network interception.

**Defenses**:
- **HttpOnly** cookie flag prevents JavaScript access
- **Secure** flag requires HTTPS (production)
- **SameSite=Strict** prevents CSRF attacks
- **Session expiration** limits damage window (7 days)
- **Session cleanup** removes expired sessions

### Scenario 4: Session Hijacking

**Attack**: Attacker intercepts and reuses valid session cookie.

**Defenses**:
- HTTPS encryption (production)
- Session tied to specific browser
- Session expiration
- Admin can revoke sessions via database

### Scenario 5: Privilege Escalation

**Attack**: Regular user tries to elevate to admin privileges.

**Methods Attempted**:
1. Modify `is_admin` in client-side JavaScript
2. Modify request payload
3. Tamper with cookies

**Result**: All fail because:
- `is_admin` status stored server-side in database
- Server reads from database on every request
- Cannot be modified without database access
- Database requires admin credentials

## Admin Management

### Making a User Admin

**Only possible via direct database access:**

```bash
# Using Wrangler CLI
wrangler d1 execute cycling-data --remote --command="UPDATE users SET is_admin = 1 WHERE id = USER_ID;"
```

**Cannot be done via:**
- ❌ Web interface (no UI for this)
- ❌ API endpoint (no endpoint for this)
- ❌ User self-service
- ❌ Client-side manipulation

### Revoking Admin Access

```bash
wrangler d1 execute cycling-data --remote --command="UPDATE users SET is_admin = 0 WHERE id = USER_ID;"
```

### Listing Admins

```bash
wrangler d1 execute cycling-data --remote --command="SELECT id, email, is_admin FROM users WHERE is_admin = 1;"
```

## Database Security

### Direct Database Access

- **Cloudflare D1** database
- **No public access** - Only accessible via Cloudflare Workers
- **Wrangler CLI required** for direct access
- **Cloudflare account credentials** required

### SQL Injection Prevention

1. **Parameterized queries** used throughout
2. **Type checking** on all inputs
3. **Allowlist validation** for table names
4. **Query validation** prevents DROP operations

```typescript
// Example: Safe parameterized query
const user = await db.prepare('SELECT * FROM users WHERE id = ?')
  .bind(userId)
  .first()
```

### Allowed Tables

Only specific tables accessible via API:
- rides
- users
- sessions
- calorie_breakdown
- configuration

Attempting other table names returns 400 Bad Request.

## Session Management

### Session Lifecycle

1. **Creation**: User completes OAuth flow
2. **Storage**: Session ID and expiration stored in database
3. **Validation**: Checked on every protected request
4. **Expiration**: Automatically expires after 7 days
5. **Cleanup**: Expired sessions removed automatically

### Session Storage

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,              -- Cryptographically secure random ID
    user_id INTEGER NOT NULL,         -- Foreign key to users table
    expires_at TEXT NOT NULL,         -- ISO timestamp
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Revoking Sessions

**Specific user:**
```bash
wrangler d1 execute cycling-data --remote --command="DELETE FROM sessions WHERE user_id = USER_ID;"
```

**All sessions:**
```bash
wrangler d1 execute cycling-data --remote --command="DELETE FROM sessions;"
```

## Security Best Practices

### For Developers

✅ **DO:**
- Always use `requireAuth` for authenticated routes
- Add `requireAdmin` for administrative operations
- Validate and sanitize all inputs
- Use parameterized queries
- Log security events
- Keep dependencies updated

❌ **DON'T:**
- Rely on client-side validation for security
- Store secrets in code or version control
- Skip server-side validation
- Trust client-provided data
- Expose sensitive information in errors

### For Administrators

✅ **DO:**
- Limit admin users to essential personnel
- Regularly review admin user list
- Monitor access logs
- Use strong authentication
- Keep session duration reasonable
- Revoke unused sessions

❌ **DON'T:**
- Share admin accounts
- Use admin access for routine tasks
- Leave sessions active on shared computers
- Grant admin privileges unnecessarily

## Monitoring & Auditing

### Current Logging

- Authentication attempts
- Authorization failures
- Database operations
- API errors

### Logs Location

```bash
# View live logs
wrangler tail

# View specific requests
wrangler tail --format=pretty
```

### What to Monitor

- Failed authentication attempts
- 403 Forbidden responses
- Unusual API usage patterns
- Admin user creation/changes
- Configuration modifications

## Compliance & Standards

### Implemented Standards

- ✅ **OAuth 2.0** for authentication
- ✅ **HTTPS** for transport security (production)
- ✅ **HttpOnly** cookies
- ✅ **CSRF** protection (SameSite cookies)
- ✅ **Principle of least privilege**
- ✅ **Defense in depth**

### Data Protection

- User passwords: **Not stored** (OAuth only)
- Session IDs: Cryptographically secure random
- Sensitive data: Protected by authentication
- GPX files: Stored as BLOB, admin access only

## Conclusion

The security architecture follows the principle of **server-side enforcement with client-side UX enhancement**. While client-side checks can be bypassed, they provide no actual access to protected resources. All security-critical decisions are made server-side with proper validation of authentication and authorization on every request.

**Key Takeaway**: Manipulating client-side JavaScript or HTML does NOT grant access to protected data. The server validates every request independently, ensuring that only properly authenticated admin users can access sensitive operations and data.