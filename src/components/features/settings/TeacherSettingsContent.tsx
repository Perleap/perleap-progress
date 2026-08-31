import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import {
  TeacherSettingsNotificationsSection,
  type TeacherNotificationSettings,
} from '@/components/features/settings/TeacherSettingsNotificationsSection';
import {
  TeacherSettingsProfileSection,
  type TeacherSettingsProfileState,
} from '@/components/features/settings/TeacherSettingsProfileSection';
import {
  TeacherSettingsTeachingPreferencesSection,
  type TeacherSettingsQuestionsState,
} from '@/components/features/settings/TeacherSettingsTeachingPreferencesSection';
import { DashboardLayout } from '@/components/layouts';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import { useTeacherProfile, useUpdateTeacherProfile } from '@/hooks/queries';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export const TeacherSettingsContent = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: profileData, isLoading: loading } = useTeacherProfile();
  const updateProfileMutation = useUpdateTeacherProfile();

  const [profile, setProfile] = useState<TeacherSettingsProfileState>({
    full_name: '',
    avatar_url: null,
    phone_number: '',
    subjects: [],
    years_experience: null,
    student_education_level: '',
  });

  const [questions, setQuestions] = useState<TeacherSettingsQuestionsState>({
    teaching_goals: '',
    style_notes: '',
    teaching_examples: '',
    sample_explanation: '',
  });

  const [notifications, setNotifications] = useState<TeacherNotificationSettings>({
    submission_notifications: true,
    student_messages: true,
    classroom_updates: true,
    email_notifications: false,
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (profileData) {
      setProfile({
        full_name: profileData.full_name || '',
        avatar_url: profileData.avatar_url || null,
        phone_number: profileData.phone_number || '',
        subjects: profileData.subjects || [],
        years_experience: profileData.years_experience || null,
        student_education_level: profileData.student_education_level || '',
      });

      setQuestions({
        teaching_goals: profileData.teaching_goals || '',
        style_notes: profileData.style_notes || '',
        teaching_examples: profileData.teaching_examples || '',
        sample_explanation: profileData.sample_explanation || '',
      });
    } else if (!loading && user) {
      if (sessionStorage.getItem('is_deleting_account') === 'true') {
        return;
      }

      navigate('/onboarding/teacher', { replace: true });
    }
  }, [profileData, loading, user, navigate]);

  useEffect(() => {
    const savedNotifications = localStorage.getItem('teacher_notifications');
    if (savedNotifications) {
      try {
        setNotifications(JSON.parse(savedNotifications));
      } catch (e) {
        console.error('Error parsing notifications:', e);
      }
    }
  }, []);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('settings.fileSizeTooLarge'));
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error(t('settings.uploadImageFile'));
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('teacher-avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        toast.error(t('settings.photoUploadFailed'));
        setUploading(false);
        return;
      }

      await updateProfileMutation.mutateAsync({ avatar_url: fileName });

      setProfile((prev) => ({ ...prev, avatar_url: fileName }));
      toast.success(t('settings.photoUploadSuccess'));
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error(t('settings.photoUploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await updateProfileMutation.mutateAsync({
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        phone_number: profile.phone_number,
        subjects: profile.subjects,
        years_experience: profile.years_experience,
        student_education_level: profile.student_education_level,
      });
      toast.success(t('settings.success.saved'));
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(t('settings.errors.saving'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuestions = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await updateProfileMutation.mutateAsync({
        teaching_goals: questions.teaching_goals,
        style_notes: questions.style_notes,
        teaching_examples: questions.teaching_examples,
        sample_explanation: questions.sample_explanation,
      });
      toast.success(t('settings.success.saved'));
    } catch (error) {
      console.error('Error updating questions:', error);
      toast.error(t('settings.errors.saving'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = () => {
    localStorage.setItem('teacher_notifications', JSON.stringify(notifications));
    toast.success(t('settings.success.saved'));
  };

  if (loading && !profileData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div
        className={cn('container py-8 px-4 max-w-4xl', isRTL && 'text-right')}
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
      >
        <Tabs
          value={activeTab}
          onValueChange={(val) => setSearchParams({ tab: val })}
          className="space-y-6"
        >
          <TabsContent value="profile" className="space-y-6">
            <TeacherSettingsProfileSection
              isRTL={isRTL}
              userEmail={user?.email}
              profile={profile}
              onProfileChange={setProfile}
              uploading={uploading}
              saving={saving}
              onPhotoUpload={handlePhotoUpload}
              onSaveProfile={handleSaveProfile}
              onDeleteAccount={() => setShowDeleteDialog(true)}
            />
          </TabsContent>

          <TabsContent value="questions" className="space-y-6">
            <TeacherSettingsTeachingPreferencesSection
              isRTL={isRTL}
              questions={questions}
              onQuestionsChange={setQuestions}
              saving={saving}
              onSave={handleSaveQuestions}
            />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <TeacherSettingsNotificationsSection
              isRTL={isRTL}
              notifications={notifications}
              onNotificationsChange={setNotifications}
              onSave={handleSaveNotifications}
            />
          </TabsContent>
        </Tabs>
      </div>

      <DeleteAccountDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        userRole="teacher"
      />
    </DashboardLayout>
  );
};
