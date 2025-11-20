# Delete User Account Edge Function

This Edge Function handles complete user account deletion, including all related data.

## Functionality

When invoked, this function:

1. **Verifies the user's identity** using their JWT token
2. **Security check**: Ensures users can only delete their own account
3. **Deletes all user data** based on their role:

### For Teachers:
- All classrooms created by the teacher
- All assignments in those classrooms
- All submissions to those assignments
- All enrollments in those classrooms
- All notifications for the teacher
- Teacher profile (including 5D snapshots via CASCADE)
- Auth user record

### For Students:
- All submissions by the student
- All enrollments
- All 5D snapshots
- All hard skill assessments
- All student alerts
- All notifications
- Student profile
- Auth user record

## Deployment

Deploy this function using the Supabase CLI:

```bash
supabase functions deploy delete-user-account
```

## Environment Variables

This function uses the following environment variables (automatically available):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations

## Security

- Requires authentication via JWT token
- Users can ONLY delete their own account
- Uses service role for admin operations (auth user deletion)
- All operations are logged for audit purposes

## Usage

This function is called from the frontend via:

```typescript
const { data, error } = await supabase.functions.invoke('delete-user-account', {
  body: { 
    userId: user.id, 
    userRole: 'teacher' | 'student' 
  },
});
```

## Error Handling

The function returns appropriate error messages for:
- Missing authorization
- Unauthorized access attempts
- Invalid user roles
- Database errors during deletion
- Auth deletion failures

## Cascade Deletes

The database schema includes CASCADE DELETE constraints that automatically handle deletion of child records. This function explicitly deletes data in a specific order to ensure clean removal of all user-related information.

