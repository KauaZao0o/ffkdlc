"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/common/Avatar.jsx";
import AudioMessage from "./AudioMessage.jsx";

function formatMessageTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// O nome original do arquivo vai embutido na própria URL (ver uploadImage.js),
// no formato ".../<uuid>-<nome-original>". Aqui a gente extrai só o nome pra
// mostrar pro usuário, sem precisar de uma coluna nova no banco.
function fileNameFromUrl(url) {
  try {
    const last = decodeURIComponent(url.split("/").pop() || "arquivo");
    return last.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "");
  } catch {
    return "arquivo";
  }
}

const FILE_ICONS = {
  pdf: "📕",
  csv: "📊",
  xls: "📊",
  xlsx: "📊",
  txt: "📄",
  doc: "📝",
  docx: "📝",
  ppt: "📙",
  pptx: "📙",
  zip: "🗜️",
};

function FileMessage({ url, isOwn }) {
  const name = fileNameFromUrl(url);
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const icon = FILE_ICONS[ext] || "📎";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={name}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: 210,
        padding: "6px 4px",
        textDecoration: "none",
        color: isOwn ? "var(--bubble-own-text)" : "var(--bubble-other-text)",
      }}
    >
      <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
      <span
        style={{
          fontSize: 13,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {name}
      </span>
    </a>
  );
}

const MENU_WIDTH = 180;

export default function MessageBubble({ message, isOwn, canDeleteForEveryone, onHideForMe, onDeleteForEveryone }) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);
  const isImage = message.type === "image" && message.fileUrl;
  const isAudio = message.type === "audio" && message.fileUrl;
  const isFile = message.type === "file" && message.fileUrl;

  // Fecha o menu se a pessoa tocar/clicar em qualquer outro lugar da tela,
  // ou rolar a conversa (já que o menu é posicionado "fixed").
  useEffect(() => {
    if (!showMenu) return;

    function handleOutsideClick(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        !menuButtonRef.current?.contains(e.target)
      ) {
        setShowMenu(false);
      }
    }
    function handleScrollOrResize() {
      setShowMenu(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [showMenu]);

  function openMenu() {
    const btn = menuButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();

    // Calcula a posição em relação à tela inteira e prende dentro dos
    // limites visíveis - nunca deixa vazar pra fora, nem à esquerda nem
    // à direita, não importa onde a mensagem esteja.
    let left = isOwn ? rect.right - MENU_WIDTH : rect.left;
    left = Math.min(Math.max(8, left), window.innerWidth - MENU_WIDTH - 8);
    const top = Math.min(rect.bottom + 4, window.innerHeight - 90);

    setMenuPos({ top, left });
    setShowMenu(true);
  }

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
                padding: isImage || isAudio || isFile ? 4 : "8px 12px",
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
              ) : isFile ? (
                <FileMessage url={message.fileUrl} isOwn={isOwn} />
              ) : (
                message.content
              )}
            </div>

            <button
              ref={menuButtonRef}
              onClick={openMenu}
              title="Opções da mensagem"
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text-faint)",
                fontSize: 16,
                lineHeight: 1,
                padding: "6px 4px",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              ⋮
            </button>
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

      {showMenu && menuPos && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            width: MENU_WIDTH,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            zIndex: 50,
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
  );
}
