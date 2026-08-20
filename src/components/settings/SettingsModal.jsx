"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext.jsx";
import { useTheme } from "@/context/ThemeContext.jsx";
import { uploadChatFile } from "@/lib/uploadImage";
import Avatar from "@/components/common/Avatar.jsx";

export default function SettingsModal({ onClose }) {
  const router = useRouter();
  const { user, updateUser, logout } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();

  const [username, setUsername] = useState(user.username);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError("A imagem precisa ter no máximo 5MB.");
      return;
    }

    setProfileError("");
    setUploadingAvatar(true);
    try {
      const url = await uploadChatFile(file, `avatars/${user.id}`);
      setAvatarUrl(url);
    } catch (err) {
      console.error(err);
      setProfileError("Não foi possível enviar a imagem.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setSavingProfile(true);

    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, avatarUrl }),
      });
      const data = await res.json();

      if (!res.ok) {
        setProfileError(data.error || "Não foi possível salvar.");
        return;
      }

      updateUser(data);
      setProfileSuccess("Perfil atualizado!");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas novas não coincidem.");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPasswordError(data.error || "Não foi possível trocar a senha.");
        return;
      }

      setPasswordSuccess("Senha atualizada!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    setDeleteError("");

    if (!confirm("Tem certeza que quer apagar sua conta? Todas as suas conversas e mensagens serão perdidas para sempre. Essa ação não pode ser desfeita.")) {
      return;
    }

    setDeletingAccount(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: deletePassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setDeleteError(data?.error || "Não foi possível apagar a conta.");
        return;
      }

      await logout();
      router.replace("/login");
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()} style={{ width: 340 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>Configurações</h3>
          <button onClick={onClose} style={{ fontSize: 12, padding: "2px 8px" }} title="Fechar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>Perfil</p>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar username={username} avatarColor={user.avatarColor} avatarUrl={avatarUrl} size={56} />
            <label style={{ fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
              {uploadingAvatar ? "Enviando..." : "Trocar foto"}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <label style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Nome de usuário
            <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: "100%", marginTop: 4 }} />
          </label>

          {profileError && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{profileError}</p>}
          {profileSuccess && <p style={{ color: "var(--success)", fontSize: 13, margin: 0 }}>{profileSuccess}</p>}

          <button type="submit" className="primary" disabled={savingProfile || uploadingAvatar}>
            {savingProfile ? "Salvando..." : "Salvar perfil"}
          </button>
        </form>

        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--text-muted)", marginBottom: 12 }}>Aparência</p>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <span style={{ fontSize: 14 }}>Modo escuro</span>
            <span className="theme-switch">
              <input type="checkbox" checked={isDark} onChange={toggleTheme} />
              <span className="theme-switch-track" />
            </span>
          </label>
        </div>

        <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>Trocar senha</p>

          <input
            type="password"
            placeholder="Senha atual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Nova senha"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {passwordError && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{passwordError}</p>}
          {passwordSuccess && <p style={{ color: "var(--success)", fontSize: 13, margin: 0 }}>{passwordSuccess}</p>}

          <button type="submit" disabled={savingPassword}>
            {savingPassword ? "Salvando..." : "Trocar senha"}
          </button>
        </form>

        {!user.isGhost && (
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 500, color: "var(--danger)" }}>Zona de perigo</p>

          {!showDeleteAccount ? (
            <button type="button" onClick={() => setShowDeleteAccount(true)} style={{ color: "var(--danger)" }}>
              Apagar minha conta
            </button>
          ) : (
            <form onSubmit={handleDeleteAccount} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                Isso apaga sua conta, conversas e mensagens para sempre. Digite sua senha para confirmar.
              </p>
              <input
                type="password"
                placeholder="Sua senha"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoFocus
              />

              {deleteError && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{deleteError}</p>}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteAccount(false);
                    setDeletePassword("");
                    setDeleteError("");
                  }}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={deletingAccount || !deletePassword}
                  style={{ flex: 1, background: "var(--danger)", color: "white", borderColor: "var(--danger)" }}
                >
                  {deletingAccount ? "Apagando..." : "Apagar conta"}
                </button>
              </div>
            </form>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
