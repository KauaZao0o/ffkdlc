"use client";

import { useEffect, useState } from "react";

export default function AddParticipantsModal({ conversation, currentParticipantIds, onClose, onAdded }) {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    fetch("/api/users", { credentials: "include" })
      .then((res) => res.json())
      .then((all) => setUsers(all.filter((u) => !currentParticipantIds.includes(u.id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleUser(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]));
  }

  async function handleAdd() {
    if (selected.length === 0) return;

    const res = await fetch(`/api/conversations/${conversation.id}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ memberIds: selected }),
    });

    if (res.ok) {
      onAdded();
    } else {
      const data = await res.json();
      alert(data.error || "Não foi possível adicionar os participantes.");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
      }}
    >
      <div style={{ background: "var(--surface)", color: "var(--text)", borderRadius: 12, padding: 24, width: 320, maxWidth: "85vw" }}>
        <h3 style={{ marginTop: 0 }}>Adicionar participantes</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>Escolha quem entrar no grupo "{conversation.name}"</p>
        <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 16 }}>
          {users.length === 0 && <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Todo mundo já está nesse grupo.</p>}
          {users.map((u) => (
            <label key={u.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", fontSize: 14 }}>
              <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggleUser(u.id)} />
              {u.username}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={handleAdd} disabled={selected.length === 0}>
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
