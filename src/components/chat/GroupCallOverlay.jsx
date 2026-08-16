"use client";

import { useState } from "react";
import Avatar from "@/components/common/Avatar.jsx";
import CallAudioSettingsModal from "./CallAudioSettingsModal.jsx";

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
  } = call;
  const [showAudioSettings, setShowAudioSettings] = useState(false);

  if (groupCallState !== "active") return null;

  const connectingCount = groupCallPeers.filter((p) => !p.connected).length;

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
