"use client";

import { useRef, useState } from "react";

export default function MessageInput({ channelRef, userId, onSend }) {
  const [text, setText] = useState("");
  const typingTimeout = useRef(null);

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
    onSend(text);
    setText("");
    sendTyping(false);
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
      {/* Botão de anexo preparado para a funcionalidade futura de envio de arquivos */}
      <button type="button" title="Anexar arquivo (em breve)" disabled>
        📎
      </button>
      <input type="text" placeholder="Digite uma mensagem" value={text} onChange={handleChange} style={{ flex: 1 }} />
      <button type="submit" className="primary">Enviar</button>
    </form>
  );
}
