"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext.jsx";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await login(username, password);
      router.push("/chat");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: 24 }}>
      <h2>Entrar</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input placeholder="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <button type="submit" className="primary">Entrar</button>
      </form>
      <p style={{ fontSize: 14, marginTop: 16 }}>
        Não tem conta? <Link href="/register">Cadastre-se</Link>
      </p>
    </div>
  );
}
