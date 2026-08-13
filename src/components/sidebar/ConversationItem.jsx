import Avatar from "@/components/common/Avatar.jsx";

export default function ConversationItem({ conversation, isActive, onClick }) {
  const otherUser = !conversation.isGroup ? conversation.participants?.[0] : null;

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
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
        <Avatar username={conversation.name} avatarColor={otherUser?.avatarColor} avatarUrl={otherUser?.avatarUrl} />
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
    </div>
  );
}
