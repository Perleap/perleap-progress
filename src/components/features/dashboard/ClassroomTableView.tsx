import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Copy, ArrowUpDown, ArrowUp, ArrowDown, Calendar } from 'lucide-react';
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
}

type SortField = 'name' | 'subject' | 'students';
type SortDirection = 'asc' | 'desc' | null;

export function ClassroomTableView({ classrooms, onCopyInviteCode }: ClassroomTableViewProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
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
      toast.success(t('teacherDashboard.inviteCodeCopied') || 'Invite code copied!');
      onCopyInviteCode?.(inviteCode);
    } catch (error) {
      toast.error(t('common.error') || 'Failed to copy');
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
    return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="min-w-[200px]">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 hover:bg-muted/80"
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
                className="h-8 gap-2 hover:bg-muted/80"
                onClick={() => handleSort('subject')}
              >
                {t('common.subject') || 'Subject'}
                <SortIcon field="subject" />
              </Button>
            </TableHead>
            <TableHead className="w-[120px]">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 hover:bg-muted/80"
                onClick={() => handleSort('students')}
              >
                <Users className="h-4 w-4" />
                {t('common.students') || 'Students'}
                <SortIcon field="students" />
              </Button>
            </TableHead>
            <TableHead className="min-w-[180px]">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t('common.dates') || 'Start - End Date'}
              </div>
            </TableHead>
            <TableHead className="w-[180px]">{t('teacherDashboard.inviteCode') || 'Invite Code'}</TableHead>
            <TableHead className="w-[100px] text-right">{t('common.actions') || 'Actions'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedClassrooms.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                {t('teacherDashboard.empty.title') || 'No classrooms found'}
              </TableCell>
            </TableRow>
          ) : (
            sortedClassrooms.map((classroom) => (
              <TableRow
                key={classroom.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}
              >
                <TableCell className="font-medium">{classroom.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {classroom.subject}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{classroom._count?.enrollments || 0}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(classroom.start_date)} - {formatDate(classroom.end_date)}
                  </div>
                </TableCell>
                <TableCell>
                  <div
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-primary/5 border border-primary/20 hover:bg-primary/10 hover:border-primary/30 cursor-pointer transition-all duration-200"
                    onClick={(e) => handleCopyCode(e, classroom.invite_code)}
                  >
                    <span className="text-sm font-mono font-semibold text-primary">{classroom.invite_code}</span>
                    <Copy className="h-3.5 w-3.5 text-primary" />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/teacher/classroom/${classroom.id}`);
                    }}
                  >
                    {t('common.view') || 'View'}
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

