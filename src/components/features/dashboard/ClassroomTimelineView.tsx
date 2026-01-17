import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Copy, Calendar, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { copyToClipboard } from '@/lib/utils';
import { toast } from 'sonner';

interface Classroom {
  id: string;
  name: string;
  subject: string;
  invite_code: string;
  start_date?: string | null;
  end_date?: string | null;
  _count?: { enrollments: number };
}

interface ClassroomTimelineViewProps {
  classrooms: Classroom[];
  onCopyInviteCode?: (inviteCode: string) => void;
}

type ClassroomWithStatus = Classroom & {
  status: 'upcoming' | 'active' | 'completed';
  progress?: number;
};

export function ClassroomTimelineView({ classrooms, onCopyInviteCode }: ClassroomTimelineViewProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const categorizedClassrooms = useMemo(() => {
    const now = new Date();
    
    const withStatus: ClassroomWithStatus[] = classrooms.map((classroom) => {
      const startDate = classroom.start_date ? new Date(classroom.start_date) : null;
      const endDate = classroom.end_date ? new Date(classroom.end_date) : null;

      let status: 'upcoming' | 'active' | 'completed' = 'active';
      let progress: number | undefined;

      if (startDate && endDate) {
        if (now < startDate) {
          status = 'upcoming';
        } else if (now > endDate) {
          status = 'completed';
          progress = 100;
        } else {
          status = 'active';
          const total = endDate.getTime() - startDate.getTime();
          const elapsed = now.getTime() - startDate.getTime();
          progress = Math.round((elapsed / total) * 100);
        }
      } else if (startDate && now < startDate) {
        status = 'upcoming';
      } else if (endDate && now > endDate) {
        status = 'completed';
        progress = 100;
      }

      return { ...classroom, status, progress };
    });

    return {
      upcoming: withStatus.filter((c) => c.status === 'upcoming'),
      active: withStatus.filter((c) => c.status === 'active'),
      completed: withStatus.filter((c) => c.status === 'completed'),
    };
  }, [classrooms]);

  const handleCopyCode = async (e: React.MouseEvent, inviteCode: string) => {
    e.stopPropagation();
    try {
      await copyToClipboard(inviteCode);
      toast.success(t('teacherDashboard.inviteCodeCopied') || 'Invite code copied!');
      onCopyInviteCode?.(inviteCode);
    } catch (error) {
      toast.error(t('common.error') || 'Failed to copy');
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderClassroomCard = (classroom: ClassroomWithStatus) => (
    <Card
      key={classroom.id}
      className="group cursor-pointer border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 bg-card"
      onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors text-foreground">
                {classroom.name}
              </h3>
              <Badge
                variant="secondary"
                className={
                  classroom.status === 'active'
                    ? 'bg-success/20 text-success'
                    : classroom.status === 'upcoming'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }
              >
                {classroom.status === 'active'
                  ? t('common.active') || 'Active'
                  : classroom.status === 'upcoming'
                  ? t('common.upcoming') || 'Upcoming'
                  : t('common.completed') || 'Completed'}
              </Badge>
            </div>

            <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-primary/10 text-primary mb-3">
              {classroom.subject}
            </Badge>

            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground mb-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDate(classroom.start_date)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatDate(classroom.end_date)}</span>
              </div>
            </div>

            {classroom.progress !== undefined && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{t('common.progress') || 'Progress'}</span>
                  <span className="font-semibold text-foreground">{classroom.progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      classroom.status === 'active'
                        ? 'bg-primary'
                        : 'bg-muted-foreground/50'
                    }`}
                    style={{ width: `${classroom.progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{classroom._count?.enrollments || 0}</span>
              </div>
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/20 cursor-pointer transition-all duration-200 hover:scale-105"
                onClick={(e) => handleCopyCode(e, classroom.invite_code)}
              >
                <span className="text-xs font-mono font-semibold text-primary">{classroom.invite_code}</span>
                <Copy className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      {/* Active Classrooms */}
      {categorizedClassrooms.active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <h3 className="text-lg font-bold">{t('common.active') || 'Active'} ({categorizedClassrooms.active.length})</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categorizedClassrooms.active.map(renderClassroomCard)}
          </div>
        </div>
      )}

      {/* Upcoming Classrooms */}
      {categorizedClassrooms.upcoming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <h3 className="text-lg font-bold">{t('common.upcoming') || 'Upcoming'} ({categorizedClassrooms.upcoming.length})</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categorizedClassrooms.upcoming.map(renderClassroomCard)}
          </div>
        </div>
      )}

      {/* Completed Classrooms */}
      {categorizedClassrooms.completed.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-gray-400" />
            <h3 className="text-lg font-bold">{t('common.completed') || 'Completed'} ({categorizedClassrooms.completed.length})</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categorizedClassrooms.completed.map(renderClassroomCard)}
          </div>
        </div>
      )}

      {classrooms.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>{t('teacherDashboard.empty.title') || 'No classrooms found'}</p>
        </div>
      )}
    </div>
  );
}

