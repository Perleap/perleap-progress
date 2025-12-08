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

    console.log('🌐 LanguageContext: Loading language preference for user:', user.id);
    
    try {
      // Check DB for preference - prioritize DB over local storage
      let dbLanguage: Language | null = null;
      const userRole = user.user_metadata?.role;

      // Only query the relevant table based on role
      if (userRole === 'student') {
        const { data: studentProfile, error } = await supabase
          .from('student_profiles')
          .select('preferred_language')
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (studentProfile?.preferred_language) {
          dbLanguage = studentProfile.preferred_language as Language;
        }
      } else if (userRole === 'teacher') {
        const { data: teacherProfile, error } = await supabase
          .from('teacher_profiles')
          .select('preferred_language')
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (teacherProfile?.preferred_language) {
          dbLanguage = teacherProfile.preferred_language as Language;
        }
      } else {
        // Fallback for unknown roles - try both (should rarely happen)
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
      }

      if (dbLanguage) {
        // If DB has a preference, use it (overriding local storage)
        if (dbLanguage !== language) {
          console.log('🌐 ✅ Syncing language from database:', dbLanguage);
          setLanguage(dbLanguage);
        } else {
          console.log('🌐 ✅ Database language matches current:', dbLanguage);
        }
      } else {
        // If DB has no preference, use localStorage and keep it synced
        const localPref = getStoredLanguage();
        console.log('🌐 No DB preference, checking localStorage:', localPref);
        
        // Apply the localStorage language preference immediately
        if (localPref !== language) {
          console.log('🌐 ✅ APPLYING localStorage language:', localPref, '(was:', language, ')');
          setLanguage(localPref);
        } else {
          console.log('🌐 localStorage language already applied:', localPref);
        }

        // Silently try to update database to match localStorage
        if (localPref === 'he') {
          const userRole = user.user_metadata?.role;
          const table = userRole === 'teacher' ? 'teacher_profiles' : 'student_profiles';
          
          if (userRole === 'teacher' || userRole === 'student') {
            console.log(`🌐 Attempting to sync Hebrew to ${table}...`);
            supabase
              .from(table)
              .update({ preferred_language: localPref })
              .eq('user_id', user.id);
          }
        }
      }
    } catch (error) {
      console.error('🌐 ❌ Error loading language preference:', error);
    }
  };

  const setLanguage = (lang: Language) => {
    console.log('🌐 setLanguage called with:', lang);
    
    // Update local state
    setLanguageState(lang);

    // Update i18n
    i18n.changeLanguage(lang);

    // Update localStorage
    localStorage.setItem('language_preference', lang);
    console.log('🌐 localStorage updated to:', lang);

    // Update HTML attributes
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;

    // Update user profile if logged in (ONLY if different from what's in database)
    if (user) {
      const userRole = user.user_metadata?.role;
      const table = userRole === 'teacher' ? 'teacher_profiles' : 'student_profiles';

      if (userRole === 'teacher' || userRole === 'student') {
        try {
          supabase
            .from(table)
            .update({ preferred_language: lang })
            .eq('user_id', user.id)
            .then(({ error }) => {
              if (error) {
                console.error(`Failed to update ${table}:`, error);
              }
            });
        } catch (error) {
          console.error('Error updating language preference:', error);
        }
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
