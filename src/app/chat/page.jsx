"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext.jsx";
import ConversationList from "@/components/sidebar/ConversationList.jsx";
import ChatWindow from "@/components/chat/ChatWindow.jsx";
import ParticipantsList from "@/components/group/ParticipantsList.jsx";
import CreateGroupModal from "@/components/group/CreateGroupModal.jsx";

export default function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const { user, loading, logout } = useAuth();
  const router = useRouter();

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
