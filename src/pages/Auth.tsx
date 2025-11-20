import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';

const Auth = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  // Dynamic validation schemas using translation
  const emailSchema = z.string().email(t('auth.errors.invalidEmail'));
  const passwordSchema = z.string().min(6, t('auth.errors.passwordTooShort'));
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'teacher' | 'student' | null>(null);
  const [activeTab, setActiveTab] = useState<string>('signin');
  const navigate = useNavigate();

  // Check if user is already authenticated and redirect
  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      if (!authLoading && user) {
        console.log('🔍 Auth: Checking authenticated user profile status...');
        
        const userRole = user.user_metadata?.role;
        
        // Check if user has completed their profile
        if (userRole === 'teacher' || userRole === 'student') {
          const profileTable = userRole === 'teacher' ? 'teacher_profiles' : 'student_profiles';
          const { data: profile } = await supabase
            .from(profileTable)
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!profile) {
            console.log(`⚠️ Auth: User has ${userRole} role but no profile, redirecting to onboarding`);
            navigate(`/onboarding/${userRole}`, { replace: true });
            return;
          }
        }

        // Check if there's a saved redirect path
        const redirectPath = sessionStorage.getItem('redirectAfterLogin');

        if (redirectPath) {
          sessionStorage.removeItem('redirectAfterLogin');
          navigate(redirectPath);
          return;
        }

        // Otherwise, redirect to appropriate dashboard based on role
        if (userRole === 'teacher') {
          navigate('/teacher/dashboard');
        } else if (userRole === 'student') {
          navigate('/student/dashboard');
        }
      }
    };
    
    checkAuthAndRedirect();
  }, [user?.id, authLoading, navigate]); // Use user?.id to avoid refetch on user object reference change

  // Set the active tab based on the route
  useEffect(() => {
    if (location.pathname === '/register') {
      setActiveTab('signup');
    } else if (location.pathname === '/login') {
      setActiveTab('signin');
    }
  }, [location.pathname]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!role) {
      toast.error(t('auth.errors.selectRole'));
      return;
    }

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setLoading(true);
    try {
      // Note: We skip pre-checking profiles by email because:
      // 1. Supabase will handle duplicate emails in auth.users
      // 2. Profiles have CASCADE DELETE, so orphaned profiles shouldn't exist
      // 3. If orphaned data exists, we'll handle it in AuthCallback
      // This prevents issues with orphaned data blocking legitimate registrations

      // Also check if current user is already authenticated with a profile
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser) {
        // Check if user already has a profile
        const { data: teacherProfile } = await supabase
          .from('teacher_profiles')
          .select('id')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        const { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('id')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (teacherProfile || studentProfile) {
          const existingRole = teacherProfile ? 'teacher' : 'student';
          toast.error(t('auth.errors.alreadyRegistered', { role: t(`common.${existingRole}`) }));
          setLoading(false);
          // Redirect to appropriate dashboard
          navigate(`/${existingRole}/dashboard`);
          return;
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { role },
        },
      });

      if (error) throw error;

      // Handle signup response
      if (data.user) {
        // If we have a session, user is confirmed - proceed to onboarding
        if (data.session) {
          toast.success(t('auth.success.accountCreatedSuccess'));
          navigate(`/onboarding/${role}`);
        } else {
          // No session - email confirmation might be required
          // For local development, try to sign in immediately
          // This works if email confirmation is disabled
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInData?.session) {
            // Successfully signed in - user was auto-confirmed
            toast.success(t('auth.success.accountCreatedSuccess'));
            navigate(`/onboarding/${role}`);
          } else {
            // Email confirmation required
            toast.success(t('auth.success.accountCreated'), {
              duration: 8000,
            });
            // Note: User needs to confirm email before they can proceed
          }
        }
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Check for duplicate email error
      // Supabase Auth returns various messages/codes for duplicate emails:
      // - "User already registered"
      // - "Email address is invalid" (when email exists)
      // - Status 400 or 422
      const errorMsg = error.message?.toLowerCase() || '';
      const errorCode = error.code?.toLowerCase() || '';
      
      const isDuplicateEmail = 
        errorMsg.includes('already registered') || 
        errorMsg.includes('already exists') ||
        errorMsg.includes('user already registered') ||
        errorCode.includes('email_exists') ||
        errorCode.includes('user_already_exists') ||
        error.status === 422 || // Unprocessable entity (duplicate)
        // If it's a 400 error with "invalid" message during signup, it's likely duplicate
        (error.status === 400 && errorMsg.includes('invalid'));
      
      if (isDuplicateEmail) {
        toast.error(t('auth.errors.emailAlreadyExists'));
      } else {
        toast.error(error.message || t('auth.errors2.creatingAccount'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (selectedRole?: 'teacher' | 'student') => {
    setLoading(true);
    try {
      // Check if user is already authenticated with an existing profile
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser) {
        // Check if user already has a profile
        const { data: teacherProfile } = await supabase
          .from('teacher_profiles')
          .select('id')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        const { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('id')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (teacherProfile || studentProfile) {
          const existingRole = teacherProfile ? 'teacher' : 'student';
          toast.error(t('auth.errors.alreadyRegistered', { role: t(`common.${existingRole}`) }));
          setLoading(false);
          // Redirect to appropriate dashboard
          navigate(`/${existingRole}/dashboard`);
          return;
        }
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error) {
      toast.error(error.message || t('auth.errors2.signingInGoogle'));
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success(t('auth.success.signedIn'));

      // Check for saved redirect path
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath);
        return;
      }

      // Redirect based on role and profile status
      const userRole = data.user.user_metadata.role;
      const profileTable = userRole === 'teacher' ? 'teacher_profiles' : 'student_profiles';
      const dashboardPath = `/${userRole}/dashboard`;
      const onboardingPath = `/onboarding/${userRole}`;

      if (userRole === 'teacher' || userRole === 'student') {
        const { data: profile } = await supabase
          .from(profileTable)
          .select('id')
          .eq('user_id', data.user.id)
          .single();

        navigate(profile ? dashboardPath : onboardingPath);
      }
    } catch (error) {
      toast.error(error.message || t('auth.errors2.signingIn'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <img src="/perleap_logo.png" alt="PerLeap" className="h-8 w-8 rounded" />
            <span className="text-2xl font-bold">PerLeap</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">{t('auth.welcome')}</CardTitle>
            <CardDescription>{t('auth.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">{t('auth.signIn')}</TabsTrigger>
                <TabsTrigger value="signup">{t('auth.signUp')}</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">{t('auth.email')}</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="rounded-2xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">{t('auth.password')}</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="rounded-2xl"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                    {t('auth.signInButton')}
                  </Button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        {t('auth.orContinueWith')}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleGoogleSignIn()}
                    disabled={loading}
                  >
                    <svg className="me-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {t('auth.signInWithGoogle')}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('auth.iAmA')}</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        type="button"
                        variant={role === 'teacher' ? 'default' : 'outline'}
                        onClick={() => setRole('teacher')}
                        className="h-20 flex flex-col items-center justify-center gap-2"
                      >
                        <span className="text-2xl">👨‍🏫</span>
                        <span>{t('auth.teacher')}</span>
                      </Button>
                      <Button
                        type="button"
                        variant={role === 'student' ? 'default' : 'outline'}
                        onClick={() => setRole('student')}
                        className="h-20 flex flex-col items-center justify-center gap-2"
                      >
                        <span className="text-2xl">👨‍🎓</span>
                        <span>{t('auth.student')}</span>
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t('auth.email')}</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="rounded-2xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t('auth.password')}</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="rounded-2xl"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || !role}>
                    {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                    {t('auth.createAccount')}
                  </Button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        {t('auth.orSignUpWith')}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (!role) {
                        toast.error(t('auth.errors.selectRoleFirst'));
                        return;
                      }
                      // Store role in localStorage temporarily for the OAuth callback
                      localStorage.setItem('pending_role', role);
                      handleGoogleSignIn(role);
                    }}
                    disabled={loading || !role}
                  >
                    <svg className="me-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {t('auth.signUpWithGoogle')}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
