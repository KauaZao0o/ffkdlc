import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

// Chamado periodicamente pelo cliente enquanto a pessoa está com o app
// aberto, só pra manter "lastSeenAt" atualizado (usado no perfil como
// "visto por último em..." quando ela não está online agora).
export async function POST(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
