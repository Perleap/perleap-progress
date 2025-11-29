# Debug Language Issue - Step by Step

## Follow These Steps EXACTLY and Report Console Output

### Step 1: Clear Everything
1. **Stop dev server** (Ctrl+C)
2. **Clear browser completely:**
   - Open DevTools (F12)
   - Go to Application tab
   - Click "Clear site data"
   - Close browser completely
3. **Start dev server fresh:**
   ```powershell
   npm run dev
   ```
4. **Open a NEW incognito window**

### Step 2: First Registration (Should Work)
1. Go to `http://localhost:8080/auth`
2. **Open DevTools console (F12 → Console tab)**
3. **Switch to Hebrew** using the language toggle
   - **Check console - should see:** `🌐 setLanguage called with: he`
   - **Check console - should see:** `🌐 localStorage updated to: he`
4. Register with a **fresh email** (e.g., `test1@example.com`)
5. **In console, copy ALL lines that start with 🌐 or 🔄 or ⚠️**
6. Complete onboarding in Hebrew
7. **Report:** Did onboarding stay in Hebrew? YES/NO

### Step 3: Delete and Re-Register (The Problem)
1. Go to Supabase dashboard
2. Delete the auth user you just created
3. **WITHOUT closing the browser**, go back to `/auth`
4. **IMPORTANT: Check the language toggle - is it still Hebrew?**
   - If NO → This is the problem!
   - If YES → Continue...
5. **In console, type this and press Enter:**
   ```javascript
   localStorage.getItem('language_preference')
   ```
   - **Report what it returns:** Should be `"he"` or `"en"`
6. **Make sure language toggle is on Hebrew** (switch it if needed)
7. Register with THE SAME EMAIL (e.g., `test1@example.com`)
8. **In console, copy ALL lines that start with 🌐 or 🔄 or ⚠️ or ✅**
9. **Report:** What language is onboarding in? Hebrew or English?

### Step 4: Report Back

Send me:
1. Console output from Step 2 (all 🌐 lines)
2. Console output from Step 3 (all 🌐 🔄 ⚠️ ✅ lines)
3. What `localStorage.getItem('language_preference')` returned in Step 3.5
4. Whether onboarding was in Hebrew or English in Step 3.9

This will show me EXACTLY where the language is getting lost.

---

## Quick Check Before Testing

Run this in your browser console RIGHT NOW:
```javascript
console.log('Current localStorage:', localStorage.getItem('language_preference'));
console.log('Current HTML lang:', document.documentElement.lang);
console.log('Current HTML dir:', document.documentElement.dir);
```

Report what these return.

