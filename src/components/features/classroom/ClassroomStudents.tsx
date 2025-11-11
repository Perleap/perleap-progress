/**
 * Classroom Students Component
 * Display enrolled students
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import type { EnrolledStudent } from '@/types';

interface ClassroomStudentsProps {
  students: EnrolledStudent[];
}

/**
 * Display list of enrolled students
 */
export const ClassroomStudents = ({ students }: ClassroomStudentsProps) => {
  const studentsWithProfiles = students.filter((s) => s.student_profiles?.full_name);

  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold mb-4">Enrolled Students</h2>
      <p className="text-sm text-muted-foreground mb-4">View and manage your students</p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Students ({studentsWithProfiles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {studentsWithProfiles.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No students enrolled yet</p>
          ) : (
            <div className="space-y-3">
              {studentsWithProfiles.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{enrollment.student_profiles?.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Joined: {new Date(enrollment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
