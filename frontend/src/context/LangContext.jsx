import { createContext, useContext, useState } from 'react';
import { LANG } from '../lang';

const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('hk_lang') || 'en');

  function toggle() {
    const next = lang === 'hi' ? 'en' : 'hi';
    setLang(next);
    localStorage.setItem('hk_lang', next);
  }

  function t(key) {
    return LANG[lang]?.[key] ?? LANG.hi?.[key] ?? key;
  }

  return (
    <LangContext.Provider value={{ lang, toggle, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
