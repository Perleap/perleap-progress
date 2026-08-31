import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Classroom } from '@/types/models';

interface DomainsAccordionProps {
  classroom: Classroom;
  isRTL: boolean;
  t: (key: string) => string;
}

export function DomainsAccordion({ classroom, isRTL, t }: DomainsAccordionProps) {
  const [expandedDomains, setExpandedDomains] = useState<Set<number>>(new Set());

  if (!classroom.domains?.length) return null;

  const toggleDomain = (index: number) => {
    setExpandedDomains((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <Card
      className="rounded-xl border-none shadow-sm bg-card ring-1 ring-border"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 bg-muted/50 rounded-xl">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
          </div>
          {t('classroomDetail.subjectAreas')}
        </CardTitle>
        <CardDescription className={isRTL ? 'text-right' : 'text-left'}>
          {t('classroomDetail.subjectAreasDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {classroom.domains.map((domain, index) => (
          <div key={index} className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors bg-card/30"
              onClick={() => toggleDomain(index)}
            >
              <span
                className={`font-semibold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {domain.name}
              </span>
              {expandedDomains.has(index) ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            {expandedDomains.has(index) && (
              <div className="px-4 pb-4 pt-2 bg-muted/30 space-y-2">
                <p
                  className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {t('classroomDetail.skills')}
                </p>
                <div
                  className={`flex flex-wrap gap-2 ${isRTL ? 'justify-end' : 'justify-start'}`}
                >
                  {domain.components.map((component, compIndex) => (
                    <Badge
                      key={compIndex}
                      variant="secondary"
                      className="bg-card text-foreground border border-border rounded-lg px-3 py-1 font-normal"
                    >
                      {component}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
