import { Calendar, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { StudentEnrolledClassroom } from '@/components/features/dashboard/shared/classroomCardProps';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SecureAvatarImage } from '@/components/ui/SecureAvatarImage';
import type { ClassroomViewMode } from '@/lib/classroomViewMode';
import { formatClassroomDate } from '@/lib/classroomViewMode';
import { TEACHER_AVATARS_BUCKET } from '@/utils/storageUrls';

export type StudentClassroomCardProps = {
  classroom: StudentEnrolledClassroom;
  variant: Exclude<ClassroomViewMode, 'table' | 'timeline'>;
  onNavigate: () => void;
  onWarm?: () => void;
};

function TeacherAvatarRow({
  teacher,
}: {
  teacher: NonNullable<StudentEnrolledClassroom['teacher_profiles']>;
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Avatar className="h-6 w-6 border border-background">
        {teacher.avatar_url && (
          <SecureAvatarImage src={teacher.avatar_url} bucket={TEACHER_AVATARS_BUCKET} alt="" />
        )}
        <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
          {(teacher.full_name || 'T').charAt(0)}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{teacher.full_name}</span>
    </div>
  );
}

export function StudentClassroomCard({
  classroom,
  variant,
  onNavigate,
  onWarm,
}: StudentClassroomCardProps) {
  const { t } = useTranslation();
  const unavailable = t('classroomList.dateUnavailable');
  const handlers = {
    onMouseEnter: onWarm,
    onPointerDown: onWarm,
    onClick: onNavigate,
  };

  if (variant === 'grid') {
    return (
      <Card
        className="group relative overflow-hidden cursor-pointer hover:border-primary/30 transition-all duration-200 active:scale-[0.98] bg-card border-border"
        {...handlers}
      >
        <CardContent className="p-4 relative">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base mb-2 truncate group-hover:text-primary transition-colors text-foreground">
                {classroom.name}
              </h3>
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                {classroom.subject}
              </Badge>
            </div>
          </div>
          <div className="space-y-2 pt-3 border-t border-border">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                <span>{t('studentDashboard.activeCourse')}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatClassroomDate(classroom.start_date, { unavailable })}</span>
              </div>
            </div>
            {classroom.teacher_profiles && <TeacherAvatarRow teacher={classroom.teacher_profiles} />}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'compact') {
    return (
      <Card
        className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
        {...handlers}
      >
        <CardContent className="p-3">
          <div className="mb-2">
            <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors text-foreground">
              {classroom.name}
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Active</span>
              <span className="mx-1">•</span>
              <Calendar className="h-3 w-3" />
              <span>{formatClassroomDate(classroom.start_date, { unavailable })}</span>
            </div>
            {classroom.teacher_profiles && (
              <div className="flex items-center gap-1.5 pt-1">
                <Avatar className="h-4 w-4">
                  {classroom.teacher_profiles.avatar_url && (
                    <SecureAvatarImage
                      src={classroom.teacher_profiles.avatar_url}
                      bucket={TEACHER_AVATARS_BUCKET}
                      alt=""
                    />
                  )}
                  <AvatarFallback className="text-[8px] bg-primary/5 text-primary">
                    {(classroom.teacher_profiles.full_name || 'T').charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[10px] text-muted-foreground truncate">
                  {classroom.teacher_profiles.full_name}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'list') {
    return (
      <Card
        className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
        {...handlers}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors mb-2 text-foreground">
                {classroom.name}
              </h3>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary" className="bg-muted text-muted-foreground h-5 text-[10px]">
                  {classroom.subject}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatClassroomDate(classroom.start_date, { format: 'long', unavailable })} -{' '}
                  {formatClassroomDate(classroom.end_date, { format: 'long', unavailable })}
                </span>
                {classroom.teacher_profiles && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Avatar className="h-4 w-4">
                      {classroom.teacher_profiles.avatar_url && (
                        <SecureAvatarImage
                          src={classroom.teacher_profiles.avatar_url}
                          bucket={TEACHER_AVATARS_BUCKET}
                          alt=""
                        />
                      )}
                      <AvatarFallback className="text-[8px] bg-primary/5 text-primary">
                        {(classroom.teacher_profiles.full_name || 'T').charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {classroom.teacher_profiles.full_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
      {...handlers}
    >
      <CardContent className="p-5">
        <div className="mb-4">
          <h3 className="font-bold text-lg mb-2 truncate group-hover:text-primary transition-colors text-foreground">
            {classroom.name}
          </h3>
          <Badge variant="secondary" className="bg-muted text-muted-foreground">
            {classroom.subject}
          </Badge>
        </div>
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-bold text-sm text-foreground">Active</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dates</p>
                <p className="font-semibold text-[10px] text-foreground">
                  {formatClassroomDate(classroom.start_date, { unavailable })} -{' '}
                  {formatClassroomDate(classroom.end_date, { unavailable })}
                </p>
              </div>
            </div>
          </div>
          {classroom.teacher_profiles && (
            <div className="flex items-center gap-3 pt-2">
              <Avatar className="h-8 w-8">
                {classroom.teacher_profiles.avatar_url && (
                  <SecureAvatarImage
                    src={classroom.teacher_profiles.avatar_url}
                    bucket={TEACHER_AVATARS_BUCKET}
                    alt=""
                  />
                )}
                <AvatarFallback className="bg-primary/5 text-primary">
                  {(classroom.teacher_profiles.full_name || 'T').charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-[10px] text-muted-foreground">Teacher</p>
                <p className="text-xs font-medium text-foreground">
                  {classroom.teacher_profiles.full_name}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
