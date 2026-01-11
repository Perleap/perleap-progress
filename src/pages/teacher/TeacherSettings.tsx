import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, Bell, Loader2, Camera, MessageSquare, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layouts';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { useLanguage } from '@/contexts/LanguageContext';

interface TeacherProfile {
  full_name: string;
  avatar_url: string | null;
  phone_number: string;
  subjects: string[];
  years_experience: number | null;
  student_education_level: string;
}

interface TeacherQuestions {
  teaching_goals: string;
  style_notes: string;
  teaching_examples: string;
  sample_explanation: string;
}

interface NotificationSettings {
  submission_notifications: boolean;
  student_messages: boolean;
  classroom_updates: boolean;
  email_notifications: boolean;
}

const TeacherSettings = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [profile, setProfile] = useState<TeacherProfile>({
    full_name: '',
    avatar_url: null,
    phone_number: '',
    subjects: [],
    years_experience: null,
    student_education_level: '',
  });

  const [questions, setQuestions] = useState<TeacherQuestions>({
    teaching_goals: '',
    style_notes: '',
    teaching_examples: '',
    sample_explanation: '',
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    submission_notifications: true,
    student_messages: true,
    classroom_updates: true,
    email_notifications: false,
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    // ProtectedRoute handles auth, just fetch data when user is available
    if (user?.id) {
      fetchSettings();
    }
  }, [user?.id]); // Use user?.id to avoid refetch on user object reference change

  const fetchSettings = async () => {
    try {
      // Fetch teacher profile with all fields - use maybeSingle() to handle missing profiles
      const { data: profileData, error: profileError } = await supabase
        .from('teacher_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        throw profileError;
      }

      // If no profile exists, silently redirect to onboarding
      if (!profileData) {
        // This is expected for new users - not an error
        navigate('/onboarding/teacher', { replace: true });
        return;
      }

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
      }

      // In a real app, you would fetch notification settings from a separate table
      // For now, we'll use localStorage as a mock
      const savedNotifications = localStorage.getItem('teacher_notifications');
      if (savedNotifications) {
        setNotifications(JSON.parse(savedNotifications));
      }
    } catch (error: any) {
      // Only log actual errors, not missing profiles (which is expected for new users)
      if (error.code === 'PGRST116') {
        // No rows returned - profile doesn't exist, silently redirect to onboarding
        navigate('/onboarding/teacher', { replace: true });
      } else {
        // This is an actual error
        console.error('Error loading settings:', error);
        toast.error(t('settings.errors.loading'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('settings.fileSizeTooLarge'));
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('settings.uploadImageFile'));
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('teacher-avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        toast.error(t('settings.photoUploadFailed'));
        setUploading(false);
        return;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('teacher-avatars').getPublicUrl(fileName);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('teacher_profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
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
      const { error } = await supabase
        .from('teacher_profiles')
        .update({
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          phone_number: profile.phone_number,
          subjects: profile.subjects,
          years_experience: profile.years_experience,
          student_education_level: profile.student_education_level,
        })
        .eq('user_id', user.id);

      if (error) throw error;
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
      const { error } = await supabase
        .from('teacher_profiles')
        .update({
          teaching_goals: questions.teaching_goals,
          style_notes: questions.style_notes,
          teaching_examples: questions.teaching_examples,
          sample_explanation: questions.sample_explanation,
        })
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success(t('settings.success.saved'));
    } catch (error) {
      console.error('Error updating questions:', error);
      toast.error(t('settings.errors.saving'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = () => {
    // In a real app, you would save to database
    localStorage.setItem('teacher_notifications', JSON.stringify(notifications));
    toast.success(t('settings.success.saved'));
  };

  const getInitials = () => {
    if (!profile.full_name) return 'T';
    return profile.full_name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: t('nav.dashboard'), href: '/teacher/dashboard' },
        { label: t('settings.title') }
      ]}
    >
      <div
        className={cn("container py-8 px-4 max-w-4xl", isRTL && "text-right")}
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
      >
        <Tabs value={activeTab} onValueChange={(val) => setSearchParams({ tab: val })} className="space-y-6">
          {/* TabsList removed as navigation is now in the sidebar */}

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.profile')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div
                  className="flex items-center gap-4"
                  style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                >
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      {profile.avatar_url ? (
                        <AvatarImage src={profile.avatar_url} alt="Profile" />
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
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </div>
                  <div className={cn(isRTL && "text-right")}>
                    <p className="text-sm font-medium">{profile.full_name || t('settings.noNameSet')}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
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
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    placeholder="Jane Smith"
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t('settings.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className={cn("bg-muted", isRTL && "text-right")}
                  />
                  <p className="text-xs text-muted-foreground">{t('settings.emailCannotChange')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">{t('settings.phoneNumber')}</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={profile.phone_number}
                    onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
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
                      setProfile({
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
                  <p className="text-xs text-muted-foreground">
                    {t('settings.subjectsHelp')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="yearsExperience">{t('settings.yearsExperience')}</Label>
                  <Input
                    id="yearsExperience"
                    type="number"
                    min="0"
                    value={profile.years_experience || ''}
                    onChange={(e) =>
                      setProfile({
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
                      setProfile({ ...profile, student_education_level: e.target.value })
                    }
                    placeholder="e.g., Middle School, High School, University"
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                </div>

                <Button onClick={handleSaveProfile} disabled={saving}>
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

            {/* Danger Zone */}
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">{t('settings.dangerZone')}</CardTitle>
                <CardDescription>
                  {t('settings.dangerZoneDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-destructive/10 p-4 space-y-2">
                  <p className="text-sm font-medium">{t('settings.deleteAccount.title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.deleteAccountWarning')}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('settings.deleteAccountButton')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions" className="space-y-6">
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
                    onChange={(e) => setQuestions({ ...questions, teaching_goals: e.target.value })}
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
                    onChange={(e) => setQuestions({ ...questions, style_notes: e.target.value })}
                    placeholder={
                      questions.style_notes || 'How would you describe your approach to teaching?'
                    }
                    rows={4}
                    className={!questions.style_notes ? 'text-muted-foreground' : ''}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('settings.teachingStyleHelp')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teachingExample">{t('settings.teachingExampleQuestion')}</Label>
                  <Textarea
                    id="teachingExample"
                    value={questions.teaching_examples}
                    onChange={(e) =>
                      setQuestions({ ...questions, teaching_examples: e.target.value })
                    }
                    placeholder={
                      questions.teaching_examples ||
                      'How do you explain a concept or give feedback to students?'
                    }
                    rows={4}
                    className={!questions.teaching_examples ? 'text-muted-foreground' : ''}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('settings.teachingExampleHelp')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalNotes">{t('settings.additionalNotesQuestion')}</Label>
                  <Textarea
                    id="additionalNotes"
                    value={questions.sample_explanation}
                    onChange={(e) =>
                      setQuestions({ ...questions, sample_explanation: e.target.value })
                    }
                    placeholder={
                      questions.sample_explanation ||
                      'Any specific preferences or additional context...'
                    }
                    rows={3}
                    className={!questions.sample_explanation ? 'text-muted-foreground' : ''}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                </div>

                <Button onClick={handleSaveQuestions} disabled={saving}>
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
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.notificationPreferences')}</CardTitle>
                <CardDescription>{t('settings.notificationPreferencesDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y border rounded-lg">
                  <div className={`flex items-center justify-between p-4 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="submission-notifications" className={`text-base font-medium ${isRTL ? 'text-right block' : 'text-left block'}`}>
                        {t('settings.notifications.submissionNotifications')}
                      </Label>
                      <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('settings.notifications.submissionNotificationsDesc')}
                      </p>
                    </div>
                    <Switch
                      id="submission-notifications"
                      checked={notifications.submission_notifications}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, submission_notifications: checked })
                      }
                    />
                  </div>

                  <div className={`flex items-center justify-between p-4 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="student-messages" className={`text-base font-medium ${isRTL ? 'text-right block' : 'text-left block'}`}>
                        {t('settings.notifications.studentMessages')}
                      </Label>
                      <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('settings.notifications.studentMessagesDesc')}
                      </p>
                    </div>
                    <Switch
                      id="student-messages"
                      checked={notifications.student_messages}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, student_messages: checked })
                      }
                    />
                  </div>

                  <div className={`flex items-center justify-between p-4 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="classroom-updates" className={`text-base font-medium ${isRTL ? 'text-right block' : 'text-left block'}`}>
                        {t('settings.notifications.classroomUpdates')}
                      </Label>
                      <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('settings.notifications.classroomUpdatesDesc')}
                      </p>
                    </div>
                    <Switch
                      id="classroom-updates"
                      checked={notifications.classroom_updates}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, classroom_updates: checked })
                      }
                    />
                  </div>

                  <div className={`flex items-center justify-between p-4 gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="email-notifications" className={`text-base font-medium ${isRTL ? 'text-right block' : 'text-left block'}`}>
                        {t('settings.notifications.emailNotifications')}
                      </Label>
                      <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('settings.notifications.emailNotificationsDesc')}
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={notifications.email_notifications}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, email_notifications: checked })
                      }
                    />
                  </div>
                </div>

                <div className={cn("mt-6 flex", isRTL ? "justify-end" : "justify-start")}>
                  <Button onClick={handleSaveNotifications}>{t('settings.savePreferences')}</Button>
                </div>
              </CardContent>
            </Card>
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

export default TeacherSettings;
