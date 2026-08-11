"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext.jsx";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import MessageBubble from "./MessageBubble.jsx";
import MessageInput from "./MessageInput.jsx";

export default function ChatWindow({ conversation }) {
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const { user } = useAuth();
  const bottomRef = useRef(null);
  const channelRef = useRef(null);
  const participantsMapRef = useRef({});

  function fetchMessages() {
    if (!conversation) return;
    fetch(`/api/conversations/${conversation.id}/messages`, { credentials: "include" })
      .then((res) => res.json())
      .then((fresh) => {
        if (Array.isArray(fresh)) setMessages(fresh);
      })
      .catch(() => {});
  }

  // Carrega histórico + participantes e assina o canal em tempo real
  // sempre que a conversa selecionada muda.
  useEffect(() => {
    if (!conversation || !user) return;

    let cancelled = false;

    async function setup() {
      const [messagesRes, participantsRes] = await Promise.all([
        fetch(`/api/conversations/${conversation.id}/messages`, { credentials: "include" }),
        fetch(`/api/conversations/${conversation.id}/participants`, { credentials: "include" }),
      ]);

      const history = await messagesRes.json();
      const participants = await participantsRes.json();

      if (cancelled) return;

      const map = {};
      participants.forEach((p) => {
        map[p.id] = { username: p.username, avatarColor: p.avatarColor };
      });
      map[user.id] = { username: user.username, avatarColor: user.avatarColor };
      participantsMapRef.current = map;

      setMessages(history);
    }

    setup();

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`conversation-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const row = payload.new;
          const sender = participantsMapRef.current[row.sender_id] || { username: "???" };

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                content: row.content,
                createdAt: row.created_at,
                senderId: row.sender_id,
                conversationId: row.conversation_id,
                sender,
              },
            ];
          });
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        setTypingUser(payload.isTyping ? payload.userId : null);
      })
      .subscribe();

    channelRef.current = channel;

    // Rede de segurança: mesmo se o Realtime falhar (RLS mal configurado,
    // rede instável, etc), essa atualização periódica garante que as
    // mensagens (e exclusões) cheguem sem precisar dar refresh manual.
    const pollInterval = setInterval(fetchMessages, 4000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(content) {
    const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
    });
    const message = await res.json();
    if (res.ok) {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    }
  }

  async function handleDeleteMessage(messageId) {
    const previous = messages;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    const res = await fetch(`/api/conversations/${conversation.id}/messages/${messageId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) {
      // Se der erro no servidor, volta a mensagem pra tela.
      setMessages(previous);
    }
  }

  if (!conversation) {
    return (
      <div className="chat-main" style={{ alignItems: "center", justifyContent: "center", color: "#888" }}>
        Selecione uma conversa para começar
      </div>
    );
  }

  return (
    <div className="chat-main">
      <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e2e0", background: "white" }}>
        <p style={{ margin: 0, fontWeight: 500 }}>{conversation.name}</p>
      </div>

      <div style={{ flex: 1, padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isOwn={m.senderId === user.id}
            onDelete={handleDeleteMessage}
          />
        ))}
        {typingUser && <p style={{ fontSize: 13, color: "#888", margin: 0 }}>digitando...</p>}
        <div ref={bottomRef} />
      </div>

      <MessageInput channelRef={channelRef} userId={user.id} onSend={handleSend} />
    </div>
  );
}
