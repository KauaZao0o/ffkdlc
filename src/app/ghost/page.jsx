"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext.jsx";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

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
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [bansByGroup, setBansByGroup] = useState({});
  const [banSelect, setBanSelect] = useState({});
  const settingsChannelRef = useRef(null);

  // Canal só de "avisar quem está com /login ou /register aberto" que o
  // cadastro público mudou - assim a tela deles atualiza na hora, sem
  // precisar recarregar.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel("app-settings");
    channel.subscribe();
    settingsChannelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, []);

  function loadAll() {
    fetch("/api/admin/users", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then(setUsers);
    fetch("/api/admin/conversations", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then(setConversations);
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setRegistrationEnabled(data.registrationEnabled !== false));
  }

  useEffect(loadAll, []);

  useEffect(() => {
    conversations
      .filter((c) => c.isGroup)
      .forEach((c) => {
        fetch(`/api/admin/conversations/${c.id}/bans`, { credentials: "include" })
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => setBansByGroup((prev) => ({ ...prev, [c.id]: data })));
      });
  }, [conversations]);

  async function banUser(conversationId) {
    const targetId = banSelect[conversationId];
    if (!targetId) return;
    const res = await fetch(`/api/admin/conversations/${conversationId}/bans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId: targetId }),
    });
    if (res.ok) {
      const updated = await fetch(`/api/admin/conversations/${conversationId}/bans`, { credentials: "include" }).then((r) => r.json());
      setBansByGroup((prev) => ({ ...prev, [conversationId]: updated }));
      setBanSelect((prev) => ({ ...prev, [conversationId]: "" }));
      setStatus("Usuário banido desse grupo.");
    } else {
      setStatus("Erro ao banir usuário.");
    }
  }

  async function unbanUser(conversationId, userId, username) {
    const res = await fetch(`/api/admin/conversations/${conversationId}/bans/${userId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setBansByGroup((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter((b) => b.userId !== userId),
      }));
      setStatus(`"${username}" pode ser adicionado ao grupo de novo.`);
    }
  }

  async function toggleRegistration() {
    const next = !registrationEnabled;
    setRegistrationEnabled(next);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ registrationEnabled: next }),
    });
    if (!res.ok) {
      setRegistrationEnabled(!next);
      setStatus("Erro ao atualizar o cadastro público.");
      return;
    }
    settingsChannelRef.current?.send({
      type: "broadcast",
      event: "registration-toggle",
      payload: { registrationEnabled: next },
    });
    setStatus(next ? "Cadastro público ativado." : "Cadastro público desativado.");
  }

  async function createUser(e) {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;
    setCreatingUser(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: newUsername.trim(), password: newPassword }),
    });
    const data = await res.json().catch(() => null);
    setCreatingUser(false);
    setStatus(res.ok ? `Usuário "${data.username}" criado.` : data?.error || "Erro ao criar usuário.");
    if (res.ok) {
      setNewUsername("");
      setNewPassword("");
      loadAll();
    }
  }

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
    <div className="ghost-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Ghost</h1>
        <Link href="/chat" className="ghost-back-link">
          ← Voltar para o chat
        </Link>
      </div>
      {status && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{status}</p>}

      <section style={{ marginTop: 24, padding: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Cadastro público</span>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-faint)" }}>
              Controla o link "Cadastre-se" no /login e a rota /register.
            </p>
          </span>
          <span className="theme-switch">
            <input type="checkbox" checked={registrationEnabled} onChange={toggleRegistration} />
            <span className="theme-switch-track" />
          </span>
        </label>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>Registrar usuário</h2>
        <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: -4 }}>
          Funciona mesmo com o cadastro público desativado.
        </p>
        <form onSubmit={createUser} className="ghost-message-form">
          <input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Usuário"
            style={{ flex: 1, minWidth: 0 }}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Senha"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="submit" className="primary" disabled={creatingUser}>
            {creatingUser ? "..." : "Registrar"}
          </button>
        </form>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16 }}>Usuários ({users.length})</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {users.map((u) => (
            <div key={u.id} className="ghost-row">
              <span className="ghost-row-info">
                {u.username}
                <span className="ghost-row-id">{u.id}</span>
              </span>
              <span className="ghost-row-actions">
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
            <div key={c.id} className="ghost-row">
              <span className="ghost-row-info">
                {c.members.map((m) => m.username).join(" · ") || "(sem participantes)"}
                <span className="ghost-row-id">
                  {c.id} · {c.messageCount} msgs
                </span>
              </span>
              <span className="ghost-row-actions">
                <button onClick={() => deleteConversation(c.id)} style={{ color: "var(--danger)" }}>
                  Apagar conversa
                </button>
              </span>
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
              <div className="ghost-row" style={{ padding: 0, border: "none", background: "transparent" }}>
                <span className="ghost-row-info">
                  {c.name || "(sem nome)"}
                  <span className="ghost-row-id">
                    {c.id} · {c.messageCount} msgs
                  </span>
                </span>
                <span className="ghost-row-actions">
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

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                <p style={{ margin: "0 0 6px", fontSize: 11, color: "var(--text-faint)" }}>
                  Banidos desse grupo (não podem ser adicionados)
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {(bansByGroup[c.id] || []).length === 0 && (
                    <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Ninguém banido.</span>
                  )}
                  {(bansByGroup[c.id] || []).map((b) => (
                    <span
                      key={b.userId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        background: "var(--surface-hover)",
                        borderRadius: 999,
                        padding: "2px 8px",
                        color: "var(--danger)",
                      }}
                    >
                      {b.username}
                      <button onClick={() => unbanUser(c.id, b.userId, b.username)} title="Desbanir" style={{ fontSize: 11 }}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="ghost-message-form">
                  <div className="ghost-select-wrap">
                    <select
                      value={banSelect[c.id] || ""}
                      onChange={(e) => setBanSelect((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      className="ghost-select"
                    >
                      <option value="">Selecione um usuário...</option>
                      {users
                        .filter((u) => !c.members.some((m) => m.id === u.id))
                        .filter((u) => !(bansByGroup[c.id] || []).some((b) => b.userId === u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                    </select>
                    <span className="ghost-select-arrow">▾</span>
                  </div>
                  <button onClick={() => banUser(c.id)} disabled={!banSelect[c.id]} style={{ fontSize: 12 }}>
                    Banir
                  </button>
                </div>
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
        <form onSubmit={deleteMessageById} className="ghost-message-form">
          <input
            value={messageId}
            onChange={(e) => setMessageId(e.target.value)}
            placeholder="conversationId/messageId"
            style={{ flex: 1, minWidth: 0, padding: 8, borderRadius: 6, border: "1px solid var(--input-border)", background: "var(--surface)", color: "var(--text)" }}
          />
          <button type="submit">Apagar</button>
        </form>
      </section>

      <style jsx>{`
        .ghost-page {
          max-width: 900px;
          margin: 0 auto;
          padding: 24px;
          color: var(--text);
          background: var(--bg);
          min-height: 100vh;
          box-sizing: border-box;
        }

        .ghost-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
        }

        .ghost-row-info {
          font-size: 14px;
          min-width: 0;
          flex: 1 1 220px;
        }

        .ghost-row-id {
          display: block;
          color: var(--text-faint);
          font-size: 11px;
          word-break: break-all;
        }

        .ghost-row-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }

        .ghost-message-form {
          display: flex;
          gap: 8px;
        }

        .ghost-select-wrap {
          position: relative;
          flex: 1;
          min-width: 0;
        }

        .ghost-select {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          background: var(--surface);
          color: var(--text);
          border: 1px solid var(--input-border);
          border-radius: 8px;
          padding: 8px 28px 8px 10px;
          font-size: 12px;
        }

        .ghost-select option {
          background: var(--surface);
          color: var(--text);
        }

        .ghost-select-arrow {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 10px;
          color: var(--text-faint);
          pointer-events: none;
        }

        @media (max-width: 560px) {
          .ghost-page {
            padding: 16px;
          }

          .ghost-row {
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
          }

          .ghost-row-info {
            flex: 0 1 auto;
          }

          .ghost-row-actions {
            width: 100%;
          }

          .ghost-row-actions button {
            flex: 1 1 auto;
          }

          .ghost-message-form {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
