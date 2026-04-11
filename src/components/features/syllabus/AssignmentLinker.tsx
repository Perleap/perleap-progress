import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Link2, Unlink, FileText } from 'lucide-react';
import { useLinkAssignment, useUnlinkAssignment } from '@/hooks/queries';
import { useTranslation } from 'react-i18next';
import type { SyllabusSection, GradingCategory } from '@/types/syllabus';

interface AssignmentLinkerProps {
  classroomId: string;
  sections: SyllabusSection[];
  gradingCategories: GradingCategory[];
  assignments: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    due_at: string | null;
    syllabus_section_id?: string | null;
    grading_category_id?: string | null;
  }>;
  isRTL: boolean;
}

export const AssignmentLinker = ({
  classroomId,
  sections,
  gradingCategories,
  assignments,
  isRTL,
}: AssignmentLinkerProps) => {
  const { t } = useTranslation();
  const linkMutation = useLinkAssignment();
  const unlinkMutation = useUnlinkAssignment();

  const linkedAssignments = assignments.filter((a) => a.syllabus_section_id);
  const unlinkedAssignments = assignments.filter((a) => !a.syllabus_section_id);

  const getCategoryName = (categoryId: string | null | undefined) => {
    if (!categoryId) return null;
    return gradingCategories.find((c) => c.id === categoryId)?.name || null;
  };

  const handleLink = async (assignmentId: string, sectionId: string) => {
    try {
      await linkMutation.mutateAsync({ assignmentId, sectionId, classroomId });
      toast.success(t('syllabus.assignmentLinked', 'Assignment linked to section'));
    } catch {
      toast.error(t('syllabus.linkFailed', 'Failed to link assignment'));
    }
  };

  const handleUnlink = async (assignmentId: string) => {
    try {
      await unlinkMutation.mutateAsync({ assignmentId, classroomId });
      toast.success(t('syllabus.assignmentUnlinked', 'Assignment unlinked'));
    } catch {
      toast.error(t('syllabus.unlinkFailed', 'Failed to unlink'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Unlinked Assignments */}
      <div>
        <h4 className={`font-bold text-foreground mb-3 flex items-center gap-2 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
          <FileText className="h-4 w-4 text-muted-foreground" />
          {t('syllabus.unlinkedAssignments', 'Unlinked Assignments')}
          <Badge variant="secondary" className="rounded-full text-xs">{unlinkedAssignments.length}</Badge>
        </h4>

        {unlinkedAssignments.length === 0 ? (
          <Card className="rounded-xl border-dashed border-2 border-border bg-muted/10">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">{t('syllabus.allLinked', 'All assignments are linked to sections.')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {unlinkedAssignments.map((assignment) => (
              <div key={assignment.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card shadow-sm">
                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <span className="text-sm font-medium text-foreground block truncate">{assignment.title}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="rounded-full text-[10px]">{assignment.type}</Badge>
                    <Badge variant={assignment.status === 'published' ? 'default' : 'secondary'} className="rounded-full text-[10px]">
                      {assignment.status}
                    </Badge>
                  </div>
                </div>

                {sections.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <select
                      className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handleLink(assignment.id, e.target.value);
                      }}
                    >
                      <option value="" disabled>{t('syllabus.linkToSectionShort', 'Link to section...')}</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">{t('syllabus.noSectionsToLink', 'No sections to link to')}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Assignments by Section */}
      {sections.length > 0 && (
        <div>
          <h4 className={`font-bold text-foreground mb-3 flex items-center gap-2 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
            <Link2 className="h-4 w-4 text-muted-foreground" />
            {t('syllabus.linkedAssignments', 'Linked Assignments')}
            <Badge variant="secondary" className="rounded-full text-xs">{linkedAssignments.length}</Badge>
          </h4>

          {sections.map((section) => {
            const sectionAssignments = linkedAssignments.filter((a) => a.syllabus_section_id === section.id);
            if (sectionAssignments.length === 0) return null;

            return (
              <div key={section.id} className="mb-4">
                <h5 className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {section.title}
                </h5>
                <div className="space-y-1.5">
                  {sectionAssignments.map((assignment) => {
                    const catName = getCategoryName(assignment.grading_category_id);
                    return (
                      <div key={assignment.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 group">
                        <span className={`flex-1 text-sm font-medium text-foreground truncate ${isRTL ? 'text-right' : 'text-left'}`}>
                          {assignment.title}
                        </span>
                        <Badge variant="outline" className="rounded-full text-[10px]">{assignment.type}</Badge>
                        {catName && (
                          <Badge variant="secondary" className="rounded-full text-[10px]">{catName}</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlink(assignment.id)}
                          disabled={unlinkMutation.isPending}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-7 text-xs text-muted-foreground hover:text-destructive rounded-full gap-1"
                        >
                          <Unlink className="h-3 w-3" /> {t('syllabus.unlink', 'Unlink')}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {linkedAssignments.length === 0 && (
            <Card className="rounded-xl border-dashed border-2 border-border bg-muted/10">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">{t('syllabus.noLinkedYet', 'No assignments linked to sections yet.')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
