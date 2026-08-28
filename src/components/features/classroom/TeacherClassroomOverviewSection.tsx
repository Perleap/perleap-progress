import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  BookOpen,
  Edit,
  BarChart3,
  Trash2,
  FileText,
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { formatCourseDuration } from '@/lib/dateUtils';
import { openOrDownloadMaterial } from '@/services/materialService';
import { COURSE_MATERIALS_BUCKET } from '@/utils/storageUrls';
import SafeMathMarkdown from '@/components/SafeMathMarkdown';
import { CoursePackageCard } from '@/components/features/syllabus';
import type { Classroom } from '@/types/models';

export type TeacherClassroomOverviewSectionProps = {
  classroomId: string;
  classroom: Classroom;
  isRTL: boolean;
  onEdit: () => void;
  onRequestReset: () => void;
  onRequestDelete: () => void;
  resetButtonDisabled: boolean;
};

export function TeacherClassroomOverviewSection({
  classroomId,
  classroom,
  isRTL,
  onEdit,
  onRequestReset,
  onRequestDelete,
  resetButtonDisabled,
}: TeacherClassroomOverviewSectionProps) {
  const { t } = useTranslation();
  const [expandedDomains, setExpandedDomains] = useState<Set<number>>(new Set());

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
    <div className="space-y-6">
      <h2
        className={`text-2xl md:text-3xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
      >
        {t('classroomDetail.overview.title')}
      </h2>

      <div className="flex flex-col gap-6">
        <Card
          className="w-full rounded-xl border-none shadow-sm bg-muted/30 overflow-hidden"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <CardHeader className="pb-2">
            <CardTitle className={`text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('classroomDetail.inviteCode')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 justify-start">
              <div className="bg-card/80 backdrop-blur-sm px-6 py-3 rounded-lg border border-border shadow-sm">
                <code className="text-3xl font-mono font-bold text-primary tracking-wider">
                  {classroom.invite_code}
                </code>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-card/50"
                onClick={() => {
                  navigator.clipboard.writeText(classroom.invite_code);
                  toast.success(t('classroomDetail.copiedToClipboard'));
                }}
              >
                <LinkIcon className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>
            <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('classroomDetail.shareCode')}
            </p>
          </CardContent>
        </Card>

        <CoursePackageCard classroomId={classroomId} classroomName={classroom.name} isRTL={isRTL} />

        {(classroom.course_title || classroom.resources) && (
          <div
            className={`flex flex-col gap-6 min-w-0 ${
              classroom.course_title && classroom.resources ? 'lg:flex-row lg:items-start' : ''
            }`}
          >
            {classroom.course_title && (
              <Card
                className={`min-w-0 h-fit rounded-xl border-none shadow-sm bg-card ring-1 ring-border ${
                  classroom.resources ? 'lg:flex-1' : 'w-full'
                }`}
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 bg-muted/50 rounded-xl">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                    </div>
                    {t('classroomDetail.overview.courseInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <h3
                      className={`text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t('classroomDetail.overview.courseTitle')}
                    </h3>
                    <p
                      className={`font-medium text-foreground break-words ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {classroom.course_title}
                    </p>
                  </div>

                  {formatCourseDuration(classroom.start_date, classroom.end_date) && (
                    <div>
                      <h3
                        className={`text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        {t('classroomDetail.overview.duration')}
                      </h3>
                      <p className={`font-medium text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                        {formatCourseDuration(classroom.start_date, classroom.end_date)}
                      </p>
                    </div>
                  )}

                  {(classroom.start_date || classroom.end_date) && (
                    <div>
                      <h3
                        className={`text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        {t('classroomDetail.overview.courseDates')}
                      </h3>
                      <div className={`text-foreground/80 space-y-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {classroom.start_date && (
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                            <span className="text-sm">
                              {t('common.start')}: {new Date(classroom.start_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {classroom.end_date && (
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                            <span className="text-sm">
                              {t('common.end')}: {new Date(classroom.end_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {classroom.resources && (
              <Card
                className={`min-w-0 h-fit rounded-xl border-none shadow-sm bg-card ring-1 ring-border ${
                  classroom.course_title ? 'lg:flex-1' : 'w-full'
                }`}
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 bg-muted/50 rounded-xl">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    {t('classroomDetail.overview.about')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                  <SafeMathMarkdown
                    content={classroom.resources}
                    className={`min-w-0 text-foreground/80 [overflow-wrap:anywhere] ${isRTL ? 'text-right' : 'text-left'}`}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {(classroom.learning_outcomes?.length || classroom.key_challenges?.length) ? (
          <Card
            className="w-full rounded-xl border-none shadow-sm bg-card ring-1 ring-border"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <CardContent className="p-6 grid md:grid-cols-2 gap-8">
              {classroom.learning_outcomes && classroom.learning_outcomes.length > 0 && (
                <div>
                  <h3
                    className={`flex items-center gap-2 font-bold text-lg mb-4 text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    <span className="p-1.5 bg-muted/50 rounded-lg text-muted-foreground">
                      <BarChart3 className="h-4 w-4" />
                    </span>
                    {t('classroomDetail.overview.learningOutcomes')}
                  </h3>
                  <ul className="space-y-3">
                    {classroom.learning_outcomes.map((outcome, index) => (
                      <li
                        key={index}
                        className={`flex items-start gap-3 text-foreground/80 bg-muted/30 p-3 rounded-xl ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted/50 text-muted-foreground flex items-center justify-center text-xs font-bold mt-0.5">
                          {index + 1}
                        </span>
                        <span className="text-sm leading-relaxed">{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {classroom.key_challenges && classroom.key_challenges.length > 0 && (
                <div>
                  <h3
                    className={`flex items-center gap-2 font-bold text-lg mb-4 text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    <span className="p-1.5 bg-muted/50 rounded-lg text-muted-foreground">
                      <Users className="h-4 w-4" />
                    </span>
                    {t('classroomDetail.overview.keyChallenges')}
                  </h3>
                  <ul className="space-y-3">
                    {classroom.key_challenges.map((challenge, index) => (
                      <li
                        key={index}
                        className={`flex items-start gap-3 text-foreground/80 bg-muted/30 p-3 rounded-xl ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted/50 text-muted-foreground flex items-center justify-center text-xs font-bold mt-0.5">
                          !
                        </span>
                        <span className="text-sm leading-relaxed">{challenge}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {classroom.domains && classroom.domains.length > 0 && (
        <Card className="rounded-xl border-none shadow-sm bg-card ring-1 ring-border" dir={isRTL ? 'rtl' : 'ltr'}>
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
                  <span className={`font-semibold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
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
                    <div className={`flex flex-wrap gap-2 ${isRTL ? 'justify-end' : 'justify-start'}`}>
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
      )}

      {classroom.materials && classroom.materials.length > 0 && (
        <Card className="rounded-xl border-none shadow-sm bg-card ring-1 ring-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 bg-muted/50 rounded-xl">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              {t('classroomDetail.courseMaterials')}
            </CardTitle>
            <CardDescription className={isRTL ? 'text-right' : 'text-left'}>
              {t('classroomDetail.courseMaterialsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {classroom.materials.map((material, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="justify-start h-auto py-4 px-4 rounded-lg border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                  onClick={() => void openOrDownloadMaterial(material, COURSE_MATERIALS_BUCKET)}
                >
                  <div className="p-2 bg-muted rounded-xl me-3 group-hover:bg-card transition-colors">
                    {material.type === 'pdf' ? (
                      <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    ) : (
                      <LinkIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>
                  <div className={`flex-1 overflow-hidden ${isRTL ? 'text-right' : 'text-left'}`}>
                    <span className="block font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {material.name}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">{material.type}</span>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="pt-6 border-t border-border">
        <div
          className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${isRTL ? 'sm:justify-end' : 'sm:justify-start'}`}
        >
          <Button
            type="button"
            onClick={onEdit}
            variant="outline"
            size="sm"
            className="h-9 w-full gap-1.5 rounded-full shadow-xs sm:w-auto"
          >
            <Edit className="h-4 w-4" />
            {t('classroomDetail.edit')}
          </Button>
          <Button
            type="button"
            onClick={onRequestReset}
            variant="outline"
            size="sm"
            disabled={resetButtonDisabled}
            className="h-9 w-full gap-1.5 rounded-full border-amber-500/50 text-amber-700 shadow-xs hover:bg-amber-500/10 dark:text-amber-400 sm:w-auto"
          >
            <RotateCcw className="h-4 w-4" />
            {t('classroomDetail.resetDialog.button')}
          </Button>
          <Button
            type="button"
            onClick={onRequestDelete}
            variant="destructive"
            size="sm"
            className="h-9 w-full gap-1.5 rounded-full shadow-xs sm:w-auto"
          >
            <Trash2 className="h-4 w-4" />
            {t('classroomDetail.deleteButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}
