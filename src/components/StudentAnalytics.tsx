import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { FiveDChart } from './FiveDChart';
import { LoadingSpinner } from './common/LoadingSpinner';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { FiveDScores, FiveDSnapshot } from '@/types/models';
import { selectBestSubmissionIdForAggregate } from '@/lib/bestSubmission';

interface StudentAnalyticsProps {
  studentId: string;
  classroomId: string;
  currentSubmissionId?: string;
}

interface SubmissionInfo {
  id: string;
  title: string;
  submitted_at: string;
}

export function StudentAnalytics({
  studentId,
  classroomId,
  currentSubmissionId,
}: StudentAnalyticsProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'average' | 'perSubmission'>('perSubmission');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(currentSubmissionId || '');
  const [submissions, setSubmissions] = useState<SubmissionInfo[]>([]);
  const [averageScores, setAverageScores] = useState<Pick<
    FiveDSnapshot,
    'scores' | 'score_explanations'
  > | null>(null);
  const [perSubmissionScores, setPerSubmissionScores] = useState<Pick<
    FiveDSnapshot,
    'scores' | 'score_explanations'
  > | null>(null);

  useEffect(() => {
    fetchData();
  }, [studentId, classroomId]);

  useEffect(() => {
    if (viewMode === 'perSubmission' && selectedSubmissionId) {
      fetchPerSubmissionData();
    }
  }, [selectedSubmissionId, viewMode]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: assignmentsData } = await supabase
        .from('assignments')
        .select('id')
        .eq('classroom_id', classroomId);

      if (!assignmentsData?.length) {
        setLoading(false);
        return;
      }

      const submissionsData = await supabase
        .from('submissions')
        .select('id, submitted_at, assignment_id, status, attempt_number, assignments(title)')
        .eq('student_id', studentId)
        .in(
          'assignment_id',
          assignmentsData.map((a) => a.id)
        )
        .order('submitted_at', { ascending: false });

      if (submissionsData.data) {
        const rows = submissionsData.data;
        const submissionsList = rows.map((sub) => ({
          id: sub.id,
          title: (sub.assignments as any)?.title || 'Unknown Assignment',
          submitted_at: sub.submitted_at || new Date().toISOString(),
        }));
        setSubmissions(submissionsList);

        if (submissionsList.length && !selectedSubmissionId) {
          setSelectedSubmissionId(currentSubmissionId || submissionsList[0].id);
        }

        const submissionIds = rows.map((s) => s.id);
        const { data: snapshotsData } = await supabase
          .from('five_d_snapshots')
          .select('submission_id, scores, score_explanations')
          .eq('user_id', studentId)
          .in('submission_id', submissionIds);

        const snapBySub = new Map(
          (snapshotsData ?? []).map((s) => [s.submission_id, s]),
        );

        const byAssignment = new Map<string, typeof rows>();
        for (const s of rows) {
          const list = byAssignment.get(s.assignment_id) || [];
          list.push(s);
          byAssignment.set(s.assignment_id, list);
        }

        const bestForAverage: NonNullable<typeof snapshotsData> = [];
        for (const [, attempts] of byAssignment) {
          const map = new Map<string, { scores: unknown }>();
          for (const a of attempts) {
            const sn = snapBySub.get(a.id);
            if (sn) map.set(a.id, { scores: sn.scores });
          }
          const bestId = selectBestSubmissionIdForAggregate(
            attempts.map((a) => ({
              id: a.id,
              attempt_number: a.attempt_number ?? 1,
              status: a.status as 'in_progress' | 'completed',
              submitted_at: a.submitted_at || null,
            })),
            map,
          );
          if (bestId && snapBySub.has(bestId)) {
            bestForAverage.push(snapBySub.get(bestId)!);
          }
        }

        if (bestForAverage.length) {
          const totals: FiveDScores = {
            vision: 0,
            values: 0,
            thinking: 0,
            connection: 0,
            action: 0,
          };

          bestForAverage.forEach((snapshot) => {
            const scores = snapshot.scores as FiveDScores;
            (Object.keys(totals) as Array<keyof FiveDScores>).forEach((key) => {
              totals[key] += scores[key] || 0;
            });
          });

          const avgScores = (Object.keys(totals) as Array<keyof FiveDScores>).reduce(
            (acc, key) => ({
              ...acc,
              [key]: totals[key] / bestForAverage.length,
            }),
            {} as FiveDScores
          );

          setAverageScores({
            scores: avgScores,
            score_explanations: null,
          });
        }
      }
    } catch (error) {
      toast.error(t('analytics.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchPerSubmissionData = async () => {
    if (!selectedSubmissionId) return;

    try {
      const { data } = await supabase
        .from('five_d_snapshots')
        .select('scores, score_explanations')
        .eq('user_id', studentId)
        .eq('submission_id', selectedSubmissionId)
        .maybeSingle();

      setPerSubmissionScores(
        data
          ? {
            scores: data.scores as FiveDScores,
            score_explanations: data.score_explanations as any,
          }
          : null
      );
    } catch {
      toast.error(t('analytics.scoresError'));
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (submissions.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{t('studentAnalytics.title')}</CardTitle>
          <CardDescription className="text-muted-foreground">{t('studentAnalytics.noSubmissions')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{t('studentAnalytics.title')}</CardTitle>
        <CardDescription className="text-muted-foreground">
          {submissions.length === 1
            ? t('studentAnalytics.developmentAcross', { count: submissions.length })
            : t('studentAnalytics.developmentAcrossPlural', { count: submissions.length })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'average' | 'perSubmission')}>
          <TabsList className="grid w-full grid-cols-2 bg-muted/30">
            <TabsTrigger value="perSubmission" className="text-foreground data-[state=active]:bg-card">{t('studentAnalytics.perSubmission')}</TabsTrigger>
            <TabsTrigger value="average" className="text-foreground data-[state=active]:bg-card">{t('studentAnalytics.allSubmissionsAverage')}</TabsTrigger>
          </TabsList>

          <TabsContent value="perSubmission" className="mt-6">
            {perSubmissionScores ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">{t('studentAnalytics.scoresFromSubmission')}</div>
                <FiveDChart
                  scores={perSubmissionScores.scores}
                  explanations={perSubmissionScores.score_explanations}
                />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No score data available for this submission
              </div>
            )}
          </TabsContent>

          <TabsContent value="average" className="mt-6">
            {averageScores ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Average across all {submissions.length} submission
                  {submissions.length !== 1 ? 's' : ''} in this classroom
                </div>
                <FiveDChart scores={averageScores.scores} explanations={null} />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No score data available</div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
