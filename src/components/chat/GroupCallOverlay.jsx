"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/common/Avatar.jsx";
import CallAudioSettingsModal from "./CallAudioSettingsModal.jsx";
import ScreenShareVideo from "./ScreenShareVideo.jsx";
import { MinimizeIcon, ScreenShareIcon } from "./CallIcons.jsx";

function formatCallDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Barra compacta no topo (parecida com a de chamada 1-a-1), mas com uma
// fileira de avatares - um por pessoa na chamada em grupo, com um aro verde
// enquanto a conexão com ela ainda não fechou.
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
    groupIsScreenSharing,
    groupLocalScreenStream,
    groupRemoteScreens,
    toggleGroupScreenShare,
  } = call;
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [screensMinimized, setScreensMinimized] = useState(false);
  const hasScreen = !!(groupLocalScreenStream || Object.keys(groupRemoteScreens).length > 0);

  useEffect(() => {
    if (hasScreen) setScreensMinimized(false);
  }, [hasScreen, groupLocalScreenStream, groupRemoteScreens]);

  // Em grupo a faixa de participantes pode ocupar uma segunda linha.
  useEffect(() => {
    if (groupCallState !== "active") return;
    document.body.classList.add("call-active");
    document.body.style.setProperty("--active-call-bar-height", groupCallPeers.length > 0 ? "104px" : "56px");
    return () => {
      document.body.classList.remove("call-active");
      document.body.style.removeProperty("--active-call-bar-height");
    };
  }, [groupCallState, groupCallPeers.length]);

  if (groupCallState !== "active") return null;

  const connectingCount = groupCallPeers.filter((p) => !p.connected).length;

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
            <span className="call-live-dot" /> {groupCallConversation?.name} <span>· {formatCallDuration(groupDuration)}</span>
            {connectingCount > 0 && ` · conectando ${connectingCount}...`}
          </span>
          <div className="call-control-actions">
            {hasScreen && (
              <button type="button" className="call-control-button" onClick={() => setScreensMinimized((value) => !value)} title={screensMinimized ? "Mostrar compartilhamentos" : "Voltar ao chat"}>
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
              onClick={toggleGroupScreenShare}
              title={groupIsScreenSharing ? "Parar de compartilhar tela" : "Compartilhar tela"}
              className={groupIsScreenSharing ? "call-control-button active" : "call-control-button"}
            >
              <ScreenShareIcon />
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

      {hasScreen && !screensMinimized && (
        <div className="screen-share-dock" aria-label="Telas compartilhadas">
          <button type="button" className="screen-share-minimize" onClick={() => setScreensMinimized(true)} title="Voltar ao chat" aria-label="Voltar ao chat"><MinimizeIcon /></button>
          <ScreenShareVideo stream={groupLocalScreenStream} label="Você está compartilhando" muted />
          {Object.entries(groupRemoteScreens).map(([peerId, stream]) => {
            const peer = groupCallPeers.find((p) => p.id === peerId);
            return <ScreenShareVideo key={peerId} stream={stream} label={`${peer?.username || "Participante"} está compartilhando`} />;
          })}
        </div>
      )}

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
