import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

import { WizardStepIndicator, type WizardStep } from './WizardStepIndicator';
import { CourseBasicsStep } from './steps/CourseBasicsStep';
import { SyllabusSetupStep } from './steps/SyllabusSetupStep';
import { OutlineBuilderStep } from './steps/OutlineBuilderStep';
import { ReviewStep } from './steps/ReviewStep';
import type { Domain, CourseMaterial } from '@/types/models';
import type { SyllabusStructureType } from '@/types/syllabus';

// ---------------------------------------------------------------------------
// Wizard Data Shape
// ---------------------------------------------------------------------------

export interface WizardSectionData {
  tempId: string;
  title: string;
  description: string;
  objectives: string[];
  startDate: string;
  endDate: string;
  resources: string;
  notes: string;
}

export interface WizardGradingCategory {
  tempId: string;
  name: string;
  weight: number;
}

export interface WizardData {
  // Step 1 – Course Basics
  courseTitle: string;
  courseDuration: string;
  startDate: string;
  endDate: string;
  resources: string;
  learningOutcomes: string[];
  keyChallenges: string[];
  domains: Domain[];
  materials: CourseMaterial[];

  // Step 2 – Syllabus Setup
  includeSyllabus: boolean;
  syllabusTitle: string;
  syllabusSummary: string;
  structureType: SyllabusStructureType;
  gradingPolicyText: string;
  attendancePolicyText: string;
  lateWorkPolicyText: string;
  communicationPolicyText: string;
  gradingCategories: WizardGradingCategory[];

  // Step 3 – Outline Builder (sections)
  sections: WizardSectionData[];
}

const DEFAULT_WIZARD_DATA: WizardData = {
  courseTitle: '',
  courseDuration: '',
  startDate: '',
  endDate: '',
  resources: '',
  learningOutcomes: ['', '', ''],
  keyChallenges: ['', ''],
  domains: [],
  materials: [],

  includeSyllabus: true,
  syllabusTitle: '',
  syllabusSummary: '',
  structureType: 'weeks',
  gradingPolicyText: '',
  attendancePolicyText: '',
  lateWorkPolicyText: '',
  communicationPolicyText: '',
  gradingCategories: [],

  sections: [],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CreateClassroomWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (classroomId: string) => void;
}

