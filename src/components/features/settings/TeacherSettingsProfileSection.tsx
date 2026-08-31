import { Loader2, Camera, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SecureAvatarImage } from '@/components/ui/SecureAvatarImage';
import { cn } from '@/lib/utils';
import { TEACHER_AVATARS_BUCKET } from '@/utils/storageUrls';

export type TeacherSettingsProfileState = {
  full_name: string;
  avatar_url: string | null;
  phone_number: string;
  subjects: string[];
  years_experience: number | null;
  student_education_level: string;
};

export type TeacherSettingsProfileSectionProps = {
  isRTL: boolean;
  userEmail?: string;
  profile: TeacherSettingsProfileState;
  onProfileChange: (profile: TeacherSettingsProfileState) => void;
  uploading: boolean;
  saving: boolean;
  onPhotoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onSaveProfile: () => void | Promise<void>;
  onDeleteAccount: () => void;
};

export const TeacherSettingsProfileSection = ({
  isRTL,
  userEmail,
  profile,
  onProfileChange,
  uploading,
  saving,
  onPhotoUpload,
  onSaveProfile,
  onDeleteAccount,
}: TeacherSettingsProfileSectionProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = () => {
    if (!profile.full_name) return 'T';
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
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
            <div className="relative">
              <Avatar className="h-20 w-20">
                {profile.avatar_url ? (
                  <SecureAvatarImage
                    src={profile.avatar_url}
                    bucket={TEACHER_AVATARS_BUCKET}
                    alt="Profile"
                  />
                ) : null}
                <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
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
            <div className={cn(isRTL && 'text-right')}>
              <p className="text-sm font-medium">{profile.full_name || t('settings.noNameSet')}</p>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('settings.clickCameraUpload')}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">{t('settings.fullName')}</Label>
            <Input
              id="fullName"
              value={profile.full_name}
              onChange={(e) => onProfileChange({ ...profile, full_name: e.target.value })}
              placeholder="Jane Smith"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('settings.email')}</Label>
            <Input
              id="email"
              type="email"
              value={userEmail || ''}
              disabled
              className={cn('bg-muted', isRTL && 'text-right')}
            />
            <p className="text-xs text-muted-foreground">{t('settings.emailCannotChange')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">{t('settings.phoneNumber')}</Label>
            <Input
              id="phoneNumber"
              type="tel"
              value={profile.phone_number}
              onChange={(e) => onProfileChange({ ...profile, phone_number: e.target.value })}
              placeholder="+1 (555) 123-4567"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subjects">{t('settings.subjects')}</Label>
            <Input
              id="subjects"
              value={profile.subjects.join(', ')}
              onChange={(e) =>
                onProfileChange({
                  ...profile,
                  subjects: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Math, Physics, Chemistry"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            <p className="text-xs text-muted-foreground">{t('settings.subjectsHelp')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="yearsExperience">{t('settings.yearsExperience')}</Label>
            <Input
              id="yearsExperience"
              type="number"
              min="0"
              value={profile.years_experience || ''}
              onChange={(e) =>
                onProfileChange({
                  ...profile,
                  years_experience: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              placeholder="5"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="studentLevel">{t('settings.studentLevel')}</Label>
            <Input
              id="studentLevel"
              value={profile.student_education_level}
              onChange={(e) =>
                onProfileChange({ ...profile, student_education_level: e.target.value })
              }
              placeholder="e.g., Middle School, High School, University"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>

          <Button onClick={() => void onSaveProfile()} disabled={saving}>
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

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">{t('settings.dangerZone')}</CardTitle>
          <CardDescription>{t('settings.dangerZoneDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-destructive/10 p-4 space-y-2">
            <p className="text-sm font-medium">{t('settings.deleteAccount.title')}</p>
            <p className="text-sm text-muted-foreground">{t('settings.deleteAccountWarning')}</p>
          </div>
          <Button variant="destructive" onClick={onDeleteAccount} className="w-full sm:w-auto">
            <Trash2 className="mr-2 h-4 w-4" />
            {t('settings.deleteAccountButton')}
          </Button>
        </CardContent>
      </Card>
    </>
  );
};
