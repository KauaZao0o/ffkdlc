import { AuthProvider } from "@/context/AuthContext.jsx";
import { SoundProvider } from "@/context/SoundContext.jsx";
import { ThemeProvider } from "@/context/ThemeContext.jsx";
import "./globals.css";

// Roda antes do React hidratar, pra aplicar o tema salvo (ou a preferência
// do sistema) já no primeiro paint e evitar aquele "flash" de tela clara
// antes de escurecer.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem("chat-theme");
    var theme = saved === "light" || saved === "dark"
      ? saved
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

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
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <SoundProvider>{children}</SoundProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
