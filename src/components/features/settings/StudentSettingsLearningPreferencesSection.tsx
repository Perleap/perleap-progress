import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';

export type StudentSettingsQuestionsState = {
  learning_methods: string;
  solo_vs_group: string;
  scheduled_vs_flexible: string;
  motivation_factors: string;
  help_preferences: string;
  teacher_preferences: string;
  feedback_preferences: string;
  learning_goal: string;
  special_needs: string;
  additional_notes: string;
};

export type StudentSettingsLearningPreferencesSectionProps = {
  isRTL: boolean;
  questions: StudentSettingsQuestionsState;
  onQuestionsChange: (questions: StudentSettingsQuestionsState) => void;
  saving: boolean;
  onSave: () => void | Promise<void>;
};

export function StudentSettingsLearningPreferencesSection({
  isRTL,
  questions,
  onQuestionsChange,
  saving,
  onSave,
}: StudentSettingsLearningPreferencesSectionProps) {
  const { t } = useTranslation();

  const setQuestion = <K extends keyof StudentSettingsQuestionsState>(
    key: K,
    value: StudentSettingsQuestionsState[K],
  ) => {
    onQuestionsChange({ ...questions, [key]: value });
  };

  return (
    <Card>
      <CardHeader className={isRTL ? 'text-right' : 'text-left'}>
        <CardTitle>{t('settings.learningPreferences')}</CardTitle>
        <CardDescription>{t('settings.learningPreferencesDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="space-y-2" dir={isRTL ? 'rtl' : 'ltr'}>
          <Label className={isRTL ? 'text-right' : 'text-left'}>
            {t('studentOnboarding.step1.learningMethodsQuestion')}
          </Label>
          <RadioGroup
            value={questions.learning_methods}
            onValueChange={(v) => setQuestion('learning_methods', v)}
          >
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="visual" id="edit-visual" className="mt-0.5" />
              <Label
                htmlFor="edit-visual"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                <span className="font-medium">{t('studentOnboarding.step1.visual')}</span> -{' '}
                {t('studentOnboarding.step1.visualDesc')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="auditory" id="edit-auditory" className="mt-0.5" />
              <Label
                htmlFor="edit-auditory"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                <span className="font-medium">{t('studentOnboarding.step1.auditory')}</span> -{' '}
                {t('studentOnboarding.step1.auditoryDesc')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="kinesthetic" id="edit-kinesthetic" className="mt-0.5" />
              <Label
                htmlFor="edit-kinesthetic"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                <span className="font-medium">{t('studentOnboarding.step1.kinesthetic')}</span> -{' '}
                {t('studentOnboarding.step1.kinestheticDesc')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="video" id="edit-video" className="mt-0.5" />
              <Label
                htmlFor="edit-video"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                <span className="font-medium">{t('studentOnboarding.step1.video')}</span> -{' '}
                {t('studentOnboarding.step1.videoDesc')}
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label className={isRTL ? 'text-right' : 'text-left'}>
            {t('studentOnboarding.step2.soloVsGroupQuestion')}
          </Label>
          <RadioGroup
            value={questions.solo_vs_group}
            onValueChange={(v) => setQuestion('solo_vs_group', v)}
          >
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="solo" id="edit-solo" className="mt-0.5" />
              <Label
                htmlFor="edit-solo"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                <span className="font-medium">{t('studentOnboarding.step2.solo')}</span>
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="group" id="edit-group" className="mt-0.5" />
              <Label
                htmlFor="edit-group"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                <span className="font-medium">{t('studentOnboarding.step2.group')}</span>
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="both" id="edit-both" className="mt-0.5" />
              <Label
                htmlFor="edit-both"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                <span className="font-medium">{t('studentOnboarding.step2.both')}</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label className={isRTL ? 'text-right' : 'text-left'}>
            {t('studentOnboarding.step2.scheduledVsFlexibleQuestion')}
          </Label>
          <RadioGroup
            value={questions.scheduled_vs_flexible}
            onValueChange={(v) => setQuestion('scheduled_vs_flexible', v)}
          >
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="scheduled" id="edit-scheduled" className="mt-0.5" />
              <Label
                htmlFor="edit-scheduled"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                <span className="font-medium">{t('studentOnboarding.step2.scheduled')}</span>
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="flexible" id="edit-flexible" className="mt-0.5" />
              <Label
                htmlFor="edit-flexible"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                <span className="font-medium">{t('studentOnboarding.step2.flexible')}</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label className={isRTL ? 'text-right' : 'text-left'}>
            {t('studentOnboarding.step3.motivationQuestion')}
          </Label>
          <RadioGroup
            value={questions.motivation_factors}
            onValueChange={(v) => setQuestion('motivation_factors', v)}
          >
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="curiosity" id="edit-curiosity" className="mt-0.5" />
              <Label
                htmlFor="edit-curiosity"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step3.curiosity')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="grades" id="edit-grades" className="mt-0.5" />
              <Label
                htmlFor="edit-grades"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step3.grades')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="encouragement" id="edit-encouragement" className="mt-0.5" />
              <Label
                htmlFor="edit-encouragement"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step3.encouragement')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="personal_goals" id="edit-personal_goals" className="mt-0.5" />
              <Label
                htmlFor="edit-personal_goals"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step3.personalGoals')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="competition" id="edit-competition" className="mt-0.5" />
              <Label
                htmlFor="edit-competition"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step3.competition')}
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label className={isRTL ? 'text-right' : 'text-left'}>
            {t('studentOnboarding.step4.helpQuestion')}
          </Label>
          <RadioGroup
            value={questions.help_preferences}
            onValueChange={(v) => setQuestion('help_preferences', v)}
          >
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="hints" id="edit-hints" className="mt-0.5" />
              <Label
                htmlFor="edit-hints"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step4.hints')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="different_way" id="edit-different_way" className="mt-0.5" />
              <Label
                htmlFor="edit-different_way"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step4.differentWay')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="step_by_step" id="edit-step_by_step" className="mt-0.5" />
              <Label
                htmlFor="edit-step_by_step"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step4.stepByStep')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="more_time" id="edit-more_time" className="mt-0.5" />
              <Label
                htmlFor="edit-more_time"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step4.moreTime')}
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label className={isRTL ? 'text-right' : 'text-left'}>
            {t('studentOnboarding.step4.teacherQuestion')}
          </Label>
          <RadioGroup
            value={questions.teacher_preferences}
            onValueChange={(v) => setQuestion('teacher_preferences', v)}
          >
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="patient" id="edit-patient" className="mt-0.5" />
              <Label
                htmlFor="edit-patient"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step4.patient')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="challenging" id="edit-challenging" className="mt-0.5" />
              <Label
                htmlFor="edit-challenging"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step4.challenging')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="clear" id="edit-clear" className="mt-0.5" />
              <Label
                htmlFor="edit-clear"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step4.clear')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="fun" id="edit-fun" className="mt-0.5" />
              <Label
                htmlFor="edit-fun"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step4.fun')}
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label className={isRTL ? 'text-right' : 'text-left'}>
            {t('studentOnboarding.step5.feedbackQuestion')}
          </Label>
          <RadioGroup
            value={questions.feedback_preferences}
            onValueChange={(v) => setQuestion('feedback_preferences', v)}
          >
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="immediate" id="edit-immediate" className="mt-0.5" />
              <Label
                htmlFor="edit-immediate"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step5.immediate')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="written" id="edit-written" className="mt-0.5" />
              <Label
                htmlFor="edit-written"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step5.written')}
              </Label>
            </div>
            <div
              className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <RadioGroupItem value="discussion" id="edit-discussion" className="mt-0.5" />
              <Label
                htmlFor="edit-discussion"
                className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('studentOnboarding.step5.discussion')}
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="learningGoal">{t('studentOnboarding.step5.goalQuestion')}</Label>
          <Textarea
            id="learningGoal"
            value={questions.learning_goal}
            onChange={(e) => setQuestion('learning_goal', e.target.value)}
            placeholder={
              questions.learning_goal || (t('studentOnboarding.step5.goalPlaceholder') as string)
            }
            rows={3}
            className={!questions.learning_goal ? 'text-muted-foreground' : ''}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="specialNeeds">{t('studentOnboarding.step6.specialNeedsQuestion')}</Label>
          <Textarea
            id="specialNeeds"
            value={questions.special_needs}
            onChange={(e) => setQuestion('special_needs', e.target.value)}
            placeholder={
              questions.special_needs ||
              (t('studentOnboarding.step6.specialNeedsPlaceholder') as string)
            }
            rows={3}
            className={!questions.special_needs ? 'text-muted-foreground' : ''}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="additionalNotesStudent">
            {t('studentOnboarding.step6.additionalNotesQuestion')}
          </Label>
          <Textarea
            id="additionalNotesStudent"
            value={questions.additional_notes}
            onChange={(e) => setQuestion('additional_notes', e.target.value)}
            placeholder={
              questions.additional_notes ||
              (t('studentOnboarding.step6.additionalNotesPlaceholder') as string)
            }
            rows={4}
            className={!questions.additional_notes ? 'text-muted-foreground' : ''}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>

        <div className="flex justify-center">
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2
                  className={isRTL ? 'ml-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4 animate-spin'}
                />
                {t('settings.saving')}
              </>
            ) : (
              t('settings.saveChanges')
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
