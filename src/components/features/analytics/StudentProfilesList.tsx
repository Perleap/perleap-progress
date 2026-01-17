/**
 * Student Profiles List Component
 * Display individual student 5D profiles
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FiveDChart } from '@/components/FiveDChart';
import type { StudentAnalytics } from '@/types';

interface StudentProfilesListProps {
  students: StudentAnalytics[];
}

/**
 * Display list of student 5D profiles
 */
export const StudentProfilesList = ({ students }: StudentProfilesListProps) => {
  const studentsWithScores = students.filter((s) => s.latestScores);

  if (studentsWithScores.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base md:text-lg text-foreground">Student Profiles</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Individual student progress and feedback analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground py-8">
            No student progress data yet. Students will appear here after completing assignments.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base md:text-lg text-foreground">Student Profiles</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Individual student progress and feedback analytics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {studentsWithScores.map((student) => (
            <Card key={student.id} className="bg-card border-border">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <CardTitle className="text-base md:text-lg text-foreground">{student.fullName}</CardTitle>
                  <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                    {student.feedbackCount} submissions
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {student.latestScores && <FiveDChart scores={student.latestScores} />}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
