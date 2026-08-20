"use client";

import { useEffect, useState } from "react";
import { useProfileView } from "@/context/ProfileViewContext.jsx";
import { usePresence } from "@/context/PresenceContext.jsx";
import Avatar from "@/components/common/Avatar.jsx";

export default function SearchDrawer({ onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { openProfile } = useProfileView();
  const { onlineMap } = usePresence();

  // Sem digitar nada, já mostra todo mundo em ordem alfabética (a API já
  // devolve assim) - a busca só filtra essa mesma lista.
  useEffect(() => {
    const trimmed = query.trim();
    setLoading(true);
    const timeout = setTimeout(
      () => {
        fetch(`/api/users/search${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ""}`, { credentials: "include" })
          .then((res) => res.json())
          .then((data) => setResults(Array.isArray(data) ? data : []))
          .catch(() => setResults([]))
          .finally(() => setLoading(false));
      },
      trimmed ? 250 : 0
    );

    return () => clearTimeout(timeout);
  }, [query]);

  function handlePick(username) {
    openProfile(username);
    onClose();
  }

  // A API já devolve em ordem alfabética - só precisamos separar em dois
  // grupos (online primeiro) mantendo essa mesma ordem dentro de cada um.
  const onlineResults = results.filter((u) => !!onlineMap[u.id]);
  const offlineResults = results.filter((u) => !onlineMap[u.id]);

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

        {!loading && results.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>
            {query.trim() ? "Nenhum usuário encontrado." : "Nenhum usuário cadastrado ainda."}
          </p>
        )}

        {onlineResults.length > 0 && (
          <>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 4px" }}>
              Online ({onlineResults.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: offlineResults.length > 0 ? 16 : 0 }}>
              {onlineResults.map((u) => (
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
                  <Avatar username={u.username} avatarColor={u.avatarColor} avatarUrl={u.avatarUrl} size={34} isOnline />
                  <span style={{ fontSize: 14 }}>{u.username}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {offlineResults.length > 0 && (
          <>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 4px" }}>
              Offline ({offlineResults.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {offlineResults.map((u) => (
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
                    opacity: 0.7,
                  }}
                >
                  <Avatar username={u.username} avatarColor={u.avatarColor} avatarUrl={u.avatarUrl} size={34} isOnline={false} />
                  <span style={{ fontSize: 14 }}>{u.username}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
