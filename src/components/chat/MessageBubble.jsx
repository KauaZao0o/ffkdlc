"use client";

import { useState } from "react";

export default function MessageBubble({ message, isOwn, onDelete }) {
  const [hover, setHover] = useState(false);
  const isImage = message.type === "image" && message.fileUrl;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}
    >
      {!isOwn && (
        <span style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{message.sender?.username}</span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: isOwn ? "row-reverse" : "row", minWidth: 0 }}>
        <div
          style={{
            background: isOwn ? "#185fa5" : "#f0f0ee",
            color: isOwn ? "white" : "#1c1c1a",
            padding: isImage ? 4 : "8px 12px",
            borderRadius: 12,
            maxWidth: "70%",
            fontSize: 14,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            whiteSpace: "pre-wrap",
          }}
        >
          {isImage ? (
            <img
              src={message.fileUrl}
              alt="Imagem enviada no chat"
              style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, display: "block" }}
            />
          ) : (
            message.content
          )}
        </div>
        {isOwn && hover && (
          <button
            onClick={() => onDelete(message.id)}
            title="Apagar mensagem"
            style={{
              border: "none",
              background: "transparent",
              color: "#c0392b",
              fontSize: 14,
              padding: 2,
              cursor: "pointer",
            }}
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}
