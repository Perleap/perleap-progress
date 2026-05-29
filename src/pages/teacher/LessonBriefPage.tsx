import { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { useClassroomAnalytics, useClassroom } from '@/hooks/queries';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { FiveDChart } from '@/components/FiveDChart';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getAllowedAssignmentIds,
  getClassroomAverage5D,
  structureTypeToLabelKey,
  scopedStudentLatestScores,
  type AnalyticsModuleFilter,
} from '@/lib/analyticsScope';
import { build5dNarrativeEvidence, type Analytics5dNarrativeRow } from '@/lib/analytics5dEvidence';
import { invokeExplainAnalytics5d, type Analytics5dNarrativeResult } from '@/services/analytics5dExplainService';
import { runPool } from '@/lib/asyncPool';
import type { FiveDScores } from '@/types/models';

type SubmissionLike = {
  student_id: string;
  assignment_id: string;
  status: string;
};

/** How many scoped assignments have at least one completed submission by this student. */
function countStudentCompletedAssignmentsInScope(
  studentId: string,
  submissions: SubmissionLike[],
  assignmentIdsInScope: string[],
): number {
  if (assignmentIdsInScope.length === 0) return 0;
  const scopeSet = new Set(assignmentIdsInScope);
  const done = new Set<string>();
  for (const s of submissions) {
    if (s.student_id !== studentId) continue;
    if (!scopeSet.has(s.assignment_id)) continue;
    if (s.status !== 'completed') continue;
    done.add(s.assignment_id);
  }
  return done.size;
}

type StudentWithNarrative = {
  id: string;
  name: string;
  completedInScope: number;
  assignmentsInScope: number;
  scores: FiveDScores | null;
  narrative: Analytics5dNarrativeResult | null;
};

