"use client";

// Mostra um aviso discreto por grupo que tem uma chamada rolando - mesmo
// pra quem não entrou (nem estava olhando quando ela começou). Some
// sozinho quando a última pessoa sai da chamada (a contagem some da
// presença). Não mostra o grupo em que a própria pessoa já está, porque
// esse já tem sua barra própria (GroupCallOverlay).
export default function GroupCallBanners({ call }) {
  const { groupCallBanners, groupCallState, groupCallConversation, joinGroupCall } = call;

  const entries = Object.entries(groupCallBanners || {}).filter(
    ([id]) => !(groupCallState === "active" && groupCallConversation?.id === id)
  );

  if (entries.length === 0) return null;

  // Se já tiver uma chamada em grupo ativa (barra ocupando o topo), empurra
  // os avisos pra baixo dela - e mais ainda se a grade de vídeo também
  // estiver visível; senão, fica logo abaixo da barra superior.
  const hasGroupVideo =
    groupCallState === "active" &&
    (call.groupLocalVideoOn || (call.groupCallPeers || []).some((p) => p.videoStream));
  const topOffset = groupCallState === "active" ? (hasGroupVideo ? 228 : 122) : 52;

  return (
    <div
      style={{
        position: "fixed",
        top: topOffset,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 55,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "center",
        width: "min(360px, 92vw)",
      }}
    >
      {entries.map(([id, banner]) => (
        <div
          key={id}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "8px 12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📞 Chamada em andamento em <strong>{banner.conversationName}</strong> ({banner.count})
          </span>
          <button
            type="button"
            onClick={() => joinGroupCall({ id, name: banner.conversationName, isGroup: true })}
            disabled={call.callState !== "idle" || call.groupCallState !== "idle"}
            style={{
              background: "var(--success)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            Entrar
          </button>
        </div>
      ))}
    </div>
  );
}
