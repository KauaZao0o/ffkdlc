"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext.jsx";

export default function ParticipantsList({ conversation, onGroupDeleted }) {
  const [participants, setParticipants] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!conversation?.isGroup) {
      setParticipants([]);
      return;
    }

    fetch(`/api/conversations/${conversation.id}/participants`, { credentials: "include" })
      .then((res) => res.json())
      .then(setParticipants);
  }, [conversation]);

  if (!conversation?.isGroup) return null;

  const isAdmin = participants.find((p) => p.id === user?.id)?.isAdmin;

  async function handleDeleteGroup() {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o grupo "${conversation.name}"? Essa ação apaga todas as mensagens e não pode ser desfeita.`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/conversations/${conversation.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (res.ok) {
      onGroupDeleted(conversation.id);
    } else {
      const data = await res.json();
      alert(data.error || "Não foi possível excluir o grupo.");
    }
  }

  return (
    <div className="participants-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <p style={{ fontSize: 13, fontWeight: 500, color: "#777", margin: "0 0 12px" }}>Participantes</p>
      <div style={{ flex: 1 }}>
        {participants.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#dbe9fb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 500,
                color: "#185fa5",
              }}
            >
              {p.username.slice(0, 2).toUpperCase()}
            </div>
            <p style={{ margin: 0, fontSize: 13 }}>
              {p.username}
              {p.isAdmin ? " (admin)" : ""}
            </p>
          </div>
        ))}
      </div>

      {isAdmin && (
        <button
          onClick={handleDeleteGroup}
          style={{ color: "#c0392b", borderColor: "#c0392b", fontSize: 13 }}
        >
          Excluir grupo
        </button>
      )}
    </div>
  );
}
