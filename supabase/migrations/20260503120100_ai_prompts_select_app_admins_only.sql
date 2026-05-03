-- Student chat AI prompts catalog: only application admins may read ai_prompts via the client.
-- Edge Functions use service_role and are unaffected.
-- Idempotent: DB may already have the admin policy from a partial run or manual apply.
DROP POLICY IF EXISTS "Authenticated users can read active prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "App admins can read active ai_prompts" ON public.ai_prompts;

CREATE POLICY "App admins can read active ai_prompts"
  ON public.ai_prompts
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND public.is_app_admin((SELECT auth.uid()))
  );
