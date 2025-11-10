# Testing Guide: Session Persistence & Navigation Enhancement

## Quick Start Testing

### Prerequisites
1. Make sure your development server is running:
```bash
npm run dev
# or
npm start
```

2. Open your browser's DevTools (F12) to monitor:
   - **Console**: For any errors or auth event logs
   - **Application/Storage tab**: To see localStorage/sessionStorage
   - **Network tab**: To verify auth requests

## Test Scenarios

### 🧪 Test 1: Basic Authentication Persistence

**Steps**:
1. Open the app in your browser
2. Navigate to `/auth` or click "Sign In"
3. Log in with your credentials (teacher or student account)
4. You should be redirected to your dashboard

**Expected Result**:
- ✅ Successfully logged in
- ✅ Redirected to appropriate dashboard (teacher/student)
- ✅ No errors in console

**Verify in DevTools**:
- Check **Application → Local Storage** → Your domain
- You should see Supabase auth tokens stored

---

### 🧪 Test 2: Browser Back Button (Main Feature)

**Steps**:
1. Log in as a user
2. Navigate to your dashboard
3. Click on a classroom or assignment
4. Click the **browser back button** (not the in-app back button)
5. Click the **browser forward button**

**Expected Result**:
- ✅ You remain logged in throughout
- ✅ Pages load correctly with your data
- ✅ No redirect to `/auth`
- ✅ Navigation history works smoothly

**❌ Before Fix**: Would redirect to auth page, requiring re-login

---

### 🧪 Test 3: Refresh Page While Authenticated

**Steps**:
1. Log in and navigate to any protected page (e.g., `/teacher/dashboard`)
2. Press **F5** or click the browser refresh button
3. Wait for the page to reload

**Expected Result**:
- ✅ Page reloads successfully
- ✅ You remain authenticated
- ✅ Dashboard data loads correctly
- ✅ No redirect to auth page

---

### 🧪 Test 4: Direct URL Access

**Steps**:
1. Log in to your account
2. Copy a protected URL (e.g., `http://localhost:5173/teacher/classroom/abc123`)
3. Open a **new tab** in the same browser
4. Paste and navigate to that URL

**Expected Result**:
- ✅ Page loads directly (you remain authenticated)
- ✅ Content displays correctly
- ✅ No redirect to auth

**Alternative - Test Unauthenticated Access**:
1. Open an **incognito/private window**
2. Navigate directly to a protected URL
3. Expected: Redirected to `/auth`
4. Log in
5. Expected: Redirected back to the original URL you tried to access

---

### 🧪 Test 5: Protected Route Redirect After Login

**Steps**:
1. Open an **incognito/private window**
2. Try to access a protected route directly (e.g., `/student/dashboard`)
3. You'll be redirected to `/auth`
4. Log in with valid credentials

**Expected Result**:
- ✅ After successful login, you're redirected to `/student/dashboard`
- ✅ NOT redirected to a generic dashboard first

**Check Console**:
- Look for the message about saving redirect path

---

### 🧪 Test 6: Already Authenticated User Accessing Auth Page

**Steps**:
1. Log in to your account
2. Navigate to your dashboard
3. Manually navigate to `/auth` or `/login` in the address bar

**Expected Result**:
- ✅ Immediately redirected back to your dashboard
- ✅ No login form shown
- ✅ No flicker or delay

**❌ Before Fix**: Would show the auth page even when logged in

---

### 🧪 Test 7: Role-Based Access Control

**Test as Teacher**:
1. Log in as a **teacher**
2. Try to access a student route by typing `/student/dashboard` in the address bar

**Expected Result**:
- ✅ Redirected to `/teacher/dashboard`
- ✅ Cannot access student pages

**Test as Student**:
1. Log in as a **student**
2. Try to access a teacher route by typing `/teacher/dashboard` in the address bar

**Expected Result**:
- ✅ Redirected to `/student/dashboard`
- ✅ Cannot access teacher pages

---

### 🧪 Test 8: Session Persistence Across Browser Restart

**Steps**:
1. Log in to your account
2. Navigate to a protected page
3. **Close the entire browser** (all windows)
4. **Reopen the browser**
5. Navigate to your app URL

**Expected Result**:
- ✅ You should still be logged in
- ✅ Can access protected pages without re-authenticating
- ✅ Session tokens are automatically restored

**Note**: Session duration depends on Supabase settings (default: 7 days)

---

### 🧪 Test 9: Sign Out Clears Everything

**Steps**:
1. Log in to your account
2. Navigate around the app
3. Open DevTools → Application → Storage
4. Note the stored data in localStorage and sessionStorage
5. Click "Sign Out" or "Log Out"

**Expected Result**:
- ✅ Redirected to home page (`/`)
- ✅ All auth tokens cleared from localStorage
- ✅ All sessionStorage data cleared
- ✅ Accessing protected routes now redirects to auth

