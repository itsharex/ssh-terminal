import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '@/i18n/config';

export type Language = 'zh-CN' | 'en';

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'zh-CN',
      setLanguage: (language) => {
        set({ language });
        i18n.changeLanguage(language);
      },
    }),
    {
      name: 'language-storage',
    }
  )
);

// Initialize language on store creation
const initLanguage = () => {
  const storedLanguage = useLanguageStore.getState().language;
  i18n.changeLanguage(storedLanguage);
};

initLanguage();
