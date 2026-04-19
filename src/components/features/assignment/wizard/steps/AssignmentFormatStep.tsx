import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';
import type { AssignmentWizardFormData } from '../assignmentWizardTypes';

interface AssignmentFormatStepProps {
  formData: AssignmentWizardFormData;
  onFormChange: (updater: (prev: AssignmentWizardFormData) => AssignmentWizardFormData) => void;
  isRTL: boolean;
  dueDateDisabled?: boolean;
  attemptPolicyFrozen?: boolean;
}

export function AssignmentFormatStep({
  formData,
  onFormChange,
  isRTL,
  dueDateDisabled = false,
  attemptPolicyFrozen = false,
}: AssignmentFormatStepProps) {
  const { t } = useTranslation();

  return (
    <Card className="shadow-sm" dir={isRTL ? 'rtl' : 'ltr'}>
      <CardHeader className={cn('space-y-1 px-6 pb-0 pt-4', isRTL && 'text-right')}>
        <CardTitle className="text-heading text-base font-semibold">
          {t('createAssignment.metadata.assignmentDetailsTitle')}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-xs leading-relaxed">
          {t('createAssignment.metadata.assignmentDetailsDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-3 px-6 pb-4 pt-4">
        <div className="space-y-1.5">
          <div
            className="flex w-fit max-w-full flex-col gap-2 sm:flex-row sm:items-start sm:gap-x-2"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="grid w-full min-w-0 shrink-0 gap-1.5 sm:w-[11.5rem] sm:max-w-[11.5rem]">
              <Label
                htmlFor="wiz-type"
                className={cn('text-body font-medium block', isRTL ? 'text-right' : 'text-left')}
              >
                {t('createAssignment.metadata.assignmentType')}
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value) => onFormChange((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger
                  id="wiz-type"
                  className={cn(
                    'h-9 w-full min-w-0 rounded-lg text-sm',
                    isRTL ? 'text-right' : 'text-left',
                  )}
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  <SelectValue>
                    {formData.type
                      ? t(`createAssignment.typeOptions.${formData.type}`)
                      : t('createAssignment.metadata.assignmentType')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                  <SelectItem value="chatbot" className={isRTL ? 'text-right' : 'text-left'}>
                    {t('createAssignment.typeOptions.chatbot')}
                  </SelectItem>
                  <SelectItem value="questions" className={isRTL ? 'text-right' : 'text-left'}>
                    {t('createAssignment.typeOptions.questions')}
                  </SelectItem>
                  <SelectItem value="text_essay" className={isRTL ? 'text-right' : 'text-left'}>
                    {t('createAssignment.typeOptions.text_essay')}
                  </SelectItem>
                  <SelectItem value="test" className={isRTL ? 'text-right' : 'text-left'}>
                    {t('createAssignment.typeOptions.test')}
                  </SelectItem>
                  <SelectItem value="project" className={isRTL ? 'text-right' : 'text-left'}>
                    {t('createAssignment.typeOptions.project')}
                  </SelectItem>
                  <SelectItem value="presentation" className={isRTL ? 'text-right' : 'text-left'}>
                    {t('createAssignment.typeOptions.presentation')}
                  </SelectItem>
                  <SelectItem value="langchain" className={isRTL ? 'text-right' : 'text-left'}>
                    {t('createAssignment.typeOptions.langchain')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full min-w-0 shrink-0 gap-1.5 sm:w-[11.5rem] sm:max-w-[11.5rem]">
              <Label
                htmlFor="wiz-due"
                className={cn('text-body font-medium block', isRTL ? 'text-right' : 'text-left')}
              >
                {t('createAssignment.dueDate')}
              </Label>
              <DateTimePicker
                value={formData.due_at}
                onChange={(v) => onFormChange((prev) => ({ ...prev, due_at: v }))}
                placeholder={t('datetimePicker.placeholder')}
                className={cn('h-9 w-full rounded-lg text-sm', isRTL ? 'text-right' : 'text-left')}
                dir={isRTL ? 'rtl' : 'ltr'}
                disabled={dueDateDisabled}
              />
            </div>
          </div>
          <p
            className={cn(
              'max-w-[24rem] text-muted-foreground text-xs leading-snug',
              isRTL ? 'text-right' : 'text-left',
            )}
          >
            {attemptPolicyFrozen
              ? t('editAssignment.attemptPolicyFrozen')
              : formData.attempt_mode === 'multiple_until_due'
                ? t('createAssignment.attemptMode.dueDateHelperRetries')
                : t('createAssignment.metadata.dueDateHelper')}
          </p>
        </div>

        <div className={cn('space-y-2 max-w-[min(100%,28rem)]', isRTL ? 'text-right' : 'text-left')}>
          <Label className="text-body font-medium mb-0 block">{t('createAssignment.attemptMode.label')}</Label>
          <RadioGroup
            value={formData.attempt_mode}
            onValueChange={(v) =>
              onFormChange((prev) => ({
                ...prev,
                attempt_mode: v as Database['public']['Enums']['assignment_attempt_mode'],
              }))
            }
            className={cn('space-y-2', attemptPolicyFrozen && 'opacity-60')}
            dir={isRTL ? 'rtl' : 'ltr'}
            disabled={attemptPolicyFrozen}
          >
            <div className={cn('flex items-start gap-2.5', isRTL && 'flex-row-reverse')}>
              <RadioGroupItem value="single" id="wiz-am-single" className="shrink-0" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <label
                  htmlFor="wiz-am-single"
                  className={cn(
                    'block text-sm leading-snug font-semibold text-foreground',
                    attemptPolicyFrozen ? 'cursor-not-allowed' : 'cursor-pointer',
                  )}
                >
                  {t('createAssignment.attemptMode.single')}
                </label>
                <p className="text-muted-foreground text-xs leading-snug">
                  {t('createAssignment.attemptMode.singleHelper')}
                </p>
              </div>
            </div>
            <div className={cn('flex items-start gap-2.5', isRTL && 'flex-row-reverse')}>
              <RadioGroupItem value="multiple_until_due" id="wiz-am-until" className="shrink-0" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <label
                  htmlFor="wiz-am-until"
                  className={cn(
                    'block text-sm leading-snug font-semibold text-foreground',
                    attemptPolicyFrozen ? 'cursor-not-allowed' : 'cursor-pointer',
                  )}
                >
                  {t('createAssignment.attemptMode.multipleUntilDue')}
                </label>
                <p className="text-muted-foreground text-xs leading-snug">
                  {t('createAssignment.attemptMode.multipleUntilDueHelper')}
                </p>
              </div>
            </div>
            <div className={cn('flex items-start gap-2.5', isRTL && 'flex-row-reverse')}>
              <RadioGroupItem value="multiple_unlimited" id="wiz-am-unlim" className="shrink-0" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <label
                  htmlFor="wiz-am-unlim"
                  className={cn(
                    'block text-sm leading-snug font-semibold text-foreground',
                    attemptPolicyFrozen ? 'cursor-not-allowed' : 'cursor-pointer',
                  )}
                >
                  {t('createAssignment.attemptMode.unlimited')}
                </label>
                <p className="text-muted-foreground text-xs leading-snug">
                  {t('createAssignment.attemptMode.unlimitedHelper')}
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
}
