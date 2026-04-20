import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
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
import type {
  SyllabusStructureType,
  SyllabusPolicy,
  ReleaseMode,
  CompletionStatus,
  ProvisionBundleResourceItem,
  SyllabusStatus,
} from '@/types/syllabus';
import { runSyllabusPublishedSideEffects } from '@/lib/syllabusPublishSideEffects';
import { useProvisionSyllabusBundle } from '@/hooks/queries';

// ---------------------------------------------------------------------------
// Wizard Data Shape
// ---------------------------------------------------------------------------

export interface WizardResourceItem {
  id: string;
  type: 'link' | 'file';
  title: string;
  url: string;        // URL for links, object-URL preview for local files
  file?: File;        // present only for local file uploads
}

export interface WizardSectionData {
  tempId: string;
  title: string;
  description: string;
  /** Rich HTML; same field as SyllabusEditor */
  content: string;
  objectives: string[];
  startDate: string;
  endDate: string;
  completion_status: CompletionStatus;
  is_locked: boolean;
}

export interface WizardGradingCategory {
  tempId: string;
  name: string;
  weight: number;
}

export interface WizardData {
  // Step 1 – Course Basics
  courseTitle: string;
  startDate: string;
  endDate: string;
  /** Free-form course overview; persisted to classrooms.resources */
  courseDescription: string;
  learningOutcomes: string[];
  keyChallenges: string[];
  domains: Domain[];
  materials: CourseMaterial[];

  // Step 2 – Syllabus Setup
  includeSyllabus: boolean;
  syllabusTitle: string;
  structureType: SyllabusStructureType;
  policies: SyllabusPolicy[];
  gradingCategories: WizardGradingCategory[];
  release_mode: ReleaseMode;

  // Step 3 – Outline Builder (sections)
  sections: WizardSectionData[];
}

const DEFAULT_WIZARD_DATA: WizardData = {
  courseTitle: '',
  startDate: '',
  endDate: '',
  courseDescription: '',
  learningOutcomes: ['', '', ''],
  keyChallenges: ['', ''],
  domains: [],
  materials: [],

  includeSyllabus: true,
  syllabusTitle: '',
  structureType: 'weeks',
  policies: [],
  gradingCategories: [],
  release_mode: 'all_at_once',

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
  const provisionBundle = useProvisionSyllabusBundle();

  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>({ ...DEFAULT_WIZARD_DATA });
  const [loading, setLoading] = useState(false);

  const WIZARD_STEPS: WizardStep[] = [
    { id: 'basics', title: t('createClassroom.courseBasics', 'Course Basics') },
    { id: 'syllabus', title: t('syllabus.wizard.syllabusSetup') },
    { id: 'outline', title: t('syllabus.wizard.courseOutline') },
    { id: 'review', title: t('syllabus.wizard.reviewCreate') },
  ];

  const effectiveSteps = WIZARD_STEPS;

  const updateWizardData = useCallback((partial: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...partial }));
  }, []);

  const canProceed = (): boolean => {
    if (currentStep === 0) return wizardData.courseTitle.trim().length > 0;
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    setCurrentStep((s) => Math.min(s + 1, 3));
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
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
          start_date: wizardData.startDate || null,
          end_date: wizardData.endDate || null,
          resources: wizardData.courseDescription || '',
          learning_outcomes: wizardData.learningOutcomes.filter((o) => o.trim()),
          key_challenges: wizardData.keyChallenges.filter((c) => c.trim()),
          domains: filteredDomains,
          materials: wizardData.materials,
        })
        .select()
        .single();

      if (classroomError) throw classroomError;

      // 2. Create syllabus if opted in (single service path — matches Course Outline)
      let syllabusCreated = true;
      if (wizardData.includeSyllabus) {
        const bundleStatus: SyllabusStatus = 'published';
        try {
          const sectionResourceItems: ProvisionBundleResourceItem[][] = wizardData.sections.map(() => []);

          const provisioned = await provisionBundle.mutateAsync({
            classroom_id: classroom.id,
            title: wizardData.syllabusTitle || wizardData.courseTitle,
            summary: null,
            structure_type: wizardData.structureType,
            policies: wizardData.policies,
            status: bundleStatus,
            release_mode: wizardData.release_mode,
            sections: wizardData.sections.map((s, index) => ({
              tempId: s.tempId,
              title: s.title,
              description: s.description.trim() || null,
              order_index: index,
              start_date: s.startDate || null,
              end_date: s.endDate || null,
              objectives: s.objectives.filter((o) => o.trim()),
              resources: null,
              notes: null,
              content: s.content.trim() ? s.content : null,
              completion_status: s.completion_status,
              prerequisitesTempIds: [],
              is_locked: wizardData.release_mode === 'manual' ? s.is_locked : false,
            })),
            gradingCategories: wizardData.gradingCategories
              .filter((c) => c.name.trim())
              .map((c) => ({ name: c.name, weight: c.weight })),
            sectionResourceItems,
          });

          if (bundleStatus === 'published' && provisioned) {
            await runSyllabusPublishedSideEffects(t, {
              classroomId: classroom.id,
              syllabusId: provisioned.id,
              syllabusTitle: provisioned.title,
              sectionsCount: wizardData.sections.length,
              userId: user.id,
              wasAlreadyPublished: false,
            });
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
            currentStep={currentStep}
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

              {currentStep < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed() || loading}
                  className="rounded-full px-8 font-bold shadow-lg shadow-primary/20 gap-2"
                >
                  {t('syllabus.wizard.next')}
                  {isRTL ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </Button>
              ) : (
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
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
