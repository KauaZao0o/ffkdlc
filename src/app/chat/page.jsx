"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext.jsx";
import { useSound } from "@/context/SoundContext.jsx";
import { CallProvider, useCall } from "@/context/CallContext.jsx";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import ConversationList from "@/components/sidebar/ConversationList.jsx";
import ChatWindow from "@/components/chat/ChatWindow.jsx";
import VoiceCallOverlay from "@/components/chat/VoiceCallOverlay.jsx";
import GroupCallOverlay from "@/components/chat/GroupCallOverlay.jsx";
import GroupCallBanners from "@/components/chat/GroupCallBanners.jsx";
import ParticipantsList from "@/components/group/ParticipantsList.jsx";
import CreateGroupModal from "@/components/group/CreateGroupModal.jsx";
import NewConversationModal from "@/components/sidebar/NewConversationModal.jsx";
import SettingsModal from "@/components/settings/SettingsModal.jsx";
import Avatar from "@/components/common/Avatar.jsx";

// Fica dentro do CallProvider pra poder usar useCall() e mostrar a chamada
// (tocando, em andamento, etc) em cima de qualquer tela do app - não só da
// conversa em que a ligação foi feita.
function GlobalCallOverlay() {
  const call = useCall();
  return (
    <>
      <VoiceCallOverlay call={call} />
      <GroupCallOverlay call={call} />
      <GroupCallBanners call={call} />
    </>
  );
}

export default function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // No celular, alterna entre ver a lista de conversas e ver o chat aberto.
  const [mobileView, setMobileView] = useState("list");
  const { user, loading, logout } = useAuth();
  const { enabled: soundEnabled, toggle: toggleSound, play: playSound } = useSound();
  const router = useRouter();

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

  function handleSelectConversation(conversation) {
    setActiveConversation(conversation);
    setMobileView("chat");
  }

  function handleGroupCreated() {
    fetch("/api/conversations", { credentials: "include" })
      .then((res) => res.json())
      .then(setConversations);
    setShowGroupModal(false);
  }

  async function handleConversationStarted(conversationId) {
    const res = await fetch("/api/conversations", { credentials: "include" });
    const fresh = await res.json();
    if (Array.isArray(fresh)) {
      setConversations(fresh);
      const conv = fresh.find((c) => c.id === conversationId);
      if (conv) handleSelectConversation(conv);
    }
    setShowNewConversationModal(false);
  }

  // Usado nos três casos: excluir grupo (admin), sair do grupo e apagar
  // conversa só para mim - em todos, ela some da sua lista.
  function removeConversationFromView(conversationId) {
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    setActiveConversation((prev) => (prev?.id === conversationId ? null : prev));
    setMobileView("list");
    setShowParticipantsDrawer(false);
  }

  // Quando o nome ou a foto do grupo mudam, reflete na lista de conversas
  // e no cabeçalho do chat aberto, sem precisar recarregar a página.
  function handleGroupUpdated(updated) {
    setConversations((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, name: updated.name, avatarUrl: updated.avatarUrl } : c))
    );
    setActiveConversation((prev) =>
      prev?.id === updated.id ? { ...prev, name: updated.name, avatarUrl: updated.avatarUrl } : prev
    );
  }

  if (loading || !user) return null;

  return (
    <CallProvider user={user} conversations={conversations}>
      <div className="app-shell">
        <div className="top-bar">
          <p className="top-bar-title">{activeConversation?.name || "ffpkdlc"}</p>
          <div className="top-bar-actions">
            <button
              className="icon-button"
              onClick={() => setShowSettings(true)}
              title="Configurações"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <Avatar username={user.username} avatarColor={user.avatarColor} avatarUrl={user.avatarUrl} size={34} />
            </button>
            <button
              className="icon-button"
              onClick={toggleSound}
              title={soundEnabled ? "Desativar som de notificações e chamadas" : "Ativar som de notificações e chamadas"}
            >
              {soundEnabled ? "🔔" : "🔕"}
            </button>
            <button
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
              title={`Sair (${user.username})`}
            >
              Sair
            </button>
          </div>
        </div>

        <div className={`app-layout ${mobileView === "chat" ? "mobile-show-chat" : ""}`}>
          <ConversationList
            conversations={conversations}
            activeId={activeConversation?.id}
            onSelect={handleSelectConversation}
            onNewGroup={() => setShowGroupModal(true)}
            onNewConversation={() => setShowNewConversationModal(true)}
          />

          <ChatWindow
            conversation={activeConversation}
            onHideConversation={removeConversationFromView}
            onBack={() => setMobileView("list")}
            onOpenParticipants={() => setShowParticipantsDrawer(true)}
          />

          <ParticipantsList
            conversation={activeConversation}
            onGroupDeleted={removeConversationFromView}
            onLeftGroup={removeConversationFromView}
            onGroupUpdated={handleGroupUpdated}
          />
        </div>

        {showParticipantsDrawer && activeConversation?.isGroup && (
          <div className="drawer-overlay" onClick={() => setShowParticipantsDrawer(false)}>
            <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
              <ParticipantsList
                conversation={activeConversation}
                onGroupDeleted={removeConversationFromView}
                onLeftGroup={removeConversationFromView}
                onGroupUpdated={handleGroupUpdated}
                variant="drawer"
                onClose={() => setShowParticipantsDrawer(false)}
              />
            </div>
          </div>
        )}

        {showGroupModal && (
          <CreateGroupModal onClose={() => setShowGroupModal(false)} onCreated={handleGroupCreated} />
        )}

        {showNewConversationModal && (
          <NewConversationModal onClose={() => setShowNewConversationModal(false)} onStarted={handleConversationStarted} />
        )}

        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

        {/* Fica fora de app-layout e cobre a tela toda - a ligação (e o
            aviso de "alguém ligando") aparece independente de qual
            conversa está aberta. */}
        <GlobalCallOverlay />
      </div>
    </CallProvider>
  );
}
