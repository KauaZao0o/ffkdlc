"use client";

import { useEffect, useRef, useState } from "react";
import CallAudioSettingsModal from "./CallAudioSettingsModal.jsx";

function formatCallDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// <video> controlado imperativamente: srcObject não é uma prop comum do
// React (é um MediaStream, não serializa), então atribui direto no
// elemento sempre que o stream muda.
function VideoTile({ stream, muted, label, mirrored }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000", borderRadius: 10, overflow: "hidden" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: mirrored ? "scaleX(-1)" : "none",
        }}
      />
      {label && (
        <span
          style={{
            position: "absolute",
            bottom: 6,
            left: 8,
            fontSize: 11,
            color: "white",
            background: "rgba(0,0,0,0.45)",
            padding: "2px 6px",
            borderRadius: 6,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
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
    localVideoOn,
    localScreenSharing,
    localVideoStream,
    remoteVideoOn,
    remoteScreenSharing,
    remoteVideoStream,
    toggleVideo,
    toggleScreenShare,
  } = call;
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const hasAnyVideo = localVideoOn || remoteVideoOn;

  if (callState === "idle") {
    return statusMessage ? (
      <div
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
        style={{
          position: "fixed",
          top: 52,
          left: 0,
          right: 0,
          zIndex: 60,
        background: "var(--success)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 14px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500 }}>
        📞 {peerName} · {formatCallDuration(duration)}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
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
          onClick={toggleVideo}
          title={localScreenSharing ? "Câmera (pare o compartilhamento de tela primeiro)" : localVideoOn ? "Desligar câmera" : "Ligar câmera"}
          disabled={localScreenSharing}
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "none",
            background: localVideoOn ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.25)",
            color: "white",
            fontSize: 14,
            opacity: localScreenSharing ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          🎥
        </button>
        <button
          type="button"
          onClick={toggleScreenShare}
          title={localScreenSharing ? "Parar compartilhamento de tela" : "Compartilhar tela"}
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "none",
            background: localScreenSharing ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.25)",
            color: "white",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          🖥️
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

      {hasAnyVideo && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            zIndex: 60,
            width: "min(320px, 80vw)",
            height: "min(240px, 60vw)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {remoteVideoOn ? (
            <VideoTile
              stream={remoteVideoStream}
              label={`${peerName}${remoteScreenSharing ? " · tela" : ""}`}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                color: "var(--text-muted)",
              }}
            >
              {peerName} sem vídeo
            </div>
          )}

          {localVideoOn && (
            <div style={{ position: "absolute", bottom: 8, right: 8, width: "30%", aspectRatio: "4 / 3" }}>
              <VideoTile stream={localVideoStream} muted mirrored={!localScreenSharing} label="Você" />
            </div>
          )}
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
