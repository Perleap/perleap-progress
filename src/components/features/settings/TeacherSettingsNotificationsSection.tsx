import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export type TeacherNotificationSettings = {
  submission_notifications: boolean;
  student_messages: boolean;
  classroom_updates: boolean;
  email_notifications: boolean;
};

export type TeacherSettingsNotificationsSectionProps = {
  isRTL: boolean;
  notifications: TeacherNotificationSettings;
  onNotificationsChange: (notifications: TeacherNotificationSettings) => void;
  onSave: () => void;
};

export function TeacherSettingsNotificationsSection({
  isRTL,
  notifications,
  onNotificationsChange,
  onSave,
}: TeacherSettingsNotificationsSectionProps) {
  const { t } = useTranslation();

  const setNotification = <K extends keyof TeacherNotificationSettings>(
    key: K,
    value: TeacherNotificationSettings[K],
  ) => {
    onNotificationsChange({ ...notifications, [key]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.notificationPreferences')}</CardTitle>
        <CardDescription>{t('settings.notificationPreferencesDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y border rounded-lg">
          <div
            className={`flex items-center justify-between p-4 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <div className="space-y-0.5 flex-1">
              <Label
                htmlFor="submission-notifications"
                className={`text-base font-medium ${isRTL ? 'text-right block' : 'text-left block'}`}
              >
                {t('settings.notifications.submissionNotifications')}
              </Label>
              <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('settings.notifications.submissionNotificationsDesc')}
              </p>
            </div>
            <Switch
              id="submission-notifications"
              checked={notifications.submission_notifications}
              onCheckedChange={(checked) => setNotification('submission_notifications', checked)}
            />
          </div>

          <div
            className={`flex items-center justify-between p-4 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <div className="space-y-0.5 flex-1">
              <Label
                htmlFor="student-messages"
                className={`text-base font-medium ${isRTL ? 'text-right block' : 'text-left block'}`}
              >
                {t('settings.notifications.studentMessages')}
              </Label>
              <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('settings.notifications.studentMessagesDesc')}
              </p>
            </div>
            <Switch
              id="student-messages"
              checked={notifications.student_messages}
              onCheckedChange={(checked) => setNotification('student_messages', checked)}
            />
          </div>

          <div
            className={`flex items-center justify-between p-4 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <div className="space-y-0.5 flex-1">
              <Label
                htmlFor="classroom-updates"
                className={`text-base font-medium ${isRTL ? 'text-right block' : 'text-left block'}`}
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

          <div
            className={`flex items-center justify-between p-4 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <div className="space-y-0.5 flex-1">
              <Label
                htmlFor="email-notifications"
                className={`text-base font-medium ${isRTL ? 'text-right block' : 'text-left block'}`}
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

        <div className={cn('mt-6 flex', isRTL ? 'justify-end' : 'justify-start')}>
          <Button onClick={onSave}>{t('settings.savePreferences')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
