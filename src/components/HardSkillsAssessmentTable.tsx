import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, BookOpen, Target, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HardSkillAssessment, HardSkillAssessmentWithStudent } from '@/types/hard-skills';

interface HardSkillsAssessmentTableProps {
  submissionId?: string;
  assignmentId?: string;
  classroomId?: string;
  studentId?: string;
  title?: string;
  description?: string;
  initialData?: HardSkillAssessmentWithStudent[];
}

export function HardSkillsAssessmentTable({
  submissionId,
  assignmentId,
  classroomId,
  studentId,
  title,
  description,
  initialData,
}: HardSkillsAssessmentTableProps) {
  const { t } = useTranslation();

  // Use translation defaults if title/description not provided
  const displayTitle = title || t('cra.title');
  const displayDescription = description || t('cra.description');
  const [assessments, setAssessments] = useState<HardSkillAssessmentWithStudent[]>(initialData || []);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (initialData) {
      setAssessments(initialData);
      setLoading(false);
      return;
    }
    fetchAssessments();
  }, [submissionId, assignmentId, classroomId, studentId, initialData]);

  const fetchAssessments = async () => {
    setLoading(true);
    try {
      let data: HardSkillAssessmentWithStudent[] = [];

      // Filter based on provided props
      if (submissionId) {
        // Single submission
        const { data: assessmentData, error } = await supabase
          .from('hard_skill_assessments')
          .select('*')
          .eq('submission_id', submissionId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = assessmentData || [];
      } else if (studentId && assignmentId === 'all' && classroomId) {
        // Student selected + All Assignments - get all submissions for this student, then their assessments
        const { data: submissions } = await supabase
          .from('submissions')
          .select('id, assignment_id')
          .eq('student_id', studentId);

        if (submissions && submissions.length > 0) {
          // Filter submissions by classroom
          const { data: assignments } = await supabase
            .from('assignments')
            .select('id')
            .eq('classroom_id', classroomId);

          const classroomAssignmentIds = assignments?.map((a) => a.id) || [];
          const validSubmissionIds = submissions
            .filter((s) => classroomAssignmentIds.includes(s.assignment_id))
            .map((s) => s.id);

          if (validSubmissionIds.length > 0) {
            const { data: assessmentData, error } = await supabase
              .from('hard_skill_assessments')
              .select('*')
              .in('submission_id', validSubmissionIds)
              .order('created_at', { ascending: false });

            if (error) throw error;
            data = assessmentData || [];
          }
        }
      } else if (studentId && assignmentId && assignmentId !== 'all') {
        // Student selected + Specific Assignment
        const { data: assessmentData, error } = await supabase
          .from('hard_skill_assessments')
          .select('*')
          .eq('student_id', studentId)
          .eq('assignment_id', assignmentId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = assessmentData || [];
      } else if (assignmentId && assignmentId !== 'all' && classroomId) {
        // All students + Specific Assignment - get all assessments for an assignment
        const { data: assessmentData, error } = await supabase
          .from('hard_skill_assessments')
          .select('*')
          .eq('assignment_id', assignmentId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = assessmentData || [];
      } else {
        // No valid filter provided
        setAssessments([]);
        setLoading(false);
        return;
      }

      // Fetch student names separately for aggregate view
      if (data && data.length > 0 && !submissionId) {
        const studentIds = [...new Set(data.map((a) => a.student_id))];
        const { data: profiles } = await supabase
          .from('student_profiles')
          .select('user_id, full_name')
          .in('user_id', studentIds);

        const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);

        const assessmentsWithNames = data.map((assessment) => ({
          ...assessment,
          student_profiles: { full_name: profileMap.get(assessment.student_id) || 'Unknown' },
        }));

        setAssessments(assessmentsWithNames as any);
      } else {
        setAssessments((data as any) || []);
      }
    } catch (error) {
      console.error('Error fetching hard skill assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{displayTitle}</CardTitle>
          <CardDescription>{displayDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (assessments.length === 0) {
    return null; // Don't show anything if there are no assessments
  }

  const getPerformanceColor = (percent: number) => {
    if (percent >= 80) return 'text-green-600 dark:text-green-400';
    if (percent >= 60) return 'text-blue-600 dark:text-blue-400';
    if (percent >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  const getPerformanceBadge = (percent: number) => {
    if (percent >= 80) return { label: t('cra.performance.advanced'), variant: 'default' as const };
    if (percent >= 60)
      return { label: t('cra.performance.intermediate'), variant: 'secondary' as const };
    if (percent >= 40)
      return { label: t('cra.performance.developing'), variant: 'outline' as const };
    return { label: t('cra.performance.beginner'), variant: 'outline' as const };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {displayTitle}
        </CardTitle>
        <CardDescription>{displayDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {assessments.map((assessment) => {
          const perfBadge = getPerformanceBadge(assessment.current_level_percent);

          return (
            <div
              key={assessment.id}
              className="rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Header Section */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold">{assessment.domain}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {assessment.skill_component}
                    </Badge>
                  </div>
                  {!submissionId && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>{assessment.student_profiles?.full_name || t('cra.unknown')}</span>
                    </div>
                  )}
                </div>

                {/* Performance Badge and Score */}
                <div className="flex items-center gap-3">
                  <Badge variant={perfBadge.variant} className="text-xs px-3 py-1">
                    {perfBadge.label}
                  </Badge>
                  <div
                    className={`text-3xl font-bold ${getPerformanceColor(assessment.current_level_percent)}`}
                  >
                    {assessment.current_level_percent}%
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-5">
                <Progress value={assessment.current_level_percent} className="h-2" />
              </div>

              {/* Description */}
              <div className="bg-muted/30 rounded-lg p-4 mb-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {assessment.proficiency_description}
                </p>
              </div>

              {/* Actionable Challenges */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Target className="h-4 w-4 text-primary" />
                  <span>{t('cra.nextSteps')}</span>
                </div>
                <div className="pl-6 border-l-2 border-primary/20">
                  <p className="text-sm leading-relaxed">{assessment.actionable_challenge}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
