# User Profile Feature

## Overview

The Cycling Calories Calculator now includes a comprehensive user profile system that allows users to personalize their cycling experience by storing their information and preferences.

## Features

### Profile Fields

Each user can maintain a profile with the following information:

1. **Nickname** (Optional)
   - A display name that can be shown instead of the full name
   - Helps personalize the cycling experience

2. **Weight** (Optional)
   - User weight in kilograms
   - Used for accurate calorie calculations in ride analysis
   - Range: 30-200 kg

3. **Cycling Type** (Optional)
   - User's preferred cycling discipline
   - Options include:
     - Road Cycling
     - Gravel
     - Mountain Biking
     - Track Cycling
     - BMX
     - Cyclocross
     - Touring
     - Commuting

## Database Schema

### Profiles Table

```sql
CREATE TABLE profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    nickname TEXT,
    weight REAL,
    cycling_type TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_profiles_user ON profiles (user_id);
```

### Relationship
- One-to-one relationship with the `users` table
- Profile is automatically deleted when the user is deleted (CASCADE)
- Each user can have only one profile (UNIQUE constraint on `user_id`)

## API Endpoints

### GET /api/profile
Retrieves the current user's profile information.

**Authentication**: Required

**Response**:
```json
{
  "id": 1,
  "user_id": 1,
  "nickname": "CyclingPro",
  "weight": 75.5,
  "cycling_type": "road",
  "created_at": "2025-10-11T10:00:00Z",
  "updated_at": "2025-10-11T10:00:00Z"
}
```

If no profile exists yet, returns:
```json
{
  "user_id": 1,
  "nickname": null,
  "weight": null,
  "cycling_type": null
}
```

### PUT /api/profile
Updates or creates the current user's profile.

**Authentication**: Required

**Request Body**:
```json
{
  "nickname": "CyclingPro",
  "weight": 75.5,
  "cycling_type": "road"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "profile": {
    "id": 1,
    "user_id": 1,
    "nickname": "CyclingPro",
    "weight": 75.5,
    "cycling_type": "road",
    "created_at": "2025-10-11T10:00:00Z",
    "updated_at": "2025-10-11T10:05:00Z"
  }
}
```

## User Interface

### Accessing Profile

Users can access their profile by:
1. Clicking on their avatar in the navigation bar
2. Selecting "Profile" from the dropdown menu

### Profile Modal

The profile modal includes:
- **Header**: "Edit Profile" with user icon
- **Form Fields**:
  - Nickname text input
  - Weight number input (with step 0.1)
  - Cycling Type dropdown selector
- **Action Buttons**:
  - Cancel: Closes the modal without saving
  - Save Profile: Submits the form

### Validation

- Weight must be between 30 and 200 kg
- All fields are optional
- Weight accepts decimal values (e.g., 75.5 kg)

### User Experience

1. **Opening**: Modal opens with current profile data pre-populated
2. **Loading**: Profile data is fetched from the API when modal opens
3. **Editing**: Users can modify any field
4. **Saving**: 
   - Submit button shows loading spinner during save
   - Success message displayed for 2 seconds
   - Modal automatically closes after successful save
5. **Error Handling**: Error messages displayed if save fails

## Database Service Methods

### getProfile(userId: number)
Retrieves the profile for a specific user.

### createProfile(userId, nickname?, weight?, cyclingType?)
Creates a new profile for a user.

### updateProfile(userId, nickname?, weight?, cyclingType?)
Updates an existing profile or creates one if it doesn't exist (upsert behavior).

### deleteProfile(userId)
Deletes a user's profile.

## Migration

For existing databases, run the migration script:

```bash
wrangler d1 execute <DATABASE_NAME> --file=migrations/add-profiles-table.sql
```

Or apply manually:
```sql
-- Run the contents of migrations/add-profiles-table.sql
CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    nickname TEXT,
    weight REAL,
    cycling_type TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles (user_id);
```

## Security

- All profile endpoints require authentication
- Users can only view and edit their own profile
- Profile data is tied to user sessions
- No public access to profile data

## Future Enhancements

Potential additions to the profile system:
- Profile picture upload
- Preferred units (metric/imperial)
- FTP (Functional Threshold Power)
- Maximum heart rate
- Training zones
- Bike specifications
- Goal tracking
- Privacy settings

## Technical Details

### Files Modified
- `schema.sql`: Added profiles table definition
- `src/lib/auth.ts`: Added Profile interface
- `src/lib/database-service.ts`: Added profile CRUD methods
- `src/lib/cycling-database.ts`: Added 'profiles' to validTables
- `src/index.ts`: Added profile API endpoints
- `web/index.html`: Added profile modal HTML
- `web/app.js`: Added profile JavaScript functions

### Dependencies
- DaisyUI: Modal and form styling
- Font Awesome: Icons
- Tailwind CSS: Layout and styling

## Testing

To test the profile feature:

1. **Create Profile**:
   - Log in to the application
   - Click on your avatar → Profile
   - Fill in profile information
   - Click "Save Profile"

2. **Update Profile**:
   - Open profile modal again
   - Modify any fields
   - Save changes

3. **Verify Persistence**:
   - Close and reopen profile modal
   - Verify data is retained
   - Log out and log back in
   - Verify profile data persists

## Troubleshooting

### Profile Not Saving
- Check browser console for API errors
- Verify authentication is working
- Check database permissions

### Profile Data Not Loading
- Verify API endpoint is accessible
- Check network tab for failed requests
- Ensure database migration was applied

### Modal Not Opening
- Check browser console for JavaScript errors
- Verify `initializeProfileForm()` is called
- Check that modal HTML exists in DOM
