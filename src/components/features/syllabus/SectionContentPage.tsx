import { useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Target,
  BookOpen,
  FileText,
  Lock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { RichTextViewer } from '@/components/ui/rich-text-editor';
import { ResourceViewer } from './ResourceViewer';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdateStudentProgress, useSectionAssignmentProgress } from '@/hooks/queries';
import { isSectionUnlocked } from '@/lib/sectionUnlock';
import type {
  SyllabusSection,
  SectionResource,
  StudentProgressStatus,
  ReleaseMode,
} from '@/types/syllabus';

interface SectionContentPageProps {
  sectionId: string;
  sections: SyllabusSection[];
  sectionResources: Record<string, SectionResource[]>;
  linkedAssignmentsMap: Record<string, Array<{ id: string; title: string; type: string; due_at: string | null }>>;
  syllabusId: string;
  releaseMode: ReleaseMode;
  studentProgressMap: Record<string, StudentProgressStatus>;
  isRTL: boolean;
  onBack: () => void;
  onNavigateSection: (sectionId: string) => void;
}

const EMPTY_LINKED_ASSIGNMENTS: Array<{
  id: string;
  title: string;
  type: string;
  due_at: string | null;
}> = [];

export const SectionContentPage = ({
  sectionId,
  sections,
  sectionResources,
  linkedAssignmentsMap,
  syllabusId,
  releaseMode,
  studentProgressMap,
  isRTL,
  onBack,
  onNavigateSection,
}: SectionContentPageProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const updateProgress = useUpdateStudentProgress();

  const sortedSections = useMemo(
    () => [...sections].sort((a, b) => a.order_index - b.order_index),
    [sections],
  );
  const currentIndex = sortedSections.findIndex((s) => s.id === sectionId);
  const section = sortedSections[currentIndex];
  const prevSection = currentIndex > 0 ? sortedSections[currentIndex - 1] : null;
  const nextSection = currentIndex < sortedSections.length - 1 ? sortedSections[currentIndex + 1] : null;
  const resources = sectionResources[sectionId] || [];
  const assignments = useMemo(
    () => linkedAssignmentsMap[sectionId] ?? EMPTY_LINKED_ASSIGNMENTS,
    [linkedAssignmentsMap, sectionId],
  );
  const studentProgress = studentProgressMap[sectionId];
  const { data: sectionAssignmentProg } = useSectionAssignmentProgress(
    sectionId,
    user?.id,
  );

  const assignmentProgress = sectionAssignmentProg ?? null;

  // Auto-mark section as completed when all assignments are submitted
  useEffect(() => {
    if (
      assignmentProgress &&
      assignmentProgress.total > 0 &&
      assignmentProgress.submitted >= assignmentProgress.total &&
      studentProgress !== 'completed' &&
      user?.id
    ) {
      updateProgress.mutate({
        sectionId: section?.id ?? '',
        studentId: user.id,
        status: 'completed',
        syllabusId,
      });
    }
  }, [assignmentProgress, studentProgress, user?.id, section?.id, syllabusId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!section) return null;

  const locked = !isSectionUnlocked(section, sections, releaseMode, studentProgressMap);

  const topNavRow = (
    <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
      <Button variant="ghost" onClick={onBack} className="rounded-full gap-1.5">
        {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
        {t('common.back', 'Back')}
      </Button>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!prevSection}
          onClick={() => prevSection && onNavigateSection(prevSection.id)}
          className="rounded-full gap-1 h-8"
        >
          {isRTL ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          {t('syllabus.sections.previous', 'Previous')}
        </Button>
        <span className="text-xs text-muted-foreground">
          {currentIndex + 1} / {sortedSections.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!nextSection}
          onClick={() => nextSection && onNavigateSection(nextSection.id)}
          className="rounded-full gap-1 h-8"
        >
          {t('syllabus.sections.next', 'Next')}
          {isRTL ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );

  const bottomNavRow = (
    <div className={cn('flex items-center justify-between pt-4', isRTL && 'flex-row-reverse')}>
      <Button
        variant="outline"
        disabled={!prevSection}
        onClick={() => prevSection && onNavigateSection(prevSection.id)}
        className="rounded-full gap-1.5"
      >
        {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        {prevSection?.title || t('syllabus.sections.previous', 'Previous')}
      </Button>
      <Button
        variant="outline"
        disabled={!nextSection}
        onClick={() => nextSection && onNavigateSection(nextSection.id)}
        className="rounded-full gap-1.5"
      >
        {nextSection?.title || t('syllabus.sections.next', 'Next')}
        {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>
    </div>
  );

  if (locked) {
    const prereqNames = (section.prerequisites ?? [])
      .map((id) => sections.find((s) => s.id === id)?.title)
      .filter(Boolean);

    return (
      <div className="space-y-6">
        {topNavRow}
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">
              {t('syllabus.sections.locked', 'Locked')}
            </h3>
            <p className="text-muted-foreground max-w-md mb-4">
              {t('syllabus.sections.unlockRequirements', 'Complete the required sections to unlock this content.')}
            </p>
            {prereqNames.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {prereqNames.map((name, i) => (
                  <Badge key={i} variant="outline" className="rounded-full">
                    {name}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {bottomNavRow}
      </div>
    );
  }

  const dateRange = [section.start_date, section.end_date].filter(Boolean).join(' → ');

  return (
    <div className="space-y-6">
      {topNavRow}

      {/* Header */}
      <div>
        <h2 className={cn('text-2xl font-bold text-foreground mb-2', isRTL && 'text-right')}>
          {section.title}
        </h2>
        <div className={cn('flex flex-wrap items-center gap-3', isRTL && 'flex-row-reverse')}>
          {dateRange && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> {dateRange}
            </span>
          )}
          {assignments.length > 0 && (
            <Badge variant="secondary" className="rounded-full text-xs">
              <BookOpen className="h-3 w-3 me-1" /> {assignments.length} {t('syllabus.sections.linkedAssignments', 'assignments')}
            </Badge>
          )}
          {resources.length > 0 && (
            <Badge variant="secondary" className="rounded-full text-xs">
              <FileText className="h-3 w-3 me-1" /> {resources.length} {t('syllabus.detail.resources', 'resources')}
            </Badge>
          )}
        </div>
      </div>

      {/* Description */}
      {section.description && (
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-5">
            <p className={cn('text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap', isRTL && 'text-right')}>
              {section.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rich content */}
      {section.content && (
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            {t('syllabus.sections.content', 'Content')}
          </h4>
          <RichTextViewer content={section.content} />
        </div>
      )}

      {/* Objectives */}
      {section.objectives && section.objectives.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
            <Target className="h-3 w-3" /> {t('syllabus.detail.objectives', 'Objectives')}
          </h4>
          <div className="space-y-2">
            {section.objectives.map((obj, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/20">
                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                </div>
                <span className="text-sm text-foreground/80">{obj}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resources */}
      {resources.length > 0 && (
        <ResourceViewer resources={resources} isRTL={isRTL} />
      )}

      {/* Linked assignments */}
      {assignments.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> {t('syllabus.detail.linkedAssignments', 'Assignments')}
          </h4>
          {assignmentProgress && assignmentProgress.total > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{t('syllabus.progress.assignmentProgress', 'Assignment Progress')}</span>
                <span>{assignmentProgress.submitted} / {assignmentProgress.total}</span>
              </div>
              <Progress value={assignmentProgress.progressPercent} className="h-2" />
            </div>
          )}
          <div className="space-y-1.5">
            {assignments.map((a) => (
              <Link
                key={a.id}
                to={`/student/assignment/${a.id}`}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card/50',
                  'hover:bg-muted/60 transition-colors cursor-pointer text-foreground no-underline',
                  isRTL && 'flex-row-reverse'
                )}
              >
                <div className="p-1.5 rounded-md bg-muted/50">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <span className="text-sm font-medium text-foreground truncate block">{a.title}</span>
                  <span className="text-[10px] text-muted-foreground">{a.type}</span>
                </div>
                {a.due_at && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 flex-shrink-0">
                    <Calendar className="h-3 w-3" />
                    {new Date(a.due_at).toLocaleDateString()}
                  </span>
                )}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-medium flex-shrink-0',
                    isRTL && 'flex-row-reverse'
                  )}
                >
                  <ExternalLink className="h-3 w-3" />
                  {t('syllabus.resources.open')}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {bottomNavRow}
    </div>
  );
};
