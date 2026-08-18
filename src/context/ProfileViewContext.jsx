"use client";

import { createContext, useContext, useState } from "react";
import UserProfileModal from "@/components/profile/UserProfileModal.jsx";

const ProfileViewContext = createContext(null);

// Estado global de "qual perfil está aberto agora" - permite abrir o
// perfil de qualquer lugar do app (busca, lista de participantes, menção
// numa mensagem) sem precisar passar callbacks por várias camadas de
// componentes.
export function ProfileViewProvider({ children }) {
  const [openUsername, setOpenUsername] = useState(null);

  const value = {
    openProfile: (username) => setOpenUsername(username),
    closeProfile: () => setOpenUsername(null),
  };

  return (
    <ProfileViewContext.Provider value={value}>
      {children}
      {openUsername && <UserProfileModal username={openUsername} onClose={() => setOpenUsername(null)} />}
    </ProfileViewContext.Provider>
  );
}

export function useProfileView() {
  const ctx = useContext(ProfileViewContext);
  if (!ctx) throw new Error("useProfileView precisa ser usado dentro de um ProfileViewProvider");
  return ctx;
}
