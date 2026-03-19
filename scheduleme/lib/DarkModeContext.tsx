// lib/DarkModeContext.tsx — shared dark mode state across all pages
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface DarkModeContextType {
  dm: boolean;
  toggle: () => void;
}

const DarkModeContext = createContext<DarkModeContextType>({ dm: false, toggle: () => {} });

function setThemeColor(isDark: boolean) {
  if (typeof document === 'undefined') return;
  const meta = document.getElementById('theme-color-meta') as HTMLMetaElement | null
    ?? document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (meta) meta.content = isDark ? '#0F1117' : '#EDF5FF';
}

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const [dm, setDm] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sm_dark_mode');
    // Default is light mode — only go dark if user explicitly chose it
    const isDark = saved === 'true';
    setDm(isDark);
    document.documentElement.classList.remove('dark');
    if (isDark) document.documentElement.classList.add('dark');
    setThemeColor(isDark);
  }, []);

  function toggle() {
    const next = !dm;
    setDm(next);
    if (next) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('sm_dark_mode', String(next));
    setThemeColor(next);
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
