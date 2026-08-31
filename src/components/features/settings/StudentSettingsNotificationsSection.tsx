import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export type StudentNotificationSettings = {
  assignment_notifications: boolean;
  feedback_notifications: boolean;
  classroom_updates: boolean;
  email_notifications: boolean;
};

export type StudentSettingsNotificationsSectionProps = {
  isRTL: boolean;
  notifications: StudentNotificationSettings;
  onNotificationsChange: (notifications: StudentNotificationSettings) => void;
  onSave: () => void;
};

export const StudentSettingsNotificationsSection = ({
  isRTL,
  notifications,
  onNotificationsChange,
  onSave,
}: StudentSettingsNotificationsSectionProps) => {
  const { t } = useTranslation();

  const setNotification = <K extends keyof StudentNotificationSettings>(
    key: K,
    value: StudentNotificationSettings[K]
  ) => {
    onNotificationsChange({ ...notifications, [key]: value });
  };

  return (
    <Card>
      <CardHeader className={isRTL ? 'text-right' : 'text-left'}>
        <CardTitle>{t('settings.notificationPreferences')}</CardTitle>
        <CardDescription>{t('settings.notificationPreferencesDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="space-y-0.5">
              <Label
                htmlFor="assignment-notifications"
                className={isRTL ? 'text-right block' : 'text-left block'}
              >
                {t('settings.notifications.assignmentNotifications')}
              </Label>
              <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('settings.notifications.assignmentNotificationsDesc')}
              </p>
            </div>
            <Switch
              id="assignment-notifications"
              checked={notifications.assignment_notifications}
              onCheckedChange={(checked) => setNotification('assignment_notifications', checked)}
            />
          </div>

          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="space-y-0.5">
              <Label
                htmlFor="feedback-notifications"
                className={isRTL ? 'text-right block' : 'text-left block'}
              >
                {t('settings.notifications.feedbackNotifications')}
              </Label>
              <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('settings.notifications.feedbackNotificationsDesc')}
              </p>
            </div>
            <Switch
              id="feedback-notifications"
              checked={notifications.feedback_notifications}
              onCheckedChange={(checked) => setNotification('feedback_notifications', checked)}
            />
          </div>

          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="space-y-0.5">
              <Label
                htmlFor="classroom-updates"
                className={isRTL ? 'text-right block' : 'text-left block'}
              >
                {t('settings.notifications.classroomUpdates')}
              </Label>
              <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('settings.notifications.classroomUpdatesDesc')}
              </p>
            </div>
            <Switch
              id="classroom-updates"
              checked={notifications.classroom_updates}
              onCheckedChange={(checked) => setNotification('classroom_updates', checked)}
            />
          </div>

          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="space-y-0.5">
              <Label
                htmlFor="email-notifications"
                className={isRTL ? 'text-right block' : 'text-left block'}
              >
                {t('settings.notifications.emailNotifications')}
              </Label>
              <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('settings.notifications.emailNotificationsDesc')}
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={notifications.email_notifications}
              onCheckedChange={(checked) => setNotification('email_notifications', checked)}
            />
          </div>
        </div>

        <div className="flex justify-center">
          <Button onClick={onSave}>{t('settings.savePreferences')}</Button>
        </div>
      </CardContent>
    </Card>
  );
};
