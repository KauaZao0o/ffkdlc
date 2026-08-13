import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

export async function GET(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const members = await prisma.conversationMember.findMany({
    where: { conversationId: params.id },
    include: { user: { select: { id: true, username: true, avatarColor: true, isOnline: true } } },
  });

  return NextResponse.json(members.map((m) => ({ ...m.user, isAdmin: m.isAdmin })));
}

// Adiciona novos participantes a um grupo já existente. Qualquer membro
// atual do grupo pode adicionar mais gente (igual ao padrão do WhatsApp).
export async function POST(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const conversation = await prisma.conversation.findUnique({ where: { id: params.id } });
  if (!conversation) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }
  if (!conversation.isGroup) {
    return NextResponse.json({ error: "Só é possível adicionar participantes em grupos." }, { status: 400 });
  }

  const requesterMembership = await prisma.conversationMember.findUnique({
    where: { userId_conversationId: { userId, conversationId: params.id } },
  });
  if (!requesterMembership) {
    return NextResponse.json({ error: "Você não participa desse grupo." }, { status: 403 });
  }

  const { memberIds } = await request.json();
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos uma pessoa." }, { status: 400 });
  }

  const existing = await prisma.conversationMember.findMany({
    where: { conversationId: params.id },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((m) => m.userId));
  const newIds = memberIds.filter((id) => !existingIds.has(id));

  if (newIds.length > 0) {
    await prisma.conversationMember.createMany({
      data: newIds.map((id) => ({ userId: id, conversationId: params.id })),
    });
  }

  return NextResponse.json({ ok: true, added: newIds.length });
}
