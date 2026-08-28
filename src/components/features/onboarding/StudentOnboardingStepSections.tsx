import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { StudentOnboardingStepProps } from './studentOnboardingTypes';

type StudentOnboardingStep1Props = StudentOnboardingStepProps & {
  avatarPreview: string;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function StudentOnboardingStep1Section({
  isRTL,
  formData,
  onFormDataChange,
  avatarPreview,
  onAvatarChange,
}: StudentOnboardingStep1Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">{t('studentOnboarding.step1.fullName')}</Label>
        <Input
          id="fullName"
          value={formData.fullName}
          onChange={(e) => onFormDataChange({ fullName: e.target.value })}
          required
          autoDirection
          dir={isRTL ? 'rtl' : 'ltr'}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('studentOnboarding.step1.profilePicture')}</Label>
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
                  : 'S'}
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
                <span className="text-sm">{t('studentOnboarding.step1.uploadPhoto')}</span>
              </div>
            </Label>
            <p className="text-xs text-muted-foreground mt-2">
              {t('studentOnboarding.step1.fileSize')}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-4 mt-6">
        <Label>{t('studentOnboarding.step1.learningMethodsQuestion')}</Label>
        <RadioGroup
          value={formData.learningMethods}
          onValueChange={(v) => onFormDataChange({ learningMethods: v })}
        >
          <div
            className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
            onClick={() => onFormDataChange({ learningMethods: 'visual' })}
          >
            <RadioGroupItem value="visual" id="visual" className="mt-1" />
            <Label htmlFor="visual" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
              <span className="font-medium">{t('studentOnboarding.step1.visual')}</span> -{' '}
              {t('studentOnboarding.step1.visualDesc')}
            </Label>
          </div>
          <div
            className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
            onClick={() => onFormDataChange({ learningMethods: 'auditory' })}
          >
            <RadioGroupItem value="auditory" id="auditory" className="mt-1" />
            <Label htmlFor="auditory" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
              <span className="font-medium">{t('studentOnboarding.step1.auditory')}</span> -{' '}
              {t('studentOnboarding.step1.auditoryDesc')}
            </Label>
          </div>
          <div
            className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
            onClick={() => onFormDataChange({ learningMethods: 'kinesthetic' })}
          >
            <RadioGroupItem value="kinesthetic" id="kinesthetic" className="mt-1" />
            <Label
              htmlFor="kinesthetic"
              className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}
            >
              <span className="font-medium">{t('studentOnboarding.step1.kinesthetic')}</span>{' '}
              - {t('studentOnboarding.step1.kinestheticDesc')}
            </Label>
          </div>
          <div
            className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
            onClick={() => onFormDataChange({ learningMethods: 'video' })}
          >
            <RadioGroupItem value="video" id="video" className="mt-1" />
            <Label htmlFor="video" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
              <span className="font-medium">{t('studentOnboarding.step1.video')}</span> -{' '}
              {t('studentOnboarding.step1.videoDesc')}
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}

export function StudentOnboardingStep2Section({ isRTL, formData, onFormDataChange }: StudentOnboardingStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <Label>{t('studentOnboarding.step2.soloVsGroupQuestion')}</Label>
      <RadioGroup
        value={formData.soloVsGroup}
        onValueChange={(v) => onFormDataChange({ soloVsGroup: v })}
      >
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ soloVsGroup: 'solo' })}
        >
          <RadioGroupItem value="solo" id="solo" className="mt-1" />
          <Label htmlFor="solo" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
            <span className="font-medium">{t('studentOnboarding.step2.solo')}</span> -{' '}
            {t('studentOnboarding.step2.soloDesc')}
          </Label>
        </div>
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ soloVsGroup: 'group' })}
        >
          <RadioGroupItem value="group" id="group" className="mt-1" />
          <Label htmlFor="group" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
            <span className="font-medium">{t('studentOnboarding.step2.group')}</span> -{' '}
            {t('studentOnboarding.step2.groupDesc')}
          </Label>
        </div>
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ soloVsGroup: 'both' })}
        >
          <RadioGroupItem value="both" id="both" className="mt-1" />
          <Label htmlFor="both" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
            <span className="font-medium">{t('studentOnboarding.step2.both')}</span> -{' '}
            {t('studentOnboarding.step2.bothDesc')}
          </Label>
        </div>
      </RadioGroup>

      <div className="mt-6">
        <Label>{t('studentOnboarding.step2.scheduledVsFlexibleQuestion')}</Label>
        <RadioGroup
          value={formData.scheduledVsFlexible}
          onValueChange={(v) => onFormDataChange({ scheduledVsFlexible: v })}
          className="mt-4"
        >
          <div
            className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
            onClick={() => onFormDataChange({ scheduledVsFlexible: 'scheduled' })}
          >
            <RadioGroupItem value="scheduled" id="scheduled" className="mt-1" />
            <Label htmlFor="scheduled" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
              <span className="font-medium">{t('studentOnboarding.step2.scheduled')}</span> -{' '}
              {t('studentOnboarding.step2.scheduledDesc')}
            </Label>
          </div>
          <div
            className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
            onClick={() => onFormDataChange({ scheduledVsFlexible: 'flexible' })}
          >
            <RadioGroupItem value="flexible" id="flexible" className="mt-1" />
            <Label htmlFor="flexible" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
              <span className="font-medium">{t('studentOnboarding.step2.flexible')}</span> -{' '}
              {t('studentOnboarding.step2.flexibleDesc')}
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}

