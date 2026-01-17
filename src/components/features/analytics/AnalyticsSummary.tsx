/**
 * Analytics Summary Component
 * Summary statistics cards
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AnalyticsSummaryProps {
  studentCount: number;
  assignmentCount: number;
  totalSubmissions: number;
  completionRate: number;
}

/**
 * Display summary statistics for classroom analytics
 */
export const AnalyticsSummary = ({
  studentCount,
  assignmentCount,
  totalSubmissions,
  completionRate,
}: AnalyticsSummaryProps) => {
  return (
    <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs md:text-sm text-muted-foreground">Total Students</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl md:text-2xl font-bold text-foreground">{studentCount}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs md:text-sm text-muted-foreground">Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl md:text-2xl font-bold text-foreground">{assignmentCount}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs md:text-sm text-muted-foreground">Total Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl md:text-2xl font-bold text-foreground">{totalSubmissions}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs md:text-sm text-muted-foreground">Completion Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl md:text-2xl font-bold text-foreground">{completionRate}%</div>
        </CardContent>
      </Card>
    </div>
  );
};
