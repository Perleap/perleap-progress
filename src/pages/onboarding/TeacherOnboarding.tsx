import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ArrowLeft, ArrowRight, Upload } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { markSignupComplete } from '@/utils/sessionState';

const TeacherOnboarding = () => {
  const { t } = useTranslation();
  const { isRTL, language = 'en' } = useLanguage();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 2;
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  const [formData, setFormData] = useState({
    // Page 1: Essential Profile
    fullName: '',
    phoneNumber: '',
    subjects: '',
    yearsExperience: '',
    studentEducationLevel: '',

    // Page 2: Teaching Voice
    teachingGoals: '',
    teachingStyle: '',
    teachingExample: '',
    additionalNotes: '',
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('teacherOnboarding.errors.fileSize'));
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

  const handleSubmit = async () => {
    if (!user) {
      toast.error(t('teacherOnboarding.errors.notAuthenticated'));
      return;
    }

    setLoading(true);
    try {

      // Check for orphaned profile with same email but different user_id
      if (user.email) {
        const { data: orphanedProfile } = await supabase
          .from('teacher_profiles')
          .select('user_id, email')
          .eq('email', user.email)
          .maybeSingle();

        if (orphanedProfile && orphanedProfile.user_id !== user.id) {
          console.warn('Found orphaned profile with same email, cleaning up...');
          // Delete the orphaned profile
          await supabase
            .from('teacher_profiles')
            .delete()
            .eq('email', user.email)
            .neq('user_id', user.id);
        }
      }

      let avatarUrl = '';

      // Upload avatar if provided
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('teacher-avatars')
          .upload(fileName, avatarFile);

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('teacher-avatars').getPublicUrl(fileName);
          avatarUrl = publicUrl;
        } else {
          toast.error(t('teacherOnboarding.errors.uploadAvatar'));
        }
      }

      console.log('Creating teacher profile with language:', language);
      
      const profileData = {
        user_id: user.id,
        email: user.email,
        full_name: formData.fullName,
        avatar_url: avatarUrl || null,
        phone_number: formData.phoneNumber,
        subjects: formData.subjects.split(',').map((s) => s.trim()),
        years_experience: parseInt(formData.yearsExperience) || 0,
        student_education_level: formData.studentEducationLevel,
        teaching_goals: formData.teachingGoals,
        style_notes: formData.teachingStyle,
        teaching_examples: formData.teachingExample,
        sample_explanation: formData.additionalNotes,
        preferred_language: language || 'en', // Fallback to 'en' if language is undefined
      };
      
      console.log('Profile data to insert:', profileData);
      
      const { data, error } = await supabase.from('teacher_profiles').insert(profileData).select();

      if (error) {
        console.error('Profile creation error:', error);
        throw error;
      }
      
      console.log('Profile created successfully:', data);

      // Mark signup as complete
      markSignupComplete();

      // Force refresh the profile in AuthContext
      await refreshProfile(true);

      toast.success(t('teacherOnboarding.success.profileCreated'));
      
      // Navigate directly to dashboard with replace to prevent back navigation
      navigate('/teacher/dashboard', { replace: true });
    } catch (error: any) {
      console.error('Teacher onboarding error:', error);
      
      // Check for dual profile trigger error from database
      if (error.message?.includes('already has a student profile')) {
        toast.error(t('teacherOnboarding.errors.alreadyHasStudentProfile') || 'You already have a student account. You cannot create a teacher account.');
        setTimeout(() => navigate('/student/dashboard'), 2000);
      } else if (error.code === '23505') {
        // Duplicate key - profile already exists
        toast.error(t('teacherOnboarding.errors.profileExists'));
        setTimeout(() => navigate('/teacher/dashboard'), 2000);
      } else if (error.code === '42703') {
        // Undefined column
        console.error('Database schema mismatch - column does not exist:', error);
        toast.error('Database error: Some fields are not configured properly. Please contact support.');
      } else if (error.message?.includes('violates not-null constraint')) {
        // Missing required field
        console.error('Missing required field:', error);
        toast.error('Please fill in all required fields.');
      } else {
        toast.error(error.message || t('teacherOnboarding.errors.createProfile'));
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('teacherOnboarding.step1.fullName')}</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                placeholder={t('teacherOnboarding.step1.fullNamePlaceholder')}
                autoDirection
                dir={isRTL ? 'rtl' : 'ltr'}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('teacherOnboarding.step1.profilePicture')}</Label>
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
                        : 'T'}
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
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                  <Label htmlFor="avatar" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md transition-colors w-fit">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">{t('teacherOnboarding.step1.uploadPhoto')}</span>
                    </div>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('teacherOnboarding.step1.fileSize')}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">{t('teacherOnboarding.step1.phoneNumber')}</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder={t('teacherOnboarding.step1.phoneNumberPlaceholder')}
                autoDirection
                dir={isRTL ? 'rtl' : 'ltr'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subjects">{t('teacherOnboarding.step1.subjects')}</Label>
              <Input
                id="subjects"
                placeholder={t('teacherOnboarding.step1.subjectsPlaceholder')}
                value={formData.subjects}
                onChange={(e) => setFormData({ ...formData, subjects: e.target.value })}
                required
                autoDirection
                dir={isRTL ? 'rtl' : 'ltr'}
              />
              <p className="text-xs text-muted-foreground">
                {t('teacherOnboarding.step1.subjectsHelp')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="yearsExperience">
                {t('teacherOnboarding.step1.yearsExperience')}
              </Label>
              <Input
                id="yearsExperience"
                type="number"
                min="0"
                value={formData.yearsExperience}
                onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
                required
                placeholder={t('teacherOnboarding.step1.yearsExperiencePlaceholder')}
                autoDirection
                dir={isRTL ? 'rtl' : 'ltr'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="studentEducationLevel">
                {t('teacherOnboarding.step1.studentLevel')}
              </Label>
              <Input
                id="studentEducationLevel"
                placeholder={t('teacherOnboarding.step1.studentLevelPlaceholder')}
                value={formData.studentEducationLevel}
                autoDirection
                dir={isRTL ? 'rtl' : 'ltr'}
                onChange={(e) =>
                  setFormData({ ...formData, studentEducationLevel: e.target.value })
                }
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="teachingGoals">
                {t('teacherOnboarding.step2.teachingGoalsQuestion')}
              </Label>
              <Textarea
                id="teachingGoals"
                placeholder={t('teacherOnboarding.step2.teachingGoalsPlaceholder')}
                value={formData.teachingGoals}
                onChange={(e) => setFormData({ ...formData, teachingGoals: e.target.value })}
                rows={3}
                autoDirection
                dir={isRTL ? 'rtl' : 'ltr'}
              />
              <p className="text-xs text-muted-foreground">
                {t('teacherOnboarding.step2.teachingGoalsHelp')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teachingStyle">
                {t('teacherOnboarding.step2.teachingStyleQuestion')}
              </Label>
              <Textarea
                id="teachingStyle"
                placeholder={t('teacherOnboarding.step2.teachingStylePlaceholder')}
                value={formData.teachingStyle}
                onChange={(e) => setFormData({ ...formData, teachingStyle: e.target.value })}
                rows={4}
                autoDirection
                dir={isRTL ? 'rtl' : 'ltr'}
              />
              <p className="text-xs text-muted-foreground">
                {t('teacherOnboarding.step2.teachingStyleHelp')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teachingExample">
                {t('teacherOnboarding.step2.teachingExampleQuestion')}
              </Label>
              <Textarea
                id="teachingExample"
                placeholder={t('teacherOnboarding.step2.teachingExamplePlaceholder')}
                value={formData.teachingExample}
                onChange={(e) => setFormData({ ...formData, teachingExample: e.target.value })}
                rows={4}
                autoDirection
                dir={isRTL ? 'rtl' : 'ltr'}
              />
              <p className="text-xs text-muted-foreground">
                {t('teacherOnboarding.step2.teachingExampleHelp')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="additionalNotes">
                {t('teacherOnboarding.step2.additionalNotesQuestion')}
              </Label>
              <Textarea
                id="additionalNotes"
                placeholder={t('teacherOnboarding.step2.additionalNotesPlaceholder')}
                value={formData.additionalNotes}
                onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                rows={3}
                autoDirection
                dir={isRTL ? 'rtl' : 'ltr'}
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
          <CardTitle>{t('teacherOnboarding.title')}</CardTitle>
          <CardDescription>
            {t('teacherOnboarding.stepOf', { current: step, total: totalSteps })}{' '}
            {step === 1 ? t('teacherOnboarding.step1Title') : t('teacherOnboarding.step2Title')}
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
                {isRTL ? <ArrowRight className="mr-2 h-4 w-4" /> : <ArrowLeft className="mr-2 h-4 w-4" />}
                {t('teacherOnboarding.back')}
              </Button>
            )}
            {step < totalSteps ? (
              <Button onClick={() => setStep(step + 1)} className="flex-1">
                {t('teacherOnboarding.next')}
                {isRTL ? <ArrowLeft className="ml-2 h-4 w-4" /> : <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                className="flex-1"
                disabled={
                  loading || !formData.fullName || !formData.subjects || !formData.yearsExperience
                }
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('teacherOnboarding.completeSetup')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherOnboarding;
