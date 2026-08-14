import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

// Apaga uma mensagem PARA TODO MUNDO. Só quem escreveu a mensagem pode
// fazer isso - ou o administrador do grupo, apagando mensagem de outra
// pessoa (equivalente ao poder de moderação do WhatsApp/Discord).
export async function DELETE(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const message = await prisma.message.findUnique({ where: { id: params.messageId } });

  if (!message || message.conversationId !== params.id) {
    return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  }

  const isSender = message.senderId === userId;

  if (!isSender) {
    const membership = await prisma.conversationMember.findUnique({
      where: { userId_conversationId: { userId, conversationId: params.id } },
    });

    if (!membership?.isAdmin) {
      return NextResponse.json(
        { error: "Você só pode apagar suas próprias mensagens (ou ser admin do grupo)." },
        { status: 403 }
      );
    }
  }

  await prisma.message.delete({ where: { id: params.messageId } });

  return NextResponse.json({ ok: true });
}
