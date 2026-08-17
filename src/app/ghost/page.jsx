"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext.jsx";

// Painel só é útil pra quem está logado como a conta Ghost - as rotas
// /api/admin/* já recusam qualquer outro usuário (404, pra não denunciar
// que existem). Pra quem não é Ghost, essa página não mostra nada.
export default function GhostPage() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user?.isGhost) return null;

  return <GhostPanel />;
}

function GhostPanel() {
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messageId, setMessageId] = useState("");
  const [status, setStatus] = useState("");

  function loadAll() {
    fetch("/api/admin/users", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then(setUsers);
    fetch("/api/admin/conversations", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then(setConversations);
  }

  useEffect(loadAll, []);

  const privateConversations = conversations.filter((c) => !c.isGroup);
  const groupConversations = conversations.filter((c) => c.isGroup);

  async function deleteUser(id, username) {
    if (!confirm(`Apagar o usuário "${username}" e tudo que ele criou?`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE", credentials: "include" });
    setStatus(res.ok ? `Usuário "${username}" apagado.` : "Erro ao apagar usuário.");
    loadAll();
  }

  async function renameUser(id, currentUsername) {
    const next = prompt(`Novo nome de usuário para "${currentUsername}":`, currentUsername);
    if (next === null || next.trim() === "" || next.trim() === currentUsername) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: next.trim() }),
    });
    const data = await res.json().catch(() => null);
    setStatus(res.ok ? `Usuário renomeado para "${data.username}".` : data?.error || "Erro ao renomear usuário.");
    loadAll();
  }

  async function changePassword(id, username) {
    const next = prompt(`Nova senha para "${username}":`);
    if (!next) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password: next }),
    });
    const data = await res.json().catch(() => null);
    setStatus(res.ok ? `Senha de "${username}" alterada.` : data?.error || "Erro ao trocar senha.");
  }

  async function renameGroup(id, currentName) {
    const next = prompt(`Novo nome para o grupo "${currentName || ""}":`, currentName || "");
    if (next === null || next.trim() === "" || next.trim() === currentName) return;
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: next.trim() }),
    });
    const data = await res.json().catch(() => null);
    setStatus(res.ok ? `Grupo renomeado para "${data.name}".` : data?.error || "Erro ao renomear grupo.");
    loadAll();
  }

  async function deleteConversation(id) {
    if (!confirm("Apagar essa conversa (e todas as mensagens dela)?")) return;
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE", credentials: "include" });
    setStatus(res.ok ? "Conversa apagada." : "Erro ao apagar conversa.");
    loadAll();
  }

  async function removeParticipant(conversationId, userId, username) {
    if (!confirm(`Remover "${username}" dessa conversa?`)) return;
    const res = await fetch(`/api/conversations/${conversationId}/participants/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    setStatus(res.ok ? `"${username}" removido.` : "Erro ao remover participante.");
    loadAll();
  }

  async function deleteMessageById(e) {
    e.preventDefault();
    const [conversationId, msgId] = messageId.split("/").map((s) => s.trim());
    if (!conversationId || !msgId) {
      setStatus("Formato esperado: conversationId/messageId");
      return;
    }
    const res = await fetch(`/api/conversations/${conversationId}/messages/${msgId}`, {
      method: "DELETE",
      credentials: "include",
    });
    setStatus(res.ok ? "Mensagem apagada." : "Erro ao apagar mensagem.");
    setMessageId("");
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "var(--text)", background: "var(--bg)", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 20 }}>Ghost</h1>
      {status && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{status}</p>}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>Usuários ({users.length})</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {users.map((u) => (
            <div
              key={u.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                gap: 8,
              }}
            >
              <span style={{ fontSize: 14 }}>
                {u.username} <span style={{ color: "var(--text-faint)", fontSize: 12 }}>{u.id}</span>
              </span>
              <span style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                <button onClick={() => renameUser(u.id, u.username)}>Renomear</button>
                <button onClick={() => changePassword(u.id, u.username)}>Trocar senha</button>
                <button onClick={() => deleteUser(u.id, u.username)} style={{ color: "var(--danger)" }}>
                  Apagar
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>Conversas ({privateConversations.length})</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {privateConversations.map((c) => (
            <div
              key={c.id}
              style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14 }}>
                  {c.members.map((m) => m.username).join(" · ") || "(sem participantes)"}{" "}
                  <span style={{ color: "var(--text-faint)", fontSize: 12 }}>
                    {c.id} · {c.messageCount} msgs
                  </span>
                </span>
                <button onClick={() => deleteConversation(c.id)} style={{ color: "var(--danger)" }}>
                  Apagar conversa
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>Grupos ({groupConversations.length})</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {groupConversations.map((c) => (
            <div
              key={c.id}
              style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14 }}>
                  {c.name || "(sem nome)"}{" "}
                  <span style={{ color: "var(--text-faint)", fontSize: 12 }}>
                    {c.id} · {c.messageCount} msgs
                  </span>
                </span>
                <span style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                  <button onClick={() => renameGroup(c.id, c.name)}>Renomear grupo</button>
                  <button onClick={() => deleteConversation(c.id)} style={{ color: "var(--danger)" }}>
                    Apagar conversa
                  </button>
                </span>
              </div>
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {c.members.map((m) => (
                  <span
                    key={m.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      background: "var(--surface-hover)",
                      borderRadius: 999,
                      padding: "2px 8px",
                    }}
                  >
                    {m.username}
                    <button
                      onClick={() => removeParticipant(c.id, m.id, m.username)}
                      title="Remover da conversa"
                      style={{ color: "var(--danger)", fontSize: 11 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>Apagar mensagem por ID</h2>
        <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
          O conteúdo das mensagens não é listado aqui. Informe conversationId/messageId (visível no seu próprio
          histórico de rede/DB) pra apagar uma mensagem específica.
        </p>
        <form onSubmit={deleteMessageById} style={{ display: "flex", gap: 8 }}>
          <input
            value={messageId}
            onChange={(e) => setMessageId(e.target.value)}
            placeholder="conversationId/messageId"
            style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid var(--input-border)", background: "var(--surface)", color: "var(--text)" }}
          />
          <button type="submit">Apagar</button>
        </form>
      </section>
    </div>
  );
}
