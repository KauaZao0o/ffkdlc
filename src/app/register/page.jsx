"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext.jsx";
import ThemeToggle from "@/components/common/ThemeToggle.jsx";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  // Se o Ghost ligar/desligar o cadastro público enquanto essa tela está
  // aberta, atualiza na hora - sem precisar recarregar a página.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("app-settings")
      .on("broadcast", { event: "registration-toggle" }, ({ payload }) => {
        setRegistrationEnabled(payload.registrationEnabled !== false);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

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
      <div className="auth-page">
        <div className="auth-card">
          <ThemeToggle className="auth-theme-toggle" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ffpkdlc-icon.png" alt="" className="auth-logo" />
          <h2 className="auth-title">Criar conta</h2>
          <p className="auth-muted">O cadastro está desativado no momento.</p>
          <p className="auth-footer">
            <Link href="/login">Voltar para o login</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <ThemeToggle className="auth-theme-toggle" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ffpkdlc-icon.png" alt="" className="auth-logo" />
        <h2 className="auth-title">Criar conta</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <input placeholder="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="primary">
            Cadastrar
          </button>
        </form>
        <p className="auth-footer">
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
