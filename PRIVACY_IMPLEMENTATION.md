# Email Privacy Implementation

## Overview

This document describes the implementation of email privacy features in the Cycling Calories Calculator to enhance user data protection and comply with privacy regulations.

## Changes Made

### 1. Database Schema Updates (`schema.sql`)

**Modified Users Table:**
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,                    -- Now stores MASKED email
    email_hash TEXT UNIQUE NOT NULL,        -- NEW: SHA-256 hash for lookup
    name TEXT NOT NULL,
    picture TEXT,
    is_admin BOOLEAN DEFAULT 0,
    last_login TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Index Changes:**
- Removed: `idx_users_email` (no longer needed for plain email)
- Added: `idx_users_email_hash` (for fast hash-based lookups)

### 2. Database Service (`src/lib/database-service.ts`)

**New Private Methods:**

#### `maskEmail(email: string): string`
Masks email addresses for storage:
- **Input:** `john.doe@example.com`
- **Output:** `j***e@e***e.com`
- **Logic:**
  - Preserves first and last characters of local part
  - Masks middle characters with asterisks (max 3)
  - Same logic applied to domain name
  - Preserves TLD for context

#### `hashEmail(email: string): Promise<string>`
Creates SHA-256 hash of email:
- **Input:** `user@example.com`
- **Output:** `4d186321c1a7f0f354b297e8914ab240...` (64 chars)
- **Features:**
  - Case-insensitive (converts to lowercase)
  - Trims whitespace
  - One-way hash (cannot be reversed)
  - Deterministic (same email = same hash)

**Modified User Methods:**

#### `createUserFromGoogleData(googleUser: GoogleUserInfo)`
Now:
1. Masks the email address
2. Generates email hash
3. Stores both in database
4. Logs masked email (not real email)

#### `findUserByGoogleIdOrEmail(googleId: string, email: string)`
Now:
1. Hashes incoming email for comparison
2. Searches by `google_id` OR `email_hash`
3. Never stores or compares plain email

### 3. Migration Files

**Created:**
- `migrations/001_add_email_hash.sql` - SQL migration script
- `migrations/README.md` - Migration documentation and instructions

### 4. Test Coverage

**Created:**
- `src/lib/__tests__/email-privacy.test.ts` - Comprehensive unit tests
  - Email masking tests (various formats)
  - Email hashing tests (consistency, security)
  - Privacy protection validation

## Privacy Benefits

### 1. **Data Minimization**
- Only masked email stored in database
- Real email never persisted
- Reduces PII exposure

### 2. **Breach Protection**
- Even if database is compromised, real emails are not exposed
- Hash cannot be reversed to get original email
- Attacker cannot harvest email addresses

### 3. **Compliance**
- **GDPR**: Reduces personal data storage
- **CCPA**: Minimizes consumer information
- **Privacy by Design**: Built-in privacy from the start

### 4. **Audit Trail**
- Masked emails still useful for logs
- Admins can identify users without seeing real email
- Maintains accountability without compromising privacy

## Security Considerations

### Hashing Strategy

**Why SHA-256 for email hashing?**
1. **Fast**: Quick lookups for authentication
2. **Consistent**: Same email always produces same hash
3. **Secure**: Cannot reverse hash to get email
4. **Standard**: Well-tested, widely accepted

**Not using bcrypt/argon2 because:**
- Emails need to be searchable (deterministic hash required)
- Not hashing passwords (already handled by OAuth2)
- SHA-256 provides sufficient security for this use case

### Attack Vectors Mitigated

1. **Database Breach**: Real emails not exposed
2. **SQL Injection**: Hashes don't reveal email format
3. **Social Engineering**: Masked emails less useful
4. **Email Scraping**: Cannot harvest emails from database

### Remaining Considerations

1. **Rainbow Tables**: SHA-256 hashes can be pre-computed
   - Mitigation: Limited value without knowing email list
   - Future: Could add application-level salt if needed

2. **Hash Collision**: Extremely unlikely with SHA-256
   - Probability: ~1 in 2^256 (negligible)

## Implementation Examples

### User Creation Flow

```typescript
// Before (storing plain email)
const result = await db.prepare(`
  INSERT INTO users (google_id, email, name)
  VALUES (?, ?, ?)
`).bind(googleUser.id, googleUser.email, googleUser.name)

// After (storing masked email + hash)
const maskedEmail = maskEmail(googleUser.email)  // j***e@e***e.com
const emailHash = await hashEmail(googleUser.email)  // sha256 hash

const result = await db.prepare(`
  INSERT INTO users (google_id, email, email_hash, name)
  VALUES (?, ?, ?, ?)
`).bind(googleUser.id, maskedEmail, emailHash, googleUser.name)
```

### User Lookup Flow

```typescript
// Before (searching by plain email)
const user = await db.prepare(
  'SELECT * FROM users WHERE email = ?'
).bind(email)

// After (searching by hash)
const emailHash = await hashEmail(email)
const user = await db.prepare(
  'SELECT * FROM users WHERE email_hash = ?'
).bind(emailHash)
```

### Display to User

```typescript
// User's actual email (from OAuth): user@example.com
// Stored in database: u***r@e***e.com
// Displayed in UI: u***r@e***e.com
// Used in logs: u***r@e***e.com
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run privacy tests specifically
npm test email-privacy

# Run with coverage
npm test -- --coverage
```

### Test Coverage

- ✅ Standard email masking
- ✅ Short email handling
- ✅ Long email handling
- ✅ Subdomain handling
- ✅ Hash consistency
- ✅ Hash uniqueness
- ✅ Case insensitivity
- ✅ Whitespace handling
- ✅ Privacy validation

## Migration Guide

See `migrations/README.md` for detailed migration instructions.

**Quick Steps:**
1. Backup database
2. Run migration SQL
3. Test authentication flow
4. Deploy to production
5. Monitor for issues

## Future Enhancements

### Potential Improvements

1. **Application-level Salt**: Add unique salt per application
2. **Pepper**: Add secret server-side pepper to hash
3. **Key Derivation**: Use PBKDF2 or similar for additional security
4. **Encryption at Rest**: Encrypt entire database column
5. **Field-level Encryption**: Encrypt email_hash itself

### When to Consider

- Storing more sensitive PII
- Regulatory requirements increase
- Threat model changes
- Security audit recommendations

## Conclusion

This implementation provides a robust privacy layer for user emails while maintaining functionality. The masked emails provide enough context for user recognition and logging, while the hashed emails enable secure authentication and duplicate detection.

**Key Takeaways:**
- ✅ Real emails never stored in database
- ✅ Masked emails provide user context
- ✅ Hashed emails enable secure lookups
- ✅ Privacy by design from the start
- ✅ Compliant with privacy regulations
- ✅ Easy to test and maintain

## References

- [GDPR Article 25 - Data Protection by Design](https://gdpr-info.eu/art-25-gdpr/)
- [SHA-256 Specification (FIPS 180-4)](https://csrc.nist.gov/publications/detail/fips/180/4/final)
- [OWASP - Data Minimization](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