**Verify in DevTools**:
- Check that Supabase auth keys are removed from localStorage
- Check that sessionStorage is cleared

---

### 🧪 Test 10: Multiple Tabs Sync

**Steps**:
1. Log in to your account in **Tab 1**
2. Open a **new tab (Tab 2)** with the same app
3. Navigate to a protected page in Tab 2

**Expected Result**:
- ✅ Tab 2 recognizes you're authenticated
- ✅ Can access protected pages without re-login

**Test Sign Out Sync**:
1. With both tabs open
2. Sign out in **Tab 1**
3. Switch to **Tab 2** and try to navigate

**Expected Result**:
- ✅ Tab 2 should also recognize you're signed out
- ✅ Redirected to auth when trying to access protected pages

---

### 🧪 Test 11: Token Refresh (Long Session)

**Steps**:
1. Log in to your account
2. Leave the browser tab open but don't interact with it for ~30-60 minutes
3. Come back and interact with the app (click something, navigate)

**Expected Result**:
- ✅ Session is automatically refreshed
- ✅ You remain logged in
- ✅ No errors or auth prompts

**Check Console**:
- Look for "Session token refreshed" log message

---

### 🧪 Test 12: Google OAuth Sign In

**Steps**:
1. Open an incognito window
2. Navigate to `/auth`
3. Click "Sign Up" tab
4. Select a role (Teacher or Student)
5. Click "Sign up with Google"
6. Complete Google authentication

**Expected Result**:
- ✅ Redirected to `/auth/callback`
- ✅ Then redirected to appropriate onboarding or dashboard
- ✅ Role is correctly set

**Test OAuth with Redirect**:
1. While logged out, try to access `/teacher/classroom/123`
2. Redirected to auth
3. Sign in with Google
4. Expected: Redirected back to the classroom page (not just dashboard)

---

## Advanced Testing

### Test State Persistence Hook (Optional)

If you want to test the `usePersistedState` hook:

**Steps**:
1. Temporarily add this to a component (e.g., TeacherOnboarding):

```tsx
import { usePersistedFormState } from '@/hooks';

// In your component:
const [testData, setTestData, clearTestData] = usePersistedFormState('test-form', {
  name: '',
  message: ''
});

console.log('Persisted test data:', testData);
```

2. Fill in some form data
3. Navigate away from the page
4. Come back to the page
5. Expected: Form data should be restored

---

## Common Issues & Debugging

### Issue: Redirected to auth after refresh

**Possible Causes**:
- Browser blocking cookies/localStorage
- Private/incognito mode with strict settings
- Supabase session expired

**Debug**:
- Check DevTools → Console for errors
- Check DevTools → Application → Local Storage for auth tokens
- Try clearing cache and logging in again

### Issue: Infinite redirect loop

**Possible Causes**:
- User doesn't have a role set
- User has wrong role
- Profile not created

**Debug**:
- Check console for auth state logs
- Verify user metadata in Supabase dashboard
- Check if teacher/student profile exists in database

### Issue: "Loading..." forever

**Possible Causes**:
- Auth context stuck in loading state
- Network issue

**Debug**:
- Check console for errors
- Check Network tab for failed requests
- Verify Supabase URL and keys in `.env`

---

## Automated Testing Script

You can also create a test script to verify the key functionality:

```javascript
// Run this in browser console after logging in

// Test 1: Check if auth tokens exist
console.log('Auth tokens:', Object.keys(localStorage).filter(k => k.includes('supabase')));

// Test 2: Check session storage
console.log('Session storage:', sessionStorage);

// Test 3: Verify user is authenticated
import { supabase } from '@/integrations/supabase/client';
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user);
```

---

## Testing Checklist

Copy this checklist and mark items as you test:

```
[ ] ✓ Basic login works
[ ] ✓ Browser back button maintains auth
[ ] ✓ Browser forward button maintains auth
[ ] ✓ Page refresh maintains auth
[ ] ✓ Direct URL access works when authenticated
[ ] ✓ Protected routes redirect to auth when not logged in
[ ] ✓ After login, redirects to originally requested page
[ ] ✓ Auth page redirects to dashboard when already logged in
[ ] ✓ Teachers can't access student routes
[ ] ✓ Students can't access teacher routes
[ ] ✓ Session persists after browser restart
[ ] ✓ Sign out clears all data
[ ] ✓ Multiple tabs stay in sync
[ ] ✓ Token auto-refresh works
[ ] ✓ Google OAuth works with redirect
```

---

## Next Steps After Testing

If all tests pass:
1. ✅ Feature is working correctly!
2. Consider deploying to staging/production
3. Monitor user behavior and session metrics

If tests fail:
1. Note which specific test failed
2. Check console for error messages
3. Review the implementation for that specific feature
4. Feel free to ask for help with specific issues!

