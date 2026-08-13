"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "chat-theme";

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");

  // Carrega a preferência salva (padrão: claro). Se a pessoa nunca
  // escolheu nada, respeita a preferência do sistema operacional dela.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  // Aplica o tema no elemento <html> pra CSS enxergar via [data-theme].
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function toggle() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === "dark", toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
