import { useEffect, useMemo, useRef, useState } from 'react';

import { resolveSectionResourceForDisplay } from '@/services/syllabusResourceService';

import type { SectionResource } from '@/types/syllabus';



/** Resolve private syllabus storage to in-app blob URLs (session-scoped, not shareable). */

export function useResolvedSectionResources(resources: SectionResource[]) {

  const resourceKey = useMemo(

    () =>

      resources

        .map((r) => `${r.id}:${r.file_path ?? ''}:${r.url ?? ''}:${r.updated_at ?? ''}`)

        .join('|'),

    [resources],

  );



  const [resolved, setResolved] = useState<SectionResource[]>(resources);

  const [isResolving, setIsResolving] = useState(false);

  const revokeAllRef = useRef<(() => void)[]>([]);



  useEffect(() => {

    let cancelled = false;

    revokeAllRef.current.forEach((revoke) => revoke());

    revokeAllRef.current = [];



    if (resources.length === 0) {

      setResolved([]);

      setIsResolving(false);

      return;

    }



    setIsResolving(true);

    void (async () => {

      const registry = {

        register: (revoke: () => void) => {

          revokeAllRef.current.push(revoke);

        },

      };

      const mapped = await Promise.all(

        resources.map((r) => resolveSectionResourceForDisplay(r, registry)),

      );

      if (!cancelled) {
        setResolved(mapped);

        setIsResolving(false);

      } else {

        registry.register = (revoke) => revoke();

        revokeAllRef.current.forEach((revoke) => revoke());

        revokeAllRef.current = [];

      }

    })();



    return () => {

      cancelled = true;

      revokeAllRef.current.forEach((revoke) => revoke());

      revokeAllRef.current = [];

    };

  }, [resourceKey, resources]);



  return { resources: resolved, isResolving };

}


