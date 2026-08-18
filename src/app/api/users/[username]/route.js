import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

// Perfil público de um usuário (username, avatar, quando a conta foi
// criada, última vez visto). Qualquer usuário logado pode ver o perfil de
// qualquer outro - a conta Ghost nunca aparece aqui.
export async function GET(request, { params }) {
  const requesterId = getUserIdFromRequest(request);
  if (!requesterId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { username: params.username },
    select: {
      id: true,
      username: true,
      avatarColor: true,
      avatarUrl: true,
      createdAt: true,
      lastSeenAt: true,
      isGhost: true,
    },
  });

  if (!user || user.isGhost) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const { isGhost, ...publicUser } = user;
  return NextResponse.json(publicUser);
}