export default function LessonBriefPage() {
  const { id: classroomId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL, language: uiLanguage } = useLanguage();
  const analyticsLanguage = uiLanguage === 'he' ? 'he' : 'en';

  const { data, isLoading } = useClassroomAnalytics(classroomId!);
  const { data: classroom } = useClassroom(classroomId);

  const [studentData, setStudentData] = useState<StudentWithNarrative[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedModule = (searchParams.get('analyticsModule') as AnalyticsModuleFilter) || 'all';
  const selectedAssignment = searchParams.get('analyticsAssignment') || 'all';

  const assignments = data?.assignments || [];
  const modules = data?.modules || [];

  const effectiveAssignmentIds = useMemo(
    () => getAllowedAssignmentIds(assignments, selectedModule, selectedAssignment),
    [assignments, selectedModule, selectedAssignment]
  );

  const exportFilterSummary = useMemo(() => {
    const structKey = structureTypeToLabelKey(data?.structureType ?? undefined);
    const allModulesLabel = t('analytics.allSyllabusSections', {
      sectionType: t(`syllabus.${structKey}`),
    });
    const mod =
      selectedModule === 'all'
        ? allModulesLabel
        : selectedModule === 'unplaced'
          ? t('analytics.unplacedAssignments')
          : (modules.find((m) => m.id === selectedModule)?.title ?? selectedModule);
    const asg =
      selectedAssignment === 'all'
        ? selectedModule === 'all'
          ? t('analytics.allAssignments')
          : t('analytics.allAssignmentsInScope')
        : (assignments.find((a) => a.id === selectedAssignment)?.title ?? selectedAssignment);
    return [mod, asg].join(' | ');
  }, [selectedModule, selectedAssignment, modules, assignments, data?.structureType, t]);

  const classAverage = useMemo(() => {
    if (!data || effectiveAssignmentIds.length === 0) return null;
    return getClassroomAverage5D(
      data.students as any,
      data.rawSubmissions,
      data.assignments,
      selectedModule,
      selectedAssignment,
      'all',
      data.rawSnapshots
    );
  }, [data, selectedModule, selectedAssignment, effectiveAssignmentIds]);

  useEffect(() => {
    if (!data || effectiveAssignmentIds.length === 0) return;

    let isMounted = true;

    const generateNarratives = async () => {
      setIsGenerating(true);
      
      const denom = effectiveAssignmentIds.length;
      const list = [...data.students];
      list.sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));

      const baseStudents = list.map((st) => ({
        id: st.id,
        name: st.fullName,
        completedInScope: countStudentCompletedAssignmentsInScope(
          st.id,
          st.submissions ?? [],
          effectiveAssignmentIds
        ),
        assignmentsInScope: denom,
        scores: scopedStudentLatestScores(st.snapshots, data.rawSubmissions, effectiveAssignmentIds),
        narrative: null,
      }));

      const allStudentsForEvidence = data.students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        narrativeRows: (s as { narrativeRows?: Analytics5dNarrativeRow[] }).narrativeRows ?? [],
      }));

      const sectionTitleResolver = (syllabusSectionId: string | null) => {
        if (syllabusSectionId == null) return t('analytics.unplacedAssignments');
        return modules.find((m) => m.id === syllabusSectionId)?.title ?? '—';
      };

      const results = await runPool(baseStudents, 4, async (row) => {
        if (!row.scores) return null;
        try {
          const evidence = build5dNarrativeEvidence({
            context: 'student_avg',
            allowedAssignmentIds: effectiveAssignmentIds,
            allStudents: allStudentsForEvidence,
            assignmentRefs: data.assignments,
            singleStudentId: row.id,
            sectionTitleResolver,
          });

          return await invokeExplainAnalytics5d({
            classroomId: classroomId!,
            context: 'student_avg',
            language: analyticsLanguage,
            scores: row.scores,
            filterSummary: exportFilterSummary,
            studentName: row.name,
            evidenceText: evidence.evidenceText || undefined,
            evidenceSourceCount: evidence.sourceCount,
          });
        } catch (e) {
          console.error('Failed to generate narrative for', row.name, e);
          return null;
        }
      });

      if (isMounted) {
        setStudentData(baseStudents.map((st, i) => ({ ...st, narrative: results[i] })));
        setIsGenerating(false);
      }
    };

    generateNarratives();

    return () => {
      isMounted = false;
    };
  }, [data, effectiveAssignmentIds, classroomId, analyticsLanguage, exportFilterSummary, modules, t]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    const content = document.getElementById('lesson-brief-content')?.innerHTML;
    if (!content) return;

    const html = `
<!DOCTYPE html>
<html lang="${uiLanguage}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('analytics.lessonBrief.title')} - ${classroom?.name || ''}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .break-inside-avoid { break-inside: avoid; }
    }
    body { font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 2rem; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lesson-brief-${classroomId?.slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Navigation Bar (No Print) */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border no-print">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              {t('common.print', 'Print')}
            </Button>
            <Button variant="default" size="sm" onClick={handleDownloadHtml} className="gap-2">
              <Download className="h-4 w-4" />
              {t('common.download', 'Download HTML')}
            </Button>
          </div>
        </div>
      </div>

      <div id="lesson-brief-content" className="container mx-auto px-4 py-8 max-w-6xl space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
            {t('analytics.lessonBrief.title')}
          </h1>
          <p className="text-lg text-slate-600 font-medium">
            {classroom?.name}
          </p>
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-primary/10 text-primary font-medium text-sm">
            {exportFilterSummary}
          </div>
        </div>

        {/* Class Overview */}
        {classAverage && (
          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 break-inside-avoid">
            <h2 className="text-2xl font-bold mb-6 text-slate-800 text-center">Class Overview</h2>
            <div className="max-w-md mx-auto">
              <FiveDChart scores={classAverage} showLabels={true} />
            </div>
          </section>
        )}

        {/* Loading State for Narratives */}
        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4 no-print">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-muted-foreground">{t('analytics.lessonBrief.preparingSummaries')}</p>
          </div>
        )}

        {/* Student Grid */}
        {!isGenerating && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {studentData.map((student) => (
              <Card key={student.id} className="rounded-3xl border-slate-200 shadow-sm overflow-hidden break-inside-avoid bg-white">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-slate-800">{student.name}</CardTitle>
                    <Badge variant={student.completedInScope === student.assignmentsInScope ? "default" : "secondary"} className="rounded-full px-3 py-1">
                      {student.completedInScope} / {student.assignmentsInScope} {t('common.completed', 'Completed')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {student.scores ? (
                    <>
                      <div className="h-64 w-full flex justify-center">
                        <FiveDChart scores={student.scores} showLabels={true} />
                      </div>

                      {student.narrative ? (
                        <div className="space-y-6">
                          {student.narrative.scopeSummary && (
                            <div>
                              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Summary</h4>
                              <p className="text-sm text-slate-700 leading-relaxed">{student.narrative.scopeSummary}</p>
                            </div>
                          )}

                          {student.narrative.strengths && student.narrative.strengths.length > 0 && (
                            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                              <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-2">Strengths</h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-emerald-800 ml-4 marker:text-emerald-400">
                                {student.narrative.strengths.map((s, i) => <li key={i}>{s}</li>)}
                              </ul>
                            </div>
                          )}

                          {student.narrative.weaknesses && student.narrative.weaknesses.length > 0 && (
                            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                              <h4 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-2">Areas for Growth</h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-amber-800 ml-4 marker:text-amber-400">
                                {student.narrative.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                              </ul>
                            </div>
                          )}

                          {student.narrative.nextSteps && student.narrative.nextSteps.length > 0 && (
                            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                              <h4 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-2">Next Steps</h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 ml-4 marker:text-blue-400">
                                {student.narrative.nextSteps.map((n, i) => <li key={i}>{n}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 italic text-center py-4">No narrative available.</p>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-40 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-sm text-slate-500">No evaluated work in this filter.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {/* Footer Disclaimer */}
        <div className="text-center text-xs text-slate-400 pt-8 border-t border-slate-200">
          {t('analytics.lessonBrief.footerDisclaimer')}
        </div>
      </div>
    </div>
  );
}
