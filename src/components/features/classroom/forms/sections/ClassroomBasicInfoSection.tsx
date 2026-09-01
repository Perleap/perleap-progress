import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ClassroomFormSectionProps } from '../classroomFormTypes';
import { DatePicker } from '@/components/ui/date-picker';
import { ExpandableTextarea } from '@/components/ui/expandable-textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { rephraseCourseDescription } from '@/services/classroomService';

type ClassroomBasicInfoSectionProps = ClassroomFormSectionProps & {
  descriptionFieldKey?: string;
};

export const ClassroomBasicInfoSection = ({
  formData,
  onFormChange,
  descriptionFieldKey = 'classroom-description',
}: ClassroomBasicInfoSectionProps) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [rephrasingCourseDescription, setRephrasingCourseDescription] = useState(false);

  const handleRephraseCourseDescription = async () => {
    if (!formData.courseDescription.trim()) {
      toast.error(t('createClassroom.rephraseError'));
      return;
    }
    setRephrasingCourseDescription(true);
    try {
      const rephrasedText = await rephraseCourseDescription(
        formData.courseDescription,
        isRTL ? 'he' : 'en'
      );
      onFormChange({ courseDescription: rephrasedText });
      toast.success(t('createClassroom.rephraseSuccess'));
    } catch (e) {
      console.error(e);
      toast.error(t('createClassroom.rephraseError'));
    } finally {
      setRephrasingCourseDescription(false);
    }
  };

  return (
    <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
      <div
        className={`flex items-center gap-2 text-primary mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}
      >
        <BookOpen className="h-5 w-5" />
        <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('createClassroom.courseBasics')}
        </h3>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="courseTitle"
          className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}
        >
          {t('createClassroom.courseTitle')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="courseTitle"
          value={formData.courseTitle}
          onChange={(e) => onFormChange({ courseTitle: e.target.value })}
          required
          className="rounded-xl h-11 focus-visible:ring-primary"
          placeholder={t('createClassroom.courseTitlePlaceholder')}
          autoDirection
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label
            htmlFor="startDate"
            className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {t('createClassroom.startDate')}
          </Label>
          <DatePicker
            value={formData.startDate}
            onChange={(v) => onFormChange({ startDate: v })}
            placeholder={t('createClassroom.startDate')}
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="endDate"
            className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {t('createClassroom.endDate')}
          </Label>
          <DatePicker
            value={formData.endDate}
            onChange={(v) => onFormChange({ endDate: v })}
            placeholder={t('createClassroom.endDate')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="courseDescription"
          className={cn('text-body font-medium block', isRTL ? 'text-right' : 'text-left')}
        >
          {t('createClassroom.courseDescription')}
        </Label>
        <ExpandableTextarea
          key={descriptionFieldKey}
          id="courseDescription"
          placeholder={t('createClassroom.courseDescriptionPlaceholder')}
          value={formData.courseDescription}
          onChange={(v) => onFormChange({ courseDescription: v })}
          className="min-h-[120px] resize-y focus-visible:ring-primary bg-muted/30"
          dir={isRTL ? 'rtl' : 'ltr'}
          autoDirection
          onRewrite={() => void handleRephraseCourseDescription()}
          isRewriting={rephrasingCourseDescription}
        />
      </div>
    </div>
  );
};
