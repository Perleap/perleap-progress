# Secret leak remediation

Follow these steps after rotating Supabase API keys.

## 1. Deactivate legacy keys (Supabase Dashboard)

1. Open [API Keys](https://supabase.com/dashboard/project/zwhnpteterkrunfevixs/settings/api-keys).
2. Open the **Legacy anon, service_role** tab.
3. Confirm **Last used** is idle for the old keys (after redeploying edge functions).
4. **Deactivate** the legacy `service_role` key (invalidates the leaked JWT).
5. **Deactivate** the legacy `anon` key once the app works with the publishable key.

## 2. Purge `.env` from git history

Removing `.env` from the latest commit is not enough. Keys remain in commit `9d45427` until history is rewritten.

**Option A — GitGuardian / GitHub**

- Use the **Fix This Secret Leak** link from the GitGuardian email, or
- Repo → **Settings** → **Security** → **Secret scanning** → follow remediation.

**Option B — git-filter-repo (manual)**

```powershell
# Install: pip install git-filter-repo
git filter-repo --path .env --invert-paths
git push origin main --force
```

Coordinate with your team before force-pushing. Everyone must re-clone or reset after a history rewrite.

## 3. Production frontend

If deployed (e.g. Vercel), set `VITE_SUPABASE_ANON_KEY` to the publishable key and redeploy.

Edge function secrets are platform-managed (`SUPABASE_SECRET_KEYS`, `SUPABASE_SERVICE_ROLE_KEY`).
