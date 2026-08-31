import { BookOpen, FileText } from 'lucide-react';
import type { Classroom } from '@/types/models';
import SafeMathMarkdown from '@/components/SafeMathMarkdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCourseDuration } from '@/lib/dateUtils';

interface CourseInfoCardsProps {
  classroom: Classroom;
  isRTL: boolean;
  t: (key: string) => string;
}

export const CourseInfoCards = ({ classroom, isRTL, t }: CourseInfoCardsProps) => {
  if (!classroom.course_title && !classroom.resources) return null;

  return (
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
                <div
                  className={`text-foreground/80 space-y-1 ${isRTL ? 'text-right' : 'text-left'}`}
                >
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
  );
};
