import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

export type VercelInsights = {
  ok: boolean;
  checkedAt?: string;
  message?: string;
  projects?: Array<{ id: string; name: string; framework: string | null }>;
  deployments?: Array<{ uid: string; state: string; createdAt: number; url?: string }>;
};

export const VERCEL_INSIGHTS_QUERY_KEY = ['admin-vercel-insights'] as const;

function isVercelPayload(x: unknown): x is VercelInsights {
  if (!x || typeof x !== 'object') return false;
  return typeof (x as { ok?: unknown }).ok === 'boolean';
}

export function useAdminVercelInsightsQuery(options?: { staleTime?: number }) {
  const { t } = useTranslation();
  const staleTime = options?.staleTime ?? 60_000;

  return useQuery({
    queryKey: VERCEL_INSIGHTS_QUERY_KEY,
    staleTime,
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error(t('monitoring.probeNoSession'));

      const { data, error } = await supabase.functions.invoke<VercelInsights | { error?: string }>(
        'admin-vercel-insights',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (error) throw new Error(error.message);
      if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: string }).error === 'string') {
        throw new Error((data as { error: string }).error);
      }
      if (!isVercelPayload(data)) {
        throw new Error(t('monitoring.probeInvalidResponse'));
      }
      return data;
    },
  });
}
