"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext.jsx";
import { useProfileView } from "@/context/ProfileViewContext.jsx";
import { usePresence } from "@/context/PresenceContext.jsx";
import AddParticipantsModal from "./AddParticipantsModal.jsx";
import Avatar from "@/components/common/Avatar.jsx";
import { uploadChatFile } from "@/lib/uploadImage";

export default function ParticipantsList({ conversation, onGroupDeleted, onLeftGroup, onGroupUpdated, variant = "panel", onClose }) {
  const [participants, setParticipants] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const { user } = useAuth();
  const { onlineMap } = usePresence();

  const [groupName, setGroupName] = useState(conversation?.name || "");
  const [groupAvatarUrl, setGroupAvatarUrl] = useState(conversation?.avatarUrl || "");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [uploadingGroupAvatar, setUploadingGroupAvatar] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const { openProfile } = useProfileView();

  function loadParticipants() {
    if (!conversation?.isGroup) {
      setParticipants([]);
      return;
    }
    fetch(`/api/conversations/${conversation.id}/participants`, { credentials: "include" })
      .then((res) => res.json())
      .then(setParticipants);
  }

  useEffect(() => {
    loadParticipants();
    setGroupName(conversation?.name || "");
    setGroupAvatarUrl(conversation?.avatarUrl || "");
    setEditingName(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation]);

  if (!conversation?.isGroup) return null;

  const isAdmin = participants.find((p) => p.id === user?.id)?.isAdmin;

  async function patchGroup(data) {
    const res = await fetch(`/api/conversations/${conversation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    if (!res.ok) {
      alert(updated.error || "Não foi possível atualizar o grupo.");
      return false;
    }
    onGroupUpdated?.(updated);
    return true;
  }

  async function handleSaveName() {
    if (!groupName.trim() || groupName.trim() === conversation.name) {
      setEditingName(false);
      setGroupName(conversation.name);
      return;
    }
    setSavingName(true);
    const ok = await patchGroup({ name: groupName.trim() });
    setSavingName(false);
    if (ok) setEditingName(false);
  }

  async function handleGroupAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("A imagem precisa ter no máximo 5MB.");
      return;
    }

    setUploadingGroupAvatar(true);
    try {
      // Usa o mesmo padrão de pasta das imagens de mensagem (a conversa em
      // si), porque é o caminho que já está liberado nas políticas de
      // acesso do Storage - uma pasta nova ("group-avatars/...") cairia
      // fora da regra e o upload seria bloqueado.
      const url = await uploadChatFile(file, conversation.id);
      const ok = await patchGroup({ avatarUrl: url });
      if (ok) setGroupAvatarUrl(url);
    } catch (err) {
      console.error(err);
      alert("Não foi possível enviar a imagem.");
    } finally {
      setUploadingGroupAvatar(false);
    }
  }

  async function handleRemoveParticipant(participant) {
    const confirmed = window.confirm(`Remover ${participant.username} do grupo?`);
    if (!confirmed) return;

    setRemovingId(participant.id);
    const res = await fetch(`/api/conversations/${conversation.id}/participants/${participant.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setRemovingId(null);

    if (res.ok) {
      loadParticipants();
    } else {
      const data = await res.json();
      alert(data.error || "Não foi possível remover essa pessoa.");
    }
  }

  async function handleDeleteGroup() {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o grupo "${conversation.name}" para todo mundo? Essa ação apaga todas as mensagens e não pode ser desfeita.`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/conversations/${conversation.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    const data = await res.json();
    if (res.ok) {
      onGroupDeleted(conversation.id);
    } else {
      alert(data.error || "Não foi possível excluir o grupo.");
    }
  }

  async function handleLeaveGroup() {
    const confirmed = window.confirm(`Sair do grupo "${conversation.name}"? Você vai parar de receber mensagens dele.`);
    if (!confirmed) return;

    const res = await fetch(`/api/conversations/${conversation.id}/leave`, {
      method: "POST",
      credentials: "include",
    });

    const data = await res.json();
    if (res.ok) {
      onLeftGroup(conversation.id);
    } else {
      alert(data.error || "Não foi possível sair do grupo.");
    }
  }

  function handleParticipantsAdded() {
    setShowAddModal(false);
    loadParticipants();
  }

  return (
    <div className={variant === "panel" ? "participants-panel" : "drawer-content"}>
      {/* Nome e foto do grupo - qualquer participante pode alterar. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 20, width: "100%", minWidth: 0 }}>
        <div style={{ position: "relative" }}>
          {groupAvatarUrl ? (
            <img
              src={groupAvatarUrl}
              alt={conversation.name}
              style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--group-avatar-bg)",
                color: "var(--group-avatar-fg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 500,
              }}
            >
              GR
            </div>
          )}
          <label
            title="Trocar foto do grupo"
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {uploadingGroupAvatar ? "…" : "✎"}
            <input
              type="file"
              accept="image/*"
              onChange={handleGroupAvatarChange}
              disabled={uploadingGroupAvatar}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {editingName ? (
          <div style={{ display: "flex", gap: 6, width: "100%" }}>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
              style={{ flex: 1, minWidth: 0, fontSize: 14 }}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
            />
            <button
              onClick={handleSaveName}
              disabled={savingName}
              style={{ fontSize: 12, padding: "4px 8px", flexShrink: 0 }}
            >
              {savingName ? "..." : "OK"}
            </button>
          </div>
        ) : (
          <p
            onClick={() => setEditingName(true)}
            title={conversation.name}
            style={{
              margin: 0,
              fontWeight: 500,
              fontSize: 15,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              width: "100%",
              minWidth: 0,
              justifyContent: "center",
            }}
          >
            <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", minWidth: 0 }}>
              {conversation.name}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-faint)", flexShrink: 0 }}>✎</span>
          </p>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", margin: 0 }}>Participantes</p>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowAddModal(true)} style={{ fontSize: 12, padding: "2px 8px" }} title="Adicionar participante">
            + Add
          </button>
          {variant === "drawer" && (
            <button onClick={onClose} style={{ fontSize: 12, padding: "2px 8px" }} title="Fechar">
              ✕
            </button>
          )}
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {participants.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <button
              onClick={() => openProfile(p.username)}
              title={`Ver perfil de ${p.username}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flex: 1,
                minWidth: 0,
                border: "none",
                background: "transparent",
                padding: 0,
                textAlign: "left",
              }}
            >
              <Avatar
                username={p.username}
                avatarColor={p.avatarColor}
                avatarUrl={p.avatarUrl}
                size={28}
                isOnline={!!onlineMap[p.id]}
              />
              <span style={{ margin: 0, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.username}
                {p.isAdmin ? " (admin)" : ""}
              </span>
            </button>
            {isAdmin && p.id !== user?.id && (
              <button
                onClick={() => handleRemoveParticipant(p)}
                disabled={removingId === p.id}
                title={`Remover ${p.username} do grupo`}
                style={{ fontSize: 11, padding: "2px 6px", color: "var(--danger)", borderColor: "var(--danger)" }}
              >
                {removingId === p.id ? "..." : "Remover"}
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={handleLeaveGroup} style={{ fontSize: 13 }}>
          Sair do grupo
        </button>
        {isAdmin && (
          <button onClick={handleDeleteGroup} style={{ color: "var(--danger)", borderColor: "var(--danger)", fontSize: 13 }}>
            Excluir grupo para todos
          </button>
        )}
      </div>

      {showAddModal && (
        <AddParticipantsModal
          conversation={conversation}
          currentParticipantIds={participants.map((p) => p.id)}
          onClose={() => setShowAddModal(false)}
          onAdded={handleParticipantsAdded}
        />
      )}
    </div>
  );
}
