"use client";

import { useEffect, useRef, useState } from "react";
import { registerAudioPlayback, clearAudioPlayback } from "@/lib/audioManager";

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

// A gente embute a duração real (contada durante a própria gravação) como
// "?d=7" na URL do áudio - veja MessageInput.jsx. Assim a duração aparece
// certa na hora, sem depender só do navegador de quem está ouvindo (que
// em celular às vezes não consegue calcular a duração de um áudio gravado
// pelo MediaRecorder).
function knownDurationFromUrl(src) {
  try {
    const value = Number(new URL(src).searchParams.get("d"));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

export default function AudioMessage({ src, isOwn }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(() => knownDurationFromUrl(src) || 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const durationFixAttemptedRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function onDurationChange() {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    }
    function onTimeUpdate() {
      setCurrentTime(audio.currentTime);
    }
    function onEnded() {
      setIsPlaying(false);
      setCurrentTime(0);
      clearAudioPlayback(audio);
    }
    function onPause() {
      setIsPlaying(false);
    }
    function onError() {
      setLoadError(true);
    }

    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      clearAudioPlayback(audio);
    };
  }, []);

  // Bug conhecido: áudio gravado pelo MediaRecorder às vezes não traz a
  // duração certa no cabeçalho do arquivo, e o navegador reporta
  // "Infinity" ou "0" - principalmente em celular. O truque pra corrigir é
  // "pular" pro fim do áudio (força o navegador a recalcular de verdade) e
  // voltar pro início.
  //
  // IMPORTANTE: isso precisa acontecer dentro do mesmo toque do usuário no
  // botão de play - se rodar sozinho assim que o áudio carrega (como era
  // antes), alguns celulares travam o elemento de áudio e só o SEGUNDO
  // toque no play funciona de verdade. Rodando aqui dentro, resolve em um
  // toque só.
  async function fixDurationIfNeeded(audio) {
    if (durationFixAttemptedRef.current) return;
    durationFixAttemptedRef.current = true;

    if (isFinite(audio.duration) && audio.duration > 0) return;

    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        audio.removeEventListener("timeupdate", onTimeUpdateOnce);
        if (isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
        audio.currentTime = 0;
        resolve();
      };
      const onTimeUpdateOnce = () => finish();
      audio.addEventListener("timeupdate", onTimeUpdateOnce);
      try {
        audio.currentTime = 1e7;
      } catch {
        finish();
      }
      // Se o celular não conseguir calcular em 1.5s, segue em frente e
      // toca do mesmo jeito - melhor tocar sem barra de progresso certa
      // do que ficar travado esperando pra sempre.
      setTimeout(finish, 1500);
    });
  }

  async function togglePlay(e) {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await fixDurationIfNeeded(audio);
      // Avisa o gerenciador global: qualquer outro áudio tocando agora
      // pausa sozinho.
      registerAudioPlayback(audio, () => setIsPlaying(false));
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      console.error("Não foi possível tocar o áudio:", err);
      setIsPlaying(false);
      setLoadError(true);
    }
  }

  function handleSeek(e) {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const trackColor = isOwn ? "rgba(255,255,255,0.35)" : "var(--border)";
  const fillColor = isOwn ? "white" : "var(--group-avatar-fg)";
  const buttonBg = isOwn ? "rgba(255,255,255,0.2)" : "var(--group-avatar-bg)";
  const buttonFg = isOwn ? "white" : "var(--group-avatar-fg)";

  // Se o navegador realmente não conseguir decodificar o áudio (acontece,
  // por exemplo, com áudio gravado num Android e aberto num iPhone mais
  // antigo), mostra um jeito de baixar em vez de um botão de play quebrado.
  if (loadError) {
    return (
      <a
        href={src}
        download
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: 210,
          padding: "8px 6px",
          fontSize: 12,
          color: isOwn ? "var(--bubble-own-text)" : "var(--bubble-other-text)",
          textDecoration: "none",
        }}
      >
        ⚠️ Não foi possível tocar este áudio aqui. Toque para baixar.
      </a>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: 210, padding: "4px 2px" }}>
      <audio ref={audioRef} src={src} preload="auto" playsInline style={{ display: "none" }} />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pausar áudio" : "Tocar áudio"}
        style={{
          width: 32,
          height: 32,
          minWidth: 32,
          borderRadius: "50%",
          border: "none",
          padding: 0,
          background: buttonBg,
          color: buttonFg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <div onClick={handleSeek} onTouchStart={handleSeek} style={{ flex: 1, padding: "10px 0", cursor: "pointer" }}>
        <div style={{ height: 4, borderRadius: 2, background: trackColor, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${progress}%`,
              borderRadius: 2,
              background: fillColor,
            }}
          />
        </div>
      </div>

      <span style={{ fontSize: 11, minWidth: 34, textAlign: "right", opacity: 0.85 }}>
        {formatTime(isPlaying || currentTime > 0 ? currentTime : duration)}
      </span>
    </div>
  );
}
