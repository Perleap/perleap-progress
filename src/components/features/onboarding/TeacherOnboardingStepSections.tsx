import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TeacherOnboardingStepProps } from './teacherOnboardingTypes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type TeacherOnboardingStep1SectionProps = TeacherOnboardingStepProps & {
  avatarPreview: string;
  onAvatarChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export const TeacherOnboardingStep1Section = ({
  isRTL,
  formData,
  onFormDataChange,
  avatarPreview,
  onAvatarChange,
}: TeacherOnboardingStep1SectionProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="fullName">{t('teacherOnboarding.step1.fullName')}</Label>
        <Input
          id="fullName"
          value={formData.fullName}
          onChange={(e) => onFormDataChange({ fullName: e.target.value })}
          required
          placeholder={t('teacherOnboarding.step1.fullNamePlaceholder')}
          autoDirection
          dir={isRTL ? 'rtl' : 'ltr'}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('teacherOnboarding.step1.profilePicture')}</Label>
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            {avatarPreview ? (
              <AvatarImage src={avatarPreview} alt="Preview" />
            ) : (
              <AvatarFallback>
                {formData.fullName
                  ? formData.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                  : 'T'}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1">
            <Input
              id="avatar"
              type="file"
              accept="image/*"
              onChange={onAvatarChange}
              className="hidden"
              autoDirection
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            <Label htmlFor="avatar" className="cursor-pointer">
              <div className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md transition-colors w-fit">
                <Upload className="h-4 w-4" />
                <span className="text-sm">{t('teacherOnboarding.step1.uploadPhoto')}</span>
              </div>
            </Label>
            <p className="text-xs text-muted-foreground mt-2">
              {t('teacherOnboarding.step1.fileSize')}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">{t('teacherOnboarding.step1.phoneNumber')}</Label>
        <Input
          id="phoneNumber"
          type="tel"
          value={formData.phoneNumber}
          onChange={(e) => onFormDataChange({ phoneNumber: e.target.value })}
          placeholder={t('teacherOnboarding.step1.phoneNumberPlaceholder')}
          autoDirection
          dir={isRTL ? 'rtl' : 'ltr'}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subjects">{t('teacherOnboarding.step1.subjects')}</Label>
        <Input
          id="subjects"
          placeholder={t('teacherOnboarding.step1.subjectsPlaceholder')}
          value={formData.subjects}
          onChange={(e) => onFormDataChange({ subjects: e.target.value })}
          required
          autoDirection
          dir={isRTL ? 'rtl' : 'ltr'}
        />
        <p className="text-xs text-muted-foreground">{t('teacherOnboarding.step1.subjectsHelp')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="yearsExperience">{t('teacherOnboarding.step1.yearsExperience')}</Label>
        <Input
          id="yearsExperience"
          type="number"
          min="0"
          value={formData.yearsExperience}
          onChange={(e) => onFormDataChange({ yearsExperience: e.target.value })}
          required
          placeholder={t('teacherOnboarding.step1.yearsExperiencePlaceholder')}
          autoDirection
          dir={isRTL ? 'rtl' : 'ltr'}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="studentEducationLevel">{t('teacherOnboarding.step1.studentLevel')}</Label>
        <Input
          id="studentEducationLevel"
          placeholder={t('teacherOnboarding.step1.studentLevelPlaceholder')}
          value={formData.studentEducationLevel}
          autoDirection
          dir={isRTL ? 'rtl' : 'ltr'}
          onChange={(e) => onFormDataChange({ studentEducationLevel: e.target.value })}
        />
      </div>
    </div>
  );
};

export const TeacherOnboardingStep2Section = ({
  isRTL,
  formData,
  onFormDataChange,
}: TeacherOnboardingStepProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="teachingGoals">{t('teacherOnboarding.step2.teachingGoalsQuestion')}</Label>
        <Textarea
          id="teachingGoals"
          placeholder={t('teacherOnboarding.step2.teachingGoalsPlaceholder')}
          value={formData.teachingGoals}
          onChange={(e) => onFormDataChange({ teachingGoals: e.target.value })}
          rows={3}
          autoDirection
          dir={isRTL ? 'rtl' : 'ltr'}
        />
        <p className="text-xs text-muted-foreground">
          {t('teacherOnboarding.step2.teachingGoalsHelp')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="teachingStyle">{t('teacherOnboarding.step2.teachingStyleQuestion')}</Label>
        <Textarea
          id="teachingStyle"
          placeholder={t('teacherOnboarding.step2.teachingStylePlaceholder')}
          value={formData.teachingStyle}
          onChange={(e) => onFormDataChange({ teachingStyle: e.target.value })}
          rows={4}
          autoDirection
          dir={isRTL ? 'rtl' : 'ltr'}
        />
        <p className="text-xs text-muted-foreground">
          {t('teacherOnboarding.step2.teachingStyleHelp')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="teachingExample">
          {t('teacherOnboarding.step2.teachingExampleQuestion')}
        </Label>
        <Textarea
          id="teachingExample"
          placeholder={t('teacherOnboarding.step2.teachingExamplePlaceholder')}
          value={formData.teachingExample}
          onChange={(e) => onFormDataChange({ teachingExample: e.target.value })}
          rows={4}
          autoDirection
          dir={isRTL ? 'rtl' : 'ltr'}
        />
        <p className="text-xs text-muted-foreground">
          {t('teacherOnboarding.step2.teachingExampleHelp')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="additionalNotes">
          {t('teacherOnboarding.step2.additionalNotesQuestion')}
        </Label>
        <Textarea
          id="additionalNotes"
          placeholder={t('teacherOnboarding.step2.additionalNotesPlaceholder')}
          value={formData.additionalNotes}
          onChange={(e) => onFormDataChange({ additionalNotes: e.target.value })}
          rows={3}
          autoDirection
          dir={isRTL ? 'rtl' : 'ltr'}
        />
      </div>
    </div>
  );
};
