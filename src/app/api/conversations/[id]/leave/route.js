import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

// Remove o usuário logado do grupo (ele deixa de ser participante).
// O grupo continua existindo normalmente para quem ficou.
export async function POST(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const conversation = await prisma.conversation.findUnique({ where: { id: params.id } });
  if (!conversation) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }
  if (!conversation.isGroup) {
    return NextResponse.json({ error: "Só é possível sair de grupos." }, { status: 400 });
  }

  const membership = await prisma.conversationMember.findUnique({
    where: { userId_conversationId: { userId, conversationId: params.id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Você não participa desse grupo." }, { status: 404 });
  }

  await prisma.conversationMember.delete({ where: { id: membership.id } });

  // Se quem saiu era o único administrador, promove automaticamente o
  // participante mais antigo restante, para o grupo não ficar "órfão".
  if (membership.isAdmin) {
    const remaining = await prisma.conversationMember.findMany({
      where: { conversationId: params.id },
      orderBy: { joinedAt: "asc" },
    });
    const stillHasAdmin = remaining.some((m) => m.isAdmin);
    if (!stillHasAdmin && remaining.length > 0) {
      await prisma.conversationMember.update({
        where: { id: remaining[0].id },
        data: { isAdmin: true },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
