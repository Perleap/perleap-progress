import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AssignmentWizardFormData } from '../assignmentWizardTypes';

interface AssignmentReleaseStepProps {
  formData: AssignmentWizardFormData;
  onFormChange: (updater: (prev: AssignmentWizardFormData) => AssignmentWizardFormData) => void;
  isRTL: boolean;
}

export function AssignmentReleaseStep({ formData, onFormChange, isRTL }: AssignmentReleaseStepProps) {
  const { t } = useTranslation();

  return (
    <Card className="shadow-sm" dir={isRTL ? 'rtl' : 'ltr'}>
      <CardHeader className={cn('space-y-1 px-6 pb-0 pt-4', isRTL && 'text-right')}>
        <CardTitle className="text-heading text-base font-semibold">
          {t('createAssignment.metadata.releaseSettingsTitle')}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-xs leading-relaxed">
          {t('createAssignment.metadata.releaseSettingsDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-3 px-6 pb-4 pt-4">
        <div className="space-y-1.5">
          <div
            className="grid w-full min-w-0 shrink-0 gap-1.5 sm:w-[11.5rem] sm:max-w-[11.5rem]"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <Label
              htmlFor="wiz_publication_status"
              className={cn('text-body font-medium block', isRTL ? 'text-right' : 'text-left')}
            >
              {t('createAssignment.metadata.publicationStatus')}
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value) => {
                if (value === 'draft' || value === 'published') {
                  onFormChange((prev) => ({ ...prev, status: value }));
                }
              }}
            >
              <SelectTrigger
                id="wiz_publication_status"
                className={cn(
                  'h-9 w-full min-w-0 rounded-lg text-sm',
                  isRTL ? 'text-right' : 'text-left',
                )}
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                <SelectValue>
                  {formData.status === 'draft'
                    ? t('assignments.status.draft')
                    : t('assignments.status.published')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                <SelectItem value="draft" className={isRTL ? 'text-right' : 'text-left'}>
                  {t('assignments.status.draft')}
                </SelectItem>
                <SelectItem value="published" className={isRTL ? 'text-right' : 'text-left'}>
                  {t('assignments.status.published')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p
            className={cn(
              'max-w-[24rem] text-muted-foreground text-xs leading-snug',
              isRTL ? 'text-right' : 'text-left',
            )}
          >
            {t('createAssignment.metadata.publicationStatusHelper')}
          </p>
        </div>

        <div className="space-y-1 pt-0.5">
          <div
            className="grid w-full min-w-0 shrink-0 gap-1.5 sm:w-[11.5rem] sm:max-w-[11.5rem]"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <Label
              htmlFor="wiz_ai_feedback_select"
              className={cn('text-body font-medium block', isRTL ? 'text-right' : 'text-left')}
            >
              {t('createAssignment.metadata.aiFeedback')}
            </Label>
            <Select
              value={formData.auto_publish_ai_feedback ? 'yes' : 'no'}
              onValueChange={(value) =>
                onFormChange((prev) => ({
                  ...prev,
                  auto_publish_ai_feedback: value === 'yes',
                }))
              }
            >
              <SelectTrigger
                id="wiz_ai_feedback_select"
                className={cn(
                  'h-9 w-full min-w-0 rounded-lg text-sm',
                  isRTL ? 'text-right' : 'text-left',
                )}
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                <SelectValue>
                  {formData.auto_publish_ai_feedback ? t('common.yes') : t('common.no')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                <SelectItem value="yes" className={isRTL ? 'text-right' : 'text-left'}>
                  {t('common.yes')}
                </SelectItem>
                <SelectItem value="no" className={isRTL ? 'text-right' : 'text-left'}>
                  {t('common.no')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p
            className={cn(
              'text-muted-foreground text-xs leading-relaxed',
              isRTL ? 'text-right' : 'text-left',
            )}
          >
            {t('createAssignment.metadata.aiFeedbackHelper')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
