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
        background: isActive ? "#f0f0ee" : "transparent",
      }}
    >
      {conversation.isGroup ? (
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "#dbe9fb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 500,
            color: "#185fa5",
            flexShrink: 0,
          }}
        >
          GR
        </div>
      ) : (
        <Avatar username={conversation.name} avatarColor={otherUser?.avatarColor} avatarUrl={otherUser?.avatarUrl} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{conversation.name}</p>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "#777",
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
