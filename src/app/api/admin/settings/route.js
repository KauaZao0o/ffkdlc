import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { requireGhost } from "@/lib/auth";

// Liga/desliga o cadastro público (link "Cadastre-se" no /login e a rota
// /register). Só a conta Ghost tem acesso.
export async function PATCH(request) {
  const { response } = await requireGhost(request);
  if (response) return response;

  const { registrationEnabled } = await request.json();
  if (typeof registrationEnabled !== "boolean") {
    return NextResponse.json({ error: "Informe registrationEnabled (true/false)." }, { status: 400 });
  }

  await getAppSettings();
  const updated = await prisma.appSettings.update({
    where: { id: 1 },
    data: { registrationEnabled },
  });

  return NextResponse.json({ registrationEnabled: updated.registrationEnabled });
}
