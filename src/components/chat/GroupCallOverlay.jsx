"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/common/Avatar.jsx";
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
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: mirrored ? "scaleX(-1)" : "none" }}
      />
      {label && (
        <span
          style={{
            position: "absolute",
            bottom: 4,
            left: 6,
            fontSize: 10,
            color: "white",
            background: "rgba(0,0,0,0.45)",
            padding: "2px 5px",
            borderRadius: 5,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

// Barra compacta no topo (parecida com a de chamada 1-a-1), mas com uma
// fileira de avatares - um por pessoa na chamada em grupo, com um aro verde
// enquanto a conexão com ela ainda não fechou. Se alguém (inclusive você)
// estiver com câmera ou tela ligada, uma grade de vídeos aparece abaixo.
export default function GroupCallOverlay({ call }) {
  const {
    groupCallState,
    groupCallConversation,
    groupCallPeers,
    groupIsMuted,
    groupDuration,
    leaveGroupCall,
    toggleGroupMute,
    switchGroupMicrophone,
    switchGroupSpeaker,
    groupLocalVideoOn,
    groupLocalScreenSharing,
    groupLocalVideoStream,
    toggleGroupVideo,
    toggleGroupScreenShare,
  } = call;
  const [showAudioSettings, setShowAudioSettings] = useState(false);

  if (groupCallState !== "active") return null;

  const connectingCount = groupCallPeers.filter((p) => !p.connected).length;
  const peersWithVideo = groupCallPeers.filter((p) => p.videoStream);
  const showVideoGrid = groupLocalVideoOn || peersWithVideo.length > 0;

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
          padding: "8px 14px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📞 {groupCallConversation?.name} · {formatCallDuration(groupDuration)}
            {connectingCount > 0 && ` · conectando ${connectingCount}...`}
          </span>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
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
              onClick={toggleGroupVideo}
              title={groupLocalScreenSharing ? "Câmera (pare o compartilhamento de tela primeiro)" : groupLocalVideoOn ? "Desligar câmera" : "Ligar câmera"}
              disabled={groupLocalScreenSharing}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: "none",
                background: groupLocalVideoOn ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.25)",
                color: "white",
                fontSize: 14,
                opacity: groupLocalScreenSharing ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              🎥
            </button>
            <button
              type="button"
              onClick={toggleGroupScreenShare}
              title={groupLocalScreenSharing ? "Parar compartilhamento de tela" : "Compartilhar tela"}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: "none",
                background: groupLocalScreenSharing ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.25)",
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
              onClick={toggleGroupMute}
              title={groupIsMuted ? "Ativar microfone" : "Silenciar microfone"}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: "none",
                background: groupIsMuted ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.25)",
                color: "white",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {groupIsMuted ? "🔇" : "🎙️"}
            </button>
            <button
              type="button"
              onClick={leaveGroupCall}
              title="Sair da chamada"
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

        {showVideoGrid && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 10,
            }}
          >
            {groupLocalVideoOn && (
              <div style={{ width: 130, height: 96 }}>
                <VideoTile stream={groupLocalVideoStream} muted mirrored={!groupLocalScreenSharing} label="Você" />
              </div>
            )}
            {peersWithVideo.map((p) => (
              <div key={p.id} style={{ width: 130, height: 96 }}>
                <VideoTile stream={p.videoStream} label={`${p.username}${p.screenSharing ? " · tela" : ""}`} />
              </div>
            ))}
          </div>
        )}

        {groupCallPeers.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 8, overflowX: "auto", paddingBottom: 2 }}>
            {groupCallPeers.map((p) => (
              <div key={p.id} title={p.username} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
                <div
                  style={{
                    borderRadius: "50%",
                    padding: 2,
                    border: `2px solid ${p.connected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)"}`,
                    opacity: p.connected ? 1 : 0.6,
                  }}
                >
                  <Avatar username={p.username} avatarColor={p.avatarColor} avatarUrl={p.avatarUrl} size={30} />
                </div>
                <span style={{ fontSize: 10, maxWidth: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.username}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAudioSettings && (
        <CallAudioSettingsModal
          onClose={() => setShowAudioSettings(false)}
          live
          onMicChange={switchGroupMicrophone}
          onSpeakerChange={switchGroupSpeaker}
        />
      )}
    </>
  );
}
