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
  const activeConversationRef = useRef(null);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  function loadConversations() {
    fetch("/api/conversations", { credentials: "include" })
      .then((res) => res.json())
      .then(setConversations);
  }

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  // Toca o som de notificação para mensagens novas de QUALQUER conversa
  // (não só a que está aberta na tela), simulando receber uma notificação
  // em segundo plano. Um canal por conversa, todos escutando ao mesmo tempo.
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
            if (payload.new.sender_id === user.id) return;
            playSound();
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
    setShowGroupModal(false);
    loadConversations();
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
