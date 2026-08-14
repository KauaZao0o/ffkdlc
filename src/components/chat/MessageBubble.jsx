"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/common/Avatar.jsx";
import AudioMessage from "./AudioMessage.jsx";

const MENTION_SPLIT_REGEX = /(@[a-zA-Z0-9_]+)/g;
const MENTION_TEST_REGEX = /^@[a-zA-Z0-9_]+$/;

function renderContentWithMentions(content) {
  const parts = content.split(MENTION_SPLIT_REGEX);
  return parts.map((part, i) =>
    MENTION_TEST_REGEX.test(part) ? (
      <span key={i} style={{ fontWeight: 700, color: "var(--primary-bg)" }}>
        {part}
      </span>
    ) : (
      part
    )
  );
}
function formatMessageTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// O nome original do arquivo vai embutido na própria URL (ver uploadImage.js),
// no formato ".../<uuid>-<nome-original>". Aqui a gente extrai só o nome pra
// mostrar pro usuário, sem precisar de uma coluna nova no banco.
function fileNameFromUrl(url) {
  try {
    const withoutQuery = url.split("?")[0];
    const last = decodeURIComponent(withoutQuery.split("/").pop() || "arquivo");
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

// Texto curto pra mostrar dentro da citação de "respondendo a" - se a
// mensagem original era uma foto/áudio/arquivo, mostra um rótulo em vez
// do conteúdo cru.
function replyPreviewText(replyTo) {
  if (!replyTo) return "";
  if (replyTo.type === "image") return "📷 Foto";
  if (replyTo.type === "audio") return "🎤 Áudio";
  if (replyTo.type === "file") return `📎 ${fileNameFromUrl(replyTo.fileUrl || "")}`;
  return replyTo.content || "";
}

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

export default function MessageBubble({ message, isOwn, canDeleteForEveryone, onHideForMe, onDeleteForEveryone, onReply }) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);
  const isImage = message.type === "image" && message.fileUrl;
  const isAudio = message.type === "audio" && message.fileUrl;
  const isFile = message.type === "file" && message.fileUrl;
  const hasFile = isImage || isAudio || isFile;

  function handleReply() {
    setShowMenu(false);
    onReply(message);
  }

  async function handleSave() {
    setShowMenu(false);
    try {
      const res = await fetch(message.fileUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileNameFromUrl(message.fileUrl);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
      alert("Não foi possível salvar o arquivo.");
    }
  }

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
    const top = Math.min(rect.bottom + 4, window.innerHeight - 190);

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
              {message.replyTo && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    marginBottom: 6,
                    padding: "5px 8px",
                    borderRadius: 6,
                    borderLeft: `3px solid ${isOwn ? "rgba(255,255,255,0.65)" : "var(--group-avatar-fg)"}`,
                    background: isOwn ? "rgba(255,255,255,0.15)" : "var(--surface-hover)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: isOwn ? "rgba(255,255,255,0.9)" : "var(--group-avatar-fg)",
                    }}
                  >
                    {message.replyTo.sender?.username}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      opacity: 0.85,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {replyPreviewText(message.replyTo)}
                  </span>
                </div>
              )}
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
                renderContentWithMentions(message.content)
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
            onClick={handleReply}
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
            ↩ Responder
          </button>
          {hasFile && (
            <button
              onClick={handleSave}
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
                color: "var(--text)",
              }}
            >
              💾 Salvar
            </button>
          )}
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
              borderTop: "1px solid var(--border)",
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
