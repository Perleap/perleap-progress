import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Calendar, Target, FileText, StickyNote } from 'lucide-react';
import type { SyllabusSection } from '@/types/syllabus';

interface SectionDetailPanelProps {
  section: SyllabusSection;
  assignmentCount: number;
  onClose: () => void;
}

export const SectionDetailPanel = ({
  section,
  assignmentCount,
  onClose,
}: SectionDetailPanelProps) => {
  const { t } = useTranslation();
  const dateRange = [section.start_date, section.end_date].filter(Boolean).join(' → ');

  return (
    <div className="mt-4 p-5 rounded-xl border border-border bg-card shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-bold text-lg text-foreground">{section.title}</h3>
          {dateRange && (
            <span className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <Calendar className="h-3.5 w-3.5" /> {dateRange}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {assignmentCount > 0 && (
            <Badge variant="secondary" className="rounded-full">
              <FileText className="h-3 w-3 me-1" /> {assignmentCount} {assignmentCount !== 1 ? t('syllabus.roadmap.assignments') : t('syllabus.roadmap.assignment')}
            </Badge>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8" aria-label={t('syllabus.detail.closeDetails')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {section.description && (
        <div className="mb-4">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{t('syllabus.detail.description')}</h4>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{section.description}</p>
        </div>
      )}

      {section.objectives && section.objectives.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Target className="h-3 w-3" /> {t('syllabus.detail.objectives')}
          </h4>
          <ul className="space-y-1.5">
            {section.objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/40 flex-shrink-0 mt-1.5" />
                {obj}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {section.resources && (
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <FileText className="h-3 w-3" /> {t('syllabus.detail.resources')}
            </h4>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{section.resources}</p>
          </div>
        )}
        {section.notes && (
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <StickyNote className="h-3 w-3" /> {t('syllabus.detail.notes')}
            </h4>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{section.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};
