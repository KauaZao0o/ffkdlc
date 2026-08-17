"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext.jsx";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [checkingSettings, setCheckingSettings] = useState(true);
  const { register } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setRegistrationEnabled(data.registrationEnabled !== false))
      .catch(() => {})
      .finally(() => setCheckingSettings(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await register(username, password);
      router.push("/chat");
    } catch (err) {
      setError(err.message);
    }
  }

  if (checkingSettings) return null;

  if (!registrationEnabled) {
    return (
      <div style={{ maxWidth: 360, margin: "80px auto", padding: 24 }}>
        <h2>Criar conta</h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>O cadastro está desativado no momento.</p>
        <p style={{ fontSize: 14, marginTop: 16 }}>
          <Link href="/login">Voltar para o login</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: 24 }}>
      <h2>Criar conta</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input placeholder="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <button type="submit" className="primary">Cadastrar</button>
      </form>
      <p style={{ fontSize: 14, marginTop: 16 }}>
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </div>
  );
}
