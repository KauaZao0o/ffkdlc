"use client";

import { useEffect, useRef, useState } from "react";

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function AudioMessage({ src, isOwn }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function onLoadedMetadata() {
      setDuration(audio.duration || 0);
    }
    function onTimeUpdate() {
      setCurrentTime(audio.currentTime);
    }
    function onEnded() {
      setIsPlaying(false);
      setCurrentTime(0);
    }

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  function togglePlay(e) {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
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

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: 210, padding: "4px 2px" }}>
      <audio ref={audioRef} src={src} preload="metadata" style={{ display: "none" }} />

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

      {/* Barra de progresso maior que o visual, pra ser fácil de tocar no celular */}
      <div
        onClick={handleSeek}
        onTouchStart={handleSeek}
        style={{
          flex: 1,
          padding: "10px 0",
          cursor: "pointer",
        }}
      >
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
