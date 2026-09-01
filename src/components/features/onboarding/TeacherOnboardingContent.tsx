import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  TeacherOnboardingStep1Section,
  TeacherOnboardingStep2Section,
} from './TeacherOnboardingStepSections';
import type { TeacherOnboardingFormData } from './teacherOnboardingTypes';
import { ThemeToggle } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import {
  cleanupOrphanedProfilesByEmail,
  insertTeacherOnboardingProfile,
  uploadOnboardingAvatar,
} from '@/services/onboardingService';
import { markSignupComplete } from '@/utils/sessionState';

export const TeacherOnboardingContent = () => {
  const { t } = useTranslation();
  const { isRTL, language = 'en' } = useLanguage();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 2;
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  const [formData, setFormData] = useState<TeacherOnboardingFormData>({
    fullName: '',
    phoneNumber: '',
    subjects: '',
    yearsExperience: '',
    studentEducationLevel: '',
    teachingGoals: '',
    teachingStyle: '',
    teachingExample: '',
    additionalNotes: '',
  });

  const updateFormData = (patch: Partial<TeacherOnboardingFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  };

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
      if (user.email) {
        await cleanupOrphanedProfilesByEmail(user.email);
      }

      let avatarPath: string | null = null;
      if (avatarFile) {
        avatarPath = await uploadOnboardingAvatar(user.id, avatarFile, 'teacher-avatars');
        if (!avatarPath) {
          toast.error(t('teacherOnboarding.errors.uploadAvatar'));
        }
      }

      const { error } = await insertTeacherOnboardingProfile(
        user.id,
        user.email,
        formData,
        language,
        avatarPath
      );

      if (error) {
        console.error('Profile creation error:', error);
        throw error;
      }

      markSignupComplete();
      await refreshProfile(true);

      toast.success(t('teacherOnboarding.success.profileCreated'));
      navigate('/teacher/dashboard', { replace: true });
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      console.error('Teacher onboarding error:', error);

      if (err.message?.includes('already has a student profile')) {
        toast.error(
          t('teacherOnboarding.errors.alreadyHasStudentProfile') ||
            'You already have a student account. You cannot create a teacher account.'
        );
        setTimeout(() => navigate('/student/dashboard'), 2000);
      } else if (err.code === '23505') {
        toast.error(t('teacherOnboarding.errors.profileExists'));
        setTimeout(() => navigate('/teacher/dashboard'), 2000);
      } else if (err.code === '42703') {
        console.error('Database schema mismatch - column does not exist:', err);
        toast.error(
          'Database error: Some fields are not configured properly. Please contact support.'
        );
      } else if (err.message?.includes('violates not-null constraint')) {
        console.error('Missing required field:', err);
        toast.error('Please fill in all required fields.');
      } else {
        toast.error(
          error instanceof Error ? error.message : t('teacherOnboarding.errors.createProfile')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const stepSections = {
    1: (
      <TeacherOnboardingStep1Section
        isRTL={isRTL}
        formData={formData}
        onFormDataChange={updateFormData}
        avatarPreview={avatarPreview}
        onAvatarChange={handleAvatarChange}
      />
    ),
    2: (
      <TeacherOnboardingStep2Section
        isRTL={isRTL}
        formData={formData}
        onFormDataChange={updateFormData}
      />
    ),
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
          <div className="max-h-[60vh] overflow-y-auto px-1">
            {stepSections[step as keyof typeof stepSections] ?? null}
          </div>

          <div className="flex gap-4 mt-6">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                {isRTL ? (
                  <ArrowRight className="mr-2 h-4 w-4" />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" />
                )}
                {t('teacherOnboarding.back')}
              </Button>
            )}
            {step < totalSteps ? (
              <Button onClick={() => setStep(step + 1)} className="flex-1">
                {t('teacherOnboarding.next')}
                {isRTL ? (
                  <ArrowLeft className="ml-2 h-4 w-4" />
                ) : (
                  <ArrowRight className="ml-2 h-4 w-4" />
                )}
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
