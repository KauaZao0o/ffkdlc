import { NextResponse } from "next/server";
import { getAppSettings } from "@/lib/settings";

// Configurações públicas do site (sem autenticação) - hoje só se o
// cadastro está aberto, usado pelas telas de /login e /register.
export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json({ registrationEnabled: settings.registrationEnabled });
}
