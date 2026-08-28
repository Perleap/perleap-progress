import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layouts';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStudentProfile, useUpdateStudentProfile } from '@/hooks/queries';
import {
  StudentSettingsProfileSection,
  type StudentSettingsProfileState,
} from '@/components/features/settings/StudentSettingsProfileSection';
import {
  StudentSettingsLearningPreferencesSection,
  type StudentSettingsQuestionsState,
} from '@/components/features/settings/StudentSettingsLearningPreferencesSection';
import { StudentSettingsVoiceSection } from '@/components/features/settings/StudentSettingsVoiceSection';
import {
  StudentSettingsNotificationsSection,
  type StudentNotificationSettings,
} from '@/components/features/settings/StudentSettingsNotificationsSection';

export function StudentSettingsContent() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: profileData, isLoading: loading } = useStudentProfile();
  const updateProfileMutation = useUpdateStudentProfile();

  const [profile, setProfile] = useState<StudentSettingsProfileState>({
    full_name: '',
    avatar_url: null,
    voice_preference: 'shimmer',
  });

  const [questions, setQuestions] = useState<StudentSettingsQuestionsState>({
    learning_methods: '',
    solo_vs_group: '',
    scheduled_vs_flexible: '',
    motivation_factors: '',
    help_preferences: '',
    teacher_preferences: '',
    feedback_preferences: '',
    learning_goal: '',
    special_needs: '',
    additional_notes: '',
  });

  const [notifications, setNotifications] = useState<StudentNotificationSettings>({
    assignment_notifications: true,
    feedback_notifications: true,
    classroom_updates: true,
    email_notifications: false,
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (profileData) {
      setProfile({
        full_name: profileData.full_name || '',
        avatar_url: profileData.avatar_url || null,
        voice_preference: (profileData as any).voice_preference || 'shimmer',
      });

      setQuestions({
        learning_methods: (profileData as any).learning_methods || '',
        solo_vs_group: (profileData as any).solo_vs_group || '',
        scheduled_vs_flexible: (profileData as any).scheduled_vs_flexible || '',
        motivation_factors: (profileData as any).motivation_factors || '',
        help_preferences: (profileData as any).help_preferences || '',
        teacher_preferences: (profileData as any).teacher_preferences || '',
        feedback_preferences: (profileData as any).feedback_preferences || '',
        learning_goal: (profileData as any).learning_goal || '',
        special_needs: (profileData as any).special_needs || '',
        additional_notes: (profileData as any).additional_notes || '',
      });
    } else if (!loading && user) {
      if (sessionStorage.getItem('is_deleting_account') === 'true') {
        console.log('ℹ️ StudentSettings: Account deletion in progress, skipping onboarding redirect');
        return;
      }

      navigate('/onboarding/student', { replace: true });
    }
  }, [profileData, loading, user, navigate]);

  useEffect(() => {
    const savedNotifications = localStorage.getItem('student_notifications');
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
        .from('student-avatars')
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
        voice_preference: profile.voice_preference,
      } as any);
      toast.success(t('settings.success.saved'));
    } catch (error) {
      console.error('Error saving profile:', error);
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
        learning_methods: questions.learning_methods,
        solo_vs_group: questions.solo_vs_group,
        scheduled_vs_flexible: questions.scheduled_vs_flexible,
        motivation_factors: questions.motivation_factors,
        help_preferences: questions.help_preferences,
        teacher_preferences: questions.teacher_preferences,
        feedback_preferences: questions.feedback_preferences,
        learning_goal: questions.learning_goal,
        special_needs: questions.special_needs,
        additional_notes: questions.additional_notes,
      } as any);
      toast.success(t('settings.success.saved'));
    } catch (error) {
      console.error('Error saving interests:', error);
      toast.error(t('settings.errors.saving'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = () => {
    localStorage.setItem('student_notifications', JSON.stringify(notifications));
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
      <div className="container py-8 px-4 max-w-4xl" dir={isRTL ? 'rtl' : 'ltr'}>
        <Tabs value={activeTab} onValueChange={(val) => setSearchParams({ tab: val })} className="space-y-6">
          <TabsContent value="profile" className="space-y-6">
            <StudentSettingsProfileSection
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
            <StudentSettingsLearningPreferencesSection
              isRTL={isRTL}
              questions={questions}
              onQuestionsChange={setQuestions}
              saving={saving}
              onSave={handleSaveQuestions}
            />
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <StudentSettingsVoiceSection
              isRTL={isRTL}
              voicePreference={profile.voice_preference}
              onVoicePreferenceChange={(value) =>
                setProfile((prev) => ({ ...prev, voice_preference: value }))
              }
              saving={saving}
              onSave={handleSaveProfile}
            />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <StudentSettingsNotificationsSection
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
        userRole="student"
      />
    </DashboardLayout>
  );
}
