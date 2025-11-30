import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import type { NotificationSettings } from '@/types/notifications';

interface NotificationSettingsSectionProps {
  notifications: NotificationSettings;
  onUpdate: (notifications: NotificationSettings) => void;
  onSave: () => void;
}

/**
 * Notification preferences section
 * Allows users to configure notification settings
 */
export const NotificationSettingsSection = ({
  notifications,
  onUpdate,
  onSave,
}: NotificationSettingsSectionProps) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const handleToggle = (key: keyof NotificationSettings) => {
    onUpdate({
      ...notifications,
      [key]: !notifications[key],
    });
  };

  return (
    <Card dir={isRTL ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Bell className="h-5 w-5" />
          <CardTitle className={isRTL ? 'text-right' : 'text-left'}>{t('settings.notifications.title')}</CardTitle>
        </div>
        <CardDescription className={isRTL ? 'text-right' : 'text-left'}>{t('settings.notifications.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`space-y-0.5 ${isRTL ? 'text-right' : 'text-left'}`}>
              <Label htmlFor="submission-notifs">
                {t('settings.notifications.submissionNotifications')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.notifications.submissionNotificationsDesc')}
              </p>
            </div>
            <Switch
              id="submission-notifs"
              checked={notifications.submission_notifications}
              onCheckedChange={() => handleToggle('submission_notifications')}
            />
          </div>

          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`space-y-0.5 ${isRTL ? 'text-right' : 'text-left'}`}>
              <Label htmlFor="student-messages">
                {t('settings.notifications.studentMessages')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.notifications.studentMessagesDesc')}
              </p>
            </div>
            <Switch
              id="student-messages"
              checked={notifications.student_messages}
              onCheckedChange={() => handleToggle('student_messages')}
            />
          </div>

          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`space-y-0.5 ${isRTL ? 'text-right' : 'text-left'}`}>
              <Label htmlFor="classroom-updates">
                {t('settings.notifications.classroomUpdates')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.notifications.classroomUpdatesDesc')}
              </p>
            </div>
            <Switch
              id="classroom-updates"
              checked={notifications.classroom_updates}
              onCheckedChange={() => handleToggle('classroom_updates')}
            />
          </div>

          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`space-y-0.5 ${isRTL ? 'text-right' : 'text-left'}`}>
              <Label htmlFor="email-notifs">{t('settings.notifications.emailNotifications')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.notifications.emailNotificationsDesc')}
              </p>
            </div>
            <Switch
              id="email-notifs"
              checked={notifications.email_notifications}
              onCheckedChange={() => handleToggle('email_notifications')}
            />
          </div>
        </div>

        <Button onClick={onSave} className="w-full">
          {t('settings.notifications.save')}
        </Button>
      </CardContent>
    </Card>
  );
};
