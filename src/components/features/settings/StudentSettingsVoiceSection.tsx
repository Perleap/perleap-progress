import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export type StudentSettingsVoiceSectionProps = {
  isRTL: boolean;
  voicePreference: string;
  onVoicePreferenceChange: (value: string) => void;
  saving: boolean;
  onSave: () => void | Promise<void>;
};

export const StudentSettingsVoiceSection = ({
  isRTL,
  voicePreference,
  onVoicePreferenceChange,
  saving,
  onSave,
}: StudentSettingsVoiceSectionProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className={isRTL ? 'text-right' : 'text-left'}>
        <CardTitle>{t('settings.voicePreference')}</CardTitle>
        <CardDescription>{t('settings.voicePreferenceDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-6">
          <div className={`flex flex-col gap-2 ${isRTL ? 'items-end' : 'items-start'}`}>
            <Label className="text-base font-semibold">{t('settings.voiceType')}</Label>
            <div
              className={`flex flex-wrap items-center gap-x-8 gap-y-4 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <p className="text-sm text-muted-foreground">{t('settings.voiceTypeDesc')}</p>
              <RadioGroup
                value={voicePreference || 'shimmer'}
                onValueChange={onVoicePreferenceChange}
                className="flex flex-row gap-8 items-center"
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="onyx" id="voice-male" className="size-5" />
                  <Label
                    htmlFor="voice-male"
                    className="cursor-pointer font-medium text-sm leading-none m-0"
                  >
                    {t('settings.male')}
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="shimmer" id="voice-female" className="size-5" />
                  <Label
                    htmlFor="voice-female"
                    className="cursor-pointer font-medium text-sm leading-none m-0"
                  >
                    {t('settings.female')}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
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
};
