import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireGhost } from "@/lib/auth";

// Lista quem está banido de um grupo específico. Só a conta Ghost tem
// acesso.
export async function GET(request, { params }) {
  const { response } = await requireGhost(request);
  if (response) return response;

  const bans = await prisma.groupBan.findMany({
    where: { conversationId: params.id },
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(bans.map((b) => ({ userId: b.user.id, username: b.user.username })));
}

// Bane um usuário de um grupo - ele não pode mais ser adicionado (não
// remove quem já está no grupo). Só a conta Ghost tem acesso.
export async function POST(request, { params }) {
  const { response } = await requireGhost(request);
  if (response) return response;

  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: "Informe o usuário a banir." }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({ where: { id: params.id } });
  if (!conversation || !conversation.isGroup) {
    return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
  }

  await prisma.groupBan.upsert({
    where: { conversationId_userId: { conversationId: params.id, userId } },
    update: {},
    create: { conversationId: params.id, userId },
  });

  return NextResponse.json({ ok: true });
}
