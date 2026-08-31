/* eslint-disable react-refresh/only-export-components -- co-located helpers/variants */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import i18n from '@/i18n/config';
import { supabase } from '@/integrations/supabase/client';

type Language = 'en' | 'he';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  /** Supabase session only — avoids `useAuth` here so Vite HMR cannot desync AuthContext vs Provider. */
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Initialize from localStorage with more robust checking
  const getStoredLanguage = (): Language => {
    try {
      const stored = localStorage.getItem('language_preference');
      return stored === 'he' || stored === 'en' ? stored : 'en';
    } catch {
      return 'en';
    }
  };

  const [language, setLanguageState] = useState<Language>(getStoredLanguage);

  const isRTL = language === 'he';

  // Load user's preferred language from profile when user logs in (ONLY ONCE)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      i18n.changeLanguage(lang);
      localStorage.setItem('language_preference', lang);
      document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;

      if (user) {
        const userRole = user.user_metadata?.role;
        const table =
          userRole === 'teacher' || userRole === 'admin' ? 'teacher_profiles' : 'student_profiles';

        if (userRole === 'teacher' || userRole === 'student' || userRole === 'admin') {
          void supabase
            .from(table)
            .update({ preferred_language: lang })
            .eq('user_id', user.id)
            .then(({ error }) => {
              if (error) console.error(`Failed to update ${table}:`, error);
            });
        }
      }
    },
    [user]
  );

  const loadUserLanguagePreference = useCallback(async () => {
    if (!user) return;

    try {
      let dbLanguage: Language | null = null;
      const userRole = user.user_metadata?.role;

      if (userRole === 'student') {
        const { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('preferred_language')
          .eq('user_id', user.id)
          .maybeSingle();

        if (studentProfile?.preferred_language) {
          dbLanguage = studentProfile.preferred_language as Language;
        }
      } else if (userRole === 'teacher' || userRole === 'admin') {
        const { data: teacherProfile } = await supabase
          .from('teacher_profiles')
          .select('preferred_language')
          .eq('user_id', user.id)
          .maybeSingle();

        if (teacherProfile?.preferred_language) {
          dbLanguage = teacherProfile.preferred_language as Language;
        }
      }

      if (dbLanguage) {
        if (dbLanguage !== language) {
          setLanguage(dbLanguage);
        }
      } else {
        const localPref = getStoredLanguage();
        if (localPref !== language) {
          setLanguage(localPref);
        }

        if (localPref === 'he') {
          const role = user.user_metadata?.role;
          const table =
            role === 'teacher' || role === 'admin' ? 'teacher_profiles' : 'student_profiles';

          if (role === 'teacher' || role === 'student' || role === 'admin') {
            void supabase
              .from(table)
              .update({ preferred_language: localPref })
              .eq('user_id', user.id);
          }
        }
      }
    } catch (error) {
      console.error('Error loading language preference:', error);
    }
  }, [user, language, setLanguage]);

  useEffect(() => {
    if (user && user.id !== loadedUserId) {
      void loadUserLanguagePreference();
      setLoadedUserId(user.id);
    } else if (!user && loadedUserId) {
      setLoadedUserId(null);
    }
  }, [user, loadedUserId, loadUserLanguagePreference]);

  // Initialize language on mount - ensure i18n is in sync
  useEffect(() => {
    const storedLang = getStoredLanguage();
    setLanguageState(storedLang);

    if (i18n.language !== storedLang) {
      i18n.changeLanguage(storedLang);
    }

    document.documentElement.dir = storedLang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = storedLang;
  }, []);

  // Sync whenever language changes
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;

    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, isRTL]);

  // Removed visibility change listener - it was causing unnecessary re-renders when tabbing back
  // Language is already synced via localStorage and won't change unless user explicitly changes it

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
