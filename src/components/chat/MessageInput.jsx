"use client";

import { useRef, useState } from "react";
import { uploadChatImage } from "@/lib/uploadImage";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function MessageInput({ channelRef, userId, conversationId, onSend }) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);

  function sendTyping(isTyping) {
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId, isTyping },
    });
  }

  function handleChange(e) {
    setText(e.target.value);

    sendTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTyping(false), 1200);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend({ content: text });
    setText("");
    sendTyping(false);
  }

  async function sendImageFile(file) {
    if (!file.type.startsWith("image/")) {
      alert("Por enquanto só é possível enviar imagens.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert("A imagem precisa ter no máximo 5MB.");
      return;
    }

    setUploading(true);
    try {
      const fileUrl = await uploadChatImage(file, conversationId);
      onSend({ content: "", type: "image", fileUrl });
    } catch (err) {
      console.error(err);
      alert("Não foi possível enviar a imagem. Confira se o bucket 'chat-files' existe no Supabase.");
    } finally {
      setUploading(false);
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (file) await sendImageFile(file);
  }

  // Permite colar uma imagem copiada (print, ou copiada de outro site)
  // direto no campo de mensagem com Ctrl+V / Cmd+V.
  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          sendImageFile(file);
        }
        break;
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: "12px 16px",
        borderTop: "1px solid #e2e2e0",
        display: "flex",
        gap: 8,
        alignItems: "center",
        background: "white",
      }}
    >
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileSelected}
        style={{ display: "none" }}
      />
      <button
        type="button"
        title="Enviar foto"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "..." : "📷"}
      </button>
      <input
        type="text"
        placeholder={uploading ? "Enviando imagem..." : "Digite uma mensagem (ou cole uma imagem aqui)"}
        value={text}
        onChange={handleChange}
        onPaste={handlePaste}
        disabled={uploading}
        style={{ flex: 1 }}
      />
      <button type="submit" className="primary" disabled={uploading}>
        Enviar
      </button>
    </form>
  );
}
