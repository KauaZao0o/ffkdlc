import ConversationItem from "./ConversationItem.jsx";

export default function ConversationList({ conversations, activeId, onSelect, onNewGroup }) {
  return (
    <div className="sidebar">
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <p style={{ fontWeight: 500, fontSize: 16, margin: 0 }}>Conversas</p>
        <button onClick={onNewGroup} title="Criar grupo">+ Grupo</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {conversations.length === 0 && (
          <p style={{ padding: 16, fontSize: 13, color: "var(--text-faint)" }}>Nenhuma conversa ainda. Comece uma nova!</p>
        )}
        {conversations.map((c) => (
          <ConversationItem key={c.id} conversation={c} isActive={c.id === activeId} onClick={() => onSelect(c)} />
        ))}
      </div>
    </div>
  );
}
