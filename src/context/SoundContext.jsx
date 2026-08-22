"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { playChime, playBattleCall, unlockAudio } from "@/lib/sound";

const SoundContext = createContext(null);
const STORAGE_KEY = "chat-sound-enabled";

export function SoundProvider({ children }) {
  const [enabled, setEnabled] = useState(true);

  // Carrega a preferência salva (padrão: ativado).
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) setEnabled(saved === "true");
  }, []);

  // Destrava o áudio assim que a pessoa interage com a página pela
  // primeira vez (clique ou tecla) - necessário em navegadores como o
  // Safari, que bloqueiam som sem uma interação direta antes.
  useEffect(() => {
    function handleFirstInteraction() {
      unlockAudio();
    }

    window.addEventListener("click", handleFirstInteraction);
    window.addEventListener("keydown", handleFirstInteraction);

    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
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

  function playBattle() {
    if (enabled) playBattleCall();
  }

  return <SoundContext.Provider value={{ enabled, toggle, play, playBattle }}>{children}</SoundContext.Provider>;
}

export function useSound() {
  return useContext(SoundContext);
}
