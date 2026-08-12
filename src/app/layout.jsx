import { AuthProvider } from "@/context/AuthContext.jsx";
import { SoundProvider } from "@/context/SoundContext.jsx";
import "./globals.css";

export const metadata = {
  title: "Chat App",
  description: "Chat em tempo real com Next.js e Supabase",
};

// Sem isso, o navegador do celular renderiza a página numa "tela virtual"
// larga (~980px) e encolhe tudo, e os media queries de mobile no CSS
// nunca chegam a ativar de verdade.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          <SoundProvider>{children}</SoundProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
