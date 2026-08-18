"use client";

import { useEffect, useState } from "react";
import { useProfileView } from "@/context/ProfileViewContext.jsx";
import Avatar from "@/components/common/Avatar.jsx";

export default function SearchDrawer({ onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { openProfile } = useProfileView();

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`, { credentials: "include" })
        .then((res) => res.json())
        .then((data) => setResults(Array.isArray(data) ? data : []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  function handlePick(username) {
    openProfile(username);
    onClose();
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()} style={{ width: 320 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>🔍 Pesquisar</h3>
          <button onClick={onClose} style={{ fontSize: 12, padding: "2px 8px" }} title="Fechar">
            ✕
          </button>
        </div>

        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome de usuário"
          style={{ width: "100%", marginBottom: 12 }}
        />

        {loading && <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Buscando...</p>}

        {!loading && query.trim() && results.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Nenhum usuário encontrado.</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => handlePick(u.username)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                textAlign: "left",
                border: "none",
                borderRadius: 8,
                padding: "8px 6px",
                background: "transparent",
              }}
            >
              <Avatar username={u.username} avatarColor={u.avatarColor} avatarUrl={u.avatarUrl} size={34} />
              <span style={{ fontSize: 14 }}>{u.username}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
