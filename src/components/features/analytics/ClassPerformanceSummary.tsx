/**
 * Class Performance Summary Component
 * Overall statistics and 5D dimension breakdown
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FiveDScores } from '@/types';

interface ClassPerformanceSummaryProps {
  studentCount: number;
  activeStudents: number;
  averageSubmissionsPerStudent: number;
  classAverage: FiveDScores | null;
}

/**
 * Display class performance summary with 5D scores breakdown
 */
export const ClassPerformanceSummary = ({
  studentCount,
  activeStudents,
  averageSubmissionsPerStudent,
  classAverage,
}: ClassPerformanceSummaryProps) => {
  const engagementRate = studentCount > 0 ? Math.round((activeStudents / studentCount) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base md:text-lg">Class Performance Summary</CardTitle>
        <CardDescription className="text-sm">
          Overall statistics and completion rates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs md:text-sm text-muted-foreground">Active Students</p>
              <p className="text-xl md:text-2xl font-bold">
                {activeStudents} / {studentCount}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs md:text-sm text-muted-foreground">
                Average Submissions per Student
              </p>
              <p className="text-xl md:text-2xl font-bold">{averageSubmissionsPerStudent}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs md:text-sm text-muted-foreground">Class Engagement Rate</p>
              <p className="text-xl md:text-2xl font-bold">{engagementRate}%</p>
            </div>
          </div>

          {classAverage && (
            <div className="pt-4 border-t">
              <h4 className="text-sm md:text-base font-semibold mb-3">Average 5D Scores</h4>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
                {Object.entries(classAverage).map(([dimension, score]) => (
                  <div key={dimension} className="text-center p-2 md:p-3 bg-muted rounded-lg">
                    <p className="text-[10px] md:text-xs text-muted-foreground capitalize mb-1">
                      {dimension}
                    </p>
                    <p className="text-base md:text-xl font-bold">{score.toFixed(1)}/10</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
