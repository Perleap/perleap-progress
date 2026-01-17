import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { BreathingBackground } from '@/components/ui/BreathingBackground';
import { updateUserRole, clearPendingRole, resetRecoveryAttempts } from '@/utils/roleRecovery';

/**
 * Role Selection Recovery Page
 * 
 * This page is shown when a user has an auth account but no role metadata.
 * This can happen if registration was interrupted or failed to complete.
 * 
 * The user selects their role, we update their metadata, and redirect to onboarding.
 */
const RoleSelection = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<'teacher' | 'student' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedRole) {
      toast.error(t('roleSelection.errors.selectRole'));
      return;
    }

    setLoading(true);
    try {
      console.log('🎭 RoleSelection: User selected role:', selectedRole);

      // Update user's role metadata
      const success = await updateUserRole(selectedRole);

      if (!success) {
        toast.error(t('roleSelection.errors.updateFailed'));
        setLoading(false);
        return;
      }

      // Clear any pending role from localStorage
      clearPendingRole();
      resetRecoveryAttempts();

      // Show success message
      toast.success(t('roleSelection.success.roleSet'));

      // Redirect to onboarding for the selected role
      console.log(`🚀 RoleSelection: Redirecting to /onboarding/${selectedRole}`);
      navigate(`/onboarding/${selectedRole}`, { replace: true });

    } catch (error) {
      console.error('❌ RoleSelection: Error setting role:', error);
      toast.error(t('roleSelection.errors.unexpected'));
      setLoading(false);
    }
  };

  return (
    <BreathingBackground className="flex items-center justify-center min-h-screen p-4">
      <div className="absolute top-8 end-8 z-20 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl animate-fade-in relative z-10">
        <Card className="shadow-2xl bg-card/95 dark:bg-card/90 backdrop-blur-2xl border-border/50 rounded-[2.5rem]">
          <CardHeader className="text-center pb-8 pt-12 px-12">
            <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm mb-6 mx-auto">
              <img src="/perleap_logo.png" alt="PerLeap" className="h-12 w-12 object-contain" />
            </div>
            <CardTitle className="text-3xl font-bold mb-3" dir={isRTL ? 'rtl' : 'ltr'}>
              {t('roleSelection.title')}
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
              {t('roleSelection.description')}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-12 pb-12" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Button
                  type="button"
                  variant={selectedRole === 'teacher' ? 'default' : 'outline'}
                  onClick={() => setSelectedRole('teacher')}
                  disabled={loading}
                  className={`h-24 flex flex-col items-center justify-center gap-2 rounded-xl transition-all ${
                    selectedRole === 'teacher'
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/10 shadow-xl scale-[1.02]'
                      : 'bg-card hover:bg-muted/50 border-input hover:border-border text-muted-foreground shadow-sm'
                  }`}
                >
                  <span className="text-4xl">👨‍🏫</span>
                  <span className="font-semibold text-xl">{t('roleSelection.teacher')}</span>
                </Button>

                <Button
                  type="button"
                  variant={selectedRole === 'student' ? 'default' : 'outline'}
                  onClick={() => setSelectedRole('student')}
                  disabled={loading}
                  className={`h-24 flex flex-col items-center justify-center gap-2 rounded-xl transition-all ${
                    selectedRole === 'student'
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/10 shadow-xl scale-[1.02]'
                      : 'bg-card hover:bg-muted/50 border-input hover:border-border text-muted-foreground shadow-sm'
                  }`}
                >
                  <span className="text-4xl">👨‍🎓</span>
                  <span className="font-semibold text-xl">{t('roleSelection.student')}</span>
                </Button>
              </div>

              <Button
                onClick={handleContinue}
                disabled={!selectedRole || loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-14 text-xl font-semibold shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all"
              >
                {loading && <Loader2 className="me-3 h-6 w-6 animate-spin" />}
                {t('roleSelection.continue')}
              </Button>

              <p className="text-sm text-muted-foreground text-center mt-6">
                {t('roleSelection.note')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </BreathingBackground>
  );
};

export default RoleSelection;

