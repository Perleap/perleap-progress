import { FileText, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ClassroomFormSectionProps } from '../classroomFormTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';

export const ClassroomOutcomesSection = ({ formData, onFormChange }: ClassroomFormSectionProps) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const handleOutcomeChange = (index: number, value: string) => {
    const learningOutcomes = [...formData.learningOutcomes];
    learningOutcomes[index] = value;
    onFormChange({ learningOutcomes });
  };

  const addOutcome = () => {
    onFormChange({ learningOutcomes: [...formData.learningOutcomes, ''] });
  };

  const handleChallengeChange = (index: number, value: string) => {
    const keyChallenges = [...formData.keyChallenges];
    keyChallenges[index] = value;
    onFormChange({ keyChallenges });
  };

  const addChallenge = () => {
    onFormChange({ keyChallenges: [...formData.keyChallenges, ''] });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-4 p-6 rounded-xl border border-border shadow-sm">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Label
            className={`text-foreground font-bold text-heading flex items-center gap-2 ${isRTL ? 'text-right flex-row-reverse' : 'text-left'}`}
          >
            <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {t('createClassroom.learningOutcomes')}
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addOutcome}
            className="text-primary hover:bg-primary/5 h-8 text-xs font-bold"
          >
            <Plus className="h-3 w-3 me-1" /> {t('createClassroom.add')}
          </Button>
        </div>
        <div className="space-y-3">
          {formData.learningOutcomes.map((outcome, index) => (
            <Input
              key={index}
              placeholder={t('createClassroom.outcomePlaceholder', { number: index + 1 })}
              value={outcome}
              onChange={(e) => handleOutcomeChange(index, e.target.value)}
              className="rounded-xl border-border bg-background focus-visible:ring-primary"
              autoDirection
            />
          ))}
        </div>
      </div>

      <div className="space-y-4 p-6 rounded-xl border border-border shadow-sm">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Label
            className={`text-foreground font-bold text-heading block ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {t('createClassroom.keyChallenges')}
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addChallenge}
            className="text-primary hover:bg-primary/5 h-8 text-xs font-bold"
          >
            <Plus className="h-3 w-3 me-1" /> {t('createClassroom.add')}
          </Button>
        </div>
        <div className="space-y-3">
          {formData.keyChallenges.map((challenge, index) => (
            <Input
              key={index}
              placeholder={t('createClassroom.challengePlaceholder', { number: index + 1 })}
              value={challenge}
              onChange={(e) => handleChallengeChange(index, e.target.value)}
              className="rounded-xl border-border bg-background focus-visible:ring-primary"
              autoDirection
            />
          ))}
        </div>
      </div>
    </div>
  );
};
