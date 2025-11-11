# Supabase Sign Out Error - Quick Fix

## Error
```
TypeError: Failed to fetch
at GoTrueClient.signOut
```

## Quick Fixes

### 1. Clear Browser Storage (Recommended)
1. Open browser DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Expand **Local Storage** → Click your site URL
4. Delete these keys:
   - `supabase.auth.token`
   - `sb-<project-ref>-auth-token`
   - `language_preference` (optional, if you want to reset language)
5. Refresh page

### 2. Manual Sign Out Code
Add this to your AuthContext or use in console:

```typescript
// Force clear auth without API call
const forceSignOut = () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '/auth';
};
```

### 3. Check Supabase Configuration
Verify your `.env` file:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Network Check
- Check internet connection
- Try accessing https://your-project.supabase.co directly
- Check if Supabase is down: https://status.supabase.com/

### 5. Add Error Handling (Long-term fix)

Update your sign out function in AuthContext:

```typescript
const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Sign out error:', error);
    // Force local cleanup even if API fails
    localStorage.clear();
    sessionStorage.clear();
  } finally {
    // Always navigate to auth page
    navigate('/auth');
  }
};
```

## Most Likely Cause
Stale authentication token in localStorage - just clear browser storage and refresh!

