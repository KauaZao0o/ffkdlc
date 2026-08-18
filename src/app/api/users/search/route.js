import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/auth";

// Busca usuários pelo nome (contém, sem diferenciar maiúsculas/minúsculas).
// A conta Ghost nunca aparece na busca.
export async function GET(request) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (!q) return NextResponse.json([]);

  const users = await prisma.user.findMany({
    where: {
      username: { contains: q, mode: "insensitive" },
      isGhost: false,
      id: { not: userId },
    },
    select: { id: true, username: true, avatarColor: true, avatarUrl: true },
    take: 20,
    orderBy: { username: "asc" },
  });

  return NextResponse.json(users);
}
