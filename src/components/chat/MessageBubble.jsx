export default function MessageBubble({ message, isOwn }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}>
      {!isOwn && (
        <span style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{message.sender?.username}</span>
      )}
      <div
        style={{
          background: isOwn ? "#185fa5" : "#f0f0ee",
          color: isOwn ? "white" : "#1c1c1a",
          padding: "8px 12px",
          borderRadius: 12,
          maxWidth: "70%",
          fontSize: 14,
        }}
      >
        {message.content}
      </div>
    </div>
  );
}
