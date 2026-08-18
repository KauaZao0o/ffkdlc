"use client";

import { useEffect, useState } from "react";
import CallAudioSettingsModal from "./CallAudioSettingsModal.jsx";
import ScreenShareVideo from "./ScreenShareVideo.jsx";
import { MinimizeIcon, ScreenShareIcon } from "./CallIcons.jsx";

function formatCallDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function VoiceCallOverlay({ call }) {
  const {
    callState,
    peerName,
    isMuted,
    duration,
    statusMessage,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    switchMicrophone,
    switchSpeaker,
    isScreenSharing,
    localScreenStream,
    remoteScreenStream,
    toggleScreenShare,
  } = call;
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [screensMinimized, setScreensMinimized] = useState(false);
  const hasScreen = !!(localScreenStream || remoteScreenStream);

  useEffect(() => {
    if (hasScreen) setScreensMinimized(false);
  }, [hasScreen, localScreenStream, remoteScreenStream]);

  // A barra da chamada é fixa; reserva o espaço dela no app para não cobrir
  // os atalhos de nova conversa/grupo nem o topo da conversa aberta.
  useEffect(() => {
    if (callState !== "connected") return;
    document.body.classList.add("call-active");
    document.body.style.setProperty("--active-call-bar-height", "56px");
    return () => {
      document.body.classList.remove("call-active");
      document.body.style.removeProperty("--active-call-bar-height");
    };
  }, [callState]);

  if (callState === "idle") {
    return statusMessage ? (
      <div
        className="call-control-bar"
        style={{
          position: "fixed",
          top: 60,
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 999,
          padding: "6px 14px",
          fontSize: 13,
          color: "var(--text-muted)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          zIndex: 60,
        }}
      >
        {statusMessage}
      </div>
    ) : null;
  }

  // Chamando (aguardando a outra pessoa atender) ou tocando (recebendo
  // chamada) - tela cheia, cobrindo o app inteiro (não só a conversa que
  // estava aberta), já que uma ligação pode chegar em qualquer tela.
  if (callState === "calling" || callState === "ringing") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          background: "var(--surface)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            background: "var(--group-avatar-bg)",
            color: "var(--group-avatar-fg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            animation: "call-pulse 1.4s ease-in-out infinite",
          }}
        >
          📞
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text)" }}>{peerName}</p>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text-muted)" }}>
            {callState === "calling" ? "Chamando..." : "Chamada de voz recebida"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
          {callState === "ringing" && (
            <button
              type="button"
              onClick={acceptCall}
              title="Atender"
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                border: "none",
                background: "var(--success)",
                color: "white",
                fontSize: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              }}
            >
              📞
            </button>
          )}
          <button
            type="button"
            onClick={callState === "ringing" ? rejectCall : endCall}
            title={callState === "ringing" ? "Recusar" : "Cancelar"}
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "none",
              background: "var(--danger)",
              color: "white",
              fontSize: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              transform: "rotate(135deg)",
            }}
          >
            📞
          </button>
        </div>

        <style jsx>{`
          @keyframes call-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }
        `}</style>
      </div>
    );
  }

  // Em ligação - barra compacta no topo, cobrindo o app inteiro (fica
  // visível mesmo se a pessoa trocar de conversa ou fechar a janela de
  // configurações) - não cobre o chat inteiro (dá pra continuar vendo/
  // escrevendo mensagens com a chamada rolando).
  return (
    <>
      <div
        className="call-control-bar"
        style={{
          position: "fixed",
          top: 52,
          left: 0,
          right: 0,
          zIndex: 62,
        }}
      >
      <div className="call-control-row">
      <span className="call-control-title">
        <span className="call-live-dot" /> {peerName} <span>· {formatCallDuration(duration)}</span>
      </span>
      <div className="call-control-actions">
        {hasScreen && (
          <button type="button" className="call-control-button" onClick={() => setScreensMinimized((value) => !value)} title={screensMinimized ? "Mostrar compartilhamento" : "Voltar ao chat"}>
            {screensMinimized ? <ScreenShareIcon /> : <MinimizeIcon />}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowAudioSettings(true)}
          title="Áudio e som"
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.25)",
            color: "white",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ⚙️
        </button>
        <button
          type="button"
          onClick={toggleMute}
          title={isMuted ? "Ativar microfone" : "Silenciar microfone"}
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "none",
            background: isMuted ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.25)",
            color: "white",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isMuted ? "🔇" : "🎙️"}
        </button>
        <button
          type="button"
          onClick={toggleScreenShare}
          title={isScreenSharing ? "Parar de compartilhar tela" : "Compartilhar tela"}
          className={isScreenSharing ? "call-control-button active" : "call-control-button"}
        >
          <ScreenShareIcon />
        </button>
        <button
          type="button"
          onClick={endCall}
          title="Encerrar chamada"
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "none",
            background: "var(--danger)",
            color: "white",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(135deg)",
          }}
        >
          📞
        </button>
      </div>
      </div>
      </div>

      {hasScreen && !screensMinimized && (
        <div className="screen-share-dock" aria-label="Telas compartilhadas">
          <button type="button" className="screen-share-minimize" onClick={() => setScreensMinimized(true)} title="Voltar ao chat" aria-label="Voltar ao chat"><MinimizeIcon /></button>
          <ScreenShareVideo stream={localScreenStream} label="Você está compartilhando" muted />
          <ScreenShareVideo stream={remoteScreenStream} label={`${peerName} está compartilhando`} />
        </div>
      )}

      {showAudioSettings && (
        <CallAudioSettingsModal
          onClose={() => setShowAudioSettings(false)}
          live
          onMicChange={switchMicrophone}
          onSpeakerChange={switchSpeaker}
        />
      )}
    </>
  );
}