export function StudentOnboardingStep3Section({ isRTL, formData, onFormDataChange }: StudentOnboardingStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <Label>{t('studentOnboarding.step3.motivationQuestion')}</Label>
      <RadioGroup
        value={formData.motivationFactors}
        onValueChange={(v) => onFormDataChange({ motivationFactors: v })}
      >
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ motivationFactors: 'curiosity' })}
        >
          <RadioGroupItem value="curiosity" id="curiosity" className="mt-1" />
          <Label htmlFor="curiosity" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
            <span className="font-medium">{t('studentOnboarding.step3.curiosity')}</span> -{' '}
            {t('studentOnboarding.step3.curiosityDesc')}
          </Label>
        </div>
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ motivationFactors: 'grades' })}
        >
          <RadioGroupItem value="grades" id="grades" className="mt-1" />
          <Label htmlFor="grades" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
            <span className="font-medium">{t('studentOnboarding.step3.grades')}</span> -{' '}
            {t('studentOnboarding.step3.gradesDesc')}
          </Label>
        </div>
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ motivationFactors: 'encouragement' })}
        >
          <RadioGroupItem value="encouragement" id="encouragement" className="mt-1" />
          <Label
            htmlFor="encouragement"
            className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}
          >
            <span className="font-medium">{t('studentOnboarding.step3.encouragement')}</span>{' '}
            - {t('studentOnboarding.step3.encouragementDesc')}
          </Label>
        </div>
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ motivationFactors: 'personal_goals' })}
        >
          <RadioGroupItem value="personal_goals" id="personal_goals" className="mt-1" />
          <Label
            htmlFor="personal_goals"
            className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}
          >
            <span className="font-medium">{t('studentOnboarding.step3.personalGoals')}</span>{' '}
            - {t('studentOnboarding.step3.personalGoalsDesc')}
          </Label>
        </div>
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ motivationFactors: 'competition' })}
        >
          <RadioGroupItem value="competition" id="competition" className="mt-1" />
          <Label htmlFor="competition" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
            <span className="font-medium">{t('studentOnboarding.step3.competition')}</span> -{' '}
            {t('studentOnboarding.step3.competitionDesc')}
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}

