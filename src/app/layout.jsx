import { AuthProvider } from "@/context/AuthContext.jsx";
import "./globals.css";

export const metadata = {
  title: "Chat App",
  description: "Chat em tempo real com Next.js e Supabase",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
