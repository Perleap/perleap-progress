import { supabase } from '@/integrations/supabase/client';
import { USER_ROLES } from '@/config/constants';

/**
 * Inserts a row in admin_audit_log. No-ops for non-admins. Failures are logged only.
 */
export async function logAdminEvent(input: {
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.user_metadata?.role !== USER_ROLES.ADMIN) return;

    const { error } = await supabase.from('admin_audit_log').insert({
      admin_user_id: user.id,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: (input.metadata ?? null) as unknown as null,
    });
    if (error) {
      console.warn('logAdminEvent:', error.message);
    }
  } catch (e) {
    console.warn('logAdminEvent failed', e);
  }
}
