# Email Privacy Implementation - Deployment Checklist

## Pre-Deployment

### 1. Code Review
- [ ] Review all changes in `database-service.ts`
- [ ] Review schema updates in `schema.sql`
- [ ] Review migration script `001_add_email_hash.sql`
- [ ] Verify no plain emails are logged
- [ ] Check all database queries use `email_hash`

### 2. Testing
- [ ] Run unit tests: `npm test`
- [ ] Verify email masking works correctly
- [ ] Verify email hashing is consistent
- [ ] Test user creation flow
- [ ] Test user login flow
- [ ] Test duplicate user detection
- [ ] Verify masked emails display correctly in UI

### 3. Local Testing
```bash
# Start local development server
npm run dev

# Test authentication flow
# 1. Navigate to /login
# 2. Sign in with Google
# 3. Verify masked email in database
# 4. Check browser console for errors
# 5. Test logout and re-login

# Verify database
wrangler d1 execute DB --local --command="SELECT id, email, email_hash FROM users;"
```

### 4. Database Backup
```bash
# Backup local database
wrangler d1 export DB --local > backups/local_backup_$(date +%Y%m%d).sql

# Backup production database (if exists)
wrangler d1 export DB > backups/prod_backup_$(date +%Y%m%d).sql
```

## Deployment Steps

### Phase 1: Schema Migration (Local)

#### Step 1: Run Migration Locally
```bash
# Add email_hash column
wrangler d1 execute DB --local --file=migrations/001_add_email_hash.sql

# Verify schema
wrangler d1 execute DB --local --command="PRAGMA table_info(users);"
```

#### Step 2: Test with Local Data
```bash
# Create test user
# Sign in via Google OAuth locally
# Verify data structure
wrangler d1 execute DB --local --command="SELECT * FROM users;"
```

#### Step 3: Validate
- [ ] `email_hash` column exists
- [ ] `email_hash` index exists
- [ ] Old `email` index removed (if applicable)
- [ ] New users have masked emails
- [ ] New users have email hashes
- [ ] Authentication works correctly

### Phase 2: Deploy Code Updates

#### Step 1: Deploy to Production
```bash
# Deploy updated code
npm run deploy

# Or with wrangler
wrangler deploy
```

#### Step 2: Monitor Deployment
- [ ] Check deployment logs
- [ ] Verify no errors in CloudFlare dashboard
- [ ] Test login endpoint: `https://your-domain.com/login`

### Phase 3: Schema Migration (Production)

⚠️ **CRITICAL: Only proceed after code is deployed and tested**

#### Step 1: Create Production Backup
```bash
# Final backup before migration
wrangler d1 export DB > backups/prod_pre_migration_$(date +%Y%m%d_%H%M%S).sql
```

#### Step 2: Run Production Migration
```bash
# Execute migration
wrangler d1 execute DB --file=migrations/001_add_email_hash.sql
```

#### Step 3: Verify Production Schema
```bash
# Check table structure
wrangler d1 execute DB --command="PRAGMA table_info(users);"

# Check existing users
wrangler d1 execute DB --command="SELECT id, email, email_hash FROM users LIMIT 5;"
```

### Phase 4: Post-Deployment Testing

#### Immediate Checks (within 5 minutes)
- [ ] Test user login
- [ ] Test user creation (new user)
- [ ] Check error logs in CloudFlare
- [ ] Verify masked emails in database
- [ ] Test admin access (if applicable)

#### Extended Monitoring (within 1 hour)
- [ ] Monitor authentication success rate
- [ ] Check for any user-reported issues
- [ ] Review application logs
- [ ] Test from different browsers
- [ ] Test logout and re-login flows

#### 24-Hour Monitoring
- [ ] Review all authentication logs
- [ ] Check for any database errors
- [ ] Monitor user feedback
- [ ] Verify no degradation in performance

## Post-Deployment

### 1. Existing Users Migration

**For existing users:**
- [ ] Document that they need to re-authenticate
- [ ] Send notification (if applicable)
- [ ] Provide support for login issues

**Migration Strategy:**
```sql
-- For existing users without email_hash
-- They will be updated on next login
-- Monitor this query to track progress:
SELECT COUNT(*) as users_without_hash 
FROM users 
WHERE email_hash IS NULL OR email_hash = '';
```

### 2. Documentation Updates
- [ ] Update README.md with privacy features
- [ ] Update privacy policy (if applicable)
- [ ] Update terms of service (if applicable)
- [ ] Document for developers
- [ ] Update API documentation

### 3. Monitoring Setup
- [ ] Set up alerts for authentication failures
- [ ] Monitor database query performance
- [ ] Track user login success rates
- [ ] Set up error notifications

### 4. Communication
- [ ] Notify team of successful deployment
- [ ] Update changelog
- [ ] Post release notes
- [ ] Communicate to stakeholders

## Rollback Plan

If issues occur:

### Option 1: Code Rollback (Preserves Data)
```bash
# Rollback to previous version
git revert HEAD
npm run deploy
```
**Note:** This keeps the database changes but uses old code

### Option 2: Full Rollback (Requires Restoration)
```bash
# Restore previous code
git revert HEAD
npm run deploy

# Restore database from backup
wrangler d1 execute DB --file=backups/prod_pre_migration_*.sql
```
**Warning:** This will lose any new users created after migration

### Option 3: Hotfix
```bash
# Make necessary fixes
git checkout -b hotfix/email-privacy
# Make changes
git commit -m "Fix: email privacy issue"
npm run deploy
```

## Verification Commands

### Check User Table Structure
```bash
wrangler d1 execute DB --command="PRAGMA table_info(users);"
```

### Check User Data Sample
```bash
wrangler d1 execute DB --command="SELECT id, email, SUBSTR(email_hash, 1, 10) || '...' as hash_preview, name FROM users LIMIT 3;"
```

### Check Indexes
```bash
wrangler d1 execute DB --command="SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='users';"
```

### Count Users by Migration Status
```bash
# Users with proper email_hash
wrangler d1 execute DB --command="SELECT COUNT(*) as migrated FROM users WHERE email_hash IS NOT NULL AND email_hash != '';"

# Users needing migration
wrangler d1 execute DB --command="SELECT COUNT(*) as needs_migration FROM users WHERE email_hash IS NULL OR email_hash = '';"
```

## Success Criteria

Deployment is successful when:

- [ ] All tests pass
- [ ] Code deployed without errors
- [ ] Database schema updated successfully
- [ ] New users can register and login
- [ ] Existing users can login
- [ ] Emails are masked in database
- [ ] Email hashes are generated correctly
- [ ] No increase in error rates
- [ ] No user complaints
- [ ] Performance is maintained
- [ ] Logs show no issues

## Contacts & Support

**In case of issues:**
1. Check CloudFlare dashboard logs
2. Review application logs
3. Check database status
4. Review this checklist
5. Consult `PRIVACY_IMPLEMENTATION.md`
6. Consult `migrations/README.md`

**Emergency Rollback Trigger:**
- Authentication failure rate > 5%
- Database errors increasing
- User complaints about login issues
- Performance degradation > 20%

## Sign-off

- [ ] Technical Lead Approval: _________________ Date: _______
- [ ] Security Review Complete: ________________ Date: _______
- [ ] Testing Complete: _______________________ Date: _______
- [ ] Deployment Complete: ____________________ Date: _______
- [ ] Verification Complete: ___________________ Date: _______

---

**Deployment Date:** _______________
**Deployed By:** _______________
**Version:** _______________
**Rollback Plan Ready:** [ ] Yes [ ] No
