"use client";

import { useEffect, useRef, useState } from "react";
import { ExpandIcon } from "./CallIcons.jsx";

export default function ScreenShareVideo({ stream, label, muted = false }) {
  const videoRef = useRef(null);
  const cardRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream || null;
    videoRef.current.play?.().catch(() => {});
  }, [stream]);

  if (!stream) return null;

  async function openFullscreen() {
    try {
      if (cardRef.current?.requestFullscreen) {
        await cardRef.current.requestFullscreen();
        return;
      }
    } catch {
      // Alguns navegadores móveis não expõem a Fullscreen API para cards.
    }
    setIsExpanded(true);
  }

  return (
    <div ref={cardRef} className="screen-share-preview">
      <span className="screen-share-label">{label}</span>
      <video ref={videoRef} autoPlay playsInline muted={muted} />
      <button type="button" className="screen-share-fullscreen" onClick={openFullscreen} title="Ver em tela cheia" aria-label="Ver em tela cheia">
        <ExpandIcon />
      </button>
      {isExpanded && (
        <div className="screen-share-fallback-fullscreen" role="dialog" aria-modal="true">
          <button type="button" onClick={() => setIsExpanded(false)} aria-label="Fechar tela cheia">×</button>
          <ScreenShareVideo stream={stream} label={label} muted={muted} />
        </div>
      )}
    </div>
  );
}