export const CreateClassroomWizard = ({
  open,
  onOpenChange,
  onSuccess,
}: CreateClassroomWizardProps) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>({ ...DEFAULT_WIZARD_DATA });
  const [loading, setLoading] = useState(false);

  const WIZARD_STEPS: WizardStep[] = [
    { id: 'basics', title: t('createClassroom.courseBasics', 'Course Basics') },
    { id: 'syllabus', title: t('syllabus.wizard.syllabusSetup') },
    { id: 'outline', title: t('syllabus.wizard.courseOutline') },
    { id: 'review', title: t('syllabus.wizard.reviewCreate') },
  ];

  const effectiveSteps = wizardData.includeSyllabus
    ? WIZARD_STEPS
    : [WIZARD_STEPS[0], WIZARD_STEPS[1], WIZARD_STEPS[3]];

  const updateWizardData = useCallback((partial: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...partial }));
  }, []);

  const canProceed = (): boolean => {
    if (currentStep === 0) return wizardData.courseTitle.trim().length > 0;
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    if (!wizardData.includeSyllabus && currentStep === 1) {
      setCurrentStep(3);
    } else {
      setCurrentStep((s) => Math.min(s + 1, 3));
    }
  };

  const handleBack = () => {
    if (!wizardData.includeSyllabus && currentStep === 3) {
      setCurrentStep(1);
    } else {
      setCurrentStep((s) => Math.max(s - 1, 0));
    }
  };

  const resetWizard = () => {
    setCurrentStep(0);
    setWizardData({ ...DEFAULT_WIZARD_DATA });
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const filteredDomains = wizardData.domains
        .filter((d) => d.name.trim())
        .map((d) => ({
          name: d.name,
          components: d.components.filter((c) => c.trim()),
        }))
        .filter((d) => d.components.length > 0);

      // 1. Create classroom
      const { data: classroom, error: classroomError } = await supabase
        .from('classrooms')
        .insert({
          teacher_id: user.id,
          name: wizardData.courseTitle || 'New Classroom',
          subject: wizardData.courseTitle || 'General',
          course_title: wizardData.courseTitle,
          course_duration: wizardData.courseDuration,
          start_date: wizardData.startDate || null,
          end_date: wizardData.endDate || null,
          resources: wizardData.resources,
          learning_outcomes: wizardData.learningOutcomes.filter((o) => o.trim()),
          key_challenges: wizardData.keyChallenges.filter((c) => c.trim()),
          domains: filteredDomains,
          materials: wizardData.materials,
        })
        .select()
        .single();

      if (classroomError) throw classroomError;

      // 2. Create syllabus if opted in
      let syllabusCreated = true;
      if (wizardData.includeSyllabus) {
        try {
          const { data: syllabus, error: syllabusError } = await supabase
            .from('syllabi' as any)
            .insert([{
              classroom_id: classroom.id,
              title: wizardData.syllabusTitle || wizardData.courseTitle,
              summary: wizardData.syllabusSummary || null,
              structure_type: wizardData.structureType,
              grading_policy_text: wizardData.gradingPolicyText || null,
              attendance_policy_text: wizardData.attendancePolicyText || null,
              late_work_policy_text: wizardData.lateWorkPolicyText || null,
              communication_policy_text: wizardData.communicationPolicyText || null,
              status: 'draft',
            }] as any)
            .select()
            .single();

          if (syllabusError) throw syllabusError;

          // 3. Create sections
          if (wizardData.sections.length > 0) {
            const sectionRows = wizardData.sections.map((s, index) => ({
              syllabus_id: (syllabus as any).id,
              title: s.title,
              description: s.description || null,
              order_index: index,
              start_date: s.startDate || null,
              end_date: s.endDate || null,
              objectives: s.objectives.filter((o) => o.trim()),
              resources: s.resources || null,
              notes: s.notes || null,
            }));

            const { error: sectionsError } = await supabase
              .from('syllabus_sections' as any)
              .insert(sectionRows as any);

            if (sectionsError) throw sectionsError;
          }

          // 4. Create grading categories
          if (wizardData.gradingCategories.length > 0) {
            const catRows = wizardData.gradingCategories
              .filter((c) => c.name.trim())
              .map((c) => ({
                syllabus_id: (syllabus as any).id,
                name: c.name,
                weight: c.weight,
              }));

            if (catRows.length > 0) {
              const { error: catError } = await supabase
                .from('grading_categories' as any)
                .insert(catRows as any);

              if (catError) throw catError;
            }
          }
        } catch (syllabusErr) {
          console.error('Syllabus creation failed:', syllabusErr);
          syllabusCreated = false;
        }
      }

      // 5. Log activity
      try {
        await supabase.from('activity_events' as any).insert([{
          teacher_id: user.id,
          type: 'create',
          entity_type: 'classroom',
          entity_id: classroom.id,
          title: `Created classroom: ${wizardData.courseTitle || 'New Classroom'}`,
          route: `/teacher/classroom/${classroom.id}`,
        }]);
      } catch {
        // non-critical
      }

      if (syllabusCreated) {
        toast.success(t('createClassroom.success.created', 'Classroom created successfully!'));
      } else {
        toast.warning(t('syllabus.wizard.syllabusWarning'));
      }
      onOpenChange(false);
      onSuccess(classroom.id);
      resetWizard();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create classroom');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) resetWizard(); }}>
      <DialogContent
        dir={isRTL ? 'rtl' : 'ltr'}
        className="sm:max-w-6xl w-[95vw] max-h-[92vh] h-[92vh] p-0 overflow-hidden rounded-xl border-none shadow-2xl bg-background flex flex-col"
        showCloseButton
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-br from-muted/20 to-transparent flex-shrink-0">
          <h2 className={`text-2xl font-bold tracking-tight text-foreground mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('createClassroom.title', 'Create Classroom')}
          </h2>
          <WizardStepIndicator
            steps={effectiveSteps}
            currentStep={
              !wizardData.includeSyllabus && currentStep === 3
                ? 2
                : currentStep
            }
            isRTL={isRTL}
          />
        </div>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-6">
            {currentStep === 0 && (
              <CourseBasicsStep
                data={wizardData}
                onChange={updateWizardData}
                isRTL={isRTL}
              />
            )}
            {currentStep === 1 && (
              <SyllabusSetupStep
                data={wizardData}
                onChange={updateWizardData}
                isRTL={isRTL}
              />
            )}
            {currentStep === 2 && (
              <OutlineBuilderStep
                data={wizardData}
                onChange={updateWizardData}
                isRTL={isRTL}
              />
            )}
            {currentStep === 3 && (
              <ReviewStep
                data={wizardData}
                isRTL={isRTL}
              />
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex-shrink-0">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div>
              {currentStep > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={loading}
                  className="rounded-full gap-2"
                >
                  {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                  {t('syllabus.wizard.back')}
                </Button>
              )}
            </div>

            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { onOpenChange(false); resetWizard(); }}
                disabled={loading}
                className="rounded-full"
              >
                {t('syllabus.cancel')}
              </Button>

              {currentStep < 3 && !(currentStep === 1 && !wizardData.includeSyllabus) ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed() || loading}
                  className="rounded-full px-8 font-bold shadow-lg shadow-primary/20 gap-2"
                >
                  {currentStep === 1 && !wizardData.includeSyllabus ? t('syllabus.wizard.skipToReview') : t('syllabus.wizard.next')}
                  {isRTL ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </Button>
              ) : (
                <>
                  {currentStep === 1 && !wizardData.includeSyllabus && (
                    <Button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      disabled={loading}
                      className="rounded-full px-8 font-bold shadow-lg shadow-primary/20 gap-2"
                    >
                      {t('syllabus.wizard.skipToReview')}
                      {isRTL ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                    </Button>
                  )}
                  {currentStep === 3 && (
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={loading || !wizardData.courseTitle.trim()}
                      className="rounded-full px-10 font-bold shadow-lg shadow-primary/20"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin me-2" />
                          {t('syllabus.creating')}
                        </>
                      ) : (
                        t('syllabus.wizard.createClassroom')
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
