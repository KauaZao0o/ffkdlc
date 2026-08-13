"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext.jsx";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import MessageBubble from "./MessageBubble.jsx";
import MessageInput from "./MessageInput.jsx";

const NEAR_BOTTOM_THRESHOLD = 100;

export default function ChatWindow({ conversation, onHideConversation, onBack, onOpenParticipants }) {
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const { user } = useAuth();
  const bottomRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const channelRef = useRef(null);
  const participantsMapRef = useRef({});
  const isAtBottomRef = useRef(true);
  const lastMessageIdRef = useRef(null);

  function scrollToBottom(behavior = "smooth") {
    bottomRef.current?.scrollIntoView({ behavior });
    isAtBottomRef.current = true;
    setShowJumpButton(false);
  }

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD;
    isAtBottomRef.current = nearBottom;
    setShowJumpButton(!nearBottom);
  }

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
        map[p.id] = { username: p.username, avatarColor: p.avatarColor, avatarUrl: p.avatarUrl };
      });
      map[user.id] = { username: user.username, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl };
      participantsMapRef.current = map;

      lastMessageIdRef.current = history[history.length - 1]?.id ?? null;
      setMessages(history);

      // Ao abrir a conversa, sempre começa lá embaixo, na mensagem mais recente.
      requestAnimationFrame(() => scrollToBottom("auto"));
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
                type: row.type,
                fileUrl: row.file_url,
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

  // Só desce a tela sozinho quando: (a) chegou mensagem realmente nova
  // (não é só o polling repetindo a mesma lista) E (b) você já estava
  // olhando as mensagens mais recentes. Se você rolou pra cima de
  // propósito pra ler o histórico, ele não te puxa mais pra baixo.
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const isNewMessage = lastMessage && lastMessage.id !== lastMessageIdRef.current;
    lastMessageIdRef.current = lastMessage?.id ?? null;

    if (isNewMessage && isAtBottomRef.current) {
      scrollToBottom("smooth");
    } else if (isNewMessage) {
      setShowJumpButton(true);
    }
  }, [messages]);

  async function handleSend({ content, type = "text", fileUrl }) {
    const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content, type, fileUrl }),
    });
    const message = await res.json();
    if (res.ok) {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      // Ao enviar você mesmo, sempre desce pra ver sua própria mensagem.
      isAtBottomRef.current = true;
    } else {
      alert(message.error || "Não foi possível enviar.");
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

  async function handleHideConversation() {
    const confirmed = window.confirm(
      `Apagar "${conversation.name}" só para você? Ela continua existindo para os outros participantes.`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/conversations/${conversation.id}/hide`, {
      method: "POST",
      credentials: "include",
    });

    if (res.ok) {
      onHideConversation(conversation.id);
    } else {
      const data = await res.json();
      alert(data.error || "Não foi possível apagar a conversa.");
    }
  }

  if (!conversation) {
    return (
      <div className="chat-main" style={{ alignItems: "center", justifyContent: "center", color: "var(--text-faint)" }}>
        Selecione uma conversa para começar
      </div>
    );
  }

  return (
    <div className="chat-main">
      <div
        style={{
          padding: "12px 18px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <button className="icon-button mobile-only" onClick={onBack} title="Voltar para as conversas">
            ←
          </button>
          <p
            style={{
              margin: 0,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
              flex: 1,
            }}
          >
            {conversation.name}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {conversation.isGroup && (
            <button className="icon-button mobile-only" onClick={onOpenParticipants} title="Ver participantes">
              👥
            </button>
          )}
          <button className="hide-conversation-btn" onClick={handleHideConversation} title="Apagar essa conversa só para você">
            Apagar para mim
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          style={{
            position: "absolute",
            inset: 0,
            padding: 16,
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} isOwn={m.senderId === user.id} onDelete={handleDeleteMessage} />
          ))}
          {typingUser && <p style={{ fontSize: 13, color: "var(--text-faint)", margin: 0 }}>digitando...</p>}
          <div ref={bottomRef} />
        </div>

        {showJumpButton && (
          <button
            onClick={() => scrollToBottom("smooth")}
            className="primary"
            style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              borderRadius: 20,
              fontSize: 13,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            ↓ Novas mensagens
          </button>
        )}
      </div>

      <MessageInput channelRef={channelRef} userId={user.id} conversationId={conversation.id} onSend={handleSend} />
    </div>
  );
}
