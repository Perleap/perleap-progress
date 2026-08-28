import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

export type TeacherSettingsQuestionsState = {
  teaching_goals: string;
  style_notes: string;
  teaching_examples: string;
  sample_explanation: string;
};

export type TeacherSettingsTeachingPreferencesSectionProps = {
  isRTL: boolean;
  questions: TeacherSettingsQuestionsState;
  onQuestionsChange: (questions: TeacherSettingsQuestionsState) => void;
  saving: boolean;
  onSave: () => void | Promise<void>;
};

export function TeacherSettingsTeachingPreferencesSection({
  isRTL,
  questions,
  onQuestionsChange,
  saving,
  onSave,
}: TeacherSettingsTeachingPreferencesSectionProps) {
  const { t } = useTranslation();

  const setQuestion = <K extends keyof TeacherSettingsQuestionsState>(
    key: K,
    value: TeacherSettingsQuestionsState[K],
  ) => {
    onQuestionsChange({ ...questions, [key]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.teachingPreferences')}</CardTitle>
        <CardDescription>{t('settings.teachingPreferencesDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="teachingGoals">{t('settings.teachingGoalsQuestion')}</Label>
          <Textarea
            id="teachingGoals"
            value={questions.teaching_goals}
            onChange={(e) => setQuestion('teaching_goals', e.target.value)}
            placeholder={questions.teaching_goals || 'Brief description (1-2 sentences)'}
            rows={3}
            className={!questions.teaching_goals ? 'text-muted-foreground' : ''}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="teachingStyle">{t('settings.teachingStyleQuestion')}</Label>
          <Textarea
            id="teachingStyle"
            value={questions.style_notes}
            onChange={(e) => setQuestion('style_notes', e.target.value)}
            placeholder={
              questions.style_notes || 'How would you describe your approach to teaching?'
            }
            rows={4}
            className={!questions.style_notes ? 'text-muted-foreground' : ''}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <p className="text-xs text-muted-foreground">{t('settings.teachingStyleHelp')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="teachingExample">{t('settings.teachingExampleQuestion')}</Label>
          <Textarea
            id="teachingExample"
            value={questions.teaching_examples}
            onChange={(e) => setQuestion('teaching_examples', e.target.value)}
            placeholder={
              questions.teaching_examples ||
              'How do you explain a concept or give feedback to students?'
            }
            rows={4}
            className={!questions.teaching_examples ? 'text-muted-foreground' : ''}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <p className="text-xs text-muted-foreground">{t('settings.teachingExampleHelp')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="additionalNotes">{t('settings.additionalNotesQuestion')}</Label>
          <Textarea
            id="additionalNotes"
            value={questions.sample_explanation}
            onChange={(e) => setQuestion('sample_explanation', e.target.value)}
            placeholder={
              questions.sample_explanation ||
              'Any specific preferences or additional context...'
            }
            rows={3}
            className={!questions.sample_explanation ? 'text-muted-foreground' : ''}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>

        <Button onClick={() => void onSave()} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('settings.saving')}
            </>
          ) : (
            t('settings.save')
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
