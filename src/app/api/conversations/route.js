import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

const GHOST_TARGET_ERROR = "Esse usuário não pode ser adicionado a uma conversa.";

// Lista todas as conversas (privadas + grupos) do usuário logado,
// já com a última mensagem para exibir na sidebar.
export async function GET(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: { include: { user: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  const conversations = memberships
    .filter((m) => {
      // Se o usuário "apagou para mim" e não chegou mensagem nova depois
      // disso, a conversa continua escondida da lista dele.
      if (!m.hiddenAt) return true;
      const lastMessage = m.conversation.messages[0];
      return lastMessage && new Date(lastMessage.createdAt) > new Date(m.hiddenAt);
    })
    .map((m) => {
      const conv = m.conversation;
      const otherMembers = conv.members.map((mem) => mem.user).filter((u) => u.id !== userId);

      return {
        id: conv.id,
        isGroup: conv.isGroup,
        name: conv.isGroup ? conv.name : otherMembers[0]?.username || "Conversa",
        avatarUrl: conv.isGroup ? conv.avatarUrl : otherMembers[0]?.avatarUrl || null,
        avatarColor: conv.isGroup ? null : otherMembers[0]?.avatarColor,
        lastMessage: conv.messages[0] || null,
        participants: otherMembers.map((u) => ({
          id: u.id,
          username: u.username,
          avatarColor: u.avatarColor,
          avatarUrl: u.avatarUrl,
        })),
      };
    });

  return NextResponse.json(conversations);
}

// Cria (ou reaproveita) uma conversa privada com outro usuário.
export async function POST(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { otherUserId } = await request.json();
  if (!otherUserId) {
    return NextResponse.json({ error: "Informe o usuário com quem deseja conversar." }, { status: 400 });
  }

  // Ninguém pode chamar o Ghost pra conversar (ele nunca aparece no
  // picker, mas bloqueia mesmo assim quem tentar direto pela API) - o
  // próprio Ghost, porém, pode iniciar conversas normalmente.
  const target = await prisma.user.findUnique({ where: { id: otherUserId }, select: { isGhost: true } });
  if (!target || target.isGhost) {
    return NextResponse.json({ error: GHOST_TARGET_ERROR }, { status: 400 });
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      members: { some: { userId } },
      AND: { members: { some: { userId: otherUserId } } },
    },
  });

  if (existing) return NextResponse.json({ id: existing.id });

  const conversation = await prisma.conversation.create({
    data: { isGroup: false, members: { create: [{ userId }, { userId: otherUserId }] } },
  });

  return NextResponse.json({ id: conversation.id }, { status: 201 });
}
