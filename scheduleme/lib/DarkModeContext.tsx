// lib/DarkModeContext.tsx — shared dark mode state across all pages
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface DarkModeContextType {
  dm: boolean;
  toggle: () => void;
}

const DarkModeContext = createContext<DarkModeContextType>({ dm: false, toggle: () => {} });

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const [dm, setDm] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sm_dark_mode');
    // Only use dark mode if user has explicitly chosen it — default to light
    const isDark = saved === 'true';
    setDm(isDark);
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

  function toggle() {
    const next = !dm;
    setDm(next);
    if (next) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('sm_dark_mode', String(next));
  }

  return (
    <DarkModeContext.Provider value={{ dm, toggle }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDm() {
  return useContext(DarkModeContext);
}
