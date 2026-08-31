import { Loader2, Camera, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SecureAvatarImage } from '@/components/ui/SecureAvatarImage';
import { STUDENT_AVATARS_BUCKET } from '@/utils/storageUrls';

export type StudentSettingsProfileState = {
  full_name: string;
  avatar_url: string | null;
  voice_preference: string;
};

export type StudentSettingsProfileSectionProps = {
  isRTL: boolean;
  userEmail?: string;
  profile: StudentSettingsProfileState;
  onProfileChange: (profile: StudentSettingsProfileState) => void;
  uploading: boolean;
  saving: boolean;
  onPhotoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onSaveProfile: () => void | Promise<void>;
  onDeleteAccount: () => void;
};

export const StudentSettingsProfileSection = ({
  isRTL,
  userEmail,
  profile,
  onProfileChange,
  uploading,
  saving,
  onPhotoUpload,
  onSaveProfile,
  onDeleteAccount,
}: StudentSettingsProfileSectionProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = () => {
    if (!profile.full_name) return 'S';
    return profile.full_name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <Card>
        <CardHeader className={isRTL ? 'text-right' : 'text-left'}>
          <CardTitle>{t('settings.profile.title')}</CardTitle>
          <CardDescription>{t('settings.profileDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="relative">
              <Avatar className="h-20 w-20">
                {profile.avatar_url ? (
                  <SecureAvatarImage
                    src={profile.avatar_url}
                    bucket={STUDENT_AVATARS_BUCKET}
                    alt="Profile"
                  />
                ) : null}
                <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className={`absolute -bottom-2 h-8 w-8 rounded-full ${isRTL ? '-left-2' : '-right-2'}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onPhotoUpload}
                className="hidden"
              />
            </div>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className="text-sm font-medium">{profile.full_name || t('settings.noNameSet')}</p>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('settings.clickCameraUpload')}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName" className={isRTL ? 'text-right block' : 'text-left block'}>
              {t('settings.fullName')}
            </Label>
            <Input
              id="fullName"
              value={profile.full_name}
              onChange={(e) => onProfileChange({ ...profile, full_name: e.target.value })}
              placeholder="John Doe"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className={isRTL ? 'text-right block' : 'text-left block'}>
              {t('settings.email')}
            </Label>
            <Input
              id="email"
              type="email"
              value={userEmail || ''}
              disabled
              className={`bg-muted ${isRTL ? 'text-right' : ''}`}
            />
            <p className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : ''}`}>
              {t('settings.emailCannotChange')}
            </p>
          </div>

          <div className={isRTL ? 'flex justify-end' : 'flex justify-start'}>
            <Button onClick={() => void onSaveProfile()} disabled={saving}>
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

      <Card className="border-destructive">
        <CardHeader className={isRTL ? 'text-right' : 'text-left'}>
          <CardTitle className="text-destructive">{t('settings.dangerZone')}</CardTitle>
          <CardDescription>{t('settings.dangerZoneDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`rounded-lg bg-destructive/10 p-4 space-y-2 ${isRTL ? 'text-right' : 'text-left'}`}
          >
            <p className="text-sm font-medium">{t('settings.deleteAccount.title')}</p>
            <p className="text-sm text-muted-foreground">{t('settings.deleteAccountWarning')}</p>
          </div>
          <div className={isRTL ? 'flex justify-end' : 'flex justify-start'}>
            <Button
              variant="destructive"
              onClick={onDeleteAccount}
              className={`w-full sm:w-auto ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <Trash2 className={isRTL ? 'ml-2 h-4 w-4' : 'mr-2 h-4 w-4'} />
              {t('settings.deleteAccountButton')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
