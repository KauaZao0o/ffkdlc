import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireGhost } from "@/lib/auth";

// Lista todas as conversas do sistema (metadados, sem conteúdo das
// mensagens). Só a conta Ghost tem acesso.
export async function GET(request) {
  const { response } = await requireGhost(request);
  if (response) return response;

  const conversations = await prisma.conversation.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      members: { include: { user: { select: { id: true, username: true } } } },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(
    conversations.map((c) => ({
      id: c.id,
      isGroup: c.isGroup,
      name: c.name,
      createdAt: c.createdAt,
      messageCount: c._count.messages,
      members: c.members.map((m) => ({ id: m.user.id, username: m.user.username, isAdmin: m.isAdmin })),
    }))
  );
}
