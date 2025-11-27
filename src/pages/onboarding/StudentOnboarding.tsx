import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ArrowLeft, ArrowRight, Upload } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';

const StudentOnboarding = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 6;
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  const [formData, setFormData] = useState({
    fullName: '',
    learningMethods: '',
    soloVsGroup: '',
    scheduledVsFlexible: '',
    motivationFactors: '',
    helpPreferences: '',
    teacherPreferences: '',
    feedbackPreferences: '',
    learningGoal: '',
    specialNeeds: '',
    additionalNotes: '',
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('studentOnboarding.errors.fileSize'));
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async () => {
    if (!user) {
      toast.error(t('studentOnboarding.errors.notAuthenticated'));
      return;
    }

    setLoading(true);
    try {
      let avatarUrl = '';

      // Upload avatar if provided
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('student-avatars')
          .upload(fileName, avatarFile);

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('student-avatars').getPublicUrl(fileName);
          avatarUrl = publicUrl;
        } else {
          toast.error(t('studentOnboarding.errors.uploadAvatar'));
        }
      }

      // Create student profile with preferences
      const { error } = await supabase.from('student_profiles').insert({
        user_id: user.id,
        email: user.email,
        full_name: formData.fullName,
        avatar_url: avatarUrl || null,
        learning_methods: formData.learningMethods,
        solo_vs_group: formData.soloVsGroup,
        scheduled_vs_flexible: formData.scheduledVsFlexible,
        motivation_factors: formData.motivationFactors,
        help_preferences: formData.helpPreferences,
        teacher_preferences: formData.teacherPreferences,
        feedback_preferences: formData.feedbackPreferences,
        learning_goal: formData.learningGoal,
        special_needs: formData.specialNeeds,
        additional_notes: formData.additionalNotes,
        preferences_quiz: {
          learningMethods: formData.learningMethods,
          soloVsGroup: formData.soloVsGroup,
          scheduledVsFlexible: formData.scheduledVsFlexible,
          motivationFactors: formData.motivationFactors,
        },
        mentor_tone_ref: 'supportive',
      });

      if (error) throw error;

      toast.success(t('studentOnboarding.success.profileCreated'));
      navigate('/student/dashboard');
    } catch (error) {
      if (error.code === '23505') {
        toast.error(t('studentOnboarding.errors.profileExists'));
        setTimeout(() => navigate('/student/dashboard'), 2000);
      } else {
        toast.error(error.message || t('studentOnboarding.errors.createProfile'));
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('studentOnboarding.step1.fullName')}</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                autoDirection
              />
            </div>

            <div className="space-y-2">
              <Label>{t('studentOnboarding.step1.profilePicture')}</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  {avatarPreview ? (
                    <AvatarImage src={avatarPreview} alt="Preview" />
                  ) : (
                    <AvatarFallback>
                      {formData.fullName
                        ? formData.fullName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                        : 'S'}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1">
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    autoDirection
                  />
                  <Label htmlFor="avatar" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md transition-colors w-fit">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">{t('studentOnboarding.step1.uploadPhoto')}</span>
                    </div>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('studentOnboarding.step1.fileSize')}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4 mt-6">
              <Label>{t('studentOnboarding.step1.learningMethodsQuestion')}</Label>
              <RadioGroup
                value={formData.learningMethods}
                onValueChange={(v) => setFormData({ ...formData, learningMethods: v })}
              >
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="visual" id="visual" className="mt-1" />
                  <Label htmlFor="visual" className="cursor-pointer font-normal leading-relaxed">
                    <span className="font-medium">{t('studentOnboarding.step1.visual')}</span> -{' '}
                    {t('studentOnboarding.step1.visualDesc')}
                  </Label>
                </div>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="auditory" id="auditory" className="mt-1" />
                  <Label htmlFor="auditory" className="cursor-pointer font-normal leading-relaxed">
                    <span className="font-medium">{t('studentOnboarding.step1.auditory')}</span> -{' '}
                    {t('studentOnboarding.step1.auditoryDesc')}
                  </Label>
                </div>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="kinesthetic" id="kinesthetic" className="mt-1" />
                  <Label
                    htmlFor="kinesthetic"
                    className="cursor-pointer font-normal leading-relaxed"
                  >
                    <span className="font-medium">{t('studentOnboarding.step1.kinesthetic')}</span>{' '}
                    - {t('studentOnboarding.step1.kinestheticDesc')}
                  </Label>
                </div>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="video" id="video" className="mt-1" />
                  <Label htmlFor="video" className="cursor-pointer font-normal leading-relaxed">
                    <span className="font-medium">{t('studentOnboarding.step1.video')}</span> -{' '}
                    {t('studentOnboarding.step1.videoDesc')}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Label>{t('studentOnboarding.step2.soloVsGroupQuestion')}</Label>
            <RadioGroup
              value={formData.soloVsGroup}
              onValueChange={(v) => setFormData({ ...formData, soloVsGroup: v })}
            >
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="solo" id="solo" className="mt-1" />
                <Label htmlFor="solo" className="cursor-pointer font-normal leading-relaxed">
                  <span className="font-medium">{t('studentOnboarding.step2.solo')}</span> -{' '}
                  {t('studentOnboarding.step2.soloDesc')}
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="group" id="group" className="mt-1" />
                <Label htmlFor="group" className="cursor-pointer font-normal leading-relaxed">
                  <span className="font-medium">{t('studentOnboarding.step2.group')}</span> -{' '}
                  {t('studentOnboarding.step2.groupDesc')}
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="both" id="both" className="mt-1" />
                <Label htmlFor="both" className="cursor-pointer font-normal leading-relaxed">
                  <span className="font-medium">{t('studentOnboarding.step2.both')}</span> -{' '}
                  {t('studentOnboarding.step2.bothDesc')}
                </Label>
              </div>
            </RadioGroup>

            <div className="mt-6">
              <Label>{t('studentOnboarding.step2.scheduledVsFlexibleQuestion')}</Label>
              <RadioGroup
                value={formData.scheduledVsFlexible}
                onValueChange={(v) => setFormData({ ...formData, scheduledVsFlexible: v })}
                className="mt-4"
              >
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="scheduled" id="scheduled" className="mt-1" />
                  <Label htmlFor="scheduled" className="cursor-pointer font-normal leading-relaxed">
                    <span className="font-medium">{t('studentOnboarding.step2.scheduled')}</span> -{' '}
                    {t('studentOnboarding.step2.scheduledDesc')}
                  </Label>
                </div>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="flexible" id="flexible" className="mt-1" />
                  <Label htmlFor="flexible" className="cursor-pointer font-normal leading-relaxed">
                    <span className="font-medium">{t('studentOnboarding.step2.flexible')}</span> -{' '}
                    {t('studentOnboarding.step2.flexibleDesc')}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <Label>{t('studentOnboarding.step3.motivationQuestion')}</Label>
            <RadioGroup
              value={formData.motivationFactors}
              onValueChange={(v) => setFormData({ ...formData, motivationFactors: v })}
            >
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="curiosity" id="curiosity" className="mt-1" />
                <Label htmlFor="curiosity" className="cursor-pointer font-normal leading-relaxed">
                  <span className="font-medium">{t('studentOnboarding.step3.curiosity')}</span> -{' '}
                  {t('studentOnboarding.step3.curiosityDesc')}
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="grades" id="grades" className="mt-1" />
                <Label htmlFor="grades" className="cursor-pointer font-normal leading-relaxed">
                  <span className="font-medium">{t('studentOnboarding.step3.grades')}</span> -{' '}
                  {t('studentOnboarding.step3.gradesDesc')}
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="encouragement" id="encouragement" className="mt-1" />
                <Label
                  htmlFor="encouragement"
                  className="cursor-pointer font-normal leading-relaxed"
                >
                  <span className="font-medium">{t('studentOnboarding.step3.encouragement')}</span>{' '}
                  - {t('studentOnboarding.step3.encouragementDesc')}
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="personal_goals" id="personal_goals" className="mt-1" />
                <Label
                  htmlFor="personal_goals"
                  className="cursor-pointer font-normal leading-relaxed"
                >
                  <span className="font-medium">{t('studentOnboarding.step3.personalGoals')}</span>{' '}
                  - {t('studentOnboarding.step3.personalGoalsDesc')}
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="competition" id="competition" className="mt-1" />
                <Label htmlFor="competition" className="cursor-pointer font-normal leading-relaxed">
                  <span className="font-medium">{t('studentOnboarding.step3.competition')}</span> -{' '}
                  {t('studentOnboarding.step3.competitionDesc')}
                </Label>
              </div>
            </RadioGroup>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <Label>{t('studentOnboarding.step4.helpQuestion')}</Label>
            <RadioGroup
              value={formData.helpPreferences}
              onValueChange={(v) => setFormData({ ...formData, helpPreferences: v })}
            >
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="hints" id="hints" className="mt-1" />
                <Label htmlFor="hints" className="cursor-pointer font-normal leading-relaxed">
                  {t('studentOnboarding.step4.hints')}
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="different_way" id="different_way" className="mt-1" />
                <Label
                  htmlFor="different_way"
                  className="cursor-pointer font-normal leading-relaxed"
                >
                  {t('studentOnboarding.step4.differentWay')}
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="step_by_step" id="step_by_step" className="mt-1" />
                <Label
                  htmlFor="step_by_step"
                  className="cursor-pointer font-normal leading-relaxed"
                >
                  {t('studentOnboarding.step4.stepByStep')}
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="more_time" id="more_time" className="mt-1" />
                <Label htmlFor="more_time" className="cursor-pointer font-normal leading-relaxed">
                  {t('studentOnboarding.step4.moreTime')}
                </Label>
              </div>
            </RadioGroup>

            <div className="mt-6">
              <Label>{t('studentOnboarding.step4.teacherQuestion')}</Label>
              <RadioGroup
                value={formData.teacherPreferences}
                onValueChange={(v) => setFormData({ ...formData, teacherPreferences: v })}
                className="mt-4"
              >
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="patient" id="patient" className="mt-1" />
                  <Label htmlFor="patient" className="cursor-pointer font-normal leading-relaxed">
                    {t('studentOnboarding.step4.patient')}
                  </Label>
                </div>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="challenging" id="challenging" className="mt-1" />
                  <Label
                    htmlFor="challenging"
                    className="cursor-pointer font-normal leading-relaxed"
                  >
                    {t('studentOnboarding.step4.challenging')}
                  </Label>
                </div>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="clear" id="clear" className="mt-1" />
                  <Label htmlFor="clear" className="cursor-pointer font-normal leading-relaxed">
                    {t('studentOnboarding.step4.clear')}
                  </Label>
                </div>
                <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="fun" id="fun" className="mt-1" />
                  <Label htmlFor="fun" className="cursor-pointer font-normal leading-relaxed">
                    {t('studentOnboarding.step4.fun')}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <Label>{t('studentOnboarding.step5.feedbackQuestion')}</Label>
            <RadioGroup
              value={formData.feedbackPreferences}
              onValueChange={(v) => setFormData({ ...formData, feedbackPreferences: v })}
            >
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="immediate" id="immediate" className="mt-1" />
                <Label htmlFor="immediate" className="cursor-pointer font-normal leading-relaxed">
                  {t('studentOnboarding.step5.immediate')}
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="written" id="written" className="mt-1" />
                <Label htmlFor="written" className="cursor-pointer font-normal leading-relaxed">
                  {t('studentOnboarding.step5.written')}
                </Label>
              </div>
              <div className="flex items-start space-x-2 p-4 rounded-2xl border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="discussion" id="discussion" className="mt-1" />
                <Label htmlFor="discussion" className="cursor-pointer font-normal leading-relaxed">
                  {t('studentOnboarding.step5.discussion')}
                </Label>
              </div>
            </RadioGroup>

            <div className="space-y-2 mt-6">
              <Label htmlFor="learningGoal">{t('studentOnboarding.step5.goalQuestion')}</Label>
              <Textarea
                id="learningGoal"
                placeholder={t('studentOnboarding.step5.goalPlaceholder')}
                value={formData.learningGoal}
                onChange={(e) => setFormData({ ...formData, learningGoal: e.target.value })}
                rows={3}
                autoDirection
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="specialNeeds">
                {t('studentOnboarding.step6.specialNeedsQuestion')}
              </Label>
              <Textarea
                id="specialNeeds"
                placeholder={t('studentOnboarding.step6.specialNeedsPlaceholder')}
                value={formData.specialNeeds}
                onChange={(e) => setFormData({ ...formData, specialNeeds: e.target.value })}
                rows={3}
                autoDirection
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="additionalNotes">
                {t('studentOnboarding.step6.additionalNotesQuestion')}
              </Label>
              <Textarea
                id="additionalNotes"
                placeholder={t('studentOnboarding.step6.additionalNotesPlaceholder')}
                value={formData.additionalNotes}
                onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                rows={4}
                autoDirection
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>{t('studentOnboarding.title')}</CardTitle>
          <CardDescription>
            {t('studentOnboarding.stepOf', { current: step, total: totalSteps })}
          </CardDescription>
          <div className="w-full bg-secondary rounded-full h-2 mt-4">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[60vh] overflow-y-auto px-1">{renderStep()}</div>

          <div className="flex gap-4 mt-6">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('studentOnboarding.back')}
              </Button>
            )}
            {step < totalSteps ? (
              <Button onClick={() => setStep(step + 1)} className="flex-1">
                {t('studentOnboarding.next')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                className="flex-1"
                disabled={loading || !formData.fullName}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('studentOnboarding.completeSetup')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentOnboarding;