export function StudentOnboardingStep4Section({ isRTL, formData, onFormDataChange }: StudentOnboardingStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <Label>{t('studentOnboarding.step4.helpQuestion')}</Label>
      <RadioGroup
        value={formData.helpPreferences}
        onValueChange={(v) => onFormDataChange({ helpPreferences: v })}
      >
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ helpPreferences: 'hints' })}
        >
          <RadioGroupItem value="hints" id="hints" className="mt-1" />
          <Label htmlFor="hints" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('studentOnboarding.step4.hints')}
          </Label>
        </div>
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ helpPreferences: 'different_way' })}
        >
          <RadioGroupItem value="different_way" id="different_way" className="mt-1" />
          <Label
            htmlFor="different_way"
            className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {t('studentOnboarding.step4.differentWay')}
          </Label>
        </div>
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ helpPreferences: 'step_by_step' })}
        >
          <RadioGroupItem value="step_by_step" id="step_by_step" className="mt-1" />
          <Label
            htmlFor="step_by_step"
            className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {t('studentOnboarding.step4.stepByStep')}
          </Label>
        </div>
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ helpPreferences: 'more_time' })}
        >
          <RadioGroupItem value="more_time" id="more_time" className="mt-1" />
          <Label htmlFor="more_time" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('studentOnboarding.step4.moreTime')}
          </Label>
        </div>
      </RadioGroup>

      <div className="mt-6">
        <Label>{t('studentOnboarding.step4.teacherQuestion')}</Label>
        <RadioGroup
          value={formData.teacherPreferences}
          onValueChange={(v) => onFormDataChange({ teacherPreferences: v })}
          className="mt-4"
        >
          <div
            className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
            onClick={() => onFormDataChange({ teacherPreferences: 'patient' })}
          >
            <RadioGroupItem value="patient" id="patient" className="mt-1" />
            <Label htmlFor="patient" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('studentOnboarding.step4.patient')}
            </Label>
          </div>
          <div
            className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
            onClick={() => onFormDataChange({ teacherPreferences: 'challenging' })}
          >
            <RadioGroupItem value="challenging" id="challenging" className="mt-1" />
            <Label
              htmlFor="challenging"
              className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}
            >
              {t('studentOnboarding.step4.challenging')}
            </Label>
          </div>
          <div
            className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
            onClick={() => onFormDataChange({ teacherPreferences: 'clear' })}
          >
            <RadioGroupItem value="clear" id="clear" className="mt-1" />
            <Label htmlFor="clear" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('studentOnboarding.step4.clear')}
            </Label>
          </div>
          <div
            className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
            onClick={() => onFormDataChange({ teacherPreferences: 'fun' })}
          >
            <RadioGroupItem value="fun" id="fun" className="mt-1" />
            <Label htmlFor="fun" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('studentOnboarding.step4.fun')}
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}

export function StudentOnboardingStep5Section({ isRTL, formData, onFormDataChange }: StudentOnboardingStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <Label>{t('studentOnboarding.step5.feedbackQuestion')}</Label>
      <RadioGroup
        value={formData.feedbackPreferences}
        onValueChange={(v) => onFormDataChange({ feedbackPreferences: v })}
      >
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ feedbackPreferences: 'immediate' })}
        >
          <RadioGroupItem value="immediate" id="immediate" className="mt-1" />
          <Label htmlFor="immediate" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('studentOnboarding.step5.immediate')}
          </Label>
        </div>
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ feedbackPreferences: 'written' })}
        >
          <RadioGroupItem value="written" id="written" className="mt-1" />
          <Label htmlFor="written" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('studentOnboarding.step5.written')}
          </Label>
        </div>
        <div
          className={`flex items-start gap-2 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}
          onClick={() => onFormDataChange({ feedbackPreferences: 'discussion' })}
        >
          <RadioGroupItem value="discussion" id="discussion" className="mt-1" />
          <Label htmlFor="discussion" className={`cursor-pointer font-normal leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('studentOnboarding.step5.discussion')}
          </Label>
        </div>
      </RadioGroup>

      <div className="space-y-2 mt-6">
        <Label htmlFor="learningGoal">{t('studentOnboarding.step5.goalQuestion')}</Label>
        <Textarea
          id="learningGoal"
          placeholder={t('studentOnboarding.step5.goalPlaceholder')}
          value={formData.learningGoal}
          onChange={(e) => onFormDataChange({ learningGoal: e.target.value })}
          rows={3}
          autoDirection
          dir={isRTL ? 'rtl' : 'ltr'}
        />
      </div>
    </div>
  );
}

export function StudentOnboardingStep6Section({ isRTL, formData, onFormDataChange }: StudentOnboardingStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="specialNeeds">
          {t('studentOnboarding.step6.specialNeedsQuestion')}
        </Label>
        <Textarea
          id="specialNeeds"
          placeholder={t('studentOnboarding.step6.specialNeedsPlaceholder')}
          value={formData.specialNeeds}
          onChange={(e) => onFormDataChange({ specialNeeds: e.target.value })}
          rows={3}
          autoDirection
          dir={isRTL ? 'rtl' : 'ltr'}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="additionalNotes">
          {t('studentOnboarding.step6.additionalNotesQuestion')}
        </Label>
        <Textarea
          id="additionalNotes"
          placeholder={t('studentOnboarding.step6.additionalNotesPlaceholder')}
          value={formData.additionalNotes}
          onChange={(e) => onFormDataChange({ additionalNotes: e.target.value })}
          rows={4}
          autoDirection
          dir={isRTL ? 'rtl' : 'ltr'}
        />
      </div>
    </div>
  );
}
