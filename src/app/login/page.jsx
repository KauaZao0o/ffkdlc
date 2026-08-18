"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext.jsx";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setRegistrationEnabled(data.registrationEnabled !== false))
      .catch(() => {});
  }, []);

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
    <div className="auth-page">
      <div className="auth-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ffpkdlc-icon.png" alt="" className="auth-logo" />
        <h2 className="auth-title">Entrar</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <input placeholder="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="primary">
            Entrar
          </button>
        </form>
        {registrationEnabled && (
          <p className="auth-footer">
            Não tem conta? <Link href="/register">Cadastre-se</Link>
          </p>
        )}
      </div>
    </div>
  );
}
