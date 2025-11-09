/**
 * Classroom Assignments Component
 * Display and manage assignments
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, BookOpen } from 'lucide-react';
import { EmptyState } from '@/components/common';
import type { Assignment } from '@/types';

interface ClassroomAssignmentsProps {
  assignments: Assignment[];
  onCreateAssignment: () => void;
  onEditAssignment: (assignment: Assignment) => void;
  onDeleteAssignment: (assignmentId: string) => void;
}

/**
 * Display list of assignments with edit and delete actions
 */
export const ClassroomAssignments = ({
  assignments,
  onCreateAssignment,
  onEditAssignment,
  onDeleteAssignment,
}: ClassroomAssignmentsProps) => {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Assignments</h2>
          <p className="text-sm text-muted-foreground">Create and manage assignments</p>
        </div>
        <Button onClick={onCreateAssignment} size="sm" className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Create Assignment
        </Button>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No assignments yet"
          description="Create your first assignment to get started"
          action={{
            label: 'Create Assignment',
            onClick: onCreateAssignment,
          }}
        />
      ) : (
        <div className="grid gap-4">
          {assignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{assignment.title}</CardTitle>
                    <CardDescription className="mt-2">
                      Type: {assignment.type.replace('_', ' ')} •
                      {assignment.due_at &&
                        ` Due: ${new Date(assignment.due_at).toLocaleString()}`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={assignment.status === 'published' ? 'default' : 'secondary'}>
                      {assignment.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditAssignment(assignment)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDeleteAssignment(assignment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {assignment.instructions}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

