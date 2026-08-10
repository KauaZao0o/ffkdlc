"use client";

import { useEffect, useState } from "react";

export default function ParticipantsList({ conversation }) {
  const [participants, setParticipants] = useState([]);

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

  return (
    <div className="participants-panel">
      <p style={{ fontSize: 13, fontWeight: 500, color: "#777", margin: "0 0 12px" }}>Participantes</p>
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
  );
}
