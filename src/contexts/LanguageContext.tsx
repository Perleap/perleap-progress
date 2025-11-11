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
      return (stored === 'he' || stored === 'en') ? stored : 'en';
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
      console.log('🔍 Loading user language preference from database (one-time for user:', user.id, ')');
      loadUserLanguagePreference();
      setLoadedUserId(user.id);
    } else if (!user && loadedUserId) {
      // Reset when user logs out
      console.log('👋 User logged out, resetting preference flag');
      setLoadedUserId(null);
    } else if (user && user.id === loadedUserId) {
      console.log('✋ Skipping database load - already loaded for user:', user.id);
    }
  }, [user?.id]); // Only depend on user ID, not the entire user object

  const loadUserLanguagePreference = async () => {
    if (!user) return;

    // NEVER override if localStorage already has a preference
    // Database is only used for INITIAL sync, localStorage is the source of truth
    const localPref = getStoredLanguage();
    console.log('📊 Checking database preference. Local preference is:', localPref);

    // If localStorage has a preference, DON'T load from database
    // Just update database to match localStorage
    if (localPref !== 'en' || localStorage.getItem('language_preference') !== null) {
      console.log('✋ localStorage has preference, skipping database load. Will update database to match.');
      // Silently update database to match localStorage (don't call setLanguage)
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
      return;
    }

    try {
      // Only reach here if localStorage is empty or default 'en'
      console.log('📥 No local preference found, loading from database...');
      
      // Try to get from student_profiles first
      const { data: studentProfile } = await supabase
        .from('student_profiles')
        .select('preferred_language')
        .eq('user_id', user.id)
        .maybeSingle();

      if (studentProfile?.preferred_language) {
        const preferredLang = studentProfile.preferred_language as Language;
        console.log('💾 Database student preference:', preferredLang);
        // Only apply if different from current AND localStorage is empty
        if (preferredLang !== 'en' && preferredLang !== localPref) {
          console.log('✅ Applying database preference:', preferredLang);
          setLanguage(preferredLang);
        }
        return;
      }

      // Try teacher_profiles if not found in student_profiles
      const { data: teacherProfile } = await supabase
        .from('teacher_profiles')
        .select('preferred_language')
        .eq('user_id', user.id)
        .maybeSingle();

      if (teacherProfile?.preferred_language) {
        const preferredLang = teacherProfile.preferred_language as Language;
        console.log('💾 Database teacher preference:', preferredLang);
        // Only apply if different from current AND localStorage is empty
        if (preferredLang !== 'en' && preferredLang !== localPref) {
          console.log('✅ Applying database preference:', preferredLang);
          setLanguage(preferredLang);
        }
      }
    } catch (error) {
      console.error('Error loading language preference:', error);
    }
  };

  const setLanguage = (lang: Language) => {
    console.log('🔧 setLanguage called with:', lang, 'from:', new Error().stack?.split('\n')[2]);
    
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
        console.log('📝 Updating database preference to:', lang);
        // Try to update student profile first
        supabase
          .from('student_profiles')
          .update({ preferred_language: lang })
          .eq('user_id', user.id)
          .then(({ error: studentError }) => {
            if (studentError) {
              console.log('Not a student, trying teacher profile');
              // If student update failed, try teacher profile
              supabase
                .from('teacher_profiles')
                .update({ preferred_language: lang })
                .eq('user_id', user.id)
                .then(({ error: teacherError }) => {
                  if (teacherError) {
                    console.error('Failed to update teacher profile:', teacherError);
                  } else {
                    console.log('✅ Teacher database preference updated to:', lang);
                  }
                });
            } else {
              console.log('✅ Student database preference updated to:', lang);
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

  // Add visibility change listener to re-sync language when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const storedLang = getStoredLanguage();
        console.log('👁️ Tab visible - stored language:', storedLang, 'current i18n:', i18n.language, 'state:', language);
        
        // Only update if there's a genuine mismatch with localStorage
        if (storedLang !== language) {
          console.log('⚠️ Language mismatch detected! Updating state to:', storedLang);
          setLanguageState(storedLang);
        }
        
        // Sync HTML attributes and i18n WITHOUT triggering languageChanged event
        if (i18n.language !== storedLang) {
          console.log('🔄 Syncing i18n to:', storedLang);
          // Use silent option if available, otherwise just sync
          i18n.changeLanguage(storedLang);
        }
        
        // Always sync HTML attributes
        document.documentElement.dir = storedLang === 'he' ? 'rtl' : 'ltr';
        document.documentElement.lang = storedLang;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [language]);

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

