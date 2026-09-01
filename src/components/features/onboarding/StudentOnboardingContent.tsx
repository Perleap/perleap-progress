import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  StudentOnboardingStep1Section,
  StudentOnboardingStep2Section,
  StudentOnboardingStep3Section,
  StudentOnboardingStep4Section,
  StudentOnboardingStep5Section,
  StudentOnboardingStep6Section,
} from './StudentOnboardingStepSections';
import type { StudentOnboardingFormData } from './studentOnboardingTypes';
import { ThemeToggle } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import {
  cleanupOrphanedProfilesByEmail,
  insertStudentOnboardingProfile,
  uploadOnboardingAvatar,
} from '@/services/onboardingService';
import { markSignupComplete } from '@/utils/sessionState';

export const StudentOnboardingContent = () => {
  const { t } = useTranslation();
  const { isRTL, language = 'en' } = useLanguage();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const totalSteps = 6;
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  const [formData, setFormData] = useState<StudentOnboardingFormData>({
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

  const updateFormData = (patch: Partial<StudentOnboardingFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  };

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
      if (user.email) {
        await cleanupOrphanedProfilesByEmail(user.email);
      }

      let avatarPath: string | null = null;
      if (avatarFile) {
        avatarPath = await uploadOnboardingAvatar(user.id, avatarFile, 'student-avatars');
        if (!avatarPath) {
          toast.error(t('studentOnboarding.errors.uploadAvatar'));
        }
      }

      const { error } = await insertStudentOnboardingProfile(
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

      // Mark signup as complete
      markSignupComplete();

      // Force refresh the profile in AuthContext
      await refreshProfile(true);

      toast.success(t('studentOnboarding.success.profileCreated'));

      // Navigate directly to dashboard with replace to prevent back navigation
      navigate('/student/dashboard', { replace: true });
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      console.error('Student onboarding error:', error);

      // Check for dual profile trigger error from database
      if (err.message?.includes('already has a teacher profile')) {
        toast.error(
          t('studentOnboarding.errors.alreadyHasTeacherProfile') ||
            'You already have a teacher account. You cannot create a student account.'
        );
        setTimeout(() => navigate('/teacher/dashboard'), 2000);
      } else if (err.code === '23505') {
        // Duplicate key - profile already exists
        toast.error(t('studentOnboarding.errors.profileExists'));
        setTimeout(() => navigate('/student/dashboard'), 2000);
      } else if (err.code === '42703') {
        // Undefined column
        console.error('Database schema mismatch - column does not exist:', err);
        toast.error(
          'Database error: Some fields are not configured properly. Please contact support.'
        );
      } else if (err.message?.includes('violates not-null constraint')) {
        // Missing required field
        console.error('Missing required field:', err);
        toast.error('Please fill in all required fields.');
      } else {
        toast.error(
          error instanceof Error ? error.message : t('studentOnboarding.errors.createProfile')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    const stepProps = { isRTL, formData, onFormDataChange: updateFormData };

    const stepMap: Record<number, React.ReactNode> = {
      1: (
        <StudentOnboardingStep1Section
          {...stepProps}
          avatarPreview={avatarPreview}
          onAvatarChange={handleAvatarChange}
        />
      ),
      2: <StudentOnboardingStep2Section {...stepProps} />,
      3: <StudentOnboardingStep3Section {...stepProps} />,
      4: <StudentOnboardingStep4Section {...stepProps} />,
      5: <StudentOnboardingStep5Section {...stepProps} />,
      6: <StudentOnboardingStep6Section {...stepProps} />,
    };

    return stepMap[step] ?? null;
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
                {isRTL ? (
                  <ArrowRight className="mr-2 h-4 w-4" />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" />
                )}
                {t('studentOnboarding.back')}
              </Button>
            )}
            {step < totalSteps ? (
              <Button onClick={() => setStep(step + 1)} className="flex-1">
                {t('studentOnboarding.next')}
                {isRTL ? (
                  <ArrowLeft className="ml-2 h-4 w-4" />
                ) : (
                  <ArrowRight className="ml-2 h-4 w-4" />
                )}
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
