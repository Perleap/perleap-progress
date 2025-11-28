import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Bell, Loader2, Camera, MessageSquare, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteAccountDialog } from '@/components/DeleteAccountDialog';
import { useLanguage } from '@/contexts/LanguageContext';

interface StudentProfile {
  full_name: string;
  avatar_url: string | null;
}

interface StudentQuestions {
  learning_methods: string;
  solo_vs_group: string;
  scheduled_vs_flexible: string;
  motivation_factors: string;
  help_preferences: string;
  teacher_preferences: string;
  feedback_preferences: string;
  learning_goal: string;
  special_needs: string;
  additional_notes: string;
}

interface NotificationSettings {
  assignment_notifications: boolean;
  feedback_notifications: boolean;
  classroom_updates: boolean;
  email_notifications: boolean;
}

const StudentSettings = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [profile, setProfile] = useState<StudentProfile>({
    full_name: '',
    avatar_url: null,
  });

  const [questions, setQuestions] = useState<StudentQuestions>({
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

  const [notifications, setNotifications] = useState<NotificationSettings>({
    assignment_notifications: true,
    feedback_notifications: true,
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
      // Fetch student profile with all fields
      const { data: profileData, error: profileError } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;

      if (profileData) {
        setProfile({
          full_name: profileData.full_name || '',
          avatar_url: profileData.avatar_url || null,
        });

        setQuestions({
          learning_methods: profileData.learning_methods || '',
          solo_vs_group: profileData.solo_vs_group || '',
          scheduled_vs_flexible: profileData.scheduled_vs_flexible || '',
          motivation_factors: profileData.motivation_factors || '',
          help_preferences: profileData.help_preferences || '',
          teacher_preferences: profileData.teacher_preferences || '',
          feedback_preferences: profileData.feedback_preferences || '',
          learning_goal: profileData.learning_goal || '',
          special_needs: profileData.special_needs || '',
          additional_notes: profileData.additional_notes || '',
        });
      }

      // In a real app, you would fetch notification settings from a separate table
      // For now, we'll use localStorage as a mock
      const savedNotifications = localStorage.getItem('student_notifications');
      if (savedNotifications) {
        setNotifications(JSON.parse(savedNotifications));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error(t('settings.errors.loading'));
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
        .from('student-avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        toast.error(t('settings.photoUploadFailed'));
        setUploading(false);
        return;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('student-avatars').getPublicUrl(fileName);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('student_profiles')
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
        .from('student_profiles')
        .update({
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        })
        .eq('user_id', user.id);

      if (error) throw error;
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
      const { error } = await supabase
        .from('student_profiles')
        .update({
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
        })
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success(t('settings.success.saved'));
    } catch (error) {
      console.error('Error saving interests:', error);
      toast.error(t('settings.errors.saving'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = () => {
    // In a real app, you would save to database
    localStorage.setItem('student_notifications', JSON.stringify(notifications));
    toast.success(t('settings.success.saved'));
  };

  const getInitials = () => {
    if (!profile.full_name) return 'S';
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
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title={t('settings.title')}
        userType="student"
        showBackButton
        onBackClick={() => navigate('/student/dashboard')}
      />

      <main className="container py-8 px-4 max-w-4xl" dir={isRTL ? 'rtl' : 'ltr'}>
        <Tabs defaultValue="profile" className="space-y-6">
          <div className="flex justify-center">
            <TabsList className="grid w-full grid-cols-3" dir={isRTL ? 'rtl' : 'ltr'}>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{t('settings.profile')}</span>
            </TabsTrigger>
            <TabsTrigger value="questions" className="flex items-center gap-2">
              <span className="hidden sm:inline">{t('settings.questions.learningMethods').split(' ')[0]}</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">{t('common.notifications')}</span>
            </TabsTrigger>
          </TabsList>
          </div>

          {/* Profile Tab */}
          < TabsContent value="profile" className="space-y-6" >
            <Card>
              <CardHeader className={isRTL ? 'text-right' : 'text-left'}>
                <CardTitle>{t('settings.profile')}</CardTitle>
                <CardDescription>{t('settings.profileDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
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
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </div>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="text-sm font-medium">{profile.full_name || t('settings.noNameSet')}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('settings.clickCameraUpload')}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName" className={isRTL ? 'text-right block' : 'text-left block'}>{t('settings.fullName')}</Label>
                  <Input
                    id="fullName"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    placeholder="John Doe"
                    autoDirection
                    className={isRTL ? 'text-right' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className={isRTL ? 'text-right block' : 'text-left block'}>{t('settings.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className={`bg-muted ${isRTL ? 'text-right' : ''}`}
                  />
                  <p className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : ''}`}>{t('settings.emailCannotChange')}</p>
                </div>


                <div className={isRTL ? 'flex justify-end' : 'flex justify-start'}>
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className={isRTL ? 'ml-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4 animate-spin'} />
                        {t('settings.saving')}
                      </>
                    ) : (
                      t('settings.saveChanges')
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive">
              <CardHeader className={isRTL ? 'text-right' : 'text-left'}>
                <CardTitle className="text-destructive">{t('settings.dangerZone')}</CardTitle>
                <CardDescription>
                  {t('settings.dangerZoneDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`rounded-lg bg-destructive/10 p-4 space-y-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className="text-sm font-medium">{t('settings.deleteAccount.title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.deleteAccountWarning')}
                  </p>
                </div>
                <div className={isRTL ? 'flex justify-end' : 'flex justify-start'}>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className={isRTL ? 'ml-2 h-4 w-4' : 'mr-2 h-4 w-4'} />
                    {t('settings.deleteAccountButton')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent >

          {/* Questions Tab */}
          < TabsContent value="questions" className="space-y-6" >
            <Card>
              <CardHeader className={isRTL ? 'text-right' : 'text-left'}>
                <CardTitle>{t('settings.learningPreferences')}</CardTitle>
                <CardDescription>
                  {t('settings.learningPreferencesDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="space-y-2" dir={isRTL ? 'rtl' : 'ltr'}>
                  <Label className={isRTL ? 'text-right' : 'text-left'}>{t('studentOnboarding.step1.learningMethodsQuestion')}</Label>
                  <RadioGroup
                    value={questions.learning_methods}
                    onValueChange={(v) => setQuestions({ ...questions, learning_methods: v })}
                  >
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="visual" id="edit-visual" className="mt-0.5" />
                      <Label htmlFor="edit-visual" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        <span className="font-medium">{t('studentOnboarding.step1.visual')}</span> - {t('studentOnboarding.step1.visualDesc')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="auditory" id="edit-auditory" className="mt-0.5" />
                      <Label htmlFor="edit-auditory" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        <span className="font-medium">{t('studentOnboarding.step1.auditory')}</span> - {t('studentOnboarding.step1.auditoryDesc')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="kinesthetic" id="edit-kinesthetic" className="mt-0.5" />
                      <Label htmlFor="edit-kinesthetic" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        <span className="font-medium">{t('studentOnboarding.step1.kinesthetic')}</span> - {t('studentOnboarding.step1.kinestheticDesc')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="video" id="edit-video" className="mt-0.5" />
                      <Label htmlFor="edit-video" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        <span className="font-medium">{t('studentOnboarding.step1.video')}</span> - {t('studentOnboarding.step1.videoDesc')}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right' : 'text-left'}>{t('studentOnboarding.step2.soloVsGroupQuestion')}</Label>
                  <RadioGroup
                    value={questions.solo_vs_group}
                    onValueChange={(v) => setQuestions({ ...questions, solo_vs_group: v })}
                  >
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="solo" id="edit-solo" className="mt-0.5" />
                      <Label htmlFor="edit-solo" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        <span className="font-medium">{t('studentOnboarding.step2.solo')}</span>
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="group" id="edit-group" className="mt-0.5" />
                      <Label htmlFor="edit-group" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        <span className="font-medium">{t('studentOnboarding.step2.group')}</span>
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="both" id="edit-both" className="mt-0.5" />
                      <Label htmlFor="edit-both" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        <span className="font-medium">{t('studentOnboarding.step2.both')}</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right' : 'text-left'}>{t('studentOnboarding.step2.scheduledVsFlexibleQuestion')}</Label>
                  <RadioGroup
                    value={questions.scheduled_vs_flexible}
                    onValueChange={(v) => setQuestions({ ...questions, scheduled_vs_flexible: v })}
                  >
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="scheduled" id="edit-scheduled" className="mt-0.5" />
                      <Label htmlFor="edit-scheduled" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        <span className="font-medium">{t('studentOnboarding.step2.scheduled')}</span>
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="flexible" id="edit-flexible" className="mt-0.5" />
                      <Label htmlFor="edit-flexible" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        <span className="font-medium">{t('studentOnboarding.step2.flexible')}</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right' : 'text-left'}>{t('studentOnboarding.step3.motivationQuestion')}</Label>
                  <RadioGroup
                    value={questions.motivation_factors}
                    onValueChange={(v) => setQuestions({ ...questions, motivation_factors: v })}
                  >
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="curiosity" id="edit-curiosity" className="mt-0.5" />
                      <Label htmlFor="edit-curiosity" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step3.curiosity')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="grades" id="edit-grades" className="mt-0.5" />
                      <Label htmlFor="edit-grades" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step3.grades')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem
                        value="encouragement"
                        id="edit-encouragement"
                        className="mt-0.5"
                      />
                      <Label htmlFor="edit-encouragement" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step3.encouragement')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem
                        value="personal_goals"
                        id="edit-personal_goals"
                        className="mt-0.5"
                      />
                      <Label htmlFor="edit-personal_goals" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step3.personalGoals')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="competition" id="edit-competition" className="mt-0.5" />
                      <Label htmlFor="edit-competition" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step3.competition')}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right' : 'text-left'}>{t('studentOnboarding.step4.helpQuestion')}</Label>
                  <RadioGroup
                    value={questions.help_preferences}
                    onValueChange={(v) => setQuestions({ ...questions, help_preferences: v })}
                  >
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="hints" id="edit-hints" className="mt-0.5" />
                      <Label htmlFor="edit-hints" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step4.hints')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem
                        value="different_way"
                        id="edit-different_way"
                        className="mt-0.5"
                      />
                      <Label htmlFor="edit-different_way" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step4.differentWay')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem
                        value="step_by_step"
                        id="edit-step_by_step"
                        className="mt-0.5"
                      />
                      <Label htmlFor="edit-step_by_step" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step4.stepByStep')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="more_time" id="edit-more_time" className="mt-0.5" />
                      <Label htmlFor="edit-more_time" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step4.moreTime')}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right' : 'text-left'}>{t('studentOnboarding.step4.teacherQuestion')}</Label>
                  <RadioGroup
                    value={questions.teacher_preferences}
                    onValueChange={(v) => setQuestions({ ...questions, teacher_preferences: v })}
                  >
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="patient" id="edit-patient" className="mt-0.5" />
                      <Label htmlFor="edit-patient" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step4.patient')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="challenging" id="edit-challenging" className="mt-0.5" />
                      <Label htmlFor="edit-challenging" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step4.challenging')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="clear" id="edit-clear" className="mt-0.5" />
                      <Label htmlFor="edit-clear" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step4.clear')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="fun" id="edit-fun" className="mt-0.5" />
                      <Label htmlFor="edit-fun" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step4.fun')}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className={isRTL ? 'text-right' : 'text-left'}>{t('studentOnboarding.step5.feedbackQuestion')}</Label>
                  <RadioGroup
                    value={questions.feedback_preferences}
                    onValueChange={(v) => setQuestions({ ...questions, feedback_preferences: v })}
                  >
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="immediate" id="edit-immediate" className="mt-0.5" />
                      <Label htmlFor="edit-immediate" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step5.immediate')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="written" id="edit-written" className="mt-0.5" />
                      <Label htmlFor="edit-written" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step5.written')}
                      </Label>
                    </div>
                    <div className={`flex items-center p-3 rounded-lg border hover:bg-accent/50 transition-colors gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <RadioGroupItem value="discussion" id="edit-discussion" className="mt-0.5" />
                      <Label htmlFor="edit-discussion" className={`cursor-pointer font-normal ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('studentOnboarding.step5.discussion')}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="learningGoal">{t('studentOnboarding.step5.goalQuestion')}</Label>
                  <Textarea
                    id="learningGoal"
                    value={questions.learning_goal}
                    onChange={(e) => setQuestions({ ...questions, learning_goal: e.target.value })}
                    placeholder={
                      questions.learning_goal ||
                      t('studentOnboarding.step5.goalPlaceholder')
                    }
                    rows={3}
                    className={!questions.learning_goal ? 'text-muted-foreground' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialNeeds">
                    {t('studentOnboarding.step6.specialNeedsQuestion')}
                  </Label>
                  <Textarea
                    id="specialNeeds"
                    value={questions.special_needs}
                    onChange={(e) => setQuestions({ ...questions, special_needs: e.target.value })}
                    placeholder={
                      questions.special_needs ||
                      t('studentOnboarding.step6.specialNeedsPlaceholder')
                    }
                    rows={3}
                    className={!questions.special_needs ? 'text-muted-foreground' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalNotesStudent">{t('studentOnboarding.step6.additionalNotesQuestion')}</Label>
                  <Textarea
                    id="additionalNotesStudent"
                    value={questions.additional_notes}
                    onChange={(e) =>
                      setQuestions({ ...questions, additional_notes: e.target.value })
                    }
                    placeholder={
                      questions.additional_notes ||
                      t('studentOnboarding.step6.additionalNotesPlaceholder')
                    }
                    rows={4}
                    className={!questions.additional_notes ? 'text-muted-foreground' : ''}
                  />
                </div>


                <div className="flex justify-center">
                  <Button onClick={handleSaveQuestions} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className={isRTL ? 'ml-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4 animate-spin'} />
                        {t('settings.saving')}
                      </>
                    ) : (
                      t('settings.saveChanges')
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent >

          {/* Notifications Tab */}
          < TabsContent value="notifications" className="space-y-6" >
            <Card>
              <CardHeader className={isRTL ? 'text-right' : 'text-left'}>
                <CardTitle>{t('settings.notificationPreferences')}</CardTitle>
                <CardDescription>{t('settings.notificationPreferencesDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-0.5">
                      <Label htmlFor="assignment-notifications" className={isRTL ? 'text-right block' : 'text-left block'}>{t('settings.notifications.assignmentNotifications')}</Label>
                      <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('settings.notifications.assignmentNotificationsDesc')}
                      </p>
                    </div>
                    <Switch
                      id="assignment-notifications"
                      checked={notifications.assignment_notifications}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, assignment_notifications: checked })
                      }
                    />
                  </div>

                  <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-0.5">
                      <Label htmlFor="feedback-notifications" className={isRTL ? 'text-right block' : 'text-left block'}>{t('settings.notifications.feedbackNotifications')}</Label>
                      <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('settings.notifications.feedbackNotificationsDesc')}
                      </p>
                    </div>
                    <Switch
                      id="feedback-notifications"
                      checked={notifications.feedback_notifications}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, feedback_notifications: checked })
                      }
                    />
                  </div>

                  <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-0.5">
                      <Label htmlFor="classroom-updates" className={isRTL ? 'text-right block' : 'text-left block'}>{t('settings.notifications.classroomUpdates')}</Label>
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

                  <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-0.5">
                      <Label htmlFor="email-notifications" className={isRTL ? 'text-right block' : 'text-left block'}>{t('settings.notifications.emailNotifications')}</Label>
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


                <div className="flex justify-center">
                  <Button onClick={handleSaveNotifications}>{t('settings.savePreferences')}</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent >
        </Tabs >
      </main >

      <DeleteAccountDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        userRole="student"
      />
    </div >
  );
};

export default StudentSettings;
