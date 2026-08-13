"use client";

import { useState } from "react";

export default function MessageBubble({ message, isOwn, onDelete }) {
  const [hover, setHover] = useState(false);
  const isImage = message.type === "image" && message.fileUrl;
  const isAudio = message.type === "audio" && message.fileUrl;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        // O maxWidth fica aqui, no wrapper de fora - ele é filho direto do
        // container de mensagens, que tem uma largura de verdade. Dentro de
        // um flex row sem largura própria (como era antes), a porcentagem
        // não tem referência confiável e pode "colapsar" pra quase zero,
        // fazendo cada letra quebrar numa linha.
        alignSelf: isOwn ? "flex-end" : "flex-start",
        maxWidth: "70%",
        minWidth: 0,
      }}
    >
      {!isOwn && (
        <span style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{message.sender?.username}</span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: isOwn ? "row-reverse" : "row", minWidth: 0 }}>
        <div
          style={{
            background: isOwn ? "#185fa5" : "#f0f0ee",
            color: isOwn ? "white" : "#1c1c1a",
            padding: isImage || isAudio ? 4 : "8px 12px",
            borderRadius: 12,
            minWidth: 0,
            fontSize: 14,
            overflowWrap: "break-word",
            whiteSpace: "pre-wrap",
          }}
        >
          {isImage ? (
            <img
              src={message.fileUrl}
              alt="Imagem enviada no chat"
              style={{ maxWidth: "100%", width: 220, maxHeight: 260, borderRadius: 8, display: "block", objectFit: "cover" }}
            />
          ) : isAudio ? (
            <audio controls src={message.fileUrl} style={{ maxWidth: 220, height: 36, display: "block" }} />
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
              flexShrink: 0,
            }}
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}
