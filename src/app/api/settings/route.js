import { NextResponse } from "next/server";
import { getAppSettings } from "@/lib/settings";

// Sem nenhum parâmetro de request, o Next.js trata essa rota como
// estática e a "congela" no build de produção (Vercel) - o toggle do
// Ghost nunca apareceria pra quem visita /login ou /register depois do
// deploy. Isso força a rota a rodar de novo em toda requisição.
export const dynamic = "force-dynamic";

// Configurações públicas do site (sem autenticação) - hoje só se o
// cadastro está aberto, usado pelas telas de /login e /register.
export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json({ registrationEnabled: settings.registrationEnabled });
}
