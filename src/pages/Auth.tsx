import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BreathingBackground } from '@/components/ui/BreathingBackground';

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

  // Clear fields when switching tabs to prevent autofill
  useEffect(() => {
    setEmail('');
    setPassword('');
  }, [activeTab]);

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
    <BreathingBackground className="flex items-center justify-center min-h-screen p-4">
      <div className="absolute top-8 left-8 z-20">
        <Link to="/">
          <Button variant="ghost" className="gap-2 hover:bg-white/20 text-foreground/80 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </Link>
      </div>

      <div className="absolute top-8 right-8 z-20 flex items-center gap-2">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-4xl animate-fade-in relative z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-white/50 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-sm mb-6">
            <img src="/perleap_logo.png" alt="PerLeap" className="h-12 w-12 object-contain" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3 text-center">Welcome to PerLeap</h1>
          <p className="text-muted-foreground text-lg text-center max-w-lg">
            Transform education with AI-powered teaching and personalized learning experiences
          </p>
        </div>

        <Card className="shadow-2xl bg-white/90 backdrop-blur-2xl border-white/50 rounded-[2.5rem] overflow-hidden">
          <CardContent className="p-12 md:p-16">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-100/50 p-1.5 rounded-2xl mb-10 h-12">
                <TabsTrigger
                  value="signin"
                  className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all h-full text-lg font-medium"
                >
                  {t('auth.signIn')}
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all h-full text-lg font-medium"
                >
                  {t('auth.signUp')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-0 space-y-8">
                <form onSubmit={handleSignIn} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="signin-email" className="text-lg font-medium ml-1 text-gray-700">{t('auth.email')}</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder=""
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={(e) => e.target.removeAttribute('readonly')}
                      required
                      autoComplete="username"
                      readOnly
                      className="h-12 rounded-2xl bg-gray-50 border-gray-200 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 transition-all px-6 text-lg shadow-sm"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="signin-password" className="text-lg font-medium ml-1 text-gray-700">{t('auth.password')}</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder=""
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={(e) => e.target.removeAttribute('readonly')}
                      required
                      autoComplete="new-password"
                      readOnly
                      className="h-12 rounded-2xl bg-gray-50 border-gray-200 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 transition-all px-6 text-lg shadow-sm"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-black text-white hover:bg-gray-900 rounded-full h-12 text-xl font-semibold shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all mt-6"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="me-3 h-6 w-6 animate-spin" />}
                    {t('auth.signInButton')}
                  </Button>

                  <div className="relative my-10">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-6 text-muted-foreground text-sm font-medium tracking-wider">
                        {t('auth.orContinueWith')}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-full h-12 border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all bg-white shadow-sm hover:shadow-md"
                    onClick={() => handleGoogleSignIn()}
                    disabled={loading}
                  >
                    <svg className="me-3 h-6 w-6" viewBox="0 0 24 24">
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
                    <span className="text-lg font-medium text-gray-700">{t('auth.signInWithGoogle')}</span>
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0 space-y-8">
                <form onSubmit={handleSignUp} className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-lg font-medium ml-1 text-gray-700">{t('auth.iAmA')}</Label>
                    <div className="grid grid-cols-2 gap-6">
                      <Button
                        type="button"
                        variant={role === 'teacher' ? 'default' : 'outline'}
                        onClick={() => setRole('teacher')}
                        className={`h-20 flex flex-col items-center justify-center gap-2 rounded-3xl transition-all ${role === 'teacher'
                          ? 'bg-black text-white ring-4 ring-black/10 shadow-xl scale-[1.02]'
                          : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 text-gray-600 shadow-sm'
                          }`}
                      >
                        <span className="text-2xl">👨‍🏫</span>
                        <span className="font-semibold text-lg">{t('auth.teacher')}</span>
                      </Button>
                      <Button
                        type="button"
                        variant={role === 'student' ? 'default' : 'outline'}
                        onClick={() => setRole('student')}
                        className={`h-20 flex flex-col items-center justify-center gap-2 rounded-3xl transition-all ${role === 'student'
                          ? 'bg-black text-white ring-4 ring-black/10 shadow-xl scale-[1.02]'
                          : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 text-gray-600 shadow-sm'
                          }`}
                      >
                        <span className="text-2xl">👨‍🎓</span>
                        <span className="font-semibold text-lg">{t('auth.student')}</span>
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="signup-email" className="text-lg font-medium ml-1 text-gray-700">{t('auth.email')}</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder=""
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={(e) => e.target.removeAttribute('readonly')}
                      required
                      autoComplete="username"
                      readOnly
                      className="h-12 rounded-2xl bg-gray-50 border-gray-200 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 transition-all px-6 text-lg shadow-sm"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="signup-password" className="text-lg font-medium ml-1 text-gray-700">{t('auth.password')}</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder=""
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={(e) => e.target.removeAttribute('readonly')}
                      required
                      autoComplete="new-password"
                      readOnly
                      className="h-12 rounded-2xl bg-gray-50 border-gray-200 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 transition-all px-6 text-lg shadow-sm"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-black text-white hover:bg-gray-900 rounded-full h-12 text-xl font-semibold shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all mt-6"
                    disabled={loading || !role}
                  >
                    {loading && <Loader2 className="me-3 h-6 w-6 animate-spin" />}
                    {t('auth.createAccount')}
                  </Button>

                  <div className="relative my-10">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-6 text-muted-foreground text-sm font-medium tracking-wider">
                        {t('auth.orSignUpWith')}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-full h-12 border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all bg-white shadow-sm hover:shadow-md"
                    onClick={() => {
                      if (!role) {
                        toast.error(t('auth.errors.selectRoleFirst'));
                        return;
                      }
                      localStorage.setItem('pending_role', role);
                      handleGoogleSignIn(role);
                    }}
                    disabled={loading || !role}
                  >
                    <svg className="me-3 h-6 w-6" viewBox="0 0 24 24">
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
                    <span className="text-lg font-medium text-gray-700">{t('auth.signUpWithGoogle')}</span>
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </BreathingBackground>
  );
};

export default Auth;
