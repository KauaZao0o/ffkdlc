"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/common/Avatar.jsx";
import AudioMessage from "./AudioMessage.jsx";

function formatMessageTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ message, isOwn, canDeleteForEveryone, onHideForMe, onDeleteForEveryone }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const isImage = message.type === "image" && message.fileUrl;
  const isAudio = message.type === "audio" && message.fileUrl;

  // Fecha o menu se a pessoa tocar/clicar em qualquer outro lugar da tela.
  useEffect(() => {
    if (!showMenu) return;

    function handleOutsideClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [showMenu]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignSelf: isOwn ? "flex-end" : "flex-start",
        maxWidth: "78%",
        minWidth: 0,
      }}
    >
      {!isOwn && (
        <span style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 2, marginLeft: 40 }}>
          {message.sender?.username}
        </span>
      )}
      {/* A foto de perfil sempre fica no mesmo lado externo da bolha: à
          direita nas mensagens próprias, à esquerda nas dos outros. */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flexDirection: isOwn ? "row-reverse" : "row", minWidth: 0 }}>
        <Avatar
          username={message.sender?.username}
          avatarColor={message.sender?.avatarColor}
          avatarUrl={message.sender?.avatarUrl}
          size={28}
        />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexDirection: isOwn ? "row-reverse" : "row", minWidth: 0 }}>
            <div
              style={{
                background: isOwn ? "var(--bubble-own-bg)" : "var(--bubble-other-bg)",
                color: isOwn ? "var(--bubble-own-text)" : "var(--bubble-other-text)",
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
                <AudioMessage src={message.fileUrl} isOwn={isOwn} />
              ) : (
                message.content
              )}
            </div>

            {/* Botão de opções: sempre visível (não depende de hover), pra
                funcionar bem no toque do celular. */}
            <div style={{ position: "relative", flexShrink: 0 }} ref={menuRef}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                title="Opções da mensagem"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--text-faint)",
                  fontSize: 16,
                  lineHeight: 1,
                  padding: "6px 4px",
                  cursor: "pointer",
                }}
              >
                ⋮
              </button>

              {showMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    [isOwn ? "right" : "left"]: 0,
                    marginTop: 4,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    zIndex: 5,
                    minWidth: 170,
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onHideForMe(message.id);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      borderRadius: 0,
                      padding: "10px 14px",
                      fontSize: 13,
                      background: "var(--surface)",
                      color: "var(--text)",
                    }}
                  >
                    Apagar para mim
                  </button>
                  {canDeleteForEveryone && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onDeleteForEveryone(message.id);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        borderRadius: 0,
                        borderTop: "1px solid var(--border)",
                        padding: "10px 14px",
                        fontSize: 13,
                        background: "var(--surface)",
                        color: "var(--danger)",
                      }}
                    >
                      Apagar para todos
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <span
            style={{
              fontSize: 10,
              color: "var(--text-faint)",
              marginTop: 2,
              alignSelf: isOwn ? "flex-end" : "flex-start",
            }}
          >
            {formatMessageTime(message.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
