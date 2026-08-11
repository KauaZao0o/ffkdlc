import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

// "Apagar para mim": esconde a conversa da lista desse usuário, sem
// afetar os outros participantes nem apagar mensagens do banco. Se
// chegar uma mensagem nova depois disso, a conversa reaparece sozinha
// (igual ao comportamento do WhatsApp).
export async function POST(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const membership = await prisma.conversationMember.findUnique({
    where: { userId_conversationId: { userId, conversationId: params.id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Você não participa dessa conversa." }, { status: 404 });
  }

  await prisma.conversationMember.update({
    where: { id: membership.id },
    data: { hiddenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
