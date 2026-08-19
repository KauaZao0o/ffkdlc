"use client";

import { useTheme } from "@/context/ThemeContext.jsx";

export default function ThemeToggle({ className }) {
  const { isDark, toggle } = useTheme();

  return (
    <label className={className} title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}>
      <span className="theme-switch theme-icon-switch">
        <input type="checkbox" checked={isDark} onChange={toggle} />
        <span className="theme-switch-track" />
      </span>
    </label>
  );
}
