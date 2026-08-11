"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext.jsx";
import { useSound } from "@/context/SoundContext.jsx";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import ConversationList from "@/components/sidebar/ConversationList.jsx";
import ChatWindow from "@/components/chat/ChatWindow.jsx";
import ParticipantsList from "@/components/group/ParticipantsList.jsx";
import CreateGroupModal from "@/components/group/CreateGroupModal.jsx";

export default function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const { user, loading, logout } = useAuth();
  const { enabled: soundEnabled, toggle: toggleSound, play: playSound } = useSound();
  const router = useRouter();

  // Evita tocar o som duas vezes para a mesma mensagem (uma vez pelo
  // Realtime, outra pelo polling de segurança abaixo).
  const notifiedIdsRef = useRef(new Set());
  const lastMessageIdsRef = useRef({});

  function notifyIfNew(message) {
    if (!message || !user || message.senderId === user.id) return;
    if (notifiedIdsRef.current.has(message.id)) return;
    notifiedIdsRef.current.add(message.id);
    playSound();
  }

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Busca a lista de conversas e, ao mesmo tempo, serve como rede de
  // segurança para o som: se a última mensagem de alguma conversa mudou
  // desde a última checagem, toca a notificação - isso funciona mesmo se
  // o Realtime (abaixo) não estiver entregando os eventos por algum
  // motivo (RLS, rede, etc), do mesmo jeito que já garantimos para as
  // mensagens dentro da conversa aberta.
  useEffect(() => {
    if (!user) return;

    function poll() {
      fetch("/api/conversations", { credentials: "include" })
        .then((res) => res.json())
        .then((fresh) => {
          if (!Array.isArray(fresh)) return;

          fresh.forEach((conv) => {
            const last = conv.lastMessage;
            const previousId = lastMessageIdsRef.current[conv.id];

            if (last && previousId !== undefined && previousId !== last.id) {
              notifyIfNew(last);
            }
            if (last) lastMessageIdsRef.current[conv.id] = last.id;
          });

          setConversations(fresh);
        })
        .catch(() => {});
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Caminho rápido: quando o Realtime está funcionando, o som toca quase
  // instantaneamente em vez de esperar o próximo polling (até 5s).
  useEffect(() => {
    if (!user || conversations.length === 0) return;

    const supabase = getSupabaseBrowserClient();
    const channels = conversations.map((conv) =>
      supabase
        .channel(`notify-${conv.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conv.id}` },
          (payload) => {
            notifyIfNew({ id: payload.new.id, senderId: payload.new.sender_id });
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, user]);

  function handleGroupCreated() {
    fetch("/api/conversations", { credentials: "include" })
      .then((res) => res.json())
      .then(setConversations);
    setShowGroupModal(false);
  }

  // Usado nos três casos: excluir grupo (admin), sair do grupo e apagar
  // conversa só para mim - em todos, ela some da sua lista.
  function removeConversationFromView(conversationId) {
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    setActiveConversation((prev) => (prev?.id === conversationId ? null : prev));
  }

  if (loading || !user) return null;

  return (
    <div className="app-layout">
      <ConversationList
        conversations={conversations}
        activeId={activeConversation?.id}
        onSelect={setActiveConversation}
        onNewGroup={() => setShowGroupModal(true)}
      />

      <ChatWindow conversation={activeConversation} onHideConversation={removeConversationFromView} />

      <ParticipantsList
        conversation={activeConversation}
        onGroupDeleted={removeConversationFromView}
        onLeftGroup={removeConversationFromView}
      />

      {showGroupModal && (
        <CreateGroupModal onClose={() => setShowGroupModal(false)} onCreated={handleGroupCreated} />
      )}

      <button
        onClick={toggleSound}
        title={soundEnabled ? "Desativar som de notificação" : "Ativar som de notificação"}
        style={{ position: "absolute", top: 10, right: 70, fontSize: 16, padding: "4px 10px" }}
      >
        {soundEnabled ? "🔔" : "🔕"}
      </button>

      <button
        onClick={async () => {
          await logout();
          router.replace("/login");
        }}
        style={{ position: "absolute", top: 10, right: 10, fontSize: 12 }}
        title={`Sair (${user.username})`}
      >
        Sair
      </button>
    </div>
  );
}
