import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

// Busca usuários pelo nome (contém, sem diferenciar maiúsculas/minúsculas).
// Sem "q", lista todo mundo em ordem alfabética. A conta Ghost nunca
// aparece.
export async function GET(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() || "";

  const users = await prisma.user.findMany({
    where: {
      isGhost: false,
      id: { not: userId },
      ...(q ? { username: { contains: q, mode: "insensitive" } } : {}),
    },
    select: { id: true, username: true, avatarColor: true, avatarUrl: true },
    take: q ? 20 : undefined,
    orderBy: { username: "asc" },
  });

  return NextResponse.json(users);
}
