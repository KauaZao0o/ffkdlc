export default function ConversationItem({ conversation, isActive, onClick }) {
  const initials = conversation.isGroup ? "GR" : conversation.name?.slice(0, 2).toUpperCase() || "??";

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
        {initials}
      </div>
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
