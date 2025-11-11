import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Hook to get current text direction (ltr or rtl)
 * @returns Object containing direction string and boolean isRTL
 */
export const useDirection = () => {
  const { isRTL } = useLanguage();

  return {
    dir: isRTL ? 'rtl' : 'ltr',
    isRTL,
  };
};

