import { create } from 'zustand';

export const useLangStore = create((set) => ({
  lang: localStorage.getItem('steelbody_lang') || 'ko',
  setLang: (lang) => {
    localStorage.setItem('steelbody_lang', lang);
    set({ lang });
  },
}));
