import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

// Apaga uma mensagem. Só quem escreveu a mensagem pode apagá-la.
export async function DELETE(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const message = await prisma.message.findUnique({ where: { id: params.messageId } });

  if (!message || message.conversationId !== params.id) {
    return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
  }

  if (message.senderId !== userId) {
    return NextResponse.json({ error: "Você só pode apagar suas próprias mensagens." }, { status: 403 });
  }

  await prisma.message.delete({ where: { id: params.messageId } });

  return NextResponse.json({ ok: true });
}
