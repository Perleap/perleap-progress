import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { distinctDomains } from '@/lib/hardSkillsFormat';
import type { AssignmentWizardFormData, AssignmentWizardStepId } from '../assignmentWizardTypes';
import type { TestQuestionDraft } from '@/components/features/assignment/TestQuestionBuilder';
import type { SyllabusWithSections } from '@/types/syllabus';

interface AssignmentReviewStepProps {
  formData: AssignmentWizardFormData;
  syllabus: SyllabusWithSections | null | undefined;
  syllabusSectionId: string;
  testQuestions: TestQuestionDraft[];
  onJumpToStep: (id: AssignmentWizardStepId) => void;
  isRTL: boolean;
}

function ReviewField({
  label,
  value,
  isRTL,
}: {
  label: string;
  value: string;
  isRTL: boolean;
}) {
  return (
    <div
      className={cn(
        'grid gap-1 border-b border-border/60 pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(7.5rem,32%)_1fr] sm:items-start sm:gap-x-6',
        isRTL && 'sm:[direction:ltr]',
      )}
    >
      <dt
        className={cn(
          'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
          isRTL ? 'sm:text-end' : 'sm:text-start',
        )}
      >
        {label}
      </dt>
      <dd
        className={cn('text-sm leading-relaxed text-foreground break-words', isRTL ? 'text-right sm:text-end' : 'text-left sm:text-start')}
        dir="auto"
      >
        {value || '—'}
      </dd>
    </div>
  );
}

export function AssignmentReviewStep({
  formData,
  syllabus,
  syllabusSectionId,
  testQuestions,
  onJumpToStep,
  isRTL,
}: AssignmentReviewStepProps) {
  const { t } = useTranslation();

  const sectionTitle =
    syllabus?.sections?.find((s) => s.id === syllabusSectionId)?.title ||
    (syllabusSectionId ? syllabusSectionId : '—');

  const instructionPreview = (() => {
    const s = formData.instructions?.trim();
    if (!s) return '—';
    if (s.length <= 200) return s;
    return `${s.slice(0, 200)}…`;
  })();

  const attemptLabel =
    formData.attempt_mode === 'multiple_until_due'
      ? t('createAssignment.attemptMode.multipleUntilDue')
      : formData.attempt_mode === 'multiple_unlimited'
        ? t('createAssignment.attemptMode.unlimited')
        : t('createAssignment.attemptMode.single');

  type SectionDef = {
    step: AssignmentWizardStepId;
    title: string;
    rows: { label: string; value: string }[];
  };

  const sections: SectionDef[] = [
    {
      step: 'basics',
      title: t('createAssignment.wizard.steps.basics'),
      rows: [
        { label: t('createAssignment.titleLabel'), value: formData.title || '' },
        { label: t('createAssignment.instructionsLabel'), value: instructionPreview },
      ],
    },
    {
      step: 'format',
      title: t('createAssignment.wizard.steps.format'),
      rows: [
        {
          label: t('createAssignment.metadata.assignmentType'),
          value: formData.type ? t(`createAssignment.typeOptions.${formData.type}`) : '',
        },
        {
          label: t('createAssignment.dueDate'),
          value: formData.due_at?.trim() || t('createAssignment.wizard.reviewNone'),
        },
        { label: t('createAssignment.attemptMode.label'), value: attemptLabel },
      ],
    },
    {
      step: 'courseRelease',
      title: t('createAssignment.wizard.steps.courseRelease'),
      rows: [
        { label: t('createAssignment.metadata.assignmentDetailsTitle'), value: sectionTitle },
        {
          label: t('createAssignment.metadata.publicationStatus'),
          value:
            formData.status === 'draft' ? t('assignments.status.draft') : t('assignments.status.published'),
        },
        {
          label: t('createAssignment.metadata.aiFeedback'),
          value: formData.auto_publish_ai_feedback ? t('common.yes') : t('common.no'),
        },
      ],
    },
    {
      step: 'skills',
      title: t('createAssignment.wizard.steps.skills'),
      rows: [
        {
          label: t('createAssignment.subjectAreaLabel'),
          value: (() => {
            const doms = distinctDomains(formData.hard_skills);
            if (doms.length > 1) return doms.join(', ');
            if (doms.length === 1) return doms[0]!;
            return formData.hard_skill_domain?.trim() || '';
          })(),
        },
        {
          label: t('createAssignment.skillsToAssess'),
          value:
            formData.hard_skills.filter((p) => p.skill.trim()).length > 0
              ? formData.hard_skills
                  .filter((p) => p.skill.trim())
                  .map((p) => (p.domain.trim() ? `${p.domain} — ${p.skill}` : p.skill))
                  .join('; ')
              : '',
        },
        {
          label: t('createAssignment.assignmentMaterials'),
          value: t('createAssignment.wizard.materialCount', { count: formData.materials.length }),
        },
      ],
    },
  ];

  if (formData.type === 'test') {
    sections.push({
      step: 'test',
      title: t('createAssignment.wizard.steps.test'),
      rows: [
        {
          label: t('createAssignment.typeOptions.test'),
          value: t('createAssignment.wizard.questionCount', { count: testQuestions.length }),
        },
      ],
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-2" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={cn('space-y-1', isRTL ? 'text-right' : 'text-left')}>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{t('createAssignment.wizard.reviewTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('createAssignment.wizard.reviewSubtitle')}</p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <section
            key={section.step}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            <div
              className={cn(
                'flex items-center gap-3 border-b border-border bg-muted/25 px-4 py-3',
                isRTL ? 'flex-row-reverse justify-between' : 'justify-between',
              )}
            >
              <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn('h-8 gap-1.5 text-primary hover:text-primary', isRTL && 'flex-row-reverse')}
                onClick={() => onJumpToStep(section.step)}
              >
                <Pencil className="h-3.5 w-3.5 opacity-80" />
                {t('createAssignment.wizard.editSection')}
              </Button>
            </div>
            <div className="space-y-3 px-4 py-4">
              {section.rows.map((row) => (
                <ReviewField key={`${section.step}-${row.label}`} label={row.label} value={row.value} isRTL={isRTL} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
