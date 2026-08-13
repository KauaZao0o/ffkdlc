import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

// Edita o nome e/ou a foto do grupo. Qualquer participante do grupo pode
// fazer essa alteração (igual ao padrão do WhatsApp) - não é restrito a
// administradores.
export async function PATCH(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const conversation = await prisma.conversation.findUnique({ where: { id: params.id } });
  if (!conversation) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }
  if (!conversation.isGroup) {
    return NextResponse.json({ error: "Só é possível editar grupos." }, { status: 400 });
  }

  const membership = await prisma.conversationMember.findUnique({
    where: { userId_conversationId: { userId, conversationId: params.id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Você não participa desse grupo." }, { status: 403 });
  }

  const { name, avatarUrl } = await request.json();
  const data = {};

  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json({ error: "O nome do grupo não pode ficar vazio." }, { status: 400 });
    }
    data.name = name.trim();
  }
  if (avatarUrl !== undefined) {
    data.avatarUrl = avatarUrl;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const updated = await prisma.conversation.update({ where: { id: params.id }, data });

  return NextResponse.json({ id: updated.id, name: updated.name, avatarUrl: updated.avatarUrl });
}

// Apaga um grupo (e, em cascata, todas as mensagens e participações dele,
// graças ao onDelete: Cascade no schema). Só administradores podem apagar.
export async function DELETE(request, { params }) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const conversation = await prisma.conversation.findUnique({ where: { id: params.id } });
  if (!conversation) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  if (!conversation.isGroup) {
    return NextResponse.json({ error: "Conversas privadas não podem ser excluídas por aqui." }, { status: 400 });
  }

  const membership = await prisma.conversationMember.findUnique({
    where: { userId_conversationId: { userId, conversationId: params.id } },
  });

  if (!membership?.isAdmin) {
    return NextResponse.json({ error: "Só administradores do grupo podem excluí-lo." }, { status: 403 });
  }

  try {
    await prisma.conversation.delete({ where: { id: params.id } });
  } catch (err) {
    console.error(err);
    if (err.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Não foi possível excluir: o banco ainda tem mensagens/participantes vinculados e a exclusão em cascata não está configurada. Rode 'npx prisma migrate dev' no projeto para aplicar a migration mais recente.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Erro ao excluir o grupo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
