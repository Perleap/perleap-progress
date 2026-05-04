import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Copy, ArrowUpDown, ArrowUp, ArrowDown, Calendar, LogIn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface ClassroomTableViewProps {
  classrooms: Classroom[];
  onCopyInviteCode?: (inviteCode: string) => void;
  variant?: 'teacher' | 'student';
}

type SortField = 'name' | 'subject' | 'students';
type SortDirection = 'asc' | 'desc' | null;

export function ClassroomTableView({
  classrooms,
  onCopyInviteCode,
  variant = 'teacher',
}: ClassroomTableViewProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isStudent = variant === 'student';
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const classroomPath = (id: string) =>
    isStudent ? `/student/classroom/${id}` : `/teacher/classroom/${id}`;

  const colSpan = isStudent ? 4 : 6;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleCopyCode = async (e: React.MouseEvent, inviteCode: string) => {
    e.stopPropagation();
    try {
      await copyToClipboard(inviteCode);
      toast.success(t('teacherDashboard.success.inviteCodeCopied'));
      onCopyInviteCode?.(inviteCode);
    } catch {
      toast.error(t('common.error'));
    }
  };

  const sortedClassrooms = [...classrooms].sort((a, b) => {
    if (!sortField || !sortDirection) return 0;

    let aValue: string | number;
    let bValue: string | number;

    switch (sortField) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'subject':
        aValue = a.subject.toLowerCase();
        bValue = b.subject.toLowerCase();
        break;
      case 'students':
        aValue = a._count?.enrollments || 0;
        bValue = b._count?.enrollments || 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-4 w-4" />;
    return <ArrowDown className="h-4 w-4" />;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 border-b border-border">
            <TableHead className="min-w-[200px]">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 hover:bg-muted/50 text-foreground"
                onClick={() => handleSort('name')}
              >
                {t('common.name') || 'Name'}
                <SortIcon field="name" />
              </Button>
            </TableHead>
            <TableHead className="min-w-[150px]">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 hover:bg-muted/50 text-foreground"
                onClick={() => handleSort('subject')}
              >
                {t('common.subject') || 'Subject'}
                <SortIcon field="subject" />
              </Button>
            </TableHead>
            {!isStudent ? (
              <TableHead className="w-[120px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 hover:bg-muted/50 text-foreground"
                  onClick={() => handleSort('students')}
                >
                  <Users className="h-4 w-4" />
                  {t('common.students') || 'Students'}
                  <SortIcon field="students" />
                </Button>
              </TableHead>
            ) : null}
            <TableHead className="min-w-[180px]">
              <div className="flex items-center gap-2 text-foreground font-medium px-3 text-sm">
                <Calendar className="h-4 w-4" />
                {t('common.dates') || 'Start - End Date'}
              </div>
            </TableHead>
            {!isStudent ? (
              <TableHead className="w-[180px] text-foreground font-medium px-3 text-sm">
                {t('teacherDashboard.inviteCode') || 'Invite Code'}
              </TableHead>
            ) : null}
            <TableHead className="w-[100px] text-right text-foreground font-medium px-3 text-sm">
              {t('common.actions') || 'Actions'}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedClassrooms.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
                {t('teacherDashboard.empty.title') || 'No classrooms found'}
              </TableCell>
            </TableRow>
          ) : (
            sortedClassrooms.map((classroom) => (
              <TableRow
                key={classroom.id}
                className="cursor-pointer hover:bg-muted/20 border-b border-border transition-colors"
                onClick={() => navigate(classroomPath(classroom.id))}
              >
                <TableCell className="font-medium text-foreground">{classroom.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {classroom.subject}
                  </Badge>
                </TableCell>
                {!isStudent ? (
                  <>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {classroom._count?.enrollments || 0}
                        </span>
                      </div>
                    </TableCell>
                  </>
                ) : null}
                <TableCell>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(classroom.start_date)} - {formatDate(classroom.end_date)}
                  </div>
                </TableCell>
                {!isStudent ? (
                  <TableCell>
                    <div
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/20 cursor-pointer transition-all duration-200"
                      onClick={(e) => handleCopyCode(e, classroom.invite_code)}
                    >
                      <span className="text-sm font-mono font-semibold text-primary">
                        {classroom.invite_code}
                      </span>
                      <Copy className="h-3.5 w-3.5 text-primary" />
                    </div>
                  </TableCell>
                ) : null}
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-foreground hover:bg-muted/50 gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(classroomPath(classroom.id));
                    }}
                  >
                    {isStudent ? (
                      <>
                        <LogIn className="h-3.5 w-3.5" />
                        {t('studentDashboard.enterCourse')}
                      </>
                    ) : (
                      (t('common.view') || 'View')
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
