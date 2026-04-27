/** Mirrors Edge Function `admin-monitoring-probe` JSON body (keep in sync manually). */
export interface AdminMonitoringProbeResult {
  checkedAt: string;
  supabase: {
    ok: boolean;
    message?: string;
    projectName?: string;
    projectRef?: string;
    region?: string;
    projectCount?: number;
  };
  vercel: {
    ok: boolean;
    message?: string;
    userEmail?: string;
    username?: string;
  };
  db: {
    ok: boolean;
    latencyMs: number;
    message?: string;
  };
}
