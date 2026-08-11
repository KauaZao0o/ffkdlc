"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { playChime } from "@/lib/sound";

const SoundContext = createContext(null);
const STORAGE_KEY = "chat-sound-enabled";

export function SoundProvider({ children }) {
  const [enabled, setEnabled] = useState(true);

  // Carrega a preferência salva (padrão: ativado).
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) setEnabled(saved === "true");
  }, []);

  function toggle() {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  function play() {
    if (enabled) playChime();
  }

  return <SoundContext.Provider value={{ enabled, toggle, play }}>{children}</SoundContext.Provider>;
}

export function useSound() {
  return useContext(SoundContext);
}
