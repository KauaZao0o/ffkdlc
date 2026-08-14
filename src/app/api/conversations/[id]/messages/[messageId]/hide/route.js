import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

// "Apagar para mim" numa mensagem: some da SUA lista, mas continua
// existindo normalmente para todo mundo (inclusive pra você, se entrar
// com outra conta - é só uma preferência de visualização por usuário).
export async function POST(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const message = await prisma.message.findUnique({ where: { id: params.messageId } });
  if (!message || message.conversationId !== params.id) {
    return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  }

  await prisma.messageHiddenFor.upsert({
    where: { messageId_userId: { messageId: params.messageId, userId } },
    update: {},
    create: { messageId: params.messageId, userId },
  });

  return NextResponse.json({ ok: true });
}
