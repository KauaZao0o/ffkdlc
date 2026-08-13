import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

// Remove um participante do grupo. Só administradores podem tirar outras
// pessoas do grupo. Um admin não pode se remover por aqui (use "Sair do
// grupo" para isso).
export async function DELETE(request, { params }) {
  const requesterId = getUserIdFromRequest(request);
  if (!requesterId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id: conversationId, userId: targetUserId } = params;

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }
  if (!conversation.isGroup) {
    return NextResponse.json({ error: "Só é possível remover participantes de grupos." }, { status: 400 });
  }

  if (targetUserId === requesterId) {
    return NextResponse.json({ error: "Use 'Sair do grupo' para se remover." }, { status: 400 });
  }

  const requesterMembership = await prisma.conversationMember.findUnique({
    where: { userId_conversationId: { userId: requesterId, conversationId } },
  });
  if (!requesterMembership?.isAdmin) {
    return NextResponse.json({ error: "Só administradores do grupo podem remover participantes." }, { status: 403 });
  }

  const targetMembership = await prisma.conversationMember.findUnique({
    where: { userId_conversationId: { userId: targetUserId, conversationId } },
  });
  if (!targetMembership) {
    return NextResponse.json({ error: "Essa pessoa não participa do grupo." }, { status: 404 });
  }

  await prisma.conversationMember.delete({ where: { id: targetMembership.id } });

  return NextResponse.json({ ok: true });
}
