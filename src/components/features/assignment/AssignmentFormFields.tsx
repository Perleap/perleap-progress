import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from 'react-i18next';

interface AssignmentFormFieldsProps {
  formData: {
    title: string;
    instructions: string;
    type: string;
    due_at: string;
    materials?: string;
  };
  onChange: (field: string, value: string) => void;
}

/**
 * Assignment form basic fields component
 * Reusable form fields for creating/editing assignments
 */
export const AssignmentFormFields = ({ formData, onChange }: AssignmentFormFieldsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">{t('createAssignment.form.title')}</Label>
        <Input
          id="title"
          placeholder={t('createAssignment.form.titlePlaceholder')}
          value={formData.title}
          onChange={(e) => onChange('title', e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="instructions">{t('createAssignment.form.instructions')}</Label>
        <Textarea
          id="instructions"
          placeholder={t('createAssignment.form.instructionsPlaceholder')}
          value={formData.instructions}
          onChange={(e) => onChange('instructions', e.target.value)}
          rows={4}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">{t('createAssignment.form.type')}</Label>
        <Input
          id="type"
          placeholder={t('createAssignment.form.typePlaceholder')}
          value={formData.type}
          onChange={(e) => onChange('type', e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="due_at">{t('createAssignment.form.dueDate')}</Label>
        <Input
          id="due_at"
          type="datetime-local"
          value={formData.due_at}
          onChange={(e) => onChange('due_at', e.target.value)}
          required
        />
      </div>
    </>
  );
};
