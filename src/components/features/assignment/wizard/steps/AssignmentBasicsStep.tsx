import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExpandableTextarea } from '@/components/ui/expandable-textarea';
import type { AssignmentWizardFormData } from '../assignmentWizardTypes';

interface AssignmentBasicsStepProps {
  formData: AssignmentWizardFormData;
  onFormChange: (partial: Partial<AssignmentWizardFormData>) => void;
  isRTL: boolean;
  rephrasingInstructions: boolean;
  onRephrase: () => void;
  basicsTextareaKey: string;
}

export function AssignmentBasicsStep({
  formData,
  onFormChange,
  isRTL,
  rephrasingInstructions,
  onRephrase,
  basicsTextareaKey,
}: AssignmentBasicsStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
      <div className={`flex items-center gap-2 text-primary mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <BookOpen className="h-5 w-5" />
        <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('createClassroom.courseBasics')}
        </h3>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="wiz-title"
          className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}
        >
          {t('createAssignment.titleLabel')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="wiz-title"
          placeholder={t('createAssignment.titlePlaceholder')}
          value={formData.title}
          onChange={(e) => onFormChange({ title: e.target.value })}
          required
          className="rounded-xl h-11 focus-visible:ring-primary"
          dir={isRTL ? 'rtl' : 'ltr'}
          autoDirection
        />
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="wiz-instructions"
          className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}
        >
          {t('createAssignment.instructionsLabel')} <span className="text-destructive">*</span>
        </Label>
        <p className={`text-[11px] text-muted-foreground leading-snug ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('createAssignment.rephraseUsesModuleContext')}
        </p>
        <ExpandableTextarea
          key={basicsTextareaKey}
          id="wiz-instructions"
          placeholder={t('createAssignment.instructionsPlaceholder')}
          value={formData.instructions}
          onChange={(v) => onFormChange({ instructions: v })}
          className="min-h-[120px] resize-none focus-visible:ring-primary"
          dir={isRTL ? 'rtl' : 'ltr'}
          autoDirection
          required
          onRewrite={onRephrase}
          isRewriting={rephrasingInstructions}
        />
      </div>
    </div>
  );
}
