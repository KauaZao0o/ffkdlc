"use client";

import { useEffect, useState } from "react";

// Mostra um aviso discreto por grupo que tem uma chamada rolando - mesmo
// pra quem não entrou (nem estava olhando quando ela começou). Some
// sozinho quando a última pessoa sai da chamada (a contagem some da
// presença). Não mostra o grupo em que a própria pessoa já está, porque
// esse já tem sua barra própria (GroupCallOverlay).
export default function GroupCallBanners({ call }) {
  const { groupCallBanners, groupCallState, groupCallConversation, joinGroupCall } = call;
  // Fechar o "X" só esconde o aviso por enquanto - se a chamada continuar
  // rolando, entrar nela ainda dá pra fazer pelo botão 📞 na própria
  // conversa. Quando essa chamada acabar e uma nova começar depois, o
  // aviso volta a aparecer normalmente.
  const [dismissedIds, setDismissedIds] = useState(new Set());

  const entries = Object.entries(groupCallBanners || {}).filter(
    ([id]) => !(groupCallState === "active" && groupCallConversation?.id === id)
  );

  useEffect(() => {
    const activeIds = new Set(entries.map(([id]) => id));
    setDismissedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (!activeIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupCallBanners]);

  const visibleEntries = entries.filter(([id]) => !dismissedIds.has(id));

  if (visibleEntries.length === 0) return null;

  // Se já tiver uma chamada em grupo ativa (barra ocupando o topo), empurra
  // os avisos pra baixo dela; senão, fica logo abaixo da barra superior.
  const topOffset = groupCallState === "active" ? 122 : 52;

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
      {visibleEntries.map(([id, banner]) => (
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
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
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setDismissedIds((prev) => new Set(prev).add(id))}
              title="Fechar aviso (ainda dá pra entrar na chamada pela conversa)"
              style={{
                width: 24,
                height: 24,
                padding: 0,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                color: "var(--text-faint)",
                fontSize: 13,
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
