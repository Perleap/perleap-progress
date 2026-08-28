import type { Json } from '@/integrations/supabase/types';

export function payloadDbLatencyMs(payload: Json): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const v = (payload as { dbLatencyMs?: unknown }).dbLatencyMs;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function vercelSnapshotDeploymentCount(payload: Json): number {
  if (!payload || typeof payload !== 'object') return 0;
  const sample = (payload as { deploymentSample?: unknown }).deploymentSample;
  return Array.isArray(sample) ? sample.length : 0;
}
