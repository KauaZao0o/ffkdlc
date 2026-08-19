"use client";

import { useProfileView } from "@/context/ProfileViewContext.jsx";
import { usePresence } from "@/context/PresenceContext.jsx";
import Avatar from "@/components/common/Avatar.jsx";

export default function ConversationItem({ conversation, isActive, onClick, onHide }) {
  const otherUser = !conversation.isGroup ? conversation.participants?.[0] : null;
  const { openProfile } = useProfileView();
  const { onlineMap } = usePresence();

  async function handleHide(e) {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Apagar "${conversation.name}" só para você? Ela continua existindo para os outros participantes.`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/conversations/${conversation.id}/hide`, {
      method: "POST",
      credentials: "include",
    });

    if (res.ok) {
      onHide(conversation.id);
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Não foi possível apagar a conversa.");
    }
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        cursor: "pointer",
        background: isActive ? "var(--surface-hover)" : "transparent",
      }}
    >
      {conversation.isGroup ? (
        conversation.avatarUrl ? (
          <img
            src={conversation.avatarUrl}
            alt={conversation.name}
            style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "var(--group-avatar-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--group-avatar-fg)",
              flexShrink: 0,
            }}
          >
            GR
          </div>
        )
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            openProfile(otherUser?.username);
          }}
          title={`Ver perfil de ${otherUser?.username}`}
          style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", flexShrink: 0 }}
        >
          <Avatar
            username={conversation.name}
            avatarColor={otherUser?.avatarColor}
            avatarUrl={otherUser?.avatarUrl}
            isOnline={!!onlineMap[otherUser?.id]}
          />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {conversation.name}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {conversation.lastMessage?.content || "Nenhuma mensagem ainda"}
        </p>
      </div>
      <button
        onClick={handleHide}
        title="Apagar essa conversa só para você"
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
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
  );
}
