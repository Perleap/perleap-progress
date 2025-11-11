import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Edit, Trash2, FileText, Link as LinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  type: string;
  status: string;
  due_at: string;
  materials?: string;
  assigned_student_id: string | null;
  student_profiles?: {
    full_name: string;
  } | null;
}

interface AssignmentsListProps {
  assignments: Assignment[];
  onEdit: (assignment: Assignment) => void;
  onDelete: (assignmentId: string) => void;
}

/**
 * Assignments list component for classroom detail
 * Displays list of assignments with actions
 */
export const AssignmentsList = ({ assignments, onEdit, onDelete }: AssignmentsListProps) => {
  const { t } = useTranslation();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'default';
      case 'draft':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const parseMaterials = (materialsJson: string | undefined) => {
    if (!materialsJson) return null;
    try {
      const materials = JSON.parse(materialsJson);
      return Array.isArray(materials) && materials.length > 0 ? materials : null;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-4">
      {assignments.map((assignment) => {
        const materials = parseMaterials(assignment.materials);

        return (
          <Card key={assignment.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-lg">{assignment.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusColor(assignment.status)}>{assignment.status}</Badge>
                    <Badge variant="outline">
                      <Calendar className="h-3 w-3 me-1" />
                      {new Date(assignment.due_at).toLocaleDateString()}
                    </Badge>
                    {assignment.assigned_student_id && assignment.student_profiles && (
                      <Badge variant="secondary">
                        {t('classroomDetail.assignedTo')}: {assignment.student_profiles.full_name}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(assignment)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(assignment.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {assignment.instructions}
              </p>

              {materials && (
                <div className="pt-2 border-t mt-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {t('classroomDetail.materials')} ({materials.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {materials.map(
                      (material: { url: string; name: string; type: string }, index: number) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(material.url, '_blank')}
                          className="gap-2"
                        >
                          {material.type === 'pdf' ? (
                            <FileText className="h-3 w-3" />
                          ) : (
                            <LinkIcon className="h-3 w-3" />
                          )}
                          {material.name}
                        </Button>
                      )
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
