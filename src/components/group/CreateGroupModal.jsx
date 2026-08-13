"use client";

import { useEffect, useState } from "react";

export default function CreateGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, memberIds: selected }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        // resposta sem corpo JSON (ex: erro 500 genérico do servidor)
      }

      if (!res.ok) {
        setError(data?.error || `Erro ao criar grupo (status ${res.status}).`);
        return;
      }

      onCreated(data);
    } catch (err) {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
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
        <h3 style={{ marginTop: 0 }}>Criar grupo</h3>
        <input
          placeholder="Nome do grupo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", marginBottom: 12 }}
        />
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>Participantes</p>
        <div style={{ maxHeight: 160, overflowY: "auto", marginBottom: 16 }}>
          {users.map((u) => (
            <label key={u.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", fontSize: 14 }}>
              <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggleUser(u.id)} />
              {u.username}
            </label>
          ))}
        </div>
        {error && (
          <p style={{ color: "#e5484d", fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="primary" onClick={handleCreate} disabled={loading}>
            {loading ? "Criando..." : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}
