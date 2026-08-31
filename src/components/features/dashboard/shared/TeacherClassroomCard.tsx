import { Calendar, Copy, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ClassroomWithEnrollmentCount } from '@/types/api.types';
import { Card, CardContent } from '@/components/ui/card';
import { formatClassroomDate, type ClassroomViewMode } from '@/lib/classroomViewMode';

export type TeacherClassroomCardProps = {
  classroom: ClassroomWithEnrollmentCount;
  variant: Exclude<ClassroomViewMode, 'table' | 'timeline'>;
  onNavigate: () => void;
  onCopyInviteCode: (e: React.MouseEvent, inviteCode: string) => void;
};

const InviteCodeButton = ({
  inviteCode,
  onCopy,
  size = 'default',
}: {
  inviteCode: string;
  onCopy: (e: React.MouseEvent) => void;
  size?: 'default' | 'compact' | 'list';
}) => {
  const sizeClasses =
    size === 'compact'
      ? 'gap-1 px-2 py-1 text-xs'
      : size === 'list'
        ? 'gap-2 px-3 py-2 text-sm'
        : 'gap-2 px-3 py-1.5 text-xs';

  return (
    <div
      className={`flex items-center rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/20 cursor-pointer transition-all duration-200 hover:scale-105 ${sizeClasses} ${
        size !== 'list' ? 'w-full justify-center' : ''
      }`}
      onClick={onCopy}
    >
      <span className="font-mono font-semibold text-primary">{inviteCode}</span>
      <Copy className={size === 'compact' ? 'h-3 w-3 text-primary' : 'h-4 w-4 text-primary'} />
    </div>
  );
};

export const TeacherClassroomCard = ({
  classroom,
  variant,
  onNavigate,
  onCopyInviteCode,
}: TeacherClassroomCardProps) => {
  const { t } = useTranslation();
  const unavailable = t('classroomList.dateUnavailable');
  const enrollmentCount = classroom._count?.enrollments || 0;
  const copyHandler = (e: React.MouseEvent) => onCopyInviteCode(e, classroom.invite_code);

  if (variant === 'grid') {
    return (
      <Card
        className="group relative overflow-hidden cursor-pointer hover:border-primary/30 transition-all duration-200 active:scale-[0.98] bg-card border-border"
        onClick={onNavigate}
      >
        <CardContent className="p-4 relative">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base mb-2 truncate group-hover:text-primary transition-colors text-foreground">
                {classroom.name}
              </h3>
            </div>
          </div>
          <div className="space-y-2 pt-3 border-t border-border">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="font-medium">{enrollmentCount} students</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatClassroomDate(classroom.start_date, { unavailable })}</span>
              </div>
            </div>
            <InviteCodeButton inviteCode={classroom.invite_code} onCopy={copyHandler} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'compact') {
    return (
      <Card
        className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
        onClick={onNavigate}
      >
        <CardContent className="p-3">
          <div className="mb-2">
            <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors text-foreground">
              {classroom.name}
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{enrollmentCount}</span>
              <span className="mx-1">•</span>
              <Calendar className="h-3 w-3" />
              <span>{formatClassroomDate(classroom.start_date, { unavailable })}</span>
            </div>
            <InviteCodeButton
              inviteCode={classroom.invite_code}
              onCopy={copyHandler}
              size="compact"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'list') {
    return (
      <Card
        className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
        onClick={onNavigate}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors mb-2 text-foreground">
                {classroom.name}
              </h3>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {enrollmentCount} {t('common.students')}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatClassroomDate(classroom.start_date, {
                    format: 'long',
                    unavailable,
                  })}{' '}
                  - {formatClassroomDate(classroom.end_date, { format: 'long', unavailable })}
                </span>
              </div>
            </div>
            <InviteCodeButton inviteCode={classroom.invite_code} onCopy={copyHandler} size="list" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
      onClick={onNavigate}
    >
      <CardContent className="p-5">
        <div className="mb-4">
          <h3 className="font-bold text-lg mb-2 truncate group-hover:text-primary transition-colors text-foreground">
            {classroom.name}
          </h3>
        </div>
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Students</p>
                <p className="font-bold text-foreground">{enrollmentCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-semibold text-xs text-foreground">
                  {formatClassroomDate(classroom.start_date, { unavailable })} -{' '}
                  {formatClassroomDate(classroom.end_date, { unavailable })}
                </p>
              </div>
            </div>
          </div>
          <InviteCodeButton inviteCode={classroom.invite_code} onCopy={copyHandler} />
        </div>
      </CardContent>
    </Card>
  );
};
