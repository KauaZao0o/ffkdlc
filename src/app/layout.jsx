import { AuthProvider } from "@/context/AuthContext.jsx";
import { SoundProvider } from "@/context/SoundContext.jsx";
import "./globals.css";

export const metadata = {
  title: "Chat App",
  description: "Chat em tempo real com Next.js e Supabase",
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
