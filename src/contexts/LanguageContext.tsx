import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import i18n from '@/i18n/config';

type Language = 'en' | 'he';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();

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

  useEffect(() => {
    // Only load once per user ID
    if (user && user.id !== loadedUserId) {
      loadUserLanguagePreference();
      setLoadedUserId(user.id);
    } else if (!user && loadedUserId) {
      // Reset when user logs out
      setLoadedUserId(null);
    }
  }, [user?.id]); // Only depend on user ID, not the entire user object

  const loadUserLanguagePreference = async () => {
    if (!user) return;

    try {
      // Check DB for preference - prioritize DB over local storage
      let dbLanguage: Language | null = null;

      // Try to get from student_profiles first
      const { data: studentProfile } = await supabase
        .from('student_profiles')
        .select('preferred_language')
        .eq('user_id', user.id)
        .maybeSingle();

      if (studentProfile?.preferred_language) {
        dbLanguage = studentProfile.preferred_language as Language;
      } else {
        // Try teacher_profiles if not found in student_profiles
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
        // If DB has a preference, use it (overriding local storage)
        if (dbLanguage !== language) {
          console.log('Syncing language from database:', dbLanguage);
          setLanguage(dbLanguage);
        }
      } else {
        // If DB has no preference, sync current local preference to DB
        const localPref = getStoredLanguage();

        // Silently update database to match localStorage
        if (localPref === 'he') {
          supabase
            .from('student_profiles')
            .update({ preferred_language: localPref })
            .eq('user_id', user.id)
            .then(({ error }) => {
              if (error) {
                supabase
                  .from('teacher_profiles')
                  .update({ preferred_language: localPref })
                  .eq('user_id', user.id);
              }
            });
        }
      }
    } catch (error) {
      console.error('Error loading language preference:', error);
    }
  };

  const setLanguage = (lang: Language) => {
    // Update local state
    setLanguageState(lang);

    // Update i18n
    i18n.changeLanguage(lang);

    // Update localStorage
    localStorage.setItem('language_preference', lang);

    // Update HTML attributes
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;

    // Update user profile if logged in (ONLY if different from what's in database)
    if (user) {
      try {
        // Try to update student profile first
        supabase
          .from('student_profiles')
          .update({ preferred_language: lang })
          .eq('user_id', user.id)
          .then(({ error: studentError }) => {
            if (studentError) {
              // If student update failed, try teacher profile
              supabase
                .from('teacher_profiles')
                .update({ preferred_language: lang })
                .eq('user_id', user.id)
                .then(({ error: teacherError }) => {
                  if (teacherError) {
                    console.error('Failed to update teacher profile:', teacherError);
                  }
                });
            }
          });
      } catch (error) {
        console.error('Error updating language preference:', error);
      }
    }
  };

  // Initialize language on mount - ensure i18n is in sync
  useEffect(() => {
    const storedLang = getStoredLanguage();

    // If stored language doesn't match state, update state
    if (storedLang !== language) {
      setLanguageState(storedLang);
    }

    // Make sure i18n language matches
    if (i18n.language !== storedLang) {
      i18n.changeLanguage(storedLang);
    }

    // Update HTML attributes
    document.documentElement.dir = storedLang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = storedLang;
  }, []); // Only run on mount

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
