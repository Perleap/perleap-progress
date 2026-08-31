import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSessionHealthMonitor() {
  useEffect(() => {
    const checkSessionHealth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('Session health check error:', error);
          return;
        }

        if (session?.expires_at) {
          const expiresAt = session.expires_at * 1000;
          const now = Date.now();
          const minutesToExpiry = Math.floor((expiresAt - now) / (1000 * 60));

          if (minutesToExpiry < 10 && minutesToExpiry > 0) {
            console.warn(`Session expiring in ${minutesToExpiry} minutes`);
          }
        }
      } catch (error) {
        console.error('Session health check exception:', error);
      }
    };

    const initialTimeout = setTimeout(checkSessionHealth, 60 * 1000);
    const interval = setInterval(checkSessionHealth, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);
}
