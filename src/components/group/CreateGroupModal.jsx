"use client";

import { useEffect, useState } from "react";

export default function CreateGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    fetch("/api/users", { credentials: "include" })
      .then((res) => res.json())
      .then(setUsers);
  }, []);

  function toggleUser(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]));
  }

  async function handleCreate() {
    if (!name.trim() || selected.length === 0) return;
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, memberIds: selected }),
    });
    const data = await res.json();
    if (res.ok) onCreated(data);
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
      <div style={{ background: "white", borderRadius: 12, padding: 24, width: 320, maxWidth: "85vw" }}>
        <h3 style={{ marginTop: 0 }}>Criar grupo</h3>
        <input
          placeholder="Nome do grupo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", marginBottom: 12 }}
        />
        <p style={{ fontSize: 13, color: "#777", marginBottom: 6 }}>Participantes</p>
        <div style={{ maxHeight: 160, overflowY: "auto", marginBottom: 16 }}>
          {users.map((u) => (
            <label key={u.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", fontSize: 14 }}>
              <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggleUser(u.id)} />
              {u.username}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={handleCreate}>Criar</button>
        </div>
      </div>
    </div>
  );
}
