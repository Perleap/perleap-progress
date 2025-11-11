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
import { ArrowLeft, User, Bell, Loader2, Camera, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

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

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchSettings();
  }, [user]);

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
      toast.error('File size must be less than 5MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('student-avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        toast.error('Failed to upload photo');
        setUploading(false);
        return;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('student-avatars').getPublicUrl(filePath);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('student_profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
      toast.success('Photo uploaded successfully!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Error uploading photo');
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

      <main className="container py-8 px-4 max-w-4xl">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="questions" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Questions</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.profile')}</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
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
                  <div>
                    <p className="text-sm font-medium">{profile.full_name || 'No name set'}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click camera to upload photo
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('settings.fullName')}</Label>
                  <Input
                    id="fullName"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>

                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Learning Preferences</CardTitle>
                <CardDescription>
                  Update your learning style preferences from onboarding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>What kinds of activities or methods help you learn best?</Label>
                  <RadioGroup
                    value={questions.learning_methods}
                    onValueChange={(v) => setQuestions({ ...questions, learning_methods: v })}
                  >
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="visual" id="edit-visual" className="mt-1" />
                      <Label htmlFor="edit-visual" className="cursor-pointer font-normal">
                        <span className="font-medium">Visual Learning</span> - Reading, diagrams,
                        charts
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="auditory" id="edit-auditory" className="mt-1" />
                      <Label htmlFor="edit-auditory" className="cursor-pointer font-normal">
                        <span className="font-medium">Auditory Learning</span> - Listening to
                        explanations
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="kinesthetic" id="edit-kinesthetic" className="mt-1" />
                      <Label htmlFor="edit-kinesthetic" className="cursor-pointer font-normal">
                        <span className="font-medium">Kinesthetic Learning</span> - Hands-on
                        practice
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="video" id="edit-video" className="mt-1" />
                      <Label htmlFor="edit-video" className="cursor-pointer font-normal">
                        <span className="font-medium">Video Learning</span> - Watching videos
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Solo or group learning?</Label>
                  <RadioGroup
                    value={questions.solo_vs_group}
                    onValueChange={(v) => setQuestions({ ...questions, solo_vs_group: v })}
                  >
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="solo" id="edit-solo" className="mt-1" />
                      <Label htmlFor="edit-solo" className="cursor-pointer font-normal">
                        <span className="font-medium">Solo Learning</span>
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="group" id="edit-group" className="mt-1" />
                      <Label htmlFor="edit-group" className="cursor-pointer font-normal">
                        <span className="font-medium">Group Learning</span>
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="both" id="edit-both" className="mt-1" />
                      <Label htmlFor="edit-both" className="cursor-pointer font-normal">
                        <span className="font-medium">Mix of Both</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Structured schedule or flexible?</Label>
                  <RadioGroup
                    value={questions.scheduled_vs_flexible}
                    onValueChange={(v) => setQuestions({ ...questions, scheduled_vs_flexible: v })}
                  >
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="scheduled" id="edit-scheduled" className="mt-1" />
                      <Label htmlFor="edit-scheduled" className="cursor-pointer font-normal">
                        <span className="font-medium">Structured Schedule</span>
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="flexible" id="edit-flexible" className="mt-1" />
                      <Label htmlFor="edit-flexible" className="cursor-pointer font-normal">
                        <span className="font-medium">Flexible Approach</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>What motivates you to learn?</Label>
                  <RadioGroup
                    value={questions.motivation_factors}
                    onValueChange={(v) => setQuestions({ ...questions, motivation_factors: v })}
                  >
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="curiosity" id="edit-curiosity" className="mt-1" />
                      <Label htmlFor="edit-curiosity" className="cursor-pointer font-normal">
                        Curiosity
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="grades" id="edit-grades" className="mt-1" />
                      <Label htmlFor="edit-grades" className="cursor-pointer font-normal">
                        Achievement & Grades
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem
                        value="encouragement"
                        id="edit-encouragement"
                        className="mt-1"
                      />
                      <Label htmlFor="edit-encouragement" className="cursor-pointer font-normal">
                        Recognition
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem
                        value="personal_goals"
                        id="edit-personal_goals"
                        className="mt-1"
                      />
                      <Label htmlFor="edit-personal_goals" className="cursor-pointer font-normal">
                        Personal Goals
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="competition" id="edit-competition" className="mt-1" />
                      <Label htmlFor="edit-competition" className="cursor-pointer font-normal">
                        Competition
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>When struggling, how can someone help you?</Label>
                  <RadioGroup
                    value={questions.help_preferences}
                    onValueChange={(v) => setQuestions({ ...questions, help_preferences: v })}
                  >
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="hints" id="edit-hints" className="mt-1" />
                      <Label htmlFor="edit-hints" className="cursor-pointer font-normal">
                        Hints to figure it out myself
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem
                        value="different_way"
                        id="edit-different_way"
                        className="mt-1"
                      />
                      <Label htmlFor="edit-different_way" className="cursor-pointer font-normal">
                        Explain differently
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem
                        value="step_by_step"
                        id="edit-step_by_step"
                        className="mt-1"
                      />
                      <Label htmlFor="edit-step_by_step" className="cursor-pointer font-normal">
                        Step-by-step solution
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="more_time" id="edit-more_time" className="mt-1" />
                      <Label htmlFor="edit-more_time" className="cursor-pointer font-normal">
                        More time to figure it out
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>What do you look for in a teacher?</Label>
                  <RadioGroup
                    value={questions.teacher_preferences}
                    onValueChange={(v) => setQuestions({ ...questions, teacher_preferences: v })}
                  >
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="patient" id="edit-patient" className="mt-1" />
                      <Label htmlFor="edit-patient" className="cursor-pointer font-normal">
                        Patient & understanding
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="challenging" id="edit-challenging" className="mt-1" />
                      <Label htmlFor="edit-challenging" className="cursor-pointer font-normal">
                        Pushes me to achieve
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="clear" id="edit-clear" className="mt-1" />
                      <Label htmlFor="edit-clear" className="cursor-pointer font-normal">
                        Explains clearly
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="fun" id="edit-fun" className="mt-1" />
                      <Label htmlFor="edit-fun" className="cursor-pointer font-normal">
                        Makes learning fun
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>How do you prefer feedback?</Label>
                  <RadioGroup
                    value={questions.feedback_preferences}
                    onValueChange={(v) => setQuestions({ ...questions, feedback_preferences: v })}
                  >
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="immediate" id="edit-immediate" className="mt-1" />
                      <Label htmlFor="edit-immediate" className="cursor-pointer font-normal">
                        Immediate feedback
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="written" id="edit-written" className="mt-1" />
                      <Label htmlFor="edit-written" className="cursor-pointer font-normal">
                        Written comments
                      </Label>
                    </div>
                    <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="discussion" id="edit-discussion" className="mt-1" />
                      <Label htmlFor="edit-discussion" className="cursor-pointer font-normal">
                        Discussion with teacher
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="learningGoal">What is one goal you hope to achieve?</Label>
                  <Textarea
                    id="learningGoal"
                    value={questions.learning_goal}
                    onChange={(e) => setQuestions({ ...questions, learning_goal: e.target.value })}
                    placeholder={
                      questions.learning_goal ||
                      'e.g., Improve my grade, master a skill, gain confidence...'
                    }
                    rows={3}
                    className={!questions.learning_goal ? 'text-muted-foreground' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialNeeds">
                    Do you have any specific needs or preferences?
                  </Label>
                  <Textarea
                    id="specialNeeds"
                    value={questions.special_needs}
                    onChange={(e) => setQuestions({ ...questions, special_needs: e.target.value })}
                    placeholder={
                      questions.special_needs ||
                      'e.g., Short breaks, visual aids, quiet environment...'
                    }
                    rows={3}
                    className={!questions.special_needs ? 'text-muted-foreground' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalNotesStudent">Anything else we should know?</Label>
                  <Textarea
                    id="additionalNotesStudent"
                    value={questions.additional_notes}
                    onChange={(e) =>
                      setQuestions({ ...questions, additional_notes: e.target.value })
                    }
                    placeholder={
                      questions.additional_notes ||
                      'Any other comments, learning difficulties, or preferences...'
                    }
                    rows={4}
                    className={!questions.additional_notes ? 'text-muted-foreground' : ''}
                  />
                </div>

                <Button onClick={handleSaveQuestions} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Manage how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="assignment-notifications">Assignment Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when new assignments are posted
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

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="feedback-notifications">Feedback Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when you receive feedback on your work
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

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="classroom-updates">Classroom Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified about general classroom announcements
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

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-notifications">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications via email
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

                <Button onClick={handleSaveNotifications}>Save Preferences</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default StudentSettings;
